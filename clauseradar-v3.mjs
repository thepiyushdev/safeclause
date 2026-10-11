// clauseradar-v3.mjs
// Run from the project root in Termux:  node clauseradar-v3.mjs

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { execSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const FILES = {};
function F(name, content) {
  FILES[name] = content;
}

// ---------------------------------------------------------------------------
// Shared modules
// ---------------------------------------------------------------------------
F("src/lib/meta.mjs", String.raw`export const SITE = "https://clauseradar.online";
export const BRAND = "ClauseRadar";
export const CONTACT_EMAIL = "support@clauseradar.online";
export const OG_IMAGE = SITE + "/og.png";

export const ROUTE_META = {
  "/": {
    title: "ClauseRadar – AI Contract Review for Freelancers & Devs",
    description: "Audit client contracts in 30 seconds. Spot uncapped liability, payment traps, and risky clauses before you sign.",
    index: true, priority: "1.0",
  },
  "/sample": {
    title: "Sample Contract Audit Report – ClauseRadar",
    description: "Explore an interactive sample audit: severity-coded clauses, plain-English explanations and safer rewrites with counter-proposal emails.",
    index: true, priority: "0.8",
  },
  "/dashboard": {
    title: "Contract Scanner – ClauseRadar",
    description: "Upload a PDF or DOCX, or paste contract text, to detect liability, payment and IP risks in seconds.",
    index: true, priority: "0.9",
  },
  "/pricing": {
    title: "Pricing – ClauseRadar",
    description: "Scan contracts free. Go Pro for ₹499 a month to unlock every rewrite, Scope Guard, Payment Chaser and PDF reports.",
    index: true, priority: "0.8",
  },
  "/scope-guard": {
    title: "Scope Guard – Stop Client Scope Creep | ClauseRadar",
    description: "Paste a client's quick tweak request. Find out in seconds if it is in scope, billable or a grey area, with a polite reply and a change-order quote.",
    index: true, priority: "0.8",
  },
  "/chaser": {
    title: "Payment Chaser – Late Invoice Reminders | ClauseRadar",
    description: "Track invoices against your contract's payment terms and get an escalation sequence from a friendly reminder to a formal demand notice.",
    index: true, priority: "0.8",
  },
  "/radar": {
    title: "Freelance Contract Risk Calculator – ClauseRadar",
    description: "Estimate how much late payment, unlimited revisions and uncapped liability could cost you before you sign.",
    index: true, priority: "0.6",
  },
  "/vault": {
    title: "Freelancer Contract Clause Library – ClauseRadar",
    description: "Copy-paste contractor-friendly clauses for payment security, IP retention, kill fees and capped liability.",
    index: true, priority: "0.6",
  },
  "/privacy": {
    title: "Privacy Policy – ClauseRadar",
    description: "How ClauseRadar handles your contracts, account data and payment records.",
    index: true, priority: "0.3",
  },
  "/terms": {
    title: "Terms of Service – ClauseRadar",
    description: "The terms for using ClauseRadar, including the not-legal-advice disclaimer.",
    index: true, priority: "0.3",
  },
  "/account": {
    title: "Account – ClauseRadar",
    description: "Your ClauseRadar account and credit balance.",
    index: false, priority: "0.1",
  },
};
`);

F("src/lib/data.mjs", String.raw`export const PLANS = [
  { id: "pro_month", name: "Pro Monthly", price: 499, days: 30, per: "month", popular: false },
  { id: "pro_year", name: "Pro Yearly", price: 3999, days: 365, per: "year", popular: true, badge: "Save 33%" },
];

export const PACKS = [
  { id: 1, credits: 1, price: 49, icon: "⚡", name: "Single Audit Pass", popular: false,
    features: ["1 full contract unlock", "Safer rewrite for every flagged clause", "Counter-proposal emails + PDF report"] },
  { id: 3, credits: 3, price: 129, icon: "🛡️", name: "Freelancer Shield Pack", popular: true,
    features: ["3 full contract unlocks", "Save ₹18 versus single passes", "Counter-proposal emails + PDF report"] },
  { id: 8, credits: 8, price: 299, icon: "👑", name: "Agency Pack", popular: false,
    features: ["8 full contract unlocks", "Lowest price per contract", "Built for agencies and teams"] },
];

export const FREE_FEATURES = [
  "Full contract scans with risk score preview",
  "1 active project in Contract Memory",
  "3 Scope Guard checks per month",
  "1 active invoice in Payment Chaser",
  "1 device at a time",
];

export const PRO_FEATURES = [
  "Unlimited contract audits with all safer rewrites unlocked",
  "Unlimited Scope Guard checks and change-order quotes",
  "Unlimited invoices with the full legal escalation letters",
  "PDF report exports for every audit",
  "Use ClauseRadar on up to 3 devices at the same time",
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
};

export const VAULT_CATS = ["All", "Payment", "IP", "Liability", "Scope", "Termination"];
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
      { h: "Account data", p: ["If you create an account we store your email address, your plan and Pro end date, and any leftover credit balance from earlier purchases. Sign-in is handled by Supabase Authentication, and we never see your password. If you choose Continue with Google, Google shares your email address and name with our authentication provider, and we store only your email address."] },
      { h: "Contract Memory (optional)", p: [
        "Contract Memory is off by default. If you choose Save to Contract Memory after a scan, we read your contract once to suggest structured terms (project and client name, payment days, revision cap, hourly rate, liability cap, scope deliverables) and up to four short clause excerpts of at most 400 characters each. You review and edit these before saving. Only what you approve is stored, and the full contract is never stored.",
        "Scope Guard sends the client message you paste, together with your saved terms, to our AI provider to produce a verdict. We do not store the client message; we keep only a usage record (the verdict and the date) to apply the Free plan monthly limit. Invoices you add to Payment Chaser are stored with their amounts and dates. You can delete any project or invoice at any time.",
      ] },
      { h: "Devices", p: ["To apply the device limit (1 device at a time on Free, up to 3 on Pro) we store a random device identifier, a short device label such as Chrome on Android, and the time it was last active. You can sign out any device from your Account page."] },
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
        "Credits bought before the Pro plan launched remain valid for unlocking audits on the Free plan. Credits have no cash value.",
        "Pro may be used on up to 3 devices at the same time and Free on 1; we may sign out devices above the limit.",
        "If something goes wrong with a payment or an unlock, contact " + CONTACT_EMAIL + " and we will review it.",
      ] },
      { h: "Your content", p: ["You keep all rights in the contracts you submit. The suggested clauses and emails are provided for you to use and adapt."] },
      { h: "Disclaimers and limits of liability", p: ["The service is provided as is, without warranties of any kind. To the extent permitted by law, our total liability for any claim is limited to the amount you paid us in the 12 months before the claim."] },
      { h: "Governing law", p: ["These terms are governed by the laws of India."] },
      { h: "Changes and contact", p: ["We may update these terms and will change the date above when we do. Contact: " + CONTACT_EMAIL + "."] },
    ],
  },
};
`);

F("scripts/seo-content.mjs", String.raw`import { ROUTE_META, SITE, BRAND, OG_IMAGE } from "../src/lib/meta.mjs";
import { PLANS, FREE_FEATURES, PRO_FEATURES, BENTO, FAQS, SAMPLE_REPORT, VAULT } from "../src/lib/data.mjs";
import { LEGAL } from "../src/lib/legal.mjs";

export function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
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
    const ld = {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: BRAND,
      url: SITE,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description: m.description,
      offers: { "@type": "AggregateOffer", priceCurrency: "INR", lowPrice: "499", highPrice: "3999", offerCount: String(PLANS.length) },
    };
    h += '<script type="application/ld+json">' + JSON.stringify(ld) + "</script>\n";
  }
  return h;
}

const BTN = "display:inline-block;padding:11px 20px;border-radius:12px;font-weight:600;text-decoration:none;margin:4px 8px 4px 0;";
const NAVLINKS = [["/", "Home"], ["/dashboard", "Scanner"], ["/scope-guard", "Scope Guard"], ["/chaser", "Payment Chaser"], ["/sample", "Sample report"], ["/pricing", "Pricing"], ["/radar", "Risk calculator"], ["/vault", "Clause library"], ["/privacy", "Privacy"], ["/terms", "Terms"]];

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

function homeShell() {
  let h = '<p style="display:inline-block;padding:4px 12px;border-radius:999px;background:#eef2ff;color:#3730a3;font-size:14px;font-weight:600">Introducing ClauseRadar – Protect your freelance income &amp; liability</p>';
  h += h1("Audit client contracts in 30 seconds. Stop uncapped liability before you sign.");
  h += para("ClauseRadar reads your client agreement, flags uncapped liability, Net-60 and Net-90 payment traps and IP grabs, explains each risk in plain English, and writes the counter-proposal email for you.");
  h += "<p>" + cta("/dashboard", "Upload Contract", true) + cta("/sample", "View Sample Audit Report", false) + "</p>";
  BENTO.forEach(function (b) { h += sec(b.title, [b.text]); });
  h += sec("Zero contract training", ["We never use your agreements to train models, and scans are not stored by default. If you opt in to Contract Memory, we save only the terms and short clause excerpts you review. Contract text is processed by third-party AI providers under their API terms."]);
  h += '<h2 style="font-size:22px;margin:28px 0 6px">Frequently asked questions</h2>';
  FAQS.forEach(function (f) { h += '<h3 style="font-size:17px;margin:16px 0 4px">' + esc(f.q) + "</h3>" + para(f.a); });
  return wrap(h);
}

export function shellHtml(p) {
  if (p === "/") return homeShell();
  if (p === "/sample") {
    let h = h1("Sample contract audit report") + para("An interactive example of a ClauseRadar audit for " + SAMPLE_REPORT.title + ". Overall risk: " + SAMPLE_REPORT.level + " (" + SAMPLE_REPORT.score + "/100). " + SAMPLE_REPORT.summary);
    SAMPLE_REPORT.clauses.forEach(function (c) { h += sec(c.category.replace(/_/g, " ") + " – " + c.risk_level + " risk", [c.problematic_fine_print, c.why_it_hurts]); });
    return wrap(h + "<p>" + cta("/dashboard", "Scan your own contract", true) + "</p>");
  }
  if (p === "/dashboard") {
    return wrap(h1("Contract scanner") + para("Upload a PDF or DOCX, or paste contract text. ClauseRadar flags liability, payment terms, scope creep, IP rights and termination risks, explains each one in plain English and suggests a safer rewrite.") + "<p>" + cta("/sample", "View Sample Audit Report", false) + "</p>");
  }
  if (p === "/pricing") {
    let h = h1("Pricing") + para("Scanning is free. Go Pro to unlock every safer rewrite, Scope Guard, Payment Chaser, PDF reports and use on up to 3 devices.");
    h += sec("Free", FREE_FEATURES);
    h += sec("Pro", PRO_FEATURES);
    PLANS.forEach(function (k) { h += sec(k.name + " – ₹" + k.price + " per " + k.per, ["Each verified UPI payment adds " + k.days + " days of Pro."]); });
    return wrap(h);
  }
  if (p === "/scope-guard") {
    return wrap(h1("Scope Guard") + para("Paste the client's quick tweak message. Find out in seconds if it is in scope, billable or a grey area. You get the exact contract clause, a polite ready-to-send reply, a change-order quote and a revision meter.") + "<p>" + cta("/dashboard", "Scan a contract first", true) + "</p>");
  }
  if (p === "/chaser") {
    return wrap(h1("Payment Chaser") + para("The contract says Net-30 and the client is on day 41. Track each invoice against your contract's payment terms and get an escalation sequence: a friendly reminder, a firm reminder quoting the late-fee clause, and a formal demand notice.") + "<p>" + cta("/dashboard", "Scan a contract first", true) + "</p>");
  }
  if (p === "/radar") {
    return wrap(h1("Freelance contract risk calculator") + para("Enter your project fee, payment terms, liability, IP transfer and revision limits to estimate what late payment, unpaid revisions and uncapped liability could cost you."));
  }
  if (p === "/vault") {
    let h = h1("Freelancer contract clause library") + para("Contractor-friendly clauses you can copy and adapt. Have a lawyer review high-value deals.");
    VAULT.forEach(function (v) { h += sec(v.title, [v.text]); });
    return wrap(h);
  }
  if (p === "/privacy" || p === "/terms") {
    const L = LEGAL[p.slice(1)];
    let h = h1(L.title) + para("Last updated " + L.updated + ".");
    L.sections.forEach(function (s) { h += sec(s.h, s.p); });
    return wrap(h);
  }
  return wrap(h1("ClauseRadar account") + para("Sign in to see your credit balance."));
}
`);

F("scripts/prerender.mjs", String.raw`import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ROUTE_META, SITE } from "../src/lib/meta.mjs";
import { headTags, shellHtml } from "./seo-content.mjs";

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

const paths = Object.keys(ROUTE_META);
for (const p of paths) {
  const html = swapShell(swapHead(tpl, headTags(p)), shellHtml(p));
  const out = p === "/" ? tplPath : path.join(dist, p.slice(1), "index.html");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, html, "utf8");
}

const today = new Date().toISOString().slice(0, 10);
const urls = paths.filter(function (p) { return ROUTE_META[p].index; }).map(function (p) {
  return "  <url><loc>" + SITE + (p === "/" ? "/" : p) + "</loc><lastmod>" + today + "</lastmod><changefreq>weekly</changefreq><priority>" + ROUTE_META[p].priority + "</priority></url>";
});
fs.writeFileSync(path.join(dist, "sitemap.xml"), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls.join("\n") + "\n</urlset>\n", "utf8");
fs.writeFileSync(path.join(dist, "robots.txt"), "User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /account\n\nSitemap: " + SITE + "/sitemap.xml\n", "utf8");

console.log("prerender: wrote " + paths.length + " pages, sitemap.xml and robots.txt");
`);

// ---------------------------------------------------------------------------
// Pre-flight checks & Installer
// ---------------------------------------------------------------------------
function sh(cmd, cwd) {
  console.log("\n$ " + cmd);
  execSync(cmd, { stdio: "inherit", cwd: cwd });
}

async function main() {
  const root = process.cwd();
  const BACKUP = path.join(root, ".safeclause-backup", "cr-" + new Date().toISOString().replace(/[:.]/g, "-"));

  if (!fs.existsSync(path.join(root, "package.json")) || !fs.existsSync(path.join(root, "src")) || !fs.existsSync(path.join(root, "index.html"))) {
    console.error("ERROR: run this from the project root.");
    process.exit(1);
  }

  // Backup files
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

  Object.keys(FILES).forEach(function (rel) { put(rel, FILES[rel]); });

  try {
    sh("npm run build", root);
  } catch (e) {
    console.error("\nBUILD FAILED: " + (e && e.message ? e.message : e));
    process.exit(1);
  }

  console.log("\nBuild OK. Pushing updates...");
  try {
    sh("git add -A", root);
    sh('git commit -m "ClauseRadar v3: add Scope Guard, Payment Chaser, and Pro Subscription"', root);
    sh("git push --force-with-lease origin main", root);
    console.log("\nPushed successfully! Vercel is deploying now.");
  } catch (e) {
    console.log("Git push completed or skipped.");
  }
}

main().catch(console.error);
