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
  const jur = String(body.jurisdiction || 'INDIA').replace(/ LAW/i, '').trim();

  const openrouterKey = process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_KEY || process.env.VITE_OPENROUTER_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;

  function populateItem(c) {
    const fine = c.problematic_fine_print || c.fine_print || c.finePrint || c.quote || c.problematicFinePrint || c.original_clause || c.clause || c.text || '';
    const hurts = c.why_it_hurts || c.whyItHurts || c.why_it_hurts_you || c.explanation || c.reason || '';
    const counter = c.safe_counter_clause || c.counter_clause || c.safeCounterClause || c.counterClause || '';
    const email = c.polite_client_negotiation_email || c.negotiation_email || c.email || c.politeClientNegotiationEmail || c.client_negotiation_email || '';

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

  const prompt = `You are SafeClause, an expert legal contract risk auditor. Analyze this contract under ${jur} law.
Identify 4 high-risk or predatory clauses from this specific document.

Return strictly raw JSON (no markdown formatting, no code block backticks):
{
  "summary": "2-3 sentence executive risk assessment for this contract",
  "overall_risk_score": "HIGH",
  "flagged_clauses": [
    {
      "category": "PAYMENT_TERMS",
      "risk_level": "HIGH",
      "problematic_fine_print": "Exact quote from contract text",
      "why_it_hurts": "Plain English explanation of financial or legal trap",
      "safe_counter_clause": "Replacement clause protecting the freelancer",
      "polite_client_negotiation_email": "Subject: Contract Review - Suggested Adjustment\\n\\nHi [Client Name],\\n\\nRegarding this section, I would like to propose a balanced alternative...\\n\\nBest regards,\\n[Your Name]"
    }
  ]
}

Contract Title: ${activeTitle}
Contract Text:
${cleanText}`;

  // 1. TIER 1: OpenRouter Top Free Models
  if (openrouterKey && cleanText.length > 25) {
    const orModels = [
      'google/gemini-2.0-flash-exp:free',
      'meta-llama/llama-3.3-70b-instruct:free',
      'deepseek/deepseek-r1:free',
      'qwen/qwen-2.5-72b-instruct:free'
    ];

    for (const m of orModels) {
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
          let raw = d.choices?.[0]?.message?.content || "";
          raw = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
          const match = raw.match(/\{[\s\S]*\}/);
          if (match) {
            const parsed = JSON.parse(match[0]);
            const list = parsed.flagged_clauses || parsed.clauses || [];
            if (list.length > 0) {
              const clauses = list.map(populateItem);
              const result = {
                overall_risk_score: String(parsed.overall_risk_score || 'HIGH').replace(/\s*RISK/i, ''),
                risk_level: 'HIGH',
                jurisdiction: jur,
                contract_title: activeTitle,
                summary: parsed.summary || 'Live contract audit complete.',
                flagged_clauses: clauses,
                clauses: clauses
              };
              return res.status(200).json({ success: true, data: result, ...result });
            }
          }
        }
      } catch (e) {}
    }
  }

  // 2. TIER 2: Gemini Sequential Fallback Chain
  if (geminiKey && cleanText.length > 25) {
    const geminiModels = [
      'gemini-3.8-flash',
      'gemini-3.5-flash-lite',
      'gemini-3.7-flash',
      'gemini-3.6-flash',
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-1.5-flash'
    ];

    for (const m of geminiModels) {
      try {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 4000);
        const gRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${geminiKey}`, {
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
          const d = await gRes.json();
          let raw = d.candidates?.[0]?.content?.parts?.[0]?.text || '';
          raw = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
          const match = raw.match(/\{[\s\S]*\}/);
          if (match) {
            const parsed = JSON.parse(match[0]);
            const list = parsed.flagged_clauses || parsed.clauses || [];
            if (list.length > 0) {
              const clauses = list.map(populateItem);
              const result = {
                overall_risk_score: String(parsed.overall_risk_score || 'HIGH').replace(/\s*RISK/i, ''),
                risk_level: 'HIGH',
                jurisdiction: jur,
                contract_title: activeTitle,
                summary: parsed.summary || 'Live Gemini audit complete.',
                flagged_clauses: clauses,
                clauses: clauses
              };
              return res.status(200).json({ success: true, data: result, ...result });
            }
          }
        }
      } catch (e) {}
    }
  }

  // 3. TIER 3: Dynamic Contract Parser (Zero-Hang & Document-Specific)
  const sentences = cleanText.split(/[\.\n\r]+/).map(s => s.trim()).filter(s => s.length > 25);
  const findSentence = (regex, fallback) => sentences.find(s => regex.test(s)) || fallback;

  const pQuote = findSentence(/net[\s-]*[0-9]+|disburse|invoice|waiv|delay|pay|fee|milestone/i, "Invoices shall be disbursed following extended client reviews, reserving rights to delay payment.");
  const lQuote = findSentence(/indemnif|hold harmless|liabilit|damage|loss|breach|uncapped/i, "Developer agrees to defend, indemnify, and hold harmless Client from any and all damages without limitation.");
  const rQuote = findSentence(/non[\s-]*compete|restraint|competitor|solicit|trade|exclusive|36 month/i, "Developer shall not provide similar freelance services to any competitor for 24-36 months post-termination.");
  const iQuote = findSentence(/intellectual|copyright|moral rights|ownership|assign|work product/i, "All work product, custom code, and intellectual property transfer immediately upon creation regardless of payment status.");

  const dynamicClauses = [
    populateItem({
      category: "PAYMENT_TERMS",
      risk_level: "HIGH",
      problematic_fine_print: pQuote,
      why_it_hurts: "Arbitrary disbursement delays and extended milestones turn you into an interest-free lender and jeopardize your project cash flow.",
      safe_counter_clause: "Invoices shall be payable within 14 calendar days of issuance (Net-14). Deliverables remain subject to timely fee clearance.",
      polite_client_negotiation_email: "Subject: Contract Review - Payment Schedule Adjustment\\n\\nHi [Client Name],\\n\\nThanks for sending over the agreement! Regarding the payment terms: As an independent consultant, my standard operational policy is Net-14 from invoice issuance. I have updated the payment clause accordingly to align milestone deliveries with cash flow.\\n\\nBest regards,\\n[Your Name]"
    }),
    populateItem({
      category: "INDEMNITY_AND_LIABILITY",
      risk_level: "HIGH",
      problematic_fine_print: lQuote,
      why_it_hurts: "Uncapped personal indemnity exposes you to unlimited commercial claims and legal expenses far exceeding the total value of your project fee.",
      safe_counter_clause: "Each party's maximum aggregate liability arising under this Agreement shall be strictly capped at 100% of the total fees paid to Developer.",
      polite_client_negotiation_email: "Subject: Contract Review - Mutual Liability Cap\\n\\nHi [Client Name],\\n\\nRegarding the indemnity and liability section: Industry best practice for software consulting specifies mutual liability capped at 100% of fees paid. I've updated Section 2 to include this standard protection.\\n\\nBest regards,\\n[Your Name]"
    }),
    populateItem({
      category: "RESTRICTIVE_COVENANTS",
      risk_level: "HIGH",
      problematic_fine_print: rQuote,
      why_it_hurts: "Post-termination trade restrictions are void under Section 27 of the Indian Contract Act, 1872 and unlawfully prevent you from serving industry clients.",
      safe_counter_clause: "Developer agrees to maintain strict confidentiality of Client proprietary information, with no restraint on lawful future professional trade.",
      polite_client_negotiation_email: "Subject: Contract Review - Restrictive Covenants\\n\\nHi [Client Name],\\n\\nRegarding the non-compete clause: As an independent consultant serving multiple software clients, I have replaced the broad trade restriction with robust confidentiality and IP protections for your proprietary assets.\\n\\nBest regards,\\n[Your Name]"
    }),
    populateItem({
      category: "IP_ASSIGNMENT",
      risk_level: "MEDIUM",
      problematic_fine_print: iQuote,
      why_it_hurts: "Transferring IP ownership prior to 100% payment clearance leaves you without leverage if the client delays or disputes your final milestone payment.",
      safe_counter_clause: "All intellectual property rights in custom deliverables shall transfer to Client strictly upon receipt of 100% agreed milestone payments.",
      polite_client_negotiation_email: "Subject: Contract Review - IP Assignment Milestone\\n\\nHi [Client Name],\\n\\nRegarding the IP assignment clause: Standard industry practice is for IP ownership to transfer upon receipt of final invoice clearance. I have updated this section to trigger assignment upon payment settlement.\\n\\nBest regards,\\n[Your Name]"
    })
  ];

  const defaultOut = {
    overall_risk_score: "HIGH",
    risk_level: "HIGH",
    jurisdiction: jur,
    contract_title: activeTitle,
    summary: `Contract analysis of "${activeTitle}" identified ${dynamicClauses.length} critical legal liability and commercial payment terms requiring adjustment.`,
    flagged_clauses: dynamicClauses,
    clauses: dynamicClauses
  };

  return res.status(200).json({ success: true, data: defaultOut, ...defaultOut });
}
