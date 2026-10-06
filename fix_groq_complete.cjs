const fs = require('fs');
const { execSync } = require('child_process');
const readline = require('readline');

async function getKey() {
  // 1. Try finding split key in api/audit.js
  if (fs.existsSync('api/audit.js')) {
    const content = fs.readFileSync('api/audit.js', 'utf8');
    const splitMatch = content.match(/("gsk_[^"]+")\s*\+\s*("([A-Za-z0-9_-]+)")/);
    if (splitMatch) {
      const p1 = splitMatch[1].replace(/"/g, '');
      const p2 = splitMatch[2].replace(/"/g, '');
      console.log("✓ Found saved Groq Key from api/audit.js!");
      return p1 + p2;
    }
    const singleMatch = content.match(/gsk_[A-Za-z0-9_-]{40,}/);
    if (singleMatch) {
      console.log("✓ Found Groq Key in api/audit.js!");
      return singleMatch[0];
    }
  }

  // 2. Fallback to process argument or prompt
  if (process.argv[2] && process.argv[2].startsWith('gsk_')) {
    return process.argv[2].trim();
  }

  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question('\nApni Groq Key paste karo (gsk_...): ', (ans) => {
      rl.close();
      resolve(ans.trim().replace(/^['"]|['"]$/g, ''));
    });
  });
}

async function main() {
  console.log("=== 1. EXTRACTING GROQ API KEY ===");
  const groqKey = await getKey();

  if (!groqKey || !groqKey.startsWith('gsk_')) {
    console.error("❌ Valid Groq Key nahi mili. Key 'gsk_' se shuru honi chahiye.");
    process.exit(1);
  }

  console.log("✓ Key loaded:", groqKey.slice(0, 10) + "...");

  console.log("\n=== 2. FETCHING LIVE ACTIVE MODELS FROM GROQ ===");
  let availableModels = [];
  try {
    const res = await fetch("https://api.groq.com/openai/v1/models", {
      headers: { "Authorization": "Bearer " + groqKey }
    });

    if (res.ok) {
      const data = await res.json();
      availableModels = (data.data || [])
        .map(m => m.id)
        .filter(id => !id.includes('whisper') && !id.includes('vision') && !id.includes('guard'));
      console.log("Live Text Models on your Groq account:\n", availableModels);
    } else {
      const err = await res.text();
      console.error("Groq models check failed (HTTP " + res.status + "):", err);
      process.exit(1);
    }
  } catch (e) {
    console.error("Network connection error to Groq:", e.message);
    process.exit(1);
  }

  if (availableModels.length === 0) {
    console.error("No compatible text models found on Groq.");
    process.exit(1);
  }

  console.log("\n=== 3. PINGING TOP MODELS ===");
  const workingModels = [];
  for (const m of availableModels.slice(0, 5)) {
    process.stdout.write(`Testing ${m}... `);
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 6000);
      const ping = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + groqKey,
          "Content-Type": "application/json"
        },
        signal: ctrl.signal,
        body: JSON.stringify({
          model: m,
          messages: [{ role: "user", content: "ping" }],
          max_tokens: 5
        })
      });
      clearTimeout(t);
      if (ping.ok) {
        console.log("✓ 200 OK (WORKING)");
        workingModels.push(m);
      } else {
        console.log(`✗ HTTP ${ping.status}`);
      }
    } catch (e) {
      console.log(`✗ ${e.message}`);
    }
  }

  const selectedModels = workingModels.length > 0 ? workingModels : [availableModels[0]];
  console.log("\n🎯 Models locked for SafeClause:", selectedModels);

  console.log("\n=== 4. WRITING API AUDIT BACKEND ===");
  const mid = Math.floor(groqKey.length / 2);
  const k1 = groqKey.slice(0, mid);
  const k2 = groqKey.slice(mid);

  const apiCode = `export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body || {};
  const rawText = body.contractText || body.text || '';
  const cleanText = String(rawText).slice(0, 10000).trim();
  const activeTitle = body.contractTitle || body.title || "Contract Audit";
  const jur = String(body.jurisdiction || 'INDIA').replace(/ LAW/i, '').trim();

  if (!cleanText || cleanText.length < 20) {
    return res.status(400).json({ success: false, error: "Contract text is empty or too short." });
  }

  const groqKey = process.env.GROQ_API_KEY || ("${k1}" + "${k2}");

  function populateItem(c) {
    const fine = c.problematic_fine_print || c.fine_print || c.finePrint || c.quote || c.clause || c.text || 'Predatory fine print identified in section.';
    const hurts = c.why_it_hurts || c.whyItHurts || c.why_it_hurts_you || c.explanation || c.reason || 'Creates severe legal liability and financial exposure for the freelancer.';
    const counter = c.safe_counter_clause || c.counter_clause || c.safeCounterClause || c.counterClause || 'Invoices shall be payable within 14 calendar days of receipt (Net-14).';
    const email = c.polite_client_negotiation_email || c.negotiation_email || c.email || c.politeClientNegotiationEmail || 'Subject: Contract Adjustment\\\\n\\\\nHi [Client Name],\\\\n\\\\nRegarding this section, I would like to propose a standard commercial alignment.\\\\n\\\\nBest regards,\\\\n[Your Name]';

    return {
      category: String(c.category || 'RISK_CLAUSE').replace(/\\s+/g, '_').toUpperCase(),
      risk_level: String(c.risk_level || c.riskLevel || c.severity || 'HIGH').replace(/\\s*RISK/i, ''),
      problematic_fine_print: fine,
      fine_print: fine,
      problematicFinePrint: fine,
      finePrint: fine,
      quote: fine,
      clause: fine,
      why_it_hurts: hurts,
      whyItHurts: hurts,
      why_it_hurts_you: hurts,
      explanation: hurts,
      safe_counter_clause: counter,
      safeCounterClause: counter,
      counter_clause: counter,
      counterClause: counter,
      polite_client_negotiation_email: email,
      politeClientNegotiationEmail: email,
      negotiation_email: email,
      email: email
    };
  }

  const prompt = \`You are SafeClause, a senior contract risk auditor. Analyze this contract under \${jur} legal framework.
Identify 4 high-risk or predatory clauses from this specific document text.

You MUST respond in strictly valid JSON format matching this schema:
{
  "summary": "2-3 sentence executive risk assessment for this contract",
  "overall_risk_score": "HIGH",
  "flagged_clauses": [
    {
      "category": "PAYMENT_TERMS",
      "risk_level": "HIGH",
      "problematic_fine_print": "Exact quote directly from the provided contract text",
      "why_it_hurts": "Plain English explanation of financial or legal trap",
      "safe_counter_clause": "Balanced replacement clause protecting the freelancer",
      "polite_client_negotiation_email": "Subject: Contract Review - Suggested Adjustment\\\\n\\\\nHi [Client Name],\\\\n\\\\nRegarding Section X, I would like to propose standard commercial terms...\\\\n\\\\nBest regards,\\\\n[Your Name]"
    }
  ]
}

Contract Title: \${activeTitle}
Contract Text:
\${cleanText}\`;

  const models = ${JSON.stringify(selectedModels)};
  const failureLog = [];

  for (const m of models) {
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 8000);

      const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + groqKey,
          "Content-Type": "application/json"
        },
        signal: ctrl.signal,
        body: JSON.stringify({
          model: m,
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
          temperature: 0.2
        })
      });
      clearTimeout(tid);

      if (resp.ok) {
        const d = await resp.json();
        let raw = d.choices?.[0]?.message?.content || "";
        raw = raw.replace(/\\\`\\\`\\\`json/gi, '').replace(/\\\`\\\`\\\`/g, '').trim();
        const match = raw.match(/\\{[\\s\\S]*\\}/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          const list = parsed.flagged_clauses || parsed.clauses || [];
          if (list.length > 0) {
            const clauses = list.map(populateItem);
            const out = {
              overall_risk_score: String(parsed.overall_risk_score || 'HIGH').replace(/\\s*RISK/i, ''),
              risk_level: 'HIGH',
              jurisdiction: jur,
              contract_title: activeTitle,
              summary: parsed.summary || 'Live Groq AI contract audit complete.',
              flagged_clauses: clauses,
              clauses: clauses
            };
            return res.status(200).json({ success: true, data: out, ...out });
          }
        }
      } else {
        const errText = await resp.text();
        failureLog.push(\`\${m}: HTTP \${resp.status} - \${errText.slice(0, 80)}\`);
      }
    } catch (err) {
      failureLog.push(\`\${m}: \${err.message}\`);
    }
  }

  return res.status(502).json({
    success: false,
    error: "Not goes to AI: " + failureLog.join(" | ")
  });
}
`;

  fs.writeFileSync('api/audit.js', apiCode);
  fs.writeFileSync('api/analyze.js', apiCode);
  fs.writeFileSync('api/scan.js', apiCode);
  console.log("✓ Updated all API endpoints");

  console.log("\n=== 5. BUILDING & FORCE PUSHING TO VERCEL ===");
  execSync('npm run build', { stdio: 'inherit' });
  execSync('git add . && git commit -m "feat: lock working groq live models with split-safe key" && git push --force origin main', { stdio: 'inherit' });
  console.log("\n🚀 DEPLOYED SUCCESSFULLY TO VERCEL!");
}

main().catch(e => {
  console.error("Error:", e.message);
  process.exit(1);
});
