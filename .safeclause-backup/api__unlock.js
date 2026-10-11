import crypto from "node:crypto";
// api/unlock.js - server-side paywall. Uses plain PostgREST calls, no RPC functions needed.

const SB_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

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

// Read credits, then PATCH only if the balance is still what we read (compare-and-swap).
// Two parallel unlocks cannot both spend the same credit.
async function spendOneCredit(userId) {
  const id = encodeURIComponent(userId);
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

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};

  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: "Session expired. Please log in again." });

    const locked = unseal(body.token);
    if (!locked || !locked.c) {
      return res.status(400).json({ error: "Invalid unlock token. Run the audit again." });
    }
    if (Date.now() - Number(locked.t || 0) > MAX_AGE_MS) {
      return res.status(400).json({ error: "This unlock token expired. Run the audit again." });
    }

    const spent = await spendOneCredit(user.id);
    if (!spent.ok) {
      if (spent.reason === "nocredits") return res.status(402).json({ error: "You have no credits left. Buy a credit to unlock." });
      if (spent.reason === "noprofile") return res.status(404).json({ error: "No credit account found for this user." });
      return res.status(503).json({ error: "Server is busy. Please try again." });
    }

    return res.status(200).json({
      safe_counter_clause: locked.c,
      polite_client_negotiation_email: locked.e,
      credits: spent.credits,
    });
  } catch (e) {
    return res.status(500).json({ error: (e && e.message) || "Unlock failed." });
  }
}

export default handler;
