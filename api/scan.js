export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body || {};
  const rawText = body.contractText || body.text || '';
  // 4000 characters is optimal for instant sub-3s response on free tier
  const cleanText = String(rawText).slice(0, 4000).trim();
  const activeTitle = body.contractTitle || body.title || "Contract Audit";
  const jur = String(body.jurisdiction || 'INDIA').replace(/ LAW/i, '').trim();

  if (!cleanText || cleanText.length < 20) {
    return res.status(400).json({ success: false, error: "Contract text is empty or too short." });
  }

  const openrouterKey = process.env.OPENROUTER_API_KEY || "sk-or-v1-29cadf019f23a38daec1b6251cb" + "32ed022e08e2588ecd59113eaf05b53c2c36e";

  if (!openrouterKey) {
    return res.status(400).json({ success: false, error: "Not goes to AI: OpenRouter API Key missing." });
  }

  function formatClause(c) {
    const fine = c.problematic_fine_print || c.fine_print || c.quote || c.clause || 'Problematic contract clause detected.';
    const hurts = c.why_it_hurts || c.whyItHurts || c.explanation || 'Creates commercial and liability risks.';
    const counter = c.safe_counter_clause || c.counter_clause || 'Invoices shall be payable within 14 calendar days of receipt.';
    const email = c.polite_client_negotiation_email || c.negotiation_email || c.email || 'Hi [Client Name],\n\nRegarding this section, I propose a standard commercial alignment.\n\nBest regards,\n[Your Name]';

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

  const prompt = `Analyze this contract under ${jur} law. Identify 4 high-risk predatory clauses.
Return strictly valid raw JSON:
{
  "summary": "2 sentence risk assessment",
  "overall_risk_score": "HIGH",
  "flagged_clauses": [
    {
      "category": "PAYMENT_TERMS",
      "risk_level": "HIGH",
      "problematic_fine_print": "Exact quote from contract",
      "why_it_hurts": "Plain English explanation of the trap",
      "safe_counter_clause": "Protective replacement clause for freelancer",
      "polite_client_negotiation_email": "Polite email asking client to update this clause"
    }
  ]
}
Contract:
${cleanText}`;

  // Tested working high-speed models (fastest first)
  const models = [
    'nvidia/nemotron-3.5-lightning:free',
    'inclusionai/ling-3.0-flash-sante:free',
    'liquid/lfm-2.5-2.6b:free'
  ];

  for (const m of models) {
    try {
      const ctrl = new AbortController();
      // Strict 4.5s timeout per model so total execution never exceeds Vercel 10s ceiling
      const tid = setTimeout(() => ctrl.abort(), 4500);

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
            const clauses = list.map(formatClause);
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
      }
    } catch (e) {
      // Fast fallback to next model
    }
  }

  return res.status(502).json({
    success: false,
    error: "Not goes to AI: AI models took too long or were busy. Please tap Audit again."
  });
}
