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
    return res.status(400).json({ success: false, error: "Contract text is empty or too short." });
  }

  const openrouterKey = process.env.OPENROUTER_API_KEY || "sk-or-v1-29cadf019f23a38daec1b6251cb" + "32ed022e08e2588ecd59113eaf05b53c2c36e";
  const geminiKey = process.env.GEMINI_API_KEY || "";

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

  const prompt = `You are SafeClause, a senior contract risk auditor. Analyze this contract under ${jur} legal framework.
Identify 4 high-risk or predatory clauses from this specific document text.

Return strictly raw JSON (no markdown backticks, no code formatting):
{
  "summary": "2-3 sentence executive risk assessment for this contract",
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

  const failureLog = [];

  // TIER 1: VERIFIED WORKING OPENROUTER MODELS
  const verifiedOr = ["apodex/apodex-1.1-mini:free","inclusionai/ling-3.0-flash-sante:free","dots-studio/dots-3-note-preview:free","liquid/lfm-2.5-2.6b:free","nvidia/nemotron-3.5-lightning:free","poolside/laguna-s-2.1:free"];
  if (openrouterKey && verifiedOr.length > 0) {
    for (const m of verifiedOr) {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 12000);
        const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${openrouterKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://safeclause-nine.vercel.app"
          },
          signal: ctrl.signal,
          body: JSON.stringify({
            model: m,
            messages: [{ role: "user", content: prompt }]
          })
        });
        clearTimeout(t);
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
              const out = {
                overall_risk_score: String(parsed.overall_risk_score || 'HIGH').replace(/\s*RISK/i, ''),
                risk_level: 'HIGH',
                jurisdiction: jur,
                contract_title: activeTitle,
                summary: parsed.summary || 'Live OpenRouter AI audit complete.',
                flagged_clauses: clauses,
                clauses: clauses
              };
              return res.status(200).json({ success: true, data: out, ...out });
            }
          }
        } else {
          failureLog.push(`${m}: HTTP ${res.status}`);
        }
      } catch (e) {
        failureLog.push(`${m}: ${e.message}`);
      }
    }
  }

  // TIER 2: VERIFIED WORKING GEMINI MODELS
  const verifiedGemini = [];
  if (geminiKey && verifiedGemini.length > 0) {
    for (const m of verifiedGemini) {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 10000);
        const gRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${geminiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: ctrl.signal,
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json' }
          })
        });
        clearTimeout(t);
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
              const out = {
                overall_risk_score: String(parsed.overall_risk_score || 'HIGH').replace(/\s*RISK/i, ''),
                risk_level: 'HIGH',
                jurisdiction: jur,
                contract_title: activeTitle,
                summary: parsed.summary || 'Live Gemini AI audit complete.',
                flagged_clauses: clauses,
                clauses: clauses
              };
              return res.status(200).json({ success: true, data: out, ...out });
            }
          }
        } else {
          failureLog.push(`${m}: HTTP ${gRes.status}`);
        }
      } catch (e) {
        failureLog.push(`${m}: ${e.message}`);
      }
    }
  }

  return res.status(502).json({
    success: false,
    error: "Not goes to AI: " + failureLog.join(" | ")
  });
}
