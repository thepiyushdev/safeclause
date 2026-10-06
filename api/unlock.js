import crypto from "node:crypto";
// api/unlock.js - server-side paywall

const SB_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

function keyBytes() {
  const base = process.env.UNLOCK_SECRET || SB_SERVICE;
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

async function getUser(req) {
  const h = req.headers.authorization || "";
  const token = h.indexOf("Bearer ") === 0 ? h.slice(7) : "";
  if (!token) return null;
  const r = await fetch(SB_URL + "/auth/v1/user", { headers: { apikey: SB_SERVICE, Authorization: "Bearer " + token } });
  if (!r.ok) return null;
  const u = await r.json();
  return u && u.id ? u : null;
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

async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST." });
  if (!SB_URL || !SB_SERVICE) return res.status(500).json({ error: "Server is missing Supabase settings." });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};

  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: "Please log in to unlock." });

    const locked = unseal(body.token);
    if (!locked || !locked.c || Date.now() - Number(locked.t || 0) > MAX_AGE_MS) {
      return res.status(400).json({ error: "This unlock link expired. Please run the audit again." });
    }

    const left = await rpc("spend_credit", { p_user: user.id });
    if (typeof left !== "number" || left < 0) {
      return res.status(402).json({ error: "You have no credits left. Buy a credit to unlock." });
    }
    return res.status(200).json({
      safe_counter_clause: locked.c,
      polite_client_negotiation_email: locked.e,
      credits: left,
    });
  } catch (e) {
    return res.status(500).json({ error: (e && e.message) || "Unlock failed." });
  }
}

export default handler;
