import crypto from "node:crypto";
// api/unlock.js - server-side paywall. 1 credit unlocks every token sent in the batch.

const SB_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
// One audit never has more than 6 clauses, so one credit can never unlock more than one document's worth.
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

  // Accept { tokens: [...] } or the older single { token }.
  const tokens = Array.isArray(body.tokens) ? body.tokens : body.token ? [body.token] : [];
  if (tokens.length === 0) return res.status(400).json({ error: "No unlock tokens were sent." });
  if (tokens.length > MAX_TOKENS) return res.status(400).json({ error: "Too many clauses in one unlock." });

  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: "Session expired. Please log in again." });

    // Decrypt EVERYTHING first. If any token is bad, nothing is charged.
    const items = [];
    for (let i = 0; i < tokens.length; i++) {
      const locked = unseal(tokens[i]);
      if (!locked || !locked.c) {
        return res.status(400).json({ error: "Invalid unlock token (clause " + (i + 1) + "). Run the audit again." });
      }
      if (Date.now() - Number(locked.t || 0) > MAX_AGE_MS) {
        return res.status(400).json({ error: "This unlock token expired. Run the audit again." });
      }
      items.push({ index: i, safe_counter_clause: locked.c, polite_client_negotiation_email: locked.e });
    }

    // Exactly ONE credit, no matter how many clauses are in the batch.
    const spent = await spendOneCredit(user.id);
    if (!spent.ok) {
      if (spent.reason === "nocredits") return res.status(402).json({ error: "You have no credits left. Buy a credit to unlock." });
      if (spent.reason === "noprofile") return res.status(404).json({ error: "No credit account found for this user." });
      return res.status(503).json({ error: "Server is busy. Please try again." });
    }

    const out = { success: true, unlocked: items, credits: spent.credits };
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
