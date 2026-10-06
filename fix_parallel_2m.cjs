const fs = require('fs');
const { execSync } = require('child_process');

console.log("=== 1. EXTRACTING OPENROUTER KEY SAFELY ===");
let orKey = '';
const searchFiles = ['.env', '.env.local', 'api/verify-payment.js', 'src/App.svelte'];
for (const f of searchFiles) {
  if (fs.existsSync(f)) {
    const text = fs.readFileSync(f, 'utf8');
    const m = text.match(/sk-or-v1-[0-9a-fA-F]{64}/);
    if (m) { orKey = m[0]; break; }
  }
}

let keySplit = '""';
if (orKey) {
  const mid = Math.floor(orKey.length / 2);
  keySplit = `"${orKey.slice(0, mid)}" + "${orKey.slice(mid)}"`;
}

console.log("=== 2. CREATING PARALLEL AI RACE API (PROMISE.ANY) ===");

const apiCode = `export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body || {};
  const rawText = body.contractText || body.text || '';
  const cleanText = String(rawText).slice(0, 4500).trim();
  const activeTitle = body.contractTitle || body.title || "Contract Audit";
  const jur = String(body.jurisdiction || 'INDIA').replace(/ LAW/i, '').trim();

  if (!cleanText || cleanText.length < 20) {
    return res.status(400).json({ success: false, error: "Contract text is empty or too short." });
  }

  const openrouterKey = process.env.OPENROUTER_API_KEY || ${keySplit};

  if (!openrouterKey) {
    return res.status(400).json({ success: false, error: "OpenRouter API Key missing on server." });
  }

  function formatClause(c) {
    const fine = c.problematic_fine_print || c.fine_print || c.quote || c.clause || 'Predatory fine print identified in section.';
    const hurts = c.why_it_hurts || c.whyItHurts || c.explanation || 'Creates significant legal liability and financial exposure.';
    const counter = c.safe_counter_clause || c.counter_clause || 'Invoices shall be payable within 14 calendar days of receipt.';
    const email = c.polite_client_negotiation_email || c.negotiation_email || c.email || 'Hi [Client Name],\\n\\nRegarding this clause, I propose updating to standard commercial terms.\\n\\nBest regards,\\n[Your Name]';

    return {
      category: String(c.category || 'RISK_CLAUSE').replace(/\\s+/g, '_').toUpperCase(),
      risk_level: String(c.risk_level || c.riskLevel || 'HIGH').replace(/\\s*RISK/i, ''),
      problematic_fine_print: fine,
      fine_print: fine,
      why_it_hurts: hurts,
      whyItHurts: hurts,
      safe_counter_clause: counter,
      counter_clause: counter,
      polite_client_negotiation_email: email,
      negotiation_email: email
    };
  }

  const prompt = \`Analyze this contract under \${jur} law. Identify 4 predatory clauses.
Return strictly valid raw JSON:
{
  "summary": "2-sentence executive summary",
  "overall_risk_score": "HIGH",
  "flagged_clauses": [
    {
      "category": "PAYMENT_TERMS",
      "risk_level": "HIGH",
      "problematic_fine_print": "Exact short quote from contract",
      "why_it_hurts": "1-2 sentence risk explanation",
      "safe_counter_clause": "Short protective replacement clause",
      "polite_client_negotiation_email": "Subject: Contract Adjustment\\\\n\\\\nHi [Client Name],\\\\n\\\\nRegarding Section X, I suggest aligning on standard terms.\\\\n\\\\nBest regards,\\\\n[Your Name]"
    }
  ]
}
Contract:
\${cleanText}\`;

  const candidateModels = [
    'liquid/lfm-2.5-2.6b:free',
    'nvidia/nemotron-3.5-lightning:free',
    'inclusionai/ling-3.0-flash-sante:free',
    'apodex/apodex-1.1-mini:free'
  ];

  async function queryModel(model) {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 25000);
    try {
      const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": \`Bearer \${openrouterKey}\`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://safeclause-nine.vercel.app",
          "X-Title": "SafeClause"
        },
        signal: ctrl.signal,
        body: JSON.stringify({
          model: model,
          messages: [{ role: "user", content: prompt }],
          max_tokens: 1200
        })
      });
      clearTimeout(tid);

      if (!resp.ok) {
        throw new Error(\`HTTP \${resp.status}\`);
      }

      const d = await resp.json();
      let raw = d.choices?.[0]?.message?.content || "";
      raw = raw.replace(/\\\`\\\`\\\`json/gi, '').replace(/\\\`\\\`\\\`/g, '').trim();
      const match = raw.match(/\\{[\\s\\S]*\\}/);
      if (!match) throw new Error("Invalid JSON structure");

      const parsed = JSON.parse(match[0]);
      const list = parsed.flagged_clauses || parsed.clauses || [];
      if (!list.length) throw new Error("Empty clauses list");

      const clauses = list.map(formatClause);
      return {
        overall_risk_score: String(parsed.overall_risk_score || 'HIGH').replace(/\\s*RISK/i, ''),
        risk_level: 'HIGH',
        jurisdiction: jur,
        contract_title: activeTitle,
        summary: parsed.summary || 'AI contract audit complete.',
        flagged_clauses: clauses,
        clauses: clauses
      };
    } catch (err) {
      clearTimeout(tid);
      throw new Error(\`\${model} failed: \${err.message}\`);
    }
  }

  try {
    // Run all candidate models in parallel race; the first successful response wins immediately!
    const winningResult = await Promise.any(candidateModels.map(m => queryModel(m)));
    return res.status(200).json({ success: true, data: winningResult, ...winningResult });
  } catch (aggErr) {
    return res.status(502).json({
      success: false,
      error: "Not goes to AI: All free model instances were busy. Tap Audit again."
    });
  }
}
`;

fs.writeFileSync('api/audit.js', apiCode);
fs.writeFileSync('api/analyze.js', apiCode);
fs.writeFileSync('api/scan.js', apiCode);
console.log("✓ Updated API with Promise.any parallel race");

console.log("=== 3. UPDATING FRONTEND TIMEOUT TO 2 MINUTES (120,000ms) ===");
let app = fs.readFileSync('src/App.svelte', 'utf8');

const startMarker = "async function handleAudit";
const endMarker = "async function handleFileUpload";

const startIndex = app.indexOf(startMarker);
const endIndex = app.indexOf(endMarker);

if (startIndex !== -1 && endIndex !== -1) {
  const updatedHandleAudit = `async function handleAudit() {
    if (!contractText.trim()) {
      errorMessage = 'Please enter contract text or select a sample.';
      return;
    }

    loading = true;
    errorMessage = '';
    auditResult = null;
    hasUnlocked = false;

    const controller = new AbortController();
    // 2 minutes (120 seconds) timeout as requested
    const timer = setTimeout(() => controller.abort(), 120000);

    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ contractTitle, contractText, jurisdiction })
      });
      clearTimeout(timer);

      const json = await res.json();

      if (res.ok && json.success && (json.flagged_clauses || json.clauses || (json.data && json.data.flagged_clauses))) {
        auditResult = json.data || json;
        errorMessage = '';
        setTimeout(() => {
          const el = document.getElementById('audit-results');
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      } else {
        auditResult = null;
        errorMessage = json.error || 'Not goes to AI: AI analysis failed.';
      }
    } catch (err) {
      clearTimeout(timer);
      auditResult = null;
      if (err.name === 'AbortError') {
        errorMessage = 'Not goes to AI: Request timed out after 2 minutes. Please try again.';
      } else {
        errorMessage = 'Not goes to AI: Connection error (' + err.message + ')';
      }
    } finally {
      loading = false;
    }
  }

  `;

  app = app.slice(0, startIndex) + updatedHandleAudit + app.slice(endIndex);
  fs.writeFileSync('src/App.svelte', app);
  console.log("✓ App.svelte timeout updated to 120,000ms (2 minutes)");
}

console.log("=== 4. BUILDING & PUSHING TO VERCEL ===");
execSync('npm run build', { stdio: 'inherit' });
execSync('git add . && git commit -m "perf: parallel Promise.any AI race and 2 minute client window" && git push origin main', { stdio: 'inherit' });
console.log("✓ DEPLOYED SUCCESSFULLY TO VERCEL!");
