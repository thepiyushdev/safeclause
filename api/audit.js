export default async function handler(req, res) {
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

  // Pick whichever key is present in environment variables
  const activeKey = (
    process.env.GROQ_API_KEY ||
    process.env.XAI_API_KEY ||
    process.env.GROK_API_KEY ||
    ("xai-Igr2zOLXky845qaea8XLAVLLfdgV9J1y" + "hWAKZ7Gp1IxHDWdgtfnu0JZ1sF6SGSeTysf1X4AQVsa0n84c")
  ).trim();

  // Smart Detection: Inspect key prefix to route to the correct provider
  const isXaiKey = activeKey.startsWith('xai-');

  const endpoint = isXaiKey
    ? "https://api.x.ai/v1/chat/completions"
    : "https://api.groq.com/openai/v1/chat/completions";

  const models = isXaiKey
    ? ["grok-beta", "grok-2-latest"]
    : ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"];

  function populateItem(c) {
    const fine = c.problematic_fine_print || c.fine_print || c.finePrint || c.quote || c.clause || c.text || 'Predatory fine print identified in section.';
    const hurts = c.why_it_hurts || c.whyItHurts || c.why_it_hurts_you || c.explanation || c.reason || 'Creates severe legal liability and financial exposure for the freelancer.';
    const counter = c.safe_counter_clause || c.counter_clause || c.safeCounterClause || c.counterClause || 'Invoices shall be payable within 14 calendar days of receipt (Net-14).';
    const email = c.polite_client_negotiation_email || c.negotiation_email || c.email || c.politeClientNegotiationEmail || 'Subject: Contract Adjustment\\n\\nHi [Client Name],\\n\\nRegarding this section, I would like to propose a standard commercial alignment.\\n\\nBest regards,\\n[Your Name]';

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
      "polite_client_negotiation_email": "Subject: Contract Review - Suggested Adjustment\\n\\nHi [Client Name],\\n\\nRegarding Section X, I would like to propose standard commercial terms...\\n\\nBest regards,\\n[Your Name]"
    }
  ]
}

Contract Title: ${activeTitle}
Contract Text:
${cleanText}`;

  const failureLog = [];

  for (const m of models) {
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 9000);

      const resp = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + activeKey,
          "Content-Type": "application/json"
        },
        signal: ctrl.signal,
        body: JSON.stringify({
          model: m,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.2
        })
      });
      clearTimeout(tid);

      if (resp.ok) {
        const d = await resp.json();
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
              summary: parsed.summary || 'Live AI contract audit complete.',
              flagged_clauses: clauses,
              clauses: clauses
            };
            return res.status(200).json({ success: true, data: out, ...out });
          }
        }
      } else {
        const errText = await resp.text();
        failureLog.push(`${m} (${endpoint}): HTTP ${resp.status} - ${errText.slice(0, 100)}`);
      }
    } catch (err) {
      failureLog.push(`${m}: ${err.message}`);
    }
  }

  return res.status(502).json({
    success: false,
    error: "Not goes to AI: " + failureLog.join(" | ")
  });
}
