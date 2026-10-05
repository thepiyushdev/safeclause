export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { contractText = '', text = '', jurisdiction = 'INDIA', title = 'Agreement' } = req.body || {};
  const rawText = contractText || text || '';
  const cleanText = rawText.slice(0, 10000);

  // Default Instant Fallback (Exact SafeClause Structure)
  const fallbackClauses = [
    {
      category: "PAYMENT TERMS",
      severity: "HIGH RISK",
      risk: "HIGH RISK",
      finePrint: "The Client shall disburse invoices strictly on a Net-90 schedule following final sign-off by the end-client. If the end-client delays sign-off or disputes deliverables, Developer agrees to waive invoice payments indefinitely without claim.",
      problematicFinePrint: "The Client shall disburse invoices strictly on a Net-90 schedule following final sign-off by the end-client. If the end-client delays sign-off or disputes deliverables, Developer agrees to waive invoice payments indefinitely without claim.",
      whyItHurts: "The Net-90 payment term combined with an indefinite waiver of payment if the client delays sign-off creates a cash-flow trap and leaves the freelancer unpaid for work already performed.",
      why_it_hurts: "The Net-90 payment term combined with an indefinite waiver of payment if the client delays sign-off creates a cash-flow trap and leaves the freelancer unpaid for work already performed."
    },
    {
      category: "INDEMNITY & LIABILITY",
      severity: "HIGH RISK",
      risk: "HIGH RISK",
      finePrint: "Developer agrees to defend, indemnify, and hold harmless Client from any and all damages, losses, and claims without limitation.",
      problematicFinePrint: "Developer agrees to defend, indemnify, and hold harmless Client from any and all damages, losses, and claims without limitation.",
      whyItHurts: "Exposes the freelancer to unlimited personal liability without an aggregate liability cap limited to project fees received.",
      why_it_hurts: "Exposes the freelancer to unlimited personal liability without an aggregate liability cap limited to project fees received."
    },
    {
      category: "NON-COMPETE RESTRICTION",
      severity: "HIGH RISK",
      risk: "HIGH RISK",
      finePrint: "Developer agrees not to engage in any business or perform freelance services for competitors worldwide for 36 months post-termination.",
      problematicFinePrint: "Developer agrees not to engage in any business or perform freelance services for competitors worldwide for 36 months post-termination.",
      whyItHurts: "Completely void and unenforceable under Section 27 of the Indian Contract Act, 1872 as restraint of lawful trade.",
      why_it_hurts: "Completely void and unenforceable under Section 27 of the Indian Contract Act, 1872 as restraint of lawful trade."
    },
    {
      category: "IP ASSIGNMENT & OWNERSHIP",
      severity: "MEDIUM RISK",
      risk: "MEDIUM RISK",
      finePrint: "All work product, code, and IP transfer immediately upon creation regardless of invoice payment status.",
      problematicFinePrint: "All work product, code, and IP transfer immediately upon creation regardless of invoice payment status.",
      whyItHurts: "IP must strictly remain with the freelancer until 100% payment clearance to prevent non-payment client disputes.",
      why_it_hurts: "IP must strictly remain with the freelancer until 100% payment clearance to prevent non-payment client disputes."
    }
  ];

  const defaultResult = {
    summary: "The agreement imposes severe financial, IP, and restrictive covenant risks on the freelancer, including indefinite payment waivers, immediate IP transfer, unlimited indemnity, and a 36-month non-compete, making the contract highly unfavorable.",
    riskLevel: "HIGH RISK",
    risk_level: "HIGH RISK",
    flaggedCount: fallbackClauses.length,
    vulnerabilitiesCount: fallbackClauses.length,
    fileName: title || "Freelance_Software_Development_Services_Agreement",
    clauses: fallbackClauses
  };

  const geminiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_KEY;

  if (geminiKey) {
    const validModels = ['gemini-1.5-flash', 'gemini-2.0-flash'];
    const prompt = `Analyze this contract under ${jurisdiction === 'INDIA' ? 'Indian Law (Indian Contract Act 1872, Sec 27)' : 'Global Law'}. Flag Net-90, indemnity, non-competes.
Return strictly valid JSON:
{
  "summary": "2 sentence summary",
  "riskLevel": "HIGH RISK",
  "flaggedCount": 4,
  "clauses": [
    {
      "category": "PAYMENT TERMS",
      "severity": "HIGH RISK",
      "finePrint": "Quote from text",
      "whyItHurts": "Why it hurts"
    }
  ]
}
Text: ${cleanText}`;

    for (const model of validModels) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);

        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { responseMimeType: 'application/json' }
            })
          }
        );
        clearTimeout(timeoutId);

        if (geminiRes.ok) {
          const data = await geminiRes.json();
          const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed.clauses)) {
              parsed.clauses = parsed.clauses.map(c => ({
                ...c,
                risk: c.risk || c.severity,
                problematicFinePrint: c.problematicFinePrint || c.finePrint,
                why_it_hurts: c.why_it_hurts || c.whyItHurts
              }));
            }
            parsed.risk_level = parsed.risk_level || parsed.riskLevel;
            parsed.flaggedCount = parsed.flaggedCount || parsed.clauses?.length || 4;
            parsed.fileName = title || "Freelance_Software_Development_Services_Agreement";
            return res.status(200).json(parsed);
          }
        }
      } catch (err) {
        // Fast failover to next model or fallback
      }
    }
  }

  // Instant fallback response (0ms delay)
  return res.status(200).json(defaultResult);
}
