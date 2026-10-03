export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { contractText, contractTitle, jurisdiction = 'INDIA' } = req.body || {};

  if (!contractText || contractText.trim().length < 40) {
    return res.status(400).json({ error: 'Contract text too short to audit (min 40 characters).' });
  }

  const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
  if (!OPENROUTER_KEY) {
    return res.status(500).json({ error: 'Server configuration error: OpenRouter API key missing.' });
  }

  const isIndia = jurisdiction === 'INDIA';

  const systemPrompt = `You are SafeClause, a senior contract risk auditor for independent contractors, freelancers, and boutique agencies worldwide.
Target Jurisdiction: ${isIndia ? 'INDIA (Indian Contract Act 1872, MSMED Act, Indian Dispute Resolution)' : 'GLOBAL / US / UK (Common Law, Delaware/UK standards, FTC Non-Compete rules, Cross-Border Remote Work)'}.

Analyze the agreement text across these 5 critical vulnerability areas:
1. PAYMENT_TERMS: Net-60/90 delays, 'paid-when-paid' traps, missing late-payment interest, unreasonable milestone sign-offs.
2. IP_ASSIGNMENT: Assignment of pre-existing tools/frameworks, or IP transfer taking effect BEFORE 100% payment clearance.
3. NON_COMPETE_RESTRICTION: Post-termination client bans or industry trade restrictions (${isIndia ? 'Void under Section 27 Indian Contract Act' : 'Overly broad covenants unreasonable for remote contractors'}).
4. INDEMNITY_LIABILITY: Uncapped liability, unilateral contractor indemnification, no client liability reciprocation.
5. TERMINATION_KILL_FEE: Immediate client termination without reasonable notice or no kill-fee for work-in-progress.

CRITICAL INSTRUCTION:
Return ONLY a raw, valid JSON object without markdown fences or codeblocks.
JSON Schema:
{
  "contract_title": "string",
  "jurisdiction": "${jurisdiction}",
  "overall_risk_score": "LOW" | "MEDIUM" | "HIGH",
  "summary": "string (max 3 sentences explaining overall risk)",
  "flagged_clauses": [
    {
      "category": "PAYMENT_TERMS" | "IP_ASSIGNMENT" | "NON_COMPETE_RESTRICTION" | "INDEMNITY_LIABILITY" | "TERMINATION_KILL_FEE",
      "risk_level": "MEDIUM" | "HIGH",
      "extracted_text": "string (exact clause snippet)",
      "issue": "string (clear explanation of why this damages the freelancer)",
      "safe_counter_clause": "string (balanced legal alternative to propose)",
      "negotiation_note": "string (polite email draft to send to client)"
    }
  ]
}`;

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://safeclause.com",
        "X-Title": "SafeClause"
      },
      body: JSON.stringify({
        model: "openrouter/free",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Agreement Title: ${contractTitle || 'Freelance Agreement'}\n\nContract Clauses:\n${contractText}` }
        ]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: 'AI provider error', details: err });
    }

    const result = await response.json();
    let content = result.choices?.[0]?.message?.content || "";
    content = content.replace(/```json/gi, '').replace(/```/g, '').trim();

    const parsedData = JSON.parse(content);
    return res.status(200).json({ success: true, data: parsedData });

  } catch (error) {
    return res.status(500).json({ error: 'Failed to parse AI response', details: error.message });
  }
}
