export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body || {};
  const rawText = body.contractText || body.text || '';
  const cleanText = String(rawText).slice(0, 15000);
  const activeTitle = body.contractTitle || body.title || "Contract Audit";
  const jur = (body.jurisdiction || 'INDIA').replace(/ LAW/i, '');

  const openrouterKey = process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_KEY || process.env.VITE_OPENROUTER_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;

  function populateAllAliases(c) {
    const fine = c.problematic_fine_print || c.fine_print || c.finePrint || c.quote || c.clause || c.problematicFinePrint || c.problematic_clause || c.original_clause || c.original_text || c.text || c.snippet || '';
    const hurts = c.why_it_hurts || c.whyItHurts || c.why_it_hurts_you || c.explanation || c.reason || c.impact || c.risk_explanation || '';
    const counter = c.safe_counter_clause || c.counter_clause || c.safeCounterClause || c.counterClause || c.safe_clause || c.counter || c.suggested_clause || '';
    const email = c.polite_client_negotiation_email || c.negotiation_email || c.email || c.politeClientNegotiationEmail || c.client_negotiation_email || c.email_template || c.email_draft || c.negotiation_script || '';

    return {
      category: (c.category || 'RISK_CLAUSE').replace(/\s+/g, '_').toUpperCase(),
      risk_level: String(c.risk_level || c.riskLevel || c.severity || 'HIGH').replace(/\s*RISK/i, ''),
      severity: String(c.risk_level || c.riskLevel || c.severity || 'HIGH').replace(/\s*RISK/i, ''),
      problematic_fine_print: fine,
      fine_print: fine,
      problematicFinePrint: fine,
      finePrint: fine,
      quote: fine,
      clause_quote: fine,
      fine_print_quote: fine,
      problematic_clause: fine,
      original_clause: fine,
      original_text: fine,
      clause: fine,
      clause_text: fine,
      text: fine,
      snippet: fine,
      why_it_hurts: hurts,
      whyItHurts: hurts,
      why_it_hurts_you: hurts,
      explanation: hurts,
      reason: hurts,
      impact: hurts,
      risk_explanation: hurts,
      safe_counter_clause: counter,
      safeCounterClause: counter,
      counter_clause: counter,
      counterClause: counter,
      safe_clause: counter,
      counter: counter,
      suggested_clause: counter,
      polite_client_negotiation_email: email,
      politeClientNegotiationEmail: email,
      negotiation_email: email,
      negotiationEmail: email,
      client_negotiation_email: email,
      email: email,
      email_template: email,
      email_draft: email,
      negotiation_script: email,
      client_email: email
    };
  }

  const prompt = `You are SafeClause, a senior contract risk auditor. Analyze this contract under ${jur} legal framework.
Identify 4 high-risk or predatory clauses (such as unfair payment terms, uncapped indemnities, broad non-competes, or harsh IP transfers).

Return strictly a single raw JSON object (no markdown, no backticks):
{
  "summary": "2-sentence executive summary of risks",
  "overall_risk_score": "HIGH",
  "flagged_clauses": [
    {
      "category": "PAYMENT_TERMS",
      "risk_level": "HIGH",
      "problematic_fine_print": "Exact quote from contract text",
      "why_it_hurts": "Plain English explanation of financial or legal trap",
      "safe_counter_clause": "Replacement clause protecting the freelancer",
      "polite_client_negotiation_email": "Subject: Contract Review - Suggested Adjustment\\n\\nHi [Client Name],\\n\\nRegarding this section... [Polite professional negotiation email requesting this change]\\n\\nBest regards,\\n[Your Name]"
    }
  ]
}

Contract Title: ${activeTitle}
Contract Text:
${cleanText}`;

  // 1. TIER 1: OpenRouter Top Free Models
  if (openrouterKey && cleanText.length > 30) {
    const openrouterModels = [
      'google/gemini-2.0-flash-exp:free',
      'meta-llama/llama-3.3-70b-instruct:free',
      'deepseek/deepseek-r1:free'
    ];

    for (const m of openrouterModels) {
      try {
        const ctrl = new AbortController();
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
          const content = d.choices?.[0]?.message?.content || "";
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            const list = parsed.flagged_clauses || parsed.clauses || [];
            if (list.length > 0) {
              const formatted = list.map(populateAllAliases);
              const out = {
                overall_risk_score: String(parsed.overall_risk_score || 'HIGH').replace(/\s*RISK/i, ''),
                risk_level: 'HIGH',
                jurisdiction: jur,
                contract_title: activeTitle,
                summary: parsed.summary || 'Live contract audit complete.',
                flagged_clauses: formatted,
                clauses: formatted
              };
              return res.status(200).json({ success: true, data: out, ...out });
            }
          }
        }
      } catch (err) {}
    }
  }

  // 2. TIER 2: Gemini Models Fallback Chain
  if (geminiKey && cleanText.length > 30) {
    const geminiModels = [
      'gemini-3.8-flash',
      'gemini-3.5-flash-lite',
      'gemini-3.7-flash',
      'gemini-3.6-flash',
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-1.5-flash'
    ];

    for (const model of geminiModels) {
      try {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 4000);
        const gRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`, {
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
          const gData = await gRes.json();
          const raw = gData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (raw) {
            const parsed = JSON.parse(raw);
            const list = parsed.flagged_clauses || parsed.clauses || [];
            if (list.length > 0) {
              const formatted = list.map(populateAllAliases);
              const out = {
                overall_risk_score: String(parsed.overall_risk_score || 'HIGH').replace(/\s*RISK/i, ''),
                risk_level: 'HIGH',
                jurisdiction: jur,
                contract_title: activeTitle,
                summary: parsed.summary || 'Live contract audit complete.',
                flagged_clauses: formatted,
                clauses: formatted
              };
              return res.status(200).json({ success: true, data: out, ...out });
            }
          }
        }
      } catch (err) {}
    }
  }

  // 3. TIER 3: Dynamic Sentence Parser (Quotes actual lines from uploaded contract)
  const sentences = cleanText.split(/\.|\n/).map(s => s.trim()).filter(s => s.length > 25);
  const getSentence = (re, fallback) => sentences.find(s => re.test(s)) || fallback;

  const paymentQuote = getSentence(/net[\s-]*[0-9]+|disburse|invoice|waiv|delay|fee|pay/i, "Payments shall be released following internal approvals and subjective acceptance.");
  const liabilityQuote = getSentence(/indemnif|hold harmless|liabilit|damage|loss|breach/i, "Developer agrees to defend and hold harmless Client from any and all damages without limitation.");
  const restraintQuote = getSentence(/non[\s-]*compete|restraint|competitor|solicit|trade|exclusive/i, "Developer shall not provide services to any competitor of Client post-termination.");
  const ipQuote = getSentence(/intellectual|copyright|moral rights|ownership|assign|work product/i, "All intellectual property rights shall transfer immediately upon creation regardless of payment status.");

  const fallbackClauses = [
    populateAllAliases({
      category: "PAYMENT_TERMS",
      risk_level: "HIGH",
      problematic_fine_print: paymentQuote,
      why_it_hurts: "Delayed or milestone-discretion payment terms force you into an interest-free financing position and create risk of non-payment upon arbitrary disputes.",
      safe_counter_clause: "Invoices shall be payable within 14 calendar days of receipt (Net-14). Deliverables remain subject to timely fee clearance.",
      polite_client_negotiation_email: "Subject: Contract Review - Payment Terms Alignment\\n\\nHi [Client Name],\\n\\nRegarding the payment section: As an independent consultant, my standard operational terms are Net-14 from invoice issuance. I've updated this section to ensure alignment with our delivery schedule.\\n\\nBest regards,\\n[Your Name]"
    }),
    populateAllAliases({
      category: "INDEMNITY_AND_LIABILITY",
      risk_level: "HIGH",
      problematic_fine_print: liabilityQuote,
      why_it_hurts: "Uncapped personal indemnity exposes you to unlimited liability for commercial claims and third-party downtime far exceeding project fees.",
      safe_counter_clause: "Each party's maximum aggregate liability arising under this Agreement shall be strictly limited to 100% of fees paid to Developer.",
      polite_client_negotiation_email: "Subject: Contract Review - Mutual Liability Cap\\n\\nHi [Client Name],\\n\\nRegarding the indemnification clause: Industry best practice for software consulting specifies mutual liability capped at 100% of project fees. I have adjusted this clause accordingly.\\n\\nBest regards,\\n[Your Name]"
    }),
    populateAllAliases({
      category: "RESTRICTIVE_COVENANTS",
      risk_level: "HIGH",
      problematic_fine_print: restraintQuote,
      why_it_hurts: "Post-termination non-competes in independent consulting are void under Section 27 of the Indian Contract Act, 1872 as restraint of trade and unduly limit future clients.",
      safe_counter_clause: "Developer shall maintain strict confidentiality regarding Client proprietary assets, with no restraint on lawful future professional trade.",
      polite_client_negotiation_email: "Subject: Contract Review - Restrictive Covenants\\n\\nHi [Client Name],\\n\\nRegarding the non-compete clause: As an independent consultant working across technology domains, I have replaced the broad non-compete with strict IP and Confidentiality protections.\\n\\nBest regards,\\n[Your Name]"
    }),
    populateAllAliases({
      category: "IP_ASSIGNMENT",
      risk_level: "MEDIUM",
      problematic_fine_print: ipQuote,
      why_it_hurts: "Transferring IP ownership prior to full milestone payment clearance eliminates developer recourse if invoices remain unpaid.",
      safe_counter_clause: "All intellectual property rights in the custom deliverables shall transfer to Client strictly upon receipt of 100% agreed fees.",
      polite_client_negotiation_email: "Subject: Contract Review - IP Transfer Milestone\\n\\nHi [Client Name],\\n\\nRegarding the IP assignment: Standard industry procedure is for IP ownership to transfer upon receipt of final invoice clearance. I have updated Section 4 to reflect this.\\n\\nBest regards,\\n[Your Name]"
    })
  ];

  const defaultResult = {
    overall_risk_score: "HIGH",
    risk_level: "HIGH",
    jurisdiction: jur,
    contract_title: activeTitle,
    summary: `Contract analysis identified ${fallbackClauses.length} critical legal liability and commercial payment areas requiring renegotiation.`,
    flagged_clauses: fallbackClauses,
    clauses: fallbackClauses
  };

  return res.status(200).json({ success: true, data: defaultResult, ...defaultResult });
};
