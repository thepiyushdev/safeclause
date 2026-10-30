export const PLANS = [
  { id: "pro_month", name: "Pro Monthly", price: 499, days: 30, per: "month", popular: false },
  { id: "pro_year", name: "Pro Yearly", price: 3999, days: 365, per: "year", popular: true, badge: "Save 33%" },
];

// Compatibility alias so any older import of PACKS keeps building. It mirrors the Pro plans; nothing sells per-contract packs.
export const PACKS = PLANS.map(function (p) {
  return { id: p.id, price: p.price, icon: "⚡", name: p.name, popular: !!p.popular, features: [] };
});

export const FREE_FEATURES = [
  "Full basic scans and risk score preview",
  "1 active project in Contract Memory",
  "3 Scope Guard checks per month",
  "1 active invoice tracker in Payment Chaser",
];

export const PRO_FEATURES = [
  "Unlimited contract audit rewrites and negotiation emails",
  "Unlimited Scope Guard checks and change-order quotes",
  "Unlimited Payment Chaser invoices and legal escalation letters",
  "PDF exports for all audits",
  "Multi-device access: up to 3 simultaneous devices",
];

export const BENTO = [
  { title: "Uncapped liability vs capped fees", text: "Spot clauses that make you liable for losses far above your fee, and swap in a cap equal to the fees you were paid." },
  { title: "Pay-when-paid & Net-60 traps", text: "Catch payment terms that leave you financing the client, and replace them with clear Net-14 terms and a late fee." },
  { title: "Pre-existing IP ownership clauses", text: "Find wording that hands over your tools and past work, and keep ownership until the invoice is paid." },
  { title: "One-click counter-negotiation scripts", text: "Get a polite, ready-to-send email with the safer clause included, for every risk we flag." },
];

export const FAQS = [
  { q: "Is this legal advice?", a: "No. ClauseRadar is an automated AI review tool, not a law firm. It highlights common risks and suggests standard protective wording. For high-value or unusual contracts, have a qualified lawyer review the final terms." },
  { q: "How fast is the audit?", a: "Most audits finish in a few seconds, and longer contracts (up to 10,000 characters) in well under 30 seconds." },
  { q: "Will asking for changes upset my client?", a: "The counter-proposal emails are written to be polite and professional, presenting changes as standard protective terms. Many clients accept balanced terms, but there are no guarantees, and you decide what to send." },
  { q: "What does Pro include?", a: "Pro unlocks every safer rewrite and counter-proposal email on every audit, plus unlimited Scope Guard checks, unlimited Payment Chaser invoices, PDF exports and use on up to 3 devices at the same time. Scanning and the risk score preview stay free." },
  { q: "How does billing work?", a: "You pay by UPI and upload the payment screenshot. Each verified payment adds 30 days (monthly) or 365 days (yearly) of Pro to your account. Automatic renewal is not switched on yet, so you renew by paying again before your Pro time ends." },
  { q: "Is my contract stored?", a: "By default, no. Scans are not saved in our database and we do not use your contracts to train models. If you choose Save to Contract Memory, we keep only the project terms and short clause excerpts you review and approve, never the full contract, and you can delete them any time. Contract text is processed by third-party AI providers under their API terms." },
  { q: "Can creators scan brand sponsorship contracts?", a: "Yes. Choose BrandDeal Shield in the scanner and paste or upload your brand deal. ClauseRadar checks usage rights (organic versus paid ads and whitelisting, and how long), perpetual or irrevocable licences, category exclusivity, reshoot and edit limits, payment deadlines and kill fees, then writes a polite counter-email to the brand or talent agency." },
  { q: "Can job seekers scan offer letters and employment bonds?", a: "Yes. Choose Job Offer and Bond in the scanner. ClauseRadar flags service bonds and training-cost penalties, 90-day notice period buyouts, withheld original certificates, side-project IP claims and non-competes, and drafts a polite clarification email to HR. For India it keeps Section 27 of the Indian Contract Act 1872 in mind. It is not legal advice, so ask a lawyer before you sign or fight a bond." },
  { q: "Does it work for Indian contracts?", a: "Yes. Choose the India setting and the audit is tuned for the Indian Contract Act 1872 and MSMED Act payment norms. Choose Global for US, UK and remote contracts." },
];

export const SAMPLE_CONTRACTS = {
  india: [
    "FREELANCE SERVICES AGREEMENT",
    'This Agreement is made between Bharat Digital Solutions Pvt Ltd (the "Client") and the freelancer (the "Contractor").',
    "1. Payment: The Contractor will be paid within 90 days after project completion. The Client may withhold payment if it is not fully satisfied with the work.",
    "2. Intellectual Property: All work, drafts, ideas and materials, whether paid or unpaid, belong to the Client from the moment of creation.",
    "3. Revisions: The Contractor shall provide unlimited revisions until the Client is satisfied, at no extra cost.",
    "4. Liability: The Contractor is liable for all direct, indirect and consequential losses of the Client, without any limit.",
    "5. Termination: The Client may terminate at any time without notice and without paying for work in progress. The Contractor must give 90 days written notice.",
    "6. Non-compete: The Contractor shall not work for any other client in the same industry anywhere in India for 3 years after termination.",
    "7. Jurisdiction: All disputes shall be decided only by courts in the Client city, at the Contractor expense.",
  ].join("\n"),
  us: [
    "INDEPENDENT CONTRACTOR AGREEMENT",
    'This Agreement is between Northwind Labs, Inc. ("Company") and the independent contractor ("Contractor"), engaged on a remote basis.',
    "1. Fees: Contractor shall be paid net 120 days from invoice approval. Company may reject invoices at its sole discretion.",
    "2. Work Made For Hire: Everything Contractor creates during the term, including pre-existing tools and personal projects, is work made for hire owned by Company.",
    "3. Scope: Contractor will perform any additional tasks reasonably requested by Company without additional compensation.",
    "4. Indemnification: Contractor shall indemnify Company against all claims, damages and legal fees of any kind, with no cap.",
    "5. Auto-Renewal: This Agreement renews automatically for successive 12 month terms unless Contractor gives 180 days written notice.",
    "6. Non-Solicitation: For 24 months after termination Contractor shall not work with any Company customer or contact.",
    "7. Governing Law: Delaware law applies and all disputes must be brought in Delaware state courts.",
  ].join("\n"),
  creator: [
    "INFLUENCER MARKETING AGREEMENT",
    'This Agreement is between GlowNest Beauty Pvt Ltd (the "Brand") and the content creator (the "Creator").',
    "1. Deliverables: Creator will produce 3 Instagram Reels and 2 YouTube integrations. The Brand may request unlimited edits until it is fully satisfied.",
    "2. Usage Rights: The Brand receives a perpetual, worldwide, irrevocable licence to use, edit and publish the content, including paid advertising and whitelisting on any channel, at no additional fee.",
    "3. Exclusivity: For 12 months after the last post, Creator shall not collaborate with any brand in the beauty, skincare, wellness or fashion categories.",
    "4. Payment: The fee of Rs 60,000 will be paid within 90 days after the final post goes live, subject to the Brand approving the performance of the content.",
    "5. Reshoots: Creator will reshoot at own cost if the Brand is not satisfied with the content.",
    "6. Cancellation: The Brand may cancel at any time without payment for work already done. Creator must refund any advance if the campaign is cancelled by Creator.",
    "7. Conduct: The Brand may terminate immediately and claim damages if Creator posts anything that could harm the Brand reputation, as judged by the Brand.",
  ].join("\n"),
  employment: [
    "OFFER OF EMPLOYMENT - JUNIOR SOFTWARE ENGINEER",
    "Dear Candidate, Orbit Systems Pvt Ltd is pleased to offer you the position of Junior Software Engineer at an annual CTC of Rs 4,20,000.",
    "1. Service Bond: You must serve the Company for a minimum of 3 years. If you leave earlier, you shall pay Rs 3,00,000 as liquidated damages and training costs.",
    "2. Notice Period: Either party must give 90 days notice. If the Company waives the notice period, you must pay a buyout of 3 months gross salary.",
    "3. Intellectual Property: All inventions, code and ideas you create during employment, including on personal time and personal devices, and personal side projects, belong exclusively to the Company.",
    "4. Non-Compete: For 24 months after leaving, you shall not join or work with any competitor or client of the Company anywhere in India.",
    "5. Probation: During the 6-month probation the Company may terminate without notice, while you must still give 90 days notice.",
    "6. Original Documents: The Company will retain your original educational certificates until completion of the 3-year service period.",
    "7. Variable Pay: Up to 20 percent of CTC is variable and may be withheld at the sole discretion of management.",
  ].join("\n"),
  agency: [
    "SUBCONTRACTOR SERVICES AGREEMENT",
    'This Agreement is between BrightPath Digital LLC ("Agency") and the subcontractor ("Subcontractor") for work delivered to the Agency end clients.',
    "1. Payment: Agency will pay Subcontractor within 15 days after Agency receives payment from the end client, which may take up to 120 days.",
    "2. Non-Solicitation: For 36 months after termination, Subcontractor shall not work for or contact any Agency client, even if Subcontractor found the client independently.",
    "3. White-Label: Subcontractor may not list this work in a portfolio, reference the clients or disclose the Agency relationship.",
    "4. SLA: Subcontractor must respond to all requests within 2 hours, 24/7. Each missed SLA incurs a penalty of 10 percent of the monthly fee.",
    "5. Indemnification: Subcontractor shall indemnify Agency and its clients against all claims and losses of any kind, without any cap.",
    "6. IP: All work product, tools and pre-existing materials used on the project are owned by Agency from creation, whether or not paid.",
    "7. Termination: Agency may terminate at any time without notice and without payment for work in progress. Subcontractor needs 60 days written notice.",
  ].join("\n"),
};

export const VAULT_CATS = ["All", "Payment", "IP", "Liability", "Scope", "Termination", "Creator Deals", "Job & IP"];
export const VAULT = [
  { id: "v1", cat: "Payment", title: "Net-14 payment + late fee", text: "Invoices are payable within fourteen (14) days of the invoice date. Amounts unpaid after the due date accrue a late fee of 1.5% per month, or the maximum permitted by law if lower. The Contractor may suspend work while any invoice is overdue." },
  { id: "v2", cat: "Payment", title: "Upfront deposit", text: "A non-refundable deposit of 30% of the total fee is due before work begins. Work will commence upon receipt of the deposit." },
  { id: "v3", cat: "Payment", title: "Final files released on payment", text: "Final deliverables and source files will be released to the Client upon receipt of full payment of all invoices due under this Agreement." },
  { id: "v4", cat: "IP", title: "IP stays yours until you are paid", text: "Ownership of all deliverables remains with the Contractor and transfers to the Client only upon receipt of full payment of all fees due under this Agreement. Until then, the Client receives a limited, revocable licence to review the work." },
  { id: "v5", cat: "IP", title: "Portfolio rights", text: "The Contractor retains the right to display non-confidential portions of the completed work in the Contractor portfolio and promotional materials, unless the parties agree otherwise in writing." },
  { id: "v6", cat: "Liability", title: "Liability capped at fees paid", text: "The Contractor total aggregate liability under this Agreement shall not exceed the total fees actually paid to the Contractor under this Agreement. Neither party shall be liable for indirect, incidental or consequential damages." },
  { id: "v7", cat: "Liability", title: "Limited warranty", text: "The Contractor will correct defects in the deliverables reported in writing within thirty (30) days of delivery. Except as stated in this clause, the deliverables are provided as is, without other warranties." },
  { id: "v8", cat: "Scope", title: "2-revision cap", text: "The fee includes up to two (2) rounds of revisions per deliverable within the agreed scope. Additional revisions or changes in scope will be quoted and billed at the Contractor standard rate of [RATE] per hour." },
  { id: "v9", cat: "Scope", title: "Written change requests", text: "Any work outside the agreed scope requires a written change request. The Contractor will provide a quote for the additional work, and work begins only after the Client approves it in writing." },
  { id: "v10", cat: "Termination", title: "Fair termination + kill fee", text: "Either party may terminate this Agreement with fourteen (14) days written notice. On termination the Client shall pay for all work performed up to the termination date, plus a kill fee of 25% of the remaining unpaid fees." },
  { id: "v11", cat: "Creator Deals", title: "30-day organic usage only", text: "The Brand receives a non-exclusive licence to repost the content on the Brand's own organic social channels for thirty (30) days from the first post. Any paid advertising, whitelisting, Spark Ads or partnership ads, and any use beyond thirty (30) days, requires a separate written agreement and a monthly usage fee of [AMOUNT]. All other rights remain with the Creator." },
  { id: "v12", cat: "Creator Deals", title: "Narrow exclusivity + 50% shoot kill fee", text: "During the campaign and for [30] days after the last post, the Creator will not publish paid content for a direct competitor of the Brand in the [SPECIFIC PRODUCT CATEGORY]. This does not restrict any other category. If the Brand cancels or postpones a scheduled shoot with less than seven (7) days notice, the Brand shall pay fifty percent (50%) of the total fee as a kill fee, in addition to all work already completed." },
  { id: "v13", cat: "Creator Deals", title: "2-round edit cap on sponsored videos", text: "The fee includes up to two (2) rounds of consolidated edits to each sponsored video, requested in writing within three (3) business days of delivery. Further edits, new concepts or reshoots are billed at [RATE] per round. If the Brand does not respond within five (5) business days, the content is deemed approved and the payment due date applies." },
  { id: "v14", cat: "Job & IP", title: "Side-project and prior inventions carve-out", text: "The Employee or Contractor retains all rights in (a) inventions, code and works created before the start date, listed in Schedule A, and (b) personal side projects created entirely on personal time and personal equipment that do not use the Company's confidential information, resources or trade secrets and are not directly related to the Company's business. The Company's ownership extends only to work created in the course of the assigned duties." },
];

function mail(subject, reason, clause) {
  return "Subject: " + subject + "\n\nHi [Client Name],\n\nThanks for sending over the agreement. Before I sign, I would like to propose one change. " + reason + " Here is the wording I suggest:\n\n" + clause + "\n\nHappy to jump on a quick call if that is easier.\n\nBest regards,\n[Your Name]";
}

const C_LIAB = "The Contractor total aggregate liability under this Agreement shall not exceed the fees actually paid to the Contractor in the twelve (12) months before the claim. Neither party shall be liable for indirect or consequential damages.";
const C_IP = "Ownership of the deliverables transfers to the Company only upon receipt of full payment. The Contractor retains all rights in pre-existing tools, libraries and personal projects, and grants the Company a licence to use them as part of the deliverables.";
const C_PAY = "Invoices are payable within fourteen (14) days of the invoice date. Unpaid amounts accrue a late fee of 1.5% per month, and the Contractor may pause work while an invoice is overdue.";
const C_SCOPE = "Work outside the agreed scope requires a written change request. The Contractor will quote the additional work, and it begins only after the Company approves the quote in writing.";
const C_LAW = "This Agreement is governed by the laws of the Contractor place of residence, and disputes may be resolved by remote arbitration or in the courts of that location.";

export const SAMPLE_REPORT = {
  title: "Northwind Labs, Inc. – Independent Contractor Agreement",
  score: 78,
  level: "HIGH",
  summary: "This agreement shifts almost all financial risk to you. Uncapped indemnification and a blanket IP grab are severe, and Net-90 payment plus unpaid scope creep put your cashflow at risk. Fix the two high-risk clauses before signing.",
  clauses: [
    { category: "LIABILITY", risk_level: "HIGH",
      problematic_fine_print: "Contractor shall indemnify Company against all claims, damages and legal fees of any kind, with no cap.",
      why_it_hurts: "If anything goes wrong, you could owe far more than the project paid. One dispute could wipe out a year of income.",
      safe_counter_clause: C_LIAB,
      polite_client_negotiation_email: mail("Quick change to the liability clause", "Capping liability at the fees paid is standard for contractor work and keeps the risk proportionate for both sides.", C_LIAB) },
    { category: "IP_OWNERSHIP", risk_level: "HIGH",
      problematic_fine_print: "Everything Contractor creates during the term, including pre-existing tools and personal projects, is work made for hire owned by Company.",
      why_it_hurts: "The client would own your existing tools and side projects, and could use all work even if an invoice is never paid.",
      safe_counter_clause: C_IP,
      polite_client_negotiation_email: mail("IP ownership wording", "I want to make sure you receive full ownership of what I build for you, while I keep the tools I already own.", C_IP) },
    { category: "PAYMENT_TERMS", risk_level: "MEDIUM",
      problematic_fine_print: "Contractor shall be paid net 90 days from invoice approval. Company may reject invoices at its sole discretion.",
      why_it_hurts: "You would finance the client for three months or more, and the right to reject invoices means payment is never certain.",
      safe_counter_clause: C_PAY,
      polite_client_negotiation_email: mail("Payment terms", "Net-14 lets me keep delivery on schedule without cashflow gaps.", C_PAY) },
    { category: "SCOPE_CREEP", risk_level: "MEDIUM",
      problematic_fine_print: "Contractor will perform any additional tasks reasonably requested by Company without additional compensation.",
      why_it_hurts: "There is no limit to unpaid work. The project can quietly grow until your effective hourly rate is close to zero.",
      safe_counter_clause: C_SCOPE,
      polite_client_negotiation_email: mail("Scope and change requests", "A simple change-request step keeps us aligned and avoids surprises on both sides.", C_SCOPE) },
    { category: "JURISDICTION", risk_level: "LOW",
      problematic_fine_print: "Delaware law applies and all disputes must be brought in Delaware state courts.",
      why_it_hurts: "Disputes would be expensive and hard to pursue from another country, which weakens your leverage in a payment disagreement.",
      safe_counter_clause: C_LAW,
      polite_client_negotiation_email: mail("Governing law", "Remote arbitration keeps disputes practical for both of us given that we work across countries.", C_LAW) },
  ],
};
