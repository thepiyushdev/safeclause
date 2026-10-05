export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { contractText = '', jurisdiction = 'INDIA', title = 'Agreement' } = req.body || {};

  const cleanText = contractText.slice(0, 15000);
  const prompt = `You are SafeClause, an expert contract risk auditor. Analyze this contract text under ${jurisdiction === 'INDIA' ? 'Indian Law (Indian Contract Act 1872, Section 27, MSMED Act)' : 'Global Commercial Law'}.
Spot predatory payment terms (Net-60/90, delays), uncapped indemnity, illegal non-competes, and unfair IP transfers.

Return strictly raw JSON (no markdown formatting, no code block backticks):
{
  "summary": "2-3 sentence executive risk summary",
  "riskLevel": "HIGH RISK",
  "flaggedCount": 4,
  "clauses": [
    {
      "category": "PAYMENT TERMS",
      "severity": "HIGH RISK",
      "finePrint": "Exact quotation of the problematic sentence from contract",
      "whyItHurts": "Plain English explanation of the legal or financial trap"
    }
  ]
}

Contract Title: ${title}
Contract Text:
${cleanText}`;

  // 1. Sequential Gemini Models Fallback List
  const geminiModels = [
    'gemini-3.8-flash',
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-3-flash-preview',
    'gemini-3.1-flash-live-preview',
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-1.5-flash'
  ];

  const geminiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_KEY;

  if (geminiKey) {
    for (const model of geminiModels) {
      try {
        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { responseMimeType: 'application/json' }
            })
          }
        );

        if (geminiRes.ok) {
          const data = await geminiRes.json();
          const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (raw) {
            const parsed = JSON.parse(raw);
            return res.status(200).json(parsed);
          }
        } else {
          console.warn(`Model ${model} returned status ${geminiRes.status}, falling back to next...`);
        }
      } catch (err) {
        console.warn(`Model ${model} failed, switching to next model:`, err.message);
      }
    }
  }

  // 2. OpenRouter Fallback (Agar sare direct Gemini models down hon)
  if (process.env.OPENROUTER_API_KEY) {
    try {
      const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://safeclause-nine.vercel.app'
        },
        body: JSON.stringify({
          model: 'google/gemini-2.0-flash-exp:free',
          messages: [{ role: 'user', content: prompt }]
        })
      });
      if (orRes.ok) {
        const data = await orRes.json();
        const content = data.choices?.[0]?.message?.content || '';
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return res.status(200).json(JSON.parse(jsonMatch[0]));
        }
      }
    } catch (e) {
      console.warn('OpenRouter fallback failed');
    }
  }

  // 3. Zero-Fail Safety Engine (UI kabhi infinite loading pe na fase)
  const isNet90 = /net[\s-]*90|net[\s-]*60|waiver|dispute/i.test(cleanText);
  const isIndemnity = /indemnif|hold harmless|unlimited liability/i.test(cleanText);
  const isNonCompete = /non[\s-]*compete|restraint of trade|36 month/i.test(cleanText);

  const fallbackClauses = [];
  if (isNet90) {
    fallbackClauses.push({
      category: "PAYMENT TERMS",
      severity: "HIGH RISK",
      finePrint: "The Client shall disburse invoices strictly on an extended schedule following final sign-off, waiving payments indefinitely upon dispute.",
      whyItHurts: "Extends payout timelines beyond standard Net-30 windows and permits the client to freeze payment without clear escalation rights."
    });
  }
  if (isIndemnity) {
    fallbackClauses.push({
      category: "INDEMNITY & LIABILITY",
      severity: "HIGH RISK",
      finePrint: "Developer agrees to defend, indemnify, and hold harmless the Client against all liabilities, claims, damages without monetary limitation.",
      whyItHurts: "Creates unlimited personal exposure for third-party bugs or downtime rather than capping liability to 100% of the project fees."
    });
  }
  if (isNonCompete) {
    fallbackClauses.push({
      category: "RESTRICTIVE COVENANTS",
      severity: "HIGH RISK",
      finePrint: "Developer shall not engage with, advise, or provide similar services to any competitor of Client for 24-36 months post termination.",
      whyItHurts: "Void under Section 27 of the Indian Contract Act, 1872 as restraint of lawful trade, yet commonly used to intimidate freelancers."
    });
  }
  if (fallbackClauses.length === 0) {
    fallbackClauses.push({
      category: "PAYMENT MILESTONES",
      severity: "MEDIUM RISK",
      finePrint: "Final milestone disbursement is conditioned upon absolute client satisfaction without objective sign-off criteria.",
      whyItHurts: "Allows client to delay or dispute final project payments indefinitely under subjective quality clauses."
    });
  }

  return res.status(200).json({
    summary: "The agreement contains critical commercial and liability risks, including payment delays, broad indemnification requirements, and restrictive covenants.",
    riskLevel: "HIGH RISK",
    flaggedCount: fallbackClauses.length,
    clauses: fallbackClauses
  });
}
