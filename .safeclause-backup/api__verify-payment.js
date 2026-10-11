import crypto from "node:crypto";
// api/verify-payment.js - UPI screenshot verification with Gemini

const SB_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const RECEIVER_ID = "8796021247@fam";
const RECEIVER_DIGITS = "8796021247";
const PACKS = { 1: { amount: 49, credits: 1 }, 3: { amount: 129, credits: 3 } };
const MAX_B64 = 3000000;
const MODELS = Array.from(
  new Set([process.env.GEMINI_MODEL, "gemini-3.1-flash-lite", "gemini-3-flash-preview", "gemini-flash-latest", "gemini-2.5-flash"].filter(Boolean))
);

const PROMPT = [
  "You are verifying a UPI payment screenshot from an Indian payment app (GPay, PhonePe, Paytm, BHIM, etc).",
  "Read the image and return ONE JSON object only, no markdown:",
  '{"is_payment_screenshot": true|false,',
  ' "status": "success" | "failed" | "pending" | "unknown",',
  ' "amount": number or null (rupees paid),',
  ' "receiver_upi_id": string or null,',
  ' "receiver_name": string or null,',
  ' "transaction_id": string or null (UPI transaction ID / UTR / Google transaction ID, exactly as shown),',
  ' "paid_at": string or null (ISO 8601 date-time if a date and time are visible),',
  ' "suspicious": true|false (true if the image looks edited, cropped to hide details, or is not a real payment receipt),',
  ' "notes": short string}',
  "Only report what is visible. Never guess missing values; use null.",
].join("\n");

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

async function callGemini(model, key, mime, b64) {
  const url = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent";
  const ctrl = new AbortController();
  const timer = setTimeout(function () { ctrl.abort(); }, 40000);
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ parts: [{ text: PROMPT }, { inline_data: { mime_type: mime, data: b64 } }] }],
        generationConfig: { temperature: 0, responseMimeType: "application/json" },
      }),
      signal: ctrl.signal,
    });
    const raw = await r.text();
    if (!r.ok) {
      const err = new Error("Gemini HTTP " + r.status + " (" + model + "): " + raw.slice(0, 200));
      err.status = r.status;
      throw err;
    }
    const data = JSON.parse(raw);
    const parts = (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) || [];
    return parts.map(function (p) { return p.text || ""; }).join("");
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

// Returns an error string, or "" when the screenshot passes every check.
function judge(info, pack) {
  if (!info || info.is_payment_screenshot !== true) return "This does not look like a UPI payment screenshot.";
  if (info.suspicious === true) return "This screenshot looks edited or incomplete. Upload the original, full screenshot.";
  const st = String(info.status || "").toLowerCase();
  if (!(st.indexOf("success") !== -1 || st === "paid" || st === "completed")) {
    return "Payment status is not Successful / Paid / Completed.";
  }
  const amt = Number(String(info.amount === null || info.amount === undefined ? "" : info.amount).replace(/[^0-9.]/g, ""));
  if (!isFinite(amt) || Math.abs(amt - pack.amount) > 0.001) {
    return "Amount mismatch. Expected Rs " + pack.amount + ", screenshot shows " + (info.amount === null || info.amount === undefined ? "no amount" : "Rs " + info.amount) + ".";
  }
  const rid = String(info.receiver_upi_id || "").toLowerCase();
  const rname = String(info.receiver_name || "").toLowerCase();
  const hint = String(process.env.RECEIVER_NAME_HINT || "").toLowerCase();
  const okReceiver =
    rid.indexOf(RECEIVER_DIGITS) !== -1 ||
    rname.indexOf("safeclause") !== -1 ||
    (hint && rname.indexOf(hint) !== -1);
  if (!okReceiver) return "Receiver does not match " + RECEIVER_ID + ". Please pay to the correct UPI ID.";
  const txn = String(info.transaction_id || "").replace(/\s+/g, "");
  if (txn.length < 8) return "Transaction ID is not visible. Upload the full payment-success screen.";
  const t = Date.parse(info.paid_at || "");
  if (isFinite(t)) {
    const now = Date.now();
    if (now - t > 3 * 24 * 3600 * 1000) return "This payment is older than 3 days.";
    if (t - now > 24 * 3600 * 1000) return "Payment date looks invalid.";
  }
  return "";
}

async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ success: false, error: "Use POST." });
  if (!SB_URL || !SB_SERVICE) return res.status(500).json({ success: false, error: "Server is missing Supabase settings." });
  const gkey = process.env.GEMINI_API_KEY;
  if (!gkey) return res.status(500).json({ success: false, error: "Server is missing GEMINI_API_KEY." });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};

  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ success: false, error: "Please log in first." });

    const pack = PACKS[Number(body.pack)];
    if (!pack) return res.status(400).json({ success: false, error: "Unknown credit pack." });
    const b64 = String(body.image || "");
    const mime = ["image/jpeg", "image/png", "image/webp"].indexOf(body.mime) !== -1 ? body.mime : "image/jpeg";
    if (b64.length < 1000) return res.status(400).json({ success: false, error: "Screenshot is missing or too small." });
    if (b64.length > MAX_B64) return res.status(413).json({ success: false, error: "Screenshot is too large." });

    let info = null;
    let lastError = "Verification service is unavailable. Try again shortly.";
    for (let i = 0; i < MODELS.length && !info; i++) {
      try {
        info = extractJson(await callGemini(MODELS[i], gkey, mime, b64));
        if (!info) lastError = "Could not read the screenshot. Upload a clearer image.";
      } catch (e) {
        lastError = (e && e.message) || lastError;
        if (e && (e.status === 401 || e.status === 403 || e.status === 429)) break;
      }
    }
    if (!info) return res.status(502).json({ success: false, error: lastError });

    const problem = judge(info, pack);
    if (problem) return res.status(400).json({ success: false, error: problem });

    const txn = String(info.transaction_id).replace(/\s+/g, "").toUpperCase();
    const hash = crypto.createHash("sha256").update(b64).digest("hex");
    const total = await rpc("redeem_payment", {
      p_user: user.id, p_txn: txn, p_hash: hash, p_amount: pack.amount, p_credits: pack.credits,
    });
    if (typeof total !== "number" || total < 0) {
      return res.status(409).json({ success: false, error: "This payment / transaction ID was already used." });
    }
    return res.status(200).json({ success: true, creditsAdded: pack.credits, credits: total });
  } catch (e) {
    return res.status(500).json({ success: false, error: (e && e.message) || "Verification failed." });
  }
}

export default handler;
