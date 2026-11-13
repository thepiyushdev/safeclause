import crypto from "node:crypto";
// api/whop-webhook.js - receives Whop webhooks. This is the ONLY place where Pro is granted for a Whop payment.
// Every request is checked with the Standard Webhooks signature (HMAC-SHA256 with your ws_ secret) before it is used.

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


// Whop plan id -> days of Pro. These are the four checkout links used on the pricing page.
const PLAN_DAYS = {
  plan_2cmqmRXvCGKS1: 30,
  plan_KrnnSLsfIvu4t: 365,
  plan_gCA9uEvLhFlmm: 30,
  plan_MFivxwEnHBRnp: 365,
};

function rawBody(req) {
  return new Promise(function (resolve, reject) {
    const chunks = [];
    req.on("data", function (c) { chunks.push(c); });
    req.on("end", function () { resolve(Buffer.concat(chunks)); });
    req.on("error", reject);
  });
}

// The key is the ws_ secret exactly as Whop shows it (no stripping, no base64 decoding).
function verifySignature(raw, headers, secret) {
  const id = headers["webhook-id"];
  const ts = headers["webhook-timestamp"];
  const sigHeader = headers["webhook-signature"];
  if (!id || !/^\d+$/.test(String(ts || "")) || !sigHeader) return false;
  const expected = crypto.createHmac("sha256", secret).update(id + "." + ts + ".").update(raw).digest();
  return String(sigHeader).split(" ").some(function (entry) {
    const parts = entry.split(",");
    if (parts[0] !== "v1" || !parts[1]) return false;
    const got = Buffer.from(parts[1], "base64");
    return got.length === expected.length && crypto.timingSafeEqual(got, expected);
  });
}

async function rpc(name, args) {
  const r = await fetch(SB_URL + "/rest/v1/rpc/" + name, {
    method: "POST",
    headers: { apikey: SB_SERVICE, Authorization: "Bearer " + SB_SERVICE, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  const text = await r.text();
  if (!r.ok) throw new Error("Database error: " + text.slice(0, 200));
  return JSON.parse(text);
}

function pick(d) {
  const plan = (d.plan && d.plan.id) || d.plan_id || (d.membership && d.membership.plan && d.membership.plan.id) || (d.membership && d.membership.plan_id) || "";
  const email = (d.user && d.user.email) || d.email || (d.member && d.member.email) || "";
  return { payId: d.id || "", plan: String(plan), email: String(email).trim().toLowerCase() };
}

async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST." });
  const secret = process.env.WHOP_WEBHOOK_SECRET;
  if (!secret) return res.status(500).json({ error: "WHOP_WEBHOOK_SECRET is not set." });   // fail closed
  if (!SB_URL || !SB_SERVICE) return res.status(500).json({ error: "Server is missing Supabase settings." });

  let raw;
  try { raw = await rawBody(req); } catch (e) { return res.status(400).json({ error: "Could not read the request." }); }
  if (!verifySignature(raw, req.headers, secret)) return res.status(401).json({ error: "Bad signature." });

  let ev;
  try { ev = JSON.parse(raw.toString("utf8")); } catch (e) { return res.status(400).json({ error: "Bad JSON." }); }
  const d = ev.data || {};

  try {
    if (ev.type === "payment.succeeded") {
      const p = pick(d);
      if (!p.payId || !p.email) return res.status(400).json({ error: "payment.succeeded without a payment id or buyer email." });
      const days = PLAN_DAYS[p.plan] || 0;
      const result = await rpc("whop_apply", { p_pay: p.payId, p_email: p.email, p_plan: p.plan, p_days: days });
      return res.status(200).json({ ok: true, result: result, plan: p.plan, days: days });
    }
    if (ev.type === "refund.created") {
      const payId = d.payment_id || (d.payment && d.payment.id) || "";
      if (payId) await rpc("whop_refund", { p_pay: payId });
      return res.status(200).json({ ok: true, refunded: !!payId });
    }
    return res.status(200).json({ ok: true, ignored: ev.type || "" });
  } catch (e) {
    return res.status(500).json({ error: (e && e.message) || "Webhook failed." });   // Whop retries on non-2xx
  }
}

export default handler;
