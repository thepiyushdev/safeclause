import crypto from "node:crypto";
// api/audit.js - SafeClause contract audit (Groq). Locked content is sealed, not sent in clear.

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MAX_CHARS = 10000;
const MODELS = Array.from(
  new Set([process.env.GROQ_MODEL, "openai/gpt-oss-20b", "openai/gpt-oss-120b", "llama-3.3-70b-versatile"].filter(Boolean))
);

const SYSTEM_PROMPT = [
  "You are SafeClause, a contract risk auditor that protects freelancers.",
  "Respond with ONE valid JSON object and nothing else: no markdown, no code fences, no commentary before or after.",
  "",
  "JSON shape:",
  '{"executive_summary": "2-3 sentence risk summary for a freelancer",',
  ' "overall_risk_score": "HIGH" | "MEDIUM" | "LOW",',
  ' "flagged_clauses": [ {',
  '   "category": "UPPER_SNAKE_CASE such as PAYMENT_TERMS, LIABILITY, IP_OWNERSHIP, TERMINATION, SCOPE_CREEP, REVISIONS, NON_COMPETE, JURISDICTION",',
  '   "risk_level": "HIGH" | "MEDIUM" | "LOW",',
  '   "problematic_fine_print": "VERBATIM quote copied exactly from the contract text",',
  '   "why_it_hurts": "2-3 sentences on the commercial and legal danger",',
  '   "safe_counter_clause": "Exact, complete, legally binding replacement clause text",',
  '   "polite_client_negotiation_email": "Complete professional plain-text email"',
  " } ] }",
  "",
  "Rules:",
  "- Flag the 3 to 5 most dangerous clauses. If the contract is safe, return an empty flagged_clauses array and say so in executive_summary.",
  "- problematic_fine_print must be copied word for word. Never paraphrase it.",
  "- safe_counter_clause must be concrete contract language, NOT advice. Use specifics such as Net-14 payment, late fee, liability capped at fees paid, IP transfers only after full payment, capped revisions, kill fee on termination.",
  "- polite_client_negotiation_email format: Subject line, blank line, greeting (Hi [Client Name],), short paragraphs with the reasoning, the safe replacement clause, then a sign-off (Best regards, [Your Name]). Plain text paragraphs only.",
  "- Use the JSON escape sequence for line breaks inside strings so the JSON stays valid.",
].join("\n");

function keyBytes() {
  const base = process.env.UNLOCK_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!base) throw new Error("Server is missing SUPABASE_SERVICE_ROLE_KEY.");
  return crypto.createHash("sha256").update("safeclause:" + base).digest();
}

function seal(obj) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", keyBytes(), iv);
  const enc = Buffer.concat([cipher.update(JSON.stringify(obj), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString("base64url");
}

async function callGroq(model, key, contract) {
  const body = {
    model: model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: "Audit the following freelance contract and return ONLY the JSON object.\n\nCONTRACT:\n" + contract },
    ],
    temperature: 0.2,
    max_completion_tokens: 6000,
  };
  if (model.indexOf("gpt-oss") !== -1) body.reasoning_effort = "low";
  const ctrl = new AbortController();
  const timer = setTimeout(function () { ctrl.abort(); }, 50000);
  try {
    const r = await fetch(GROQ_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const raw = await r.text();
    if (!r.ok) {
      const err = new Error("Groq HTTP " + r.status + " (" + model + "): " + raw.slice(0, 300));
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

function clean(v, fallback) {
  if (typeof v !== "string" || !v.trim()) return fallback;
  return v.replace(/\r\n/g, "\n").replace(/\\n/g, "\n").replace(/\\t/g, " ").trim();
}
function normRisk(v) {
  const s = String(v || "").toUpperCase();
  return s === "HIGH" || s === "LOW" ? s : "MEDIUM";
}
function normCategory(v) {
  const s = String(v || "").toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return s || "GENERAL";
}

function normalize(parsed) {
  const p = parsed && typeof parsed === "object" ? parsed : {};
  const list = Array.isArray(p.flagged_clauses) ? p.flagged_clauses : Array.isArray(p.clauses) ? p.clauses : [];
  const flagged = list
    .filter(function (c) { return c && typeof c === "object"; })
    .slice(0, 6)
    .map(function (c) {
      const locked = {
        c: clean(c.safe_counter_clause, "No counter-clause was generated. Run the audit again."),
        e: clean(c.polite_client_negotiation_email, "No email was generated. Run the audit again."),
        t: Date.now(),
      };
      return {
        category: normCategory(c.category),
        risk_level: normRisk(c.risk_level),
        problematic_fine_print: clean(c.problematic_fine_print, "(Quote not returned by the AI)"),
        why_it_hurts: clean(c.why_it_hurts, "This clause may expose you to financial or legal risk."),
        locked_token: seal(locked),
      };
    });
  return {
    executive_summary: clean(
      p.executive_summary,
      flagged.length ? "Risky clauses were found in this contract. Review each one below." : "No major red flags were found in the text provided."
    ),
    overall_risk_score: normRisk(p.overall_risk_score || p.overall_risk),
    flagged_clauses: flagged,
  };
}

async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST." });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};
  const text = String(body.text || body.contract || body.contractText || "").trim().slice(0, MAX_CHARS);
  if (text.length < 50) return res.status(400).json({ error: "Please paste the contract text (at least a few lines)." });

  const key = process.env.GROQ_API_KEY;
  if (!key) return res.status(500).json({ error: "Server is missing GROQ_API_KEY. Add it in Vercel settings." });
  try { keyBytes(); } catch (e) { return res.status(500).json({ error: e.message }); }

  let lastError = "Unknown error";
  for (let i = 0; i < MODELS.length; i++) {
    const model = MODELS[i];
    try {
      const content = await callGroq(model, key, text);
      const parsed = extractJson(content);
      if (!parsed) { lastError = "AI returned unreadable output (" + model + "). Please try again."; continue; }
      return res.status(200).json(normalize(parsed));
    } catch (e) {
      lastError = (e && e.message) || String(e);
      if (e && (e.status === 401 || e.status === 403 || e.status === 429)) break;
    }
  }
  return res.status(502).json({ error: lastError });
}

export default handler;
