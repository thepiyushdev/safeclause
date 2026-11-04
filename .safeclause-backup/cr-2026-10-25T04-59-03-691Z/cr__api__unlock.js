import crypto from "node:crypto";
// api/unlock.js - server-side paywall. Pro unlocks without limits; legacy credit holders spend 1 credit per audit.

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


const MAX_AGE_MS = 24 * 60 * 60 * 1000;
// One audit never has more than 6 clauses, so a single request can never unlock more than one document.
const MAX_TOKENS = 6;

// IMPORTANT: this function must stay identical in api/audit.js and api/unlock.js.
function getSecret() {
  return process.env.UNLOCK_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
}

function keyBytes() {
  const base = getSecret();
  if (!base) throw new Error("Server is missing SUPABASE_SERVICE_ROLE_KEY (or UNLOCK_SECRET).");
  return crypto.createHash("sha256").update("safeclause:" + base).digest();
}

function unseal(token) {
  try {
    const buf = Buffer.from(String(token || ""), "base64url");
    if (buf.length < 30) return null;
    const d = crypto.createDecipheriv("aes-256-gcm", keyBytes(), buf.subarray(0, 12));
    d.setAuthTag(buf.subarray(12, 28));
    const out = Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString("utf8");
    return JSON.parse(out);
  } catch (e) {
    return null;
  }
}

// Legacy credits: read, then PATCH only if the balance is unchanged (compare-and-swap).
async function spendOneCredit(userId) {
  const id = enc(userId);
  for (let attempt = 0; attempt < 4; attempt++) {
    const rows = await sbFetch("profiles?id=eq." + id + "&select=credits");
    const current = rows && rows[0] ? Number(rows[0].credits) : NaN;
    if (!isFinite(current)) return { ok: false, reason: "noprofile" };
    if (current < 1) return { ok: false, reason: "nocredits" };
    const updated = await sbFetch("profiles?id=eq." + id + "&credits=eq." + current, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ credits: current - 1 }),
    });
    if (Array.isArray(updated) && updated.length === 1) return { ok: true, credits: current - 1 };
  }
  return { ok: false, reason: "busy" };
}

async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST." });
  if (!SB_URL || !SB_SERVICE) {
    return res.status(500).json({ error: "Server is missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY." });
  }
  const body = readBody(req);
  const tokens = Array.isArray(body.tokens) ? body.tokens : body.token ? [body.token] : [];
  if (tokens.length === 0) return res.status(400).json({ error: "No unlock tokens were sent." });
  if (tokens.length > MAX_TOKENS) return res.status(400).json({ error: "Too many clauses in one unlock." });

  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: "Session expired. Please log in again." });
    const profile = await getProfile(user.id);
    const pro = proActive(profile);
    const gate = await deviceGate(user.id, req.headers["x-device-id"], pro);
    if (!gate.ok) return deviceFail(res, gate);

    // Decrypt EVERYTHING first. If any token is bad, nothing is charged.
    const items = [];
    for (let i = 0; i < tokens.length; i++) {
      const locked = unseal(tokens[i]);
      if (!locked || !locked.c) return res.status(400).json({ error: "Invalid unlock token (clause " + (i + 1) + "). Run the audit again." });
      if (Date.now() - Number(locked.t || 0) > MAX_AGE_MS) return res.status(400).json({ error: "This unlock token expired. Run the audit again." });
      items.push({ index: i, safe_counter_clause: locked.c, polite_client_negotiation_email: locked.e });
    }

    let credits = profile && isFinite(Number(profile.credits)) ? Number(profile.credits) : 0;
    if (!pro) {
      const spent = await spendOneCredit(user.id);
      if (!spent.ok) {
        if (spent.reason === "busy") return res.status(503).json({ error: "Server is busy. Please try again." });
        return res.status(402).json({ error: "Upgrade to Pro to unlock safer rewrites and counter-proposal emails.", code: "UPGRADE" });
      }
      credits = spent.credits;
    }
    const out = { success: true, unlocked: items, credits: credits, plan: pro ? "pro" : "free" };
    if (items.length === 1) {
      out.safe_counter_clause = items[0].safe_counter_clause;
      out.polite_client_negotiation_email = items[0].polite_client_negotiation_email;
    }
    return res.status(200).json(out);
  } catch (e) {
    return res.status(500).json({ error: (e && e.message) || "Unlock failed." });
  }
}

export default handler;
