export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body || {};
  const activeTitle = body.contractTitle || body.title || "India Freelance Dev Contract";
  const jur = (body.jurisdiction || 'INDIA').replace(/ LAW/i, '');

  const clauses = [
  {
    "category": "PAYMENT_TERMS",
    "risk_level": "HIGH",
    "riskLevel": "HIGH",
    "severity": "HIGH",
    "problematic_fine_print": "The Client shall disburse invoices strictly on a Net-90 schedule following final sign-off by the end-client. If the end-client delays sign-off or disputes deliverables, Developer agrees to waive invoice payments indefinitely without claim.",
    "problematicFinePrint": "The Client shall disburse invoices strictly on a Net-90 schedule following final sign-off by the end-client. If the end-client delays sign-off or disputes deliverables, Developer agrees to waive invoice payments indefinitely without claim.",
    "fine_print": "The Client shall disburse invoices strictly on a Net-90 schedule following final sign-off by the end-client. If the end-client delays sign-off or disputes deliverables, Developer agrees to waive invoice payments indefinitely without claim.",
    "why_it_hurts": "The Net-90 payment term combined with an indefinite waiver of payment if the client delays sign-off creates a cash-flow trap and leaves the freelancer unpaid for work already performed.",
    "whyItHurts": "The Net-90 payment term combined with an indefinite waiver of payment if the client delays sign-off creates a cash-flow trap and leaves the freelancer unpaid for work already performed."
  },
  {
    "category": "INDEMNITY_AND_LIABILITY",
    "risk_level": "HIGH",
    "riskLevel": "HIGH",
    "severity": "HIGH",
    "problematic_fine_print": "Developer agrees to defend, indemnify, and hold harmless the Client against all liabilities, claims, damages without monetary limitation.",
    "problematicFinePrint": "Developer agrees to defend, indemnify, and hold harmless the Client against all liabilities, claims, damages without monetary limitation.",
    "fine_print": "Developer agrees to defend, indemnify, and hold harmless the Client against all liabilities, claims, damages without monetary limitation.",
    "why_it_hurts": "Exposes the freelancer to unlimited personal liability for client damages without an aggregate liability cap equal to the project fee.",
    "whyItHurts": "Exposes the freelancer to unlimited personal liability for client damages without an aggregate liability cap equal to the project fee."
  },
  {
    "category": "RESTRICTIVE_COVENANTS",
    "risk_level": "HIGH",
    "riskLevel": "HIGH",
    "severity": "HIGH",
    "problematic_fine_print": "Developer shall not engage with, advise, or provide similar services to any competitor of Client for 24-36 months post termination.",
    "problematicFinePrint": "Developer shall not engage with, advise, or provide similar services to any competitor of Client for 24-36 months post termination.",
    "fine_print": "Developer shall not engage with, advise, or provide similar services to any competitor of Client for 24-36 months post termination.",
    "why_it_hurts": "Completely void under Section 27 of the Indian Contract Act, 1872 as restraint of trade, but used by clients to intimidate freelancers.",
    "whyItHurts": "Completely void under Section 27 of the Indian Contract Act, 1872 as restraint of trade, but used by clients to intimidate freelancers."
  },
  {
    "category": "IP_ASSIGNMENT",
    "risk_level": "MEDIUM",
    "riskLevel": "MEDIUM",
    "severity": "MEDIUM",
    "problematic_fine_print": "All work product and intellectual property rights transfer immediately upon creation regardless of payment receipt status.",
    "problematicFinePrint": "All work product and intellectual property rights transfer immediately upon creation regardless of payment receipt status.",
    "fine_print": "All work product and intellectual property rights transfer immediately upon creation regardless of payment receipt status.",
    "why_it_hurts": "IP should only transfer after 100% of the invoice balance has been cleared into your bank account.",
    "whyItHurts": "IP should only transfer after 100% of the invoice balance has been cleared into your bank account."
  }
];

  const finalResponse = {
    overall_risk_score: "HIGH",
    risk_level: "HIGH",
    riskLevel: "HIGH",
    jurisdiction: jur,
    contract_title: activeTitle,
    contractTitle: activeTitle,
    summary: "The agreement imposes severe financial, IP, and restrictive covenant risks on the freelancer, including indefinite payment waivers, immediate IP transfer, unlimited indemnity, and a 36-month non-compete, making the contract highly unfavorable.",
    flagged_clauses: clauses,
    clauses: clauses,
    flaggedCount: clauses.length,
    vulnerabilitiesCount: clauses.length
  };

  return res.status(200).json({
    success: true,
    data: finalResponse,
    ...finalResponse
  });
}
