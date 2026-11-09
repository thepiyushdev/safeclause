// clauseradar-v10.mjs
// Run from the project root in Termux:  node clauseradar-v10.mjs
// Fixes the "stuck on grey skeleton" screen. Since v8 the static SEO shell was hidden and a skeleton shown until the app
// mounted, so any failure to start the JavaScript (error, blocked or slow bundle) left the skeleton on screen forever.
// v10 makes that fail-open: an inline watchdog reveals the readable static page (with a small error line) as soon as a
// script error happens, or after 6 seconds. The navbar plan pill and login button also stop waiting after 3 seconds.
// Pre-flight is only node --check plus a prerender dry-run; npm run build is the real test. Everything rolls back on failure.

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { execSync, spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const FILES = {};
export const API_FILES = {};
function F(name, content) {
  FILES[name] = content;
}

// ---------------------------------------------------------------------------
// Shared modules (plain ESM so both Vite and the Node prerender can import them)
// ---------------------------------------------------------------------------
F("src/lib/meta.mjs", String.raw`import { GUIDES } from "./guides.mjs";
export const SITE = "https://clauseradar.online";
export const BRAND = "ClauseRadar";
// Shown on the Privacy and Terms pages. Change it if this mailbox does not exist.
export const CONTACT_EMAIL = "support@clauseradar.online";
export const OG_IMAGE = SITE + "/og.png";

export const ROUTE_META = {
  "/": {
    title: "ClauseRadar – AI Contract Review for Freelancers, Creators & Job Seekers",
    description: "Scan freelance contracts, creator brand deals, job offer letters and agency agreements in 30 seconds. Spot payment traps, rights grabs, bonds and risky clauses before you sign.",
    index: true, priority: "1.0",
  },
  "/sample": {
    title: "Sample Contract Audit Report & Safer Rewrites – ClauseRadar",
    description: "Explore a sample audit with risky clauses by severity, plain-English notes, safer rewrites and counter-emails for freelance, creator, job and agency deals.",
    index: true, priority: "0.8",
  },
  "/dashboard": {
    title: "Contract Scanner for Freelance, Brand Deal, Job Offer & Agency Contracts – ClauseRadar",
    description: "Upload a PDF or DOCX, or paste text. Pick a mode: freelance client contract, creator brand deal sponsorship, job offer letter and bond, or agency sub-contract.",
    index: true, priority: "0.9",
  },
  "/pricing": {
    title: "ClauseRadar Pricing: Free Contract Scan, Pro from ₹499/month",
    description: "Scan any contract free. Go Pro for ₹499/month or ₹3,999/year: every rewrite unlocked, Scope Guard, Payment Chaser, PDF reports and 3 devices.",
    index: true, priority: "0.8",
  },
  "/scope-guard": {
    title: "Scope Guard: Free or Billable? Check Client Requests – ClauseRadar",
    description: "Paste a client's quick tweak message and see if it is in scope, billable or a grey area, with the contract clause, a polite reply and a change-order quote.",
    index: true, priority: "0.8",
  },
  "/chaser": {
    title: "Payment Chaser: Late Payment Reminders & Notices – ClauseRadar",
    description: "Track invoices against your contract terms and send a friendly reminder, a firm late-fee notice and a formal demand notice, with MSMED Act references for India.",
    index: true, priority: "0.8",
  },
  "/refer": {
    title: "Earn 30% Commission: ClauseRadar Referral Program",
    description: "Refer freelancers, creators, job seekers and agencies to ClauseRadar Pro and earn 30% cash on every verified payment, paid to your UPI.",
    index: true, priority: "0.5",
  },
  "/admin": {
    title: "Admin – ClauseRadar",
    description: "Admin area.",
    index: false, priority: "0.1",
  },
  "/guides": {
    title: "100 Contract Guides for Freelancers, Creators & Job Seekers",
    description: "Plain-English guides to job bonds, notice period buyouts, brand deal usage rights, late payment, scope creep and agency contracts, with safer clauses.",
    index: true, priority: "0.8",
  },
  "/radar": {
    title: "Contract Risk Calculator: Cost of Net-90 Payments & Liability",
    description: "Estimate what late payment, unlimited revisions, IP transfer and uncapped liability could cost you before you sign a freelance or agency contract.",
    index: true, priority: "0.6",
  },
  "/vault": {
    title: "Contract Clause Library: Freelance, Creator Deals, Job & IP – ClauseRadar",
    description: "Copy-paste safer clauses for payment security, IP retention, creator usage rights and exclusivity, employment side-project carve-outs, kill fees and capped liability.",
    index: true, priority: "0.6",
  },
  "/privacy": {
    title: "Privacy Policy: How ClauseRadar Handles Your Contracts & Data",
    description: "How ClauseRadar processes contracts, which Contract Memory, referral and payment records it keeps, which providers it uses and how to delete your data.",
    index: true, priority: "0.3",
  },
  "/terms": {
    title: "Terms of Service & Not-Legal-Advice Notice – ClauseRadar",
    description: "Terms for using ClauseRadar: Free and Pro plans, UPI payments, referral program rules, acceptable use and the not-legal-advice disclaimer.",
    index: true, priority: "0.3",
  },
  "/account": {
    title: "Account – ClauseRadar",
    description: "Your ClauseRadar account, plan and devices.",
    index: false, priority: "0.1",
  },
};

// every guide becomes an indexable route with its own title and description
GUIDES.forEach(function (g) {
  ROUTE_META[g.slug] = { title: g.title, description: g.description, index: true, priority: "0.7" };
});
`);

F("src/lib/data.mjs", String.raw`export const PLANS = [
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
`);

F("src/lib/legal.mjs", String.raw`import { CONTACT_EMAIL } from "./meta.mjs";

export const LEGAL = {
  privacy: {
    title: "Privacy Policy",
    updated: "10 October 2026",
    sections: [
      { h: "Summary", p: ["By default we do not store your contracts, and we never use them to train models. We keep what we need to run your account: your email address, your plan, payment-verification records and, only if you opt in, the Contract Memory projects and invoices you create."] },
      { h: "What happens to your contract", p: [
        "When you scan a contract, the text you paste or upload is read in your browser, sent to our server and forwarded to a third-party AI provider (currently Groq) to produce the audit. We do not save contract text in our database and we do not use your contracts to train models.",
        "Audit results are returned to your browser and are not stored by us. Because contract text passes through our hosting and AI providers while it is processed, please do not submit agreements you are not allowed to share.",
      ] },
      { h: "Account data", p: ["If you create an account we store your email address, your plan and Pro end date. Sign-in is handled by Supabase Authentication, and we never see your password. If you choose Continue with Google, Google shares your email address and name with our authentication provider, and we store only your email address."] },
      { h: "Contract Memory (optional)", p: [
        "Contract Memory is off by default. If you choose Save to Contract Memory after a scan, we read your contract once to suggest structured terms (project and client name, payment days, revision cap, hourly rate, liability cap, scope deliverables) and up to four short clause excerpts of at most 400 characters each. You review and edit these before saving. Only what you approve is stored, and the full contract is never stored.",
        "Scope Guard sends the client message you paste, together with your saved terms, to our AI provider to produce a verdict. We do not store the client message; we keep only a usage record (the verdict and the date) to apply the Free plan monthly limit. Invoices you add to Payment Chaser are stored with their amounts and dates. You can delete any project or invoice at any time.",
      ] },
      { h: "Devices", p: ["To apply the device limit (1 device at a time on Free, up to 3 on Pro) we store a random device identifier, a short device label such as Chrome on Android, and the time it was last active. You can sign out any device from your Account page."] },
      { h: "Referral program (optional)", p: ["If you use the referral program we store your referral code, who referred you, the commissions you earn, and your payout requests including the UPI ID you provide. Referrers can see how many people they referred and what they earned, but not the personal details of the people they referred."] },
      { h: "Payments", p: ["Payments are made by UPI directly to the UPI ID shown at checkout. When you upload a payment screenshot, it is analysed by an AI service (Google Gemini) to check the amount, receiver and status. We keep the transaction ID, a fingerprint (hash) of the image, the amount, the plan, the time and your user ID, so the same payment cannot be used twice and for our accounting. We do not store the screenshot itself."] },
      { h: "Service providers", p: ["We use Vercel (hosting), Supabase (authentication and database), Groq (contract analysis) and Google (payment screenshot checks). Each processes data under its own terms. Fonts are loaded from Google Fonts."] },
      { h: "Cookies and tracking", p: ["We use your browser's local storage to keep you signed in. We do not run advertising trackers."] },
      { h: "Retention and deletion", p: ["We keep account, plan and Contract Memory data while your account is active. Payment records are kept as long as needed for accounting and fraud prevention. To delete your account or ask what we hold about you, email " + CONTACT_EMAIL + ". We will delete your account data, except records we must keep for accounting or fraud prevention."] },
      { h: "Changes", p: ["We may update this policy. The date above shows the latest version."] },
      { h: "Contact", p: ["Questions about privacy: " + CONTACT_EMAIL + "."] },
    ],
  },
  terms: {
    title: "Terms of Service",
    updated: "10 October 2026",
    sections: [
      { h: "Acceptance", p: ["By using ClauseRadar you agree to these terms. If you do not agree, please do not use the service."] },
      { h: "Not legal advice", p: [
        "ClauseRadar is an automated AI review tool, not a law firm. Nothing it produces is legal advice, and using it does not create an attorney-client relationship.",
        "Results can be incomplete or wrong. Always have a qualified lawyer review important or high-value contracts before you sign.",
      ] },
      { h: "Your account and acceptable use", p: ["You are responsible for your account. Do not upload content you are not allowed to share, do not abuse, scrape or resell the service, and do not submit fake or reused payment screenshots. We may suspend accounts that do."] },
      { h: "Pro plan and payments", p: [
        "ClauseRadar has a Free plan and a Pro plan (currently 499 rupees per month or 3,999 rupees per year). Payment is by UPI. Each verified payment adds 30 days (monthly) or 365 days (yearly) of Pro to your account. Automatic renewal is not enabled, so Pro ends when your paid time ends unless you pay again.",
        "Pro may be used on up to 3 devices at the same time and Free on 1; we may sign out devices above the limit.",
        "If something goes wrong with a payment or an unlock, contact " + CONTACT_EMAIL + " and we will review it.",
      ] },
      { h: "Referral program", p: [
        "You can earn a commission of 30% of each verified Pro payment made by a person who joined through your referral link. Commissions are added to your balance after the payment is verified. The minimum payout is 100 rupees, and payouts are reviewed and paid manually to the UPI ID you provide.",
        "Self-referrals, fake or duplicate accounts and fake or reversed payments are not eligible. We may withhold or reverse commissions and ban accounts for abuse. Commission rates and rules may change for future sales. You are responsible for any taxes on your earnings.",
      ] },
      { h: "Your content", p: ["You keep all rights in the contracts you submit. The suggested clauses and emails are provided for you to use and adapt."] },
      { h: "Disclaimers and limits of liability", p: ["The service is provided as is, without warranties of any kind. To the extent permitted by law, our total liability for any claim is limited to the amount you paid us in the 12 months before the claim."] },
      { h: "Governing law", p: ["These terms are governed by the laws of India."] },
      { h: "Changes and contact", p: ["We may update these terms and will change the date above when we do. Contact: " + CONTACT_EMAIL + "."] },
    ],
  },
};
`);
// ---------------------------------------------------------------------------
// Build-time SEO: static head tags + static body copy per route
// ---------------------------------------------------------------------------
F("scripts/seo-content.mjs", String.raw`import { ROUTE_META, SITE, BRAND, OG_IMAGE } from "../src/lib/meta.mjs";
import { PLANS, FREE_FEATURES, PRO_FEATURES, BENTO, FAQS, SAMPLE_REPORT, VAULT } from "../src/lib/data.mjs";
import { LEGAL } from "../src/lib/legal.mjs";
import { GUIDES, MODE_LABELS, MODE_ORDER } from "../src/lib/guides.mjs";

export function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// "<" is escaped so structured data can never end the script tag early
function jsonLd(obj) {
  return '<script type="application/ld+json">' + JSON.stringify(obj).replace(/</g, String.fromCharCode(92) + "u003c") + "</script>\n";
}

// FAQPage structured data, built from the same FAQS array that the homepage shows
export function faqSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map(function (f) {
      return { "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } };
    }),
  };
}

export function headTags(p) {
  const m = ROUTE_META[p] || ROUTE_META["/"];
  const url = SITE + (p === "/" ? "" : p);
  const t = esc(m.title);
  const d = esc(m.description);
  let h = "<title>" + t + "</title>\n";
  h += '<meta name="description" content="' + d + '" />\n';
  h += '<link rel="canonical" href="' + url + '" />\n';
  h += '<meta name="robots" content="' + (m.index ? "index,follow" : "noindex,nofollow") + '" />\n';
  h += '<meta property="og:type" content="website" />\n';
  h += '<meta property="og:site_name" content="' + BRAND + '" />\n';
  h += '<meta property="og:title" content="' + t + '" />\n';
  h += '<meta property="og:description" content="' + d + '" />\n';
  h += '<meta property="og:url" content="' + url + '" />\n';
  h += '<meta property="og:image" content="' + OG_IMAGE + '" />\n';
  h += '<meta property="og:image:width" content="1200" />\n';
  h += '<meta property="og:image:height" content="630" />\n';
  h += '<meta name="twitter:card" content="summary_large_image" />\n';
  h += '<meta name="twitter:title" content="' + t + '" />\n';
  h += '<meta name="twitter:description" content="' + d + '" />\n';
  h += '<meta name="twitter:image" content="' + OG_IMAGE + '" />\n';
  if (p === "/") {
    h += jsonLd({
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: BRAND,
      url: SITE,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description: m.description,
      offers: { "@type": "AggregateOffer", priceCurrency: "INR", lowPrice: "499", highPrice: "3999", offerCount: String(PLANS.length) },
    });
    h += jsonLd(faqSchema());
  }
  if (p.indexOf("/guide/") === 0) {
    const g = GUIDES.find(function (x) { return x.slug === p; });
    if (g) {
      h += jsonLd({
        "@context": "https://schema.org",
        "@type": "Article",
        headline: g.h1,
        description: g.description,
        mainEntityOfPage: url,
        inLanguage: "en",
        about: MODE_LABELS[g.mode],
        image: OG_IMAGE,
        dateModified: new Date().toISOString().slice(0, 10),
        author: { "@type": "Organization", name: BRAND, url: SITE },
        publisher: { "@type": "Organization", name: BRAND, url: SITE },
      });
      h += jsonLd({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: g.faqs.map(function (f) { return { "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } }; }),
      });
    }
  }
  return h;
}

const BTN = "display:inline-block;padding:11px 20px;border-radius:12px;font-weight:600;text-decoration:none;margin:4px 8px 4px 0;";
const NAVLINKS = [["/", "Home"], ["/dashboard", "Scanner"], ["/scope-guard", "Scope Guard"], ["/chaser", "Payment Chaser"], ["/sample", "Sample report"], ["/pricing", "Pricing"], ["/refer", "Earn 30%"], ["/guides", "Guides"], ["/radar", "Risk calculator"], ["/vault", "Clause library"], ["/privacy", "Privacy"], ["/terms", "Terms"]];

function wrap(inner) {
  const nav = NAVLINKS.map(function (l) { return '<a href="' + l[0] + '" style="color:#4f46e5;margin-right:14px">' + l[1] + "</a>"; }).join("");
  return '<div style="font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:780px;margin:0 auto;padding:40px 20px 56px;color:#0f172a;line-height:1.6;background:#f8fafc">' +
    '<p style="font-weight:800;font-size:20px;margin:0 0 24px">ClauseRadar</p>' + inner +
    '<hr style="border:0;border-top:1px solid #e2e8f0;margin:32px 0" /><p style="font-size:14px">' + nav + "</p>" +
    '<p style="font-size:13px;color:#64748b"><b>Not legal advice.</b> ClauseRadar is an automated AI review tool, not a law firm. &copy; ' + new Date().getFullYear() + " ClauseRadar.</p></div>";
}

function h1(t) { return '<h1 style="font-size:38px;line-height:1.1;margin:0 0 12px;letter-spacing:-0.02em">' + esc(t) + "</h1>"; }
function para(t) { return '<p style="font-size:17px;color:#334155">' + esc(t) + "</p>"; }
function sec(h, ps) { return '<h2 style="font-size:22px;margin:28px 0 6px">' + esc(h) + "</h2>" + ps.map(para).join(""); }
function cta(href, label, primary) {
  return '<a href="' + href + '" style="' + BTN + (primary ? "background:#4f46e5;color:#fff" : "background:#fff;color:#0f172a;border:1px solid #cbd5e1") + '">' + esc(label) + "</a>";
}

// The four audiences ClauseRadar serves. Used by the home page and every product page shell.
export const MODES = [
  { name: "Freelancers and developers", text: "Scan client and freelance contracts for scope creep and unlimited revisions, Net-60 and Net-90 payment traps, uncapped liability, IP transfer before payment, late payment terms and unfair termination. Get safer clauses, a counter-proposal email, Scope Guard checks and Payment Chaser reminders." },
  { name: "BrandDeal Shield for creators and influencers", text: "Check brand sponsorship and influencer marketing agreements for perpetual and irrevocable usage rights, paid ad whitelisting, category exclusivity, reshoot and edit limits, content approval, payment deadlines and kill fees. Get a polite counter-email for the brand or talent agency." },
  { name: "Offer Letter and Bond Shield for job seekers and freshers", text: "Check job offer letters and employment agreements for service bonds and training cost penalties, 90-day notice period buyouts, withheld original certificates, side-project IP claims and non-competes, with Section 27 of the Indian Contract Act 1872 in mind for India. Get a polite clarification email for HR. This is not legal advice." },
  { name: "Agency White-Label Shield for agencies and consultants", text: "Check sub-contractor and agency agreements for pay-when-paid and pay-if-paid traps, non-solicitation and non-compete scope, portfolio and white-label restrictions, SLA penalties, uncapped indemnification and IP assignment before payment." },
];

function modesBlock() {
  return MODES.map(function (m) { return sec(m.name, [m.text]); }).join("");
}

function homeShell() {
  let h = '<p style="display:inline-block;padding:4px 12px;border-radius:999px;background:#eef2ff;color:#3730a3;font-size:14px;font-weight:600">ClauseRadar – contract protection for freelancers, creators, job seekers &amp; agencies</p>';
  h += h1("Audit any contract in 30 seconds. Stop risky clauses before you sign.");
  h += para("ClauseRadar reads your freelance contract, creator brand deal, job offer letter or agency agreement, flags the traps (Net-90 payments, perpetual ad rights, employment bonds, pay-when-paid clauses), explains each risk in plain English and writes the counter-email for you.");
  h += "<p>" + cta("/dashboard", "Upload Contract", true) + cta("/sample", "View Sample Audit Report", false) + "</p>";
  h += modesBlock();
  h += sec("How ClauseRadar works", ["Upload a PDF or DOCX, or paste your contract text, and choose a mode. ClauseRadar flags the risky clauses with the exact quote and a plain-English explanation, then Pro unlocks the safer rewrite and a ready-to-send counter-proposal email for every flagged clause."]);
  BENTO.forEach(function (b) { h += sec(b.title, [b.text]); });
  h += sec("Zero contract training", ["We never use your agreements to train models, and scans are not stored by default. If you opt in to Contract Memory, we save only the terms and short clause excerpts you review. Contract text is processed by third-party AI providers under their API terms."]);
  h += '<h2 style="font-size:22px;margin:28px 0 6px">Popular contract guides</h2><ul style="padding-left:20px">' + GUIDES.slice(0, 8).map(function (g) { return '<li style="margin:6px 0"><a href="' + g.slug + '" style="color:#4f46e5">' + esc(g.h1) + "</a></li>"; }).join("") + '</ul><p><a href="/guides" style="color:#4f46e5">See all contract guides</a></p>';
  h += '<h2 style="font-size:22px;margin:28px 0 6px">Frequently asked questions</h2>';
  FAQS.forEach(function (f) { h += '<h3 style="font-size:17px;margin:16px 0 4px">' + esc(f.q) + "</h3>" + para(f.a); });
  return wrap(h);
}

function guideShell(g) {
  const same = GUIDES.filter(function (x) { return x.mode === g.mode; });
  const i = same.findIndex(function (x) { return x.slug === g.slug; });
  let h = '<p style="font-size:14px;color:#64748b"><a href="/guides" style="color:#4f46e5">Guides</a> &rsaquo; ' + esc(MODE_LABELS[g.mode]) + "</p>";
  h += h1(g.h1) + para(g.description);
  h += sec("The risky clause", [g.trap]);
  h += sec("Why it is dangerous", [g.why]);
  h += sec("Safer clause to propose", [g.fix]);
  h += sec("Message to send", g.email.split("\n"));
  h += '<h2 style="font-size:22px;margin:28px 0 6px">Frequently asked questions</h2>';
  g.faqs.forEach(function (f) { h += '<h3 style="font-size:17px;margin:16px 0 4px">' + esc(f.q) + "</h3>" + para(f.a); });
  h += '<h2 style="font-size:22px;margin:28px 0 6px">Related guides</h2><ul style="padding-left:20px">';
  for (let k = 1; k <= 5 && k < same.length; k++) {
    const r = same[(i + k) % same.length];
    h += '<li style="margin:6px 0"><a href="' + r.slug + '" style="color:#4f46e5">' + esc(r.h1) + "</a></li>";
  }
  h += "</ul>";
  h += "<p>" + cta("/dashboard", "Have a contract or offer letter like this? Scan your full document free in 30s", true) + "</p>";
  return wrap(h);
}

function hubShell() {
  let h = h1("Contract guides for freelancers, creators and job seekers") + para("Plain-English help with job bonds, notice period buyouts, brand deal usage rights, late payment, scope creep and agency contracts. Each guide shows the risky clause, why it hurts, a safer rewrite and a message you can send.");
  MODE_ORDER.forEach(function (m) {
    h += '<h2 style="font-size:22px;margin:28px 0 6px">' + esc(MODE_LABELS[m]) + '</h2><ul style="padding-left:20px">';
    GUIDES.filter(function (g) { return g.mode === m; }).forEach(function (g) {
      h += '<li style="margin:6px 0"><a href="' + g.slug + '" style="color:#4f46e5;font-weight:600">' + esc(g.h1) + "</a> - " + esc(g.description) + "</li>";
    });
    h += "</ul>";
  });
  return wrap(h);
}

export function shellHtml(p) {
  if (p === "/") return homeShell();
  if (p === "/guides") return hubShell();
  if (p.indexOf("/guide/") === 0) {
    const g = GUIDES.find(function (x) { return x.slug === p; });
    if (g) return guideShell(g);
  }
  if (p === "/sample") {
    let h = h1("Sample contract audit report") + para("An interactive example of a ClauseRadar audit for " + SAMPLE_REPORT.title + ". Overall risk: " + SAMPLE_REPORT.level + " (" + SAMPLE_REPORT.score + "/100). " + SAMPLE_REPORT.summary);
    SAMPLE_REPORT.clauses.forEach(function (c) { h += sec(c.category.replace(/_/g, " ") + " – " + c.risk_level + " risk", [c.problematic_fine_print, c.why_it_hurts]); });
    h += sec("The same report for every contract type", ["The scanner has four modes, so you get the same severity-coded report for freelance contracts, creator brand deals, job offer letters and bonds, and agency agreements."]);
    return wrap(h + modesBlock() + "<p>" + cta("/dashboard", "Scan your own contract", true) + "</p>");
  }
  if (p === "/dashboard") {
    return wrap(h1("Contract scanner") + para("Upload a PDF or DOCX, or paste contract text, and pick a mode. ClauseRadar flags the risky clauses, explains each one in plain English and suggests a safer rewrite.") + modesBlock() + "<p>" + cta("/sample", "View Sample Audit Report", false) + "</p>");
  }
  if (p === "/pricing") {
    let h = h1("Pricing") + para("Scanning is free for every contract type. Go Pro to unlock every safer rewrite, Scope Guard, Payment Chaser, PDF reports and use on up to 3 devices.");
    h += sec("Free", FREE_FEATURES);
    h += sec("Pro", PRO_FEATURES);
    PLANS.forEach(function (k) { h += sec(k.name + " – ₹" + k.price + " per " + k.per, ["Each verified UPI payment adds " + k.days + " days of Pro."]); });
    h += sec("Who Pro is for", ["Freelancers and developers, creators and influencers, job seekers and freshers, and agencies and consultants who sign contracts regularly."]);
    return wrap(h);
  }
  if (p === "/scope-guard") {
    return wrap(h1("Scope Guard") + para("Paste the client's quick tweak message. Find out in seconds if it is in scope, billable or a grey area. You get the exact contract clause, a polite ready-to-send reply, a change-order quote and a revision meter. Built for freelancers, developers, agencies and creators working on deliverables.") + "<p>" + cta("/dashboard", "Scan a contract first", true) + "</p>");
  }
  if (p === "/chaser") {
    return wrap(h1("Payment Chaser") + para("The contract says Net-30 and the client is on day 41. Track each invoice against your contract's payment terms and get an escalation sequence: a friendly reminder, a firm reminder quoting the late-fee clause, and a formal demand notice with the MSMED Act 45-day reference for India. Built for freelancers, creators waiting on brand payments, and agencies.") + "<p>" + cta("/dashboard", "Scan a contract first", true) + "</p>");
  }
  if (p === "/refer") {
    return wrap(h1("Earn 30% on every ClauseRadar sale") + para("Refer freelancers, creators, job seekers and agencies to ClauseRadar Pro and earn 30% cash on every verified payment (₹150 per month or ₹1,200 per year per user), paid to your UPI. Get your personal link, track your earnings and request payouts.") + modesBlock() + "<p>" + cta("/refer", "Get your referral link", true) + "</p>");
  }
  if (p === "/radar") {
    return wrap(h1("Contract risk calculator") + para("Enter your project fee, payment terms, liability, IP transfer and revision limits to estimate what late payment, unpaid revisions and uncapped liability could cost you before you sign a freelance, creator or agency contract."));
  }
  if (p === "/vault") {
    let h = h1("Contract clause library") + para("Contractor-friendly clauses for freelancers, creator brand deals and job offers: payment security, IP retention, creator usage rights and exclusivity, side-project carve-outs, kill fees and capped liability. Have a lawyer review high-value deals.");
    VAULT.forEach(function (v) { h += sec(v.title, [v.text]); });
    return wrap(h);
  }
  if (p === "/privacy" || p === "/terms") {
    const L = LEGAL[p.slice(1)];
    let h = h1(L.title) + para("Last updated " + L.updated + ".");
    L.sections.forEach(function (s) { h += sec(s.h, s.p); });
    return wrap(h);
  }
  return wrap(h1("ClauseRadar account") + para("Sign in to see your plan and devices."));
}
`);

F("scripts/prerender.mjs", String.raw`// Runs after "vite build". Writes one static HTML file per route plus robots.txt and sitemap.xml,
// then re-reads every file and fails the build if a title, canonical link or schema block is missing.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ROUTE_META, SITE } from "../src/lib/meta.mjs";
import { headTags, shellHtml, esc } from "./seo-content.mjs";
import { GUIDES } from "../src/lib/guides.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const tplPath = path.join(dist, "index.html");
if (!fs.existsSync(tplPath)) throw new Error("dist/index.html not found. Run vite build first.");
const tpl = fs.readFileSync(tplPath, "utf8");

function swapHead(html, content) {
  const a = /<meta name="seo-start"[^>]*>/.exec(html);
  const b = /<meta name="seo-end"[^>]*>/.exec(html);
  if (!a || !b || b.index < a.index) throw new Error("SEO head markers not found in dist/index.html");
  return html.slice(0, a.index + a[0].length) + "\n" + content + html.slice(b.index);
}

function swapShell(html, content) {
  const open = html.indexOf("<seo-shell");
  if (open === -1) throw new Error("seo-shell element not found in dist/index.html");
  const gt = html.indexOf(">", open);
  const close = html.indexOf("</seo-shell>", gt);
  if (gt === -1 || close === -1) throw new Error("seo-shell element is malformed");
  return html.slice(0, gt + 1) + content + html.slice(close);
}

function outFile(p) {
  return p === "/" ? tplPath : path.join(dist, p.slice(1), "index.html");
}

const paths = Object.keys(ROUTE_META);

// Every page needs its own title and description (duplicates hurt search results).
const seenTitle = {};
const seenDesc = {};
const dupes = [];
paths.forEach(function (p) {
  const m = ROUTE_META[p];
  if (seenTitle[m.title]) dupes.push(p + " repeats the title of " + seenTitle[m.title]);
  if (seenDesc[m.description]) dupes.push(p + " repeats the description of " + seenDesc[m.description]);
  seenTitle[m.title] = p;
  seenDesc[m.description] = p;
});
if (dupes.length) throw new Error("Duplicate SEO text: " + dupes.join("; "));

for (const p of paths) {
  const html = swapShell(swapHead(tpl, headTags(p)), shellHtml(p));
  const out = outFile(p);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, html, "utf8");
}

// Read everything back and check it.
const bad = [];
for (const p of paths) {
  const html = fs.readFileSync(outFile(p), "utf8");
  const m = ROUTE_META[p];
  const url = SITE + (p === "/" ? "" : p);
  if (html.indexOf("<title>" + esc(m.title) + "</title>") === -1) bad.push(p + ": title");
  if (html.indexOf('rel="canonical" href="' + url + '"') === -1) bad.push(p + ": canonical");
  if (html.indexOf('content="' + (m.index ? "index,follow" : "noindex,nofollow") + '"') === -1) bad.push(p + ": robots meta");
  if (html.indexOf("<h1") === -1) bad.push(p + ": h1");
}
GUIDES.forEach(function (g) {
  const html = fs.readFileSync(outFile(g.slug), "utf8");
  if (html.indexOf('"@type":"Article"') === -1) bad.push(g.slug + ": Article schema");
  if (html.indexOf('"@type":"FAQPage"') === -1) bad.push(g.slug + ": FAQPage schema");
  if (html.indexOf(esc(g.trap.slice(0, 40))) === -1) bad.push(g.slug + ": trap text");
  if (html.indexOf(esc(g.fix.slice(0, 40))) === -1) bad.push(g.slug + ": safer clause text");
});
const hub = fs.readFileSync(outFile("/guides"), "utf8");
if ((hub.match(/href="\/guide\//g) || []).length < GUIDES.length) bad.push("/guides: not every guide is linked");
const home = fs.readFileSync(tplPath, "utf8");
if (home.indexOf('"@type":"FAQPage"') === -1) bad.push("/: FAQPage schema");
if (home.indexOf('"@type":"SoftwareApplication"') === -1) bad.push("/: SoftwareApplication schema");
["BrandDeal Shield", "Offer Letter and Bond Shield", "Agency White-Label Shield", "Freelancers and developers"].forEach(function (k) {
  if (home.indexOf(k) === -1) bad.push("/: missing niche text '" + k + "'");
});
if (bad.length) throw new Error("Prerender verification failed: " + bad.join(", "));

const today = new Date().toISOString().slice(0, 10);
const urls = paths.filter(function (p) { return ROUTE_META[p].index; }).map(function (p) {
  return "  <url><loc>" + SITE + (p === "/" ? "/" : p) + "</loc><lastmod>" + today + "</lastmod><changefreq>weekly</changefreq><priority>" + ROUTE_META[p].priority + "</priority></url>";
});
fs.writeFileSync(path.join(dist, "sitemap.xml"), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls.join("\n") + "\n</urlset>\n", "utf8");
fs.writeFileSync(path.join(dist, "robots.txt"), "User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /account\n\nSitemap: " + SITE + "/sitemap.xml\n", "utf8");

console.log("prerender: wrote " + paths.length + " pages (" + urls.length + " in sitemap), verified titles, canonicals and schema, wrote sitemap.xml and robots.txt");
`);
// ---------------------------------------------------------------------------
// Design system (STRICT mobile-first: base rules are the phone layout,
// min-width media queries add the tablet and desktop layouts)
// ---------------------------------------------------------------------------
F("src/lib/styles.css", String.raw`:root{color-scheme:light;background-color:#f8fafc;color:#0f172a;--bg:#f8fafc;--surface:#fff;--ink:#0f172a;--ink2:#334155;--muted:#475569;--line:#e2e8f0;--indigo:#4f46e5;--indigo-soft:#eef2ff;--rose:#e11d48;--rose-bg:#fff1f2;--amber:#b45309;--amber-bg:#fffbeb;--green:#047857;--green-bg:#ecfdf5;--nav-h:56px}
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;text-size-adjust:100%;scroll-behavior:smooth;margin:0;padding:0;width:100%;max-width:100%}
@supports (overflow-x:clip){html{overflow-x:clip}}
body{display:block;place-items:initial;min-width:0;min-height:100vh;margin:0;padding:0;max-width:100%;width:100%;overflow-x:hidden;overflow-x:clip;background:var(--bg);color:var(--ink);font-family:Inter,"Inter Fallback",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;font-size:16px;line-height:1.6;-webkit-font-smoothing:antialiased;overflow-wrap:break-word}
#app{display:block;width:100%;max-width:100%;margin:0;padding:0;text-align:left}
img,svg,video,canvas{max-width:100%}
[hidden]{display:none!important}
a{color:inherit}
button{font:inherit;color:inherit;padding:0;margin:0;border:0;background:none;border-radius:0;cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:manipulation}
h1,h2,h3,h4,p{margin:0}
h1,h2,h3,h4{color:#0f172a}
h1{font-size:clamp(1.75rem,6vw,2.4rem);line-height:1.2;letter-spacing:-.015em;font-weight:800;margin:0 0 12px}
.num{font-variant-numeric:tabular-nums}

/* layout */
.wrap{width:100%;max-width:1120px;margin:0 auto;padding-left:18px!important;padding-right:18px!important;box-sizing:border-box}
.narrow{max-width:860px}
/* longhand on purpose: a "padding:24px 0" shorthand here used to wipe the .wrap side gutters */
.page{padding-top:24px;padding-bottom:48px}
.sec{padding-top:44px;padding-bottom:44px}
.center{text-align:center}
.row{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:10px}
.between{justify-content:space-between}
.grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:6px 14px}
.grid3{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:14px}
.grid2>*,.grid3>*,.bento>*,.demo>*,.report-head>*,.packs>*,.tier>*{min-width:0}
@media(min-width:640px){.wrap{padding-left:24px!important;padding-right:24px!important}.page{padding-top:36px;padding-bottom:64px}.sec{padding-top:60px;padding-bottom:60px}}

/* typography */
.display{font-size:clamp(2rem,8.6vw,3.7rem);line-height:1.06;letter-spacing:-.035em;font-weight:800;margin:16px auto 14px;max-width:880px}
.h2{font-size:clamp(1.5rem,5.4vw,2.1rem);line-height:1.2;letter-spacing:-.015em;font-weight:800;margin:0 0 12px;color:#0f172a}
h1.h2{font-size:clamp(1.75rem,6vw,2.4rem)}
.lead{font-size:1.0625rem;color:var(--ink2);max-width:660px;margin:0 auto}
.muted{color:var(--muted)}
.small{font-size:.875rem}
.pre,.ins,.mail,.why,blockquote.redline{white-space:pre-wrap;word-break:break-word;overflow-wrap:anywhere}
.grad{background:linear-gradient(90deg,#4f46e5,#c026d3 55%,#e11d48);-webkit-background-clip:text;background-clip:text;color:transparent}
.lbl{font-size:.8125rem;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);margin:16px 0 6px}
h3.sub{font-size:.8125rem;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);margin:16px 0 6px}
@media(min-width:640px){.lead{font-size:1.15rem}}

/* pills, badges */
.pill{display:inline-flex;gap:8px;align-items:center;padding:8px 14px;border-radius:18px;background:var(--indigo-soft);border:1px solid #c7d2fe;color:#3730a3;font-size:.9375rem;font-weight:600;line-height:1.35;text-decoration:none;max-width:100%;transition:border-color .15s}
.pill:hover{border-color:#818cf8}
.badge{display:inline-flex;align-items:center;gap:6px;padding:4px 11px;border-radius:999px;font-size:.8125rem;font-weight:700;letter-spacing:.02em;white-space:nowrap}
.badge .dot{width:7px;height:7px;border-radius:50%;background:currentColor}
.badge.high{background:var(--rose-bg);color:#be123c;border:1px solid #fecdd3}
.badge.med{background:var(--amber-bg);color:var(--amber);border:1px solid #fde68a}
.badge.low{background:var(--green-bg);color:var(--green);border:1px solid #a7f3d0}
@media(min-width:640px){.pill{border-radius:999px}}

/* buttons (44px minimum tap target everywhere) */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:10px 18px;border-radius:12px;border:1px solid #cbd5e1;background:#fff;color:var(--ink);font-size:1rem;font-weight:600;line-height:1.25;text-decoration:none;text-align:center;white-space:normal;transition:border-color .15s,box-shadow .15s,transform .1s,background .15s}
.btn:hover{border-color:#818cf8;box-shadow:0 2px 10px rgba(79,70,229,.12)}
.btn:active{transform:translateY(1px);background:#f1f5f9}
.btn.primary{background:var(--indigo);border-color:var(--indigo);color:#fff;box-shadow:0 1px 2px rgba(15,23,42,.2),0 6px 16px rgba(79,70,229,.28)}
.btn.primary:hover{background:#4338ca}
.btn.primary:active{background:#3730a3}
.btn.sm{padding:8px 16px;font-size:.9375rem}
.btn.lg{min-height:52px;padding:14px 22px;font-size:1.0625rem;border-radius:14px}
.btn.block,.mfull{width:100%}
.btn.block{display:flex}
.btn:disabled{opacity:.6;cursor:wait}
@media(min-width:640px){.mfull{width:auto}}
@media(min-width:900px){.btn.sm{min-height:38px;padding:6px 14px;font-size:.875rem}}

/* cards + forms */
.card{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:16px;box-shadow:0 1px 2px rgba(15,23,42,.04);margin-top:14px}
.card.hover{transition:.18s}
.card.hover:hover{border-color:#a5b4fc;box-shadow:0 10px 30px rgba(79,70,229,.1)}
.iri{position:relative}
.iri::before{content:"";position:absolute;inset:-1px;border-radius:inherit;padding:1px;background:linear-gradient(135deg,#a5b4fc,#f9a8d4,#fcd34d,#6ee7b7);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;pointer-events:none}
input,select,textarea{display:block;width:100%;min-height:48px;background:#fff;color:var(--ink);border:1px solid #cbd5e1;border-radius:12px;padding:11px 13px;font:inherit;font-size:1rem;margin:0 0 10px;outline:none}
input:focus,select:focus,textarea:focus{border-color:var(--indigo);box-shadow:0 0 0 3px rgba(99,102,241,.2)}
textarea{resize:vertical;min-height:160px;line-height:1.5}
label{display:block;font-size:.9375rem;font-weight:600;color:var(--ink2);margin-bottom:4px}
.error{margin-top:10px;padding:12px 14px;border-radius:10px;background:var(--rose-bg);border:1px solid #fecdd3;color:#9f1239;font-size:.9375rem;word-break:break-word;text-align:left}
.ok{margin-top:10px;padding:12px 14px;border-radius:10px;background:var(--green-bg);border:1px solid #a7f3d0;color:#065f46;font-size:.9375rem}
@media(min-width:640px){.card{padding:20px}}

/* segmented control + chips (chips scroll sideways on phones) */
.seg{display:flex;gap:8px;margin:0 0 12px}
.seg button{flex:1;min-height:48px;padding:8px 10px;border-radius:12px;border:1px solid var(--line);background:#fff;color:var(--ink2);font-size:.9375rem;font-weight:600;line-height:1.25;transition:.15s}
.seg button.on{border-color:var(--indigo);background:var(--indigo-soft);color:#3730a3}
.chips{display:flex;flex-wrap:nowrap;gap:8px;overflow-x:auto;-webkit-overflow-scrolling:touch;padding:0 0 8px;margin:0 0 10px;scrollbar-width:none}
.chips::-webkit-scrollbar{display:none}
.chips button{flex:0 0 auto;min-height:42px;padding:8px 16px;border-radius:999px;border:1px solid var(--line);background:#fff;color:var(--ink2);font-size:.9375rem;font-weight:600;white-space:nowrap;transition:.15s}
.chips button.on{border-color:var(--indigo);background:var(--indigo-soft);color:#3730a3}
@media(min-width:900px){.chips{flex-wrap:wrap;overflow-x:visible}}

/* navbar: phone = logo + plan pill + hamburger; desktop = links */
.nav{position:sticky;top:0;z-index:50;background:rgba(255,255,255,.96);backdrop-filter:saturate(180%) blur(14px);-webkit-backdrop-filter:saturate(180%) blur(14px);border-bottom:1px solid var(--line)}
.nav-in{max-width:1120px;margin:0 auto;padding:0 16px;height:var(--nav-h);display:flex;align-items:center;justify-content:space-between;gap:10px}
.brand{display:flex;align-items:center;gap:8px;font-weight:800;font-size:1.125rem;letter-spacing:-.02em;text-decoration:none;white-space:nowrap;color:#0f172a}
.nav-links,.nav-desktop{display:none}
.nav-right{display:flex;align-items:center;gap:8px}
.planpill{display:inline-flex;gap:5px;align-items:center;min-height:36px;padding:4px 12px;border-radius:999px;border:1px solid #c7d2fe;background:var(--indigo-soft);color:#3730a3;font-size:.9375rem;text-decoration:none;font-weight:600;white-space:nowrap}
.avatar{width:36px;height:36px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#4f46e5,#c026d3);color:#fff;font-weight:700;text-decoration:none;font-size:1rem}
.burger{display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:12px;border:1px solid var(--line);background:#fff;font-size:1.35rem;line-height:1}
.scrim{position:absolute;left:0;right:0;top:100%;height:100vh;height:100dvh;background:rgba(15,23,42,.4);z-index:0;border:0;padding:0;width:100%}
.menu{position:absolute;left:0;right:0;top:100%;z-index:1;display:flex;flex-direction:column;gap:2px;padding:8px 16px 16px;background:#fff;border-bottom:1px solid var(--line);box-shadow:0 24px 40px rgba(15,23,42,.18);max-height:calc(100vh - var(--nav-h));max-height:calc(100dvh - var(--nav-h));overflow-y:auto;animation:drop .2s ease-out}
.menu a,.menu .mi{display:flex;align-items:center;width:100%;min-height:48px;padding:0 14px;border-radius:12px;font-size:1.0625rem;font-weight:600;color:#0f172a;text-decoration:none;text-align:left}
.menu a.active{background:var(--indigo-soft);color:#3730a3}
.menu a:active,.menu .mi:active{background:#f1f5f9}
.menu hr{border:0;border-top:1px solid var(--line);margin:6px 0;width:100%}
@keyframes drop{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}
@media(min-width:1024px){
  .nav-links{display:flex;gap:2px}
  .nav-links a{padding:8px 12px;border-radius:9px;text-decoration:none;color:var(--ink2);font-size:.9375rem;font-weight:500}
  .nav-links a:hover{background:#f1f5f9}
  .nav-links a.active{color:#3730a3;background:var(--indigo-soft)}
  .nav-desktop{display:flex;align-items:center;gap:8px}
  .burger,.menu,.scrim{display:none}
}

/* home hero */
.hero-bg{background:radial-gradient(900px 420px at 15% -10%,rgba(99,102,241,.16),transparent),radial-gradient(700px 380px at 90% 0%,rgba(244,114,182,.14),transparent),radial-gradient(600px 300px at 50% 100%,rgba(251,191,36,.1),transparent)}
.hero{text-align:center;padding-top:32px;padding-bottom:32px}
.cta{display:flex;flex-direction:column;gap:10px;margin:24px 0 14px}
.cta .btn{width:100%}
@media(min-width:640px){.hero{padding-top:52px;padding-bottom:44px}.cta{flex-direction:row;justify-content:center}.cta .btn{width:auto}}

/* demo viewer */
.demo{display:grid;grid-template-columns:1fr;border-radius:20px;background:#fff;overflow:hidden;box-shadow:0 20px 60px rgba(79,70,229,.12)}
.demo .doc{padding:18px;border-bottom:1px solid var(--line);font-family:Georgia,"Times New Roman",serif;font-size:1rem;line-height:1.75;color:#1e293b;background:#fffefb}
.demo .doc p{margin:0 0 12px}
.hl{display:inline;border:0;font:inherit;color:inherit;padding:4px 6px;border-radius:6px;transition:.15s}
.hl.rose{background:#fecdd3}
.hl.amber{background:#fde68a}
.hl.on.rose{box-shadow:0 0 0 3px rgba(225,29,72,.3)}
.hl.on.amber{box-shadow:0 0 0 3px rgba(217,119,6,.35)}
.demo .side{padding:16px;display:flex;flex-direction:column;gap:10px;background:#fbfcfe}
.find{border:1px solid var(--line);border-radius:14px;padding:14px;background:#fff;cursor:pointer;text-align:left;color:inherit;transition:.15s}
.find.on{border-color:#818cf8;box-shadow:0 6px 20px rgba(79,70,229,.12)}
@media(min-width:780px){.demo{grid-template-columns:1.15fr 1fr}.demo .doc{border-bottom:0;border-right:1px solid var(--line);padding:22px}}

/* bento */
.bento{display:grid;grid-template-columns:1fr;gap:12px}
.tile{padding:20px;border-radius:20px;background:#fff;border:1px solid var(--line);transition:.18s}
.tile:hover{border-color:#a5b4fc;box-shadow:0 12px 34px rgba(79,70,229,.1)}
.tile .ic{font-size:1.6rem;margin-bottom:8px}
.tile h3{margin:0 0 6px;font-size:1.1875rem;letter-spacing:-.01em}
.tile p{margin:0;color:var(--ink2);font-size:1rem}
@media(min-width:780px){.bento{grid-template-columns:repeat(6,1fr);gap:14px}.tile{grid-column:span 3;padding:22px}.tile:nth-child(1),.tile:nth-child(4){grid-column:span 4}.tile:nth-child(2),.tile:nth-child(3){grid-column:span 2}}

/* trust + cta bands + faq */
.trust{display:flex;gap:14px;align-items:flex-start;padding:20px;border-radius:20px;background:linear-gradient(135deg,#0f172a,#312e81);color:#e0e7ff}
.trust b{color:#fff;font-size:1.1875rem}
.trust p{margin:6px 0 0;color:#c7d2fe;font-size:1rem}
.band{text-align:center;padding:32px 18px;border-radius:24px;background:linear-gradient(135deg,#eef2ff,#fdf2f8 60%,#fffbeb);border:1px solid #e0e7ff}
.faq{background:#fff;border:1px solid var(--line);border-radius:14px;padding:2px 16px;margin-top:10px}
.faq summary{cursor:pointer;min-height:52px;padding:12px 0;font-size:1.0625rem;font-weight:600;list-style:none;display:flex;align-items:center;justify-content:space-between;gap:10px}
.faq summary::-webkit-details-marker{display:none}
.faq summary::after{content:"+";color:var(--muted);font-weight:500;font-size:1.4rem;line-height:1}
.faq[open] summary::after{content:"–"}
.faq p{margin:0 0 14px;color:var(--ink2);font-size:1rem}

/* gauge + report header */
.gauge{position:relative;width:min(220px,100%);margin:0 auto}
.gauge svg{width:100%;display:block}
.gauge .trk{fill:none;stroke:#e2e8f0;stroke-width:10;stroke-linecap:round}
.gauge .val{fill:none;stroke-width:10;stroke-linecap:round;transition:stroke-dasharray .9s cubic-bezier(.2,.8,.2,1),stroke .3s}
.gauge .gnum{position:absolute;left:0;right:0;bottom:-2px;text-align:center;font-size:2.2rem;font-weight:800;line-height:1}
.gauge .gnum span{font-size:.9375rem;color:var(--muted);font-weight:600}
.report-head{display:grid;grid-template-columns:1fr;gap:16px;align-items:center}
@media(min-width:640px){.report-head{grid-template-columns:230px 1fr;gap:20px}}

/* clause cards */
.clause{background:#fff;border:1px solid var(--line);border-left:4px solid #94a3b8;border-radius:16px;padding:16px;margin-top:14px;box-shadow:0 1px 2px rgba(15,23,42,.04)}
.clause.high{border-left-color:var(--rose)}
.clause.med{border-left-color:#d97706}
.clause.low{border-left-color:#10b981}
.clause-h{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}
.catlabel{font-weight:700;font-size:1.0625rem;letter-spacing:-.01em;color:#0f172a}
blockquote.redline{margin:0;padding:12px 14px;border-radius:10px;background:#fff7f8;border:1px solid #fecdd3;font-size:.9688rem;line-height:1.65;color:#4c0519}
.clause.med blockquote.redline{background:#fffdf5;border-color:#fde68a;color:#451a03}
.clause.low blockquote.redline{background:#f7fefb;border-color:#a7f3d0;color:#022c22}
.redline mark{background:#fecdd3;color:#881337;text-decoration:line-through;text-decoration-color:#e11d48;border-radius:3px;padding:0 2px}
.clause.med .redline mark{background:#fde68a;color:#78350f;text-decoration-color:#d97706}
.clause.low .redline mark{background:#bbf7d0;color:#14532d;text-decoration-color:#059669}
.why{margin:0;color:var(--ink2);font-size:1rem}
.acc-btn{width:100%;display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:14px;min-height:48px;padding:10px 14px;border-radius:12px;border:1px solid var(--line);background:#f8fafc;font-weight:600;font-size:1rem;text-align:left;color:var(--ink);transition:.15s}
.acc-btn:hover{border-color:#818cf8;background:var(--indigo-soft)}
.chev{transition:transform .25s}
.chev.rot{transform:rotate(180deg)}
.acc{display:grid;grid-template-rows:0fr;transition:grid-template-rows .3s ease}
.acc.open{grid-template-rows:1fr}
.acc-in{overflow:hidden;min-width:0}
.acc.open .acc-in{padding-top:12px}
.ins{background:var(--green-bg);border:1px solid #a7f3d0;color:#064e3b;border-radius:10px;padding:12px 14px;margin:0 0 10px;line-height:1.65;font-size:.9688rem}
.mail{background:#f8fafc;border:1px solid var(--line);border-radius:10px;padding:12px 14px;font-size:.9688rem;line-height:1.65;margin:0 0 10px;color:var(--ink)}
.rw-h{display:flex;flex-direction:column;align-items:stretch;gap:8px;margin:2px 0 8px}
.rw-h .btn{width:100%}
.rw-tag{font-size:.8125rem;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--green)}
@media(min-width:640px){.rw-h{flex-direction:row;justify-content:space-between;align-items:center}.rw-h .btn{width:auto}}
.locked{position:relative}
.blurred{filter:blur(7px);opacity:.55;pointer-events:none;user-select:none}
.lock-over{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:6px}
.lock-card{width:100%;max-width:420px;text-align:center;padding:16px;border-radius:16px;background:rgba(255,255,255,.97);border:1px solid #c7d2fe;box-shadow:0 14px 40px rgba(15,23,42,.18)}
.lock-t{font-weight:700;font-size:1.0625rem;margin-bottom:10px;color:#0f172a}

/* scanner */
.drop{border:1.5px dashed #94a3b8;border-radius:16px;padding:28px 16px;text-align:center;background:#f8fafc;cursor:pointer;transition:.15s;margin-bottom:12px}
.drop:hover,.drop.drag{border-color:var(--indigo);background:var(--indigo-soft)}
.drop .big{font-size:2rem}
.fileinfo{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:0 0 12px;font-size:.9375rem;color:var(--ink2)}
.scan{padding:16px;border-radius:14px;background:var(--indigo-soft);border:1px solid #c7d2fe;margin-top:12px}
.scan ul{margin:0;padding:0}
.scan li{list-style:none;padding:6px 0;color:#475569;font-size:1rem;display:flex;gap:10px;align-items:center}
.scan li.now{color:#3730a3;font-weight:700}
.scan li.done{color:var(--green)}
.spin{width:16px;height:16px;border-radius:50%;border:2px solid #c7d2fe;border-top-color:var(--indigo);animation:sp .8s linear infinite;display:inline-block}
@keyframes sp{to{transform:rotate(360deg)}}

/* pricing */
.packs{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px;margin-top:20px}
.pack{position:relative;background:#fff;border:1px solid var(--line);border-radius:20px;padding:26px 18px 18px;text-align:center;transition:.18s}
.pack:hover{border-color:#a5b4fc}
.pack.popular{border-color:#818cf8;box-shadow:0 14px 40px rgba(79,70,229,.16)}
.ribbon{position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:linear-gradient(90deg,#4f46e5,#c026d3);color:#fff;font-size:.8125rem;font-weight:700;padding:3px 14px;border-radius:999px;white-space:nowrap}
.price{font-size:2.5rem;font-weight:800;letter-spacing:-.03em;margin:4px 0;color:#0f172a}
.feat{list-style:none;padding:0;margin:12px 0 16px;text-align:left;font-size:1rem;color:var(--ink2)}
.feat li{padding:5px 0 5px 26px;position:relative}
.feat li::before{content:"✓";position:absolute;left:0;color:var(--green);font-weight:800}
.tier{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;margin-top:18px;max-width:860px;margin-left:auto;margin-right:auto}
.stepno{width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;margin-bottom:8px;background:var(--indigo-soft);color:#3730a3}

/* calculator */
.meter{position:relative;height:12px;border-radius:999px;margin:12px 0 6px;background:linear-gradient(90deg,#10b981,#f59e0b,#e11d48)}
.pin{position:absolute;top:-5px;width:6px;height:22px;margin-left:-3px;border-radius:3px;background:var(--ink);transition:left .4s ease}
.mlabels{display:flex;justify-content:space-between;font-size:.8125rem;color:var(--muted);margin-bottom:8px}
.lines{list-style:none;margin:12px 0;padding:0}
.lines li{display:flex;justify-content:space-between;gap:12px;padding:12px 0;border-bottom:1px solid var(--line);font-size:1rem}
.lines li span{color:var(--ink2)}
.lines li b{text-align:right}

/* legal prose */
.prose h2{font-size:1.25rem;margin:28px 0 8px;letter-spacing:-.01em;color:#0f172a}
.prose p{color:var(--ink2);margin:0 0 12px;font-size:1rem}

/* disclaimer + footer */
.disc{display:flex;gap:10px;padding:12px 14px;border-radius:12px;background:var(--amber-bg);border:1px solid #fde68a;color:#78350f;font-size:.9375rem}
.foot{border-top:1px solid var(--line);background:#fff;padding:28px 0 40px;margin-top:20px}
.flinks{display:flex;flex-wrap:wrap;gap:0 18px;margin:12px 0}
.flinks a{display:inline-flex;align-items:center;min-height:44px;color:var(--ink2);text-decoration:none;font-size:1rem}
.flinks a:hover{color:var(--indigo)}

/* modals (bottom sheet on phones) */
.backdrop{position:fixed;inset:0;z-index:80;background:rgba(15,23,42,.5);display:flex;align-items:flex-end;justify-content:center;padding:0;overflow-y:auto}
.modal{position:relative;width:100%;max-width:100%;max-height:92vh;max-height:92dvh;overflow-y:auto;border-radius:20px 20px 0 0;padding:22px 18px calc(22px + env(safe-area-inset-bottom,0px));background:#fff;box-shadow:0 -20px 60px rgba(15,23,42,.35)}
.modal h2{margin:0 0 8px;font-size:1.375rem;padding-right:44px}
.x{position:absolute;top:8px;right:8px;width:44px;height:44px;background:none;border:0;color:var(--muted);font-size:1.25rem}
.links{display:flex;gap:4px 18px;flex-wrap:wrap;justify-content:center;margin-top:10px}
.links button,.linkbtn{min-height:44px;background:none;border:0;color:var(--indigo);font:inherit;font-size:.9375rem;font-weight:600;padding:0 4px}
.gbtn{gap:10px}
.or{display:flex;align-items:center;gap:12px;color:var(--muted);font-size:.9375rem;margin:14px 0}
.or::before,.or::after{content:"";flex:1;border-top:1px solid var(--line)}
@media(min-width:640px){.backdrop{align-items:center;padding:14px}.modal{max-width:440px;border-radius:20px}}

/* v3: plan pill, tools, devices */
.pl-pre{display:none}
@media(min-width:360px){.pl-pre{display:inline}}
.planpill.pro{background:linear-gradient(135deg,#4f46e5,#c026d3);border-color:transparent;color:#fff}
@media(min-width:1024px){.nav-links a.opt{display:none}}
@media(min-width:1280px){.nav-links a.opt{display:inline-flex}}
.rev{height:10px;border-radius:999px;background:#e2e8f0;overflow:hidden;margin:4px 0 2px}
.rev-fill{height:100%;background:linear-gradient(90deg,#10b981,#f59e0b);border-radius:999px;transition:width .4s}
.rev-fill.full{background:#e11d48}
.dev{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 0;border-bottom:1px solid var(--line)}
.lvl{margin-top:14px;padding:12px;border:1px solid var(--line);border-radius:12px;background:#fff}
.lvl.sug{border-color:#818cf8;box-shadow:0 6px 20px rgba(79,70,229,.1)}
.steps{padding-left:20px;line-height:1.7;color:var(--ink2)}

/* referral + admin */
.stats4{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-top:14px}
.stat4{background:#fff;border:1px solid var(--line);border-radius:14px;padding:14px;min-width:0}
.stat4 span{display:block;font-size:.875rem;color:var(--muted)}
.stat4 b{display:block;font-size:1.45rem;font-weight:800;letter-spacing:-.02em;overflow-wrap:anywhere}
@media(min-width:780px){.stats4{grid-template-columns:repeat(4,1fr)}}
.linkrow{display:flex;flex-direction:column;gap:8px}
.linkrow input{margin:0}
@media(min-width:640px){.linkrow{flex-direction:row}.linkrow input{flex:1}}
.bars{display:flex;align-items:flex-end;gap:8px;height:150px;margin-top:12px}
.barcol{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;min-width:0}
.bar{width:100%;max-width:46px;border-radius:8px 8px 0 0;background:linear-gradient(180deg,#818cf8,#4f46e5);min-height:3px}
.barcol small{font-size:.8125rem;color:var(--muted);margin:4px 0 0;white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis}
.payrow{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;padding:12px 0;border-bottom:1px solid var(--line)}

/* v8: font fallback, load skeletons, desktop polish */
@font-face{font-family:"Inter Fallback";src:local("Arial");ascent-override:90.2%;descent-override:22.48%;line-gap-override:0%;size-adjust:107.4%}
.modes{display:grid;grid-template-columns:1fr;gap:14px}
@media(min-width:640px){.modes{grid-template-columns:repeat(2,1fr)}}
@media(min-width:1000px){.modes{grid-template-columns:repeat(4,1fr)}}
.skel{display:inline-block;border-radius:999px;background:linear-gradient(90deg,#e2e8f0,#f1f5f9,#e2e8f0);background-size:200% 100%;animation:skel 1.2s linear infinite}
.skel.pill{width:84px;height:36px}
.skel.act{width:80px;height:34px}
@keyframes skel{to{background-position:-200% 0}}
@media(min-width:900px){.btn.lg.block{max-width:420px}}
@media(min-width:640px){.rw-h .btn{min-width:11rem}}

/* v9: responsive overhaul */
img,svg,video,canvas,iframe{max-width:100%}
.btn,.badge,.pill{max-width:100%}
.card,.clause,.stat4,.tile,.pack,.modal{min-width:0}
.brand,.nav-right{flex-shrink:0}
@media(min-width:640px){.hero{padding-top:48px;padding-bottom:40px}}
@media(min-width:900px){.chips{flex-wrap:wrap;overflow:visible;padding-bottom:0}}
@media(min-width:1024px){
  .burger,.menu,.scrim{display:none!important}
  .nav-in{padding-left:28px;padding-right:28px;gap:16px}
  .nav-links{flex:1;justify-content:center;min-width:0}
  .nav-links a{white-space:nowrap}
  .nav-right{gap:10px}
  .wrap{padding-left:28px!important;padding-right:28px!important}
}
@media(min-width:1024px) and (max-width:1199px){.nav-links a{padding:8px 8px;font-size:.875rem}.nav-right{gap:8px}}
@media(min-width:1280px){.narrow{max-width:940px}}
@media(min-width:1600px){.wrap:not(.narrow){max-width:1240px}.nav-in{max-width:1240px}}

/* v9: guides */
.crumbs{font-size:.875rem;color:var(--muted);margin:0 0 10px}
.crumbs a{color:var(--indigo)}
.trap{margin:10px 0 0;padding:14px 16px;border-left:4px solid #f43f5e;background:#fff1f2;border-radius:0 12px 12px 0;color:#9f1239;font-weight:500;overflow-wrap:break-word}
.gsec{margin-top:26px}
.gsec h2{font-size:1.25rem;margin:0 0 8px}
.stickycta{position:sticky;bottom:10px;z-index:40;margin-top:28px;padding:12px;border-radius:16px;background:#fff;border:1px solid #c7d2fe;box-shadow:0 12px 32px rgba(79,70,229,.2);display:flex;flex-direction:column;gap:10px;align-items:stretch;text-align:center}
.stickycta b{font-size:.9375rem;line-height:1.35}
@media(min-width:640px){.stickycta{flex-direction:row;align-items:center;justify-content:space-between;text-align:left}.stickycta .btn{flex-shrink:0}}
.gl{list-style:none;margin:8px 0 0;padding:0;display:grid;gap:10px}
.gcard{display:block;padding:14px 16px;background:#fff;border:1px solid var(--line);border-radius:14px;text-decoration:none;color:inherit;min-width:0;overflow-wrap:break-word}
.gcard:hover{border-color:#818cf8}
.gcard b{display:block;font-size:1.0625rem;line-height:1.3;margin:6px 0 4px;color:var(--ink)}
.gcard .d{display:block;font-size:.9375rem;color:var(--muted)}
.guides-grid{display:grid;grid-template-columns:1fr;gap:12px;margin-top:12px}
@media(min-width:700px){.guides-grid{grid-template-columns:repeat(2,1fr)}}
@media(min-width:1100px){.guides-grid{grid-template-columns:repeat(3,1fr)}}
.mbadge{display:inline-block;padding:2px 10px;border-radius:999px;font-size:.8125rem;font-weight:600;background:var(--indigo-soft);color:#3730a3}
`);

F("src/lib/app.js", String.raw`import { writable, derived, get } from "svelte/store";
import { createClient } from "@supabase/supabase-js";
import { ROUTE_META, SITE } from "./meta.mjs";

const SB_URL = import.meta.env.VITE_SUPABASE_URL;
const SB_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const sb = SB_URL && SB_KEY ? createClient(SB_URL, SB_KEY) : null;

export const UPI_ID = "8796021247@fam";
export const MAX_CHARS = 10000;

export function normalize(p) {
  let x = String(p || "/").split("?")[0].split("#")[0];
  if (x.length > 1) x = x.replace(/\/+$/, "");
  return x || "/";
}

export const route = writable(typeof window === "undefined" ? "/" : normalize(window.location.pathname));
export const session = writable(null);
export const profile = writable({ pro_until: null, pro_plan: null, ref_code: null, wallet_balance: 0, loaded: false });
export const isPro = derived(profile, function (p) { return !!(p.pro_until && new Date(p.pro_until).getTime() > Date.now()); });
export const deviceState = writable({ blocked: false, revoked: false, devices: [], limit: 1, plan: "free", loaded: false });
export const authModal = writable({ open: false, mode: "login", note: "" });
export const payModal = writable({ open: false, planId: "pro_year" });
export const showRecovery = writable(false);
export const scanMode = writable("freelance");
export const authReady = writable(false);
export const scanJur = writable("india");
export const bootSlow = writable(false);
export const user = derived(session, function (s) { return s ? s.user : null; });

let currentUser = null;
user.subscribe(function (u) { currentUser = u; });

function setAttr(sel, attr, val) {
  const el = document.querySelector(sel);
  if (el) el.setAttribute(attr, val);
}

export function applyMeta(p) {
  const m = ROUTE_META[p];
  const title = m ? m.title : "Page not found – ClauseRadar";
  const desc = m ? m.description : "This page could not be found.";
  const url = SITE + (p === "/" ? "" : p);
  document.title = title;
  setAttr('meta[name="description"]', "content", desc);
  setAttr('link[rel="canonical"]', "href", url);
  setAttr('meta[name="robots"]', "content", m && m.index ? "index,follow" : "noindex,nofollow");
  setAttr('meta[property="og:title"]', "content", title);
  setAttr('meta[property="og:description"]', "content", desc);
  setAttr('meta[property="og:url"]', "content", url);
  setAttr('meta[name="twitter:title"]', "content", title);
  setAttr('meta[name="twitter:description"]', "content", desc);
}

export function go(path) {
  if (typeof window === "undefined") return;
  const p = normalize(path);
  if (normalize(window.location.pathname) !== p) window.history.pushState({}, "", p);
  route.set(p);
  applyMeta(p);
  window.scrollTo(0, 0);
}

export function link(e, path) {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1) return;
  e.preventDefault();
  go(path);
}

export async function refreshProfile(uid) {
  if (!sb) return;
  try {
    let r = await sb.from("profiles").select("pro_until,pro_plan,ref_code,wallet_balance").eq("id", uid).maybeSingle();
    if (r.error) r = await sb.from("profiles").select("pro_until,pro_plan").eq("id", uid).maybeSingle();
    const d = r.error ? {} : r.data || {};
    profile.set({ pro_until: d.pro_until || null, pro_plan: d.pro_plan || null, ref_code: d.ref_code || null, wallet_balance: Number(d.wallet_balance) || 0, loaded: true });
  } catch (e) {
    profile.update(function (p) { return Object.assign({}, p, { loaded: true }); });
  }
}

/* ---------- devices (Free: 1 at a time, Pro: 3) ---------- */
export function getDeviceId() {
  try {
    let id = window.localStorage.getItem("cr_device");
    if (!id) {
      id = window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : "d" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      window.localStorage.setItem("cr_device", id);
    }
    return id;
  } catch (e) {
    return "device-" + Math.random().toString(36).slice(2, 14);
  }
}

export function deviceLabel() {
  const ua = String(window.navigator.userAgent || "");
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /SamsungBrowser/.test(ua) ? "Samsung Internet" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /Android/.test(ua) ? "Android" : /iPhone|iPad|iPod/.test(ua) ? "iOS" : /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "device";
  return browser + " on " + os;
}

export function markFreshLogin() {
  try { window.sessionStorage.setItem("cr_fresh", "1"); } catch (e) {}
}

async function deviceCall(action, extra) {
  const headers = await authHeaders();
  const body = Object.assign({ action: action, device_id: getDeviceId(), label: deviceLabel() }, extra || {});
  const r = await fetch("/api/device", { method: "POST", headers: headers, body: JSON.stringify(body) });
  return readJson(r);
}

export async function syncDevice(action) {
  if (!sb) return;
  try {
    let fresh = false;
    try { fresh = window.sessionStorage.getItem("cr_fresh") === "1"; window.sessionStorage.removeItem("cr_fresh"); } catch (e) {}
    const d = await deviceCall(action || "register", { fresh: fresh });
    if (d.error) return;
    if (d.revoked) { await sb.auth.signOut({ scope: "local" }); return; }
    deviceState.set({ blocked: !!d.blocked, revoked: false, devices: d.devices || [], limit: d.limit || 1, plan: d.plan || "free", loaded: true });
  } catch (e) {}
}

export async function revokeDevice(target) {
  if (!sb) return;
  try {
    const d = await deviceCall("revoke", { target: target });
    if (!d.error) deviceState.set({ blocked: !!d.blocked, revoked: false, devices: d.devices || [], limit: d.limit || 1, plan: d.plan || "free", loaded: true });
    if (d.blocked) await syncDevice("register");
  } catch (e) {}
}

export async function signOutThisDevice() {
  if (!sb) return;
  try { await deviceCall("revoke", { target: getDeviceId() }); } catch (e) {}
  await sb.auth.signOut({ scope: "local" });
  deviceState.set({ blocked: false, revoked: false, devices: [], limit: 1, plan: "free", loaded: false });
}

export function initApp() {
  const shell = document.getElementById("seo-shell");
  if (shell) shell.remove();
  const boot = document.getElementById("boot");
  if (boot) boot.remove();
  const bootErr = document.getElementById("boot-err");
  if (bootErr) bootErr.remove();
  setTimeout(function () { bootSlow.set(true); }, 3000);
  captureRef();
  if (!sb) authReady.set(true);
  const onPop = function () {
    const p = normalize(window.location.pathname);
    route.set(p);
    applyMeta(p);
    window.scrollTo(0, 0);
  };
  window.addEventListener("popstate", onPop);
  applyMeta(normalize(window.location.pathname));
  let beat = null;
  const unsubUser = user.subscribe(function (u) {
    if (beat) { clearInterval(beat); beat = null; }
    if (u) {
      refreshProfile(u.id);
      claimReferral(u);
      syncDevice("register");
      beat = setInterval(function () { if (document.visibilityState === "visible") syncDevice("register"); }, 4 * 60 * 1000);
    } else {
      profile.set({ pro_until: null, pro_plan: null, ref_code: null, wallet_balance: 0, loaded: false });
      deviceState.set({ blocked: false, revoked: false, devices: [], limit: 1, plan: "free", loaded: false });
    }
  });
  let authSub = null;
  if (sb) {
    try {
      sb.auth.getSession().then(function (r) { session.set(r.data ? r.data.session : null); authReady.set(true); }).catch(function () { authReady.set(true); });
    } catch (e) {
      authReady.set(true);
    }
    const res = sb.auth.onAuthStateChange(function (event, s) {
      session.set(s);
      if (event === "PASSWORD_RECOVERY") showRecovery.set(true);
      if (event === "SIGNED_IN") {
        // After Google sign-in the browser returns to the home page; send the user back to where they were.
        let back = null;
        try { back = window.sessionStorage.getItem("cr_return"); window.sessionStorage.removeItem("cr_return"); } catch (e) {}
        if (back && ROUTE_META[normalize(back)] && normalize(window.location.pathname) !== normalize(back)) go(back);
      }
    });
    authSub = res.data.subscription;
  }
  if (window.location.search.indexOf("debug=layout") !== -1) setTimeout(debugLayout, 900);
  return function () {
    window.removeEventListener("popstate", onPop);
    if (beat) clearInterval(beat);
    unsubUser();
    if (authSub) authSub.unsubscribe();
  };
}

// Open any page with ?debug=layout to see the real viewport width and which elements overflow it.
export function debugLayout() {
  const vw = document.documentElement.clientWidth;
  const bad = [];
  document.querySelectorAll("body *").forEach(function (el) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && (r.right > vw + 1 || r.left < -1)) bad.push(el);
  });
  bad.slice(0, 12).forEach(function (el) { el.style.outline = "2px solid red"; });
  const names = bad.slice(0, 6).map(function (el) {
    return el.tagName.toLowerCase() + (typeof el.className === "string" && el.className ? "." + el.className.split(" ").join(".") : "");
  });
  const meta = document.querySelector('meta[name="viewport"]');
  window.alert("innerWidth=" + window.innerWidth + " clientWidth=" + vw + " dpr=" + window.devicePixelRatio + "\nviewport meta: " + (meta ? meta.content : "MISSING") + "\noverflowing: " + (names.length ? names.join(" | ") : "none"));
}

export async function authHeaders() {
  const r = await sb.auth.getSession();
  const t = r.data && r.data.session ? r.data.session.access_token : "";
  return { "Content-Type": "application/json", Authorization: "Bearer " + t, "x-device-id": getDeviceId() };
}

export async function readJson(r) {
  const raw = await r.text();
  try { return JSON.parse(raw); } catch (e) { return { error: "Server error (HTTP " + r.status + ")" }; }
}

export function openAuth(mode, note) {
  authModal.set({ open: true, mode: mode || "login", note: note || "" });
}

export function openPay(planId) {
  if (!currentUser) { openAuth("login", "Log in first so Pro is added to your account."); return; }
  payModal.set({ open: true, planId: typeof planId === "string" ? planId : "pro_year" });
}

export function planLabel(pro) {
  return pro ? "Pro" : "Free";
}

export function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function fmt(s) {
  return String(s || "").replace(/\r\n/g, "\n").replace(/\\n/g, "\n");
}

export async function copyToClipboard(text) {
  const value = fmt(text);
  try {
    await navigator.clipboard.writeText(value);
  } catch (e) {
    const ta = document.createElement("textarea");
    ta.value = value;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } catch (e2) {}
    document.body.removeChild(ta);
  }
}

export function catLabel(c) {
  const s = String(c || "GENERAL").toUpperCase();
  if (s.indexOf("IP") === 0) return "IP Rights";
  if (s === "REVISIONS") return "Scope Creep";
  return s.toLowerCase().split("_").map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1); }).join(" ");
}

const RISKY = /(\b\d{2,3}\s*days?\b|\bunlimited\b|\bwithout (?:any )?limit\b|\bno cap\b|\buncapped\b|\bsole discretion\b|\bat no (?:extra|additional) cost\b|\bnet[- ]?\d{2,3}\b|\bwork made for hire\b|\bfrom the moment of creation\b|\bwithout notice\b|\bconsequential\b|\bwithout additional compensation\b)/gi;

export function segments(text) {
  const t = fmt(text);
  const out = [];
  let last = 0;
  t.replace(RISKY, function (m, g, idx) {
    if (idx > last) out.push({ t: t.slice(last, idx), hit: false });
    out.push({ t: m, hit: true });
    last = idx + m.length;
    return m;
  });
  if (last < t.length) out.push({ t: t.slice(last), hit: false });
  return out.length ? out : [{ t: t, hit: false }];
}

export function deriveScore(res) {
  const W = { HIGH: 26, MEDIUM: 14, LOW: 6 };
  let s = 0;
  (res.flagged_clauses || []).forEach(function (c) { s += W[c.risk_level] || 0; });
  const lvl = res.overall_risk_score;
  const lo = lvl === "HIGH" ? 70 : lvl === "MEDIUM" ? 40 : 0;
  const hi = lvl === "HIGH" ? 98 : lvl === "MEDIUM" ? 69 : 39;
  return Math.max(lo, Math.min(hi, s));
}


/* ---------- Contract Memory: projects and invoices (Supabase, row-level security) ---------- */
export const projects = writable([]);
export const invoices = writable([]);
export const activeProject = writable("");
export const memoryError = writable("");

const SCHEMA_HELP = "Please ensure supabase-v3.sql was executed in Supabase SQL editor.";

function isSchemaError(e) {
  const code = String((e && e.code) || "");
  const m = String((e && e.message) || e || "");
  return code === "PGRST205" || code === "PGRST204" || code === "42P01" || m.indexOf("schema cache") !== -1 || m.indexOf("does not exist") !== -1 || m.indexOf("Could not find the table") !== -1;
}

function friendly(e) {
  const m = String((e && e.message) || e || "");
  if (m.indexOf("FREE_LIMIT_PROJECTS") !== -1) return new Error("The Free plan allows 1 active project. Upgrade to Pro for unlimited projects.");
  if (m.indexOf("FREE_LIMIT_INVOICES") !== -1) return new Error("The Free plan allows 1 active invoice. Mark it paid or upgrade to Pro for unlimited invoices.");
  if (isSchemaError(e)) return new Error(SCHEMA_HELP);
  return new Error(m || "Database error. Please try again.");
}

function need() {
  if (!sb) throw new Error("Login is not configured yet.");
  const u = get(user);
  if (!u) throw new Error("Please log in first.");
  return u;
}

export async function loadProjects() {
  if (!sb || !get(user)) return;
  const r = await sb.from("projects").select("*").order("created_at", { ascending: false });
  if (r.error) { memoryError.set(friendly(r.error).message); return; }
  memoryError.set("");
  projects.set(r.data || []);
}

export async function saveProject(rec) {
  const u = need();
  const r = await sb.from("projects").insert(Object.assign({}, rec, { user_id: u.id })).select().single();
  if (r.error) throw friendly(r.error);
  projects.update(function (list) { return [r.data].concat(list.filter(function (p) { return p.id !== r.data.id; })); });
  activeProject.set(r.data.id);
  memoryError.set("");
  loadProjects();
  return r.data;
}

export async function updateProject(id, patch) {
  need();
  const r = await sb.from("projects").update(patch).eq("id", id);
  if (r.error) throw friendly(r.error);
  await loadProjects();
}

export async function deleteProject(id) {
  need();
  const r = await sb.from("projects").delete().eq("id", id);
  if (r.error) throw friendly(r.error);
  await loadProjects();
}

export async function loadInvoices() {
  if (!sb || !get(user)) return;
  const r = await sb.from("invoices").select("*").order("due_date", { ascending: true });
  if (r.error) { memoryError.set(friendly(r.error).message); return; }
  invoices.set(r.data || []);
}

export async function saveInvoice(rec) {
  const u = need();
  const r = await sb.from("invoices").insert(Object.assign({}, rec, { user_id: u.id }));
  if (r.error) throw friendly(r.error);
  await loadInvoices();
}

export async function markInvoicePaid(id, dateIso) {
  need();
  const r = await sb.from("invoices").update({ paid_at: dateIso }).eq("id", id);
  if (r.error) throw friendly(r.error);
  await loadInvoices();
}

export async function deleteInvoice(id) {
  need();
  const r = await sb.from("invoices").delete().eq("id", id);
  if (r.error) throw friendly(r.error);
  await loadInvoices();
}

export async function scopeUsage() {
  if (!sb || !get(user)) return null;
  const d = new Date();
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
  const r = await sb.from("scope_checks").select("id", { count: "exact", head: true }).gte("created_at", start);
  return r.error ? null : r.count || 0;
}

/* ---------- Referral program (30% commission) ---------- */
export const MIN_PAYOUT = 100;
export const referrals = writable([]);
export const payouts = writable([]);
export const refError = writable("");
const REF_SCHEMA_HELP = "Please ensure supabase-v4-referrals.sql was executed in Supabase SQL editor.";

export function captureRef() {
  try {
    const m = String(window.location.search || "").match(/[?&]ref=([A-Za-z0-9]{4,16})/);
    if (m) window.localStorage.setItem("cr_ref", m[1].toLowerCase());
  } catch (e) {}
}

export function getRef() {
  try { return window.localStorage.getItem("cr_ref") || ""; } catch (e) { return ""; }
}

export function referralLink(code) {
  return SITE + "/?ref=" + code;
}

export async function claimReferral(u) {
  const code = getRef();
  if (!sb || !u || !code) return;
  const key = "cr_ref_claimed_" + u.id;
  try { if (window.localStorage.getItem(key) === code) return; } catch (e) {}
  try {
    const r = await sb.rpc("claim_referral", { p_code: code });
    if (!r.error) window.localStorage.setItem(key, code);
  } catch (e) {}
}

function refFriendly(e) {
  const code = String((e && e.code) || "");
  const m = String((e && e.message) || e || "");
  if (m.indexOf("INVALID_UPI") !== -1) return new Error("Enter a valid UPI ID, like name@bank.");
  if (m.indexOf("MIN_PAYOUT") !== -1) return new Error("The minimum payout is ₹" + MIN_PAYOUT + ".");
  if (m.indexOf("INSUFFICIENT_BALANCE") !== -1) return new Error("You do not have enough balance.");
  if (m.indexOf("PENDING_EXISTS") !== -1) return new Error("You already have a pending payout. Wait for it to be approved.");
  if (code === "PGRST205" || code === "PGRST202" || code === "42P01" || m.indexOf("schema cache") !== -1 || m.indexOf("does not exist") !== -1 || m.indexOf("Could not find") !== -1) return new Error(REF_SCHEMA_HELP);
  return new Error(m || "Something went wrong. Please try again.");
}

export async function loadReferralData() {
  const u = get(user);
  if (!sb || !u) return;
  const a = await sb.from("referrals").select("*").order("created_at", { ascending: false });
  const b = await sb.from("payout_requests").select("*").order("created_at", { ascending: false });
  const err = a.error || b.error;
  if (err) { refError.set(refFriendly(err).message); return; }
  refError.set("");
  referrals.set(a.data || []);
  payouts.set(b.data || []);
  await refreshProfile(u.id);
}

export async function requestPayout(upi) {
  if (!sb || !get(user)) throw new Error("Please log in first.");
  const r = await sb.rpc("request_payout", { p_upi: String(upi || "").trim() });
  if (r.error) throw refFriendly(r.error);
  await loadReferralData();
  return r.data;
}
`);

F("src/lib/report.js", String.raw`import { fmt } from "./app.js";

function esc(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const CSS = "body{font-family:Inter,Arial,Helvetica,sans-serif;color:#0f172a;max-width:760px;margin:24px auto;padding:0 18px;line-height:1.55}h1{font-size:22px;margin:0}h2{font-size:15px;margin:22px 0 6px}.sub{color:#64748b;font-size:12px}.badge{display:inline-block;padding:2px 10px;border-radius:99px;font-size:11px;font-weight:700;background:#f1f5f9}.clause{border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;margin:14px 0;page-break-inside:avoid}.q{border-left:3px solid #e11d48;padding:6px 10px;background:#fff1f2;font-style:italic;white-space:pre-wrap}.t{white-space:pre-wrap}.lbl{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#64748b;margin:10px 0 3px}.foot{margin-top:24px;font-size:11px;color:#64748b;border-top:1px solid #e2e8f0;padding-top:10px}";

export function buildReportHtml(args) {
  const result = args.result;
  const unlockedData = args.unlockedData || {};
  const flagged = result.flagged_clauses || [];
  const all = flagged.length > 0 && flagged.every(function (c, i) { return !!unlockedData[i]; });
  let h = '<!doctype html><html><head><meta charset="utf-8"><title>ClauseRadar Audit Report</title><sty' + "le>" + CSS + "</sty" + "le></head><body>";
  h += "<h1>ClauseRadar Contract Audit Report</h1>";
  h += '<div class="sub">Generated ' + esc(new Date().toLocaleDateString()) + " • " + (args.jur === "global" ? "US / UK / Global" : "India") + " review • Risk score " + esc(args.score) + "/100</div>";
  h += "<h2>Overall risk: " + esc(result.overall_risk_score) + "</h2>";
  h += '<div class="t">' + esc(fmt(result.executive_summary)) + "</div>";
  flagged.forEach(function (c, i) {
    h += '<div class="clause"><b>' + esc(c.category) + '</b> <span class="badge">' + esc(c.risk_level) + " RISK</span>";
    h += '<div class="lbl">Clause found</div><div class="q">' + esc(fmt(c.problematic_fine_print)) + "</div>";
    h += '<div class="lbl">Why this is dangerous</div><div class="t">' + esc(fmt(c.why_it_hurts)) + "</div>";
    if (unlockedData[i]) {
      h += '<div class="lbl">Suggested safer rewrite</div><div class="t">' + esc(fmt(unlockedData[i].safe_counter_clause)) + "</div>";
      h += '<div class="lbl">Counter-proposal email</div><div class="t">' + esc(fmt(unlockedData[i].polite_client_negotiation_email)) + "</div>";
    }
    h += "</div>";
  });
  if (!all) h += '<div class="foot"><b>Preview report.</b> Unlock this audit in ClauseRadar to include safer rewrites and counter-proposal emails.</div>';
  h += '<div class="foot">ClauseRadar is an automated AI review tool, not a law firm. This report is not legal advice.</div></body></html>';
  return h;
}

export function openReport(args) {
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.open();
  w.document.write(buildReportHtml(args));
  w.document.close();
  setTimeout(function () { try { w.focus(); w.print(); } catch (e) {} }, 500);
  return true;
}
`);
// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------
F("src/lib/RiskBadge.svelte", String.raw`<script>
  export let level = "MEDIUM";
  export let label = "";
  $: cls = level === "HIGH" ? "high" : level === "LOW" ? "low" : "med";
</script>

<span class="badge {cls}"><i class="dot"></i>{label || level + " RISK"}</span>
`);

F("src/lib/RiskGauge.svelte", String.raw`<script>
  export let score = 0;
  export let level = "MEDIUM";
  const LEN = 157.08;
  $: dash = (LEN * Math.max(0, Math.min(100, score))) / 100;
  $: color = level === "HIGH" ? "#e11d48" : level === "LOW" ? "#059669" : "#d97706";
</script>

<div class="gauge" role="img" aria-label="Risk score {score} out of 100">
  <svg viewBox="0 0 120 68" aria-hidden="true">
    <path class="trk" d="M10 60 A50 50 0 0 1 110 60" />
    <path class="val" d="M10 60 A50 50 0 0 1 110 60" style="stroke:{color};stroke-dasharray:{dash} 157.08" />
  </svg>
  <div class="gnum num">{score}<span>/100</span></div>
</div>
`);

F("src/lib/DisclaimerBanner.svelte", String.raw`<div class="disc" role="note">
  <span aria-hidden="true">⚖️</span>
  <div><b>Not legal advice.</b> ClauseRadar is an automated AI review tool, not a law firm. Have a qualified lawyer review important contracts before you sign.</div>
</div>
`);

F("src/lib/RewriteBox.svelte", String.raw`<script>
  import { copyToClipboard, fmt } from "./app.js";
  export let clause = "";
  export let email = "";
  let copied = "";
  async function copy(kind, text) {
    await copyToClipboard(text);
    copied = kind;
    setTimeout(function () { if (copied === kind) copied = ""; }, 1600);
  }
</script>

<div class="rw">
  <div class="rw-h">
    <span class="rw-tag">Suggested safer rewrite</span>
    <button class="btn sm" on:click={() => copy("c", clause)}>{copied === "c" ? "Copied ✓" : "Copy Clause"}</button>
  </div>
  <p class="ins">{fmt(clause)}</p>
  <div class="rw-h">
    <span class="rw-tag">Counter-proposal email</span>
    <button class="btn sm primary" on:click={() => copy("e", email)}>{copied === "e" ? "Copied ✓" : "Copy Counter-Proposal Email"}</button>
  </div>
  <div class="mail">{fmt(email)}</div>
</div>
`);

F("src/lib/ClauseCard.svelte", String.raw`<script>
  import RiskBadge from "./RiskBadge.svelte";
  import RewriteBox from "./RewriteBox.svelte";
  import { catLabel, segments, fmt } from "./app.js";

  export let clause;
  export let unlocked = null;
  export let startOpen = false;
  export let unlockLabel = "Unlock";
  export let unlocking = false;
  export let unlockError = "";
  export let onUnlock = function () {};

  let open = startOpen;
  let wasUnlocked = !!unlocked;
  $: if (unlocked && !wasUnlocked) { open = true; wasUnlocked = true; }
  $: segs = segments(clause.problematic_fine_print);
  $: cls = clause.risk_level === "HIGH" ? "high" : clause.risk_level === "LOW" ? "low" : "med";
</script>

<article class="clause {cls}">
  <div class="clause-h">
    <span class="catlabel">{catLabel(clause.category)}</span>
    <RiskBadge level={clause.risk_level} />
  </div>

  <div class="lbl">Clause found</div>
  <blockquote class="redline">{#each segs as s}{#if s.hit}<mark>{s.t}</mark>{:else}{s.t}{/if}{/each}</blockquote>

  <div class="lbl">Why this is dangerous</div>
  <p class="why pre">{fmt(clause.why_it_hurts)}</p>

  <button class="acc-btn" aria-expanded={open} on:click={() => (open = !open)}>
    <span>Suggested safer rewrite &amp; counter-proposal</span>
    <span class="chev" class:rot={open}>▾</span>
  </button>
  <div class="acc" class:open>
    <div class="acc-in">
      {#if unlocked}
        <RewriteBox clause={unlocked.safe_counter_clause} email={unlocked.polite_client_negotiation_email} />
      {:else}
        <div class="locked">
          <div class="blurred" aria-hidden="true">
            <p class="ins">The Contractor shall invoice the Client upon delivery and the Client shall pay each invoice within fourteen (14) days. Liability is limited to the fees paid under this Agreement.</p>
            <div class="mail">Subject: Request to update payment and liability terms{"\n\n"}Hi [Client Name], thank you for sending the agreement. Before signing, I would like to propose a few changes so both sides are protected...</div>
          </div>
          <div class="lock-over">
            <div class="lock-card">
              <div class="lock-t">🔒 Safer rewrite &amp; counter-proposal email locked</div>
              <button class="btn primary block" on:click={onUnlock} disabled={unlocking}>
                {unlocking ? "Unlocking all clauses..." : unlockLabel}
              </button>
              {#if unlockError}<div class="error" role="alert">⚠️ {unlockError}</div>{/if}
            </div>
          </div>
        </div>
      {/if}
    </div>
  </div>
</article>
`);

F("src/lib/Footer.svelte", String.raw`<script>
  import { link } from "./app.js";
  import DisclaimerBanner from "./DisclaimerBanner.svelte";
  const LINKS = [["/dashboard", "Scanner"], ["/scope-guard", "Scope Guard"], ["/chaser", "Payment Chaser"], ["/sample", "Sample report"], ["/pricing", "Pricing"], ["/refer", "Earn 30% 💸"], ["/guides", "Guides"], ["/radar", "Risk calculator"], ["/vault", "Clause library"], ["/privacy", "Privacy"], ["/terms", "Terms"]];
  const year = new Date().getFullYear();
</script>

<footer class="foot">
  <div class="wrap">
    <DisclaimerBanner />
    <div class="flinks">
      {#each LINKS as l}<a href={l[0]} on:click={(e) => link(e, l[0])}>{l[1]}</a>{/each}
    </div>
    <p class="muted small">Scans are not saved by default and your contracts are never used to train models. Contract Memory is opt-in and stores only the terms you approve. Contract text is processed by third-party AI providers under their API terms.</p>
    <p class="muted small">© {year} ClauseRadar. All rights reserved.</p>
  </div>
</footer>
`);

F("src/lib/Modals.svelte", String.raw`<script>
  import { sb, user, deviceState, authModal, payModal, showRecovery, authHeaders, readJson, copyToClipboard, refreshProfile, revokeDevice, syncDevice, markFreshLogin, getRef, UPI_ID, fmtDate } from "./app.js";
  import { PLANS } from "./data.mjs";

  let email = "";
  let password = "";
  let authMsg = "";
  let authOk = false;
  let authBusy = false;
  let newPassword = "";
  let shot = null;
  let shotInput;
  let payBusy = false;
  let payMsg = "";
  let payOk = false;
  let copied = false;

  $: otherActive = ($deviceState.devices || []).filter(function (d) { return !d.current && d.active; });
  $: plan = PLANS.find(function (p) { return p.id === $payModal.planId; }) || PLANS[1];
  $: upiLink = "upi://pay?pa=" + UPI_ID + "&pn=ClauseRadar&am=" + plan.price + "&cu=INR&tn=ClauseRadar_Pro";

  function closeAuth() {
    authModal.update(function (m) { return Object.assign({}, m, { open: false }); });
    authMsg = "";
  }
  function setMode(mode) {
    authModal.update(function (m) { return Object.assign({}, m, { mode: mode }); });
    authMsg = "";
  }
  function openPayFromDevice() {
    deviceState.update(function (d) { return Object.assign({}, d, { blocked: false }); });
    payModal.set({ open: true, planId: "pro_year" });
  }

  function closePay() {
    payModal.update(function (m) { return Object.assign({}, m, { open: false }); });
    payMsg = "";
  }
  function pickPlan(id) {
    payModal.update(function (m) { return Object.assign({}, m, { planId: id }); });
  }

  async function submitAuth(e) {
    if (e) e.preventDefault();
    if (!sb) { authMsg = "Login is not configured yet (Supabase keys missing)."; return; }
    authBusy = true;
    authMsg = "";
    authOk = false;
    try {
      if ($authModal.mode === "forgot") {
        const r = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
        if (r.error) throw r.error;
        authOk = true;
        authMsg = "Password reset link sent. Check your email.";
      } else if ($authModal.mode === "signup") {
        const r = await sb.auth.signUp({ email: email.trim(), password: password, options: { emailRedirectTo: window.location.origin } });
        if (r.error) throw r.error;
        if (r.data && r.data.session) closeAuth();
        else { authOk = true; authMsg = "Account created. Check your email to confirm, then log in."; }
      } else {
        const r = await sb.auth.signInWithPassword({ email: email.trim(), password: password });
        if (r.error) throw r.error;
        password = "";
        markFreshLogin();
        closeAuth();
      }
    } catch (err) {
      authMsg = err && err.message ? err.message : "Something went wrong.";
    } finally {
      authBusy = false;
    }
  }

  async function googleSignIn() {
    if (!sb) { authMsg = "Login is not configured yet (Supabase keys missing)."; return; }
    authBusy = true;
    authMsg = "";
    authOk = false;
    markFreshLogin();
    try { window.sessionStorage.setItem("cr_return", window.location.pathname); } catch (e) {}
    const r = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } });
    if (r.error) {
      authMsg = r.error.message || "Google sign-in is not available right now.";
      authBusy = false;
    }
  }

  async function saveNewPassword(e) {
    if (e) e.preventDefault();
    if (newPassword.length < 6) { authMsg = "Use at least 6 characters."; return; }
    authBusy = true;
    authMsg = "";
    try {
      const r = await sb.auth.updateUser({ password: newPassword });
      if (r.error) throw r.error;
      showRecovery.set(false);
      newPassword = "";
    } catch (err) {
      authMsg = err && err.message ? err.message : "Could not update password.";
    } finally {
      authBusy = false;
    }
  }

  function shrinkImage(file) {
    return new Promise(function (resolve, reject) {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = function () {
        const ratio = Math.min(1, 1400 / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * ratio);
        c.height = Math.round(img.height * ratio);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL("image/jpeg", 0.82).split(",")[1]);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("Could not read this image.")); };
      img.src = url;
    });
  }

  function onShot(e) {
    shot = e.target.files && e.target.files[0] ? e.target.files[0] : null;
    payMsg = "";
  }

  async function copyUpi() {
    await copyToClipboard(UPI_ID);
    copied = true;
    setTimeout(function () { copied = false; }, 1600);
  }

  async function verifyPayment() {
    if (!shot) { payOk = false; payMsg = "Choose your payment screenshot first."; return; }
    payBusy = true;
    payMsg = "";
    payOk = false;
    try {
      const b64 = await shrinkImage(shot);
      const r = await fetch("/api/verify-payment", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ image: b64, mime: "image/jpeg", plan: plan.id, ref: getRef() }),
      });
      const data = await readJson(r);
      if (!r.ok || !data.success) throw new Error(data.error || "Verification failed.");
      if ($user) await refreshProfile($user.id);
      payOk = true;
      payMsg = "✅ Payment verified! Pro is active until " + fmtDate(data.pro_until) + ".";
      shot = null;
      if (shotInput) shotInput.value = "";
    } catch (err) {
      payOk = false;
      payMsg = err && err.message ? err.message : "Verification failed.";
    } finally {
      payBusy = false;
    }
  }
</script>

{#if $authModal.open}
  <div class="backdrop" role="presentation" on:click|self={closeAuth} on:keydown={(e) => e.key === "Escape" && closeAuth()}>
    <div class="modal" role="dialog" aria-modal="true">
      <button class="x" aria-label="Close" on:click={closeAuth}>✕</button>
      <h2>{$authModal.mode === "signup" ? "Create your account" : $authModal.mode === "forgot" ? "Reset password" : "Welcome back"}</h2>
      {#if $authModal.note}<p class="muted small">{$authModal.note}</p>{/if}
      {#if !sb}<div class="error">Supabase keys are missing, so login is disabled.</div>{/if}
      {#if $authModal.mode !== "forgot"}
        <button class="btn block gbtn" type="button" on:click={googleSignIn} disabled={authBusy}>
          <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" /><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" /><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" /><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" /></svg>
          Continue with Google
        </button>
        <div class="or">or use email</div>
      {/if}
      <form on:submit={submitAuth}>
        <input type="email" placeholder="Email" bind:value={email} required autocomplete="email" />
        {#if $authModal.mode !== "forgot"}
          <input type="password" placeholder="Password (min 6 characters)" bind:value={password} required minlength="6" autocomplete={$authModal.mode === "signup" ? "new-password" : "current-password"} />
        {/if}
        <button class="btn primary block" type="submit" disabled={authBusy}>
          {authBusy ? "Please wait..." : $authModal.mode === "signup" ? "Sign up" : $authModal.mode === "forgot" ? "Send reset link" : "Log in"}
        </button>
      </form>
      {#if authMsg}<div class={authOk ? "ok" : "error"}>{authMsg}</div>{/if}
      <div class="links">
        {#if $authModal.mode !== "login"}<button on:click={() => setMode("login")}>Log in</button>{/if}
        {#if $authModal.mode !== "signup"}<button on:click={() => setMode("signup")}>Create account</button>{/if}
        {#if $authModal.mode !== "forgot"}<button on:click={() => setMode("forgot")}>Forgot password?</button>{/if}
      </div>
    </div>
  </div>
{/if}

{#if $showRecovery}
  <div class="backdrop" role="presentation">
    <div class="modal" role="dialog" aria-modal="true">
      <h2>Set a new password</h2>
      <form on:submit={saveNewPassword}>
        <input type="password" placeholder="New password" bind:value={newPassword} minlength="6" required autocomplete="new-password" />
        <button class="btn primary block" type="submit" disabled={authBusy}>{authBusy ? "Saving..." : "Save password"}</button>
      </form>
      {#if authMsg}<div class="error">{authMsg}</div>{/if}
    </div>
  </div>
{/if}

{#if $payModal.open}
  <div class="backdrop" role="presentation" on:click|self={closePay} on:keydown={(e) => e.key === "Escape" && closePay()}>
    <div class="modal" role="dialog" aria-modal="true">
      <button class="x" aria-label="Close" on:click={closePay}>✕</button>
      <h2>Upgrade to Pro</h2>
      <div class="chips">
        {#each PLANS as p}
          <button class:on={$payModal.planId === p.id} on:click={() => pickPlan(p.id)}>{p.per === "year" ? "Yearly" : "Monthly"} • ₹{p.price.toLocaleString("en-IN")}{p.badge ? " (" + p.badge + ")" : ""}</button>
        {/each}
      </div>
      <p class="muted small">Pro: every rewrite unlocked, unlimited Scope Guard and Payment Chaser, PDF reports and up to 3 devices. This payment adds {plan.days} days of Pro. Renewal is manual.</p>

      <h3 class="sub">Step 1: Pay ₹{plan.price.toLocaleString("en-IN")}</h3>
      <a class="btn primary block upi" href={upiLink}>Tap to Pay with UPI ⚡</a>
      <p class="muted small">Opens GPay, PhonePe or Paytm on your phone. UPI ID: <b>{UPI_ID}</b>
        <button class="linkbtn" on:click={copyUpi}>{copied ? "Copied ✓" : "Copy"}</button>
      </p>

      <h3 class="sub">Step 2: Upload the payment screenshot</h3>
      <input type="file" accept="image/*" on:change={onShot} bind:this={shotInput} />
      <button class="btn block" on:click={verifyPayment} disabled={payBusy}>
        {payBusy ? "AI is verifying..." : "Verify payment & activate Pro"}
      </button>
      {#if payMsg}<div class={payOk ? "ok" : "error"}>{payMsg}</div>{/if}
    </div>
  </div>
{/if}

{#if $user && $deviceState.blocked}
  <div class="backdrop" role="presentation">
    <div class="modal" role="dialog" aria-modal="true">
      <h2>Device limit reached</h2>
      <p class="muted small">{$deviceState.plan === "pro" ? "Pro allows up to 3 devices at the same time." : "The Free plan allows 1 device at a time. Pro allows up to 3."} Sign out one of these devices to continue on this one.</p>
      {#each otherActive as d (d.device_id)}
        <div class="dev">
          <div style="min-width:0"><b>{d.label}</b><div class="muted small">Active now</div></div>
          <button class="btn sm" on:click={() => revokeDevice(d.device_id)}>Sign out</button>
        </div>
      {/each}
      <div class="row" style="margin-top:12px">
        {#if $deviceState.plan !== "pro"}<button class="btn primary mfull" on:click={openPayFromDevice}>Upgrade to Pro ⚡</button>{/if}
        <button class="btn mfull" on:click={() => syncDevice("register")}>Try again</button>
      </div>
    </div>
  </div>
{/if}
`);
F("src/lib/DemoViewer.svelte", String.raw`<script>
  import RiskBadge from "./RiskBadge.svelte";

  const ORDER = ["liab", "pay"];
  const FIND = {
    liab: {
      level: "HIGH",
      title: "Uncapped liability",
      why: "You could owe far more than the project paid. One dispute could wipe out a year of income.",
      fix: "The Contractor total liability shall not exceed the fees actually paid under this Agreement.",
    },
    pay: {
      level: "MEDIUM",
      title: "Net-90 delayed payout",
      why: "You would finance the client for three months, which puts your own rent and tools at risk.",
      fix: "Invoices are payable within fourteen (14) days. Unpaid amounts accrue a late fee of 1.5% per month.",
    },
  };
  let active = "liab";
  function key(e, k) {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); active = k; }
  }
</script>

<div class="demo iri">
  <div class="doc" aria-label="Sample contract text">
    <p><b>INDEPENDENT CONTRACTOR AGREEMENT</b></p>
    <p>7. Payment. Client shall pay Contractor within <button class="hl amber" class:on={active === "pay"} on:mouseenter={() => (active = "pay")} on:click={() => (active = "pay")}>ninety (90) days</button> of invoice approval.</p>
    <p>9. Liability. Contractor shall be liable for all losses of Client <button class="hl rose" class:on={active === "liab"} on:mouseenter={() => (active = "liab")} on:click={() => (active = "liab")}>without any limit or cap</button>, including indirect and consequential damages.</p>
    <p>11. Termination. Either party may terminate this Agreement on thirty (30) days written notice.</p>
  </div>
  <div class="side">
    {#each ORDER as k}
      <div class="find" class:on={active === k} role="button" tabindex="0" on:click={() => (active = k)} on:keydown={(e) => key(e, k)}>
        <div class="row between" style="margin:0"><b>{FIND[k].title}</b><RiskBadge level={FIND[k].level} /></div>
        {#if active === k}
          <p class="muted small" style="margin:8px 0 4px">{FIND[k].why}</p>
          <div class="lbl" style="margin:8px 0 4px">Suggested safer rewrite</div>
          <p class="ins" style="margin:0">{FIND[k].fix}</p>
        {/if}
      </div>
    {/each}
    <div class="small muted">Click a highlight or a finding. Sample text only.</div>
  </div>
</div>
`);

F("src/pages/Home.svelte", String.raw`<script>
  import { link, scanMode } from "../lib/app.js";
  import { BENTO, FAQS } from "../lib/data.mjs";
  import { GUIDES, MODE_LABELS } from "../lib/guides.mjs";
  const POPULAR = GUIDES.slice(0, 6);
  import DemoViewer from "../lib/DemoViewer.svelte";
  const ICONS = ["🛡️", "⏳", "🔐", "✉️"];
  const MODES = [
    { key: "freelance", icon: "💻", title: "Freelancers & Devs", text: "Client contracts: scope creep, Net-60/90 payment traps, uncapped liability and IP grabs." },
    { key: "creator", icon: "🎬", title: "BrandDeal Shield for Creators", text: "Sponsorship deals: perpetual ad usage and whitelisting, exclusivity, reshoots, payment terms and kill fees." },
    { key: "employment", icon: "🎓", title: "Offer Letter & Bond Shield", text: "Job offers: employment bonds, 90-day notice buyouts, side-project IP claims and non-competes." },
    { key: "agency", icon: "🏢", title: "Agency White-Label Shield", text: "Sub-contracts: pay-when-paid traps, non-solicitation, SLA penalties and uncapped indemnification." },
  ];
  function pickMode(e, key) {
    scanMode.set(key);
    link(e, "/dashboard");
  }
</script>

<section class="hero-bg">
  <div class="wrap hero">
    <a class="pill" href="/sample" on:click={(e) => link(e, "/sample")}>✨ ClauseRadar – contract protection for freelancers, creators, job seekers &amp; agencies <span aria-hidden="true">→</span></a>
    <h1 class="display">Audit any contract in 30 seconds. <span class="grad">Stop risky clauses before you sign.</span></h1>
    <p class="lead">ClauseRadar reads your freelance contract, creator brand deal, job offer letter or agency agreement, flags the traps (Net-90 payments, perpetual ad rights, employment bonds, pay-when-paid clauses), explains each risk in plain English and writes the counter-email for you.</p>
    <div class="cta">
      <a class="btn primary lg" href="/dashboard" on:click={(e) => link(e, "/dashboard")}>Upload Contract</a>
      <a class="btn lg" href="/sample" on:click={(e) => link(e, "/sample")}>View Sample Audit Report</a>
    </div>
    <p class="small muted">Free scan • Go Pro to unlock rewrites • PDF, DOCX or pasted text</p>
  </div>
</section>

<section class="wrap sec" style="padding-top:4px;padding-bottom:8px">
  <div class="center" style="margin-bottom:18px">
    <h2 class="h2">One scanner for every contract you sign</h2>
    <p class="muted">Pick your mode. ClauseRadar checks the traps that matter for your situation.</p>
  </div>
  <div class="modes">
    {#each MODES as m}
      <a class="card hover" href="/dashboard" on:click={(e) => pickMode(e, m.key)} style="margin-top:0;text-decoration:none">
        <div style="font-size:1.6rem">{m.icon}</div>
        <b style="display:block;margin:6px 0 4px;font-size:1.0625rem">{m.title}</b>
        <p class="muted small" style="margin:0">{m.text}</p>
      </a>
    {/each}
  </div>
</section>

<section class="wrap narrow" style="padding-bottom:24px">
  <DemoViewer />
</section>

<section class="wrap sec">
  <div class="center" style="margin-bottom:22px">
    <h2 class="h2">The clauses that quietly cost freelancers money</h2>
    <p class="muted">ClauseRadar finds them, explains them, and hands you the fix.</p>
  </div>
  <div class="bento">
    {#each BENTO as b, i}
      <div class="tile">
        <div class="ic">{ICONS[i]}</div>
        <h3>{b.title}</h3>
        <p>{b.text}</p>
      </div>
    {/each}
  </div>
</section>

<section class="wrap" style="padding-bottom:24px">
  <div class="trust">
    <div style="font-size:1.8rem" aria-hidden="true">🔒</div>
    <div>
      <b>Zero contract training.</b>
      <p>We never use your agreements to train models, and scans are not stored by default. If you opt in to Contract Memory, we save only the terms and short clause excerpts you review. Contract text is processed by third-party AI providers under their API terms.</p>
    </div>
  </div>
</section>

<section class="wrap narrow sec">
  <h2 class="h2 center">Frequently asked questions</h2>
  {#each FAQS as f}
    <details class="faq"><summary>{f.q}</summary><p>{f.a}</p></details>
  {/each}
</section>

<section class="wrap" style="padding-bottom:8px">
  <h2 class="h2 center">Popular contract guides</h2>
  <div class="guides-grid">
    {#each POPULAR as g (g.slug)}
      <a class="gcard" href={g.slug} on:click={(e) => link(e, g.slug)}><span class="mbadge">{MODE_LABELS[g.mode]}</span><b>{g.h1}</b><span class="d">{g.description}</span></a>
    {/each}
  </div>
  <p class="center" style="margin-top:14px"><a href="/guides" on:click={(e) => link(e, "/guides")}>See all contract guides →</a></p>
</section>

<section class="wrap" style="padding-bottom:40px">
  <div class="band">
    <h2 class="h2">Ready to protect your next freelance invoice?</h2>
    <p class="muted" style="max-width:520px;margin:0 auto 18px">Paste the contract, see the risks, and walk into the negotiation with the right clauses ready.</p>
    <a class="btn primary lg" href="/dashboard" on:click={(e) => link(e, "/dashboard")}>Upload Contract</a>
  </div>
</section>
`);

F("src/pages/Sample.svelte", String.raw`<script>
  import { SAMPLE_REPORT } from "../lib/data.mjs";
  import { link } from "../lib/app.js";
  import { openReport } from "../lib/report.js";
  import ClauseCard from "../lib/ClauseCard.svelte";
  import RiskBadge from "../lib/RiskBadge.svelte";
  import RiskGauge from "../lib/RiskGauge.svelte";

  const R = SAMPLE_REPORT;
  const unlocked = {};
  R.clauses.forEach(function (c, i) {
    unlocked[i] = { safe_counter_clause: c.safe_counter_clause, polite_client_negotiation_email: c.polite_client_negotiation_email };
  });
  const COUNTS = { HIGH: 0, MEDIUM: 0, LOW: 0 };
  R.clauses.forEach(function (c) { COUNTS[c.risk_level] += 1; });

  let filter = "ALL";
  let note = "";
  $: shown = R.clauses.map(function (c, i) { return { c: c, i: i }; }).filter(function (x) { return filter === "ALL" || x.c.risk_level === filter; });

  function exportPdf() {
    const ok = openReport({
      result: { overall_risk_score: R.level, executive_summary: R.summary, flagged_clauses: R.clauses },
      unlockedData: unlocked, jur: "global", score: R.score,
    });
    note = ok ? "" : "Allow pop-ups for this site to export the PDF.";
  }
</script>

<div class="wrap narrow page">
  <span class="pill">Interactive sample • fictional data</span>
  <h1 class="h2" style="margin-top:12px">Sample audit report</h1>
  <p class="muted">{R.title}. Open the cards, filter by severity, and copy the rewrites. No upload needed.</p>

  <section class="card iri">
    <div class="report-head">
      <RiskGauge score={R.score} level={R.level} />
      <div>
        <div class="row" style="margin-bottom:6px"><RiskBadge level={R.level} /><span class="muted small num">{R.clauses.length} flagged clauses</span></div>
        <p style="margin:0 0 10px">{R.summary}</p>
        <button class="btn sm mfull" on:click={exportPdf}>📄 Export PDF report</button>
        {#if note}<div class="error">{note}</div>{/if}
      </div>
    </div>
  </section>

  <div class="chips" style="margin-top:16px">
    <button class:on={filter === "ALL"} on:click={() => (filter = "ALL")}>All <span class="num">({R.clauses.length})</span></button>
    <button class:on={filter === "HIGH"} on:click={() => (filter = "HIGH")}>High <span class="num">({COUNTS.HIGH})</span></button>
    <button class:on={filter === "MEDIUM"} on:click={() => (filter = "MEDIUM")}>Medium <span class="num">({COUNTS.MEDIUM})</span></button>
    <button class:on={filter === "LOW"} on:click={() => (filter = "LOW")}>Low <span class="num">({COUNTS.LOW})</span></button>
  </div>

  {#each shown as x (x.i)}
    <ClauseCard clause={x.c} unlocked={unlocked[x.i]} startOpen={x.i === 0} />
  {/each}

  <div class="band" style="margin-top:28px">
    <h2 class="h2">Run this on your own contract</h2>
    <p class="muted" style="margin:0 0 16px">Scanning is free. Unlock the rewrites when you need them.</p>
    <a class="btn primary lg" href="/dashboard" on:click={(e) => link(e, "/dashboard")}>Upload Contract</a>
  </div>
</div>
`);

F("src/pages/Legal.svelte", String.raw`<script>
  import { LEGAL } from "../lib/legal.mjs";
  import DisclaimerBanner from "../lib/DisclaimerBanner.svelte";
  export let kind = "privacy";
  $: doc = LEGAL[kind] || LEGAL.privacy;
</script>

<div class="wrap narrow page prose">
  <h1 class="h2">{doc.title}</h1>
  <p class="muted small">Last updated {doc.updated}</p>
  <DisclaimerBanner />
  {#each doc.sections as s}
    <h2>{s.h}</h2>
    {#each s.p as para}<p>{para}</p>{/each}
  {/each}
</div>
`);
F("src/pages/Dashboard.svelte", String.raw`<script>
  import { onDestroy } from "svelte";
  import { get } from "svelte/store";
  import { scanMode, scanJur, isPro, MAX_CHARS, authHeaders, readJson, openPay, deriveScore, catLabel, fmt } from "../lib/app.js";
  import { SAMPLE_CONTRACTS } from "../lib/data.mjs";
  import { openReport } from "../lib/report.js";
  import ClauseCard from "../lib/ClauseCard.svelte";
  import MemorySave from "../lib/MemorySave.svelte";
  import RiskBadge from "../lib/RiskBadge.svelte";
  import RiskGauge from "../lib/RiskGauge.svelte";

  const MAX_FILE = 10 * 1024 * 1024;
  const STEPS = ["Reading your document", "Detecting risky clauses", "Scoring severity", "Drafting safer rewrites"];

  const MODES = [
    { key: "freelance", label: "Freelance / Client" },
    { key: "creator", label: "BrandDeal Shield (Creators)" },
    { key: "employment", label: "Job Offer & Bond" },
    { key: "agency", label: "Agency / Sub-Contract" },
  ];
  let mode = get(scanMode);
  let jur = get(scanJur);
  let text = "";
  let drag = false;
  let fileInfo = null;
  let fileInput;
  let readingFile = false;
  let loading = false;
  let step = 0;
  let timer = null;
  let error = "";
  let result = null;
  let unlockedData = {};
  let unlocking = false;
  let unlockError = "";
  let cat = "All";

  $: flagged = result && Array.isArray(result.flagged_clauses) ? result.flagged_clauses : [];
  $: score = result ? deriveScore(result) : 0;
  $: highCount = flagged.filter(function (c) { return c.risk_level === "HIGH"; }).length;
  $: allUnlocked = flagged.length > 0 && flagged.every(function (c, i) { return !!unlockedData[i]; });
  $: cats = ["All"].concat(flagged.map(function (c) { return catLabel(c.category); }).filter(function (v, i, a) { return a.indexOf(v) === i; }));
  $: shown = flagged.map(function (c, i) { return { c: c, i: i }; }).filter(function (x) { return cat === "All" || catLabel(x.c.category) === cat; });
  $: unlockLabel = $isPro ? "Unlock All Clauses (Pro) ⚡" : "Upgrade to Pro to Unlock All Clauses ⚡";

  onDestroy(function () { if (timer) clearInterval(timer); });

  /* ---------- reading files ---------- */
  function loadPdfJs() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    return new Promise(function (resolve, reject) {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
      s.onload = function () {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
        resolve(window.pdfjsLib);
      };
      s.onerror = function () { reject(new Error("Could not load the PDF reader. Check your internet.")); };
      document.head.appendChild(s);
    });
  }

  async function readPdf(file) {
    const lib = await loadPdfJs();
    const doc = await lib.getDocument({ data: await file.arrayBuffer() }).promise;
    let out = "";
    const pages = Math.min(doc.numPages, 30);
    for (let p = 1; p <= pages && out.length < MAX_CHARS * 2; p++) {
      const page = await doc.getPage(p);
      const tc = await page.getTextContent();
      out += tc.items.map(function (it) { return it.str; }).join(" ") + "\n";
    }
    return out;
  }

  // A .docx is a zip file. We read word/document.xml straight from it, no extra library needed.
  async function readDocx(file) {
    const buf = await file.arrayBuffer();
    const dv = new DataView(buf);
    const u8 = new Uint8Array(buf);
    const dec = new TextDecoder();
    let eocd = -1;
    for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 66000); i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error("This DOCX file could not be read. Paste the text instead.");
    const count = dv.getUint16(eocd + 10, true);
    let p = dv.getUint32(eocd + 16, true);
    for (let n = 0; n < count; n++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const method = dv.getUint16(p + 10, true);
      const csize = dv.getUint32(p + 20, true);
      const nlen = dv.getUint16(p + 28, true);
      const elen = dv.getUint16(p + 30, true);
      const clen = dv.getUint16(p + 32, true);
      const off = dv.getUint32(p + 42, true);
      const name = dec.decode(u8.subarray(p + 46, p + 46 + nlen));
      if (name === "word/document.xml") {
        const start = off + 30 + dv.getUint16(off + 26, true) + dv.getUint16(off + 28, true);
        const data = u8.subarray(start, start + csize);
        let bytes;
        if (method === 0) {
          bytes = data;
        } else if (method === 8) {
          if (typeof DecompressionStream === "undefined") throw new Error("This browser cannot open DOCX files. Paste the text instead.");
          const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
          bytes = new Uint8Array(await new Response(stream).arrayBuffer());
        } else {
          throw new Error("Unsupported DOCX compression. Paste the text instead.");
        }
        return dec.decode(bytes)
          .replace(/<\/w:p>/g, "\n")
          .replace(/<w:tab\/>/g, " ")
          .replace(/<[^>]+>/g, "")
          .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
      }
      p += 46 + nlen + elen + clen;
    }
    throw new Error("No text found in this DOCX. Paste the text instead.");
  }

  async function handleFile(f) {
    if (!f) return;
    error = "";
    fileInfo = null;
    if (f.size > MAX_FILE) { error = "File is too large (max 10 MB)."; return; }
    const name = f.name || "document";
    const lower = name.toLowerCase();
    readingFile = true;
    try {
      let out = "";
      if (lower.endsWith(".pdf") || f.type === "application/pdf") out = await readPdf(f);
      else if (lower.endsWith(".docx")) out = await readDocx(f);
      else if (lower.endsWith(".txt") || lower.endsWith(".md") || (f.type || "").indexOf("text/") === 0) out = await f.text();
      else throw new Error("Unsupported file type. Use PDF, DOCX or TXT, or paste the text.");
      out = out.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
      if (!out) throw new Error("No readable text found. Scanned PDFs are not supported yet, so paste the text instead.");
      text = out.slice(0, MAX_CHARS);
      fileInfo = { name: name, size: f.size, chars: out.length, truncated: out.length > MAX_CHARS };
    } catch (e) {
      error = e && e.message ? e.message : "Could not read this file.";
    } finally {
      readingFile = false;
      if (fileInput) fileInput.value = "";
    }
  }

  function onDrop(e) {
    e.preventDefault();
    drag = false;
    handleFile(e.dataTransfer && e.dataTransfer.files ? e.dataTransfer.files[0] : null);
  }
  function onDragOver(e) { e.preventDefault(); drag = true; }
  function onPick(e) { handleFile(e.target.files ? e.target.files[0] : null); }
  function openPicker() { if (fileInput) fileInput.click(); }

  const SAMPLE_MODES = { india: ["freelance", "india"], creator: ["creator", "india"], employment: ["employment", "india"], agency: ["agency", "global"] };
  function loadSample(key) {
    text = SAMPLE_CONTRACTS[key];
    const m = SAMPLE_MODES[key] || ["freelance", "india"];
    mode = m[0];
    scanMode.set(mode);
    jur = m[1];
    fileInfo = null;
    error = "";
  }

  /* ---------- scan ---------- */
  // The jurisdiction is passed to the AI as a short note placed before the contract text.
  function freelanceNote() {
    if (jur === "india") {
      return "[AUDITOR NOTE - not part of the contract: the freelancer works under Indian law. Consider the Indian Contract Act 1872 (for example restraint-of-trade clauses) and MSMED Act 2006 payment-period norms (45 days) when judging risk and writing counter-clauses. Never quote this note.]\n\n";
    }
    return "[AUDITOR NOTE - not part of the contract: the freelancer works remotely under US, UK or international terms. Prefer standard Net-14 or Net-30 payment, IP assignment only after full payment, and a liability cap equal to fees paid. Never quote this note.]\n\n";
  }

  // The note placed before the contract text combines the selected mode and jurisdiction.
  function jurisdictionNote() {
    const india = jur === "india";
    if (mode === "creator") {
      return "[AUDITOR NOTE - not part of the contract: this is a creator or influencer brand sponsorship agreement and the user is the creator. Check usage rights (organic versus paid advertising and whitelisting, duration, perpetual or irrevocable licences), category exclusivity (scope and length), reshoot and edit limits, payment deadlines and conditions, kill fees and cancellation, and approval or conduct clauses. Write polite counter-emails addressed to the brand or talent agency. " + (india ? "The creator works under Indian law; consider the Indian Contract Act 1872. " : "The creator works under US, UK or international terms. ") + "Never quote this note.]\n\n";
    }
    if (mode === "employment") {
      return "[AUDITOR NOTE - not part of the contract: this is a job offer letter or employment agreement and the user is the employee or fresher. Check employment bonds, training-cost recovery and liquidated damages, notice period length and buyouts, withheld original certificates, side-project and personal-time IP claims, non-competes and discretionary variable pay. " + (india ? "The employee works in India: reference Section 27 of the Indian Contract Act 1872 (agreements in restraint of trade) when discussing non-competes and restrictions, but do not claim a clause is definitely void; say it may be challengeable and suggest asking a lawyer. " : "Consider local employment law and say when a lawyer should be consulted. ") + "Write polite HR clarification emails as the counter-emails. Never quote this note.]\n\n";
    }
    if (mode === "agency") {
      return "[AUDITOR NOTE - not part of the contract: this is an agency, consultant or sub-contractor agreement and the user is the sub-contractor. Check pay-when-paid and pay-if-paid clauses, non-solicitation and non-compete scope, portfolio and white-label restrictions, SLA penalties, uncapped indemnification and IP assignment before payment. " + (india ? "The user works under Indian law; consider the Indian Contract Act 1872 and MSMED Act payment norms. " : "The user works under US, UK or international terms. ") + "Never quote this note.]\n\n";
    }
    return freelanceNote();
  }

  function setMode(k) {
    mode = k;
    scanMode.set(k);
  }

  async function scan() {
    error = "";
    const t = text.trim();
    if (t.length < 50) { error = "Paste or upload your contract first (at least a few lines)."; return; }
    loading = true;
    step = 0;
    result = null;
    unlockedData = {};
    unlockError = "";
    cat = "All";
    timer = setInterval(function () { if (step < STEPS.length - 1) step += 1; }, 1400);
    try {
      const note = jurisdictionNote();
      const payload = note + t.slice(0, MAX_CHARS - note.length);
      const r = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: payload, jurisdiction: jur, mode: mode }),
      });
      const data = await readJson(r);
      if (!r.ok) throw new Error(data.error || "Server error (HTTP " + r.status + ")");
      result = data;
      setTimeout(function () {
        const el = document.getElementById("results");
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
    } catch (err) {
      error = err && err.message ? err.message : "Something went wrong. Please try again.";
    } finally {
      if (timer) clearInterval(timer);
      timer = null;
      loading = false;
    }
  }

  // Pro unlocks EVERY flagged clause of this audit in a single request. Free accounts are sent to the upgrade modal.
  async function unlockAll() {
    error = "";
    if (!$isPro) { openPay("pro_year"); return; }
    if (flagged.length === 0 || unlocking) return;
    unlocking = true;
    unlockError = "";
    try {
      const headers = await authHeaders();
      if (headers.Authorization === "Bearer ") throw new Error("Session expired. Please log in again.");
      const tokens = flagged.map(function (c) { return c.locked_token; });
      const r = await fetch("/api/unlock", { method: "POST", headers: headers, body: JSON.stringify({ tokens: tokens }) });
      const data = await readJson(r);
      if (r.status === 401) throw new Error("Session expired. Please log in again.");
      if (data && data.code === "UPGRADE") { openPay("pro_year"); }
      if (!r.ok || !data.success || !Array.isArray(data.unlocked)) {
        throw new Error(data.error || "Unlock failed (HTTP " + r.status + ").");
      }
      const map = {};
      data.unlocked.forEach(function (u) { map[u.index] = u; });
      unlockedData = map;
    } catch (err) {
      let msg = err && err.message ? err.message : "Unlock failed.";
      if (err instanceof TypeError) msg = "Network error. Check your connection and try again.";
      unlockError = msg;
    } finally {
      unlocking = false;
    }
  }

  function exportPdf() {
    if (!$isPro) { openPay("pro_year"); error = "PDF report export is a Pro feature."; return; }
    const ok = openReport({ result: result, unlockedData: unlockedData, jur: jur, score: score });
    if (!ok) error = "Allow pop-ups for this site to download the PDF report.";
  }
</script>

<div class="wrap narrow page">
  <h1 class="h2">Contract scanner</h1>
  <p class="muted">Drop a contract to get a risk score, flagged clauses and safer rewrites.</p>

  <div class="chips" role="group" aria-label="Contract mode">
    {#each MODES as m}<button class:on={mode === m.key} on:click={() => setMode(m.key)}>{m.label}</button>{/each}
  </div>

  <div class="seg" role="group" aria-label="Jurisdiction">
    <button class:on={jur === "india"} on:click={() => (jur = "india")}>🇮🇳 India <span class="muted small">(Act 1872 / MSMED)</span></button>
    <button class:on={jur === "global"} on:click={() => (jur = "global")}>🌐 US / UK / Global</button>
  </div>

  <section class="card">
    <div class="drop" class:drag role="button" tabindex="0" on:click={openPicker} on:keydown={(e) => { if (e.key === "Enter") openPicker(); }} on:dragover={onDragOver} on:dragleave={() => (drag = false)} on:drop={onDrop}>
      <div class="big" aria-hidden="true">📄</div>
      <b>{readingFile ? "Reading document..." : "Drop a PDF, DOCX or TXT here"}</b>
      <div class="muted small">or tap to browse • max 10 MB</div>
    </div>
    <input type="file" accept=".pdf,.docx,.txt,.md,application/pdf" bind:this={fileInput} on:change={onPick} hidden />

    {#if fileInfo}
      <div class="fileinfo">
        <span>📎 <b>{fileInfo.name}</b></span>
        <span class="num">{Math.max(1, Math.round(fileInfo.size / 1024))} KB • {fileInfo.chars.toLocaleString("en-IN")} characters read</span>
        {#if fileInfo.truncated}<span class="badge med">Only the first {MAX_CHARS.toLocaleString("en-IN")} characters are analysed</span>{/if}
      </div>
    {/if}

    <label for="ct">…or paste the contract text</label>
    <textarea id="ct" bind:value={text} rows="9" maxlength={MAX_CHARS} placeholder="Paste your client contract here..."></textarea>
    <div class="muted small num" style="margin:0 0 10px">{text.length} / {MAX_CHARS}</div>
    <div class="row">
      <button class="btn sm mfull" on:click={() => loadSample("india")}>Sample Freelance (India)</button>
      <button class="btn sm mfull" on:click={() => loadSample("creator")}>Sample Brand Deal (Creator)</button>
      <button class="btn sm mfull" on:click={() => loadSample("employment")}>Sample Job Bond (Fresher/Dev)</button>
      <button class="btn sm mfull" on:click={() => loadSample("agency")}>Sample Agency (US/Global)</button>
    </div>

    <button class="btn primary lg block" style="margin-top:12px" on:click={scan} disabled={loading || readingFile}>
      {loading ? "Scanning..." : "Scan contract ⚡"}
    </button>

    {#if loading}
      <div class="scan" aria-live="polite">
        <ul>
          {#each STEPS as s, i}
            <li class:done={i < step} class:now={i === step}>
              {#if i < step}✓{:else if i === step}<span class="spin"></span>{:else}○{/if}
              {s}
            </li>
          {/each}
        </ul>
      </div>
    {/if}
    {#if error}<div class="error" role="alert">⚠️ {error}</div>{/if}
  </section>

  {#if result}
    <section id="results" class="card iri" style="scroll-margin-top:80px">
      <div class="report-head">
        <RiskGauge score={score} level={result.overall_risk_score} />
        <div>
          <div class="row" style="margin-bottom:8px">
            <RiskBadge level={result.overall_risk_score} />
            <span class="muted small num">{flagged.length} flagged • {highCount} high</span>
          </div>
          <p class="pre" style="margin:0 0 10px">{fmt(result.executive_summary)}</p>
          <button class="btn sm mfull" on:click={exportPdf}>📄 {$isPro ? "Download PDF report" : "PDF report (Pro) ⚡"}</button>
        </div>
      </div>
    </section>

    {#if flagged.length > 0}
      <MemorySave text={text} jur={jur} />
    {/if}

    {#if flagged.length > 0 && !allUnlocked}
      <section class="card" style="border-color:#c7d2fe;background:#f5f7ff">
        <b>Unlock all {flagged.length} safer rewrites</b>
        <p class="muted small" style="margin:4px 0 12px">Includes every counter-proposal email. Pro also adds PDF reports, Scope Guard and Payment Chaser.</p>
        <button class="btn primary block" on:click={unlockAll} disabled={unlocking}>{unlocking ? "Unlocking all clauses..." : unlockLabel}</button>
        {#if unlockError}<div class="error" role="alert">⚠️ {unlockError}</div>{/if}
      </section>
    {/if}

    {#if cats.length > 2}
      <div class="chips" style="margin-top:16px">
        {#each cats as c}<button class:on={cat === c} on:click={() => (cat = c)}>{c}</button>{/each}
      </div>
    {/if}

    {#each shown as x (x.i)}
      <ClauseCard clause={x.c} unlocked={unlockedData[x.i] || null} startOpen={x.i === 0} unlockLabel={unlockLabel} unlocking={unlocking} unlockError={unlockError} onUnlock={unlockAll} />
    {/each}

    {#if flagged.length === 0}
      <section class="card"><p style="margin:0">No major red flags found in the text you provided. ✅</p></section>
    {/if}
  {/if}
</div>
`);

F("src/pages/Radar.svelte", String.raw`<script>
  import { go } from "../lib/app.js";
  const TERMS = [14, 30, 45, 60, 90, 120];
  let jur = "india";
  let value = 50000;
  let terms = 90;
  let liab = "uncapped";
  let ip = "creation";
  let rev = "unlimited";
  let rate = 12;

  function compute(v0, t0, l0, i0, r0, rate0) {
    const v = Math.max(0, Number(v0) || 0);
    const days = Number(t0) || 0;
    const delay = v * (Math.max(0, Number(rate0) || 0) / 100) * (days / 365);
    const revLeak = r0 === "unlimited" ? v * 0.15 : 0;
    const ipRisk = i0 === "creation" ? v : 0;
    const uncapped = l0 === "uncapped";
    let s = 0;
    s += days >= 90 ? 3 : days >= 60 ? 2 : days >= 30 ? 1 : 0;
    s += uncapped ? 3 : 0;
    s += i0 === "creation" ? 2 : 0;
    s += r0 === "unlimited" ? 2 : 0;
    const level = s >= 6 ? "HIGH" : s >= 3 ? "MEDIUM" : "LOW";
    return { v: v, days: days, delay: delay, revLeak: revLeak, ipRisk: ipRisk, uncapped: uncapped, level: level };
  }
  function money(n, j) {
    return (j === "india" ? "₹" : "$") + Math.round(Number(n) || 0).toLocaleString(j === "india" ? "en-IN" : "en-US");
  }
  const POS = { HIGH: 84, MEDIUM: 50, LOW: 16 };
  $: res = compute(value, terms, liab, ip, rev, rate);
  $: cls = res.level === "HIGH" ? "high" : res.level === "LOW" ? "low" : "med";
</script>

<div class="wrap narrow page">
  <h1 class="h2">Contract risk calculator</h1>
  <p class="muted">Estimate what risky terms could cost you before you sign.</p>

  <section class="card">
    <div class="seg" style="max-width:260px">
      <button class:on={jur === "india"} on:click={() => (jur = "india")}>₹ INR</button>
      <button class:on={jur === "global"} on:click={() => (jur = "global")}>$ USD</button>
    </div>
    <div class="grid2">
      <label>Project fee ({jur === "india" ? "₹" : "$"})<input type="number" min="0" inputmode="numeric" bind:value={value} /></label>
      <label>Payment terms
        <select bind:value={terms}>{#each TERMS as t}<option value={t}>Net-{t}</option>{/each}</select>
      </label>
      <label>Liability
        <select bind:value={liab}><option value="capped">Capped at fees paid</option><option value="uncapped">Uncapped</option></select>
      </label>
      <label>IP transfer
        <select bind:value={ip}><option value="payment">After full payment</option><option value="creation">On creation</option></select>
      </label>
      <label>Revisions
        <select bind:value={rev}><option value="limited">Limited rounds</option><option value="unlimited">Unlimited</option></select>
      </label>
      <label>Your cost of money (% per year)<input type="number" min="0" max="60" inputmode="numeric" bind:value={rate} /></label>
    </div>
  </section>

  <section class="card iri">
    <div class="row between">
      <b>Your estimated exposure</b>
      <span class="badge {cls}"><i class="dot"></i>{res.level} RISK</span>
    </div>
    <div class="meter"><div class="pin" style="left:{POS[res.level]}%"></div></div>
    <div class="mlabels"><span>LOW</span><span>MEDIUM</span><span>HIGH</span></div>
    <ul class="lines">
      <li><span>Cashflow frozen for</span><b class="num">{res.days} days</b></li>
      <li><span>Cost of delayed capital</span><b class="num">{money(res.delay, jur)}</b></li>
      {#if res.revLeak > 0}<li><span>Estimated unpaid revision leak</span><b class="num">{money(res.revLeak, jur)}</b></li>{/if}
      {#if res.ipRisk > 0}<li><span>Fee at risk if the client keeps the work unpaid</span><b class="num">{money(res.ipRisk, jur)}</b></li>{/if}
      <li><span>Liability ceiling</span><b class="num">{res.uncapped ? "None (uncapped)" : money(res.v, jur)}</b></li>
    </ul>
    <p class="muted small">Illustrative model, not a prediction: delayed-capital cost = fee × your yearly cost of money × days ÷ 365, and unlimited revisions are assumed to add unpaid work worth about 15% of the fee.</p>
    <button class="btn primary block" on:click={() => go("/dashboard")}>Now audit your real contract ⚡</button>
  </section>
</div>
`);

F("src/pages/Vault.svelte", String.raw`<script>
  import { copyToClipboard } from "../lib/app.js";
  import { VAULT, VAULT_CATS } from "../lib/data.mjs";
  let q = "";
  let cat = "All";
  let copied = "";

  function filter(list, query, c) {
    const needle = String(query || "").trim().toLowerCase();
    return list.filter(function (v) {
      const okCat = c === "All" || v.cat === c;
      const okQ = !needle || (v.title + " " + v.text + " " + v.cat).toLowerCase().indexOf(needle) !== -1;
      return okCat && okQ;
    });
  }
  $: items = filter(VAULT, q, cat);

  async function copy(v) {
    await copyToClipboard(v.text);
    copied = v.id;
    setTimeout(function () { if (copied === v.id) copied = ""; }, 1600);
  }
</script>

<div class="wrap narrow page">
  <h1 class="h2">Clause library</h1>
  <p class="muted">Contractor-friendly clauses. Copy, paste, and fill in the [brackets]. Have a lawyer review high-value deals.</p>

  <input type="search" placeholder="Search clauses (kill fee, deposit, liability...)" bind:value={q} />
  <div class="chips">
    {#each VAULT_CATS as c}<button class:on={cat === c} on:click={() => (cat = c)}>{c}</button>{/each}
  </div>

  {#each items as v (v.id)}
    <article class="card hover">
      <div class="row between" style="margin-bottom:8px">
        <b>{v.title}</b>
        <span class="badge low">{v.cat}</span>
      </div>
      <p class="ins" style="margin:0 0 10px">{v.text}</p>
      <button class="btn sm mfull" on:click={() => copy(v)}>{copied === v.id ? "Copied ✓" : "Copy Clause"}</button>
    </article>
  {/each}
  {#if items.length === 0}
    <section class="card"><p class="muted" style="margin:0">No clauses match your search. Try another word or category.</p></section>
  {/if}
</div>
`);

// ---------------------------------------------------------------------------
// v4 server files (written with the right module format for your project) + SQL
// ---------------------------------------------------------------------------
function A(name, src) {
  API_FILES[name] = src;
}

A("api/device.js", String.raw`// api/device.js - register / heartbeat / list / revoke devices (Free: 1 at a time, Pro: 3)

const SB_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const ACTIVE_MS = 20 * 60 * 1000;
const enc = encodeURIComponent;

async function sbFetch(pathAndQuery, opts) {
  const o = opts || {};
  const headers = Object.assign(
    { apikey: SB_SERVICE, Authorization: "Bearer " + SB_SERVICE, "Content-Type": "application/json" },
    o.headers || {}
  );
  const r = await fetch(SB_URL + "/rest/v1/" + pathAndQuery, { method: o.method || "GET", headers: headers, body: o.body });
  const text = await r.text();
  if (!r.ok) {
    const err = new Error("Database error (" + r.status + "): " + (text || "").slice(0, 200));
    err.status = r.status;
    throw err;
  }
  try { return text ? JSON.parse(text) : null; } catch (e) { return null; }
}

async function getUser(req) {
  const h = req.headers.authorization || "";
  const token = h.indexOf("Bearer ") === 0 ? h.slice(7) : "";
  if (!token) return null;
  const r = await fetch(SB_URL + "/auth/v1/user", { headers: { apikey: SB_SERVICE, Authorization: "Bearer " + token } });
  if (!r.ok) return null;
  const u = await r.json();
  return u && u.id ? u : null;
}

function readBody(req) {
  let b = req.body;
  if (typeof b === "string") { try { b = JSON.parse(b); } catch (e) { b = {}; } }
  return b || {};
}

async function getProfile(userId) {
  try {
    const rows = await sbFetch("profiles?id=eq." + enc(userId) + "&select=pro_until");
    return rows && rows[0] ? rows[0] : null;
  } catch (e) {
    return null;
  }
}

function proActive(p) {
  return !!(p && p.pro_until && Date.parse(p.pro_until) > Date.now());
}

function cleanLabel(s) {
  return String(s || "").replace(/[^\w .,()\/+-]/g, "").slice(0, 60) || "Unknown device";
}

function deviceView(rows, deviceId) {
  const now = Date.now();
  return (rows || []).filter(function (r) { return !r.revoked; }).map(function (r) {
    return {
      device_id: r.device_id,
      label: r.label || "Unknown device",
      last_seen: r.last_seen,
      current: r.device_id === deviceId,
      active: now - Date.parse(r.last_seen) < ACTIVE_MS,
    };
  });
}

// Free = 1 device at a time, Pro = 3. If the devices table does not exist yet, the gate stays open.
async function deviceGate(userId, deviceId, pro, opts) {
  const o = opts || {};
  const limit = pro ? 3 : 1;
  let rows;
  try {
    rows = await sbFetch("devices?user_id=eq." + enc(userId) + "&select=device_id,label,last_seen,revoked&order=last_seen.desc");
  } catch (e) {
    return { ok: true, skipped: true, devices: [], limit: limit };
  }
  rows = rows || [];
  const now = Date.now();
  if (!/^[A-Za-z0-9-]{8,64}$/.test(String(deviceId || ""))) {
    return { ok: false, missing: true, devices: deviceView(rows, ""), limit: limit };
  }
  const me = rows.find(function (r) { return r.device_id === deviceId; });
  const others = rows.filter(function (r) {
    return r.device_id !== deviceId && !r.revoked && now - Date.parse(r.last_seen) < ACTIVE_MS;
  });
  if (me && me.revoked && !o.fresh) return { ok: false, revoked: true, devices: deviceView(rows, deviceId), limit: limit };
  if (others.length >= limit) return { ok: false, blocked: true, devices: deviceView(rows, deviceId), limit: limit };
  if (o.readOnly) return { ok: true, devices: deviceView(rows, deviceId), limit: limit };
  const row = { user_id: userId, device_id: deviceId, last_seen: new Date(now).toISOString(), revoked: false };
  if (o.label) row.label = cleanLabel(o.label);
  else if (!me) row.label = "Unknown device";
  await sbFetch("devices?on_conflict=user_id,device_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(row),
  });
  const merged = rows.filter(function (r) { return r.device_id !== deviceId; }).concat([{
    device_id: deviceId, label: row.label || (me ? me.label : "Unknown device"), last_seen: row.last_seen, revoked: false,
  }]);
  return { ok: true, devices: deviceView(merged, deviceId), limit: limit };
}

function deviceFail(res, g) {
  let msg = "Device limit reached. The Free plan allows 1 device at a time and Pro allows 3. Sign out another device in Account.";
  if (g.revoked) msg = "This device was signed out. Please log in again.";
  if (g.missing) msg = "Please reload the page and try again.";
  return res.status(403).json({ error: msg, code: "DEVICE_LIMIT" });
}


async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST." });
  if (!SB_URL || !SB_SERVICE) return res.status(500).json({ error: "Server is missing Supabase settings." });
  const body = readBody(req);
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: "Session expired. Please log in again." });
    const pro = proActive(await getProfile(user.id));
    const deviceId = String(body.device_id || req.headers["x-device-id"] || "");
    const action = String(body.action || "register");

    if (action === "revoke") {
      const target = String(body.target || "");
      if (!/^[A-Za-z0-9-]{8,64}$/.test(target)) return res.status(400).json({ error: "Invalid device." });
      if (target === deviceId) {
        await sbFetch("devices?user_id=eq." + enc(user.id) + "&device_id=eq." + enc(target), { method: "DELETE" });
      } else {
        await sbFetch("devices?user_id=eq." + enc(user.id) + "&device_id=eq." + enc(target), {
          method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ revoked: true }),
        });
      }
      const g0 = await deviceGate(user.id, deviceId, pro, { readOnly: true });
      return res.status(200).json({ ok: true, blocked: !!g0.blocked, devices: g0.devices, limit: g0.limit, plan: pro ? "pro" : "free" });
    }

    if (action === "list") {
      const g1 = await deviceGate(user.id, deviceId, pro, { readOnly: true });
      return res.status(200).json({ ok: g1.ok, blocked: !!g1.blocked, revoked: !!g1.revoked, devices: g1.devices, limit: g1.limit, plan: pro ? "pro" : "free" });
    }

    const g = await deviceGate(user.id, deviceId, pro, { label: body.label, fresh: !!body.fresh });
    if (g.ok) {
      // best-effort cleanup of devices unseen for 30 days
      sbFetch("devices?user_id=eq." + enc(user.id) + "&last_seen=lt." + enc(new Date(Date.now() - 30 * 86400000).toISOString()), { method: "DELETE" }).catch(function () {});
    }
    return res.status(200).json({ ok: g.ok, blocked: !!g.blocked, revoked: !!g.revoked, devices: g.devices, limit: g.limit, plan: pro ? "pro" : "free" });
  } catch (e) {
    return res.status(500).json({ error: (e && e.message) || "Device check failed." });
  }
}
`);

A("api/unlock.js", String.raw`__CRYPTO_IMPORT__// api/unlock.js - server-side paywall. Only Pro accounts can unlock; Free accounts receive 402 UPGRADE.

const SB_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const ACTIVE_MS = 20 * 60 * 1000;
const enc = encodeURIComponent;

async function sbFetch(pathAndQuery, opts) {
  const o = opts || {};
  const headers = Object.assign(
    { apikey: SB_SERVICE, Authorization: "Bearer " + SB_SERVICE, "Content-Type": "application/json" },
    o.headers || {}
  );
  const r = await fetch(SB_URL + "/rest/v1/" + pathAndQuery, { method: o.method || "GET", headers: headers, body: o.body });
  const text = await r.text();
  if (!r.ok) {
    const err = new Error("Database error (" + r.status + "): " + (text || "").slice(0, 200));
    err.status = r.status;
    throw err;
  }
  try { return text ? JSON.parse(text) : null; } catch (e) { return null; }
}

async function getUser(req) {
  const h = req.headers.authorization || "";
  const token = h.indexOf("Bearer ") === 0 ? h.slice(7) : "";
  if (!token) return null;
  const r = await fetch(SB_URL + "/auth/v1/user", { headers: { apikey: SB_SERVICE, Authorization: "Bearer " + token } });
  if (!r.ok) return null;
  const u = await r.json();
  return u && u.id ? u : null;
}

function readBody(req) {
  let b = req.body;
  if (typeof b === "string") { try { b = JSON.parse(b); } catch (e) { b = {}; } }
  return b || {};
}

async function getProfile(userId) {
  try {
    const rows = await sbFetch("profiles?id=eq." + enc(userId) + "&select=pro_until");
    return rows && rows[0] ? rows[0] : null;
  } catch (e) {
    return null;
  }
}

function proActive(p) {
  return !!(p && p.pro_until && Date.parse(p.pro_until) > Date.now());
}

function cleanLabel(s) {
  return String(s || "").replace(/[^\w .,()\/+-]/g, "").slice(0, 60) || "Unknown device";
}

function deviceView(rows, deviceId) {
  const now = Date.now();
  return (rows || []).filter(function (r) { return !r.revoked; }).map(function (r) {
    return {
      device_id: r.device_id,
      label: r.label || "Unknown device",
      last_seen: r.last_seen,
      current: r.device_id === deviceId,
      active: now - Date.parse(r.last_seen) < ACTIVE_MS,
    };
  });
}

// Free = 1 device at a time, Pro = 3. If the devices table does not exist yet, the gate stays open.
async function deviceGate(userId, deviceId, pro, opts) {
  const o = opts || {};
  const limit = pro ? 3 : 1;
  let rows;
  try {
    rows = await sbFetch("devices?user_id=eq." + enc(userId) + "&select=device_id,label,last_seen,revoked&order=last_seen.desc");
  } catch (e) {
    return { ok: true, skipped: true, devices: [], limit: limit };
  }
  rows = rows || [];
  const now = Date.now();
  if (!/^[A-Za-z0-9-]{8,64}$/.test(String(deviceId || ""))) {
    return { ok: false, missing: true, devices: deviceView(rows, ""), limit: limit };
  }
  const me = rows.find(function (r) { return r.device_id === deviceId; });
  const others = rows.filter(function (r) {
    return r.device_id !== deviceId && !r.revoked && now - Date.parse(r.last_seen) < ACTIVE_MS;
  });
  if (me && me.revoked && !o.fresh) return { ok: false, revoked: true, devices: deviceView(rows, deviceId), limit: limit };
  if (others.length >= limit) return { ok: false, blocked: true, devices: deviceView(rows, deviceId), limit: limit };
  if (o.readOnly) return { ok: true, devices: deviceView(rows, deviceId), limit: limit };
  const row = { user_id: userId, device_id: deviceId, last_seen: new Date(now).toISOString(), revoked: false };
  if (o.label) row.label = cleanLabel(o.label);
  else if (!me) row.label = "Unknown device";
  await sbFetch("devices?on_conflict=user_id,device_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(row),
  });
  const merged = rows.filter(function (r) { return r.device_id !== deviceId; }).concat([{
    device_id: deviceId, label: row.label || (me ? me.label : "Unknown device"), last_seen: row.last_seen, revoked: false,
  }]);
  return { ok: true, devices: deviceView(merged, deviceId), limit: limit };
}

function deviceFail(res, g) {
  let msg = "Device limit reached. The Free plan allows 1 device at a time and Pro allows 3. Sign out another device in Account.";
  if (g.revoked) msg = "This device was signed out. Please log in again.";
  if (g.missing) msg = "Please reload the page and try again.";
  return res.status(403).json({ error: msg, code: "DEVICE_LIMIT" });
}


const MAX_AGE_MS = 24 * 60 * 60 * 1000;
// One audit never has more than 6 clauses, so a single request can never unlock more than one document.
const MAX_TOKENS = 6;

// IMPORTANT: this function must stay identical in api/audit.js and api/unlock.js.
function getSecret() {
  return process.env.UNLOCK_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
}

function keyBytes() {
  const base = getSecret();
  if (!base) throw new Error("Server is missing SUPABASE_SERVICE_ROLE_KEY (or UNLOCK_SECRET).");
  return crypto.createHash("sha256").update("safeclause:" + base).digest();
}

function unseal(token) {
  try {
    const buf = Buffer.from(String(token || ""), "base64url");
    if (buf.length < 30) return null;
    const d = crypto.createDecipheriv("aes-256-gcm", keyBytes(), buf.subarray(0, 12));
    d.setAuthTag(buf.subarray(12, 28));
    const out = Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString("utf8");
    return JSON.parse(out);
  } catch (e) {
    return null;
  }
}

async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST." });
  if (!SB_URL || !SB_SERVICE) {
    return res.status(500).json({ error: "Server is missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY." });
  }
  const body = readBody(req);
  const tokens = Array.isArray(body.tokens) ? body.tokens : body.token ? [body.token] : [];
  if (tokens.length === 0) return res.status(400).json({ error: "No unlock tokens were sent." });
  if (tokens.length > MAX_TOKENS) return res.status(400).json({ error: "Too many clauses in one unlock." });

  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: "Session expired. Please log in again." });
    const pro = proActive(await getProfile(user.id));
    if (!pro) {
      return res.status(402).json({ error: "Upgrade to Pro to unlock safer rewrites and counter-proposal emails.", code: "UPGRADE" });
    }
    const gate = await deviceGate(user.id, req.headers["x-device-id"], pro);
    if (!gate.ok) return deviceFail(res, gate);

    // Decrypt EVERYTHING first. If any token is bad, nothing is returned.
    const items = [];
    for (let i = 0; i < tokens.length; i++) {
      const locked = unseal(tokens[i]);
      if (!locked || !locked.c) return res.status(400).json({ error: "Invalid unlock token (clause " + (i + 1) + "). Run the audit again." });
      if (Date.now() - Number(locked.t || 0) > MAX_AGE_MS) return res.status(400).json({ error: "This unlock token expired. Run the audit again." });
      items.push({ index: i, safe_counter_clause: locked.c, polite_client_negotiation_email: locked.e });
    }

    const out = { success: true, unlocked: items, plan: "pro" };
    if (items.length === 1) {
      out.safe_counter_clause = items[0].safe_counter_clause;
      out.polite_client_negotiation_email = items[0].polite_client_negotiation_email;
    }
    return res.status(200).json(out);
  } catch (e) {
    return res.status(500).json({ error: (e && e.message) || "Unlock failed." });
  }
}
`);

A("api/scope-check.js", String.raw`// api/scope-check.js - Scope Guard: compares a client message with a project's saved terms (Groq)

const SB_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const ACTIVE_MS = 20 * 60 * 1000;
const enc = encodeURIComponent;

async function sbFetch(pathAndQuery, opts) {
  const o = opts || {};
  const headers = Object.assign(
    { apikey: SB_SERVICE, Authorization: "Bearer " + SB_SERVICE, "Content-Type": "application/json" },
    o.headers || {}
  );
  const r = await fetch(SB_URL + "/rest/v1/" + pathAndQuery, { method: o.method || "GET", headers: headers, body: o.body });
  const text = await r.text();
  if (!r.ok) {
    const err = new Error("Database error (" + r.status + "): " + (text || "").slice(0, 200));
    err.status = r.status;
    throw err;
  }
  try { return text ? JSON.parse(text) : null; } catch (e) { return null; }
}

async function getUser(req) {
  const h = req.headers.authorization || "";
  const token = h.indexOf("Bearer ") === 0 ? h.slice(7) : "";
  if (!token) return null;
  const r = await fetch(SB_URL + "/auth/v1/user", { headers: { apikey: SB_SERVICE, Authorization: "Bearer " + token } });
  if (!r.ok) return null;
  const u = await r.json();
  return u && u.id ? u : null;
}

function readBody(req) {
  let b = req.body;
  if (typeof b === "string") { try { b = JSON.parse(b); } catch (e) { b = {}; } }
  return b || {};
}

async function getProfile(userId) {
  try {
    const rows = await sbFetch("profiles?id=eq." + enc(userId) + "&select=pro_until");
    return rows && rows[0] ? rows[0] : null;
  } catch (e) {
    return null;
  }
}

function proActive(p) {
  return !!(p && p.pro_until && Date.parse(p.pro_until) > Date.now());
}

function cleanLabel(s) {
  return String(s || "").replace(/[^\w .,()\/+-]/g, "").slice(0, 60) || "Unknown device";
}

function deviceView(rows, deviceId) {
  const now = Date.now();
  return (rows || []).filter(function (r) { return !r.revoked; }).map(function (r) {
    return {
      device_id: r.device_id,
      label: r.label || "Unknown device",
      last_seen: r.last_seen,
      current: r.device_id === deviceId,
      active: now - Date.parse(r.last_seen) < ACTIVE_MS,
    };
  });
}

// Free = 1 device at a time, Pro = 3. If the devices table does not exist yet, the gate stays open.
async function deviceGate(userId, deviceId, pro, opts) {
  const o = opts || {};
  const limit = pro ? 3 : 1;
  let rows;
  try {
    rows = await sbFetch("devices?user_id=eq." + enc(userId) + "&select=device_id,label,last_seen,revoked&order=last_seen.desc");
  } catch (e) {
    return { ok: true, skipped: true, devices: [], limit: limit };
  }
  rows = rows || [];
  const now = Date.now();
  if (!/^[A-Za-z0-9-]{8,64}$/.test(String(deviceId || ""))) {
    return { ok: false, missing: true, devices: deviceView(rows, ""), limit: limit };
  }
  const me = rows.find(function (r) { return r.device_id === deviceId; });
  const others = rows.filter(function (r) {
    return r.device_id !== deviceId && !r.revoked && now - Date.parse(r.last_seen) < ACTIVE_MS;
  });
  if (me && me.revoked && !o.fresh) return { ok: false, revoked: true, devices: deviceView(rows, deviceId), limit: limit };
  if (others.length >= limit) return { ok: false, blocked: true, devices: deviceView(rows, deviceId), limit: limit };
  if (o.readOnly) return { ok: true, devices: deviceView(rows, deviceId), limit: limit };
  const row = { user_id: userId, device_id: deviceId, last_seen: new Date(now).toISOString(), revoked: false };
  if (o.label) row.label = cleanLabel(o.label);
  else if (!me) row.label = "Unknown device";
  await sbFetch("devices?on_conflict=user_id,device_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(row),
  });
  const merged = rows.filter(function (r) { return r.device_id !== deviceId; }).concat([{
    device_id: deviceId, label: row.label || (me ? me.label : "Unknown device"), last_seen: row.last_seen, revoked: false,
  }]);
  return { ok: true, devices: deviceView(merged, deviceId), limit: limit };
}

function deviceFail(res, g) {
  let msg = "Device limit reached. The Free plan allows 1 device at a time and Pro allows 3. Sign out another device in Account.";
  if (g.revoked) msg = "This device was signed out. Please log in again.";
  if (g.missing) msg = "Please reload the page and try again.";
  return res.status(403).json({ error: msg, code: "DEVICE_LIMIT" });
}


const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const FREE_LIMIT = 3;
const MODELS = Array.from(new Set([process.env.GROQ_MODEL, "openai/gpt-oss-20b", "openai/gpt-oss-120b", "llama-3.3-70b-versatile"].filter(Boolean)));

const SYSTEM_PROMPT = [
  "You are Scope Guard, an assistant that protects freelancers from scope creep.",
  "You receive a project's saved contract terms and short contract excerpts, plus a new message from the client.",
  "Decide whether the client's request is inside the agreed scope. Return ONE JSON object only, no markdown:",
  '{"verdict": "IN_SCOPE" | "OUT_OF_SCOPE" | "GREY_AREA",',
  ' "reasoning": "2-3 plain-English sentences",',
  ' "clause_quote": "text copied EXACTLY from the saved excerpts that supports the verdict, or an empty string",',
  ' "counts_as_revision": true | false,',
  ' "reply_script": "polite, ready-to-send reply as plain text, use \\n for line breaks",',
  ' "estimated_hours": number or null,',
  ' "change_order_note": "one or two sentences describing the extra work"}',
  "Rules:",
  "- Use ONLY the saved terms and excerpts. Never invent clauses. If they do not cover the request, use GREY_AREA and say so.",
  "- If the request is a revision and the revision cap is already used up, the verdict is OUT_OF_SCOPE.",
  "- If revisions remain and the request is a normal revision of agreed work, the verdict is IN_SCOPE and counts_as_revision is true.",
  "- estimated_hours: give a realistic estimate only for OUT_OF_SCOPE or GREY_AREA, otherwise null.",
  "- The reply must be polite, specific and never accusatory. For OUT_OF_SCOPE, offer a change order. Include a greeting and a sign-off using [Your Name].",
].join("\n");

async function callGroq(model, key, userMsg) {
  const body = {
    model: model,
    messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: userMsg }],
    temperature: 0.2,
    max_completion_tokens: 2500,
  };
  if (model.indexOf("gpt-oss") !== -1) body.reasoning_effort = "low";
  const ctrl = new AbortController();
  const timer = setTimeout(function () { ctrl.abort(); }, 45000);
  try {
    const r = await fetch(GROQ_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const raw = await r.text();
    if (!r.ok) {
      const err = new Error("Groq HTTP " + r.status + " (" + model + "): " + raw.slice(0, 200));
      err.status = r.status;
      throw err;
    }
    const data = JSON.parse(raw);
    const msg = data && data.choices && data.choices[0] && data.choices[0].message;
    return (msg && msg.content) || "";
  } finally {
    clearTimeout(timer);
  }
}

function extractJson(text) {
  if (!text) return null;
  const s = text.indexOf("{");
  const e = text.lastIndexOf("}");
  if (s === -1 || e <= s) return null;
  try { return JSON.parse(text.slice(s, e + 1)); } catch (err) { return null; }
}

function clean(v, max) {
  if (typeof v !== "string") return "";
  return v.replace(/\r\n/g, "\n").replace(/\\n/g, "\n").trim().slice(0, max);
}

function squash(s) {
  return String(s || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function monthStartIso() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
}

async function monthlyUsage(userId) {
  try {
    const rows = await sbFetch("scope_checks?user_id=eq." + enc(userId) + "&created_at=gte." + enc(monthStartIso()) + "&select=id");
    return Array.isArray(rows) ? rows.length : 0;
  } catch (e) {
    return 0;
  }
}

async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST." });
  if (!SB_URL || !SB_SERVICE) return res.status(500).json({ error: "Server is missing Supabase settings." });
  const key = process.env.GROQ_API_KEY;
  if (!key) return res.status(500).json({ error: "Server is missing GROQ_API_KEY." });
  const body = readBody(req);
  const message = String(body.message || "").trim().slice(0, 4000);
  if (message.length < 10) return res.status(400).json({ error: "Paste the client's message first." });

  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: "Session expired. Please log in again." });
    const profile = await getProfile(user.id);
    const pro = proActive(profile);
    const gate = await deviceGate(user.id, req.headers["x-device-id"], pro);
    if (!gate.ok) return deviceFail(res, gate);

    let rows;
    try {
      rows = await sbFetch("projects?id=eq." + enc(String(body.project_id || "")) + "&user_id=eq." + enc(user.id) + "&select=*");
    } catch (e) {
      return res.status(500).json({ error: "Please ensure supabase-v3.sql was executed in Supabase SQL editor." });
    }
    const project = rows && rows[0];
    if (!project) return res.status(404).json({ error: "Project not found." });

    let used = await monthlyUsage(user.id);
    if (!pro && used >= FREE_LIMIT) {
      return res.status(402).json({ error: "The Free plan includes " + FREE_LIMIT + " Scope Guard checks per month. Upgrade to Pro for unlimited checks.", code: "UPGRADE", usage: { used: used, limit: FREE_LIMIT } });
    }

    const ex = project.excerpts || {};
    const terms = {
      project_name: project.name, client_name: project.client_name,
      scope_deliverables: project.scope_items || [],
      revision_cap: project.revision_cap, revisions_used: project.revisions_used || 0,
      hourly_rate: project.hourly_rate, liability_cap: project.liability_cap,
      saved_excerpts: { scope: ex.scope || "", revision: ex.revision || "", payment: ex.payment || "", liability: ex.liability || "" },
    };
    const userMsg = "SAVED PROJECT TERMS:\n" + JSON.stringify(terms) + "\n\nNEW CLIENT MESSAGE:\n" + message;

    let parsed = null;
    let lastError = "Scope check is unavailable. Please try again.";
    for (let i = 0; i < MODELS.length && !parsed; i++) {
      try {
        parsed = extractJson(await callGroq(MODELS[i], key, userMsg));
        if (!parsed) lastError = "The AI returned unreadable output. Please try again.";
      } catch (e) {
        lastError = (e && e.message) || lastError;
        if (e && (e.status === 401 || e.status === 403 || e.status === 429)) break;
      }
    }
    if (!parsed) return res.status(502).json({ error: lastError });

    const verdict = ["IN_SCOPE", "OUT_OF_SCOPE", "GREY_AREA"].indexOf(parsed.verdict) !== -1 ? parsed.verdict : "GREY_AREA";
    let quote = clean(parsed.clause_quote, 600);
    const haystack = squash([ex.scope, ex.revision, ex.payment, ex.liability].join(" "));
    if (quote && haystack.indexOf(squash(quote)) === -1) quote = "";

    const rate = Number(project.hourly_rate) > 0 ? Number(project.hourly_rate) : null;
    let hours = Number(parsed.estimated_hours);
    hours = isFinite(hours) && hours > 0 ? Math.min(200, Math.round(hours * 2) / 2) : null;
    if (verdict === "IN_SCOPE") hours = null;
    const cost = hours && rate ? Math.round(hours * rate) : null;
    const sym = project.jurisdiction === "global" ? "$" : "₹";
    let changeOrder = "";
    if (verdict !== "IN_SCOPE") {
      changeOrder = "CHANGE ORDER\nProject: " + project.name + (project.client_name ? "\nClient: " + project.client_name : "") +
        "\nRequested work: " + (clean(parsed.change_order_note, 400) || "As described in the client's message.") +
        "\nEstimated effort: " + (hours ? hours + " hours" : "[HOURS]") +
        "\nRate: " + (rate ? sym + rate + " per hour" : "[RATE] per hour") +
        "\nEstimated total: " + (cost ? sym + cost : "[TOTAL]") +
        "\nTimeline: to be confirmed on approval.\nTo proceed, please reply with your written approval.";
    }

    try {
      await sbFetch("scope_checks", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ user_id: user.id, project_id: project.id, verdict: verdict }) });
      used += 1;
    } catch (e) {}

    return res.status(200).json({
      success: true,
      result: {
        verdict: verdict,
        reasoning: clean(parsed.reasoning, 700),
        clause_quote: quote,
        counts_as_revision: parsed.counts_as_revision === true,
        reply_script: clean(parsed.reply_script, 2000),
        estimated_hours: hours,
        estimated_cost: cost,
        change_order_text: changeOrder,
      },
      usage: { used: used, limit: pro ? null : FREE_LIMIT },
    });
  } catch (e) {
    return res.status(500).json({ error: (e && e.message) || "Scope check failed." });
  }
}
`);

A("api/extract-terms.js", String.raw`// api/extract-terms.js - Contract Memory: pull structured terms (and short clause excerpts) from a scanned contract

const SB_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const ACTIVE_MS = 20 * 60 * 1000;
const enc = encodeURIComponent;

async function sbFetch(pathAndQuery, opts) {
  const o = opts || {};
  const headers = Object.assign(
    { apikey: SB_SERVICE, Authorization: "Bearer " + SB_SERVICE, "Content-Type": "application/json" },
    o.headers || {}
  );
  const r = await fetch(SB_URL + "/rest/v1/" + pathAndQuery, { method: o.method || "GET", headers: headers, body: o.body });
  const text = await r.text();
  if (!r.ok) {
    const err = new Error("Database error (" + r.status + "): " + (text || "").slice(0, 200));
    err.status = r.status;
    throw err;
  }
  try { return text ? JSON.parse(text) : null; } catch (e) { return null; }
}

async function getUser(req) {
  const h = req.headers.authorization || "";
  const token = h.indexOf("Bearer ") === 0 ? h.slice(7) : "";
  if (!token) return null;
  const r = await fetch(SB_URL + "/auth/v1/user", { headers: { apikey: SB_SERVICE, Authorization: "Bearer " + token } });
  if (!r.ok) return null;
  const u = await r.json();
  return u && u.id ? u : null;
}

function readBody(req) {
  let b = req.body;
  if (typeof b === "string") { try { b = JSON.parse(b); } catch (e) { b = {}; } }
  return b || {};
}

async function getProfile(userId) {
  try {
    const rows = await sbFetch("profiles?id=eq." + enc(userId) + "&select=pro_until");
    return rows && rows[0] ? rows[0] : null;
  } catch (e) {
    return null;
  }
}

function proActive(p) {
  return !!(p && p.pro_until && Date.parse(p.pro_until) > Date.now());
}

function cleanLabel(s) {
  return String(s || "").replace(/[^\w .,()\/+-]/g, "").slice(0, 60) || "Unknown device";
}

function deviceView(rows, deviceId) {
  const now = Date.now();
  return (rows || []).filter(function (r) { return !r.revoked; }).map(function (r) {
    return {
      device_id: r.device_id,
      label: r.label || "Unknown device",
      last_seen: r.last_seen,
      current: r.device_id === deviceId,
      active: now - Date.parse(r.last_seen) < ACTIVE_MS,
    };
  });
}

// Free = 1 device at a time, Pro = 3. If the devices table does not exist yet, the gate stays open.
async function deviceGate(userId, deviceId, pro, opts) {
  const o = opts || {};
  const limit = pro ? 3 : 1;
  let rows;
  try {
    rows = await sbFetch("devices?user_id=eq." + enc(userId) + "&select=device_id,label,last_seen,revoked&order=last_seen.desc");
  } catch (e) {
    return { ok: true, skipped: true, devices: [], limit: limit };
  }
  rows = rows || [];
  const now = Date.now();
  if (!/^[A-Za-z0-9-]{8,64}$/.test(String(deviceId || ""))) {
    return { ok: false, missing: true, devices: deviceView(rows, ""), limit: limit };
  }
  const me = rows.find(function (r) { return r.device_id === deviceId; });
  const others = rows.filter(function (r) {
    return r.device_id !== deviceId && !r.revoked && now - Date.parse(r.last_seen) < ACTIVE_MS;
  });
  if (me && me.revoked && !o.fresh) return { ok: false, revoked: true, devices: deviceView(rows, deviceId), limit: limit };
  if (others.length >= limit) return { ok: false, blocked: true, devices: deviceView(rows, deviceId), limit: limit };
  if (o.readOnly) return { ok: true, devices: deviceView(rows, deviceId), limit: limit };
  const row = { user_id: userId, device_id: deviceId, last_seen: new Date(now).toISOString(), revoked: false };
  if (o.label) row.label = cleanLabel(o.label);
  else if (!me) row.label = "Unknown device";
  await sbFetch("devices?on_conflict=user_id,device_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(row),
  });
  const merged = rows.filter(function (r) { return r.device_id !== deviceId; }).concat([{
    device_id: deviceId, label: row.label || (me ? me.label : "Unknown device"), last_seen: row.last_seen, revoked: false,
  }]);
  return { ok: true, devices: deviceView(merged, deviceId), limit: limit };
}

function deviceFail(res, g) {
  let msg = "Device limit reached. The Free plan allows 1 device at a time and Pro allows 3. Sign out another device in Account.";
  if (g.revoked) msg = "This device was signed out. Please log in again.";
  if (g.missing) msg = "Please reload the page and try again.";
  return res.status(403).json({ error: msg, code: "DEVICE_LIMIT" });
}


const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MAX_CHARS = 10000;
const MODELS = Array.from(new Set([process.env.GROQ_MODEL, "openai/gpt-oss-20b", "openai/gpt-oss-120b", "llama-3.3-70b-versatile"].filter(Boolean)));

const SYSTEM_PROMPT = [
  "You extract structured terms from a freelance contract so a freelancer can track the project.",
  "Return ONE JSON object only, no markdown. Use null when a value is not stated in the contract:",
  '{"project_name": string or null, "client_name": string or null,',
  ' "payment_days": integer or null (e.g. 30 for Net-30),',
  ' "late_fee_pct_month": number or null,',
  ' "revision_cap": integer or null (number of revision rounds included),',
  ' "hourly_rate": number or null (only if the contract states one),',
  ' "liability_cap": string or null (short, e.g. "Capped at fees paid" or "Uncapped"),',
  ' "scope_deliverables": [short strings, max 8],',
  ' "excerpts": {"scope": string, "revision": string, "payment": string, "liability": string}}',
  "Rules:",
  "- Each excerpt must be copied VERBATIM from the contract, 400 characters at most, or an empty string if the contract has no such clause.",
  "- Never invent values. Do not include any other text from the contract.",
].join("\n");

async function callGroq(model, key, contract) {
  const body = {
    model: model,
    messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: "CONTRACT:\n" + contract }],
    temperature: 0,
    max_completion_tokens: 2500,
  };
  if (model.indexOf("gpt-oss") !== -1) body.reasoning_effort = "low";
  const ctrl = new AbortController();
  const timer = setTimeout(function () { ctrl.abort(); }, 45000);
  try {
    const r = await fetch(GROQ_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const raw = await r.text();
    if (!r.ok) {
      const err = new Error("Groq HTTP " + r.status + " (" + model + "): " + raw.slice(0, 200));
      err.status = r.status;
      throw err;
    }
    const data = JSON.parse(raw);
    const msg = data && data.choices && data.choices[0] && data.choices[0].message;
    return (msg && msg.content) || "";
  } finally {
    clearTimeout(timer);
  }
}

function extractJson(text) {
  if (!text) return null;
  const s = text.indexOf("{");
  const e = text.lastIndexOf("}");
  if (s === -1 || e <= s) return null;
  try { return JSON.parse(text.slice(s, e + 1)); } catch (err) { return null; }
}

function squash(s) {
  return String(s || "").replace(/\s+/g, " ").trim().toLowerCase();
}
function str(v, max) {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";
}
function int(v, lo, hi) {
  const n = Math.round(Number(v));
  return isFinite(n) && n >= lo && n <= hi ? n : null;
}
function num(v, lo, hi) {
  const n = Number(v);
  return isFinite(n) && n >= lo && n <= hi ? n : null;
}

async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST." });
  if (!SB_URL || !SB_SERVICE) return res.status(500).json({ error: "Server is missing Supabase settings." });
  const key = process.env.GROQ_API_KEY;
  if (!key) return res.status(500).json({ error: "Server is missing GROQ_API_KEY." });
  const body = readBody(req);
  const text = String(body.text || "").trim().slice(0, MAX_CHARS);
  if (text.length < 50) return res.status(400).json({ error: "No contract text to read." });

  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: "Please log in to save to Contract Memory." });
    const pro = proActive(await getProfile(user.id));
    const gate = await deviceGate(user.id, req.headers["x-device-id"], pro);
    if (!gate.ok) return deviceFail(res, gate);

    let parsed = null;
    let lastError = "Could not read the contract terms. Please try again.";
    for (let i = 0; i < MODELS.length && !parsed; i++) {
      try {
        parsed = extractJson(await callGroq(MODELS[i], key, text));
        if (!parsed) lastError = "The AI returned unreadable output. Please try again.";
      } catch (e) {
        lastError = (e && e.message) || lastError;
        if (e && (e.status === 401 || e.status === 403 || e.status === 429)) break;
      }
    }
    if (!parsed) return res.status(502).json({ error: lastError });

    const hay = squash(text);
    const ex = parsed.excerpts && typeof parsed.excerpts === "object" ? parsed.excerpts : {};
    function excerpt(v) {
      const s = str(v, 400);
      return s && hay.indexOf(squash(s)) !== -1 ? s : "";
    }
    const items = Array.isArray(parsed.scope_deliverables) ? parsed.scope_deliverables : [];
    return res.status(200).json({
      success: true,
      terms: {
        name: str(parsed.project_name, 120),
        client_name: str(parsed.client_name, 120),
        payment_days: int(parsed.payment_days, 0, 365),
        late_fee_pct_month: num(parsed.late_fee_pct_month, 0, 100),
        revision_cap: int(parsed.revision_cap, 0, 50),
        hourly_rate: num(parsed.hourly_rate, 0, 1000000),
        liability_cap: str(parsed.liability_cap, 160),
        scope_items: items.map(function (x) { return str(x, 160); }).filter(Boolean).slice(0, 8),
        excerpts: { scope: excerpt(ex.scope), revision: excerpt(ex.revision), payment: excerpt(ex.payment), liability: excerpt(ex.liability) },
      },
    });
  } catch (e) {
    return res.status(500).json({ error: (e && e.message) || "Could not read the contract terms." });
  }
}
`);

A("api/verify-payment.js", String.raw`__CRYPTO_IMPORT__// api/verify-payment.js - UPI screenshot verification with Gemini. Each verified payment adds Pro time.

const SB_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const RECEIVER_ID = "8796021247@fam";
const RECEIVER_DIGITS = "8796021247";
const PLANS = { pro_month: { amount: 499, days: 30 }, pro_year: { amount: 3999, days: 365 } };
const MAX_B64 = 3000000;
const MODELS = Array.from(
  new Set([process.env.GEMINI_MODEL, "gemini-3.1-flash-lite", "gemini-3-flash-preview", "gemini-flash-latest", "gemini-2.5-flash"].filter(Boolean))
);

const PROMPT = [
  "You are verifying a UPI payment screenshot from an Indian payment app (GPay, PhonePe, Paytm, BHIM, etc).",
  "Read the image and return ONE JSON object only, no markdown:",
  '{"is_payment_screenshot": true|false,',
  ' "status": "success" | "failed" | "pending" | "unknown",',
  ' "amount": number or null (rupees paid),',
  ' "receiver_upi_id": string or null,',
  ' "receiver_name": string or null,',
  ' "transaction_id": string or null (UPI transaction ID / UTR / Google transaction ID, exactly as shown),',
  ' "paid_at": string or null (ISO 8601 date-time if a date and time are visible),',
  ' "suspicious": true|false (true if the image looks edited, cropped to hide details, or is not a real payment receipt),',
  ' "notes": short string}',
  "Only report what is visible. Never guess missing values; use null.",
].join("\n");

async function getUser(req) {
  const h = req.headers.authorization || "";
  const token = h.indexOf("Bearer ") === 0 ? h.slice(7) : "";
  if (!token) return null;
  const r = await fetch(SB_URL + "/auth/v1/user", { headers: { apikey: SB_SERVICE, Authorization: "Bearer " + token } });
  if (!r.ok) return null;
  const u = await r.json();
  return u && u.id ? u : null;
}

async function rpc(name, args) {
  const r = await fetch(SB_URL + "/rest/v1/rpc/" + name, {
    method: "POST",
    headers: { apikey: SB_SERVICE, Authorization: "Bearer " + SB_SERVICE, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  const text = await r.text();
  if (!r.ok) throw new Error("Database error: " + text.slice(0, 200));
  return JSON.parse(text);
}

async function callGemini(model, key, mime, b64) {
  const url = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent";
  const ctrl = new AbortController();
  const timer = setTimeout(function () { ctrl.abort(); }, 40000);
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ parts: [{ text: PROMPT }, { inline_data: { mime_type: mime, data: b64 } }] }],
        generationConfig: { temperature: 0, responseMimeType: "application/json" },
      }),
      signal: ctrl.signal,
    });
    const raw = await r.text();
    if (!r.ok) {
      const err = new Error("Gemini HTTP " + r.status + " (" + model + "): " + raw.slice(0, 200));
      err.status = r.status;
      throw err;
    }
    const data = JSON.parse(raw);
    const parts = (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) || [];
    return parts.map(function (p) { return p.text || ""; }).join("");
  } finally {
    clearTimeout(timer);
  }
}

function extractJson(text) {
  if (!text) return null;
  const s = text.indexOf("{");
  const e = text.lastIndexOf("}");
  if (s === -1 || e <= s) return null;
  try { return JSON.parse(text.slice(s, e + 1)); } catch (err) { return null; }
}

// Returns an error string, or "" when the screenshot passes every check.
function judge(info, pack) {
  if (!info || info.is_payment_screenshot !== true) return "This does not look like a UPI payment screenshot.";
  if (info.suspicious === true) return "This screenshot looks edited or incomplete. Upload the original, full screenshot.";
  const st = String(info.status || "").toLowerCase();
  if (!(st.indexOf("success") !== -1 || st === "paid" || st === "completed")) {
    return "Payment status is not Successful / Paid / Completed.";
  }
  const amt = Number(String(info.amount === null || info.amount === undefined ? "" : info.amount).replace(/[^0-9.]/g, ""));
  if (!isFinite(amt) || Math.abs(amt - pack.amount) > 0.001) {
    return "Amount mismatch. Expected Rs " + pack.amount + ", screenshot shows " + (info.amount === null || info.amount === undefined ? "no amount" : "Rs " + info.amount) + ".";
  }
  const rid = String(info.receiver_upi_id || "").toLowerCase();
  const rname = String(info.receiver_name || "").toLowerCase();
  const hint = String(process.env.RECEIVER_NAME_HINT || "").toLowerCase();
  const okReceiver =
    rid.indexOf(RECEIVER_DIGITS) !== -1 ||
    rname.indexOf("safeclause") !== -1 ||
    rname.indexOf("clauseradar") !== -1 ||
    (hint && rname.indexOf(hint) !== -1);
  if (!okReceiver) return "Receiver does not match " + RECEIVER_ID + ". Please pay to the correct UPI ID.";
  const txn = String(info.transaction_id || "").replace(/\s+/g, "");
  if (txn.length < 8) return "Transaction ID is not visible. Upload the full payment-success screen.";
  const t = Date.parse(info.paid_at || "");
  if (isFinite(t)) {
    const now = Date.now();
    if (now - t > 3 * 24 * 3600 * 1000) return "This payment is older than 3 days.";
    if (t - now > 24 * 3600 * 1000) return "Payment date looks invalid.";
  }
  return "";
}

async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ success: false, error: "Use POST." });
  if (!SB_URL || !SB_SERVICE) return res.status(500).json({ success: false, error: "Server is missing Supabase settings." });
  const gkey = process.env.GEMINI_API_KEY;
  if (!gkey) return res.status(500).json({ success: false, error: "Server is missing GEMINI_API_KEY." });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};

  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ success: false, error: "Please log in first." });

    const planId = String(body.plan || "");
    const pack = PLANS[planId];
    if (!pack) return res.status(400).json({ success: false, error: "Unknown plan." });
    const b64 = String(body.image || "");
    const mime = ["image/jpeg", "image/png", "image/webp"].indexOf(body.mime) !== -1 ? body.mime : "image/jpeg";
    if (b64.length < 1000) return res.status(400).json({ success: false, error: "Screenshot is missing or too small." });
    if (b64.length > MAX_B64) return res.status(413).json({ success: false, error: "Screenshot is too large." });

    let info = null;
    let lastError = "Verification service is unavailable. Try again shortly.";
    for (let i = 0; i < MODELS.length && !info; i++) {
      try {
        info = extractJson(await callGemini(MODELS[i], gkey, mime, b64));
        if (!info) lastError = "Could not read the screenshot. Upload a clearer image.";
      } catch (e) {
        lastError = (e && e.message) || lastError;
        if (e && (e.status === 401 || e.status === 403 || e.status === 429)) break;
      }
    }
    if (!info) return res.status(502).json({ success: false, error: lastError });

    const problem = judge(info, pack);
    if (problem) return res.status(400).json({ success: false, error: problem });

    const txn = String(info.transaction_id).replace(/\s+/g, "").toUpperCase();
    const hash = crypto.createHash("sha256").update(b64).digest("hex");
    const base = { p_user: user.id, p_txn: txn, p_hash: hash, p_amount: pack.amount, p_days: pack.days, p_plan: planId };
    const refCode = /^[A-Za-z0-9]{4,16}$/.test(String(body.ref || "")) ? String(body.ref).toLowerCase() : null;
    let until;
    try {
      until = await rpc("redeem_pro", refCode ? Object.assign({}, base, { p_ref_code: refCode }) : base);
    } catch (e) {
      // database without the referral upgrade yet: retry without the referral code
      if (refCode && /p_ref_code|PGRST202|Could not find the function/.test(String((e && e.message) || ""))) until = await rpc("redeem_pro", base);
      else throw e;
    }
    if (typeof until !== "string") {
      return res.status(409).json({ success: false, error: "This payment / transaction ID was already used." });
    }
    return res.status(200).json({ success: true, plan: "pro", pro_until: until, days: pack.days });
  } catch (e) {
    return res.status(500).json({ success: false, error: (e && e.message) || "Verification failed." });
  }
}
`);

F("supabase-v3.sql", String.raw`-- ClauseRadar v3: Pro subscription, Contract Memory, Scope Guard, Payment Chaser, device limits.
-- Run this ONCE in Supabase > SQL Editor. It is safe to run again.

alter table public.profiles add column if not exists pro_until timestamptz;
alter table public.profiles add column if not exists pro_plan text;
alter table public.payments add column if not exists plan text;

create or replace function public.is_pro(uid uuid) returns boolean
language sql security definer set search_path = public stable as $$
  select coalesce((select pro_until > now() from public.profiles where id = uid), false);
$$;

-- Contract Memory: structured terms + short clause excerpts only (never the full contract)
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  client_name text,
  jurisdiction text default 'india',
  payment_days int,
  late_fee_pct_month numeric,
  revision_cap int,
  revisions_used int not null default 0,
  hourly_rate numeric,
  liability_cap text,
  scope_items jsonb not null default '[]'::jsonb,
  excerpts jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.projects enable row level security;
drop policy if exists "projects own select" on public.projects;
drop policy if exists "projects own insert" on public.projects;
drop policy if exists "projects own update" on public.projects;
drop policy if exists "projects own delete" on public.projects;
create policy "projects own select" on public.projects for select using (auth.uid() = user_id);
create policy "projects own insert" on public.projects for insert with check (auth.uid() = user_id);
create policy "projects own update" on public.projects for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "projects own delete" on public.projects for delete using (auth.uid() = user_id);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  amount numeric not null check (amount > 0),
  invoice_date date not null,
  due_date date not null,
  paid_at date,
  note text,
  created_at timestamptz not null default now()
);
alter table public.invoices enable row level security;
drop policy if exists "invoices own select" on public.invoices;
drop policy if exists "invoices own insert" on public.invoices;
drop policy if exists "invoices own update" on public.invoices;
drop policy if exists "invoices own delete" on public.invoices;
create policy "invoices own select" on public.invoices for select using (auth.uid() = user_id);
create policy "invoices own insert" on public.invoices for insert with check (auth.uid() = user_id);
create policy "invoices own update" on public.invoices for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "invoices own delete" on public.invoices for delete using (auth.uid() = user_id);

-- Scope Guard usage log (verdict only, never the client's message)
create table if not exists public.scope_checks (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  verdict text,
  created_at timestamptz not null default now()
);
alter table public.scope_checks enable row level security;
drop policy if exists "scope_checks own select" on public.scope_checks;
create policy "scope_checks own select" on public.scope_checks for select using (auth.uid() = user_id);

-- Devices (Free: 1 at a time, Pro: 3). Written only by the server.
create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null,
  label text,
  revoked boolean not null default false,
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, device_id)
);
alter table public.devices enable row level security;
drop policy if exists "devices own select" on public.devices;
create policy "devices own select" on public.devices for select using (auth.uid() = user_id);

-- Free plan limits, enforced in the database so they cannot be bypassed from the browser
create or replace function public.enforce_project_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_pro(new.user_id) and (select count(*) from public.projects where user_id = new.user_id) >= 1 then
    raise exception 'FREE_LIMIT_PROJECTS';
  end if;
  return new;
end; $$;
drop trigger if exists trg_project_limit on public.projects;
create trigger trg_project_limit before insert on public.projects for each row execute function public.enforce_project_limit();

create or replace function public.enforce_invoice_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_pro(new.user_id) and (select count(*) from public.invoices where user_id = new.user_id and paid_at is null) >= 1 then
    raise exception 'FREE_LIMIT_INVOICES';
  end if;
  return new;
end; $$;
drop trigger if exists trg_invoice_limit on public.invoices;
create trigger trg_invoice_limit before insert on public.invoices for each row execute function public.enforce_invoice_limit();

-- Verified UPI payment -> adds Pro time. Returns the new pro_until, or null if the payment was already used.
create or replace function public.redeem_pro(p_user uuid, p_txn text, p_hash text, p_amount int, p_days int, p_plan text) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare v timestamptz;
begin
  insert into public.profiles(id) values (p_user) on conflict do nothing;
  insert into public.payments(user_id, txn_id, image_hash, amount, credits, plan) values (p_user, p_txn, p_hash, p_amount, 0, p_plan);
  update public.profiles
     set pro_until = greatest(coalesce(pro_until, now()), now()) + make_interval(days => p_days),
         pro_plan = p_plan
   where id = p_user
   returning pro_until into v;
  return v;
exception when unique_violation then
  return null;
end; $$;

revoke all on function public.redeem_pro(uuid, text, text, int, int, text) from public, anon, authenticated;
grant execute on function public.redeem_pro(uuid, text, text, int, int, text) to service_role;
`);

A("api/admin-payouts.js", String.raw`__CRYPTO_IMPORT__// api/admin-payouts.js - admin-only payout approvals. Needs ADMIN_PASSWORD plus a logged-in Supabase user.

const SB_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const ACTIVE_MS = 20 * 60 * 1000;
const enc = encodeURIComponent;

async function sbFetch(pathAndQuery, opts) {
  const o = opts || {};
  const headers = Object.assign(
    { apikey: SB_SERVICE, Authorization: "Bearer " + SB_SERVICE, "Content-Type": "application/json" },
    o.headers || {}
  );
  const r = await fetch(SB_URL + "/rest/v1/" + pathAndQuery, { method: o.method || "GET", headers: headers, body: o.body });
  const text = await r.text();
  if (!r.ok) {
    const err = new Error("Database error (" + r.status + "): " + (text || "").slice(0, 200));
    err.status = r.status;
    throw err;
  }
  try { return text ? JSON.parse(text) : null; } catch (e) { return null; }
}

async function getUser(req) {
  const h = req.headers.authorization || "";
  const token = h.indexOf("Bearer ") === 0 ? h.slice(7) : "";
  if (!token) return null;
  const r = await fetch(SB_URL + "/auth/v1/user", { headers: { apikey: SB_SERVICE, Authorization: "Bearer " + token } });
  if (!r.ok) return null;
  const u = await r.json();
  return u && u.id ? u : null;
}

function readBody(req) {
  let b = req.body;
  if (typeof b === "string") { try { b = JSON.parse(b); } catch (e) { b = {}; } }
  return b || {};
}

async function getProfile(userId) {
  try {
    const rows = await sbFetch("profiles?id=eq." + enc(userId) + "&select=pro_until");
    return rows && rows[0] ? rows[0] : null;
  } catch (e) {
    return null;
  }
}

function proActive(p) {
  return !!(p && p.pro_until && Date.parse(p.pro_until) > Date.now());
}

function cleanLabel(s) {
  return String(s || "").replace(/[^\w .,()\/+-]/g, "").slice(0, 60) || "Unknown device";
}

function deviceView(rows, deviceId) {
  const now = Date.now();
  return (rows || []).filter(function (r) { return !r.revoked; }).map(function (r) {
    return {
      device_id: r.device_id,
      label: r.label || "Unknown device",
      last_seen: r.last_seen,
      current: r.device_id === deviceId,
      active: now - Date.parse(r.last_seen) < ACTIVE_MS,
    };
  });
}

// Free = 1 device at a time, Pro = 3. If the devices table does not exist yet, the gate stays open.
async function deviceGate(userId, deviceId, pro, opts) {
  const o = opts || {};
  const limit = pro ? 3 : 1;
  let rows;
  try {
    rows = await sbFetch("devices?user_id=eq." + enc(userId) + "&select=device_id,label,last_seen,revoked&order=last_seen.desc");
  } catch (e) {
    return { ok: true, skipped: true, devices: [], limit: limit };
  }
  rows = rows || [];
  const now = Date.now();
  if (!/^[A-Za-z0-9-]{8,64}$/.test(String(deviceId || ""))) {
    return { ok: false, missing: true, devices: deviceView(rows, ""), limit: limit };
  }
  const me = rows.find(function (r) { return r.device_id === deviceId; });
  const others = rows.filter(function (r) {
    return r.device_id !== deviceId && !r.revoked && now - Date.parse(r.last_seen) < ACTIVE_MS;
  });
  if (me && me.revoked && !o.fresh) return { ok: false, revoked: true, devices: deviceView(rows, deviceId), limit: limit };
  if (others.length >= limit) return { ok: false, blocked: true, devices: deviceView(rows, deviceId), limit: limit };
  if (o.readOnly) return { ok: true, devices: deviceView(rows, deviceId), limit: limit };
  const row = { user_id: userId, device_id: deviceId, last_seen: new Date(now).toISOString(), revoked: false };
  if (o.label) row.label = cleanLabel(o.label);
  else if (!me) row.label = "Unknown device";
  await sbFetch("devices?on_conflict=user_id,device_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(row),
  });
  const merged = rows.filter(function (r) { return r.device_id !== deviceId; }).concat([{
    device_id: deviceId, label: row.label || (me ? me.label : "Unknown device"), last_seen: row.last_seen, revoked: false,
  }]);
  return { ok: true, devices: deviceView(merged, deviceId), limit: limit };
}

function deviceFail(res, g) {
  let msg = "Device limit reached. The Free plan allows 1 device at a time and Pro allows 3. Sign out another device in Account.";
  if (g.revoked) msg = "This device was signed out. Please log in again.";
  if (g.missing) msg = "Please reload the page and try again.";
  return res.status(403).json({ error: msg, code: "DEVICE_LIMIT" });
}


const attempts = {};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sha(s) {
  return crypto.createHash("sha256").update(String(s || "")).digest();
}

function passwordOk(input) {
  const real = process.env.ADMIN_PASSWORD || "";
  if (!real) return false;
  return crypto.timingSafeEqual(sha(input), sha(real));
}

// Optional extra lock: ADMIN_EMAILS=you@gmail.com,other@gmail.com
function emailAllowed(email) {
  const list = String(process.env.ADMIN_EMAILS || "").split(",").map(function (x) { return x.trim().toLowerCase(); }).filter(Boolean);
  return list.length === 0 || list.indexOf(String(email || "").toLowerCase()) !== -1;
}

async function rpcAdmin(name, args) {
  const r = await fetch(SB_URL + "/rest/v1/rpc/" + name, {
    method: "POST",
    headers: { apikey: SB_SERVICE, Authorization: "Bearer " + SB_SERVICE, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  const text = await r.text();
  if (!r.ok) throw new Error("Database error: " + text.slice(0, 200));
  return JSON.parse(text);
}

async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST." });
  if (!process.env.ADMIN_PASSWORD) return res.status(500).json({ error: "ADMIN_PASSWORD is not set in the Vercel environment variables." });
  if (!SB_URL || !SB_SERVICE) return res.status(500).json({ error: "Server is missing Supabase settings." });
  const body = readBody(req);

  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: "Please log in first." });
    if (!emailAllowed(user.email)) return res.status(403).json({ error: "This account is not allowed here." });

    const rec = attempts[user.id] || { n: 0, t: Date.now() };
    if (Date.now() - rec.t > 10 * 60 * 1000) { rec.n = 0; rec.t = Date.now(); }
    if (rec.n >= 8) return res.status(429).json({ error: "Too many wrong passwords. Try again in 10 minutes." });
    if (!passwordOk(req.headers["x-admin-password"] || body.password)) {
      rec.n += 1;
      attempts[user.id] = rec;
      await new Promise(function (r) { setTimeout(r, 700); });
      return res.status(401).json({ error: "Wrong password." });
    }
    attempts[user.id] = { n: 0, t: Date.now() };

    const action = String(body.action || "list");
    if (action === "approve" || action === "reject") {
      const id = String(body.id || "");
      if (!UUID.test(id)) return res.status(400).json({ error: "Invalid payout id." });
      const done = await rpcAdmin(action === "approve" ? "admin_approve_payout" : "admin_reject_payout", { p_id: id });
      if (done !== true) return res.status(409).json({ error: "This payout was already processed." });
      return res.status(200).json({ ok: true });
    }

    const rows = await sbFetch("payout_requests?select=id,user_id,email,amount,upi_id,status,created_at,approved_at&order=created_at.desc&limit=200");
    const list = rows || [];
    // For pending payouts, attach the referral sales behind the balance so you can check the UTRs in your UPI app first.
    for (let i = 0; i < list.length; i++) {
      list[i].evidence = [];
      if (list[i].status === "pending") {
        try {
          list[i].evidence = (await sbFetch("referrals?referrer_id=eq." + enc(list[i].user_id) + "&select=txn_id,plan,sale_amount,commission_amount,created_at&order=created_at.desc&limit=20")) || [];
        } catch (e) {}
      }
    }
    return res.status(200).json({ ok: true, payouts: list });
  } catch (e) {
    return res.status(500).json({ error: (e && e.message) || "Admin request failed." });
  }
}
`);

F("supabase-v4-referrals.sql", String.raw`-- ClauseRadar v5: 30% referral / affiliate program + payout requests.
-- Run this ONCE in Supabase > SQL Editor, AFTER supabase-v3.sql. Safe to run again.

alter table public.profiles add column if not exists ref_code text unique;
alter table public.profiles add column if not exists referred_by uuid references auth.users(id) on delete set null;
alter table public.profiles add column if not exists wallet_balance numeric not null default 0 check (wallet_balance >= 0);

-- every profile gets a short unique referral code (first 8 characters of the user id)
create or replace function public.set_ref_code() returns trigger
language plpgsql as $$
begin
  if new.ref_code is null then
    new.ref_code := substr(new.id::text, 1, 8);
    if exists (select 1 from public.profiles where ref_code = new.ref_code) then
      new.ref_code := substr(replace(new.id::text, '-', ''), 1, 12);
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists trg_ref_code on public.profiles;
create trigger trg_ref_code before insert on public.profiles for each row execute function public.set_ref_code();

do $$
declare r record;
begin
  for r in select id from public.profiles where ref_code is null loop
    begin
      update public.profiles set ref_code = substr(r.id::text, 1, 8) where id = r.id;
    exception when unique_violation then
      update public.profiles set ref_code = substr(replace(r.id::text, '-', ''), 1, 12) where id = r.id;
    end;
  end loop;
end $$;

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references auth.users(id) on delete cascade,
  referred_user_id uuid not null references auth.users(id) on delete cascade,
  plan text,
  sale_amount numeric not null,
  commission_amount numeric not null,
  txn_id text,
  created_at timestamptz not null default now()
);
create index if not exists referrals_referrer_idx on public.referrals(referrer_id);
alter table public.referrals enable row level security;
drop policy if exists "referrals own select" on public.referrals;
create policy "referrals own select" on public.referrals for select using (auth.uid() = referrer_id);

create table if not exists public.payout_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text,
  amount numeric not null check (amount > 0),
  upi_id text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  approved_at timestamptz
);
create index if not exists payout_requests_user_idx on public.payout_requests(user_id);
alter table public.payout_requests enable row level security;
drop policy if exists "payouts own select" on public.payout_requests;
create policy "payouts own select" on public.payout_requests for select using (auth.uid() = user_id);

-- a logged-in user attaches the referral code they arrived with (only once, never to themselves)
create or replace function public.claim_referral(p_code text) returns boolean
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); rid uuid;
begin
  if uid is null or p_code is null then return false; end if;
  select id into rid from public.profiles where ref_code = lower(trim(p_code)) and id <> uid;
  if rid is null then return false; end if;
  insert into public.profiles(id) values (uid) on conflict do nothing;
  update public.profiles set referred_by = rid where id = uid and referred_by is null;
  return found;
end; $$;
revoke all on function public.claim_referral(text) from public, anon;
grant execute on function public.claim_referral(text) to authenticated;

-- withdraw: creates a pending request and takes the amount out of the wallet in one step
create or replace function public.request_payout(p_upi text, p_amount numeric default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); bal numeric; amt numeric; em text; rid uuid; upi text := lower(trim(coalesce(p_upi, '')));
begin
  if uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if upi !~ '^[a-z0-9._-]{2,64}@[a-z0-9]{2,32}$' then raise exception 'INVALID_UPI'; end if;
  if exists (select 1 from public.payout_requests where user_id = uid and status = 'pending') then raise exception 'PENDING_EXISTS'; end if;
  select wallet_balance into bal from public.profiles where id = uid for update;
  amt := coalesce(p_amount, bal);
  if amt is null or bal is null or amt > bal then raise exception 'INSUFFICIENT_BALANCE'; end if;
  if amt < 100 then raise exception 'MIN_PAYOUT'; end if;
  select email into em from auth.users where id = uid;
  insert into public.payout_requests(user_id, email, amount, upi_id) values (uid, em, amt, upi) returning id into rid;
  update public.profiles set wallet_balance = wallet_balance - amt where id = uid;
  return rid;
end; $$;
revoke all on function public.request_payout(text, numeric) from public, anon;
grant execute on function public.request_payout(text, numeric) to authenticated;

-- admin actions (called only by the server with the service role)
create or replace function public.admin_approve_payout(p_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  update public.payout_requests set status = 'approved', approved_at = now() where id = p_id and status = 'pending';
  return found;
end; $$;

create or replace function public.admin_reject_payout(p_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_user uuid; v_amt numeric;
begin
  update public.payout_requests set status = 'rejected', approved_at = now() where id = p_id and status = 'pending' returning user_id, amount into v_user, v_amt;
  if not found then return false; end if;
  update public.profiles set wallet_balance = wallet_balance + v_amt where id = v_user;
  return true;
end; $$;
revoke all on function public.admin_approve_payout(uuid) from public, anon, authenticated;
revoke all on function public.admin_reject_payout(uuid) from public, anon, authenticated;
grant execute on function public.admin_approve_payout(uuid) to service_role;
grant execute on function public.admin_reject_payout(uuid) to service_role;

-- Pro payment -> Pro time, plus 30% commission to the referrer. Returns the new pro_until, or null if the payment was already used.
drop function if exists public.redeem_pro(uuid, text, text, int, int, text);
create or replace function public.redeem_pro(p_user uuid, p_txn text, p_hash text, p_amount int, p_days int, p_plan text, p_ref_code text default null) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare v timestamptz; v_ref uuid; v_commission numeric;
begin
  insert into public.profiles(id) values (p_user) on conflict do nothing;
  insert into public.payments(user_id, txn_id, image_hash, amount, credits, plan) values (p_user, p_txn, p_hash, p_amount, 0, p_plan);
  update public.profiles
     set pro_until = greatest(coalesce(pro_until, now()), now()) + make_interval(days => p_days),
         pro_plan = p_plan
   where id = p_user
   returning pro_until into v;

  select referred_by into v_ref from public.profiles where id = p_user;
  if v_ref is null and p_ref_code is not null and length(trim(p_ref_code)) > 0 then
    select id into v_ref from public.profiles where ref_code = lower(trim(p_ref_code)) and id <> p_user;
    if v_ref is not null then
      update public.profiles set referred_by = v_ref where id = p_user and referred_by is null;
    end if;
  end if;
  if v_ref is not null and v_ref <> p_user and p_amount in (499, 3999) then
    v_commission := round(p_amount * 0.30);
    insert into public.referrals(referrer_id, referred_user_id, plan, sale_amount, commission_amount, txn_id)
      values (v_ref, p_user, p_plan, p_amount, v_commission, p_txn);
    update public.profiles set wallet_balance = coalesce(wallet_balance, 0) + v_commission where id = v_ref;
  end if;
  return v;
exception when unique_violation then
  return null;
end; $$;
revoke all on function public.redeem_pro(uuid, text, text, int, int, text, text) from public, anon, authenticated;
grant execute on function public.redeem_pro(uuid, text, text, int, int, text, text) to service_role;
`);
// ---------------------------------------------------------------------------
// v3: Contract Memory, Scope Guard (the memory helpers live in src/lib/app.js)
// ---------------------------------------------------------------------------
F("src/lib/MemorySave.svelte", String.raw`<script>
  import { user, isPro, authHeaders, readJson, openAuth, openPay, link, saveProject } from "./app.js";

  export let text = "";
  export let jur = "india";

  let step = "idle";
  let error = "";
  let upgrade = false;
  let f = null;

  function toInt(v) {
    const n = parseInt(v, 10);
    return isFinite(n) ? n : null;
  }
  function toNum(v) {
    const n = parseFloat(v);
    return isFinite(n) ? n : null;
  }
  function cap(v, n) {
    return String(v || "").trim().slice(0, n);
  }

  async function start() {
    error = "";
    upgrade = false;
    if (!$user) { openAuth("login", "Log in to save this contract to Contract Memory."); return; }
    if (text.trim().length < 50) { error = "Scan a contract first."; return; }
    step = "reading";
    try {
      const r = await fetch("/api/extract-terms", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ text: text.trim().slice(0, 10000), jurisdiction: jur }),
      });
      const d = await readJson(r);
      if (!r.ok || !d.success) throw new Error(d.error || "Could not read the contract terms.");
      const t = d.terms;
      f = {
        name: t.name || "", client_name: t.client_name || "",
        payment_days: t.payment_days == null ? "" : t.payment_days,
        late_fee_pct_month: t.late_fee_pct_month == null ? "" : t.late_fee_pct_month,
        revision_cap: t.revision_cap == null ? "" : t.revision_cap,
        hourly_rate: t.hourly_rate == null ? "" : t.hourly_rate,
        liability_cap: t.liability_cap || "",
        scope_text: (t.scope_items || []).join("\n"),
        ex_scope: t.excerpts.scope, ex_revision: t.excerpts.revision, ex_payment: t.excerpts.payment, ex_liability: t.excerpts.liability,
      };
      step = "review";
    } catch (e) {
      error = e && e.message ? e.message : "Could not read the contract terms.";
      step = "idle";
    }
  }

  async function save() {
    if (!f.name.trim()) { error = "Give the project a name."; return; }
    error = "";
    upgrade = false;
    step = "saving";
    try {
      await saveProject({
        name: cap(f.name, 120), client_name: cap(f.client_name, 120) || null, jurisdiction: jur,
        payment_days: toInt(f.payment_days), late_fee_pct_month: toNum(f.late_fee_pct_month),
        revision_cap: toInt(f.revision_cap), revisions_used: 0, hourly_rate: toNum(f.hourly_rate),
        liability_cap: cap(f.liability_cap, 160) || null,
        scope_items: f.scope_text.split("\n").map(function (x) { return x.trim().slice(0, 160); }).filter(Boolean).slice(0, 8),
        excerpts: { scope: cap(f.ex_scope, 400), revision: cap(f.ex_revision, 400), payment: cap(f.ex_payment, 400), liability: cap(f.ex_liability, 400) },
      });
      step = "saved";
    } catch (e) {
      error = e && e.message ? e.message : "Could not save the project.";
      upgrade = error.indexOf("Free plan") !== -1;
      step = "review";
    }
  }
</script>

<section class="card iri" style="background:linear-gradient(135deg,#f5f7ff,#fdf4ff)">
  <b style="font-size:1.125rem">🧠 Save to Contract Memory (Active Project)</b>
  {#if step === "idle" || step === "reading"}
    <p class="muted small" style="margin:6px 0 12px">Optional. We suggest the key terms from this contract (payment days, revision cap, scope, rates). You review and edit them before anything is saved. Your full contract is never stored. This powers Scope Guard and Payment Chaser.</p>
    <button class="btn primary lg block" on:click={start} disabled={step === "reading"}>{step === "reading" ? "Reading contract terms..." : "Save to Contract Memory (Active Project)"}</button>
  {:else if step === "review" || step === "saving"}
    <p class="muted small" style="margin:6px 0 12px">Check the details. Only what you keep here is saved. Clear any field you do not want stored.</p>
    <div class="grid2">
      <div><label for="mp-name">Project name</label><input id="mp-name" bind:value={f.name} maxlength="120" /></div>
      <div><label for="mp-client">Client name</label><input id="mp-client" bind:value={f.client_name} maxlength="120" /></div>
      <div><label for="mp-pay">Payment terms (days, e.g. 30 for Net-30)</label><input id="mp-pay" type="number" min="0" inputmode="numeric" bind:value={f.payment_days} /></div>
      <div><label for="mp-late">Late fee (% per month)</label><input id="mp-late" type="number" min="0" step="0.1" inputmode="decimal" bind:value={f.late_fee_pct_month} /></div>
      <div><label for="mp-rev">Revision rounds included</label><input id="mp-rev" type="number" min="0" inputmode="numeric" bind:value={f.revision_cap} /></div>
      <div><label for="mp-rate">Hourly rate ({jur === "india" ? "₹" : "$"})</label><input id="mp-rate" type="number" min="0" inputmode="decimal" bind:value={f.hourly_rate} /></div>
    </div>
    <label for="mp-liab">Liability cap</label>
    <input id="mp-liab" bind:value={f.liability_cap} maxlength="160" />
    <label for="mp-scope">Scope deliverables (one per line)</label>
    <textarea id="mp-scope" rows="4" bind:value={f.scope_text}></textarea>
    <h3 class="sub">Short clause excerpts (max 400 characters each)</h3>
    <label for="mp-ex1">Scope clause</label>
    <textarea id="mp-ex1" rows="3" maxlength="400" bind:value={f.ex_scope}></textarea>
    <label for="mp-ex2">Revision clause</label>
    <textarea id="mp-ex2" rows="3" maxlength="400" bind:value={f.ex_revision}></textarea>
    <label for="mp-ex3">Payment / late fee clause</label>
    <textarea id="mp-ex3" rows="3" maxlength="400" bind:value={f.ex_payment}></textarea>
    <label for="mp-ex4">Liability clause</label>
    <textarea id="mp-ex4" rows="3" maxlength="400" bind:value={f.ex_liability}></textarea>
    <div class="row" style="margin-top:6px">
      <button class="btn primary mfull" on:click={save} disabled={step === "saving"}>{step === "saving" ? "Saving..." : "Save project"}</button>
      <button class="btn mfull" on:click={() => (step = "idle")} disabled={step === "saving"}>Cancel</button>
    </div>
  {:else}
    <div class="ok">✅ Saved! Your project is now active and selected in Scope Guard and Payment Chaser.</div>
    <div class="row" style="margin-top:12px">
      <a class="btn primary mfull" href="/scope-guard" on:click={(e) => link(e, "/scope-guard")}>Test in Scope Guard</a>
      <a class="btn mfull" href="/chaser" on:click={(e) => link(e, "/chaser")}>Track in Payment Chaser</a>
    </div>
  {/if}
  {#if error}<div class="error" role="alert">⚠️ {error}</div>{/if}
  {#if upgrade}<button class="btn primary block" style="margin-top:10px" on:click={() => openPay("pro_year")}>Upgrade to Pro ⚡</button>{/if}
</section>
`);

F("src/pages/ScopeGuard.svelte", String.raw`<script>
  import { user, isPro, authHeaders, readJson, openAuth, openPay, link, copyToClipboard, fmt, projects, loadProjects, updateProject, scopeUsage, activeProject, memoryError } from "../lib/app.js";

  const V = {
    IN_SCOPE: { label: "In Scope (Free)", cls: "low" },
    OUT_OF_SCOPE: { label: "Out of Scope (Billable)", cls: "high" },
    GREY_AREA: { label: "Grey Area", cls: "med" },
  };
  const FREE_LIMIT = 3;

  let projectId = "";
  let message = "";
  let loading = false;
  let error = "";
  let upgrade = false;
  let result = null;
  let used = null;
  let copied = "";
  let counted = false;

  $: if ($user) { loadProjects(); refreshUsage(); }
  // always land on the latest saved project, never on an empty screen
  $: if ($projects.length && (!projectId || !$projects.some(function (p) { return p.id === projectId; }))) projectId = $activeProject && $projects.some(function (p) { return p.id === $activeProject; }) ? $activeProject : $projects[0].id;
  $: if (projectId) activeProject.set(projectId);
  $: project = $projects.find(function (p) { return p.id === projectId; }) || null;
  $: revUsed = project ? project.revisions_used || 0 : 0;
  $: revCap = project && project.revision_cap != null ? project.revision_cap : null;
  $: revPct = revCap ? Math.min(100, Math.round((revUsed / revCap) * 100)) : 0;
  $: revWarn = revCap == null ? "" : revUsed >= revCap ? "Revision cap reached. Further revisions are billable." : revUsed === revCap - 1 ? "Last included revision remaining." : "";

  async function refreshUsage() {
    used = await scopeUsage();
  }

  async function check() {
    error = "";
    upgrade = false;
    result = null;
    counted = false;
    if (!project) { error = "Select a project first."; return; }
    if (message.trim().length < 10) { error = "Paste the client's message first."; return; }
    loading = true;
    try {
      const r = await fetch("/api/scope-check", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ project_id: project.id, message: message.trim() }),
      });
      const d = await readJson(r);
      if (d.usage && typeof d.usage.used === "number") used = d.usage.used;
      if (!r.ok || !d.success) {
        upgrade = d.code === "UPGRADE";
        throw new Error(d.error || "Scope check failed.");
      }
      result = d.result;
    } catch (e) {
      error = e && e.message ? e.message : "Scope check failed.";
    } finally {
      loading = false;
    }
  }

  async function countRevision() {
    if (!project || counted) return;
    try {
      await updateProject(project.id, { revisions_used: revUsed + 1 });
      counted = true;
    } catch (e) {
      error = e && e.message ? e.message : "Could not update the revision count.";
    }
  }

  async function copy(id, text) {
    await copyToClipboard(text);
    copied = id;
    setTimeout(function () { if (copied === id) copied = ""; }, 1600);
  }
</script>

<div class="wrap narrow page">
  <h1 class="h2">Scope Guard</h1>
  <p class="lead" style="margin:0 0 14px;text-align:left">Paste the client's "quick tweak" message. Find out in 10 seconds if it is free, paid, or scope creep.</p>

  {#if !$user}
    <section class="card">
      <p style="margin:0 0 12px">Log in to use Scope Guard with your saved projects.</p>
      <button class="btn primary block" on:click={() => openAuth("login", "Log in to use Scope Guard.")}>Log in</button>
    </section>
  {:else if $projects.length === 0}
    <section class="card">
      {#if $memoryError}<div class="error" role="alert" style="margin:0 0 12px">⚠️ {$memoryError}</div>{/if}
      <b>No active project yet</b>
      <p class="muted small" style="margin:6px 0 12px">Scan a contract and choose Save to Contract Memory. Scope Guard compares client messages with the scope and revision cap you saved.</p>
      <a class="btn primary block" href="/dashboard" on:click={(e) => link(e, "/dashboard")}>Scan a contract</a>
    </section>
  {:else}
    <section class="card">
      <label for="sg-project">Active project</label>
      <select id="sg-project" bind:value={projectId}>
        {#each $projects as p}<option value={p.id}>{p.name}{p.client_name ? " – " + p.client_name : ""}</option>{/each}
      </select>

      {#if project}
        <div class="row between" style="margin:2px 0 6px">
          <b class="num">{revCap == null ? "No revision cap saved" : "Round " + revUsed + " of " + revCap + " used"}</b>
          {#if $isPro}<span class="muted small">Unlimited checks</span>{:else}<span class="muted small num">{used == null ? "" : used + " of " + FREE_LIMIT + " checks used this month"}</span>{/if}
        </div>
        {#if revCap != null}
          <div class="rev"><div class="rev-fill" class:full={revUsed >= revCap} style="width:{revPct}%"></div></div>
        {/if}
        {#if revWarn}<div class="error" style="margin-top:8px">⚠️ {revWarn}</div>{/if}
      {/if}

      <label for="sg-msg" style="margin-top:12px">Client message (email, Slack or WhatsApp)</label>
      <textarea id="sg-msg" rows="6" maxlength="4000" bind:value={message} placeholder="e.g. Can you also add a dark mode and change the homepage layout? Should be quick."></textarea>
      <button class="btn primary lg block" on:click={check} disabled={loading}>{loading ? "Checking against your contract..." : "Check scope ⚡"}</button>
      <p class="muted small" style="margin:8px 0 0">The message is not stored. We only count the check.</p>
      {#if error}<div class="error" role="alert">⚠️ {error}</div>{/if}
      {#if upgrade}<button class="btn primary block" style="margin-top:10px" on:click={() => openPay("pro_year")}>Upgrade to Pro for unlimited checks ⚡</button>{/if}
    </section>

    {#if result}
      <section class="card iri">
        <div class="row between">
          <b>Verdict</b>
          <span class="badge {V[result.verdict].cls}"><i class="dot"></i>{V[result.verdict].label}</span>
        </div>
        <p class="pre" style="margin:0 0 8px">{fmt(result.reasoning)}</p>

        <div class="lbl">Contract clause</div>
        {#if result.clause_quote}
          <blockquote class="redline">{fmt(result.clause_quote)}</blockquote>
        {:else}
          <p class="muted small" style="margin:0">No saved clause covers this request, so treat it as a conversation with the client.</p>
        {/if}

        {#if result.counts_as_revision}
          <div class="row" style="margin-top:12px">
            <span class="muted small">This looks like a revision round.</span>
            <button class="btn sm mfull" on:click={countRevision} disabled={counted}>{counted ? "Counted ✓" : "Count as revision round (+1)"}</button>
          </div>
        {/if}

        <div class="rw-h" style="margin-top:14px">
          <span class="rw-tag">Ready-to-send reply</span>
          <button class="btn sm primary" on:click={() => copy("reply", result.reply_script)}>{copied === "reply" ? "Copied ✓" : "Copy reply"}</button>
        </div>
        <div class="mail">{fmt(result.reply_script)}</div>

        {#if result.change_order_text}
          <div class="rw-h" style="margin-top:6px">
            <span class="rw-tag">Change-order quote</span>
            <button class="btn sm" on:click={() => copy("co", result.change_order_text)}>{copied === "co" ? "Copied ✓" : "Copy change order"}</button>
          </div>
          <div class="mail">{fmt(result.change_order_text)}</div>
          {#if result.estimated_hours}
            <p class="muted small" style="margin:0">Estimated {result.estimated_hours} hours{result.estimated_cost ? " (about " + result.estimated_cost + ")" : ""}. Adjust the hours and rate before sending.</p>
          {/if}
        {/if}
      </section>
    {/if}
  {/if}
</div>
`);
// ---------------------------------------------------------------------------
// v3: Payment Chaser, Pricing, Account, Nav, App shell
// ---------------------------------------------------------------------------
F("src/pages/Chaser.svelte", String.raw`<script>
  import { user, isPro, openAuth, openPay, link, copyToClipboard, projects, invoices, loadProjects, loadInvoices, saveInvoice, markInvoicePaid, deleteInvoice, activeProject, memoryError } from "../lib/app.js";

  const DAY = 86400000;
  let projectId = "";
  let amount = "";
  let invDate = ymd(new Date());
  let dueDate = "";
  let dueTouched = false;
  let rate = 12;
  let error = "";
  let saving = false;
  let showPaid = false;
  let openId = "";
  let copied = "";

  $: if ($user) { loadProjects(); loadInvoices(); }
  // always land on the latest saved project, never on an empty screen
  $: if ($projects.length && (!projectId || !$projects.some(function (p) { return p.id === projectId; }))) projectId = $activeProject && $projects.some(function (p) { return p.id === $activeProject; }) ? $activeProject : $projects[0].id;
  $: if (projectId) activeProject.set(projectId);
  $: project = $projects.find(function (p) { return p.id === projectId; }) || null;
  $: if (project && invDate && !dueTouched && project.payment_days != null) dueDate = addDays(invDate, project.payment_days);
  $: list = $invoices.filter(function (i) { return showPaid ? true : !i.paid_at; });
  $: paidCount = $invoices.filter(function (i) { return i.paid_at; }).length;

  function pad(n) { return n < 10 ? "0" + n : String(n); }
  function ymd(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function parse(iso) { return new Date(iso + "T00:00:00"); }
  function addDays(iso, n) { const d = parse(iso); d.setDate(d.getDate() + n); return ymd(d); }
  function diffDays(aIso, bIso) { return Math.round((parse(bIso) - parse(aIso)) / DAY); }
  function today() { return ymd(new Date()); }
  function projectOf(id, list2) { return list2.find(function (p) { return p.id === id; }) || null; }
  function sym(p) { return p && p.jurisdiction === "global" ? "$" : "₹"; }
  function money(n, p) {
    return sym(p) + Math.round(Number(n) || 0).toLocaleString(p && p.jurisdiction === "global" ? "en-US" : "en-IN");
  }

  function track(inv, p, r) {
    const diff = diffDays(today(), inv.due_date);
    const overdue = Math.max(0, -diff);
    const age = diffDays(inv.invoice_date, today());
    const amt = Number(inv.amount) || 0;
    const delay = amt * ((Number(r) || 0) / 100) * (overdue / 365);
    const pct = p && p.late_fee_pct_month != null ? Number(p.late_fee_pct_month) : null;
    const lateFee = pct ? amt * (pct / 100) * (overdue / 30) : null;
    const india = !p || p.jurisdiction !== "global";
    let level = 1;
    if (overdue >= 30 || (india && age > 45 && overdue > 0)) level = 3;
    else if (overdue >= 14) level = 2;
    return { diff: diff, overdue: overdue, age: age, delay: delay, lateFee: lateFee, level: level, paid: !!inv.paid_at };
  }

  function statusText(t) {
    if (t.paid) return "Paid";
    if (t.diff > 0) return "Due in " + t.diff + (t.diff === 1 ? " day" : " days");
    if (t.diff === 0) return "Due today";
    return t.overdue + (t.overdue === 1 ? " day" : " days") + " overdue";
  }
  function statusCls(t) {
    if (t.paid) return "low";
    if (t.overdue >= 14) return "high";
    if (t.overdue > 0 || t.diff <= 3) return "med";
    return "low";
  }

  function letters(inv, p, t) {
    const client = p && p.client_name ? p.client_name : "[Client Name]";
    const name = p ? p.name : "the project";
    const amt = money(inv.amount, p);
    const sign = "\n\nBest regards,\n[Your Name]";
    const days = p && p.payment_days != null ? p.payment_days : null;
    const clause = p && p.excerpts && p.excerpts.payment ? p.excerpts.payment : "";
    const india = !p || p.jurisdiction !== "global";

    const l1 = "Subject: Friendly reminder: invoice for " + name + " due " + inv.due_date + "\n\nHi " + client + ",\n\nHope you are doing well. This is a quick reminder that my invoice for " + name + " (" + amt + ", dated " + inv.invoice_date + ") is due on " + inv.due_date + ".\n\nIf payment is already in process, thank you and please ignore this note. If you need anything from me to release it (a PO number, bank details or a corrected invoice), let me know and I will send it right away." + sign;

    let l2 = "Subject: Overdue invoice for " + name + " (" + amt + ", " + t.overdue + " days past due)\n\nHi " + client + ",\n\nMy invoice for " + name + " (" + amt + ", dated " + inv.invoice_date + ") was due on " + inv.due_date + " and is now " + t.overdue + " days overdue.\n\n";
    if (clause) l2 += "As agreed in our contract: \"" + clause + "\"\n\n";
    else if (days != null) l2 += "Our agreement provides for payment within " + days + " days.\n\n";
    if (t.lateFee) l2 += "Under the contract's late-fee terms, a late fee of about " + money(t.lateFee, p) + " has accrued so far.\n\n";
    l2 += "Please confirm the payment date within 5 business days. If there is an issue with the invoice, tell me today so we can resolve it quickly." + sign;

    let l3 = "Subject: Formal demand for payment: " + name + "\n\nDear " + client + ",\n\nThis is a formal notice that my invoice dated " + inv.invoice_date + " for " + amt + " in respect of " + name + " remains unpaid. It was due on " + inv.due_date + ", and " + t.overdue + " days have passed since the due date.\n\n";
    if (clause) l3 += "The agreement states: \"" + clause + "\"\n\n";
    if (t.lateFee) l3 += "Late charges of about " + money(t.lateFee, p) + " have accrued under the agreement.\n\n";
    if (india) l3 += "I am registered as a micro or small enterprise under the Micro, Small and Medium Enterprises Development Act, 2006 (Udyam Registration No. [UDYAM-XX-00-0000000]). Section 15 of the Act requires payment within the agreed period, which may not exceed 45 days from the day of acceptance of the services, and Section 16 provides for compound interest on delayed payments at three times the bank rate notified by the Reserve Bank of India. I reserve the right to claim this interest and to approach the MSME Facilitation Council.\n\n";
    l3 += "I request payment in full within 7 days of this notice. If payment is not received, I will pursue the remedies available to me under the agreement and applicable law, and the costs of recovery may be claimed from you." + sign;

    return [
      { n: 1, title: "Level 1: Friendly reminder", text: l1, free: true },
      { n: 2, title: "Level 2: Firm reminder (14+ days overdue)", text: l2, free: false },
      { n: 3, title: "Level 3: Formal demand notice", text: l3, free: false, note: india ? "Use the MSMED paragraph only if you are Udyam-registered. This is a draft, not legal advice. Have a CA or lawyer check it before sending." : "This is a draft, not legal advice. Check local rules before sending." },
    ];
  }

  async function add() {
    error = "";
    if (!project) { error = "Select a project first."; return; }
    const amt = parseFloat(amount);
    if (!isFinite(amt) || amt <= 0) { error = "Enter the invoice amount."; return; }
    if (!invDate || !dueDate) { error = "Enter the invoice date and due date."; return; }
    saving = true;
    try {
      await saveInvoice({ project_id: project.id, amount: amt, invoice_date: invDate, due_date: dueDate });
      amount = "";
      dueTouched = false;
    } catch (e) {
      error = e && e.message ? e.message : "Could not save the invoice.";
    } finally {
      saving = false;
    }
  }

  async function paid(inv) {
    try { await markInvoicePaid(inv.id, today()); } catch (e) { error = e.message; }
  }
  async function remove(inv) {
    try { await deleteInvoice(inv.id); } catch (e) { error = e.message; }
  }
  async function copy(id, text) {
    await copyToClipboard(text);
    copied = id;
    setTimeout(function () { if (copied === id) copied = ""; }, 1600);
  }
</script>

<div class="wrap narrow page">
  <h1 class="h2">Payment Chaser</h1>
  <p class="lead" style="margin:0 0 14px;text-align:left">The contract says Net-30. The client is on Day 41. Here's your exact escalation sequence.</p>

  {#if !$user}
    <section class="card">
      <p style="margin:0 0 12px">Log in to track invoices against your saved projects.</p>
      <button class="btn primary block" on:click={() => openAuth("login", "Log in to use Payment Chaser.")}>Log in</button>
    </section>
  {:else if $projects.length === 0}
    <section class="card">
      {#if $memoryError}<div class="error" role="alert" style="margin:0 0 12px">⚠️ {$memoryError}</div>{/if}
      <b>No active project yet</b>
      <p class="muted small" style="margin:6px 0 12px">Scan a contract and choose Save to Contract Memory. Payment Chaser reads the payment terms and late-fee clause you saved.</p>
      <a class="btn primary block" href="/dashboard" on:click={(e) => link(e, "/dashboard")}>Scan a contract</a>
    </section>
  {:else}
    <section class="card">
      <b>Track an invoice</b>
      <label for="pc-project" style="margin-top:10px">Project</label>
      <select id="pc-project" bind:value={projectId}>
        {#each $projects as p}<option value={p.id}>{p.name}{p.client_name ? " – " + p.client_name : ""}</option>{/each}
      </select>
      <div class="grid2">
        <div><label for="pc-amt">Invoice amount ({sym(project)})</label><input id="pc-amt" type="number" min="0" inputmode="decimal" bind:value={amount} /></div>
        <div><label for="pc-rate">Your cost of money (% per year)</label><input id="pc-rate" type="number" min="0" max="60" inputmode="decimal" bind:value={rate} /></div>
        <div><label for="pc-inv">Invoice date</label><input id="pc-inv" type="date" bind:value={invDate} on:change={() => (dueTouched = false)} /></div>
        <div>
          <label for="pc-due">Due date {project && project.payment_days != null ? "(Net-" + project.payment_days + ", auto)" : ""}</label>
          <input id="pc-due" type="date" bind:value={dueDate} on:input={() => (dueTouched = true)} />
        </div>
      </div>
      <button class="btn primary block" on:click={add} disabled={saving}>{saving ? "Saving..." : "Add invoice"}</button>
      {#if $memoryError}<div class="error" role="alert">⚠️ {$memoryError}</div>{/if}
      {#if error}<div class="error" role="alert">⚠️ {error}</div>{/if}
      {#if error.indexOf("Free plan") !== -1}<button class="btn primary block" style="margin-top:10px" on:click={() => openPay("pro_year")}>Upgrade to Pro ⚡</button>{/if}
    </section>

    {#each list as inv (inv.id)}
      {@const p = projectOf(inv.project_id, $projects)}
      {@const t = track(inv, p, rate)}
      <article class="card inv">
        <div class="row between" style="margin-bottom:6px">
          <b>{p ? p.name : "Project"}{p && p.client_name ? " – " + p.client_name : ""}</b>
          <span class="badge {statusCls(t)}"><i class="dot"></i>{statusText(t)}</span>
        </div>
        <div class="num" style="font-size:1.4rem;font-weight:800">{money(inv.amount, p)}</div>
        <p class="muted small" style="margin:2px 0 8px">Invoiced {inv.invoice_date} • Due {inv.due_date}</p>
        {#if !t.paid}
          <ul class="lines">
            <li><span>{t.diff >= 0 ? "Days until due" : "Days overdue"}</span><b class="num">{t.diff >= 0 ? t.diff : t.overdue}</b></li>
            <li><span>Cost of delayed capital so far</span><b class="num">{money(t.delay, p)}</b></li>
            {#if t.lateFee}<li><span>Contract late fee accrued</span><b class="num">{money(t.lateFee, p)}</b></li>{/if}
            <li><span>Suggested now</span><b>Level {t.level}</b></li>
          </ul>
        {/if}
        <div class="row">
          {#if !t.paid}<button class="btn sm mfull" on:click={() => (openId = openId === inv.id ? "" : inv.id)}>{openId === inv.id ? "Hide" : "Show"} escalation sequence</button>{/if}
          {#if !t.paid}<button class="btn sm mfull" on:click={() => paid(inv)}>Mark paid</button>{/if}
          <button class="btn sm mfull" on:click={() => remove(inv)}>Delete</button>
        </div>
        {#if openId === inv.id && !t.paid}
          {#each letters(inv, p, t) as L}
            <div class="lvl" class:sug={L.n === t.level}>
              <div class="rw-h">
                <span class="rw-tag">{L.title}{L.n === t.level ? " • suggested" : ""}</span>
                {#if L.free || $isPro}<button class="btn sm" on:click={() => copy(inv.id + L.n, L.text)}>{copied === inv.id + L.n ? "Copied ✓" : "Copy"}</button>{/if}
              </div>
              {#if L.free || $isPro}
                {#if L.note}<p class="muted small" style="margin:0 0 6px">{L.note}</p>{/if}
                <div class="mail">{L.text}</div>
              {:else}
                <div class="locked">
                  <div class="blurred" aria-hidden="true"><div class="mail">Subject: Overdue invoice{"\n\n"}Hi, my invoice was due on the date above and is now overdue. As agreed in our contract...</div></div>
                  <div class="lock-over"><div class="lock-card">
                    <div class="lock-t">🔒 Pro: full legal escalation letters</div>
                    <button class="btn primary block" on:click={() => openPay("pro_year")}>Upgrade to Pro ⚡</button>
                  </div></div>
                </div>
              {/if}
            </div>
          {/each}
        {/if}
      </article>
    {/each}

    {#if paidCount > 0}
      <div class="row" style="margin-top:12px"><button class="btn sm mfull" on:click={() => (showPaid = !showPaid)}>{showPaid ? "Hide" : "Show"} paid invoices ({paidCount})</button></div>
    {/if}
    {#if list.length === 0}
      <section class="card"><p class="muted" style="margin:0">No open invoices. Add one above to start tracking.</p></section>
    {/if}
  {/if}
</div>
`);

F("src/pages/Pricing.svelte", String.raw`<script>
  import { openPay, isPro, profile, fmtDate } from "../lib/app.js";
  import { PLANS, FREE_FEATURES, PRO_FEATURES } from "../lib/data.mjs";

  const STEPS = [
    ["1", "Tap to pay", "Choose Monthly or Yearly and tap the UPI button. GPay, PhonePe or Paytm opens with the amount filled in."],
    ["2", "Capture the success screen", "Take a screenshot showing the amount, receiver and transaction ID."],
    ["3", "Upload and verify", "Upload it in the payment window. AI checks the details and adds Pro time to your account."],
  ];
  let billing = "pro_year";
  $: plan = PLANS.find(function (p) { return p.id === billing; }) || PLANS[1];
</script>

<div class="wrap page">
  <div class="center">
    <h1 class="h2">Scan free. <span class="grad">Go Pro when contracts get real.</span></h1>
    <p class="lead">One simple Pro plan unlocks every rewrite, Scope Guard, Payment Chaser and PDF reports.</p>
    {#if $isPro}<p class="ok" style="display:inline-block">You are Pro until {fmtDate($profile.pro_until)}. Paying again adds more time.</p>{/if}
  </div>

  <div class="tier">
    <div class="card">
      <b>Free Plan</b>
      <div class="price num">₹0</div>
      <ul class="feat">{#each FREE_FEATURES as f}<li>{f}</li>{/each}</ul>
      <p class="muted small" style="margin:0">Free works on 1 device at a time.</p>
    </div>

    <div class="card iri">
      <div class="row between" style="margin-bottom:6px"><b>Pro Subscription</b><span class="badge low"><i class="dot"></i>Save 33% yearly</span></div>
      <div class="seg" role="group" aria-label="Billing period">
        <button class:on={billing === "pro_month"} on:click={() => (billing = "pro_month")}>Monthly</button>
        <button class:on={billing === "pro_year"} on:click={() => (billing = "pro_year")}>Yearly</button>
      </div>
      <div class="price num">₹{plan.price.toLocaleString("en-IN")}<span class="muted small"> / {plan.per}</span></div>
      <p class="muted small" style="margin:0 0 4px">{plan.per === "year" ? "About ₹" + Math.round(plan.price / 12) + " per month. Save 33% versus monthly." : "₹499 per month."} Each payment adds {plan.days} days of Pro.</p>
      <ul class="feat">{#each PRO_FEATURES as f}<li>{f}</li>{/each}</ul>
      <button class="btn primary lg block" on:click={() => openPay(plan.id)}>{$isPro ? "Extend Pro" : "Upgrade with UPI"} ⚡</button>
    </div>
  </div>
  <p class="muted small center" style="margin-top:14px">Pay by UPI. Each verified payment adds time to your Pro plan. Automatic renewal is not enabled yet, so you renew by paying again before your Pro time ends.</p>

  <h2 class="h2 center" style="margin-top:44px">How UPI payment works</h2>
  <div class="grid3">
    {#each STEPS as s}
      <div class="card" style="margin-top:0">
        <div class="stepno">{s[0]}</div>
        <b>{s[1]}</b>
        <p class="muted small" style="margin:6px 0 0">{s[2]}</p>
      </div>
    {/each}
  </div>
  <p class="muted small center" style="margin-top:18px">Payments are verified automatically. Reused screenshots or transaction IDs are rejected.</p>
</div>
`);

F("src/pages/Account.svelte", String.raw`<script>
  import { sb, user, isPro, profile, deviceState, openAuth, openPay, refreshProfile, syncDevice, revokeDevice, signOutThisDevice, fmtDate, projects, invoices, loadProjects, loadInvoices, deleteProject, scopeUsage, memoryError } from "../lib/app.js";

  let used = null;
  let msg = "";
  $: initial = $user && $user.email ? $user.email.charAt(0).toUpperCase() : "";
  $: if ($user) { loadProjects(); loadInvoices(); syncDevice("list"); scopeUsage().then(function (n) { used = n; }); }
  $: openInv = $invoices.filter(function (i) { return !i.paid_at; }).length;
  $: devs = $deviceState.devices || [];
  $: activeCount = devs.filter(function (d) { return d.active; }).length;

  function ago(iso) {
    const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
    if (m < 2) return "just now";
    if (m < 60) return m + " min ago";
    if (m < 1440) return Math.round(m / 60) + " h ago";
    return Math.round(m / 1440) + " d ago";
  }
  async function removeProject(p) {
    msg = "";
    try { await deleteProject(p.id); } catch (e) { msg = e.message; }
  }
</script>

<div class="wrap narrow page">
  <h1 class="h2">Account</h1>

  {#if !sb}
    <section class="card"><div class="error">Login is not configured yet. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then redeploy.</div></section>
  {:else if !$user}
    <section class="card">
      <p class="muted" style="margin:0 0 12px">Log in to see your plan, projects and devices.</p>
      <div class="row">
        <button class="btn primary mfull" on:click={() => openAuth("login")}>Log in</button>
        <button class="btn mfull" on:click={() => openAuth("signup")}>Create account</button>
      </div>
    </section>
  {:else}
    <section class="card">
      <div class="row" style="gap:14px;margin-bottom:12px">
        <span class="avatar" style="width:52px;height:52px;font-size:1.3rem">{initial}</span>
        <div style="min-width:0">
          <div class="pre"><b>{$user.email}</b></div>
          <span class="badge {$isPro ? 'low' : 'med'}"><i class="dot"></i>Plan: {$isPro ? "Pro ⚡" : "Free"}</span>
        </div>
      </div>
      {#if $isPro}
        <p style="margin:0 0 4px">Pro ({$profile.pro_plan === "pro_year" ? "Yearly" : "Monthly"}) is active until <b>{fmtDate($profile.pro_until)}</b>.</p>
        <p class="muted small" style="margin:0 0 12px">Renewal is manual: pay again before this date to extend. Automatic renewal is not enabled yet.</p>
      {:else}
        <p class="muted" style="margin:0 0 12px">You are on the Free plan. Go Pro to unlock every rewrite, unlimited Scope Guard and Payment Chaser, PDF exports and 3 devices.</p>
      {/if}
      <div class="row">
        <button class="btn primary mfull" on:click={() => openPay("pro_year")}>{$isPro ? "Extend Pro" : "Upgrade to Pro"} ⚡</button>
        <button class="btn mfull" on:click={() => { refreshProfile($user.id); syncDevice("list"); }}>Refresh</button>
      </div>
    </section>

    <section class="card">
      <b>Usage</b>
      <ul class="lines">
        <li><span>Projects in Contract Memory</span><b class="num">{$projects.length}{$isPro ? "" : " of 1"}</b></li>
        <li><span>Open invoices</span><b class="num">{openInv}{$isPro ? "" : " of 1"}</b></li>
        <li><span>Scope Guard checks this month</span><b class="num">{used == null ? "-" : used}{$isPro ? "" : " of 3"}</b></li>
      </ul>
      {#if $memoryError}<div class="error" role="alert" style="margin:0 0 10px">⚠️ {$memoryError}</div>{/if}
      {#each $projects as p}
        <div class="row between" style="margin:0 0 6px">
          <span style="min-width:0;overflow-wrap:anywhere">{p.name}{p.client_name ? " – " + p.client_name : ""}</span>
          <button class="btn sm" on:click={() => removeProject(p)}>Delete</button>
        </div>
      {/each}
      {#if msg}<div class="error">{msg}</div>{/if}
    </section>

    <section class="card">
      <div class="row between" style="margin-bottom:4px"><b>Logged-in devices</b><span class="badge {activeCount > $deviceState.limit ? 'high' : 'low'}">Active {activeCount} of {$deviceState.limit}</span></div>
      <p class="muted small" style="margin:0 0 10px">{$isPro ? "Pro lets you use ClauseRadar on up to 3 devices at the same time." : "Free allows 1 device at a time. Pro allows up to 3."} A device counts as active for 20 minutes after its last use.</p>
      {#each devs as d (d.device_id)}
        <div class="dev">
          <div style="min-width:0">
            <b>{d.label}</b>{#if d.current} <span class="badge low">This device</span>{/if}
            <div class="muted small">{d.active ? "Active now" : "Last active " + ago(d.last_seen)}</div>
          </div>
          {#if !d.current}<button class="btn sm" on:click={() => revokeDevice(d.device_id)}>Sign out</button>{/if}
        </div>
      {/each}
      {#if devs.length === 0}<p class="muted small" style="margin:0">No device information yet.</p>{/if}
      <button class="btn block" style="margin-top:12px" on:click={signOutThisDevice}>Sign out of this device</button>
    </section>
  {/if}
</div>
`);

F("src/lib/Nav.svelte", String.raw`<script>
  import { route, user, isPro, profile, authReady, bootSlow, link, openAuth, openPay, signOutThisDevice } from "./app.js";

  let open = false;
  // opt = secondary links: always in the mobile menu, shown on very wide desktops only
  const LINKS = [
    ["/dashboard", "Scanner", false], ["/scope-guard", "Scope Guard", false], ["/chaser", "Payment Chaser", false],
    ["/sample", "Sample Report", false], ["/pricing", "Pricing", false],
    ["/refer", "Earn 30% 💸", true], ["/guides", "Guides", true], ["/radar", "Risk calculator", true], ["/vault", "Clause library", true],
  ];

  $: planReady = $bootSlow || ($authReady && (!$user || $profile.loaded));
  $: initial = $user && $user.email ? $user.email.charAt(0).toUpperCase() : "";

  function nav(e, p) {
    open = false;
    link(e, p);
  }
  function act(fn) {
    open = false;
    fn();
  }
</script>

<svelte:window on:keydown={(e) => { if (e.key === "Escape") open = false; }} />

<header class="nav">
  <div class="nav-in">
    <a class="brand" href="/" on:click={(e) => nav(e, "/")}>
      <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="#4f46e5" /><circle cx="16" cy="16" r="9" fill="none" stroke="#fff" stroke-opacity=".9" stroke-width="2" /><circle cx="16" cy="16" r="4" fill="none" stroke="#fff" stroke-opacity=".9" stroke-width="2" /><circle cx="22" cy="10" r="2.6" fill="#fb7185" /></svg>
      ClauseRadar
    </a>

    <nav class="nav-links" aria-label="Main">
      {#each LINKS as l}
        <a href={l[0]} class:opt={l[2]} class:active={$route === l[0]} on:click={(e) => nav(e, l[0])}>{l[1]}</a>
      {/each}
    </nav>

    <div class="nav-right">
      {#if planReady}
      <a class="planpill" class:pro={$isPro} href="/pricing" title={$isPro ? "Pro plan" : "Free plan. Tap to upgrade"} on:click={(e) => nav(e, "/pricing")}><span class="pl-pre">Plan: </span><b>{$isPro ? "Pro ⚡" : "Free"}</b></a>
      {:else}<span class="skel pill"></span>{/if}
      {#if planReady}
      <div class="nav-desktop">
        {#if !$isPro}<button class="btn sm primary" on:click={() => openPay("pro_year")}>Upgrade</button>{/if}
        {#if $user}
          <a class="avatar" href="/account" title={$user.email} on:click={(e) => nav(e, "/account")}>{initial}</a>
        {:else}
          <button class="btn sm" on:click={() => openAuth("login")}>Log in</button>
        {/if}
      </div>
      {:else}<div class="nav-desktop"><span class="skel act"></span></div>{/if}
      <button class="burger" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} on:click={() => (open = !open)}>{open ? "✕" : "☰"}</button>
    </div>
  </div>

  {#if open}
    <button class="scrim" aria-label="Close menu" on:click={() => (open = false)}></button>
    <nav class="menu" aria-label="Mobile">
      {#each LINKS as l}
        <a href={l[0]} class:active={$route === l[0]} on:click={(e) => nav(e, l[0])}>{l[1]}</a>
      {/each}
      <hr />
      {#if !$isPro}<button class="mi" on:click={() => act(() => openPay("pro_year"))}>⚡ Upgrade to Pro</button>{/if}
      {#if $user}
        <a href="/account" class:active={$route === "/account"} on:click={(e) => nav(e, "/account")}>👤 Account ({$user.email})</a>
      {:else}
        <button class="mi" on:click={() => act(() => openAuth("login"))}>Log in</button>
        <button class="mi" on:click={() => act(() => openAuth("signup"))}>Create account</button>
      {/if}
    </nav>
  {/if}
</header>
`);

F("src/App.svelte", String.raw`<script>
  import "./lib/styles.css";
  import { onMount } from "svelte";
  import { route, initApp, link } from "./lib/app.js";
  import Nav from "./lib/Nav.svelte";
  import Footer from "./lib/Footer.svelte";
  import Modals from "./lib/Modals.svelte";
  import Home from "./pages/Home.svelte";
  import Sample from "./pages/Sample.svelte";
  import Dashboard from "./pages/Dashboard.svelte";
  import Pricing from "./pages/Pricing.svelte";
  import Legal from "./pages/Legal.svelte";
  import Radar from "./pages/Radar.svelte";
  import Vault from "./pages/Vault.svelte";
  import Account from "./pages/Account.svelte";
  import ScopeGuard from "./pages/ScopeGuard.svelte";
  import Chaser from "./pages/Chaser.svelte";
  import Refer from "./pages/Refer.svelte";
  import Admin from "./pages/Admin.svelte";
  import Guide from "./pages/Guide.svelte";
  import GuidesHub from "./pages/GuidesHub.svelte";

  onMount(function () {
    return initApp();
  });
</script>

<Nav />

<main>
  {#if $route === "/"}
    <Home />
  {:else if $route === "/sample"}
    <Sample />
  {:else if $route === "/dashboard"}
    <Dashboard />
  {:else if $route === "/scope-guard"}
    <ScopeGuard />
  {:else if $route === "/chaser"}
    <Chaser />
  {:else if $route === "/guides"}
    <GuidesHub />
  {:else if $route.indexOf("/guide/") === 0}
    <Guide path={$route} />
  {:else if $route === "/refer"}
    <Refer />
  {:else if $route === "/admin"}
    <Admin />
  {:else if $route === "/pricing"}
    <Pricing />
  {:else if $route === "/privacy"}
    <Legal kind="privacy" />
  {:else if $route === "/terms"}
    <Legal kind="terms" />
  {:else if $route === "/radar"}
    <Radar />
  {:else if $route === "/vault"}
    <Vault />
  {:else if $route === "/account"}
    <Account />
  {:else}
    <div class="wrap narrow page center">
      <h1 class="h2">Page not found</h1>
      <p class="muted">That page does not exist.</p>
      <a class="btn primary" href="/" on:click={(e) => link(e, "/")}>Back to home</a>
    </div>
  {/if}
</main>

<Footer />
<Modals />
`);
F("src/pages/Refer.svelte", String.raw`<script>
  import { onMount } from "svelte";
  import { user, profile, referrals, payouts, refError, MIN_PAYOUT, openAuth, copyToClipboard, loadReferralData, requestPayout, referralLink, fmtDate } from "../lib/app.js";

  let upi = "";
  let busy = false;
  let msg = "";
  let msgOk = false;
  let copied = false;

  $: code = $profile.ref_code || ($user ? $user.id.slice(0, 8) : "");
  $: refLink = code ? referralLink(code) : "";
  $: wa = "https://wa.me/?text=" + encodeURIComponent("I use ClauseRadar to check freelance contracts for risky clauses. Try it free: " + refLink);
  $: li = "https://www.linkedin.com/sharing/share-offsite/?url=" + encodeURIComponent(refLink);
  $: totalEarned = $referrals.reduce(function (s, r) { return s + Number(r.commission_amount || 0); }, 0);
  $: referredCount = new Set($referrals.map(function (r) { return r.referred_user_id; })).size;
  $: balance = Number($profile.wallet_balance) || 0;
  $: paidOut = $payouts.filter(function (p) { return p.status === "approved"; }).reduce(function (s, p) { return s + Number(p.amount || 0); }, 0);
  $: chart = buildChart($referrals);
  $: maxBar = Math.max(1, ...chart.map(function (c) { return c.amount; }));
  $: if ($user) loadReferralData();

  onMount(function () {
    const t = setInterval(function () { if ($user) loadReferralData(); }, 30000);
    return function () { clearInterval(t); };
  });

  function compact(n) {
    const v = Math.round(Number(n) || 0);
    return v >= 1000 ? "₹" + (v / 1000).toFixed(1).replace(/\.0$/, "") + "k" : "₹" + v;
  }

  function rupee(n) {
    return "₹" + Math.round(Number(n) || 0).toLocaleString("en-IN");
  }

  function buildChart(list) {
    const now = new Date();
    const out = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      out.push({ key: d.getFullYear() + "-" + d.getMonth(), label: d.toLocaleDateString("en-IN", { month: "short" }), amount: 0 });
    }
    list.forEach(function (r) {
      const d = new Date(r.created_at);
      const slot = out.find(function (x) { return x.key === d.getFullYear() + "-" + d.getMonth(); });
      if (slot) slot.amount += Number(r.commission_amount || 0);
    });
    return out;
  }

  async function copyLink() {
    await copyToClipboard(refLink);
    copied = true;
    setTimeout(function () { copied = false; }, 1600);
  }

  async function withdraw() {
    msg = "";
    msgOk = false;
    if (balance < MIN_PAYOUT) { msg = "You need at least ₹" + MIN_PAYOUT + " in your balance to withdraw."; return; }
    busy = true;
    try {
      await requestPayout(upi);
      msgOk = true;
      msg = "Payout requested ✅ It will show as approved after review.";
      upi = "";
    } catch (e) {
      msg = e && e.message ? e.message : "Could not request the payout.";
    } finally {
      busy = false;
    }
  }
</script>

<div class="wrap narrow page">
  <div class="center">
    <span class="pill">Referral program</span>
    <h1 class="h2" style="margin-top:12px">Earn 30% 💸 on every sale</h1>
    <p class="lead">Refer friends to ClauseRadar Pro &amp; earn 30% cash on every sale (₹150/mo or ₹1,200/yr per user) directly to your UPI!</p>
  </div>

  {#if !$user}
    <section class="card iri">
      <b>Get your referral link</b>
      <p class="muted small" style="margin:6px 0 12px">Log in to get your personal link and track your earnings.</p>
      <button class="btn primary lg block" on:click={() => openAuth("login", "Log in to get your referral link.")}>Log in to start earning</button>
    </section>
  {:else}
    <section class="card iri">
      <b>Your referral link</b>
      <div class="linkrow" style="margin:10px 0">
        <input readonly value={refLink} aria-label="Your referral link" on:focus={(e) => e.target.select()} />
        <button class="btn primary" on:click={copyLink}>{copied ? "Copied ✓" : "Copy Referral Link"}</button>
      </div>
      <div class="row" style="margin:0">
        <a class="btn mfull" href={wa} target="_blank" rel="noopener noreferrer">Share on WhatsApp</a>
        <a class="btn mfull" href={li} target="_blank" rel="noopener noreferrer">Share on LinkedIn</a>
      </div>
    </section>

    <div class="stats4">
      <div class="stat4"><span>Total Referrals</span><b class="num">{referredCount}</b></div>
      <div class="stat4"><span>Total Earned</span><b class="num">{rupee(totalEarned)}</b></div>
      <div class="stat4"><span>Available Balance</span><b class="num">{rupee(balance)}</b></div>
      <div class="stat4"><span>Paid Out</span><b class="num">{rupee(paidOut)}</b></div>
    </div>

    {#if $refError}<div class="error" role="alert">⚠️ {$refError}</div>{/if}

    <section class="card">
      <b>Monthly earnings</b>
      <div class="bars" aria-label="Earnings for the last 6 months">
        {#each chart as c}
          <div class="barcol">
            <small class="num">{c.amount > 0 ? compact(c.amount) : ""}</small>
            <div class="bar" style="height:{Math.round((c.amount / maxBar) * 100)}%"></div>
            <small>{c.label}</small>
          </div>
        {/each}
      </div>
    </section>

    <section class="card">
      <b>Request payout</b>
      <p class="muted small" style="margin:6px 0 10px">Available: <b class="num">{rupee(balance)}</b>. Minimum payout ₹{MIN_PAYOUT}. We pay manually to your UPI ID.</p>
      <label for="rf-upi">Your UPI ID</label>
      <input id="rf-upi" bind:value={upi} placeholder="name@bank" autocomplete="off" autocapitalize="off" />
      <button class="btn primary block" on:click={withdraw} disabled={busy || balance < MIN_PAYOUT}>{busy ? "Requesting..." : "Withdraw Balance"}</button>
      {#if msg}<div class={msgOk ? "ok" : "error"} role="alert">{msg}</div>{/if}
    </section>

    <section class="card">
      <b>Your payout requests</b>
      {#each $payouts as p (p.id)}
        <div class="payrow">
          <div style="min-width:0">
            <b class="num">{rupee(p.amount)}</b>
            <div class="muted small" style="overflow-wrap:anywhere">{p.upi_id} • {fmtDate(p.created_at)}</div>
          </div>
          {#if p.status === "approved"}
            <span class="badge low"><i class="dot"></i>Payment Approved ✅</span>
          {:else if p.status === "rejected"}
            <span class="badge high"><i class="dot"></i>Rejected ❌ (refunded)</span>
          {:else}
            <span class="badge med"><i class="dot"></i>Pending ⏳</span>
          {/if}
        </div>
      {/each}
      {#if $payouts.length === 0}<p class="muted small" style="margin:8px 0 0">No payout requests yet.</p>{/if}
    </section>
  {/if}

  <section class="card">
    <b>How it works</b>
    <ol class="steps" style="margin:8px 0 0">
      <li>Share your link. When a friend signs up through it and buys Pro, they are linked to you.</li>
      <li>You earn 30% of every verified payment they make: ₹150 on the monthly plan, ₹1,200 on the yearly plan.</li>
      <li>Request a payout once you reach ₹{MIN_PAYOUT}. We review and pay it to your UPI ID.</li>
    </ol>
    <p class="muted small" style="margin:10px 0 0">Commissions are paid only on verified payments. Self-referrals, fake accounts and fake payments are rejected and can lead to a ban. Payouts are reviewed manually.</p>
  </section>
</div>
`);

F("src/pages/Admin.svelte", String.raw`<script>
  import { user, authHeaders, readJson, openAuth, copyToClipboard, fmtDate } from "../lib/app.js";

  let pw = "";
  let unlocked = false;
  let rows = [];
  let busy = false;
  let error = "";
  let copied = "";

  $: pending = rows.filter(function (r) { return r.status === "pending"; });
  $: done = rows.filter(function (r) { return r.status !== "pending"; });

  function rupee(n) {
    return "₹" + Math.round(Number(n) || 0).toLocaleString("en-IN");
  }

  function upiLink(r) {
    return "upi://pay?pa=" + r.upi_id + "&pn=" + encodeURIComponent("ClauseRadar affiliate") + "&am=" + Number(r.amount).toFixed(2) + "&cu=INR&tn=" + encodeURIComponent("ClauseRadar referral payout");
  }

  async function call(action, extra) {
    const headers = await authHeaders();
    headers["x-admin-password"] = pw;
    const r = await fetch("/api/admin-payouts", { method: "POST", headers: headers, body: JSON.stringify(Object.assign({ action: action }, extra || {})) });
    const d = await readJson(r);
    if (!r.ok) throw new Error(d.error || "Request failed (HTTP " + r.status + ")");
    return d;
  }

  async function unlock(e) {
    if (e) e.preventDefault();
    error = "";
    busy = true;
    try {
      const d = await call("list");
      rows = d.payouts || [];
      unlocked = true;
    } catch (err) {
      error = err && err.message ? err.message : "Could not unlock.";
      unlocked = false;
    } finally {
      busy = false;
    }
  }

  async function act(id, action) {
    if (action === "reject" && !window.confirm("Reject this payout and refund the balance to the user?")) return;
    error = "";
    busy = true;
    try {
      await call(action, { id: id });
      const d = await call("list");
      rows = d.payouts || [];
    } catch (err) {
      error = err && err.message ? err.message : "Action failed.";
    } finally {
      busy = false;
    }
  }

  function lock() {
    pw = "";
    unlocked = false;
    rows = [];
  }

  async function copy(id, text) {
    await copyToClipboard(text);
    copied = id;
    setTimeout(function () { if (copied === id) copied = ""; }, 1600);
  }
</script>

<div class="wrap narrow page">
  <h1 class="h2">Admin: payouts</h1>

  {#if !$user}
    <section class="card">
      <p style="margin:0 0 12px">Log in first, then enter the admin password.</p>
      <button class="btn primary block" on:click={() => openAuth("login", "Log in to open the admin panel.")}>Log in</button>
    </section>
  {:else if !unlocked}
    <section class="card">
      <form on:submit={unlock}>
        <label for="ad-pw">Admin password</label>
        <input id="ad-pw" type="password" bind:value={pw} autocomplete="off" required />
        <button class="btn primary block" type="submit" disabled={busy}>{busy ? "Checking..." : "Unlock"}</button>
      </form>
      {#if error}<div class="error" role="alert">⚠️ {error}</div>{/if}
    </section>
  {:else}
    <div class="row between">
      <span class="muted small">{pending.length} pending • {done.length} processed</span>
      <button class="btn sm mfull" on:click={lock}>Lock</button>
    </div>
    {#if error}<div class="error" role="alert">⚠️ {error}</div>{/if}

    <h3 class="sub">Pending</h3>
    {#each pending as r (r.id)}
      <article class="card">
        <div class="row between" style="margin-bottom:4px">
          <b class="num" style="font-size:1.4rem">{rupee(r.amount)}</b>
          <span class="badge med"><i class="dot"></i>Pending ⏳</span>
        </div>
        <div class="muted small" style="overflow-wrap:anywhere">{r.email} • {fmtDate(r.created_at)}</div>
        <div class="row" style="margin:10px 0 6px">
          <b style="overflow-wrap:anywhere">{r.upi_id}</b>
          <button class="btn sm" on:click={() => copy(r.id, r.upi_id)}>{copied === r.id ? "Copied ✓" : "Copy UPI"}</button>
        </div>
        <a class="btn block" href={upiLink(r)}>Pay {rupee(r.amount)} via UPI app</a>
        <div class="row" style="margin:10px 0 0">
          <button class="btn primary mfull" on:click={() => act(r.id, "approve")} disabled={busy}>Approve ✅</button>
          <button class="btn mfull" on:click={() => act(r.id, "reject")} disabled={busy}>Reject ❌</button>
        </div>
        {#if r.evidence && r.evidence.length}
          <details class="faq" style="margin-top:12px">
            <summary>Referral sales behind this balance ({r.evidence.length})</summary>
            <p class="small">Check these transaction IDs in your own UPI app before approving.</p>
            {#each r.evidence as ev}
              <div class="payrow">
                <span class="small" style="overflow-wrap:anywhere">{ev.txn_id || "no txn id"} • {fmtDate(ev.created_at)}</span>
                <b class="num small">{rupee(ev.sale_amount)} → {rupee(ev.commission_amount)}</b>
              </div>
            {/each}
          </details>
        {/if}
      </article>
    {/each}
    {#if pending.length === 0}<section class="card"><p class="muted" style="margin:0">No pending payouts.</p></section>{/if}

    <h3 class="sub">Processed</h3>
    {#each done as r (r.id)}
      <div class="payrow">
        <div style="min-width:0">
          <b class="num">{rupee(r.amount)}</b>
          <div class="muted small" style="overflow-wrap:anywhere">{r.email} • {r.upi_id}</div>
        </div>
        {#if r.status === "approved"}
          <span class="badge low"><i class="dot"></i>Approved ✅ {fmtDate(r.approved_at)}</span>
        {:else}
          <span class="badge high"><i class="dot"></i>Rejected ❌</span>
        {/if}
      </div>
    {/each}
  {/if}
</div>
`);

F("src/lib/guides.mjs", String.raw`// 100 structured guides, round-robin across the four modes so a smaller LIVE count stays balanced.
// Set LIVE_GUIDE_COUNT lower if you prefer to publish gradually.
export const LIVE_GUIDE_COUNT = 100;

export const MODE_LABELS = { freelance: "Freelance & clients", creator: "Creators & brand deals", employment: "Job offers & bonds", agency: "Agency & sub-contracts" };
export const MODE_ORDER = ["freelance", "creator", "employment", "agency"];

const ALL = [
  {"slug":"/guide/msmed-45-day-payment-demand-notice-format","title":"MSMED Act 45-Day Payment Rule: Demand Notice Format","description":"Client paying late? See the MSMED Act 45-day rule for Udyam-registered freelancers, interest under Section 16, and a demand notice you can send.","h1":"How do I send a demand notice under the MSMED Act 45-day rule?","mode":"freelance","jur":"india","trap":"Payment will be made within 90 days of invoice approval at the Client's convenience.","why":"For an Udyam-registered micro or small supplier, Section 15 of the MSMED Act 2006 generally requires payment within the agreed period, which cannot exceed 45 days from acceptance. Section 16 provides compound interest at three times the bank rate for delay, and Section 18 lets you approach the facilitation council. Check that you qualify and ask a CA or lawyer before sending a formal notice. This is general information, not legal advice.","fix":"Payment is due within 15 days of invoice and in any case not later than 45 days from acceptance of the services. Delayed amounts carry interest as provided under the MSMED Act 2006.","email":"Subject: Payment due under MSMED Act 2006\nDear [Client],\nInvoice [NO] dated [DATE] for Rs [AMOUNT] is overdue. I am Udyam-registered ([UDYAM NO]). Please pay within 7 days, failing which I will claim interest under Section 16 and approach the facilitation council. Regards, [Your Name]","faqs":[{"q":"Does the MSMED Act apply to freelancers?","a":"It can apply if you are registered on Udyam as a micro or small enterprise supplying services. Confirm your registration and facts with a professional."},{"q":"What interest can I claim for delayed payment?","a":"Section 16 provides compound interest with monthly rests at three times the bank rate notified by RBI, subject to the Act's conditions."}]},
  {"slug":"/guide/employment-bond-validity-india","title":"Is a 2-Year Employment Bond Valid in India? Sec 27 & 74","description":"Check if your 2-year service bond is enforceable in India: Section 27 and Section 74 of the Indian Contract Act, reasonable damages, and a safer clause.","h1":"Is my 2-year employment bond valid in India?","mode":"employment","jur":"india","trap":"The Employee shall serve the Company for a minimum of 24 months. If the Employee leaves earlier, the Employee shall pay Rs 3,00,000 as liquidated damages.","why":"Section 27 of the Indian Contract Act 1872 voids agreements that restrain a lawful profession, but courts often treat a reasonable minimum-service bond differently from a post-job ban. Under Section 74 a court awards only reasonable compensation, not automatically the full amount named. A bond that is far above your real training cost or salary is easier to challenge. This is general information, not legal advice.","fix":"If the Employee resigns before completing 24 months, the Employee shall reimburse the documented, direct training cost of the Company, reduced pro rata for each completed month of service, capped at Rs [AMOUNT]. No other penalty applies.","email":"Hi [HR Name],\nThank you for the offer. Before I sign, could we replace the Rs 3,00,000 bond with a pro-rata reimbursement of documented training cost only, reducing each month I serve? Happy to discuss. Regards, [Your Name]","faqs":[{"q":"Are employment bonds legal in India?","a":"Bonds are not banned, but courts check whether the amount is reasonable and tied to real cost. A penal or one-sided bond can be reduced or struck down. Ask a lawyer about your exact bond."},{"q":"Can the company recover the full bond amount?","a":"Not automatically. Section 74 lets a court award reasonable compensation up to the stated amount, and the employer usually has to show some genuine loss."}]},
  {"slug":"/guide/perpetual-paid-ad-whitelisting-rights-meaning","title":"Perpetual Whitelisting Rights Meaning in Brand Deals","description":"Brand wants perpetual paid ad and whitelisting rights? See what it means for creators, why it is costly to give away free, and a limited-rights clause.","h1":"What does perpetual whitelisting rights mean in a brand deal?","mode":"creator","jur":"global","trap":"Brand receives a perpetual, worldwide, irrevocable licence to use the content, including paid advertising and whitelisting, at no additional fee.","why":"Whitelisting lets the brand run ads through your social handle. Perpetual and irrevocable means forever, even if you later disagree or the deal ends. Paid usage is usually priced separately from the organic post fee. Without a time limit and fee, your face can sell their product for years at no extra cost. This is general information, not legal advice.","fix":"Paid advertising and whitelisting are licensed for [30] days from first use, in [COUNTRY], on named channels, for a monthly usage fee of [AMOUNT]. Rights end automatically at expiry unless renewed in writing.","email":"Hi [Brand],\nThanks for the deal. Could paid ads and whitelisting be licensed for 30 days with a monthly usage fee, rather than perpetual? I am happy to extend if the campaign performs. Thanks, [Your Name]","faqs":[{"q":"What is whitelisting for influencers?","a":"It is when a brand runs paid ads from your handle or uses your content in ad campaigns. It should be separately priced and time-limited."},{"q":"Should I accept perpetual usage rights?","a":"Rarely for free. Limit duration, channels and region, and charge a usage fee."}]},
  {"slug":"/guide/pay-when-paid-vs-pay-if-paid-subcontractor-agreement","title":"Pay-When-Paid vs Pay-If-Paid in Subcontractor Agreements","description":"Agency pays you only after its client pays? Understand pay-when-paid versus pay-if-paid, why 120-day waits hurt and how to cap the delay with a fixed date.","h1":"What is the difference between pay-when-paid and pay-if-paid?","mode":"agency","jur":"global","trap":"Agency will pay Subcontractor within 15 days after Agency receives payment from the end client, which may take up to 120 days.","why":"Pay-when-paid delays your invoice until the client pays the agency. Pay-if-paid means you are never paid if the client never pays, which moves the agency's credit risk onto you. Insist on a fixed outside date, such as 45 days from invoice. If you are Udyam-registered in India, the MSMED Act payment rules may apply, so ask a CA. This is general information, not legal advice.","fix":"Subcontractor invoices are due within 30 days of invoice date whether or not Agency has been paid by its client. Agency bears its own client credit risk.","email":"Hi [Agency],\nCould we set a fixed payment date of 30 days from invoice, regardless of when your client pays? I am happy to discuss milestones if your cashflow needs it. Thanks, [Your Name]","faqs":[{"q":"Is pay-when-paid fair for subcontractors?","a":"It can be if there is a short outside date. Without one, you wait on a third party you do not control."},{"q":"What is a pay-if-paid clause?","a":"A clause making the agency's payment conditional on its client paying. It transfers non-payment risk to you."}]},
  {"slug":"/guide/reply-client-free-revisions-whatsapp","title":"Client Asking for Free Revisions on WhatsApp? Reply Script","description":"Client keeps sending 'small changes' on WhatsApp? Use a polite reply that cites your revision limit and offers a quote for extra work.","h1":"How do I reply when a client asks for free revisions on WhatsApp?","mode":"freelance","jur":"global","trap":"The Contractor will make unlimited revisions until the Client is fully satisfied at no extra cost.","why":"Unlimited revisions turn a fixed fee into unpaid work. Quick chat requests blur the line between a revision and new scope. A clear revision count in the contract, plus a polite template reply that quotes it, keeps the relationship friendly and the work paid. This is general information, not legal advice.","fix":"The fee includes two (2) rounds of consolidated revisions within the agreed scope. Further revisions or new requests are billed at [RATE] per hour after written approval of the estimate.","email":"Hi [Client],\nHappy to help! This falls outside the 2 revision rounds in our agreement, so I'll share a small quote (about [HOURS] hrs, Rs [AMOUNT]). If you approve, I'll start right away. Thanks!","faqs":[{"q":"How many revisions should a freelancer include?","a":"Two rounds of consolidated feedback is common. State it in the contract and define what counts as a revision."},{"q":"What if the client says it is a quick change?","a":"Reply politely, quote the revision clause and offer a short estimate. Small paid changes keep boundaries clear."}]},
  {"slug":"/guide/notice-period-buyout-legality-india","title":"90-Day Notice Period Buyout in India: What You Really Owe","description":"Offer letter demands 90 days notice or a salary buyout? See what the clause means, when it can be negotiated, and a polite email to HR to cut it down.","h1":"Do I have to pay a notice period buyout in India?","mode":"employment","jur":"india","trap":"The Employee must serve 90 days notice. If the Company waives notice, or the Employee leaves early, the Employee shall pay 3 months gross salary as buyout.","why":"A buyout is a contract term, so it binds you if you signed it, but there is no automatic legal rule that you must pay three months of salary. Terms that are one-sided, such as the company can fire you instantly while you owe 90 days, are good points to negotiate before signing. Ask a CA how any payment would be taxed. This is general information, not legal advice.","fix":"Either party may end employment with 30 days written notice. If the Employee leaves early, the Employee shall forgo salary only for the unserved notice days, calculated on basic pay, with no additional penalty.","email":"Hi [HR Name],\nCould the notice period be 30 days for both sides, and any shortfall be adjusted against basic pay for the unserved days only? A mutual notice term keeps things fair. Thank you, [Your Name]","faqs":[{"q":"Can a company refuse to accept my resignation?","a":"Usually the contract sets the notice period. Many employers accept an early exit with a buyout. Check your offer letter and company policy."},{"q":"Is a notice period buyout taxable?","a":"Tax treatment depends on who pays whom and the facts. Ask a chartered accountant before you pay or receive one."}]},
  {"slug":"/guide/spark-ads-partnership-ads-usage-fee-clause","title":"Spark Ads and Partnership Ads Usage Fee: Clause for Creators","description":"Brand will boost your post with Spark Ads or Meta partnership ads? Add a usage fee, a time limit and approval rights. Copy-paste clause and email.","h1":"Can a brand run Spark Ads or partnership ads on my content?","mode":"creator","jur":"global","trap":"Brand may promote the Creator's posts through paid social features, including Spark Ads and partnership ads, without further payment.","why":"Boosting your post puts your content in front of audiences far beyond your own followers, and the brand benefits from your credibility. Usage is normally charged on top of the creation fee, with a limit on duration, spend and targeting. Without limits you may find yourself in ads you never approved. This is general information, not legal advice.","fix":"Paid amplification, including Spark Ads and partnership ads, is permitted for [30] days at a usage fee of Rs [AMOUNT] per month. Targeting and creative changes require the Creator's written approval.","email":"Hi [Brand],\nCould we add a monthly usage fee and a 30-day window for Spark Ads and partnership ads, with my approval on targeting and edits? Thank you, [Your Name]","faqs":[{"q":"Do I get paid extra for Spark Ads?","a":"You can ask for a usage fee, since boosting uses your content and identity in paid media."},{"q":"Can I limit where my content is advertised?","a":"Yes. Specify duration, channels, regions and approval for changes."}]},
  {"slug":"/guide/white-label-portfolio-display-rights-carve-out","title":"White-Label Portfolio Display Rights: Carve-Out That Works","description":"Agency forbids you from showing white-label work? Ask for a delayed, anonymised portfolio right without naming the end client. Sample clause.","h1":"Can I show white-label work in my portfolio?","mode":"agency","jur":"global","trap":"Subcontractor may not list this work in a portfolio, reference the clients or disclose the Agency relationship.","why":"A total ban means your best work is invisible to future clients. Ask for anonymised case studies after a delay, with no client names and no confidential data. This is general information, not legal advice.","fix":"After [6] months from delivery, Subcontractor may display anonymised screenshots and descriptions of the work without naming the Agency or its clients.","email":"Hi [Agency],\nCould I show anonymised case studies of the work after 6 months, without naming you or the end client? Thanks, [Your Name]","faqs":[{"q":"What is white-label work?","a":"Work you deliver under another company's brand, so it is shown as theirs."},{"q":"How can I still show my skills?","a":"Use anonymised case studies, process write-ups or generic samples."}]},
  {"slug":"/guide/net-60-net-90-payment-counter-clause","title":"Net-60 and Net-90 Payment Terms: Counter-Clause for Freelancers","description":"Client wants Net-60 or Net-90? See the cashflow cost, a fair counter-clause with Net-14 or Net-30, deposits and late fees, and an email to send.","h1":"How do I counter a Net-60 or Net-90 payment clause?","mode":"freelance","jur":"global","trap":"Invoices will be paid within 90 days of the invoice date, subject to Client approval.","why":"Net-90 means you finance your client for three months. A fair counter is Net-14 or Net-30, a deposit up front and a late fee. If the client's accounting needs longer terms, split the fee into milestones so you are never waiting on one big invoice. This is general information, not legal advice.","fix":"A 30% deposit is due before work begins. Invoices are due within 14 days of the invoice date. Overdue amounts accrue 1.5% per month, and work may pause while an invoice is overdue.","email":"Hi [Client],\nCould we change the payment terms to a 30% deposit up front and Net-14 on invoices? It lets me reserve time for your project. Happy to discuss milestones if that suits your process. Thanks, [Your Name]","faqs":[{"q":"Is Net-90 normal for freelancers?","a":"Some large companies use it, but it is hard on freelancers. Ask for shorter terms, deposits or milestone billing."},{"q":"What if the client's policy cannot change?","a":"Ask for a higher deposit, split milestones or a late fee to offset the delay."}]},
  {"slug":"/guide/employer-holding-original-certificates-india","title":"Employer Keeping Original Certificates? Your Rights in India","description":"Company asking for your original degree and mark sheets till the bond ends? See why this is risky, what to say, and a safer clause with photocopies.","h1":"Can my employer keep my original certificates in India?","mode":"employment","jur":"india","trap":"The Company will retain the Employee's original educational certificates until completion of the 3-year service period.","why":"Keeping originals gives the employer leverage over you, and many people see it as coercive because you cannot apply elsewhere or study further. No law gives an employer a general right to hold your originals as security, though it is common in some offer letters. Where possible agree to verification only. This is general information; take legal advice if your documents are being withheld.","fix":"The Company may verify the Employee's original certificates at joining and shall return them the same day. The Company may keep self-attested photocopies for its records.","email":"Hi [HR Name],\nFor my original certificates, could the team verify them on joining and return them the same day, keeping attested copies? I need the originals for other formalities. Thank you, [Your Name]","faqs":[{"q":"What if my employer is not returning my certificates?","a":"Send a written request by email and courier, keep proof, and set a reasonable deadline. If ignored, consider a lawyer's notice or a complaint to the labour department."},{"q":"Is it legal for a company to hold original documents?","a":"It is widely practised but often challenged. There is no general right to hold them as security, so ask for photocopy verification instead."}]},
  {"slug":"/guide/category-exclusivity-clause-influencers","title":"Category Exclusivity for Influencers: How Wide Is Too Wide?","description":"Brand deal bans you from every beauty, fashion and wellness brand for a year? Narrow category exclusivity, shorten it and ask for payment. Sample clause.","h1":"How long should influencer category exclusivity be?","mode":"creator","jur":"india","trap":"For 12 months after the last post, Creator shall not collaborate with any brand in the beauty, skincare, wellness or fashion categories.","why":"Broad exclusivity blocks your income from many other brands. It should name the specific product category, last weeks rather than a year, and be paid for. In India, Section 27 of the Indian Contract Act can affect restraints that last after the contract ends, so ask a lawyer how it applies. This is general information, not legal advice.","fix":"For [30] days after the last post, Creator shall not publish paid content for a direct competitor of the Brand in [SPECIFIC PRODUCT CATEGORY]. Exclusivity is compensated by an additional fee of Rs [AMOUNT].","email":"Hi [Brand],\nCould exclusivity be limited to the exact product category, for 30 days after the last post, with an exclusivity fee? A year-long ban across several categories is broader than I can accept. Thanks, [Your Name]","faqs":[{"q":"Should exclusivity be paid?","a":"Yes. Exclusivity reduces your income, so negotiate a fee that reflects it."},{"q":"Is a 12-month exclusivity normal?","a":"Long exclusivity is common in big deals, but it should be narrow and compensated."}]},
  {"slug":"/guide/client-non-solicitation-24-month-cap-agency","title":"Client Non-Solicitation Clause: 24-Month Cap for Agencies","description":"Agency bans you from its clients for 36 months? Ask for a 12 to 24 month cap, only clients you served, and exceptions for inbound requests.","h1":"How long can an agency ban me from working with its clients?","mode":"agency","jur":"global","trap":"For 36 months after termination, Subcontractor shall not work for or contact any Agency client, even if found independently.","why":"A non-solicit stops you approaching their clients but should not stop clients who come to you or whom you knew before. Limit the list, the time and the type of work. In India, Section 27 of the Indian Contract Act can affect restraints after the contract ends, so ask a lawyer. This is general information, not legal advice.","fix":"For 12 months after termination, Subcontractor shall not actively solicit clients it worked with under this agreement. Pre-existing clients and unsolicited inbound requests are excluded.","email":"Hi [Agency],\nCould the non-solicit be 12 months, limited to clients I served under this agreement, and exclude my existing clients and inbound requests? Thanks, [Your Name]","faqs":[{"q":"Is a 36-month non-solicit normal?","a":"It is long. Many contracts use 6 to 24 months with a narrow client list."},{"q":"Can I work with a client who contacts me?","a":"Add an exception for unsolicited inbound requests."}]},
  {"slug":"/guide/uncapped-indemnity-clause-meaning-and-cap","title":"Uncapped Indemnity Clause Meaning and How to Cap It","description":"Contract makes you indemnify the client for 'all claims'? Learn what uncapped indemnity means for freelancers and use a fair cap tied to fees paid.","h1":"What does an uncapped indemnity clause mean?","mode":"freelance","jur":"global","trap":"Contractor shall indemnify Client against all claims, damages and legal fees of any kind, with no cap.","why":"Indemnity means you cover the client's losses. With no cap and no limits on type of claim, one dispute could cost far more than the project paid. Standard protections are a cap equal to fees paid, a carve-out for indirect losses, and indemnity only for claims arising from your own breach or negligence. This is general information, not legal advice.","fix":"Contractor's total liability, including any indemnity, shall not exceed the fees paid in the 12 months before the claim. Neither party is liable for indirect or consequential losses.","email":"Hi [Client],\nCould we cap my liability, including indemnity, at the fees paid under this agreement and exclude indirect losses? This is standard for freelance work. Thanks, [Your Name]","faqs":[{"q":"What is an indemnity clause?","a":"It is a promise to cover another party's losses or legal costs in certain situations. Scope and cap matter a lot."},{"q":"What is a reasonable liability cap for freelancers?","a":"Fees paid under the contract is a common cap. Ask for it to include indemnities."}]},
  {"slug":"/guide/absconding-notice-reply-india","title":"How to Reply to an Absconding Notice From Your Employer","description":"Got an 'absconding' or abandonment notice after you resigned? Steps and a calm reply template that shows your resignation proof and notice dates.","h1":"How do I reply to an absconding notice from my employer?","mode":"employment","jur":"india","trap":"You have been absent without leave. If you do not report within 3 days, the Company will treat you as having absconded and initiate legal recovery.","why":"An absconding notice is often a pressure tactic. What matters is your paper trail: your resignation email, any acceptance, leave records and handover proof. A clear written reply, sent by email and courier, protects your relieving letter and final settlement. Do not ignore it, and do not argue by phone. This is general information, not legal advice.","fix":"The Company shall confirm in writing the Employee's last working day and issue the relieving letter within 7 days of completion of notice and handover.","email":"Subject: Reply to notice dated [DATE]\nDear [HR Name],\nI submitted my resignation on [DATE] (copy attached), served notice until [DATE] and completed handover to [NAME]. Please confirm my relieving date and issue the relieving letter and final settlement. Regards, [Your Name]","faqs":[{"q":"What counts as absconding?","a":"It usually means leaving without resigning or serving notice. If you resigned in writing and served notice, you are in a very different position."},{"q":"Should I reply to a legal notice from my employer?","a":"Yes. Reply in writing with your facts and proof, keep copies, and speak to a lawyer if the notice demands money or threatens action."}]},
  {"slug":"/guide/brand-deal-reshoot-unlimited-edits-cap","title":"Brand Deal Reshoots and Unlimited Edits: Cap Them Fairly","description":"Brand can demand unlimited edits and reshoots at your cost? Add a 2-round cap, reshoot fees and a clear approval deadline. Clause and reply.","h1":"How do I limit reshoots and edits in a brand deal?","mode":"creator","jur":"global","trap":"Creator will reshoot at own cost if the Brand is not satisfied, and the Brand may request unlimited edits until fully satisfied.","why":"Unlimited edits and free reshoots can turn one paid post into a week of unpaid production. Cap revision rounds, define who bears reshoot costs when changes come from the brand's brief and set a deadline for feedback so approval cannot drag on. This is general information, not legal advice.","fix":"The fee includes two (2) rounds of consolidated edits per deliverable, requested within 3 business days. Reshoots caused by a brief change are billed at [RATE]. If no feedback arrives in 5 business days, the content is deemed approved.","email":"Hi [Brand],\nCould we cap edits at two rounds with feedback within 3 days, and quote any reshoot caused by a brief change? That helps me deliver on schedule. Thanks, [Your Name]","faqs":[{"q":"How many edits should be included?","a":"Two consolidated rounds is common. Extra rounds should be paid."},{"q":"Who pays for a reshoot?","a":"If the brand changes the brief, the brand should. State it in the contract."}]},
  {"slug":"/guide/247-sla-penalty-cap-dev-agency-subcontractor","title":"24/7 SLA Penalty Cap for Dev Agencies and Subcontractors","description":"Contract demands 2-hour response 24/7 with fee penalties? Cap penalties, define business hours and exclude force majeure. Copy-paste clause.","h1":"How do I cap SLA penalties in an agency contract?","mode":"agency","jur":"global","trap":"Subcontractor must respond to all requests within 2 hours, 24/7. Each missed SLA incurs a penalty of 10 percent of the monthly fee.","why":"Round-the-clock response with percentage penalties can cost more than you earn. Define business hours, severity levels, realistic response times and a total monthly cap on credits. Make credits the only remedy for missed SLAs. This is general information, not legal advice.","fix":"Response times apply during business hours [HOURS]. Critical issues get a 4-hour response. SLA credits are capped at 10% of the monthly fee and are the sole remedy for missed targets.","email":"Hi [Agency],\nCould the SLA cover business hours with severity levels, and cap total monthly credits at 10% as the sole remedy? A 24/7 two-hour target is not workable at this fee. Thanks, [Your Name]","faqs":[{"q":"What is an SLA credit?","a":"A discount given when a service level is missed, instead of a fine."},{"q":"Should SLAs be 24/7?","a":"Only with a matching fee and on-call arrangements."}]},
  {"slug":"/guide/ip-transfer-on-full-payment-clause","title":"IP Transfer Only After Full Payment: Clause for Freelancers","description":"Client claims ownership from day one? Use an IP-on-payment clause so rights pass only when you are paid, with a review licence meanwhile.","h1":"How do I make IP transfer only after full payment?","mode":"freelance","jur":"global","trap":"All work, drafts and materials belong to the Client from the moment of creation, whether or not payment has been made.","why":"If ownership transfers before payment, a client can use your work and still not pay. IP-on-payment gives you leverage: rights pass when the final invoice is paid, with a limited licence to review the work. Keep tools and pre-existing code outside the transfer. This is general information, not legal advice.","fix":"Ownership of deliverables transfers to the Client only on receipt of full payment. Until then the Client has a limited licence to review the work. Contractor retains pre-existing tools and know-how.","email":"Hi [Client],\nCould we update the IP clause so ownership passes to you once the final invoice is paid? You will have a review licence meanwhile. It is a standard protection. Thanks, [Your Name]","faqs":[{"q":"Can I withhold files until I am paid?","a":"If your contract says IP transfers on payment, you can keep final files until the invoice is paid. Put it in writing."},{"q":"Does the client need a licence before payment?","a":"A limited review licence is common so the client can evaluate the work."}]},
  {"slug":"/guide/training-cost-recovery-clause-india","title":"Training Cost Recovery Clause: Can Employers Charge You?","description":"Offer letter says you must repay 'training costs' if you quit? Learn how to ask for proof, a pro-rata reduction and a fair cap before you sign.","h1":"Can my employer recover training costs if I resign?","mode":"employment","jur":"india","trap":"If the Employee resigns within 24 months, the Employee shall repay all training and onboarding costs as determined by the Company.","why":"'As determined by the Company' lets the employer name any number later. Reasonable recovery of real, documented costs is more defensible than a lump sum. A fair clause lists what counts as cost and shrinks each month you stay. Under Section 74 of the Indian Contract Act courts look for reasonable compensation. This is general information, not legal advice.","fix":"If the Employee resigns within 12 months, the Employee shall repay only the actual external training fees paid by the Company, supported by invoices, reduced by 1/12 for each completed month.","email":"Hi [HR Name],\nCould the training cost clause list the exact programme fees and reduce proportionally with each month served? I would like to see the invoice basis before signing. Thanks, [Your Name]","faqs":[{"q":"Can a company ask me to repay salary paid during training?","a":"Only if the contract clearly says so, and even then the amount should be reasonable. Ask for the clause to be limited to documented external fees."},{"q":"How can I reduce my training bond?","a":"Ask for a shorter period, a pro-rata reduction, a cap, and proof of actual costs before signing."}]},
  {"slug":"/guide/influencer-kill-fee-cancelled-shoot-clause","title":"Influencer Kill Fee for a Cancelled Shoot: Clause and Email","description":"Brand cancels the shoot at the last minute and pays nothing? Add a kill fee tied to notice period and work done. Copy-paste clause.","h1":"How do I get paid if a brand cancels my shoot?","mode":"creator","jur":"global","trap":"The Brand may cancel at any time without payment for work already done. Creator must refund any advance if the Brand cancels.","why":"A last-minute cancellation wastes your prep time, props and the dates you blocked. A kill fee pays for work done plus a share of the fee depending on how late the cancellation is. Keep the advance non-refundable once prep begins. This is general information, not legal advice.","fix":"If the Brand cancels or postpones a scheduled shoot with less than 7 days notice, the Brand pays 50% of the total fee. For earlier cancellation it pays for work done. Advances are non-refundable.","email":"Hi [Brand],\nCould we add a kill fee: 50% of the fee if a shoot is cancelled with under 7 days notice, plus payment for work done? It covers the dates I block. Thanks, [Your Name]","faqs":[{"q":"What is a kill fee for creators?","a":"A payment when a brand cancels, covering work done and lost bookings."},{"q":"Is the advance refundable?","a":"Usually not once you have started prep. State it clearly."}]},
  {"slug":"/guide/third-party-api-aws-outage-liability-waiver-clause","title":"Third-Party API and AWS Outage Liability Waiver for Agencies","description":"Agency holds you liable when AWS, an API or a vendor goes down? Add an exclusion for third-party outages and a duty to notify. Sample clause.","h1":"Am I liable if AWS or a third-party API goes down?","mode":"agency","jur":"global","trap":"Subcontractor is liable for any downtime or data loss, including failures of third-party services and hosting providers.","why":"You cannot control a cloud provider's outage. A fair clause excludes third-party failures you could not reasonably prevent, while you remain responsible for sensible backups and prompt notice. This is general information, not legal advice.","fix":"Subcontractor is not liable for outages or failures of third-party services outside its control, provided it follows agreed backup and monitoring practices and notifies Agency promptly.","email":"Hi [Agency],\nCould we exclude outages of third-party services like AWS and external APIs from my liability, as long as I follow agreed backups and notify you quickly? Thanks, [Your Name]","faqs":[{"q":"Who is responsible for a vendor outage?","a":"Usually the contract decides. Exclude failures outside your control."},{"q":"What should I promise instead?","a":"Backups, monitoring and prompt notice."}]},
  {"slug":"/guide/kill-fee-clause-cancelled-freelance-project","title":"Kill Fee Clause for Cancelled Freelance Projects: Sample","description":"Client cancels mid-project and pays nothing? Add a kill fee covering work done, a minimum percentage and a non-refundable deposit.","h1":"How do I add a kill fee to a freelance contract?","mode":"freelance","jur":"global","trap":"The Client may cancel at any time without payment for work in progress.","why":"Without a kill fee, a cancellation can mean weeks of unpaid work and a blocked calendar. A kill fee pays for work completed plus a percentage of the remaining fee, and the deposit stays non-refundable. Choose a percentage that reflects lost bookings. This is general information, not legal advice.","fix":"If the Client cancels, the Client shall pay for all work completed, plus a kill fee of [25]% of the remaining unpaid fee. Any deposit paid is non-refundable.","email":"Hi [Client],\nCould we add a kill fee so that if the project is cancelled, completed work plus 25% of the remaining fee is payable? It protects the time I reserve for you. Thanks, [Your Name]","faqs":[{"q":"What is a kill fee?","a":"A fee payable when a client cancels a project, to compensate for work done and lost opportunities."},{"q":"How much should a kill fee be?","a":"Often 20 to 50 percent of the remaining fee, depending on notice and effort."}]},
  {"slug":"/guide/moonlighting-side-project-ip-india","title":"Moonlighting & Side-Project IP Ownership in Indian Jobs","description":"Does your employer own your weekend side project? See the IP clauses that claim everything you create, and a safe carve-out clause for employees in India.","h1":"Does my employer own my side project in India?","mode":"employment","jur":"india","trap":"All inventions, code and ideas created by the Employee during employment, including on personal time and personal devices, belong exclusively to the Company.","why":"This wording claims work that has nothing to do with your job. Fair IP clauses cover work done as part of your duties or using company resources. Pre-existing projects and unrelated side projects should be listed and excluded. Many employers also restrict outside work, so check your contract before moonlighting. This is general information, not legal advice.","fix":"The Employee retains all rights in (a) work listed in Schedule A and (b) personal projects created on personal time and equipment, without Company confidential information, and not related to the Company's business.","email":"Hi [HR Name],\nCould the IP clause exclude my personal projects built on my own time and devices, and the projects listed in an attached Schedule A? I want the Company to own my work for them, not unrelated work. Thank you, [Your Name]","faqs":[{"q":"Is moonlighting illegal in India?","a":"There is no general ban, but your contract may prohibit outside work or require permission. Breaching it can lead to termination."},{"q":"Can I list my existing projects before joining?","a":"Yes. Attach a dated list of your prior projects and ask the employer to confirm they are excluded from the IP assignment."}]},
  {"slug":"/guide/morality-clause-brand-deal-termination-creators","title":"Morality Clause in Brand Deals: One-Sided Termination Risk","description":"Brand can end the deal for anything it dislikes? See how vague morality clauses work and ask for objective triggers, notice and pay for work done.","h1":"What is a morality clause in a brand deal?","mode":"creator","jur":"global","trap":"The Brand may terminate immediately and claim damages if Creator posts anything that could harm the Brand's reputation, as judged by the Brand.","why":"Judged by the Brand means any criticism or off-topic opinion could be a breach. Ask for a narrow, objective trigger such as unlawful conduct or public statements that directly disparage the brand. Include notice, a chance to fix and payment for work delivered. This is general information, not legal advice.","fix":"Termination for conduct applies only to unlawful acts or public statements directly disparaging the Brand. The Brand must give 7 days to remedy and pay for all content delivered.","email":"Hi [Brand],\nCould the conduct clause cover only unlawful acts or direct disparagement of the Brand, with 7 days to fix and payment for delivered work? Thanks, [Your Name]","faqs":[{"q":"Can a brand terminate for anything it dislikes?","a":"Only if the contract says so. Push for objective triggers and notice."},{"q":"Do I keep payment if the deal ends?","a":"Ask for payment for delivered content and a pro-rata fee."}]},
  {"slug":"/guide/designated-approver-signoff-clause-agency","title":"Designated Approver Sign-Off Clause: One Voice for Approvals","description":"Many people comment and approvals never end? Add a single designated approver, written sign-off and deemed approval. Copy-paste clause.","h1":"How do I stop endless approvals in an agency project?","mode":"agency","jur":"global","trap":"Deliverables are accepted only when all stakeholders on the Agency and client side approve them.","why":"'All stakeholders' means conflicting feedback and open-ended delays. Name one approver whose written sign-off counts, set a feedback window and add deemed approval. This is general information, not legal advice.","fix":"Agency designates [NAME] as sole approver. Written sign-off from the approver is final. Feedback is due within 3 business days, after which deliverables are deemed approved.","email":"Hi [Agency],\nCould we name a single approver for each milestone and set 3 business days for feedback, with deemed approval after that? Thanks, [Your Name]","faqs":[{"q":"Why does a single approver help?","a":"It avoids conflicting feedback and keeps timelines moving."},{"q":"What if the approver is unavailable?","a":"Name a backup approver in the contract."}]},
  {"slug":"/guide/milestone-deemed-acceptance-clause","title":"Milestone Deemed Acceptance Clause: 5-Day Auto-Approval","description":"Client goes silent after delivery and payment stalls? Add a deemed-acceptance clause so work is approved after 5 business days. Copy-paste wording.","h1":"What is a deemed acceptance clause for milestones?","mode":"freelance","jur":"global","trap":"Payment is due only after the Client confirms in writing that it is fully satisfied with the work.","why":"Approval 'at the client's satisfaction' lets a client delay payment indefinitely. A deemed-acceptance clause says the milestone is approved if there is no written, specific feedback within a set time, which starts the payment clock. This is general information, not legal advice.","fix":"The Client shall review each milestone within 5 business days. If the Client does not give written, specific feedback within that time, the milestone is deemed accepted and the invoice is due.","email":"Hi [Client],\nCould we add that each milestone is approved if no written feedback arrives within 5 business days? It keeps both of us on schedule. Thanks, [Your Name]","faqs":[{"q":"How long should the review period be?","a":"Three to seven business days is common, depending on project size."},{"q":"What if the client gives vague feedback later?","a":"Specify that feedback must be written and specific to count as a rejection."}]},
  {"slug":"/guide/probation-termination-without-notice-india","title":"Probation Termination Without Notice: What the Clause Means","description":"Offer letter lets the company end your probation with no notice while you owe 90 days? Understand the imbalance and ask for a mutual notice term.","h1":"Can I be terminated during probation without notice?","mode":"employment","jur":"india","trap":"During the 6-month probation the Company may terminate without notice, while the Employee must give 90 days notice.","why":"Many contracts allow shorter notice during probation, but the clause should be mutual. A one-way term lets the employer leave you jobless overnight while locking you in. Ask for equal notice both ways, or a short fixed period such as 15 days. Your state shops and establishments law or other rules may also apply. This is general information, not legal advice.","fix":"During probation either party may end employment with 15 days written notice or pay in lieu of notice for the unserved days.","email":"Hi [HR Name],\nCould the probation notice be 15 days for both sides instead of nil for the Company and 90 days for me? A mutual term feels fair. Thanks, [Your Name]","faqs":[{"q":"Is notice required during probation?","a":"It depends on your contract and applicable law. Many contracts shorten it, so read the exact wording."},{"q":"Can I negotiate probation terms before signing?","a":"Yes. Ask for equal notice, a clear review date and written confirmation criteria."}]},
  {"slug":"/guide/asci-disclosure-liability-indemnity-influencers","title":"ASCI Disclosure and Indemnity Clauses: Who Is Liable?","description":"Brand deal makes you responsible for every ad claim? See ASCI disclosure duties, why product claims should be the brand's risk and a fair indemnity split.","h1":"Who is liable for ad claims in an influencer contract?","mode":"creator","jur":"india","trap":"Creator shall indemnify the Brand against all claims, penalties and legal fees arising from the content, including product claims and advertising regulation breaches.","why":"In India, ASCI influencer guidelines and the CCPA's endorsement guidelines expect clear disclosure such as #ad or #sponsored, and influencers should not make unverified claims. A fair split is: you handle disclosure and your own statements, the brand is responsible for product claims and approvals. This is general information, not legal advice.","fix":"Creator will use clear paid-partnership disclosures. Brand is responsible for product claims, supplies approved claims and indemnifies Creator for them. Creator's liability is capped at fees received.","email":"Hi [Brand],\nCould we split responsibility: I will handle disclosures and my own statements, and the Brand will supply and stand behind product claims, with my liability capped at fees paid? Thanks, [Your Name]","faqs":[{"q":"Do influencers in India have to disclose paid posts?","a":"Yes. ASCI guidelines expect clear disclosures like #ad or #sponsored, in a visible place."},{"q":"Who is responsible for product claims?","a":"Usually the brand supplies and verifies them. Put it in writing."}]},
  {"slug":"/guide/scope-freeze-change-order-workflow-agency","title":"Scope Freeze and Change Order Workflow for Agency Projects","description":"Requirements keep changing after kickoff? Add a scope freeze date and a change-order process with estimate, approval and revised timeline.","h1":"How do I handle changing requirements in an agency project?","mode":"agency","jur":"global","trap":"Subcontractor will accommodate all requirement changes during the project at no additional charge.","why":"Free changes mean the budget has no end. A scope freeze date, a written change order with estimate and a revised timeline keep both sides honest. This is general information, not legal advice.","fix":"Scope is frozen on [DATE]. After that, changes need a written change order with cost and timeline, approved by the designated approver before work begins.","email":"Hi [Agency],\nCould we freeze scope on [DATE] and use written change orders for later changes, with cost and timeline? Thanks, [Your Name]","faqs":[{"q":"What is a scope freeze?","a":"A date after which requirements are fixed unless a change order is agreed."},{"q":"What goes in a change order?","a":"The change, cost, effect on timeline and approval signature."}]},
  {"slug":"/guide/international-client-governing-law-remote-arbitration","title":"International Client Governing Law: Arbitration for Freelancers","description":"Foreign client wants disputes in its home courts? Use a remote arbitration clause with online hearings, a neutral law and shared costs.","h1":"What governing law should I accept with an international client?","mode":"freelance","jur":"global","trap":"This Agreement is governed by the laws of Delaware and all disputes must be brought in Delaware state courts.","why":"Fighting a payment dispute in a foreign court is expensive and slow. Practical options include a neutral law, online arbitration, or your own jurisdiction for small claims. Even a good clause cannot guarantee collection, so deposits and milestone billing matter more. This is general information, not legal advice.","fix":"Disputes shall be resolved by online arbitration under [INSTITUTION] rules, in English, with hearings by video and costs shared equally. Each party may seek urgent relief in its local courts.","email":"Hi [Client],\nCould we use online arbitration for disputes, with video hearings and shared costs? Foreign courts would be impractical for a project of this size. Thanks, [Your Name]","faqs":[{"q":"Can I sue a foreign client from India?","a":"It is possible but costly. Contract terms, deposits and platforms reduce the risk."},{"q":"What is online arbitration?","a":"A dispute process handled by an arbitrator, often with video hearings and lower costs than court."}]},
  {"slug":"/guide/variable-pay-withholding-clause-india","title":"Variable Pay Withholding Clause: Is It Fair or a Trap?","description":"Offer letter lets management withhold variable pay at 'sole discretion'? See how to ask for clear targets, payout dates and no forfeiture after exit.","h1":"Can my company withhold my variable pay?","mode":"employment","jur":"india","trap":"Up to 20 percent of CTC is variable and may be withheld, reduced or cancelled at the sole discretion of management.","why":"If variable pay can be cancelled for any reason, it is a bonus, not part of your real salary. Insist on written targets, a payout date and a rule for what happens if you resign after the target period but before payout. Compare your CTC on a fixed-pay basis before accepting. This is general information, not legal advice.","fix":"Variable pay is payable on the targets set in Schedule B. Once the performance period ends, the earned amount shall be paid within 30 days, including if the Employee resigns after the period ends.","email":"Hi [HR Name],\nCould you share the written targets and payout timeline for the variable component, and confirm earned variable pay is paid even if I resign after the performance period? Thanks, [Your Name]","faqs":[{"q":"Is variable pay guaranteed?","a":"Only if the contract makes it so. If it says 'discretion', it is not guaranteed."},{"q":"Should I compare offers on fixed pay?","a":"Yes. Fixed pay is what you can count on, so compare the guaranteed part first."}]},
  {"slug":"/guide/talent-agency-commission-sunset-clause","title":"Talent Agency Commission Sunset Clause: End of Commission Rights","description":"Agency takes 20-30 percent of every deal forever, even after you leave? Ask for a sunset on commission and limits on deals it must have sourced.","h1":"How long can a talent agency take commission after I leave?","mode":"creator","jur":"global","trap":"Agency is entitled to 30% commission on all deals during the term and in perpetuity on any brand introduced or deals renewed.","why":"Perpetual commission on renewals can last for years after you leave. A sunset limits commission to deals signed during the term and for a short tail, and only for brands the agency genuinely introduced. Ask for payment details and audit rights. This is general information, not legal advice.","fix":"Agency earns [20]% only on deals it sourced and signed during the term. After termination, commission applies for 6 months on those deals only, and not on renewals the Creator negotiates directly.","email":"Hi [Agency],\nCould commission apply only to deals the agency sourced, with a 6-month tail after termination and no commission on renewals I negotiate myself? Thanks, [Your Name]","faqs":[{"q":"What is a sunset clause?","a":"A term that ends or limits rights, such as commission, after a set period."},{"q":"Should an agency get commission on every deal?","a":"Usually only on deals it sourced. Define it clearly."}]},
  {"slug":"/guide/subcontractor-ip-assignment-before-payment-agency","title":"IP Assignment Before Payment in Subcontractor Contracts","description":"Agency owns your work from creation whether or not it pays? Switch to IP on full payment, with a licence for delivery. Sample clause.","h1":"When should IP transfer to the agency?","mode":"agency","jur":"global","trap":"All work product, tools and pre-existing materials used on the project are owned by Agency from creation, whether or not paid.","why":"If IP moves before payment, the agency can keep your work even if it does not pay. Transfer on full payment keeps leverage. Keep pre-existing tools yours and license them for the project. This is general information, not legal advice.","fix":"Ownership of deliverables transfers on full payment of the relevant invoice. Subcontractor retains pre-existing tools and grants Agency a licence to use them within the deliverables.","email":"Hi [Agency],\nCould IP transfer on full payment of each invoice, with my pre-existing tools licensed for use in the deliverables? Thanks, [Your Name]","faqs":[{"q":"Can an agency use work I have not been paid for?","a":"Only if the contract allows it. Tie IP transfer to payment."},{"q":"What about my reusable code?","a":"Keep it excluded and grant a licence for the project."}]},
  {"slug":"/guide/unlimited-revisions-clause-cap-freelancer","title":"Unlimited Revisions Clause: How to Cap It Without a Fight","description":"Contract promises unlimited revisions? Replace it with a clear 2-round cap, a definition of a revision and an hourly rate for extra work.","h1":"How do I replace an unlimited revisions clause?","mode":"freelance","jur":"global","trap":"Contractor shall provide unlimited revisions until the Client is satisfied.","why":"'Until satisfied' has no end. Define what a revision is, how many rounds are included, how feedback is delivered and what extra rounds cost. Clients usually accept clear limits when you explain they speed up delivery. This is general information, not legal advice.","fix":"Two rounds of consolidated revisions are included. A revision means changes to delivered work within scope. New features or direction changes are billed at [RATE] per hour.","email":"Hi [Client],\nCould we change 'unlimited' to two consolidated revision rounds, with extra changes quoted separately? It keeps the timeline predictable. Thanks, [Your Name]","faqs":[{"q":"What counts as a revision?","a":"Small changes to delivered work within the agreed scope. A new direction or feature is new scope."},{"q":"How do I explain revision limits?","a":"Say clear limits keep the project fast and fair for both sides."}]},
  {"slug":"/guide/non-compete-after-resignation-india","title":"Non-Compete After Resignation in India: Is It Enforceable?","description":"Offer letter bans you from joining competitors for 12-24 months after you leave? See what Section 27 says, why courts are cautious, and a narrower clause.","h1":"Is a post-resignation non-compete enforceable in India?","mode":"employment","jur":"india","trap":"For 24 months after leaving, the Employee shall not join or work with any competitor or client of the Company anywhere in India.","why":"Section 27 of the Indian Contract Act 1872 voids agreements that restrain a lawful profession, and Indian courts have generally been reluctant to enforce non-competes that apply after employment ends. Restrictions during employment, and confidentiality duties, are treated differently. Do not assume a clause is void without a lawyer's view, and do not ignore it either.","fix":"During employment the Employee shall not work for a direct competitor. After employment the Employee shall remain bound by confidentiality obligations but is free to work anywhere.","email":"Hi [HR Name],\nCould the non-compete be limited to the period of employment, with confidentiality obligations continuing after I leave? A 24-month all-India ban is broad. Thank you, [Your Name]","faqs":[{"q":"Are non-compete clauses valid in India?","a":"After employment, they are often unenforceable under Section 27, but results depend on the facts. Confidentiality and non-solicit terms are treated differently."},{"q":"Can I be sued for joining a competitor?","a":"An employer can try. Get legal advice on the exact clause and your role before you join."}]},
  {"slug":"/guide/brand-deal-payment-90-days-after-posting","title":"Brand Deal Payment 90 Days After Posting: Negotiate Faster","description":"Brand pays 60-90 days after the post goes live, subject to 'performance approval'? Ask for 50 percent upfront, net-15 balance and no performance veto.","h1":"How do I negotiate faster payment on a brand deal?","mode":"creator","jur":"india","trap":"The fee of Rs 60,000 will be paid within 90 days after the final post goes live, subject to the Brand approving the performance of the content.","why":"Late payment ties your income to the brand's accounts team, and performance approval lets the brand cut the fee after you deliver. Ask for part payment in advance, the balance within 15 days of posting and no performance condition on a flat fee. If you are Udyam-registered, the MSMED Act's payment rules may apply, so ask a CA. This is general information, not legal advice.","fix":"50% of the fee is due on signing. The balance is due within 15 days after the final post goes live. Payment is not conditional on content performance.","email":"Hi [Brand],\nCould we do 50% on signing and the balance within 15 days of posting, with no performance condition on a flat fee? That helps me schedule the production. Thanks, [Your Name]","faqs":[{"q":"Is it normal to get an advance?","a":"Yes. Many creators take 30 to 50 percent before starting."},{"q":"Can the brand reduce my fee based on views?","a":"Only if the contract says so. For a flat fee, remove the performance condition."}]},
  {"slug":"/guide/agency-msa-liability-cap-subcontractor","title":"Agency MSA Liability Cap for Subcontractors: Flow-Down Risk","description":"Agency flows down its own uncapped client liability to you? Ask for a cap tied to fees paid to you, not to the end client contract.","h1":"Should my liability match the agency's client contract?","mode":"agency","jur":"global","trap":"Subcontractor accepts the same liability to Agency as Agency owes its client under the master agreement, without any limit.","why":"Flow-down clauses pass the agency's client risk to you, but you earn a fraction of the client fee. Cap your liability at the fees you receive and exclude indirect loss, even if the agency's cap is higher. This is general information, not legal advice.","fix":"Subcontractor's total liability is capped at the fees paid to Subcontractor under this agreement in the prior 12 months, regardless of liability limits in Agency's client agreement.","email":"Hi [Agency],\nCould my liability be capped at the fees paid to me rather than flowing down your client's limits? That matches what I earn on the project. Thanks, [Your Name]","faqs":[{"q":"What is a flow-down clause?","a":"A term passing obligations from a main contract to a subcontractor."},{"q":"Is a cap at fees paid reasonable?","a":"It is common. Insurance can cover higher risk."}]},
  {"slug":"/guide/late-payment-fee-interest-clause-freelancer","title":"Late Payment Fee and Interest Clause: Copy-Paste Wording","description":"Add a late fee to your freelance contract: monthly percentage, start date and the right to pause work. Clear wording plus a polite email.","h1":"How do I add a late payment fee to a freelance contract?","mode":"freelance","jur":"global","trap":"No late fee or interest shall apply to delayed payments.","why":"Without a late fee, delay costs the client nothing. A modest monthly fee and a right to pause work encourage on-time payment. Check any legal cap on interest in your jurisdiction. This is general information, not legal advice.","fix":"Invoices unpaid after the due date accrue a late fee of 1.5% per month, or the maximum permitted by law if lower. The Contractor may pause work while any invoice is overdue.","email":"Hi [Client],\nCould we add a late fee of 1.5% per month on overdue invoices and the right to pause work while one is overdue? It is a standard term. Thanks, [Your Name]","faqs":[{"q":"Is a late fee legal?","a":"Usually yes if agreed in the contract, but check local limits on interest."},{"q":"When does the late fee start?","a":"On the day after the due date stated in the invoice or contract."}]},
  {"slug":"/guide/relieving-letter-withheld-experience-letter-india","title":"Relieving Letter Withheld? What to Do and What to Ask For","description":"Employer holding your relieving or experience letter after you resigned? Practical steps, a written demand template and a clause to fix it in the offer.","h1":"What if my employer withholds my relieving letter?","mode":"employment","jur":"india","trap":"The Company reserves the right to withhold the relieving and experience letters until all dues and clearances are completed to its satisfaction.","why":"'To its satisfaction' lets the employer delay indefinitely. Your next job and background checks may depend on this letter. Ask for a deadline and a clear list of clearances. If the letter is withheld unfairly, a polite written demand, then a lawyer's notice, is the usual path. This is general information, not legal advice.","fix":"The Company shall issue the relieving and experience letters within 7 working days after the Employee completes notice, handover and return of Company property.","email":"Subject: Request for relieving letter\nDear [HR Name],\nI completed notice and handover on [DATE] and returned all assets. Please issue my relieving and experience letters by [DATE]. Regards, [Your Name]","faqs":[{"q":"Can a company refuse a relieving letter?","a":"Companies often link it to clearance, but a long or indefinite delay is unreasonable. Put your request in writing with a deadline."},{"q":"Do I need a relieving letter to join a new job?","a":"Many employers ask for it, so request it early and keep proof of resignation and acceptance."}]},
  {"slug":"/guide/performance-based-pay-guaranteed-views-clause","title":"Guaranteed Views and Performance Clauses: Protect Your Fee","description":"Brand asks for guaranteed views or conversions or it cuts your fee? Replace guarantees with reach estimates, a bonus structure and no clawbacks.","h1":"What if the brand wants guaranteed views or sales?","mode":"creator","jur":"global","trap":"Creator guarantees a minimum of 100,000 views and 500 conversions within 30 days. Any shortfall will be deducted from the fee.","why":"You cannot fully control platform algorithms or buyer behaviour. A guarantee turns your flat fee into a bet. Offer an estimated range, a bonus for hitting targets and a make-good post, not a deduction. This is general information, not legal advice.","fix":"Estimated reach is a non-binding projection. If the Brand wishes to reward performance, a bonus of Rs [AMOUNT] is payable for reaching [VIEWS] views. The base fee is not subject to deduction.","email":"Hi [Brand],\nI cannot guarantee algorithm-based views, but I can share an estimated range and add a performance bonus if we hit the target. Could the base fee stay fixed? Thanks, [Your Name]","faqs":[{"q":"Can creators guarantee views?","a":"Only with great care. Platforms control distribution, so offer estimates and bonuses instead."},{"q":"What is a make-good post?","a":"An extra post to compensate for underperformance, instead of reducing your fee."}]},
  {"slug":"/guide/subcontractor-insurance-requirement-clause","title":"Subcontractor Insurance Requirement Clause: Limits and Cost","description":"Agency demands large professional liability cover? Negotiate the amount, who pays and proof, or accept a liability cap instead. Sample clause.","h1":"Do I need insurance as a subcontractor?","mode":"agency","jur":"global","trap":"Subcontractor shall maintain professional indemnity and cyber insurance of at least USD 1,000,000 throughout the term and for 5 years after.","why":"High insurance minimums can cost more than the project pays. Ask for a figure proportional to the contract, a shorter tail and the option to reduce liability instead of buying cover. This is general information, not legal advice.","fix":"Subcontractor shall maintain professional liability insurance of [AMOUNT] during the term, or alternatively accept a liability cap equal to fees paid if cover is not commercially available.","email":"Hi [Agency],\nCould the insurance requirement be scaled to the contract value, or replaced by a liability cap at fees paid? Thanks, [Your Name]","faqs":[{"q":"Why do agencies ask for insurance?","a":"To make sure there are funds if a claim arises."},{"q":"Can I negotiate the amount?","a":"Yes. Link it to contract value and risk."}]},
  {"slug":"/guide/advance-deposit-clause-freelancer","title":"Advance Deposit Clause for Freelancers: How Much to Ask","description":"Start work only after a deposit. See typical 30-50 percent advances, non-refundable wording and a message to explain the policy to new clients.","h1":"How much advance should a freelancer ask for?","mode":"freelance","jur":"global","trap":"No advance will be paid. Full payment is made after final delivery and approval.","why":"Full payment after delivery makes you the bank. A deposit of 30 to 50 percent secures your time, shows client commitment and covers early costs. Make it non-refundable once work starts, and tie later payments to milestones. This is general information, not legal advice.","fix":"A non-refundable deposit of [30]% is due before work begins. The balance is due in milestones as set out in Schedule A.","email":"Hi [Client],\nMy process is a 30% deposit to book the start date, then milestone payments. I will send the invoice today so we can begin on [DATE]. Thanks, [Your Name]","faqs":[{"q":"Is a deposit normal for freelancers?","a":"Yes. Many freelancers require 30 to 50 percent before starting."},{"q":"Should the deposit be refundable?","a":"Usually not once work has started, but state how it applies if you cancel."}]},
  {"slug":"/guide/full-and-final-settlement-delay-india","title":"Full and Final Settlement Delay: How Long Can HR Take?","description":"Waiting for your F&F payment after resigning? Know what to write, the usual timeline in contracts and a clause that sets a fixed payment date.","h1":"How long can a company take for full and final settlement?","mode":"employment","jur":"india","trap":"Full and final settlement shall be processed within 60 to 90 days after the last working day, subject to clearances.","why":"A 60 to 90 day window without a date can leave your salary and leave encashment stuck. Check the contract and applicable labour rules for the timeline, and ask for a fixed date. If the delay is long, send a written reminder, then a legal notice. This is general information, not legal advice.","fix":"The Company shall pay all earned salary, leave encashment and reimbursements within 30 days of the last working day, with an itemised statement.","email":"Subject: Full and final settlement\nDear [HR Name],\nMy last working day was [DATE]. Please share the F&F statement and confirm the payment date. If anything is pending from me, please tell me today. Regards, [Your Name]","faqs":[{"q":"What is included in full and final settlement?","a":"Usually pending salary, leave encashment, bonus due, reimbursements, and deductions for notice shortfall or advances."},{"q":"What can I do if F&F is delayed?","a":"Write to HR and your manager, keep records, escalate, and consider a lawyer's notice or the labour authority."}]},
  {"slug":"/guide/content-approval-rounds-brand-deal-clause","title":"Content Approval Rounds in Brand Deals: Set a Clear Process","description":"Brand approves slowly and changes direction late? Add an approval workflow with one approver, a deadline and deemed approval. Sample clause.","h1":"How do I set up content approval in a brand deal?","mode":"creator","jur":"global","trap":"All content is subject to the Brand's approval at its sole discretion before and after publication.","why":"Without a process, approvals can come from several people with conflicting feedback. Name one approver, set a feedback deadline and say what happens if the brand stays silent. Post-publication takedown rights should be limited. This is general information, not legal advice.","fix":"Brand names one approver. Feedback is due within 3 business days of submission. If none is given, the content is deemed approved. Post-publication changes need the Creator's consent.","email":"Hi [Brand],\nCould we name one approver and set 3 business days for feedback, with deemed approval after that? It keeps the posting date on track. Thanks, [Your Name]","faqs":[{"q":"Who should approve my content?","a":"One named decision-maker avoids conflicting feedback."},{"q":"Can a brand ask me to edit after posting?","a":"Only if the contract allows it. Limit this to legal or factual errors."}]},
  {"slug":"/guide/agency-nda-customer-list-overreach-subcontractor","title":"NDA Customer List Overreach: Protect Your Own Contacts","description":"NDA says every contact you meet becomes agency confidential? Exclude your existing network and public information. Copy-paste carve-out.","h1":"Can an NDA claim my existing contacts?","mode":"agency","jur":"global","trap":"All client names, contacts and relationships encountered during the engagement are Agency's confidential information.","why":"This can sweep in people you already know. Limit confidentiality to non-public information the agency provides and exclude your pre-existing contacts. This is general information, not legal advice.","fix":"Confidential Information excludes information that is public, already known to Subcontractor, or independently obtained, including Subcontractor's pre-existing professional contacts.","email":"Hi [Agency],\nCould the NDA exclude public information and my pre-existing professional contacts? Thanks, [Your Name]","faqs":[{"q":"Is a client list always confidential?","a":"Often yes if it is non-public, but your own network should be excluded."},{"q":"What are standard NDA carve-outs?","a":"Public information, prior knowledge, independent development and legal disclosure."}]},
  {"slug":"/guide/freelancer-exclusivity-non-compete-clause","title":"Freelancer Exclusivity and Non-Compete Clause: Narrow It","description":"Client wants you to work only for them or avoid competitors? Replace broad exclusivity with a narrow, time-limited clause and a retainer if they insist.","h1":"Can a client stop me from working for competitors?","mode":"freelance","jur":"global","trap":"During the term and for 12 months after, Contractor shall not provide services to any business that competes with the Client.","why":"Freelancers live on multiple clients, so exclusivity should be rare and paid for. If a restriction is needed, limit it to direct competitors, a short time and a specific product line, and ask for a retainer. In India, Section 27 of the Indian Contract Act can affect post-contract restraints, so ask a lawyer. This is general information, not legal advice.","fix":"For the term only, Contractor shall not work on a directly competing product named in Schedule A. Contractor remains free to serve all other clients.","email":"Hi [Client],\nCould the exclusivity be limited to the project term and the specific competing product in Schedule A? If broader exclusivity is needed, I would propose a retainer. Thanks, [Your Name]","faqs":[{"q":"Is exclusivity normal in freelance work?","a":"Not usually. If required, it should be narrow, short and compensated."},{"q":"Does Section 27 apply to freelance contracts?","a":"It can affect restraints after the contract ends. Take legal advice for your situation."}]},
  {"slug":"/guide/joining-bonus-clawback-clause-india","title":"Joining Bonus Clawback Clause: When You Must Pay It Back","description":"Joining bonus with a repayment condition if you leave early? See the usual 12-month clawback traps, what to negotiate, and a pro-rata clawback clause.","h1":"Do I have to repay my joining bonus if I resign?","mode":"employment","jur":"india","trap":"If the Employee leaves within 18 months, the full joining bonus must be repaid within 7 days of the last working day.","why":"A full repayment after 17 months makes the bonus almost worthless. A pro-rata clawback reflects the time you worked, and tax already deducted should be considered. Clarify whether you repay the gross or net amount, and what happens if you are laid off. This is general information, not legal advice.","fix":"If the Employee resigns within 12 months, the net joining bonus received shall be repaid pro rata for the unserved months. No repayment is due if employment ends by Company termination or redundancy.","email":"Hi [HR Name],\nCould the joining bonus clawback be pro rata over 12 months, on the net amount, and not apply if the Company ends my role? Thank you, [Your Name]","faqs":[{"q":"Is joining bonus clawback legal?","a":"It is a contract term, so it can apply, but you can negotiate scope. Courts look at reasonableness."},{"q":"Do I repay gross or net?","a":"Check the clause. Ask to repay the net amount you actually received."}]},
  {"slug":"/guide/usage-rights-duration-organic-repost-clause","title":"Organic Repost Usage Rights Duration: How Long Is Fair?","description":"Brand reposts your video on its channels forever? Limit organic usage to 30-90 days, specific platforms and attribution. Copy-paste clause.","h1":"How long can a brand repost my content organically?","mode":"creator","jur":"global","trap":"Brand may use, edit and publish the content on any channel without limit as to time.","why":"Organic reposting is a lighter use than paid ads, but unlimited time and channels still gives away your content library. Set a period, list the channels, require credit and keep ownership with you. This is general information, not legal advice.","fix":"Brand receives a non-exclusive licence to repost the content on its own organic social channels for [30] days from first post, with credit to the Creator. All other rights remain with the Creator.","email":"Hi [Brand],\nCould organic reposting be licensed for 30 days on your own social channels with credit to me? Anything beyond that we can agree separately. Thanks, [Your Name]","faqs":[{"q":"Does the brand own my video?","a":"Not unless the contract transfers ownership. A licence is different from ownership."},{"q":"Should the brand credit me?","a":"Ask for attribution when it reposts your work."}]},
  {"slug":"/guide/staff-poaching-non-solicit-employees-clause-agency","title":"No-Hire and Staff Non-Solicit Clause: Keep It Reasonable","description":"Contract bans hiring any agency staff for years? Limit it to active solicitation for 12 months, make it mutual and allow general job ads.","h1":"What is a staff non-solicit clause in an agency contract?","mode":"agency","jur":"global","trap":"Subcontractor shall not hire or approach any Agency employee or contractor for 36 months.","why":"A total no-hire is hard to follow in a small market. Restrict it to active solicitation for a shorter period and allow responses to general job advertisements. This is general information, not legal advice.","fix":"For 12 months, neither party shall actively solicit the other's staff. General job advertisements and unsolicited applications are permitted.","email":"Hi [Agency],\nCould the staff non-solicit be 12 months, mutual, and exclude general job ads? Thanks, [Your Name]","faqs":[{"q":"Is a no-hire clause enforceable?","a":"It depends on scope and local law. Narrow, mutual clauses are more reasonable."},{"q":"Can I hire someone who applies on their own?","a":"Add an exception for unsolicited applications."}]},
  {"slug":"/guide/work-for-hire-clause-freelancer-prior-tools","title":"Work-for-Hire Clause: Protect Your Prior Tools and Code","description":"Work-for-hire wording can swallow your libraries and templates. Add a carve-out for pre-existing tools, with a licence to the client. Clear sample clause.","h1":"What does a work-for-hire clause mean for my existing code?","mode":"freelance","jur":"global","trap":"Everything Contractor creates, including pre-existing tools and personal projects used in the work, is work made for hire owned by Client.","why":"Work-for-hire can claim your reusable code, templates and tools. Keep pre-existing materials yours and give the client a licence to use them inside the deliverable. This preserves your ability to reuse your own toolkit for other clients. This is general information, not legal advice.","fix":"Contractor retains all pre-existing and general-purpose tools, code and know-how. Client receives a perpetual, non-exclusive licence to use them as part of the deliverables.","email":"Hi [Client],\nCould we exclude my pre-existing tools and libraries from the work-for-hire clause, with a licence for you to use them in the deliverable? Thanks, [Your Name]","faqs":[{"q":"What is a work-for-hire clause?","a":"A term saying the client owns work you create under the contract. Scope and carve-outs matter."},{"q":"Can I reuse my own code for other clients?","a":"Yes, if you keep pre-existing code outside the transfer and license it to the client."}]},
  {"slug":"/guide/relocation-cost-recovery-clause-india","title":"Relocation Cost Recovery Clause: Fair Terms to Ask For","description":"Company wants relocation money back if you leave early? Learn what to cap, how to make it pro rata, and a polite email to fix the clause before moving.","h1":"Can my employer ask me to repay relocation costs?","mode":"employment","jur":"india","trap":"If the Employee leaves within 24 months of relocation, the Employee shall repay the entire relocation allowance and all related costs.","why":"Repaying everything for any exit, even a layoff, is one-sided. Ask for a shorter period, pro-rata reduction and a carve-out if the company ends your job. Get the relocation amount in the letter before you move your family. This is general information, not legal advice.","fix":"Relocation assistance of Rs [AMOUNT] is repayable only if the Employee resigns within 12 months, reduced by 1/12 each completed month, and not repayable if the Company ends employment.","email":"Hi [HR Name],\nBefore I relocate, could the repayment term be 12 months, pro rata, and waived if the Company ends my employment? Please confirm in the letter. Thanks, [Your Name]","faqs":[{"q":"Should I get relocation terms in writing?","a":"Yes. Do not move before the amount, repayment conditions and timeline are in your signed letter."},{"q":"Is relocation repayment negotiable?","a":"Often yes, especially the period and pro-rata reduction."}]},
  {"slug":"/guide/exclusivity-holdback-after-campaign-ends-creators","title":"Post-Campaign Exclusivity Holdback: Do Not Sign for Free","description":"After the campaign, you still cannot promote rivals for months? Limit the holdback or charge for it. Sample wording and negotiation email.","h1":"What is a post-campaign exclusivity holdback?","mode":"creator","jur":"global","trap":"Creator shall not promote any competing product for 6 months after the last post without any additional fee.","why":"A holdback after the campaign blocks you from income with no payment. Shorten it, narrow it to direct competitors and price it as a separate fee. This is general information, not legal advice.","fix":"For [30] days after the last post, Creator shall not publish paid content for a direct competitor in [PRODUCT CATEGORY]. A holdback fee of Rs [AMOUNT] applies.","email":"Hi [Brand],\nCould the post-campaign holdback be 30 days, limited to direct competitors, with a separate holdback fee? Thanks, [Your Name]","faqs":[{"q":"Is a holdback the same as exclusivity?","a":"It is exclusivity that continues after the campaign ends."},{"q":"Can I charge for a holdback?","a":"Yes. Ask for a fee, since it limits your other deals."}]},
  {"slug":"/guide/subcontractor-termination-for-convenience-notice-agency","title":"Termination for Convenience: Subcontractor Notice and Payment","description":"Agency can end at once while you owe 60 days notice? Make notice mutual and add payment for work done, committed costs and a wind-down fee.","h1":"What notice should a subcontractor get on termination?","mode":"agency","jur":"global","trap":"Agency may terminate at any time without notice and without payment for work in progress. Subcontractor needs 60 days written notice.","why":"A one-way exit leaves you with unpaid hours and idle capacity. Ask for mutual notice, payment for work done, committed costs and a short wind-down fee. This is general information, not legal advice.","fix":"Either party may terminate with 30 days written notice. Agency shall pay for all work performed, committed third-party costs and a wind-down fee of [AMOUNT].","email":"Hi [Agency],\nCould termination be mutual with 30 days notice, with payment for work done and committed costs? Thanks, [Your Name]","faqs":[{"q":"Can an agency end the contract immediately?","a":"Only if the contract allows it. Negotiate notice and payment."},{"q":"What is a wind-down fee?","a":"A payment covering the cost of ending a project suddenly."}]},
  {"slug":"/guide/payment-on-satisfaction-clause-freelancer","title":"Payment on Satisfaction Clause: Remove the Veto Over Your Fee","description":"Client can withhold pay if not satisfied? Replace vague satisfaction with objective acceptance criteria and a dispute path. Sample wording.","h1":"Can a client refuse to pay if they are not satisfied?","mode":"freelance","jur":"global","trap":"The Client may withhold payment if it is not fully satisfied with the work.","why":"A satisfaction test with no standard hands the client a veto over your fee. Objective acceptance criteria, such as the checklist in the brief, let both sides decide if work is done. Add a dispute process so the undisputed part is still paid. This is general information, not legal advice.","fix":"Work is accepted when it meets the criteria in Schedule A. The Client shall pay any undisputed amount on time and raise disputes in writing within 5 business days.","email":"Hi [Client],\nCould we replace 'fully satisfied' with the acceptance checklist in Schedule A? It makes approval clear for both of us. Thanks, [Your Name]","faqs":[{"q":"What are acceptance criteria?","a":"A written list of what the finished work must do or include."},{"q":"Can a client pay part of an invoice?","a":"Ask for undisputed amounts to be paid on time even if part is in dispute."}]},
  {"slug":"/guide/salary-deduction-notice-shortfall-india","title":"Salary Deduction for Notice Shortfall: Limits and Pushback","description":"HR deducting salary for unserved notice days? Understand what your contract allows, how deductions are calculated and a clause that limits it to basic pay.","h1":"Can HR deduct salary for notice period shortfall?","mode":"employment","jur":"india","trap":"The Company may recover from the Employee's final settlement any amount for unserved notice, calculated on gross monthly salary, and any other dues.","why":"Deductions should follow your contract and applicable wage rules. Using gross salary, or adding other penalties, can inflate the number. Ask how the figure is calculated and whether leave balance can be used to cover the shortfall. This is general information, not legal advice.","fix":"Notice shortfall shall be calculated on basic pay for unserved days only and may be offset against the Employee's unused leave balance before any deduction.","email":"Hi [HR Name],\nCould you share the calculation for the notice shortfall deduction? I would like it based on basic pay and adjusted against my leave balance first. Thank you, [Your Name]","faqs":[{"q":"Can a company deduct notice pay from my final settlement?","a":"If the contract allows it, a deduction for unserved notice may be made, but it should be calculated as written."},{"q":"Can I use leave to cover notice days?","a":"Many companies allow adjusting leave balance. Ask HR in writing."}]},
  {"slug":"/guide/live-post-minimum-duration-takedown-clause","title":"Minimum Live Duration and Takedown Clause for Creators","description":"Brand needs your post to stay live for a year? Ask for a defined period, fee for long periods and no takedown rights after payment. Sample clause.","h1":"How long must a sponsored post stay live?","mode":"creator","jur":"global","trap":"The sponsored post must remain live on Creator's channels for a minimum of 12 months and may not be archived or deleted.","why":"A long live period reduces your feed's flexibility and can conflict with later deals. Ask for a shorter period, such as 30 to 90 days, or an extra fee for long placements. Make clear what happens if a platform removes the post. This is general information, not legal advice.","fix":"The post stays live for [60] days. If the Brand requires a longer period, a fee of Rs [AMOUNT] per additional month applies. Removal by the platform is not a breach.","email":"Hi [Brand],\nCould the post stay live for 60 days, with a fee for longer placements? Thanks, [Your Name]","faqs":[{"q":"Can a brand make me keep a post up?","a":"If the contract says so. Negotiate duration and fees."},{"q":"What if the platform removes it?","a":"State that platform action is not a breach."}]},
  {"slug":"/guide/retainer-minimum-hours-rollover-clause-agency","title":"Retainer Minimum Hours and Rollover Clause for Agencies","description":"Retainer hours expire monthly while you are always on call? Add rollover, a minimum monthly fee and overage rates. Copy-paste clause.","h1":"How do retainer hours and rollover work?","mode":"agency","jur":"global","trap":"Monthly retainer hours not used expire at month end. All requests outside the allocation are handled without charge.","why":"Expiring hours reward the client's delays, while free overflow work erases your margin. A fair retainer allows rollover for a short period, bills overage at a set rate and guarantees the minimum fee. This is general information, not legal advice.","fix":"Unused retainer hours roll over for 1 month. Hours beyond the allocation are billed at [RATE]. The monthly minimum fee is payable regardless of use.","email":"Hi [Agency],\nCould unused retainer hours roll over for a month and extra hours be billed at [RATE]? Thanks, [Your Name]","faqs":[{"q":"Should retainer hours expire?","a":"Many agencies allow one month rollover. Define it clearly."},{"q":"How are overage hours charged?","a":"At a rate stated in the contract."}]},
  {"slug":"/guide/scope-creep-change-request-clause","title":"Scope Creep Change Request Clause: Written Approval Rule","description":"Stop surprise extra work. Add a change request clause: written request, quote, approval and new date. Copy-paste wording and a polite reply.","h1":"How do I handle scope creep with a change request clause?","mode":"freelance","jur":"global","trap":"Contractor will perform any additional tasks reasonably requested by the Client without additional compensation.","why":"Reasonable additional tasks without pay is open-ended unpaid work. A change request process makes every new item visible, priced and scheduled before work begins. It protects the client from surprise invoices too. This is general information, not legal advice.","fix":"Work outside the agreed scope requires a written change request. Contractor will quote cost and timeline, and work begins only after the Client approves the quote in writing.","email":"Hi [Client],\nThat sounds like a new item. I will send a quick quote with cost and timeline so you can approve it and I can start. Thanks, [Your Name]","faqs":[{"q":"What is a change order?","a":"A written agreement that adds or changes work, with its price and timeline."},{"q":"How do I tell a client something is out of scope?","a":"Point to the scope list and offer a short quote for the extra item."}]},
  {"slug":"/guide/non-solicitation-employees-clients-resignation-india","title":"Non-Solicitation After Resignation: What You Can Still Do","description":"Contract bars you from contacting clients or colleagues after you leave? See how non-solicit clauses differ from non-competes and a fair, narrow wording.","h1":"Can I contact clients or colleagues after I resign?","mode":"employment","jur":"india","trap":"For 24 months after leaving, the Employee shall not solicit or accept business from any client or hire or approach any employee of the Company.","why":"A non-solicit is narrower than a non-compete, but a wide one that covers any client or any employee can still stop you from working. Limit it to clients you personally handled in the last 12 months and to active solicitation. Keep confidential information separate. This is general information, not legal advice.","fix":"For 6 months after employment the Employee shall not actively solicit clients the Employee personally served in the prior 12 months. General advertising and unsolicited approaches are permitted.","email":"Hi [HR Name],\nCould the non-solicit cover only clients I personally served in the last 12 months, for 6 months, and exclude general job postings? Thanks, [Your Name]","faqs":[{"q":"What is the difference between non-solicit and non-compete?","a":"A non-compete blocks you from working for competitors. A non-solicit blocks you from approaching specific clients or staff."},{"q":"Is a non-solicit enforceable in India?","a":"It depends on scope and facts. Narrow, reasonable ones are more defensible than wide bans."}]},
  {"slug":"/guide/barter-gifting-only-collaboration-contract","title":"Gifting-Only Collaboration Contract: Read the Obligations","description":"Brand sends a free product and expects posts and rights? Check deliverables, usage rights and what you owe. Add a fair barter clause.","h1":"Do I owe content for a free product from a brand?","mode":"creator","jur":"global","trap":"In exchange for the product the Creator will publish 3 posts and grant perpetual usage rights. No fee is payable.","why":"A free product is still a transaction. If it comes with deliverables and rights, value both sides. Say clearly whether posting is optional, the product value, and limit usage. This is general information, not legal advice.","fix":"Gifted products are provided without obligation to post. If the Creator chooses to post, the Brand receives organic usage rights for 30 days with disclosure of the gifting.","email":"Hi [Brand],\nThanks for the product! To keep it clear, could we confirm there is no obligation to post, and any post comes with 30 days organic usage and gifting disclosure? Thanks, [Your Name]","faqs":[{"q":"Do I have to disclose gifted products?","a":"Gifts can require disclosure under advertising guidelines. Disclose clearly."},{"q":"Is barter a contract?","a":"It can be, if there are agreed deliverables."}]},
  {"slug":"/guide/agency-payment-withholding-client-dispute-clause","title":"Payment Withholding for Client Disputes: Limit the Hold","description":"Agency may hold your payment if its client disputes anything? Limit the withheld amount to the disputed item and set a resolution deadline.","h1":"Can an agency withhold my payment for a client dispute?","mode":"agency","jur":"global","trap":"Agency may withhold any payment to Subcontractor while any dispute with its client remains unresolved.","why":"A blanket right to hold all payments lets the agency delay for months. Allow withholding only for the disputed item, with a deadline for resolution and payment of the undisputed part. This is general information, not legal advice.","fix":"Agency may withhold only the amount reasonably in dispute for up to 30 days, shall give written reasons and shall pay all undisputed amounts on time.","email":"Hi [Agency],\nCould any withholding be limited to the disputed amount for up to 30 days, with the rest paid on time? Thanks, [Your Name]","faqs":[{"q":"Can a dispute freeze all payments?","a":"Only if the contract says so. Limit withholding to the disputed amount."},{"q":"How long should a dispute last?","a":"Set a deadline such as 30 days."}]},
  {"slug":"/guide/portfolio-rights-freelancer-nda-clause","title":"Portfolio Rights and NDA: Can You Show Client Work?","description":"NDA stops you from showing your work? Add a portfolio right: anonymised case studies, a delay period and client approval. Copy-paste clause.","h1":"Can I show client work in my portfolio under an NDA?","mode":"freelance","jur":"global","trap":"Contractor shall not disclose the existence of this engagement or display any deliverable publicly.","why":"A blanket ban hides your best work from future clients. Ask for the right to show anonymised or approved case studies after launch. Clients often agree if you promise no confidential data. This is general information, not legal advice.","fix":"After public launch, Contractor may display non-confidential portions of the work in a portfolio, naming the Client only with written approval.","email":"Hi [Client],\nCould I include an anonymised case study of this project in my portfolio after launch, without any confidential details? Happy to share it with you first. Thanks, [Your Name]","faqs":[{"q":"Can an NDA prevent portfolio use?","a":"It can if drafted broadly. Ask for an explicit portfolio carve-out."},{"q":"What if the client cannot be named?","a":"Offer an anonymised case study with no private data."}]},
  {"slug":"/guide/confidentiality-nda-overreach-employee-india","title":"Employee NDA Too Broad? Confidentiality Clause Red Flags","description":"NDA says everything you learn is confidential forever? Spot the overbroad wording and use a fair clause with standard exceptions and an end date.","h1":"Is my employment NDA too broad?","mode":"employment","jur":"india","trap":"The Employee shall keep confidential all information learned during employment, in any form, forever, including general skills, knowledge and know-how.","why":"Confidentiality should protect trade secrets and client data, not your general skills. A clause with no end date and no exceptions can block you from doing similar work. Standard exceptions cover public information, things you already knew and information you must disclose by law. This is general information, not legal advice.","fix":"Confidential Information excludes information that is public, already known to the Employee, independently developed, or required by law to be disclosed, and the Employee's general skills and experience.","email":"Hi [HR Name],\nCould the confidentiality clause exclude public information, my prior knowledge and general skills, and set an end date such as 3 years after exit for non-trade-secret information? Thanks, [Your Name]","faqs":[{"q":"Can an NDA stop me from working in my field?","a":"A fair NDA protects specific confidential information, not your general skills. Overbroad wording can be challenged."},{"q":"Is a perpetual NDA normal?","a":"Trade secrets can be protected longer, but ordinary information usually has an end date."}]},
  {"slug":"/guide/likeness-voice-ai-training-rights-clause-creators","title":"Likeness, Voice and AI Training Rights Clause for Creators","description":"Brand contract grants rights to your face, voice and AI use? Add limits on synthetic media, training and edits. Sample clause and email.","h1":"Can a brand use my face and voice for AI?","mode":"creator","jur":"global","trap":"Brand may use Creator's name, likeness, voice and performance in any media now known or later developed, including digital and synthetic media.","why":"Broad media rights can allow AI-generated versions of you or training on your content. Exclude synthetic or AI-generated use without separate consent and payment. This is general information, not legal advice.","fix":"The licence covers only the delivered content as published. The Brand shall not create synthetic or AI-generated versions of the Creator's likeness or voice, or use the content to train AI models, without separate written consent.","email":"Hi [Brand],\nCould the licence exclude AI-generated versions of my likeness and voice, and use of my content to train AI models, without a separate agreement? Thanks, [Your Name]","faqs":[{"q":"Should I allow AI use of my likeness?","a":"Only with clear consent, defined limits and payment."},{"q":"What does 'media now known or later developed' mean?","a":"It is a broad phrase that can cover technologies that do not exist yet."}]},
  {"slug":"/guide/data-protection-dpa-subcontractor-responsibility-india","title":"Data Protection and DPA Clauses for Subcontractors in India","description":"Agency pushes all data protection liability to you? Understand DPDP Act duties, ask for a clear data processing agreement and shared responsibility.","h1":"Who is responsible for data protection in a subcontract?","mode":"agency","jur":"india","trap":"Subcontractor is solely responsible for any data breach, regulatory penalty and client claim arising from the project, without limit.","why":"India's Digital Personal Data Protection Act 2023 sets duties for those who handle personal data, and roles between controller and processor matter. A fair contract has a data processing agreement, defined security measures, prompt breach notice and liability proportional to your role and fees. Ask a lawyer for current rules and phasing. This is general information, not legal advice.","fix":"The parties will sign a data processing agreement. Subcontractor will follow agreed security measures and notify Agency of breaches within 48 hours. Liability for data incidents is capped at [fees paid].","email":"Hi [Agency],\nCould we add a data processing agreement with defined security measures and breach notice, and cap my liability at fees paid? Thanks, [Your Name]","faqs":[{"q":"Does the DPDP Act affect subcontractors?","a":"It can, depending on how you process personal data. Take legal advice on your role."},{"q":"What goes in a DPA?","a":"Purpose, security measures, breach notice, sub-processors and deletion."}]},
  {"slug":"/guide/freelance-contract-termination-for-convenience","title":"Termination for Convenience in Freelance Contracts: Fair Terms","description":"Client can end the contract anytime but you need 90 days notice? Ask for mutual notice, payment for work done and handover terms. Sample clause.","h1":"What is termination for convenience in a freelance contract?","mode":"freelance","jur":"global","trap":"The Client may terminate at any time without notice or payment for work in progress. Contractor must give 90 days written notice.","why":"A one-sided exit lets the client walk away with your partial work unpaid. Fair terms are mutual notice, payment for work completed, return of materials and a clear handover. This is general information, not legal advice.","fix":"Either party may terminate with 14 days written notice. On termination the Client shall pay for all work performed and expenses incurred up to the termination date.","email":"Hi [Client],\nCould termination be mutual with 14 days notice and payment for work completed up to that date? Thanks, [Your Name]","faqs":[{"q":"Can a client terminate without notice?","a":"Only if the contract allows. Negotiate mutual notice and payment for work done."},{"q":"What should happen to unfinished work?","a":"Agree handover terms and payment for completed portions."}]},
  {"slug":"/guide/company-laptop-damage-deduction-clause-india","title":"Company Laptop Damage or Loss Deduction Clause: Be Careful","description":"Employer wants full cost deducted if the company laptop is lost or damaged? See fair wording on depreciation, insurance and normal wear before you accept.","h1":"Can my employer deduct laptop damage from my salary?","mode":"employment","jur":"india","trap":"The Employee shall be liable for the full replacement cost of any Company equipment lost or damaged, to be deducted from salary without notice.","why":"Deducting full new-device cost for any damage ignores depreciation, insurance and normal wear. Salary deductions are regulated, so ask for a written process and value based on the device's age. Keep a handover record with photos. This is general information, not legal advice.","fix":"The Employee is liable only for loss or damage caused by negligence, valued at the device's depreciated value less insurance recovery, after written notice and a chance to respond.","email":"Hi [HR Name],\nCould the equipment clause limit liability to negligence and depreciated value, net of insurance, with a written notice before any deduction? Thanks, [Your Name]","faqs":[{"q":"Can a company deduct equipment cost from salary?","a":"Only as the contract and wage rules allow. Ask for a written process and a fair valuation."},{"q":"How do I protect myself when I receive a laptop?","a":"Sign a handover list, photograph the device, and report any damage on day one."}]},
  {"slug":"/guide/affiliate-code-commission-tracking-clause-creators","title":"Affiliate Code Commission Tracking Clause: Get Paid for Sales","description":"Brand pays commission on sales via your code but controls tracking? Ask for reporting access, payment schedule and attribution window.","h1":"How do I make sure I get paid affiliate commission?","mode":"creator","jur":"global","trap":"Creator will earn a commission on sales tracked by the Brand's system. The Brand's records are final.","why":"If the brand alone controls tracking, you cannot verify your sales. Ask for a reporting dashboard, a clear attribution window, a payment date and dispute rights. This is general information, not legal advice.","fix":"Commission of [10]% is paid on net sales through the Creator's code, with a 30-day attribution window. The Brand shares monthly reports, pays within 15 days and allows an annual audit.","email":"Hi [Brand],\nCould we add monthly sales reports, a 30-day attribution window and payment within 15 days of month end for my affiliate code? Thanks, [Your Name]","faqs":[{"q":"What is an attribution window?","a":"The period after a click or code use during which a sale counts for the creator."},{"q":"Can I audit my affiliate sales?","a":"Ask for reporting access and audit rights in the contract."}]},
  {"slug":"/guide/subcontractor-warranty-bug-fix-obligation-agency","title":"Subcontractor Warranty and Bug-Fix Obligation: Limit the Tail","description":"Warranty runs 2 years and covers everything? Limit it to defects in your work for 60 to 90 days with a fix-or-refund remedy. Sample clause.","h1":"How long should a subcontractor warranty last?","mode":"agency","jur":"global","trap":"Subcontractor warrants the work to be defect-free for 24 months and shall fix any issue at its own cost.","why":"Two years of unlimited fixes, including changes in the client's environment, is a large hidden cost. Limit the warranty to defects in your delivered work, for 60 to 90 days, with fix-or-refund as the sole remedy. This is general information, not legal advice.","fix":"Subcontractor warrants conformity to the agreed specification for [60] days after acceptance. The sole remedy is to correct the defect or refund the affected fee. Third-party changes are excluded.","email":"Hi [Agency],\nCould the warranty be 60 days for defects against the agreed spec, with fix-or-refund as the remedy? Thanks, [Your Name]","faqs":[{"q":"What is a fix-or-refund remedy?","a":"The subcontractor corrects the defect or refunds the affected fees."},{"q":"How long should warranties last?","a":"Often 30 to 90 days, depending on the project."}]},
  {"slug":"/guide/currency-bank-charges-international-payment-clause","title":"International Payment Clause: Currency, Fees and FX Risk","description":"Paid in foreign currency and losing money to bank charges? Add clauses on invoice currency, payer bears fees and exchange rate. Copy-paste wording.","h1":"Who pays bank charges on international freelance payments?","mode":"freelance","jur":"global","trap":"Payments will be made in the Client's local currency net of any bank fees and taxes.","why":"Intermediary bank fees, platform fees and FX can quietly cut your income. Specify the invoice currency, that the payer covers sender-side charges and how withholding tax is handled, with receipts. This is general information; ask a CA about tax and FIRC or FIRA documentation for foreign receipts.","fix":"Invoices are issued in [USD]. The Client bears all sender-side bank and transfer charges. Any withholding tax shall be documented by an official certificate.","email":"Hi [Client],\nCould we invoice in USD with transfer charges borne by the sender, and share any withholding tax certificate? That keeps the amount clean on my side. Thanks, [Your Name]","faqs":[{"q":"Who normally pays transfer fees?","a":"The contract decides. Ask that the sender pays sender-side fees."},{"q":"What about tax on foreign payments?","a":"Tax depends on both countries and your status. Ask a chartered accountant."}]},
  {"slug":"/guide/unilateral-change-of-role-or-salary-clause-india","title":"Company Can Change Your Role or Pay? Unilateral Change Clause","description":"Can your employer change your role, location or pay at will? Learn the risk in unilateral change clauses and ask for consent and notice.","h1":"Can my employer change my role or salary without consent?","mode":"employment","jur":"india","trap":"The Company may at any time modify the Employee's role, location, duties, compensation structure or benefits at its sole discretion.","why":"A blanket right to change anything lets the company cut pay or move you far away after you have joined. Ask that material changes need written consent or reasonable notice, and that your base pay cannot be reduced. This is general information, not legal advice.","fix":"Any reduction in base salary, material change of role or relocation outside [CITY] requires the Employee's written consent or 60 days notice, and the Employee may resign without penalty within that notice.","email":"Hi [HR Name],\nCould the clause confirm that base pay cannot be reduced and that major changes need my written consent or 60 days notice? Thank you, [Your Name]","faqs":[{"q":"Can a company reduce salary after joining?","a":"Not safely without your agreement or a valid contract term. Check the exact clause and take advice before accepting a cut."},{"q":"What should I ask for in a role change clause?","a":"Consent or notice for material changes and no reduction of base pay."}]},
  {"slug":"/guide/creator-refund-clause-brand-deal","title":"Refund Clause in Brand Deals: When You Must Pay Money Back","description":"Contract forces a full refund if the brand is unhappy or cancels the campaign? Limit refunds to non-delivery and keep payment for delivered work.","h1":"When do I have to refund a brand deal fee?","mode":"creator","jur":"global","trap":"Creator must refund the entire fee if the campaign is cancelled for any reason or if the Brand is dissatisfied.","why":"Refunds for any reason make payment unreliable. A fair clause refunds only for work not delivered, and keeps payment for work done. This is general information, not legal advice.","fix":"Creator shall refund fees only for deliverables not provided, within 14 days of written notice. Fees for delivered work are non-refundable.","email":"Hi [Brand],\nCould refunds apply only to deliverables not provided, with fees for completed work kept? Thanks, [Your Name]","faqs":[{"q":"Can a brand demand a refund if it is unhappy?","a":"Only if the contract allows it. Ask to limit refunds to non-delivery."},{"q":"What should be non-refundable?","a":"Fees for work already delivered and approved."}]},
  {"slug":"/guide/agency-exclusivity-single-client-clause-subcontractor","title":"Single-Client Exclusivity Clause for Subcontractors","description":"Agency wants you only for them during the project and after? Replace with a time-limited, project-specific clause paid via a retainer.","h1":"Can an agency make me work only for them?","mode":"agency","jur":"global","trap":"Subcontractor shall work exclusively for Agency and shall not provide services to any other agency or client during the term.","why":"Exclusivity cuts your income to one source. If needed, narrow it to a direct competitor or a project, and pay a retainer that replaces lost work. This is general information, not legal advice.","fix":"During the project only, Subcontractor will not work on a directly competing campaign for [CLIENT/CATEGORY]. Exclusivity is compensated by a retainer of Rs [AMOUNT] per month.","email":"Hi [Agency],\nCould exclusivity be limited to the project and a specific competing category, with a retainer to compensate? Thanks, [Your Name]","faqs":[{"q":"Should exclusivity be paid?","a":"Yes, since it limits other income."},{"q":"Can exclusivity be limited to one category?","a":"Yes. Ask to name the category and period."}]},
  {"slug":"/guide/post-delivery-warranty-bug-fix-period-clause","title":"Warranty and Free Bug-Fix Period Clause: Limit the Support","description":"Contract promises free fixes forever? Limit warranty to 30 days for defects in agreed scope, with paid support after. Copy-paste wording for developers.","h1":"How long should free bug fixing last after delivery?","mode":"freelance","jur":"global","trap":"Contractor shall fix any defects in the deliverable at no cost for the lifetime of the product.","why":"Lifetime free fixes turn a project into endless support. A short defect-fix window, such as 30 days, for issues in the agreed scope is typical, with paid maintenance afterwards. Define what a defect is and exclude third-party changes. This is general information, not legal advice.","fix":"For 30 days after delivery Contractor shall fix defects in the agreed scope at no charge. Changes, new features and third-party issues are billed at [RATE] per hour or under a maintenance plan.","email":"Hi [Client],\nCould the warranty be 30 days for defects in the agreed scope, with support after that on a monthly plan? Thanks, [Your Name]","faqs":[{"q":"What is a defect-fix period?","a":"A fixed time after delivery when you fix defects in agreed scope for free."},{"q":"What happens after the warranty ends?","a":"Offer a paid maintenance plan or hourly support."}]},
  {"slug":"/guide/mandatory-overtime-no-pay-clause-india","title":"Mandatory Overtime Without Pay Clause: Check Before Signing","description":"Contract says you must work extra hours with no additional pay? See what to ask about overtime, comp-offs and working hours rules in your state.","h1":"Can my employer force unpaid overtime?","mode":"employment","jur":"india","trap":"The Employee shall work such additional hours as required by business needs without any additional compensation.","why":"Open-ended unpaid hours can turn a salary into a low hourly rate. Labour and shops and establishments rules on working hours and overtime vary by state and role, and some senior or managerial roles are treated differently. Ask for a defined norm, comp-off or overtime pay. This is general information, not legal advice.","fix":"Standard hours are [9] per day. Work beyond these hours on an ongoing basis shall be compensated by overtime pay or compensatory time off as per Company policy and applicable law.","email":"Hi [HR Name],\nCould you share the policy on overtime and comp-offs, and add a line to the offer that extra hours beyond the standard are compensated or given time off? Thanks, [Your Name]","faqs":[{"q":"Is overtime always paid in India?","a":"Not always. It depends on your role, state rules and contract. Ask HR for the written policy."},{"q":"How do I raise overtime concerns?","a":"Track your hours, ask HR for the policy, and put your request in writing."}]},
  {"slug":"/guide/co-branded-content-ownership-raw-footage-rights","title":"Who Owns Raw Footage and Co-Branded Content in Brand Deals?","description":"Brand claims ownership of all footage and project files? Clarify who owns the final video, raw files and your reuse rights. Sample clause.","h1":"Who owns the footage in a brand collaboration?","mode":"creator","jur":"global","trap":"All footage, raw files and final content belong to the Brand upon creation.","why":"Giving up raw files means you cannot reuse b-roll or behind-the-scenes in your own content. Decide who owns the final cut, who may reuse raw clips and what credit applies. This is general information, not legal advice.","fix":"Brand owns the final edited video as licensed. Creator retains raw footage and may reuse non-product clips in own content, excluding Brand confidential information.","email":"Hi [Brand],\nCould I keep the raw footage and reuse non-product clips in my own content, while you license the final video? Thanks, [Your Name]","faqs":[{"q":"Do I have to hand over raw footage?","a":"Only if the contract says so. Ask to keep it or charge for delivery."},{"q":"Can I reuse a brand video in my portfolio?","a":"Ask for an explicit portfolio right."}]},
  {"slug":"/guide/performance-guarantee-kpi-seo-results-clause-agency","title":"Performance Guarantee and KPI Clause: SEO and Ads Results","description":"Contract guarantees rankings, leads or ROAS or refunds you? Replace guarantees with effort-based KPIs, reporting and a bonus structure.","h1":"Should an agency guarantee SEO or ad results?","mode":"agency","jur":"global","trap":"Subcontractor guarantees first-page rankings and a 5x return on ad spend within 90 days, failing which all fees are refunded.","why":"Search engines, ad platforms and markets are outside your control. Guarantees tie your fee to results you cannot ensure. Offer deliverables, effort-based KPIs and a bonus for hitting targets. This is general information, not legal advice.","fix":"Subcontractor will deliver the agreed activities and monthly reports. Targets are goals, not guarantees. A performance bonus of [AMOUNT] applies if [KPI] is achieved.","email":"Hi [Agency],\nCould we replace the result guarantee with agreed activities, monthly reporting and a performance bonus for hitting targets? Thanks, [Your Name]","faqs":[{"q":"Can anyone guarantee rankings?","a":"No one controls search engine rankings. Offer activities and goals instead."},{"q":"What are effort-based KPIs?","a":"Measures of work delivered, such as pages published or campaigns launched."}]},
  {"slug":"/guide/liability-cap-equal-to-fees-paid-clause","title":"Liability Cap Equal to Fees Paid: Clause and Email to Client","description":"Limit your risk with a liability cap equal to fees paid and no consequential damages. Sample clause plus the exact words to explain it to the client.","h1":"How do I limit my liability to the fees paid?","mode":"freelance","jur":"global","trap":"Contractor is liable for all direct, indirect and consequential losses of the Client, without limit.","why":"Liability for every loss means a mistake could cost far more than the project. A cap equal to fees paid, and an exclusion for indirect or consequential loss, are common protections. Insurance can cover the rest for higher-risk work. This is general information, not legal advice.","fix":"Contractor's total liability shall not exceed the fees paid in the 12 months before the claim. Neither party is liable for loss of profit or indirect or consequential damages.","email":"Hi [Client],\nCould we limit liability to the fees paid under this agreement and exclude indirect losses? This is standard for services contracts of this size. Thanks, [Your Name]","faqs":[{"q":"What is a consequential loss?","a":"Losses that flow indirectly from a breach, such as lost profits or business interruption."},{"q":"Will clients accept a liability cap?","a":"Often yes, especially if the cap is not too low. Explain it is standard practice."}]},
  {"slug":"/guide/offer-letter-revoked-after-resignation-india","title":"Offer Letter Revoked After You Resigned: What to Do Next","description":"Offer withdrawn after you resigned? Steps to take, why to wait for an unconditional offer, and a clause that protects you before you quit.","h1":"What if my offer is withdrawn after I resign?","mode":"employment","jur":"india","trap":"The Company may withdraw this offer at any time prior to joining without assigning any reason and without liability.","why":"This clause leaves you exposed if you resign first. Do not resign until you have a signed, unconditional offer and a confirmed joining date. If an offer is withdrawn, save every email and message, request written reasons, and ask a lawyer whether any remedy exists. This is general information, not legal advice.","fix":"This offer is unconditional after receipt of the Employee's signed acceptance and background clearance. If the Company withdraws it before joining without cause, it shall pay the Employee [2] months of the offered salary.","email":"Hi [HR Name],\nBefore I resign from my current role, could we confirm the offer is final after background clearance, and add compensation if it is withdrawn without cause? Thank you, [Your Name]","faqs":[{"q":"Can an employer withdraw an offer after I accept?","a":"Many offers allow it, but a withdrawal after you resigned can cause real loss. Get the terms in writing before resigning."},{"q":"When should I resign my current job?","a":"After you have a signed offer, cleared background checks and a confirmed joining date."}]},
  {"slug":"/guide/raw-footage-delivery-fee-clause-creators","title":"Raw Footage Delivery Clause: Charge for Extra Files","description":"Brand requests all raw files at the end? Add a delivery fee, a format list and a time limit. Copy-paste clause and a polite reply.","h1":"Should I deliver raw footage to the brand?","mode":"creator","jur":"global","trap":"Creator shall deliver all raw footage, project files and drafts on request at no additional cost.","why":"Raw files carry extra work in cutting, naming, storage and transfer, and they let a brand re-edit without you. If they are needed, charge separately and define formats. This is general information, not legal advice.","fix":"Raw footage is not included. If requested, delivery is available for a fee of Rs [AMOUNT] in agreed formats within 10 business days of payment.","email":"Hi [Brand],\nRaw footage is available as an add-on for Rs [AMOUNT], delivered within 10 business days. Shall I add it to the invoice? Thanks, [Your Name]","faqs":[{"q":"Is raw footage included in a standard brand deal?","a":"Not necessarily. Define it in the contract."},{"q":"How should I price raw footage?","a":"As a separate add-on that covers preparation and transfer."}]},
  {"slug":"/guide/agency-indemnity-third-party-ip-infringement-clause","title":"Third-Party IP Infringement Indemnity: Limit Your Exposure","description":"Must you indemnify for any IP claim, even client-supplied assets? Exclude client materials and cap the amount. Sample indemnity clause.","h1":"Am I liable for IP infringement in client-supplied assets?","mode":"agency","jur":"global","trap":"Subcontractor shall indemnify Agency and its clients against all claims that the deliverables infringe third-party rights, including materials provided by Agency.","why":"You can stand behind what you create, not what the client supplies. Exclude client-provided assets, third-party stock without licence and requested specifications, and keep your total exposure within a cap. This is general information, not legal advice.","fix":"Subcontractor indemnifies only claims that deliverables created by Subcontractor infringe third-party rights. Agency-provided materials and specifications are excluded. Liability is within the agreed cap.","email":"Hi [Agency],\nCould the IP indemnity exclude materials you provide and stay within the liability cap? Thanks, [Your Name]","faqs":[{"q":"Who is responsible for client-supplied images?","a":"The party that supplies them should hold the rights."},{"q":"Can an IP indemnity be capped?","a":"Yes, ask that indemnities are within the general cap."}]},
  {"slug":"/guide/overbroad-confidentiality-clause-freelancer","title":"Overbroad Confidentiality Clause for Freelancers: What to Fix","description":"Confidentiality clause covers everything forever? Narrow it with exceptions for public information, your prior knowledge and an end date.","h1":"How do I fix an overbroad confidentiality clause?","mode":"freelance","jur":"global","trap":"Contractor shall keep confidential all information received in any form, forever, and shall not use it for any other purpose.","why":"Freelancers need to keep client secrets, but also reuse their own know-how. Add standard exceptions, mark what is truly confidential, and set an end date for non-trade-secret information. This is general information, not legal advice.","fix":"Confidential Information excludes information that is public, already known to the Contractor, independently developed or required by law to be disclosed. Obligations end 3 years after termination, except for trade secrets.","email":"Hi [Client],\nCould the confidentiality clause include the standard exceptions and end 3 years after the contract, except for trade secrets? Thanks, [Your Name]","faqs":[{"q":"What are standard NDA exceptions?","a":"Public information, prior knowledge, independent development and legally required disclosure."},{"q":"How long should confidentiality last?","a":"Often 2 to 5 years, with longer protection for true trade secrets."}]},
  {"slug":"/guide/background-verification-termination-clause-india","title":"Background Verification Termination Clause: Protect Yourself","description":"Offer ends if a background check is unsatisfactory? Ask for a clear standard, a chance to correct errors and notice before you resign.","h1":"Can I be terminated for a failed background check?","mode":"employment","jur":"india","trap":"Employment is subject to satisfactory background verification, and the Company may terminate immediately if, in its opinion, the results are unsatisfactory.","why":"'In its opinion' with no standard leaves you open to losing the job after you left your old one. Ask what counts as unsatisfactory, a chance to correct errors, and a minimum notice or payment if termination follows a vendor mistake. This is general information, not legal advice.","fix":"Termination for background findings is limited to material misrepresentation. The Employee shall be given the report and 7 days to respond, and the Company shall give 30 days notice for any other reason.","email":"Hi [HR Name],\nCould the clause define what counts as unsatisfactory and give me a chance to correct any vendor error before any termination? Thanks, [Your Name]","faqs":[{"q":"What if the verification vendor makes a mistake?","a":"Ask for a copy of the report and a chance to respond. Keep your documents ready."},{"q":"Should I resign before verification finishes?","a":"It is safer to wait until the check is cleared and your offer is unconditional."}]},
  {"slug":"/guide/brand-deal-competitor-mention-restriction","title":"Competitor Mention Restriction in Brand Deals: Avoid Overreach","description":"Contract bans mentioning any other brand during the campaign? Limit to direct competitors and the sponsored content only. Sample wording.","h1":"Can a brand stop me mentioning other brands?","mode":"creator","jur":"global","trap":"Creator shall not mention, display or wear any other brand's products in any content during the term.","why":"A ban on any other brand can block your normal content. Limit it to direct competitors in the sponsored posts only. Keep organic and unrelated content free. This is general information, not legal advice.","fix":"The restriction applies only to the sponsored content and only to direct competitors in [CATEGORY]. It does not apply to other content or incidental appearances.","email":"Hi [Brand],\nCould the competitor restriction apply only to the sponsored posts and direct competitors in [CATEGORY], not to my other content? Thanks, [Your Name]","faqs":[{"q":"What counts as a competitor?","a":"Define it by named brands or a specific product category."},{"q":"Does the ban cover all my content?","a":"Make the restriction apply only to sponsored content."}]},
  {"slug":"/guide/offshore-subcontractor-governing-law-currency-clause","title":"Offshore Subcontractor Governing Law and Currency Clause","description":"Agency abroad wants its home courts and local currency? Ask for a neutral law, USD invoicing, online arbitration and sender-paid fees.","h1":"What law and currency should an offshore subcontractor accept?","mode":"agency","jur":"global","trap":"Agreement is governed by the law of the Agency's home state, and payments are made in Agency's local currency at its chosen rate.","why":"Currency and venue risk can erase your margin. Ask for invoices in a stable currency, a stated exchange rate source and neutral dispute resolution, such as online arbitration. This is general information, not legal advice.","fix":"Invoices are issued in [USD] and paid without set-off. Disputes are resolved by online arbitration in English. Transfer charges are borne by the payer.","email":"Hi [Agency],\nCould we invoice in USD and use online arbitration for disputes, with transfer charges paid by the sender? Thanks, [Your Name]","faqs":[{"q":"Why does currency matter?","a":"Exchange rate changes can reduce or increase your real income."},{"q":"What is a neutral venue?","a":"A place or online process that is not the home court of either party."}]},
  {"slug":"/guide/expenses-reimbursement-clause-freelancer","title":"Expenses and Third-Party Costs Clause: Who Pays for Tools?","description":"Who pays for stock assets, plugins, hosting or travel? Add an expenses clause with pre-approval and reimbursement within 14 days of receipts.","h1":"Who pays for tools and third-party costs in a freelance project?","mode":"freelance","jur":"global","trap":"Contractor is responsible for all costs incurred in performing the services, including software, assets and travel.","why":"Hidden costs can eat your profit. Ask that approved third-party costs are paid or reimbursed with receipts, and that anything above a threshold needs written approval first. This is general information, not legal advice.","fix":"Pre-approved third-party costs are reimbursed at cost within 14 days of invoice with receipts. Costs above Rs [AMOUNT] require the Client's written approval.","email":"Hi [Client],\nCould third-party costs like stock assets and plugins be billed at cost with receipts and approval before purchase? Thanks, [Your Name]","faqs":[{"q":"Should freelancers charge expenses separately?","a":"Yes for third-party costs, with approval and receipts."},{"q":"How do I avoid disputes over costs?","a":"Get written approval before buying and attach receipts to your invoice."}]},
  {"slug":"/guide/employment-bond-freshers-campus-placement-india","title":"Fresher Employment Bond After Campus Placement: Read First","description":"Campus offer with a service bond? Check the duration, penalty and real training, and ask for a shorter, pro-rata bond before you sign.","h1":"Should I sign an employment bond as a fresher?","mode":"employment","jur":"india","trap":"The Employee shall sign a service agreement for 2 years. Early exit will attract a penalty of Rs 2,00,000 and forfeiture of any pending dues.","why":"Freshers often feel they cannot negotiate, but you can still ask questions. Check the amount, duration, what training the company really provides, and whether pending salary can be forfeited. A bond tied to real training cost and reduced over time is easier to defend than a flat penalty. This is general information, not legal advice.","fix":"The Employee shall repay documented training costs only if resigning within 12 months, reduced monthly, with no forfeiture of earned salary or benefits.","email":"Hi [HR Name],\nThank you for the offer. Could we discuss reducing the service period to 12 months and limiting the repayment to documented training cost, reducing each month? Regards, [Your Name]","faqs":[{"q":"Can freshers negotiate bond terms?","a":"Yes, politely. Ask for clarity first, then for a shorter period or pro-rata reduction."},{"q":"Can an employer forfeit my earned salary?","a":"Be careful with forfeiture clauses. Earned wages are treated seriously, so seek advice if this appears."}]},
  {"slug":"/guide/event-travel-expenses-creator-contract","title":"Event and Travel Expenses in Creator Contracts: Who Pays?","description":"Brand wants you at an event but says nothing on travel? Add flights, stay, meals and a day rate, with receipts reimbursed within 15 days.","h1":"Who pays travel and event expenses for creators?","mode":"creator","jur":"global","trap":"Creator will attend events as required and is responsible for all related costs.","why":"Event attendance takes time and money. Specify travel class, accommodation, meals, local transport and a day rate or fee for time spent. This is general information, not legal advice.","fix":"Brand pays all pre-approved travel, accommodation and meals, and a day rate of Rs [AMOUNT] for event attendance. Expenses are reimbursed within 15 days of receipts.","email":"Hi [Brand],\nFor the event, could you confirm travel, stay and meals, plus a day rate for attendance? I will share receipts. Thanks, [Your Name]","faqs":[{"q":"Should brands pay my travel?","a":"Yes, unless agreed otherwise. Put it in writing before you commit."},{"q":"Is a day rate normal for events?","a":"Often yes, since attendance is separate from content creation."}]},
  {"slug":"/guide/white-label-client-confidentiality-who-you-are-clause","title":"White-Label Confidentiality: Hiding Your Identity From Clients","description":"Agency wants you to hide your identity from clients? Understand the risks and ask for fair disclosure rules and independent status.","h1":"Can an agency make me hide that I am a subcontractor?","mode":"agency","jur":"global","trap":"Subcontractor shall present itself as part of Agency's in-house team and shall not disclose its separate identity to any client.","why":"Hiding your identity can create tax, liability and credit issues. Ask for clarity on branding, a clear contract relationship and permission to disclose where law or the client requires it. This is general information, not legal advice.","fix":"Subcontractor may work under Agency branding but may disclose its identity where required by law or to protect its rights. Nothing creates an employment relationship.","email":"Hi [Agency],\nCould we confirm I may disclose my identity where legally required, and that I remain an independent subcontractor? Thanks, [Your Name]","faqs":[{"q":"Is white-label work legal?","a":"Branding another company's service is common. Be clear about your status and disclosure rules."},{"q":"Should I sign as an employee?","a":"No. Keep your independent subcontractor status."}]},
  {"slug":"/guide/independent-contractor-status-clause-freelancer","title":"Independent Contractor Status Clause: Avoid Employee-Like Terms","description":"Contract treats you like an employee but pays like a freelancer? Check control, hours and exclusivity terms and add a clear contractor status clause.","h1":"How do I make sure I am treated as an independent contractor?","mode":"freelance","jur":"global","trap":"Contractor shall work fixed hours at the Client's office, follow all Client instructions and work exclusively for the Client.","why":"Fixed hours, tools, supervision and exclusivity can look like employment. A contractor controls how work is done, uses their own tools, invoices for results and may serve other clients. Mislabelling can create tax and legal issues for both sides. Seek professional advice. This is general information, not legal advice.","fix":"Contractor is an independent contractor, controls the method and schedule of the work, uses own equipment and may serve other clients. Nothing creates an employment relationship.","email":"Hi [Client],\nCould the agreement state I am an independent contractor who controls how and when the work is done? That reflects how we plan to work. Thanks, [Your Name]","faqs":[{"q":"What makes someone an independent contractor?","a":"Control over how work is done, own tools, project-based pay and freedom to take other clients."},{"q":"Why does status matter?","a":"It affects taxes, benefits and legal rights. Get professional advice for your situation."}]},
  {"slug":"/guide/bonus-forfeiture-resignation-clause-india","title":"Bonus Forfeited If You Resign? 'Must Be Employed' Clause","description":"Lose your bonus if you resign before payout? See fair wording for earned bonus and a polite request to protect pay you already earned.","h1":"Do I lose my bonus if I resign before payout?","mode":"employment","jur":"india","trap":"To be eligible for any bonus, the Employee must be in service on the payout date and not under notice. Otherwise all bonus entitlement is forfeited.","why":"Payouts are often months after the performance year, so this clause can wipe out pay you already earned. Ask for pro-rata payment for the period worked, or payment of any bonus earned before the notice date. This is general information, not legal advice.","fix":"Any bonus earned for a completed performance period shall be paid even if the Employee resigns after the period ends. For a partial period, the bonus shall be paid pro rata for the months served.","email":"Hi [HR Name],\nCould the bonus clause pay earned bonus for completed periods and pro rata for partial periods, even if I resign before the payout date? Thank you, [Your Name]","faqs":[{"q":"Is a 'must be employed on payout date' clause common?","a":"Yes, many companies use it. It is still negotiable and should be checked against your promised pay."},{"q":"Can I get a pro-rata bonus?","a":"Ask for it in writing. Some companies agree for the months you worked."}]},
  {"slug":"/guide/creator-agency-exclusive-management-contract-term","title":"Exclusive Management Contract Term for Creators: Exit Rights","description":"Management agency locks you in for years? Ask for a shorter term, performance-based exit and carve-out for deals you source. Sample clause.","h1":"How long should a creator management contract last?","mode":"creator","jur":"global","trap":"Agency shall be Creator's exclusive manager for 5 years and automatically renews for 5 more.","why":"Long lock-ins with auto-renewal can trap you if the agency underperforms. Ask for 1 to 2 years, a performance exit if it does not bring a set number of deals and a carve-out for deals you source yourself. This is general information, not legal advice.","fix":"Term is 12 months. Either party may terminate with 30 days notice if Agency does not secure at least [NUMBER] paid deals in any 6-month period. Deals sourced by Creator are excluded from exclusivity.","email":"Hi [Agency],\nCould the term be 12 months with a performance exit and a carve-out for deals I source directly? Thanks, [Your Name]","faqs":[{"q":"Is auto-renewal common?","a":"It appears in some contracts. Ask to remove it or require notice."},{"q":"Can I keep deals I find myself?","a":"Negotiate a carve-out, or lower commission for them."}]},
  {"slug":"/guide/agency-change-of-control-assignment-clause-subcontractor","title":"Change of Control and Assignment Clause: Who Owns Your Contract?","description":"Agency can assign your contract to anyone but you cannot? Ask for mutual consent and a right to terminate if control changes. Sample clause.","h1":"Can an agency transfer my contract to another company?","mode":"agency","jur":"global","trap":"Agency may assign this agreement to any third party without notice. Subcontractor may not assign or delegate any rights.","why":"If the agency is acquired, your contract may move to a company you did not choose. Ask for notice, mutual consent for assignment and a right to terminate and be paid if control changes. This is general information, not legal advice.","fix":"Neither party may assign this agreement without the other's consent, not to be unreasonably withheld. On a change of control of Agency, Subcontractor may terminate on 30 days notice and receive payment for work done.","email":"Hi [Agency],\nCould assignment need mutual consent, and could I end the contract if control of the agency changes? Thanks, [Your Name]","faqs":[{"q":"What is a change of control?","a":"A sale or takeover that changes who owns the company."},{"q":"Should assignment be mutual?","a":"Yes, to keep both sides protected."}]},
  {"slug":"/guide/subcontracting-restriction-clause-freelancer","title":"Subcontracting Restriction Clause: Can You Use Helpers?","description":"Contract bans using any helper or tool? Add a right to subcontract with your responsibility and confidentiality kept. Sample wording.","h1":"Can I use subcontractors on a freelance project?","mode":"freelance","jur":"global","trap":"Contractor shall perform all services personally and shall not use any third party or tool without Client's prior written consent.","why":"A strict personal-performance clause can block normal tools and helpers. Ask for the right to use trusted helpers under NDA, with you remaining responsible for the work. This is general information, not legal advice.","fix":"Contractor may use qualified subcontractors bound by equivalent confidentiality terms and remains responsible for their work. Contractor may use standard software tools.","email":"Hi [Client],\nCould I use trusted subcontractors under the same confidentiality terms, with me fully responsible for the output? Thanks, [Your Name]","faqs":[{"q":"Why would a client ban subcontractors?","a":"To control who sees their data and who does the work. Offer NDAs and accountability."},{"q":"Does AI tool use count as subcontracting?","a":"Check the clause wording. Ask for clarity on tools and data sharing."}]},
  {"slug":"/guide/performance-improvement-plan-pip-termination-clause-india","title":"PIP Termination Clause: Rights and Questions to Ask HR","description":"Facing a performance improvement plan, or a contract that allows PIP-based exit? Learn the questions to ask on goals, support, timeline and severance.","h1":"What should I do if I am put on a PIP?","mode":"employment","jur":"india","trap":"The Company may terminate the Employee at any time if performance is unsatisfactory in its sole opinion, without notice or severance.","why":"A PIP should have clear goals, a fair timeline and manager support. If the contract allows termination on 'sole opinion', ask for written, measurable criteria and notice. Keep copies of feedback, targets and your delivered work. This is general information, not legal advice.","fix":"Any performance plan shall set written, measurable goals with at least 60 days to improve. Termination for performance requires 30 days notice or pay in lieu.","email":"Hi [Manager],\nCould we write down the PIP goals, how each will be measured, and the review dates? I would like to meet them and track progress together. Thank you, [Your Name]","faqs":[{"q":"Is a PIP the same as termination?","a":"No, but it is sometimes a step toward exit. Treat it seriously and ask for clear, measurable goals."},{"q":"Can I negotiate an exit during a PIP?","a":"Sometimes. Ask for a written offer on notice pay, references and relieving terms, and consider legal advice."}]},
  {"slug":"/guide/posting-schedule-time-penalty-clause-creators","title":"Posting Schedule and Late Posting Penalty Clause for Creators","description":"Contract penalises you for posting a few hours late? Add a grace period, a reasonable reschedule process and no fee cuts for brand-caused delay.","h1":"What if I post a few hours late in a brand deal?","mode":"creator","jur":"global","trap":"Posts must go live at the exact date and time specified. Each hour of delay reduces the fee by 10 percent.","why":"Hourly penalties can wipe out the fee over a small delay or platform glitch. Ask for a grace period, rescheduling by mutual consent and no penalty when delay is caused by late approvals. This is general information, not legal advice.","fix":"Posting dates may move by up to 48 hours by mutual notice. No penalty applies where delay is caused by late Brand approvals, product delivery or platform issues.","email":"Hi [Brand],\nCould we give a 48-hour grace period on posting dates, with no penalty when delays come from approvals or platform issues? Thanks, [Your Name]","faqs":[{"q":"Can a brand cut my fee for late posts?","a":"Only if the contract provides it. Negotiate grace periods and caps."},{"q":"What if the product arrives late?","a":"Add that deadlines extend day-for-day for brand delays."}]},
  {"slug":"/guide/subcontractor-audit-rights-clause-agency","title":"Audit Rights Clause for Subcontractors: Limit Access","description":"Agency or client can audit you any time? Limit audits to project records, notice, frequency, confidentiality and who pays. Sample clause.","h1":"What audit rights can an agency demand from me?","mode":"agency","jur":"global","trap":"Agency and its clients may audit Subcontractor's premises, systems and records at any time without notice.","why":"Unlimited audits disrupt your work and may expose other clients' data. Ask for reasonable notice, limits on frequency, scope tied to this project and confidentiality for the auditor. This is general information, not legal advice.","fix":"Agency may audit records relating to this project once per year on 14 days notice during business hours, under confidentiality, at Agency's cost, excluding other clients' information.","email":"Hi [Agency],\nCould audits be limited to project records, once a year with 14 days notice, at your cost and under confidentiality? Thanks, [Your Name]","faqs":[{"q":"Why do agencies ask for audits?","a":"To check compliance with security, quality or legal obligations."},{"q":"How can I limit an audit?","a":"Set scope, notice, frequency and confidentiality."}]},
  {"slug":"/guide/client-delay-deadline-extension-clause","title":"Client Delays and Deadline Extension Clause: Stop-the-Clock Rule","description":"Client late with feedback but deadline stays fixed? Add a clause that extends deadlines for client delay and allows rescheduling fees. Copy-paste wording.","h1":"What if the client is late with feedback but the deadline stays?","mode":"freelance","jur":"global","trap":"Delivery dates are fixed. Contractor is liable for any delay regardless of cause.","why":"Fixed deadlines with client-caused delays put all the risk on you. A stop-the-clock rule extends dates by the number of days the client is late and allows a rescheduling fee if the project is idle too long. This is general information, not legal advice.","fix":"Delivery dates extend day-for-day for any delay in Client feedback, assets or approvals. If the project is idle for over 14 days, Contractor may reschedule and charge a restart fee of [AMOUNT].","email":"Hi [Client],\nCould we add that deadlines extend by the number of days feedback or assets are late? It keeps the schedule realistic for both of us. Thanks, [Your Name]","faqs":[{"q":"What is a stop-the-clock clause?","a":"A term that extends project deadlines when delay is caused by the other side."},{"q":"Can I charge for an idle project?","a":"Add a restart fee clause so rescheduling costs are covered."}]},
  {"slug":"/guide/dual-employment-prohibition-clause-india","title":"Dual Employment Prohibition Clause: Can You Take a Second Job?","description":"Contract bans any second job or freelance work? See what 'exclusive services' really covers and a clause that allows non-competing work with disclosure.","h1":"Can my employer ban me from freelancing on the side?","mode":"employment","jur":"india","trap":"The Employee shall devote full time to the Company and shall not engage in any other employment, consultancy or business activity, paid or unpaid.","why":"A total ban covers hobbies and unpaid projects. A fairer clause bans conflicts of interest and work for competitors, and lets you do unrelated side work outside office hours with disclosure. Breaching a ban can lead to termination, so get permission in writing. This is general information, not legal advice.","fix":"The Employee may undertake outside work that does not compete with the Company, does not use Company resources, and does not affect performance, after written disclosure to the Company.","email":"Hi [HR Name],\nCould the exclusivity clause allow non-competing work outside office hours after I disclose it to the Company? I would like to make sure the rules are clear. Thank you, [Your Name]","faqs":[{"q":"Is a second job allowed in India?","a":"It depends on your contract and policy. Many employers prohibit it or require permission."},{"q":"Can I do unpaid or hobby projects?","a":"A very broad clause may cover them too. Ask to carve out personal and non-commercial projects."}]},
  {"slug":"/guide/brand-deal-governing-law-dispute-clause-creators","title":"Brand Deal Governing Law and Disputes: Where Can You Sue?","description":"Contract forces disputes in the brand's city under its law? Ask for mediation first, online arbitration and shared costs. Copy-paste clause.","h1":"Where will disputes in a brand deal be decided?","mode":"creator","jur":"india","trap":"Disputes shall be decided only by courts in the Brand's city, at the Creator's expense.","why":"Fighting in a distant city at your own cost makes small claims impractical. Ask for mediation first, then online arbitration with shared costs, in a place or by video that you can reach. This is general information, not legal advice.","fix":"Parties shall first try mediation for 30 days. Unresolved disputes go to online arbitration with a sole arbitrator in English, hearings by video, costs shared equally.","email":"Hi [Brand],\nCould disputes go to mediation first and then online arbitration with shared costs? A distant court would be hard for me to use. Thanks, [Your Name]","faqs":[{"q":"What is mediation?","a":"A neutral person helps both sides reach a settlement. It is faster and cheaper than court."},{"q":"Can I choose a different city for disputes?","a":"You can ask. Online arbitration is a common compromise."}]},
  {"slug":"/guide/milestone-payment-schedule-acceptance-criteria-agency","title":"Milestone Payment Schedule and Acceptance Criteria for Agencies","description":"Payment due only on final delivery? Split fees into milestones with written acceptance criteria and payment dates. Sample schedule clause.","h1":"How should I structure milestone payments with an agency?","mode":"agency","jur":"global","trap":"The full fee is payable only after final delivery and acceptance of the complete project by the end client.","why":"A single payment at the end ties your cashflow to the slowest part of the chain. Break the fee into milestones with clear acceptance criteria, due dates and no dependency on the end client's approval. This is general information, not legal advice.","fix":"Fees are payable in milestones: [30]% on kickoff, [40]% on first delivery, [30]% on final delivery. Each milestone is accepted when it meets Schedule A criteria, and invoices are due in 14 days.","email":"Hi [Agency],\nCould we split the fee into three milestones with written acceptance criteria and 14-day invoices? It helps us both track progress. Thanks, [Your Name]","faqs":[{"q":"Why use milestones?","a":"They spread risk and keep cash flowing as work progresses."},{"q":"What are acceptance criteria?","a":"A written list showing when a deliverable counts as complete."}]}
];

export const GUIDES = ALL.slice(0, LIVE_GUIDE_COUNT);
`);

F("src/pages/Guide.svelte", String.raw`<script>
  import { GUIDES, MODE_LABELS } from "../lib/guides.mjs";
  import { scanMode, scanJur, link } from "../lib/app.js";
  import RewriteBox from "../lib/RewriteBox.svelte";

  export let path = "";

  $: guide = GUIDES.find(function (g) { return g.slug === path; }) || null;
  $: related = guide ? pickRelated(guide) : [];

  function pickRelated(g) {
    const same = GUIDES.filter(function (x) { return x.mode === g.mode; });
    const i = same.findIndex(function (x) { return x.slug === g.slug; });
    const out = [];
    for (let k = 1; k <= 5 && k < same.length; k++) out.push(same[(i + k) % same.length]);
    return out;
  }

  function scan(e) {
    scanMode.set(guide.mode);
    scanJur.set(guide.jur);
    link(e, "/dashboard");
  }
</script>

<div class="wrap narrow page">
  {#if !guide}
    <h1 class="h2">Guide not found</h1>
    <p class="lead">That guide does not exist. Browse all of them instead.</p>
    <a class="btn primary" href="/guides" on:click={(e) => link(e, "/guides")}>See all guides</a>
  {:else}
    <p class="crumbs">
      <a href="/guides" on:click={(e) => link(e, "/guides")}>Guides</a> › {MODE_LABELS[guide.mode]}
    </p>
    <h1 class="h2">{guide.h1}</h1>
    <p class="lead" style="margin-top:8px">{guide.description}</p>

    <section class="gsec">
      <h2>The risky clause</h2>
      <blockquote class="trap">{guide.trap}</blockquote>
    </section>

    <section class="gsec">
      <h2>Why it is dangerous</h2>
      <p style="margin:0;overflow-wrap:break-word">{guide.why}</p>
    </section>

    <section class="gsec">
      <h2>Safer clause and message to send</h2>
      <RewriteBox clause={guide.fix} email={guide.email} />
    </section>

    <section class="gsec">
      <h2>Frequently asked questions</h2>
      {#each guide.faqs as f}
        <details class="faq">
          <summary>{f.q}</summary>
          <p>{f.a}</p>
        </details>
      {/each}
    </section>

    {#if related.length}
      <section class="gsec">
        <h2>Related guides</h2>
        <ul class="gl">
          {#each related as r (r.slug)}
            <li><a class="gcard" href={r.slug} on:click={(e) => link(e, r.slug)}><b>{r.h1}</b><span class="d">{r.description}</span></a></li>
          {/each}
        </ul>
      </section>
    {/if}

    <p class="muted small" style="margin-top:24px">General information for contractors, creators and employees, not legal advice. For high-value or disputed contracts, ask a qualified lawyer.</p>

    <div class="stickycta">
      <b>Have a contract or offer letter like this? Scan your full document free in 30s →</b>
      <a class="btn primary" href="/dashboard" on:click={scan}>Scan my contract</a>
    </div>
  {/if}
</div>
`);

F("src/pages/GuidesHub.svelte", String.raw`<script>
  import { GUIDES, MODE_LABELS, MODE_ORDER } from "../lib/guides.mjs";
  import { link } from "../lib/app.js";

  let cat = "all";
  let q = "";

  $: needle = q.trim().toLowerCase();
  $: list = GUIDES.filter(function (g) {
    const okCat = cat === "all" || g.mode === cat;
    const okText = needle === "" || (g.title + " " + g.description).toLowerCase().indexOf(needle) !== -1;
    return okCat && okText;
  });
  $: groups = MODE_ORDER.map(function (m) {
    return { mode: m, items: list.filter(function (g) { return g.mode === m; }) };
  }).filter(function (g) { return g.items.length > 0; });

  function count(m) {
    return GUIDES.filter(function (g) { return g.mode === m; }).length;
  }
</script>

<div class="wrap page">
  <div class="center" style="max-width:720px;margin:0 auto 18px">
    <h1 class="h2">Contract guides for freelancers, creators and job seekers</h1>
    <p class="lead">Plain-English help with job bonds, notice period buyouts, brand deal usage rights, late payment, scope creep and agency contracts. Each guide shows the risky clause, why it hurts, a safer rewrite and a message you can send.</p>
  </div>

  <div class="chips" role="group" aria-label="Guide category">
    <button class:on={cat === "all"} on:click={() => (cat = "all")}>All ({GUIDES.length})</button>
    {#each MODE_ORDER as m}
      <button class:on={cat === m} on:click={() => (cat = m)}>{MODE_LABELS[m]} ({count(m)})</button>
    {/each}
  </div>

  <label for="gq" class="muted small">Search guides</label>
  <input id="gq" type="search" bind:value={q} placeholder="Try: bond, notice period, whitelisting, MSMED" autocomplete="off" />

  {#each groups as g (g.mode)}
    <h2 class="sub" style="margin-top:22px">{MODE_LABELS[g.mode]}</h2>
    <div class="guides-grid">
      {#each g.items as it (it.slug)}
        <a class="gcard" href={it.slug} on:click={(e) => link(e, it.slug)}>
          <span class="mbadge">{MODE_LABELS[it.mode]}</span>
          <b>{it.h1}</b>
          <span class="d">{it.description}</span>
        </a>
      {/each}
    </div>
  {/each}
  {#if groups.length === 0}<p class="muted" style="margin-top:18px">No guides match your search.</p>{/if}
</div>
`);

// ---------------------------------------------------------------------------
// Assets (generated only when missing, never overwritten)
// ---------------------------------------------------------------------------
const FAVICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#4f46e5"/><circle cx="16" cy="16" r="9" fill="none" stroke="#fff" stroke-opacity=".9" stroke-width="2"/><circle cx="16" cy="16" r="4" fill="none" stroke="#fff" stroke-opacity=".9" stroke-width="2"/><circle cx="22" cy="10" r="2.6" fill="#fb7185"/></svg>\n';

let CRC = null;
function crc32(buf) {
  if (!CRC) {
    CRC = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC[n] = c;
    }
  }
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 255] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

// A text-free 1200x630 social card: a contract page with two flagged lines next to a radar.
export function makeOgPng() {
  const W = 1200;
  const H = 630;
  const stride = W * 3 + 1;
  const buf = Buffer.alloc(stride * H);
  for (let y = 0; y < H; y++) {
    buf[y * stride] = 0;
    for (let x = 0; x < W; x++) {
      const t = (x / W) * 0.6 + (y / H) * 0.4;
      const i = y * stride + 1 + x * 3;
      buf[i] = Math.round(15 + (49 - 15) * t);
      buf[i + 1] = Math.round(23 + (46 - 23) * t);
      buf[i + 2] = Math.round(42 + (129 - 42) * t);
    }
  }
  function blend(x, y, r, g, b, a) {
    if (a <= 0 || x < 0 || y < 0 || x >= W || y >= H) return;
    const i = y * stride + 1 + x * 3;
    buf[i] = Math.round(buf[i] * (1 - a) + r * a);
    buf[i + 1] = Math.round(buf[i + 1] * (1 - a) + g * a);
    buf[i + 2] = Math.round(buf[i + 2] * (1 - a) + b * a);
  }
  const clamp = function (v) { return Math.max(0, Math.min(1, v)); };
  function rrect(x0, y0, x1, y1, rad, c, alpha) {
    for (let y = Math.floor(y0) - 1; y <= y1 + 1; y++) {
      for (let x = Math.floor(x0) - 1; x <= x1 + 1; x++) {
        const dx = Math.max(x0 + rad - x, 0, x - (x1 - rad));
        const dy = Math.max(y0 + rad - y, 0, y - (y1 - rad));
        blend(x, y, c[0], c[1], c[2], clamp(0.5 - (Math.hypot(dx, dy) - rad)) * alpha);
      }
    }
  }
  function dot(cx, cy, r, c, glow) {
    const R = Math.ceil(r * 4);
    for (let y = cy - R; y <= cy + R; y++) {
      for (let x = cx - R; x <= cx + R; x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (glow) blend(x, y, c[0], c[1], c[2], 0.28 * clamp(1 - d / (r * 4)));
        blend(x, y, c[0], c[1], c[2], clamp(r + 0.8 - d));
      }
    }
  }
  const cx = 880;
  const cy = 315;
  [90, 170, 250, 330].forEach(function (r) {
    for (let y = cy - r - 3; y <= cy + r + 3; y++) {
      for (let x = cx - r - 3; x <= cx + r + 3; x++) {
        blend(x, y, 165, 180, 252, clamp(1 - Math.abs(Math.hypot(x - cx, y - cy) - r) / 1.6) * 0.4);
      }
    }
  });
  dot(cx + 120, cy - 105, 15, [251, 113, 133], true);
  dot(cx - 170, cy + 40, 12, [251, 191, 36], true);
  dot(cx, cy, 6, [255, 255, 255], false);
  rrect(80, 100, 590, 530, 24, [255, 255, 255], 0.97);
  rrect(112, 134, 290, 154, 10, [79, 70, 229], 1);
  const widths = [440, 400, 440, 360, 420, 440, 300, 400, 340];
  for (let k = 0; k < widths.length; k++) {
    const y = 190 + k * 36;
    const c = k === 2 ? [253, 164, 175] : k === 5 ? [252, 211, 77] : [203, 213, 225];
    rrect(112, y, 112 + widths[k], y + 14, 7, c, 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const t = Buffer.from(type, "ascii");
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
    return Buffer.concat([len, t, data, crc]);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(buf, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// index.html (keeps your existing module script tag and root element id)
// ---------------------------------------------------------------------------
export function buildIndexHtml(existing, headStr, shellStr) {
  const scriptM = existing.match(/<script\s+type="module"[^>]*><\/script>/i);
  if (!scriptM) throw new Error('Could not find <script type="module" ...></script> in your index.html.');
  const rootM = existing.match(/<div\s+id="([^"]+)"/i);
  const rootId = rootM ? rootM[1] : "app";
  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="UTF-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0" />',
    '<meta name="color-scheme" content="light" />',
    '<meta name="theme-color" content="#4f46e5" />',
    '<link rel="icon" type="image/svg+xml" href="/favicon.svg" />',
    '<link rel="preconnect" href="https://fonts.googleapis.com" />',
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />',
    '<link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" />',
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" media="print" data-m="all" onload="this.media=this.dataset.m" />',
    '<noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" /><style>#boot{display:none}.sr-shell{position:static!important;width:auto!important;height:auto!important;overflow:visible!important;clip:auto!important;clip-path:none!important;white-space:normal!important}</style></noscript>',
    '<style>html,body{margin:0;background:#f8fafc}body{font-family:Inter,"Inter Fallback",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}' +
      '@font-face{font-family:"Inter Fallback";src:local("Arial");ascent-override:90.2%;descent-override:22.48%;line-gap-override:0%;size-adjust:107.4%}' +
      '.sr-shell{position:absolute!important;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap}' +
      '#boot{min-height:100vh;background:radial-gradient(900px 420px at 15% -10%,rgba(99,102,241,.16),transparent),radial-gradient(700px 380px at 90% 0%,rgba(244,114,182,.14),transparent)}' +
      '#boot .bn{height:56px;display:flex;align-items:center;justify-content:space-between;padding:0 16px;background:rgba(255,255,255,.96);border-bottom:1px solid #e2e8f0;box-sizing:border-box}' +
      '#boot .bl{display:flex;align-items:center;gap:8px;font-weight:800;font-size:1.125rem;letter-spacing:-.02em;color:#0f172a}' +
      '#boot .bm{width:26px;height:26px;border-radius:8px;background:#4f46e5;display:inline-block}' +
      '#boot .bp{width:84px;height:36px;border-radius:999px;background:#e2e8f0}' +
      '#boot .bh{max-width:1120px;margin:0 auto;padding:44px 18px}' +
      '#boot .bs{border-radius:12px;background:linear-gradient(90deg,#e2e8f0,#f1f5f9,#e2e8f0);background-size:200% 100%;animation:bsh 1.2s linear infinite;margin:0 auto 14px}' +
      '@keyframes bsh{to{background-position:-200% 0}}</style>',
    '<script>(function(){var d=0;function reveal(m){if(d)return;d=1;var b=document.getElementById("boot");if(b)b.remove();var s=document.getElementById("seo-shell");if(s)s.className="";if(m){var n=document.createElement("div");n.id="boot-err";n.setAttribute("style","position:fixed;left:8px;right:8px;bottom:8px;z-index:9999;background:#fff1f2;border:1px solid #fecdd3;color:#9f1239;padding:8px 12px;border-radius:10px;font:13px system-ui,sans-serif");n.textContent="The interactive app could not start ("+m+"). You can still read this page. Reload to try again.";document.body.appendChild(n)}}window.addEventListener("error",function(e){if(!document.getElementById("boot"))return;var t=e&&e.target;if(t&&t!==window&&t.tagName!=="SCRIPT")return;reveal(String((e&&e.message)||(t&&t.src)||"script error").slice(0,140))},true);window.addEventListener("unhandledrejection",function(e){if(!document.getElementById("boot"))return;reveal(String((e&&e.reason&&e.reason.message)||"error").slice(0,140))});setTimeout(function(){if(document.getElementById("boot"))reveal("")},6000)})();</script>',
    '<meta name="seo-start" content="1" />',
    headStr.trim(),
    '<meta name="seo-end" content="1" />',
    "</head>",
    "<body>",
    '<seo-shell id="seo-shell" class="sr-shell" style="display:block">' + shellStr + "</seo-shell>",
    '<div id="boot" aria-hidden="true"><div class="bn"><div class="bl"><span class="bm"></span>ClauseRadar</div><span class="bp"></span></div><div class="bh"><div class="bs" style="width:60%;max-width:360px;height:22px"></div><div class="bs" style="width:92%;max-width:680px;height:40px"></div><div class="bs" style="width:74%;max-width:540px;height:40px"></div><div class="bs" style="width:84%;max-width:620px;height:16px;margin-top:26px"></div><div class="bs" style="width:100%;max-width:340px;height:50px;margin-top:26px"></div></div></div>',
    '<div id="' + rootId + '"></div>',
    scriptM[0],
    "</body>",
    "</html>",
    "",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Pre-flight in a staging folder (touches nothing in your project)
// ---------------------------------------------------------------------------
function syntaxCheck(code, file, label) {
  fs.writeFileSync(file, code, "utf8");
  try {
    execSync('node --check "' + file + '"', { stdio: "pipe" });
    return 0;
  } catch (e) {
    console.error("SYNTAX ERROR in " + label + ":\n" + String(e.stderr || e.message).slice(0, 600));
    return 1;
  }
}

function markupCheck(rel, content) {
  const markup = content.replace(/<script>[\s\S]*?<\/script>/, "").replace(/<style>[\s\S]*?<\/style>/, "");
  let bad = 0;
  ["if", "each"].forEach(function (k) {
    const open = (markup.match(new RegExp("\\{#" + k + "\\b", "g")) || []).length;
    const close = (markup.match(new RegExp("\\{/" + k + "\\}", "g")) || []).length;
    if (open !== close) {
      console.error("MARKUP ERROR in " + rel + ": {#" + k + "} opens " + open + " but closes " + close);
      bad += 1;
    }
  });
  return bad;
}

function runBuild(root, backupDir) {
  console.log("\n$ npm run build");
  const r = spawnSync("npm", ["run", "build"], { cwd: root, encoding: "utf8", shell: true, maxBuffer: 64 * 1024 * 1024 });
  const log = (r.stdout || "") + "\n" + (r.stderr || "");
  try {
    fs.mkdirSync(backupDir, { recursive: true });
    fs.writeFileSync(path.join(backupDir, "build.log"), log);
  } catch (e) {}
  process.stdout.write(log);
  if (r.status !== 0) {
    const hits = log.split("\n").filter(function (l) { return /error|MISSING_EXPORT|Could not resolve|failed/i.test(l); }).slice(0, 10);
    throw new Error("npm run build exited with code " + r.status + (hits.length ? "\n  " + hits.join("\n  ") : "") + "\n  Full log: " + path.join(backupDir, "build.log"));
  }
}

export function finalApiFiles(isESM) {
  const exportLine = isESM ? "\nexport default handler;\n" : "\nmodule.exports = handler;\n";
  const cryptoImport = isESM ? 'import crypto from "node:crypto";\n' : 'const crypto = require("node:crypto");\n';
  const out = {};
  Object.keys(API_FILES).forEach(function (k) {
    out[k] = API_FILES[k].replace("__CRYPTO_IMPORT__", cryptoImport) + exportLine;
  });
  return out;
}

export async function stageAndCheck(stage, existingIndex, isESM, root) {
  fs.rmSync(stage, { recursive: true, force: true });
  let bad = 0;
  for (const rel of Object.keys(FILES)) {
    const content = FILES[rel];
    const abs = path.join(stage, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, "utf8");
    if (/\.m?js$/.test(rel)) {
      bad += syntaxCheck(content, abs + ".check.mjs", rel);
    } else if (rel.endsWith(".svelte")) {
      const m = content.match(/<script>([\s\S]*?)<\/script>/);
      if (m) bad += syntaxCheck(m[1], abs + ".check.mjs", rel + " <script>");
      bad += markupCheck(rel, content);
    }
  }
  const apis = finalApiFiles(isESM !== false);
  Object.keys(apis).forEach(function (rel) {
    const abs = path.join(stage, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    bad += syntaxCheck(apis[rel], abs + ".check.mjs", rel);
  });
  if (bad) throw new Error(bad + " pre-flight problem(s) found. Nothing was changed.");


  const seo = await import(pathToFileURL(path.join(stage, "scripts", "seo-content.mjs")).href);
  const html = buildIndexHtml(existingIndex, seo.headTags("/"), seo.shellHtml("/"));

  // Dry-run the prerender step against a fake dist folder.
  fs.mkdirSync(path.join(stage, "dist"), { recursive: true });
  fs.writeFileSync(path.join(stage, "dist", "index.html"), html, "utf8");
  execSync("node scripts/prerender.mjs", { cwd: stage, stdio: "inherit" });
  const need = ["index.html", "scope-guard/index.html", "chaser/index.html", "sample/index.html", "dashboard/index.html", "pricing/index.html", "guides/index.html", "privacy/index.html", "terms/index.html", "sitemap.xml", "robots.txt"];
  need.forEach(function (f) {
    if (!fs.existsSync(path.join(stage, "dist", f))) throw new Error("Prerender dry-run did not create " + f);
  });
  return html;
}

// ---------------------------------------------------------------------------
// Installer
// ---------------------------------------------------------------------------
function sh(cmd, cwd) {
  console.log("\n$ " + cmd);
  execSync(cmd, { stdio: "inherit", cwd: cwd });
}

function findBrand(dir, hits) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (d) {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) findBrand(p, hits);
    else if (/\.(svelte|js|mjs|ts|css|html|json|md)$/.test(d.name) && fs.readFileSync(p, "utf8").indexOf("SafeClause") !== -1) hits.push(p);
  });
}

async function main() {
  const root = process.cwd();
  const BACKUP = path.join(root, ".safeclause-backup", "cr-" + new Date().toISOString().replace(/[:.]/g, "-"));
  const STAGE = path.join(root, ".clauseradar-stage");

  if (!fs.existsSync(path.join(root, "package.json")) || !fs.existsSync(path.join(root, "src")) || !fs.existsSync(path.join(root, "index.html"))) {
    console.error("ERROR: run this from the project root (package.json, index.html and src/ must exist).");
    process.exit(1);
  }

  const existingIndex = fs.readFileSync(path.join(root, "index.html"), "utf8");
  let indexHtml;
  let isESM = true;
  try {
    const pkg0 = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
    isESM = pkg0.type === "module";
    indexHtml = await stageAndCheck(STAGE, existingIndex, isESM, root);
    console.log("\nPre-flight OK: all files pass syntax checks and the prerender dry-run.");
  } catch (e) {
    console.error("\nPRE-FLIGHT FAILED: " + e.message);
    fs.rmSync(STAGE, { recursive: true, force: true });
    process.exit(1);
  }
  fs.rmSync(STAGE, { recursive: true, force: true });

  // package.json: make "build" run the prerender after vite build
  const pkgPath = path.join(root, "package.json");
  const pkgOriginal = fs.readFileSync(pkgPath, "utf8");
  const pkg = JSON.parse(pkgOriginal);
  pkg.scripts = pkg.scripts || {};
  const build = pkg.scripts.build || "vite build";
  if (build.indexOf("vite") === -1) console.warn("WARNING: your build script is '" + build + "'. The prerender step will be appended to it.");
  if (build.indexOf("prerender.mjs") === -1) pkg.scripts.build = build + " && node scripts/prerender.mjs";
  const pkgNew = JSON.stringify(pkg, null, 2) + "\n";

  if (!fs.existsSync(path.join(root, "node_modules", "@supabase", "supabase-js"))) {
    sh("npm install @supabase/supabase-js@2 --no-audit --no-fund", root);
  }

  // Backups + writes (tracked for rollback)
  fs.mkdirSync(BACKUP, { recursive: true });
  const written = [];
  function put(rel, content) {
    const abs = path.join(root, rel);
    const existed = fs.existsSync(abs);
    if (existed) fs.copyFileSync(abs, path.join(BACKUP, "cr__" + rel.replace(/[\\/]/g, "__")));
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
    written.push({ rel: rel, existed: existed });
    console.log("wrote " + rel);
  }
  function rollback() {
    console.error("\nRolling back to your previous files...");
    written.slice().reverse().forEach(function (w) {
      const abs = path.join(root, w.rel);
      const bak = path.join(BACKUP, "cr__" + w.rel.replace(/[\\/]/g, "__"));
      if (w.existed && fs.existsSync(bak)) fs.copyFileSync(bak, abs);
      else if (!w.existed && fs.existsSync(abs)) fs.unlinkSync(abs);
    });
  }

  Object.keys(FILES).forEach(function (rel) { put(rel, FILES[rel]); });
  const apiFinal = finalApiFiles(isESM);
  Object.keys(apiFinal).forEach(function (rel) { put(rel, apiFinal[rel]); });
  put("index.html", indexHtml);
  put("package.json", pkgNew);
  if (!fs.existsSync(path.join(root, "public", "favicon.svg"))) put("public/favicon.svg", FAVICON);
  if (!fs.existsSync(path.join(root, "public", "og.png"))) put("public/og.png", makeOgPng());

  const missing = written.filter(function (w) { return !fs.existsSync(path.join(root, w.rel)); });
  if (missing.length) {
    console.error("\nWRITE CHECK FAILED. These files are missing after writing: " + missing.map(function (w) { return w.rel; }).join(", "));
    rollback();
    process.exit(1);
  }

  try {
    runBuild(root, BACKUP);
    const dist = path.join(root, "dist");
    const html = fs.readFileSync(path.join(dist, "index.html"), "utf8");
    if (html.indexOf("Audit any contract in 30 seconds") === -1) throw new Error("dist/index.html is missing the static hero copy.");
    ["pricing/index.html", "sample/index.html", "guides/index.html", "sitemap.xml", "robots.txt"].forEach(function (f) {
      if (!fs.existsSync(path.join(dist, f))) throw new Error("dist/" + f + " was not created.");
    });
  } catch (e) {
    console.error("\nBUILD OR VERIFY FAILED: " + (e && e.message ? e.message : e));
    try {
      console.error("\nsrc/lib now contains: " + fs.readdirSync(path.join(root, "src", "lib")).join(", "));
      console.error("src/pages now contains: " + fs.readdirSync(path.join(root, "src", "pages")).join(", "));
    } catch (e2) {}
    console.error("Nothing was pushed.");
    rollback();
    process.exit(1);
  }

  console.log("\nBuild OK. Static pages, sitemap.xml and robots.txt are in dist/.");
  const hits = [];
  try { findBrand(path.join(root, "src"), hits); } catch (e) {}
  if (hits.length) console.warn("Old brand name still found in:\n  " + hits.join("\n  "));

  try {
    sh("git add " + written.map(function (w) { return w.rel; }).join(" "), root);
    try {
      sh('git commit -m "ClauseRadar v10: fail-open boot (no more stuck skeleton), bounded auth wait"', root);
    } catch (e) {
      console.log("Nothing new to commit, continuing to push.");
    }
    sh("git push --force-with-lease origin main", root);
    console.log("\nPushed. Vercel will redeploy automatically.");
    console.log("\nNEXT (required once): open Supabase > SQL Editor, paste supabase-v3.sql from your project root and run it.");
    console.log("Until it runs, Free plan features keep working but Pro, Contract Memory, Scope Guard, Payment Chaser and device limits stay inactive.");
    console.log("Env vars needed (you already have most): GROQ_API_KEY, GEMINI_API_KEY, SUPABASE_URL or VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.");
    console.log("\nFOR THE REFERRAL PROGRAM: (1) run supabase-v4-referrals.sql in the Supabase SQL Editor (after supabase-v3.sql), (2) add ADMIN_PASSWORD in Vercel > Settings > Environment Variables (optional: ADMIN_EMAILS=you@gmail.com), then redeploy.");
  } catch (e) {
    console.error("\nGit push failed (files and build are fine).");
    console.error("If you are sure you want to overwrite the remote, run: git push --force origin main");
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(function (e) {
    console.error(e);
    process.exit(1);
  });
}

