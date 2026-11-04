// api/scope-check.js - Scope Guard: compares a client message with a project's saved terms (Groq)

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
    const rows = await sbFetch("profiles?id=eq." + enc(userId) + "&select=credits,pro_until");
    return rows && rows[0] ? rows[0] : null;
  } catch (e) {
    try {
      const rows2 = await sbFetch("profiles?id=eq." + enc(userId) + "&select=credits");
      return rows2 && rows2[0] ? rows2[0] : null;
    } catch (e2) {
      return null;
    }
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
const FREE_LIMIT = 3;
const MODELS = Array.from(new Set([process.env.GROQ_MODEL, "openai/gpt-oss-20b", "openai/gpt-oss-120b", "llama-3.3-70b-versatile"].filter(Boolean)));

const SYSTEM_PROMPT = [
  "You are Scope Guard, an assistant that protects freelancers from scope creep.",
  "You receive a project's saved contract terms and short contract excerpts, plus a new message from the client.",
  "Decide whether the client's request is inside the agreed scope. Return ONE JSON object only, no markdown:",
  '{"verdict": "IN_SCOPE" | "OUT_OF_SCOPE" | "GREY_AREA",',
  ' "reasoning": "2-3 plain-English sentences",',
  ' "clause_quote": "text copied EXACTLY from the saved excerpts that supports the verdict, or an empty string",',
  ' "counts_as_revision": true | false,',
  ' "reply_script": "polite, ready-to-send reply as plain text, use \\n for line breaks",',
  ' "estimated_hours": number or null,',
  ' "change_order_note": "one or two sentences describing the extra work"}',
  "Rules:",
  "- Use ONLY the saved terms and excerpts. Never invent clauses. If they do not cover the request, use GREY_AREA and say so.",
  "- If the request is a revision and the revision cap is already used up, the verdict is OUT_OF_SCOPE.",
  "- If revisions remain and the request is a normal revision of agreed work, the verdict is IN_SCOPE and counts_as_revision is true.",
  "- estimated_hours: give a realistic estimate only for OUT_OF_SCOPE or GREY_AREA, otherwise null.",
  "- The reply must be polite, specific and never accusatory. For OUT_OF_SCOPE, offer a change order. Include a greeting and a sign-off using [Your Name].",
].join("\n");

async function callGroq(model, key, userMsg) {
  const body = {
    model: model,
    messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: userMsg }],
    temperature: 0.2,
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

function clean(v, max) {
  if (typeof v !== "string") return "";
  return v.replace(/\r\n/g, "\n").replace(/\\n/g, "\n").trim().slice(0, max);
}

function squash(s) {
  return String(s || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function monthStartIso() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
}

async function monthlyUsage(userId) {
  try {
    const rows = await sbFetch("scope_checks?user_id=eq." + enc(userId) + "&created_at=gte." + enc(monthStartIso()) + "&select=id");
    return Array.isArray(rows) ? rows.length : 0;
  } catch (e) {
    return 0;
  }
}

async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST." });
  if (!SB_URL || !SB_SERVICE) return res.status(500).json({ error: "Server is missing Supabase settings." });
  const key = process.env.GROQ_API_KEY;
  if (!key) return res.status(500).json({ error: "Server is missing GROQ_API_KEY." });
  const body = readBody(req);
  const message = String(body.message || "").trim().slice(0, 4000);
  if (message.length < 10) return res.status(400).json({ error: "Paste the client's message first." });

  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: "Session expired. Please log in again." });
    const profile = await getProfile(user.id);
    const pro = proActive(profile);
    const gate = await deviceGate(user.id, req.headers["x-device-id"], pro);
    if (!gate.ok) return deviceFail(res, gate);

    let rows;
    try {
      rows = await sbFetch("projects?id=eq." + enc(String(body.project_id || "")) + "&user_id=eq." + enc(user.id) + "&select=*");
    } catch (e) {
      return res.status(500).json({ error: "Contract Memory is not set up yet. Run supabase-v3.sql in Supabase." });
    }
    const project = rows && rows[0];
    if (!project) return res.status(404).json({ error: "Project not found." });

    let used = await monthlyUsage(user.id);
    if (!pro && used >= FREE_LIMIT) {
      return res.status(402).json({ error: "The Free plan includes " + FREE_LIMIT + " Scope Guard checks per month. Upgrade to Pro for unlimited checks.", code: "UPGRADE", usage: { used: used, limit: FREE_LIMIT } });
    }

    const ex = project.excerpts || {};
    const terms = {
      project_name: project.name, client_name: project.client_name,
      scope_deliverables: project.scope_items || [],
      revision_cap: project.revision_cap, revisions_used: project.revisions_used || 0,
      hourly_rate: project.hourly_rate, liability_cap: project.liability_cap,
      saved_excerpts: { scope: ex.scope || "", revision: ex.revision || "", payment: ex.payment || "", liability: ex.liability || "" },
    };
    const userMsg = "SAVED PROJECT TERMS:\n" + JSON.stringify(terms) + "\n\nNEW CLIENT MESSAGE:\n" + message;

    let parsed = null;
    let lastError = "Scope check is unavailable. Please try again.";
    for (let i = 0; i < MODELS.length && !parsed; i++) {
      try {
        parsed = extractJson(await callGroq(MODELS[i], key, userMsg));
        if (!parsed) lastError = "The AI returned unreadable output. Please try again.";
      } catch (e) {
        lastError = (e && e.message) || lastError;
        if (e && (e.status === 401 || e.status === 403 || e.status === 429)) break;
      }
    }
    if (!parsed) return res.status(502).json({ error: lastError });

    const verdict = ["IN_SCOPE", "OUT_OF_SCOPE", "GREY_AREA"].indexOf(parsed.verdict) !== -1 ? parsed.verdict : "GREY_AREA";
    let quote = clean(parsed.clause_quote, 600);
    const haystack = squash([ex.scope, ex.revision, ex.payment, ex.liability].join(" "));
    if (quote && haystack.indexOf(squash(quote)) === -1) quote = "";

    const rate = Number(project.hourly_rate) > 0 ? Number(project.hourly_rate) : null;
    let hours = Number(parsed.estimated_hours);
    hours = isFinite(hours) && hours > 0 ? Math.min(200, Math.round(hours * 2) / 2) : null;
    if (verdict === "IN_SCOPE") hours = null;
    const cost = hours && rate ? Math.round(hours * rate) : null;
    const sym = project.jurisdiction === "global" ? "$" : "₹";
    let changeOrder = "";
    if (verdict !== "IN_SCOPE") {
      changeOrder = "CHANGE ORDER\nProject: " + project.name + (project.client_name ? "\nClient: " + project.client_name : "") +
        "\nRequested work: " + (clean(parsed.change_order_note, 400) || "As described in the client's message.") +
        "\nEstimated effort: " + (hours ? hours + " hours" : "[HOURS]") +
        "\nRate: " + (rate ? sym + rate + " per hour" : "[RATE] per hour") +
        "\nEstimated total: " + (cost ? sym + cost : "[TOTAL]") +
        "\nTimeline: to be confirmed on approval.\nTo proceed, please reply with your written approval.";
    }

    try {
      await sbFetch("scope_checks", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ user_id: user.id, project_id: project.id, verdict: verdict }) });
      used += 1;
    } catch (e) {}

    return res.status(200).json({
      success: true,
      result: {
        verdict: verdict,
        reasoning: clean(parsed.reasoning, 700),
        clause_quote: quote,
        counts_as_revision: parsed.counts_as_revision === true,
        reply_script: clean(parsed.reply_script, 2000),
        estimated_hours: hours,
        estimated_cost: cost,
        change_order_text: changeOrder,
      },
      usage: { used: used, limit: pro ? null : FREE_LIMIT },
    });
  } catch (e) {
    return res.status(500).json({ error: (e && e.message) || "Scope check failed." });
  }
}

export default handler;
