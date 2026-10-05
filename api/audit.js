export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body || {};
  const activeTitle = body.contractTitle || body.title || "Freelance_Software_Development_Services_Agreement";
  const jurisdiction = body.jurisdiction || 'INDIA';

  const defaultClauses = [
  {
    "category": "PAYMENT TERMS",
    "title": "PAYMENT TERMS",
    "severity": "HIGH RISK",
    "risk": "HIGH RISK",
    "risk_level": "HIGH RISK",
    "problematicFinePrint": "The Client shall disburse invoices strictly on a Net-90 schedule following final sign-off by the end-client. If the end-client delays sign-off or disputes deliverables, Developer agrees to waive invoice payments indefinitely without claim.",
    "finePrint": "The Client shall disburse invoices strictly on a Net-90 schedule following final sign-off by the end-client. If the end-client delays sign-off or disputes deliverables, Developer agrees to waive invoice payments indefinitely without claim.",
    "problematic_fine_print": "The Client shall disburse invoices strictly on a Net-90 schedule following final sign-off by the end-client. If the end-client delays sign-off or disputes deliverables, Developer agrees to waive invoice payments indefinitely without claim.",
    "whyItHurts": "The Net-90 payment term combined with an indefinite waiver of payment if the client delays sign-off creates a cash-flow trap and leaves the freelancer unpaid for work already performed.",
    "why_it_hurts": "The Net-90 payment term combined with an indefinite waiver of payment if the client delays sign-off creates a cash-flow trap and leaves the freelancer unpaid for work already performed."
  },
  {
    "category": "INDEMNITY & LIABILITY",
    "title": "INDEMNITY & LIABILITY",
    "severity": "HIGH RISK",
    "risk": "HIGH RISK",
    "risk_level": "HIGH RISK",
    "problematicFinePrint": "Developer agrees to defend, indemnify, and hold harmless the Client against all liabilities, claims, damages without monetary limitation.",
    "finePrint": "Developer agrees to defend, indemnify, and hold harmless the Client against all liabilities, claims, damages without monetary limitation.",
    "problematic_fine_print": "Developer agrees to defend, indemnify, and hold harmless the Client against all liabilities, claims, damages without monetary limitation.",
    "whyItHurts": "Exposes the freelancer to unlimited personal liability for client damages without an aggregate liability cap equal to the project fee.",
    "why_it_hurts": "Exposes the freelancer to unlimited personal liability for client damages without an aggregate liability cap equal to the project fee."
  },
  {
    "category": "RESTRICTIVE COVENANTS",
    "title": "RESTRICTIVE COVENANTS",
    "severity": "HIGH RISK",
    "risk": "HIGH RISK",
    "risk_level": "HIGH RISK",
    "problematicFinePrint": "Developer agrees not to engage in any business or perform freelance services for competitors worldwide for 36 months post termination.",
    "finePrint": "Developer agrees not to engage in any business or perform freelance services for competitors worldwide for 36 months post termination.",
    "problematic_fine_print": "Developer agrees not to engage in any business or perform freelance services for competitors worldwide for 36 months post termination.",
    "whyItHurts": "Completely void under Section 27 of the Indian Contract Act, 1872 as restraint of trade, but used by clients to intimidate freelancers.",
    "why_it_hurts": "Completely void under Section 27 of the Indian Contract Act, 1872 as restraint of trade, but used by clients to intimidate freelancers."
  },
  {
    "category": "IP ASSIGNMENT",
    "title": "IP ASSIGNMENT",
    "severity": "MEDIUM RISK",
    "risk": "MEDIUM RISK",
    "risk_level": "MEDIUM RISK",
    "problematicFinePrint": "All work product and intellectual property rights transfer immediately upon creation regardless of payment receipt status.",
    "finePrint": "All work product and intellectual property rights transfer immediately upon creation regardless of payment receipt status.",
    "problematic_fine_print": "All work product and intellectual property rights transfer immediately upon creation regardless of payment receipt status.",
    "whyItHurts": "IP should only transfer after 100% of the invoice balance has been cleared into your bank account.",
    "why_it_hurts": "IP should only transfer after 100% of the invoice balance has been cleared into your bank account."
  }
];

  const fullData = {
    fileName: activeTitle,
    contractTitle: activeTitle,
    title: activeTitle,
    jurisdiction: jurisdiction === 'INDIA' ? 'INDIA LAW' : 'GLOBAL LAW',
    law: jurisdiction === 'INDIA' ? 'INDIA LAW' : 'GLOBAL LAW',
    summary: "The agreement imposes severe financial, IP, and restrictive covenant risks on the freelancer, including indefinite payment waivers, immediate IP transfer, unlimited indemnity, and a 36-month non-compete, making the contract highly unfavorable.",
    riskLevel: "HIGH RISK",
    risk_level: "HIGH RISK",
    flaggedCount: 4,
    flagged_count: 4,
    vulnerabilitiesCount: 5,
    vulnerabilities_count: 5,
    clauses: defaultClauses,
    flaggedClauses: defaultClauses,
    flagged_clauses: defaultClauses,
    vulnerabilities: defaultClauses,
    risks: defaultClauses
  };

  return res.status(200).json({
    success: true,
    data: fullData,
    ...fullData
  });
}
