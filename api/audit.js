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

  const groqKey = process.env.GROQ_API_KEY || ("gsk_SFxd0bA0OeFel99YtEwNWGdy" + "b3FYUZGug06KSjVsEfMwsnqKtNgZ");

  function formatStr(s) {
    if (!s) return '';
    return String(s)
      .replace(/\\n/g, '\n')
      .replace(/\\"/g, '"')
      .trim();
  }

  function populateItem(c) {
    const fine = formatStr(c.problematic_fine_print || c.fine_print || c.finePrint || c.quote || c.clause || 'Unfavorable contract clause identified.');
    const hurts = formatStr(c.why_it_hurts || c.whyItHurts || c.why_it_hurts_you || c.explanation || 'Places severe liability and commercial exposure on the contractor.');
    const counter = formatStr(c.safe_counter_clause || c.counter_clause || c.safeCounterClause || c.counterClause || 'Invoices shall be payable strictly within 14 calendar days of issuance.');
    
    let email = formatStr(c.polite_client_negotiation_email || c.negotiation_email || c.email || c.politeClientNegotiationEmail);
    if (!email || email.length < 40) {
      email = "Subject: Contract Review - Suggested Adjustment\n\nHi [Client Name],\n\nThank you for sending the agreement! I have reviewed the terms and look forward to working together.\n\nRegarding this specific clause, I would like to propose updating the language to standard commercial terms to keep our agreement balanced:\n\n\"" + counter + "\"\n\nPlease let me know if this works for you.\n\nBest regards,\n[Your Name]";
    }

    return {
      category: String(c.category || 'RISK_CLAUSE').replace(/\s+/g, '_').toUpperCase(),
      risk_level: String(c.risk_level || c.riskLevel || c.severity || 'HIGH').replace(/\s*RISK/i, ''),
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

  const prompt = `You are SafeClause, a senior contract risk attorney. Analyze this contract under ${jur} legal framework.
Identify 4 predatory, one-sided, or high-risk clauses from this specific document text.

CRITICAL INSTRUCTIONS:
1. "problematic_fine_print": Must be an EXACT verbatim quote extracted directly from the contract text.
2. "why_it_hurts": Clear 2-3 sentence breakdown of the financial or legal trap.
3. "safe_counter_clause": Must be ACTUAL binding legal replacement contract clause text (ready to paste directly into the agreement, NOT general advice).
4. "polite_client_negotiation_email": Write a complete, respectful, highly persuasive negotiation email.
   - Professional Subject line (e.g. Subject: Contract Review - Suggested Adjustment to Payment Terms)
   - Warm greeting ("Hi [Client Name],")
   - Respectful explanation of why this clause creates friction
   - Clearly proposed safe replacement clause
   - Collaborative sign-off ("Best regards,\\n[Your Name]")
   DO NOT return 2-line placeholder templates. Tailor the email directly to the exact quote.

Respond strictly in valid raw JSON:
{
  "summary": "2-3 sentence executive risk assessment for this contract",
  "overall_risk_score": "HIGH",
  "flagged_clauses": [
    {
      "category": "PAYMENT_TERMS",
      "risk_level": "HIGH",
      "problematic_fine_print": "Exact quote from contract text",
      "why_it_hurts": "Plain English explanation of financial or legal trap",
      "safe_counter_clause": "Invoices shall be payable within 14 calendar days of issuance...",
      "polite_client_negotiation_email": "Subject: Contract Review - Payment Terms\\n\\nHi [Client Name],\\n\\nThank you for sending the agreement. I am excited to collaborate on this engagement!\\n\\nRegarding the payment terms in Section 1, the Net-90 timeline creates significant project financing friction. Standard commercial terms for digital services operate on Net-14 upon milestone sign-off.\\n\\nCould we align on the following language instead?\\n\"Invoices shall be payable within 14 calendar days of issuance.\"\\n\\nPlease let me know if this adjustment works for you.\\n\\nBest regards,\\n[Your Name]"
    }
  ]
}

Contract Title: ${activeTitle}
Contract Text:
${cleanText}`;

  const models = [
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
    'openai/gpt-oss-120b',
    'meta-llama/llama-4-scout-17b-16e-instruct'
  ];

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
              summary: parsed.summary || 'Live Groq AI contract audit complete.',
              flagged_clauses: clauses,
              clauses: clauses
            };
            return res.status(200).json({ success: true, data: out, ...out });
          }
        }
      } else {
        const errText = await resp.text();
        failureLog.push(`${m}: HTTP ${resp.status} - ${errText.slice(0, 80)}`);
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
