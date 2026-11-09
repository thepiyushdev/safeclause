import crypto from "node:crypto";
// api/admin-payouts.js - admin-only payout approvals. Needs ADMIN_PASSWORD plus a logged-in Supabase user.

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


const attempts = {};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sha(s) {
  return crypto.createHash("sha256").update(String(s || "")).digest();
}

function passwordOk(input) {
  const real = process.env.ADMIN_PASSWORD || "";
  if (!real) return false;
  return crypto.timingSafeEqual(sha(input), sha(real));
}

// Optional extra lock: ADMIN_EMAILS=you@gmail.com,other@gmail.com
function emailAllowed(email) {
  const list = String(process.env.ADMIN_EMAILS || "").split(",").map(function (x) { return x.trim().toLowerCase(); }).filter(Boolean);
  return list.length === 0 || list.indexOf(String(email || "").toLowerCase()) !== -1;
}

async function rpcAdmin(name, args) {
  const r = await fetch(SB_URL + "/rest/v1/rpc/" + name, {
    method: "POST",
    headers: { apikey: SB_SERVICE, Authorization: "Bearer " + SB_SERVICE, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  const text = await r.text();
  if (!r.ok) throw new Error("Database error: " + text.slice(0, 200));
  return JSON.parse(text);
}

async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST." });
  if (!process.env.ADMIN_PASSWORD) return res.status(500).json({ error: "ADMIN_PASSWORD is not set in the Vercel environment variables." });
  if (!SB_URL || !SB_SERVICE) return res.status(500).json({ error: "Server is missing Supabase settings." });
  const body = readBody(req);

  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: "Please log in first." });
    if (!emailAllowed(user.email)) return res.status(403).json({ error: "This account is not allowed here." });

    const rec = attempts[user.id] || { n: 0, t: Date.now() };
    if (Date.now() - rec.t > 10 * 60 * 1000) { rec.n = 0; rec.t = Date.now(); }
    if (rec.n >= 8) return res.status(429).json({ error: "Too many wrong passwords. Try again in 10 minutes." });
    if (!passwordOk(req.headers["x-admin-password"] || body.password)) {
      rec.n += 1;
      attempts[user.id] = rec;
      await new Promise(function (r) { setTimeout(r, 700); });
      return res.status(401).json({ error: "Wrong password." });
    }
    attempts[user.id] = { n: 0, t: Date.now() };

    const action = String(body.action || "list");
    if (action === "approve" || action === "reject") {
      const id = String(body.id || "");
      if (!UUID.test(id)) return res.status(400).json({ error: "Invalid payout id." });
      const done = await rpcAdmin(action === "approve" ? "admin_approve_payout" : "admin_reject_payout", { p_id: id });
      if (done !== true) return res.status(409).json({ error: "This payout was already processed." });
      return res.status(200).json({ ok: true });
    }

    const rows = await sbFetch("payout_requests?select=id,user_id,email,amount,upi_id,status,created_at,approved_at&order=created_at.desc&limit=200");
    const list = rows || [];
    // For pending payouts, attach the referral sales behind the balance so you can check the UTRs in your UPI app first.
    for (let i = 0; i < list.length; i++) {
      list[i].evidence = [];
      if (list[i].status === "pending") {
        try {
          list[i].evidence = (await sbFetch("referrals?referrer_id=eq." + enc(list[i].user_id) + "&select=txn_id,plan,sale_amount,commission_amount,created_at&order=created_at.desc&limit=20")) || [];
        } catch (e) {}
      }
    }
    return res.status(200).json({ ok: true, payouts: list });
  } catch (e) {
    return res.status(500).json({ error: (e && e.message) || "Admin request failed." });
  }
}

export default handler;
