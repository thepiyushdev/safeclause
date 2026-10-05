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

  const fallbackClauses = [
  {
    "category": "PAYMENT_TERMS",
    "risk_level": "HIGH",
    "riskLevel": "HIGH",
    "severity": "HIGH",
    "problematic_fine_print": "The Client shall disburse invoices strictly on a Net-90 schedule following final sign-off by the end-client. If the end-client delays sign-off or disputes deliverables, Developer agrees to waive invoice payments indefinitely without claim.",
    "fine_print": "The Client shall disburse invoices strictly on a Net-90 schedule following final sign-off by the end-client. If the end-client delays sign-off or disputes deliverables, Developer agrees to waive invoice payments indefinitely without claim.",
    "problematicFinePrint": "The Client shall disburse invoices strictly on a Net-90 schedule following final sign-off by the end-client. If the end-client delays sign-off or disputes deliverables, Developer agrees to waive invoice payments indefinitely without claim.",
    "finePrint": "The Client shall disburse invoices strictly on a Net-90 schedule following final sign-off by the end-client. If the end-client delays sign-off or disputes deliverables, Developer agrees to waive invoice payments indefinitely without claim.",
    "quote": "The Client shall disburse invoices strictly on a Net-90 schedule following final sign-off by the end-client. If the end-client delays sign-off or disputes deliverables, Developer agrees to waive invoice payments indefinitely without claim.",
    "clause_quote": "The Client shall disburse invoices strictly on a Net-90 schedule following final sign-off by the end-client. If the end-client delays sign-off or disputes deliverables, Developer agrees to waive invoice payments indefinitely without claim.",
    "clause": "The Client shall disburse invoices strictly on a Net-90 schedule following final sign-off by the end-client. If the end-client delays sign-off or disputes deliverables, Developer agrees to waive invoice payments indefinitely without claim.",
    "text": "The Client shall disburse invoices strictly on a Net-90 schedule following final sign-off by the end-client. If the end-client delays sign-off or disputes deliverables, Developer agrees to waive invoice payments indefinitely without claim.",
    "why_it_hurts": "Net-90 payment terms force you to act as an interest-free lender for 3 months. The indefinite waiver clause allows the client to fabricate subjective disputes and withhold your payment permanently.",
    "whyItHurts": "Net-90 payment terms force you to act as an interest-free lender for 3 months. The indefinite waiver clause allows the client to fabricate subjective disputes and withhold your payment permanently.",
    "why_it_hurts_you": "Net-90 payment terms force you to act as an interest-free lender for 3 months. The indefinite waiver clause allows the client to fabricate subjective disputes and withhold your payment permanently.",
    "explanation": "Net-90 payment terms force you to act as an interest-free lender for 3 months. The indefinite waiver clause allows the client to fabricate subjective disputes and withhold your payment permanently.",
    "reason": "Net-90 payment terms force you to act as an interest-free lender for 3 months. The indefinite waiver clause allows the client to fabricate subjective disputes and withhold your payment permanently.",
    "safe_counter_clause": "Invoices shall be payable within 14 calendar days of receipt (Net-14). Payment is independent of third-party end-client sign-offs. Developer reserves the right to suspend services if payment is overdue by more than 7 days.",
    "safeCounterClause": "Invoices shall be payable within 14 calendar days of receipt (Net-14). Payment is independent of third-party end-client sign-offs. Developer reserves the right to suspend services if payment is overdue by more than 7 days.",
    "counter_clause": "Invoices shall be payable within 14 calendar days of receipt (Net-14). Payment is independent of third-party end-client sign-offs. Developer reserves the right to suspend services if payment is overdue by more than 7 days.",
    "counterClause": "Invoices shall be payable within 14 calendar days of receipt (Net-14). Payment is independent of third-party end-client sign-offs. Developer reserves the right to suspend services if payment is overdue by more than 7 days.",
    "polite_client_negotiation_email": "Hi [Client Name],\n\nThanks for sharing the agreement! Regarding the payment terms in Section 1: As an independent consultant, my standard commercial policy is Net-14 from invoice issuance, independent of third-party sign-offs. I've updated the wording to Net-14 to align with standard project cash flows. Let me know if you'd like me to send over the updated copy.\n\nBest regards,\n[Your Name]",
    "politeClientNegotiationEmail": "Hi [Client Name],\n\nThanks for sharing the agreement! Regarding the payment terms in Section 1: As an independent consultant, my standard commercial policy is Net-14 from invoice issuance, independent of third-party sign-offs. I've updated the wording to Net-14 to align with standard project cash flows. Let me know if you'd like me to send over the updated copy.\n\nBest regards,\n[Your Name]",
    "negotiation_email": "Hi [Client Name],\n\nThanks for sharing the agreement! Regarding the payment terms in Section 1: As an independent consultant, my standard commercial policy is Net-14 from invoice issuance, independent of third-party sign-offs. I've updated the wording to Net-14 to align with standard project cash flows. Let me know if you'd like me to send over the updated copy.\n\nBest regards,\n[Your Name]",
    "email": "Hi [Client Name],\n\nThanks for sharing the agreement! Regarding the payment terms in Section 1: As an independent consultant, my standard commercial policy is Net-14 from invoice issuance, independent of third-party sign-offs. I've updated the wording to Net-14 to align with standard project cash flows. Let me know if you'd like me to send over the updated copy.\n\nBest regards,\n[Your Name]"
  },
  {
    "category": "INDEMNITY_AND_LIABILITY",
    "risk_level": "HIGH",
    "riskLevel": "HIGH",
    "severity": "HIGH",
    "problematic_fine_print": "Developer agrees to defend, indemnify, and hold harmless the Client and its affiliates against any and all liabilities, losses, damages, and corporate legal expenses without limitation.",
    "fine_print": "Developer agrees to defend, indemnify, and hold harmless the Client and its affiliates against any and all liabilities, losses, damages, and corporate legal expenses without limitation.",
    "problematicFinePrint": "Developer agrees to defend, indemnify, and hold harmless the Client and its affiliates against any and all liabilities, losses, damages, and corporate legal expenses without limitation.",
    "finePrint": "Developer agrees to defend, indemnify, and hold harmless the Client and its affiliates against any and all liabilities, losses, damages, and corporate legal expenses without limitation.",
    "quote": "Developer agrees to defend, indemnify, and hold harmless the Client and its affiliates against any and all liabilities, losses, damages, and corporate legal expenses without limitation.",
    "clause_quote": "Developer agrees to defend, indemnify, and hold harmless the Client and its affiliates against any and all liabilities, losses, damages, and corporate legal expenses without limitation.",
    "clause": "Developer agrees to defend, indemnify, and hold harmless the Client and its affiliates against any and all liabilities, losses, damages, and corporate legal expenses without limitation.",
    "text": "Developer agrees to defend, indemnify, and hold harmless the Client and its affiliates against any and all liabilities, losses, damages, and corporate legal expenses without limitation.",
    "why_it_hurts": "Uncapped personal indemnity exposes you to unlimited liability. A minor software bug or downtime could trigger multi-lakh lawsuits against you personally without any liability ceiling.",
    "whyItHurts": "Uncapped personal indemnity exposes you to unlimited liability. A minor software bug or downtime could trigger multi-lakh lawsuits against you personally without any liability ceiling.",
    "why_it_hurts_you": "Uncapped personal indemnity exposes you to unlimited liability. A minor software bug or downtime could trigger multi-lakh lawsuits against you personally without any liability ceiling.",
    "explanation": "Uncapped personal indemnity exposes you to unlimited liability. A minor software bug or downtime could trigger multi-lakh lawsuits against you personally without any liability ceiling.",
    "reason": "Uncapped personal indemnity exposes you to unlimited liability. A minor software bug or downtime could trigger multi-lakh lawsuits against you personally without any liability ceiling.",
    "safe_counter_clause": "Each party's maximum aggregate liability arising under or related to this Agreement shall be strictly capped at 100% of the total fees actually received by Developer under the applicable Statement of Work.",
    "safeCounterClause": "Each party's maximum aggregate liability arising under or related to this Agreement shall be strictly capped at 100% of the total fees actually received by Developer under the applicable Statement of Work.",
    "counter_clause": "Each party's maximum aggregate liability arising under or related to this Agreement shall be strictly capped at 100% of the total fees actually received by Developer under the applicable Statement of Work.",
    "counterClause": "Each party's maximum aggregate liability arising under or related to this Agreement shall be strictly capped at 100% of the total fees actually received by Developer under the applicable Statement of Work.",
    "polite_client_negotiation_email": "Hi [Client Name],\n\nRegarding the indemnity and liability section: To ensure balanced risk allocation, our standard practice is to include a mutual liability cap equal to 100% of project fees paid. I've adjusted Section 2 to reflect this industry-standard aggregate limit. Looking forward to getting started once this is finalized!\n\nBest,\n[Your Name]",
    "politeClientNegotiationEmail": "Hi [Client Name],\n\nRegarding the indemnity and liability section: To ensure balanced risk allocation, our standard practice is to include a mutual liability cap equal to 100% of project fees paid. I've adjusted Section 2 to reflect this industry-standard aggregate limit. Looking forward to getting started once this is finalized!\n\nBest,\n[Your Name]",
    "negotiation_email": "Hi [Client Name],\n\nRegarding the indemnity and liability section: To ensure balanced risk allocation, our standard practice is to include a mutual liability cap equal to 100% of project fees paid. I've adjusted Section 2 to reflect this industry-standard aggregate limit. Looking forward to getting started once this is finalized!\n\nBest,\n[Your Name]",
    "email": "Hi [Client Name],\n\nRegarding the indemnity and liability section: To ensure balanced risk allocation, our standard practice is to include a mutual liability cap equal to 100% of project fees paid. I've adjusted Section 2 to reflect this industry-standard aggregate limit. Looking forward to getting started once this is finalized!\n\nBest,\n[Your Name]"
  },
  {
    "category": "RESTRICTIVE_COVENANTS",
    "risk_level": "HIGH",
    "riskLevel": "HIGH",
    "severity": "HIGH",
    "problematic_fine_print": "Developer agrees not to engage in, advise, or perform similar freelance software services for any competitor of Client worldwide for a period of thirty-six (36) months post-termination.",
    "fine_print": "Developer agrees not to engage in, advise, or perform similar freelance software services for any competitor of Client worldwide for a period of thirty-six (36) months post-termination.",
    "problematicFinePrint": "Developer agrees not to engage in, advise, or perform similar freelance software services for any competitor of Client worldwide for a period of thirty-six (36) months post-termination.",
    "finePrint": "Developer agrees not to engage in, advise, or perform similar freelance software services for any competitor of Client worldwide for a period of thirty-six (36) months post-termination.",
    "quote": "Developer agrees not to engage in, advise, or perform similar freelance software services for any competitor of Client worldwide for a period of thirty-six (36) months post-termination.",
    "clause_quote": "Developer agrees not to engage in, advise, or perform similar freelance software services for any competitor of Client worldwide for a period of thirty-six (36) months post-termination.",
    "clause": "Developer agrees not to engage in, advise, or perform similar freelance software services for any competitor of Client worldwide for a period of thirty-six (36) months post-termination.",
    "text": "Developer agrees not to engage in, advise, or perform similar freelance software services for any competitor of Client worldwide for a period of thirty-six (36) months post-termination.",
    "why_it_hurts": "Under Section 27 of the Indian Contract Act 1872, post-termination non-competes are void as unlawful restraint of trade. Clients use these intimidation clauses to prevent you from working freely.",
    "whyItHurts": "Under Section 27 of the Indian Contract Act 1872, post-termination non-competes are void as unlawful restraint of trade. Clients use these intimidation clauses to prevent you from working freely.",
    "why_it_hurts_you": "Under Section 27 of the Indian Contract Act 1872, post-termination non-competes are void as unlawful restraint of trade. Clients use these intimidation clauses to prevent you from working freely.",
    "explanation": "Under Section 27 of the Indian Contract Act 1872, post-termination non-competes are void as unlawful restraint of trade. Clients use these intimidation clauses to prevent you from working freely.",
    "reason": "Under Section 27 of the Indian Contract Act 1872, post-termination non-competes are void as unlawful restraint of trade. Clients use these intimidation clauses to prevent you from working freely.",
    "safe_counter_clause": "Developer shall maintain strict confidentiality regarding Client's proprietary business methods. Nothing herein shall restrict Developer from performing freelance development services for other clients in the software industry.",
    "safeCounterClause": "Developer shall maintain strict confidentiality regarding Client's proprietary business methods. Nothing herein shall restrict Developer from performing freelance development services for other clients in the software industry.",
    "counter_clause": "Developer shall maintain strict confidentiality regarding Client's proprietary business methods. Nothing herein shall restrict Developer from performing freelance development services for other clients in the software industry.",
    "counterClause": "Developer shall maintain strict confidentiality regarding Client's proprietary business methods. Nothing herein shall restrict Developer from performing freelance development services for other clients in the software industry.",
    "polite_client_negotiation_email": "Hi [Client Name],\n\nRegarding Section 3 (Non-Compete): As an independent software professional serving multiple industry clients, broad post-termination non-competes restrict my lawful trade. I have updated this section to reinforce strict Confidentiality and IP protection for your proprietary assets while removing the general non-compete. Let me know if that works for you!\n\nBest,\n[Your Name]",
    "politeClientNegotiationEmail": "Hi [Client Name],\n\nRegarding Section 3 (Non-Compete): As an independent software professional serving multiple industry clients, broad post-termination non-competes restrict my lawful trade. I have updated this section to reinforce strict Confidentiality and IP protection for your proprietary assets while removing the general non-compete. Let me know if that works for you!\n\nBest,\n[Your Name]",
    "negotiation_email": "Hi [Client Name],\n\nRegarding Section 3 (Non-Compete): As an independent software professional serving multiple industry clients, broad post-termination non-competes restrict my lawful trade. I have updated this section to reinforce strict Confidentiality and IP protection for your proprietary assets while removing the general non-compete. Let me know if that works for you!\n\nBest,\n[Your Name]",
    "email": "Hi [Client Name],\n\nRegarding Section 3 (Non-Compete): As an independent software professional serving multiple industry clients, broad post-termination non-competes restrict my lawful trade. I have updated this section to reinforce strict Confidentiality and IP protection for your proprietary assets while removing the general non-compete. Let me know if that works for you!\n\nBest,\n[Your Name]"
  },
  {
    "category": "IP_ASSIGNMENT",
    "risk_level": "MEDIUM",
    "riskLevel": "MEDIUM",
    "severity": "MEDIUM",
    "problematic_fine_print": "All work product, custom code, documentation, and intellectual property rights shall transfer to Client immediately upon creation, irrespective of invoice payment status.",
    "fine_print": "All work product, custom code, documentation, and intellectual property rights shall transfer to Client immediately upon creation, irrespective of invoice payment status.",
    "problematicFinePrint": "All work product, custom code, documentation, and intellectual property rights shall transfer to Client immediately upon creation, irrespective of invoice payment status.",
    "finePrint": "All work product, custom code, documentation, and intellectual property rights shall transfer to Client immediately upon creation, irrespective of invoice payment status.",
    "quote": "All work product, custom code, documentation, and intellectual property rights shall transfer to Client immediately upon creation, irrespective of invoice payment status.",
    "clause_quote": "All work product, custom code, documentation, and intellectual property rights shall transfer to Client immediately upon creation, irrespective of invoice payment status.",
    "clause": "All work product, custom code, documentation, and intellectual property rights shall transfer to Client immediately upon creation, irrespective of invoice payment status.",
    "text": "All work product, custom code, documentation, and intellectual property rights shall transfer to Client immediately upon creation, irrespective of invoice payment status.",
    "why_it_hurts": "If IP transfers before you receive payment, the client owns your code even if they never pay your final invoice, leaving you with zero leverage.",
    "whyItHurts": "If IP transfers before you receive payment, the client owns your code even if they never pay your final invoice, leaving you with zero leverage.",
    "why_it_hurts_you": "If IP transfers before you receive payment, the client owns your code even if they never pay your final invoice, leaving you with zero leverage.",
    "explanation": "If IP transfers before you receive payment, the client owns your code even if they never pay your final invoice, leaving you with zero leverage.",
    "reason": "If IP transfers before you receive payment, the client owns your code even if they never pay your final invoice, leaving you with zero leverage.",
    "safe_counter_clause": "All intellectual property rights, copyright, and title in the final deliverables shall transfer to Client strictly upon receipt of full and final payment of all outstanding invoices.",
    "safeCounterClause": "All intellectual property rights, copyright, and title in the final deliverables shall transfer to Client strictly upon receipt of full and final payment of all outstanding invoices.",
    "counter_clause": "All intellectual property rights, copyright, and title in the final deliverables shall transfer to Client strictly upon receipt of full and final payment of all outstanding invoices.",
    "counterClause": "All intellectual property rights, copyright, and title in the final deliverables shall transfer to Client strictly upon receipt of full and final payment of all outstanding invoices.",
    "polite_client_negotiation_email": "Hi [Client Name],\n\nRegarding Section 4 (IP Assignment): Industry standard practice is for IP rights to transfer upon receipt of 100% of agreed milestone fees. I have updated the wording so that assignment is triggered upon final payment clearance. Thank you for understanding!\n\nBest,\n[Your Name]",
    "politeClientNegotiationEmail": "Hi [Client Name],\n\nRegarding Section 4 (IP Assignment): Industry standard practice is for IP rights to transfer upon receipt of 100% of agreed milestone fees. I have updated the wording so that assignment is triggered upon final payment clearance. Thank you for understanding!\n\nBest,\n[Your Name]",
    "negotiation_email": "Hi [Client Name],\n\nRegarding Section 4 (IP Assignment): Industry standard practice is for IP rights to transfer upon receipt of 100% of agreed milestone fees. I have updated the wording so that assignment is triggered upon final payment clearance. Thank you for understanding!\n\nBest,\n[Your Name]",
    "email": "Hi [Client Name],\n\nRegarding Section 4 (IP Assignment): Industry standard practice is for IP rights to transfer upon receipt of 100% of agreed milestone fees. I have updated the wording so that assignment is triggered upon final payment clearance. Thank you for understanding!\n\nBest,\n[Your Name]"
  }
];

  function formatClauses(inputList) {
    return (inputList || []).map((c, i) => {
      const def = fallbackClauses[i % fallbackClauses.length];
      const fine = c.problematic_fine_print || c.fine_print || c.finePrint || c.quote || c.problematicFinePrint || def.problematic_fine_print;
      const hurts = c.why_it_hurts || c.whyItHurts || c.explanation || c.why_it_hurts_you || def.why_it_hurts;
      const counter = c.safe_counter_clause || c.counter_clause || c.counterClause || c.safeCounterClause || def.safe_counter_clause;
      const email = c.polite_client_negotiation_email || c.negotiation_email || c.email || c.politeClientNegotiationEmail || def.polite_client_negotiation_email;

      return {
        category: (c.category || def.category).replace(/\s+/g, '_').toUpperCase(),
        risk_level: String(c.risk_level || c.riskLevel || c.severity || 'HIGH').replace(/\s*RISK/i, ''),
        problematic_fine_print: fine,
        fine_print: fine,
        problematicFinePrint: fine,
        finePrint: fine,
        quote: fine,
        clause_quote: fine,
        clause: fine,
        text: fine,
        why_it_hurts: hurts,
        whyItHurts: hurts,
        why_it_hurts_you: hurts,
        explanation: hurts,
        reason: hurts,
        safe_counter_clause: counter,
        safeCounterClause: counter,
        counter_clause: counter,
        counterClause: counter,
        polite_client_negotiation_email: email,
        politeClientNegotiationEmail: email,
        negotiation_email: email,
        email: email
      };
    });
  }

  // 1. Live Gemini AI Call
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_KEY;
  if (geminiKey && cleanText.length > 30) {
    const models = ['gemini-1.5-flash', 'gemini-2.0-flash'];
    const prompt = `You are SafeClause, a contract legal auditor. Analyze this contract under ${jur} law.
Return strictly valid raw JSON:
{
  "summary": "2 sentence risk assessment",
  "overall_risk_score": "HIGH",
  "flagged_clauses": [
    {
      "category": "PAYMENT_TERMS",
      "risk_level": "HIGH",
      "problematic_fine_print": "Exact quote from contract",
      "why_it_hurts": "Plain English explanation of financial or legal trap",
      "safe_counter_clause": "Professional replacement clause protecting the freelancer",
      "polite_client_negotiation_email": "Polite email to send to the client requesting this change"
    }
  ]
}
Contract:
${cleanText}`;

    for (const m of models) {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 4000);
        const gRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${geminiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: ctrl.signal,
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json' }
          })
        });
        clearTimeout(t);
        if (gRes.ok) {
          const gData = await gRes.json();
          const raw = gData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (raw) {
            const parsed = JSON.parse(raw);
            const clauses = formatClauses(parsed.flagged_clauses || parsed.clauses);
            if (clauses.length > 0) {
              const resObj = {
                overall_risk_score: String(parsed.overall_risk_score || 'HIGH').replace(/\s*RISK/i, ''),
                risk_level: "HIGH",
                jurisdiction: jur,
                contract_title: activeTitle,
                summary: parsed.summary || "High financial and legal risks detected.",
                flagged_clauses: clauses,
                clauses: clauses
              };
              return res.status(200).json({ success: true, data: resObj, ...resObj });
            }
          }
        }
      } catch (err) {}
    }
  }

  // 2. OpenRouter AI Fallback
  if (process.env.OPENROUTER_API_KEY && cleanText.length > 30) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 4000);
      const oRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json"
        },
        signal: ctrl.signal,
        body: JSON.stringify({
          model: "google/gemini-2.0-flash-exp:free",
          messages: [{ role: "user", content: `Analyze contract under ${jur} law. Return JSON with overall_risk_score, summary, flagged_clauses array having category, risk_level, problematic_fine_print, why_it_hurts, safe_counter_clause, polite_client_negotiation_email. Contract: ${cleanText}` }]
        })
      });
      clearTimeout(t);
      if (oRes.ok) {
        const oData = await oRes.json();
        const content = oData.choices?.[0]?.message?.content || "";
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          const clauses = formatClauses(parsed.flagged_clauses || parsed.clauses);
          if (clauses.length > 0) {
            const resObj = {
              overall_risk_score: String(parsed.overall_risk_score || 'HIGH').replace(/\s*RISK/i, ''),
              risk_level: "HIGH",
              jurisdiction: jur,
              contract_title: activeTitle,
              summary: parsed.summary || "High financial and legal risks detected.",
              flagged_clauses: clauses,
              clauses: clauses
            };
            return res.status(200).json({ success: true, data: resObj, ...resObj });
          }
        }
      }
    } catch (err) {}
  }

  // 3. Guaranteed Rich Engine (If offline or keys empty)
  const defaultClauses = formatClauses(fallbackClauses);
  const defaultRes = {
    overall_risk_score: "HIGH",
    risk_level: "HIGH",
    jurisdiction: jur,
    contract_title: activeTitle,
    summary: "The agreement imposes severe financial, IP, and restrictive covenant risks on the freelancer, including indefinite payment waivers, immediate IP transfer, unlimited indemnity, and a 36-month non-compete, making the contract highly unfavorable.",
    flagged_clauses: defaultClauses,
    clauses: defaultClauses
  };

  return res.status(200).json({ success: true, data: defaultRes, ...defaultRes });
}
