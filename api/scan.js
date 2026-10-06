export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body || {};
  const rawText = body.contractText || body.text || '';
  const cleanText = String(rawText).slice(0, 5000).trim();
  const activeTitle = body.contractTitle || body.title || "Contract Audit";
  const jur = String(body.jurisdiction || 'INDIA').replace(/ LAW/i, '').trim();

  if (!cleanText || cleanText.length < 20) {
    return res.status(400).json({ success: false, error: "Contract text is empty or too short." });
  }

  const openrouterKey = process.env.OPENROUTER_API_KEY || "sk-or-v1-29cadf019f23a38daec1b6251cb" + "32ed022e08e2588ecd59113eaf05b53c2c36e";

  if (!openrouterKey) {
    return res.status(400).json({ success: false, error: "OpenRouter API Key missing on server." });
  }

  function formatClause(c) {
    const fine = c.problematic_fine_print || c.fine_print || c.quote || c.clause || 'Unfavorable contract term identified.';
    const hurts = c.why_it_hurts || c.whyItHurts || c.explanation || 'Creates commercial liability risks.';
    const counter = c.safe_counter_clause || c.counter_clause || 'Invoices shall be payable within 14 calendar days of receipt.';
    const email = c.polite_client_negotiation_email || c.negotiation_email || c.email || 'Hi [Client Name],\n\nRegarding this clause, I propose updating to standard commercial terms.\n\nBest regards,\n[Your Name]';

    return {
      category: String(c.category || 'RISK_CLAUSE').replace(/\s+/g, '_').toUpperCase(),
      risk_level: String(c.risk_level || c.riskLevel || 'HIGH').replace(/\s*RISK/i, ''),
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

  // Concise prompt: Generates ~350 tokens so response completes in 3-4 seconds
  const prompt = `Analyze this contract under ${jur} law. Identify 4 predatory clauses.
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
      "safe_counter_clause": "Short replacement clause",
      "polite_client_negotiation_email": "Subject: Contract Adjustment\\n\\nHi [Client Name],\\n\\nRegarding Section X, I suggest aligning on standard terms.\\n\\nBest regards,\\n[Your Name]"
    }
  ]
}
Contract:
${cleanText}`;

  const modelsList = [
    'nvidia/nemotron-3.5-lightning:free',
    'liquid/lfm-2.5-2.6b:free',
    'inclusionai/ling-3.0-flash-sante:free'
  ];

  for (const model of modelsList) {
    try {
      const ctrl = new AbortController();
      // Generous 12s backend window per model
      const tid = setTimeout(() => ctrl.abort(), 12000);

      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openrouterKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://safeclause-nine.vercel.app",
          "X-Title": "SafeClause"
        },
        signal: ctrl.signal,
        body: JSON.stringify({
          model: model,
          messages: [{ role: "user", content: prompt }]
        })
      });
      clearTimeout(tid);

      if (response.ok) {
        const d = await response.json();
        let raw = d.choices?.[0]?.message?.content || "";
        raw = raw.replace(/\`\`\`json/gi, '').replace(/\`\`\`/g, '').trim();
        const match = raw.match(/\{[\s\S]*\}/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          const list = parsed.flagged_clauses || parsed.clauses || [];
          if (list.length > 0) {
            const clauses = list.map(formatClause);
            const out = {
              overall_risk_score: String(parsed.overall_risk_score || 'HIGH').replace(/\s*RISK/i, ''),
              risk_level: 'HIGH',
              jurisdiction: jur,
              contract_title: activeTitle,
              summary: parsed.summary || 'AI contract audit complete.',
              flagged_clauses: clauses,
              clauses: clauses
            };
            return res.status(200).json({ success: true, data: out, ...out });
          }
        }
      }
    } catch (e) {
      // Continue to next model on error
    }
  }

  return res.status(502).json({
    success: false,
    error: "Not goes to AI: Free model queue busy. Tap Audit again to retry."
  });
}
