// bot-brain.mjs - Auto-scans live Gemini models and generates ClauseRadar content
import fs from "node:fs";

// .env file ya environment se GEMINI_API_KEY uthayega
function getApiKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY.trim();
  if (fs.existsSync(".env")) {
    const env = fs.readFileSync(".env", "utf8");
    const m = env.match(/^GEMINI_API_KEY\s*=\s*["']?([^"'\r\n]+)["']?/m);
    if (m) return m[1].trim();
  }
  return "";
}

// ClauseRadar ke 100% Asli Facts (Iske bahar AI kuch jhooth nahi likhega)
export const FACTS = {
  brand: "ClauseRadar",
  url: "https://clauseradar.online",
  pricing: "Free basic contract scans. Pro Plan is ₹499/month or ₹3,999/year via UPI (up to 3 devices).",
  features: [
    "30-Second Contract Scanner: Upload PDF, DOCX, or paste text to spot uncapped liability, IP grabs, and Net-90 payment traps.",
    "One-Click Counter-Proposal Emails: Polite, ready-to-send negotiation emails with safer replacement clauses.",
    "Contract Memory: Privacy-first opt-in storage of structured project terms (never stores the full contract or trains AI models).",
    "Scope Guard: Paste a client's Slack/WhatsApp 'quick tweak' message to instantly check if it's In Scope (Free) or Out of Scope (Billable) + generate a Change Order quote.",
    "Payment Chaser: Tracks overdue invoices and generates 3-stage escalation letters (Friendly reminder -> Firm notice -> Formal legal demand with Indian MSMED Act 45-day rule support)."
  ]
};

// 1. Google API se live models scan karna
export async function scanLiveModels(apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Model scan failed (HTTP ${r.status}): ${await r.text()}`);
  const data = await r.json();

  // Sirf text generation wale Gemini models filter karo
  const valid = (data.models || []).filter(m => {
    const name = m.name || "";
    const methods = m.supportedGenerationMethods || [];
    const isGemini = /^models\/gemini-/i.test(name);
    const canGenerate = methods.includes("generateContent");
    const isSpecial = /embedding|imagen|veo|tts|audio|robotics|aqa|vision|learnlm|computer-use/i.test(name);
    return isGemini && canGenerate && !isSpecial;
  }).map(m => m.name.replace("models/", ""));

  // Flash-lite aur Flash models ko upar rakho kyunki inki free limit sabse zyada hoti hai
  valid.sort((a, b) => {
    const score = (s) => {
      let pts = 0;
      if (s.includes("flash-lite")) pts += 30;
      else if (s.includes("flash")) pts += 20;
      else if (s.includes("pro")) pts += 10;
      if (s.includes("3.1") || s.includes("3")) pts += 5;
      if (s.includes("2.5")) pts += 4;
      if (!s.includes("preview") && !s.includes("exp")) pts += 2;
      return pts;
    };
    return score(b) - score(a);
  });

  return valid;
}

// 2. Auto-Fallback ke saath content generate karna
export async function generateWithFallback(apiKey, prompt) {
  const models = await scanLiveModels(apiKey);
  if (!models.length) throw new Error("Koi active Gemini model nahi mila.");
  console.log("🔍 Active Models Found (" + models.length + "):", models.slice(0, 6).join(", "));

  for (const model of models) {
    try {
      console.log(`⚡ Trying model: ${model}...`);
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7 }
        })
      });
      if (!r.ok) {
        console.warn(`⚠️ ${model} skipped (HTTP ${r.status})`);
        continue;
      }
      const d = await r.json();
      const text = d?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text && text.trim().length > 50) {
        console.log(`✅ Success with model: ${model}\n`);
        return { model, text: text.trim() };
      }
    } catch (e) {
      console.warn(`⚠️ ${model} error:`, e.message);
    }
  }
  throw new Error("Saare models try kar liye, abhi quota busy hai.");
}

// Test Run
if (import.meta.url === `file://${process.argv[1]}`) {
  const key = getApiKey();
  if (!key) {
    console.error("❌ GEMINI_API_KEY nahi mili! Aise run karo:\nGEMINI_API_KEY='your_key_here' node bot-brain.mjs");
    process.exit(1);
  }
  const prompt = `You are the founder of ${FACTS.brand} (${FACTS.url}).
Write a short, punchy LinkedIn post (under 140 words) for freelancers and indie developers about ONE specific contract trap (e.g., Uncapped Liability or Scope Creep) and how ${FACTS.brand} solves it.
Use ONLY these real facts: ${JSON.stringify(FACTS)}.
Do NOT invent fake user numbers or fake statistics. Do NOT claim to be a lawyer. Include ${FACTS.url} once.`;

  generateWithFallback(key, prompt)
    .then(res => {
      console.log("================ GENERATED POST ================");
      console.log(res.text);
      console.log("================================================");
    })
    .catch(err => console.error("❌ Error:", err.message));
}
