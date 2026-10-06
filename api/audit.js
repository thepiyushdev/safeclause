export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body || {};
  const rawText = body.contractText || body.text || '';
  const cleanText = String(rawText).slice(0, 15000).trim();
  const activeTitle = body.contractTitle || body.title || "Contract Audit";
  const jur = String(body.jurisdiction || 'INDIA').replace(/ LAW/i, '').trim();

  if (!cleanText || cleanText.length < 20) {
    return res.status(400).json({ success: false, error: "Not goes to AI: Contract text is empty or too short to analyze." });
  }

  const openrouterKey = process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_KEY || "sk-or-v1-29c" + "adf019f23a38daec1b6251cb32ed022e08e2588ecd59113eaf05b53c2c36e";
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_KEY || "";

  if (!openrouterKey && !geminiKey) {
    return res.status(400).json({
      success: false,
      error: "Not goes to AI: Neither OpenRouter API Key nor Gemini API Key is available on the server."
    });
  }

  function populateItem(c) {
    const fine = c.problematic_fine_print || c.fine_print || c.finePrint || c.quote || c.clause || c.text || '';
    const hurts = c.why_it_hurts || c.whyItHurts || c.why_it_hurts_you || c.explanation || c.reason || '';
    const counter = c.safe_counter_clause || c.counter_clause || c.safeCounterClause || c.counterClause || '';
    const email = c.polite_client_negotiation_email || c.negotiation_email || c.email || c.politeClientNegotiationEmail || '';

    return {
      category: String(c.category || 'RISK_CLAUSE').replace(/\s+/g, '_').toUpperCase(),
      risk_level: String(c.risk_level || c.riskLevel || c.severity || 'HIGH').replace(/\s*RISK/i, ''),
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

  const prompt = `You are SafeClause, an expert legal contract risk auditor. Analyze this contract under ${jur} law.
Identify 4 high-risk or predatory clauses from this specific document text.

Return strictly raw JSON (no markdown formatting, no code backticks):
{
  "summary": "2-3 sentence executive risk assessment for this specific contract",
  "overall_risk_score": "HIGH",
  "flagged_clauses": [
    {
      "category": "PAYMENT_TERMS",
      "risk_level": "HIGH",
      "problematic_fine_print": "Exact quote from contract text",
      "why_it_hurts": "Plain English explanation of financial or legal trap",
      "safe_counter_clause": "Balanced replacement clause protecting the freelancer",
      "polite_client_negotiation_email": "Subject: Contract Review - Suggested Adjustment\\n\\nHi [Client Name],\\n\\nRegarding this section, I would like to propose a balanced alternative...\\n\\nBest regards,\\n[Your Name]"
    }
  ]
}

Contract Title: ${activeTitle}
Contract Text:
${cleanText}`;

  const failureErrors = [];

  // 1. TIER 1: OpenRouter 100% Free Models
  if (openrouterKey) {
    const freeModels = [
      'meta-llama/llama-3.3-70b-instruct:free',
      'deepseek/deepseek-r1:free',
      'qwen/qwen-2.5-72b-instruct:free',
      'google/gemini-2.0-flash-exp:free'
    ];

    for (const m of freeModels) {
      try {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 12000);
        const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${openrouterKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://safeclause-nine.vercel.app",
            "X-Title": "SafeClause"
          },
          signal: ctrl.signal,
          body: JSON.stringify({
            model: m,
            messages: [{ role: "user", content: prompt }]
          })
        });
        clearTimeout(tid);

        if (res.ok) {
          const d = await res.json();
          let raw = d.choices?.[0]?.message?.content || "";
          raw = raw.replace(/\`\`\`json/gi, '').replace(/\`\`\`/g, '').trim();
          const match = raw.match(/\{[\s\S]*\}/);
          if (match) {
            const parsed = JSON.parse(match[0]);
            const list = parsed.flagged_clauses || parsed.clauses || [];
            if (list.length > 0) {
              const clauses = list.map(populateItem);
              const result = {
                overall_risk_score: String(parsed.overall_risk_score || 'HIGH').replace(/\s*RISK/i, ''),
                risk_level: 'HIGH',
                jurisdiction: jur,
                contract_title: activeTitle,
                summary: parsed.summary || 'Live OpenRouter AI audit complete.',
                flagged_clauses: clauses,
                clauses: clauses
              };
              return res.status(200).json({ success: true, data: result, ...result });
            }
          }
        } else {
          const errText = await res.text();
          failureErrors.push(`${m}: HTTP ${res.status} - ${errText.slice(0, 100)}`);
        }
      } catch (e) {
        failureErrors.push(`${m}: ${e.message}`);
      }
    }
  }

  // 2. TIER 2: Official Google Gemini Flash Models
  if (geminiKey) {
    const geminiModels = ['gemini-2.0-flash', 'gemini-1.5-flash'];

    for (const m of geminiModels) {
      try {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 10000);
        const gRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${geminiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: ctrl.signal,
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json' }
          })
        });
        clearTimeout(tid);

        if (gRes.ok) {
          const d = await gRes.json();
          let raw = d.candidates?.[0]?.content?.parts?.[0]?.text || '';
          raw = raw.replace(/\`\`\`json/gi, '').replace(/\`\`\`/g, '').trim();
          const match = raw.match(/\{[\s\S]*\}/);
          if (match) {
            const parsed = JSON.parse(match[0]);
            const list = parsed.flagged_clauses || parsed.clauses || [];
            if (list.length > 0) {
              const clauses = list.map(populateItem);
              const result = {
                overall_risk_score: String(parsed.overall_risk_score || 'HIGH').replace(/\s*RISK/i, ''),
                risk_level: 'HIGH',
                jurisdiction: jur,
                contract_title: activeTitle,
                summary: parsed.summary || 'Live Gemini AI audit complete.',
                flagged_clauses: clauses,
                clauses: clauses
              };
              return res.status(200).json({ success: true, data: result, ...result });
            }
          }
        } else {
          const errText = await gRes.text();
          failureErrors.push(`${m}: HTTP ${gRes.status} - ${errText.slice(0, 100)}`);
        }
      } catch (err) {
        failureErrors.push(`${m}: ${err.message}`);
      }
    }
  }

  // ZERO STATIC FALLBACK: If AI fails, return explicit error
  return res.status(502).json({
    success: false,
    error: "Not goes to AI: All AI models failed. Reason: " + failureErrors.join(" | ")
  });
}
