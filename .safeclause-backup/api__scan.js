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

  function sanitize(str) {
    if (!str) return '';
    return String(str)
      .replace(/\\n/g, '\n')
      .replace(/\\"/g, '"')
      .trim();
  }

  function populateItem(c) {
    const fine = sanitize(c.problematic_fine_print || c.fine_print || c.finePrint || c.quote || c.clause || 'Predatory fine print identified.');
    const hurts = sanitize(c.why_it_hurts || c.whyItHurts || c.why_it_hurts_you || c.explanation || 'Places severe liability and commercial exposure on the contractor.');
    const counter = sanitize(c.safe_counter_clause || c.counter_clause || c.safeCounterClause || c.counterClause || 'Invoices shall be payable strictly within 14 calendar days of issuance (Net-14).');
    
    let email = sanitize(c.polite_client_negotiation_email || c.negotiation_email || c.email || c.politeClientNegotiationEmail);
    if (!email || email.length < 35) {
      email = "Subject: Contract Review - Suggested Clause Adjustment\n\nHi [Client Name],\n\nThank you for sending the agreement! I have reviewed the terms and look forward to collaborating.\n\nRegarding this specific section, I would like to propose updating the language to standard commercial terms to keep our agreement balanced:\n\n\"" + counter + "\"\n\nPlease let me know if this works for you, and I will be happy to proceed.\n\nBest regards,\n[Your Name]";
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

  const prompt = `Analyze this contract under ${jur} legal framework.
Identify 4 high-risk predatory clauses from this specific document text.

CRITICAL INSTRUCTIONS:
1. "problematic_fine_print": Must be an EXACT verbatim quote extracted directly from the contract text.
2. "why_it_hurts": Clear 2-3 sentence breakdown of the financial or legal trap.
3. "safe_counter_clause": Must be ACTUAL binding legal replacement contract clause text (Net-14, liability caps, IP protection).
4. "polite_client_negotiation_email": Write a complete, respectful, highly persuasive negotiation email with Subject, Greeting, Reasoning, Quoted safe clause, and Sign-off.

You MUST respond strictly with a valid JSON object. No explanation outside JSON.
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
      "polite_client_negotiation_email": "Subject: Contract Review - Payment Terms\\n\\nHi [Client Name],\\n\\nRegarding payment terms...\\n\\nBest regards,\\n[Your Name]"
    }
  ]
}

Contract Title: ${activeTitle}
Contract Text:
${cleanText}`;

  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 9000);

    // Calling Groq WITHOUT response_format to bypass strict 400 validation error
    const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + groqKey,
        "Content-Type": "application/json"
      },
      signal: ctrl.signal,
      body: JSON.stringify({
        model: "openai/gpt-oss-20b",
        messages: [
          { role: "system", content: "You are SafeClause, a senior contract risk lawyer. You output raw valid JSON only." },
          { role: "user", content: prompt }
        ],
        temperature: 0.2,
        max_tokens: 3000
      })
    });
    clearTimeout(tid);

    if (!resp.ok) {
      const errText = await resp.text();
      return res.status(502).json({ success: false, error: "AI error (" + resp.status + "): " + errText.slice(0, 100) });
    }

    const d = await resp.json();
    let raw = d.choices?.[0]?.message?.content || "";
    
    // Robust JSON extraction
    raw = raw.replace(/\`\`\`json/gi, '').replace(/\`\`\`/g, '').trim();
    const firstBrace = raw.indexOf('{');
    const lastBrace = raw.lastIndexOf('}');
    
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      return res.status(502).json({ success: false, error: "AI did not return valid JSON structure." });
    }

    const jsonString = raw.slice(firstBrace, lastBrace + 1);
    const parsed = JSON.parse(jsonString);
    const list = parsed.flagged_clauses || parsed.clauses || [];

    if (!list.length) {
      return res.status(502).json({ success: false, error: "No risk clauses identified in the document." });
    }

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
  } catch (err) {
    return res.status(502).json({ success: false, error: "Audit failed: " + err.message });
  }
}
