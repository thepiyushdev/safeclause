// api/audit.js - SafeClause contract risk auditor (Vercel serverless + Groq)

const FALLBACK_KEY = "";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MAX_CHARS = 10000;
const MODELS = Array.from(
  new Set(
    [process.env.GROQ_MODEL, "openai/gpt-oss-20b", "openai/gpt-oss-120b", "llama-3.3-70b-versatile"].filter(Boolean)
  )
);

const SYSTEM_PROMPT = [
  "You are SafeClause, a contract risk auditor that protects freelancers.",
  "Respond with ONE valid JSON object and nothing else: no markdown, no code fences, no commentary before or after.",
  "",
  "JSON shape:",
  '{"executive_summary": "2-3 sentence overview of the contract risk for a freelancer",',
  ' "overall_risk": "HIGH" | "MEDIUM" | "LOW",',
  ' "clauses": [ {',
  '   "category": "UPPER_SNAKE_CASE label such as PAYMENT_TERMS, LIABILITY, IP_OWNERSHIP, TERMINATION, SCOPE_CREEP, REVISIONS, NON_COMPETE, CONFIDENTIALITY",',
  '   "risk_level": "HIGH" | "MEDIUM" | "LOW",',
  '   "problematic_fine_print": "VERBATIM quote copied exactly from the contract text",',
  '   "why_it_hurts": "Clear 2-3 sentence explanation of the financial or liability trap",',
  '   "safe_counter_clause": "A complete, directly usable, legally binding replacement clause",',
  '   "polite_client_negotiation_email": "A complete professional email"',
  " } ] }",
  "",
  "Rules:",
  "- Find the 3 to 5 most dangerous clauses. If the contract is genuinely safe, return an empty clauses array and say so in executive_summary.",
  "- problematic_fine_print must be copied word for word from the contract. Never paraphrase it.",
  "- safe_counter_clause must be concrete contract language, NOT generic advice. Use specifics such as Net-14 payment, late fees, liability capped at fees paid, freelancer keeps IP until full payment, defined revision limits, kill fee on termination.",
  "- polite_client_negotiation_email must contain: a Subject line, a polite salutation (Hi [Client Name],), 2-3 sentences of reasoning, the safe replacement clause, and a professional sign-off (Best regards, [Your Name]).",
  "- Inside JSON strings use the escape sequence for line breaks so the JSON stays valid.",
].join("\n");

async function callGroq(model, key, contract) {
  const body = {
    model: model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: "Audit the following freelance contract and return ONLY the JSON object.\\n\\nCONTRACT:\\n" + contract },
    ],
    temperature: 0.2,
    max_completion_tokens: 4096,
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
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch (e) {
    return null;
  }
}

function clean(value, fallback) {
  if (typeof value !== "string" || !value.trim()) return fallback;
  return value
    .replace(/\\r\\n/g, "\\n")
    .replace(/\\\\n/g, "\\n")
    .replace(/\\\\t/g, " ")
    .trim();
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
  const list = Array.isArray(p.clauses) ? p.clauses : [];
  const clauses = list
    .filter(function (c) { return c && typeof c === "object"; })
    .slice(0, 6)
    .map(function (c) {
      return {
        category: normCategory(c.category),
        risk_level: normRisk(c.risk_level),
        problematic_fine_print: clean(c.problematic_fine_print, "(Quote not returned by the AI)"),
        why_it_hurts: clean(c.why_it_hurts, "This clause may expose you to financial or legal risk."),
        safe_counter_clause: clean(c.safe_counter_clause, "No counter-clause was generated. Run the audit again."),
        polite_client_negotiation_email: clean(c.polite_client_negotiation_email, "No email was generated. Run the audit again."),
      };
    });
  return {
    executive_summary: clean(
      p.executive_summary,
      clauses.length ? "Risky clauses were found in this contract. Review each one below." : "No major red flags were found in the text provided."
    ),
    overall_risk: normRisk(p.overall_risk),
    clauses: clauses,
  };
}

async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST." });

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  body = body || {};
  const text = String(body.text || body.contract || body.contractText || "").trim().slice(0, MAX_CHARS);
  if (text.length < 50) {
    return res.status(400).json({ error: "Please paste the contract text (at least a few lines)." });
  }

  const key = process.env.GROQ_API_KEY || FALLBACK_KEY;
  if (!key) {
    return res.status(500).json({ error: "Server is missing GROQ_API_KEY. Add it in Vercel project settings." });
  }

  let lastError = "Unknown error";
  for (let i = 0; i < MODELS.length; i++) {
    const model = MODELS[i];
    try {
      const content = await callGroq(model, key, text);
      const parsed = extractJson(content);
      if (!parsed) {
        lastError = "AI returned unreadable output (" + model + "). Please try again.";
        continue;
      }
      const out = normalize(parsed);
      out.model = model;
      return res.status(200).json(out);
    } catch (e) {
      lastError = (e && e.message) || String(e);
      if (e && (e.status === 401 || e.status === 403 || e.status === 429)) break;
    }
  }
  return res.status(502).json({ error: lastError });
}

export default handler;
