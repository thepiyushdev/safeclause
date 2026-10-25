// api/extract-terms.js - Contract Memory: pull structured terms (and short clause excerpts) from a scanned contract

const SB_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const ACTIVE_MS = 20 * 60 * 1000;
const enc = encodeURIComponent;

async function sbFetch(pathAndQuery, opts) {
  const o = opts || {};
  const headers = Object.assign(
    { apikey: SB_SERVICE, Authorization: "Bearer " + SB_SERVICE, "Content-Type": "application/json" },
    o.headers || {}
  );
  const r = await fetch(SB_URL + "/rest/v1/" + pathAndQuery, { method: o.method || "GET", headers: headers, body: o.body });
  const text = await r.text();
  if (!r.ok) {
    const err = new Error("Database error (" + r.status + "): " + (text || "").slice(0, 200));
    err.status = r.status;
    throw err;
  }
  try { return text ? JSON.parse(text) : null; } catch (e) { return null; }
}

async function getUser(req) {
  const h = req.headers.authorization || "";
  const token = h.indexOf("Bearer ") === 0 ? h.slice(7) : "";
  if (!token) return null;
  const r = await fetch(SB_URL + "/auth/v1/user", { headers: { apikey: SB_SERVICE, Authorization: "Bearer " + token } });
  if (!r.ok) return null;
  const u = await r.json();
  return u && u.id ? u : null;
}

function readBody(req) {
  let b = req.body;
  if (typeof b === "string") { try { b = JSON.parse(b); } catch (e) { b = {}; } }
  return b || {};
}

async function getProfile(userId) {
  try {
    const rows = await sbFetch("profiles?id=eq." + enc(userId) + "&select=pro_until");
    return rows && rows[0] ? rows[0] : null;
  } catch (e) {
    return null;
  }
}

function proActive(p) {
  return !!(p && p.pro_until && Date.parse(p.pro_until) > Date.now());
}

function cleanLabel(s) {
  return String(s || "").replace(/[^\w .,()\/+-]/g, "").slice(0, 60) || "Unknown device";
}

function deviceView(rows, deviceId) {
  const now = Date.now();
  return (rows || []).filter(function (r) { return !r.revoked; }).map(function (r) {
    return {
      device_id: r.device_id,
      label: r.label || "Unknown device",
      last_seen: r.last_seen,
      current: r.device_id === deviceId,
      active: now - Date.parse(r.last_seen) < ACTIVE_MS,
    };
  });
}

// Free = 1 device at a time, Pro = 3. If the devices table does not exist yet, the gate stays open.
async function deviceGate(userId, deviceId, pro, opts) {
  const o = opts || {};
  const limit = pro ? 3 : 1;
  let rows;
  try {
    rows = await sbFetch("devices?user_id=eq." + enc(userId) + "&select=device_id,label,last_seen,revoked&order=last_seen.desc");
  } catch (e) {
    return { ok: true, skipped: true, devices: [], limit: limit };
  }
  rows = rows || [];
  const now = Date.now();
  if (!/^[A-Za-z0-9-]{8,64}$/.test(String(deviceId || ""))) {
    return { ok: false, missing: true, devices: deviceView(rows, ""), limit: limit };
  }
  const me = rows.find(function (r) { return r.device_id === deviceId; });
  const others = rows.filter(function (r) {
    return r.device_id !== deviceId && !r.revoked && now - Date.parse(r.last_seen) < ACTIVE_MS;
  });
  if (me && me.revoked && !o.fresh) return { ok: false, revoked: true, devices: deviceView(rows, deviceId), limit: limit };
  if (others.length >= limit) return { ok: false, blocked: true, devices: deviceView(rows, deviceId), limit: limit };
  if (o.readOnly) return { ok: true, devices: deviceView(rows, deviceId), limit: limit };
  const row = { user_id: userId, device_id: deviceId, last_seen: new Date(now).toISOString(), revoked: false };
  if (o.label) row.label = cleanLabel(o.label);
  else if (!me) row.label = "Unknown device";
  await sbFetch("devices?on_conflict=user_id,device_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(row),
  });
  const merged = rows.filter(function (r) { return r.device_id !== deviceId; }).concat([{
    device_id: deviceId, label: row.label || (me ? me.label : "Unknown device"), last_seen: row.last_seen, revoked: false,
  }]);
  return { ok: true, devices: deviceView(merged, deviceId), limit: limit };
}

function deviceFail(res, g) {
  let msg = "Device limit reached. The Free plan allows 1 device at a time and Pro allows 3. Sign out another device in Account.";
  if (g.revoked) msg = "This device was signed out. Please log in again.";
  if (g.missing) msg = "Please reload the page and try again.";
  return res.status(403).json({ error: msg, code: "DEVICE_LIMIT" });
}


const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MAX_CHARS = 10000;
const MODELS = Array.from(new Set([process.env.GROQ_MODEL, "openai/gpt-oss-20b", "openai/gpt-oss-120b", "llama-3.3-70b-versatile"].filter(Boolean)));

const SYSTEM_PROMPT = [
  "You extract structured terms from a freelance contract so a freelancer can track the project.",
  "Return ONE JSON object only, no markdown. Use null when a value is not stated in the contract:",
  '{"project_name": string or null, "client_name": string or null,',
  ' "payment_days": integer or null (e.g. 30 for Net-30),',
  ' "late_fee_pct_month": number or null,',
  ' "revision_cap": integer or null (number of revision rounds included),',
  ' "hourly_rate": number or null (only if the contract states one),',
  ' "liability_cap": string or null (short, e.g. "Capped at fees paid" or "Uncapped"),',
  ' "scope_deliverables": [short strings, max 8],',
  ' "excerpts": {"scope": string, "revision": string, "payment": string, "liability": string}}',
  "Rules:",
  "- Each excerpt must be copied VERBATIM from the contract, 400 characters at most, or an empty string if the contract has no such clause.",
  "- Never invent values. Do not include any other text from the contract.",
].join("\n");

async function callGroq(model, key, contract) {
  const body = {
    model: model,
    messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: "CONTRACT:\n" + contract }],
    temperature: 0,
    max_completion_tokens: 2500,
  };
  if (model.indexOf("gpt-oss") !== -1) body.reasoning_effort = "low";
  const ctrl = new AbortController();
  const timer = setTimeout(function () { ctrl.abort(); }, 45000);
  try {
    const r = await fetch(GROQ_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const raw = await r.text();
    if (!r.ok) {
      const err = new Error("Groq HTTP " + r.status + " (" + model + "): " + raw.slice(0, 200));
      err.status = r.status;
      throw err;
    }
    const data = JSON.parse(raw);
    const msg = data && data.choices && data.choices[0] && data.choices[0].message;
    return (msg && msg.content) || "";
  } finally {
    clearTimeout(timer);
  }
}

function extractJson(text) {
  if (!text) return null;
  const s = text.indexOf("{");
  const e = text.lastIndexOf("}");
  if (s === -1 || e <= s) return null;
  try { return JSON.parse(text.slice(s, e + 1)); } catch (err) { return null; }
}

function squash(s) {
  return String(s || "").replace(/\s+/g, " ").trim().toLowerCase();
}
function str(v, max) {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";
}
function int(v, lo, hi) {
  const n = Math.round(Number(v));
  return isFinite(n) && n >= lo && n <= hi ? n : null;
}
function num(v, lo, hi) {
  const n = Number(v);
  return isFinite(n) && n >= lo && n <= hi ? n : null;
}

async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST." });
  if (!SB_URL || !SB_SERVICE) return res.status(500).json({ error: "Server is missing Supabase settings." });
  const key = process.env.GROQ_API_KEY;
  if (!key) return res.status(500).json({ error: "Server is missing GROQ_API_KEY." });
  const body = readBody(req);
  const text = String(body.text || "").trim().slice(0, MAX_CHARS);
  if (text.length < 50) return res.status(400).json({ error: "No contract text to read." });

  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: "Please log in to save to Contract Memory." });
    const pro = proActive(await getProfile(user.id));
    const gate = await deviceGate(user.id, req.headers["x-device-id"], pro);
    if (!gate.ok) return deviceFail(res, gate);

    let parsed = null;
    let lastError = "Could not read the contract terms. Please try again.";
    for (let i = 0; i < MODELS.length && !parsed; i++) {
      try {
        parsed = extractJson(await callGroq(MODELS[i], key, text));
        if (!parsed) lastError = "The AI returned unreadable output. Please try again.";
      } catch (e) {
        lastError = (e && e.message) || lastError;
        if (e && (e.status === 401 || e.status === 403 || e.status === 429)) break;
      }
    }
    if (!parsed) return res.status(502).json({ error: lastError });

    const hay = squash(text);
    const ex = parsed.excerpts && typeof parsed.excerpts === "object" ? parsed.excerpts : {};
    function excerpt(v) {
      const s = str(v, 400);
      return s && hay.indexOf(squash(s)) !== -1 ? s : "";
    }
    const items = Array.isArray(parsed.scope_deliverables) ? parsed.scope_deliverables : [];
    return res.status(200).json({
      success: true,
      terms: {
        name: str(parsed.project_name, 120),
        client_name: str(parsed.client_name, 120),
        payment_days: int(parsed.payment_days, 0, 365),
        late_fee_pct_month: num(parsed.late_fee_pct_month, 0, 100),
        revision_cap: int(parsed.revision_cap, 0, 50),
        hourly_rate: num(parsed.hourly_rate, 0, 1000000),
        liability_cap: str(parsed.liability_cap, 160),
        scope_items: items.map(function (x) { return str(x, 160); }).filter(Boolean).slice(0, 8),
        excerpts: { scope: excerpt(ex.scope), revision: excerpt(ex.revision), payment: excerpt(ex.payment), liability: excerpt(ex.liability) },
      },
    });
  } catch (e) {
    return res.status(500).json({ error: (e && e.message) || "Could not read the contract terms." });
  }
}

export default handler;
