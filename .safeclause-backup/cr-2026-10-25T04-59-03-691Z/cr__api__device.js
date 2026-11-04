// api/device.js - register / heartbeat / list / revoke devices (Free: 1 at a time, Pro: 3)

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


async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST." });
  if (!SB_URL || !SB_SERVICE) return res.status(500).json({ error: "Server is missing Supabase settings." });
  const body = readBody(req);
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: "Session expired. Please log in again." });
    const pro = proActive(await getProfile(user.id));
    const deviceId = String(body.device_id || req.headers["x-device-id"] || "");
    const action = String(body.action || "register");

    if (action === "revoke") {
      const target = String(body.target || "");
      if (!/^[A-Za-z0-9-]{8,64}$/.test(target)) return res.status(400).json({ error: "Invalid device." });
      if (target === deviceId) {
        await sbFetch("devices?user_id=eq." + enc(user.id) + "&device_id=eq." + enc(target), { method: "DELETE" });
      } else {
        await sbFetch("devices?user_id=eq." + enc(user.id) + "&device_id=eq." + enc(target), {
          method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ revoked: true }),
        });
      }
      const g0 = await deviceGate(user.id, deviceId, pro, { readOnly: true });
      return res.status(200).json({ ok: true, blocked: !!g0.blocked, devices: g0.devices, limit: g0.limit, plan: pro ? "pro" : "free" });
    }

    if (action === "list") {
      const g1 = await deviceGate(user.id, deviceId, pro, { readOnly: true });
      return res.status(200).json({ ok: g1.ok, blocked: !!g1.blocked, revoked: !!g1.revoked, devices: g1.devices, limit: g1.limit, plan: pro ? "pro" : "free" });
    }

    const g = await deviceGate(user.id, deviceId, pro, { label: body.label, fresh: !!body.fresh });
    if (g.ok) {
      // best-effort cleanup of devices unseen for 30 days
      sbFetch("devices?user_id=eq." + enc(user.id) + "&last_seen=lt." + enc(new Date(Date.now() - 30 * 86400000).toISOString()), { method: "DELETE" }).catch(function () {});
    }
    return res.status(200).json({ ok: g.ok, blocked: !!g.blocked, revoked: !!g.revoked, devices: g.devices, limit: g.limit, plan: pro ? "pro" : "free" });
  } catch (e) {
    return res.status(500).json({ error: (e && e.message) || "Device check failed." });
  }
}

export default handler;
