// clauseradar-v4.mjs
// Run from the project root in Termux:  node clauseradar-v4.mjs
// Adds Contract Memory, Scope Guard and Payment Chaser, and replaces credit packs with a Pro plan
// (Rs 499/month or Rs 3,999/year, paid by UPI, 3 devices). Keeps every existing route, API and design token.
// Re-runnable over v2. Pre-flight (syntax, imports, prerender dry-run) happens in a staging folder first,
// and everything is rolled back if the build fails. After deploying, run supabase-v3.sql once in Supabase.
// Fixes over the first v3: side gutters on every page, PACKS compatibility export, nav links, plan pricing page,
// accessible modal backdrops. Pre-flight only runs node --check, an index.html template check and a prerender
// dry-run; "npm run build" is the single source of truth for compiling the Svelte components.

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
F("src/lib/meta.mjs", String.raw`export const SITE = "https://clauseradar.online";
export const BRAND = "ClauseRadar";
// Shown on the Privacy and Terms pages. Change it if this mailbox does not exist.
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

// Legacy alias so any older import of PACKS keeps building. The UI no longer sells credit packs.
export const PACKS = PLANS.map(function (p) {
  return { id: p.id, credits: 0, price: p.price, icon: "⚡", name: p.name, popular: !!p.popular, features: [] };
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
// ---------------------------------------------------------------------------
// Build-time SEO: static head tags + static body copy per route
// ---------------------------------------------------------------------------
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

F("scripts/prerender.mjs", String.raw`// Runs after "vite build". Writes one static HTML file per route plus robots.txt and sitemap.xml.
import fs from "node:fs";
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
// Design system (STRICT mobile-first: base rules are the phone layout,
// min-width media queries add the tablet and desktop layouts)
// ---------------------------------------------------------------------------
F("src/lib/styles.css", String.raw`:root{color-scheme:light;background-color:#f8fafc;color:#0f172a;--bg:#f8fafc;--surface:#fff;--ink:#0f172a;--ink2:#334155;--muted:#475569;--line:#e2e8f0;--indigo:#4f46e5;--indigo-soft:#eef2ff;--rose:#e11d48;--rose-bg:#fff1f2;--amber:#b45309;--amber-bg:#fffbeb;--green:#047857;--green-bg:#ecfdf5;--nav-h:56px}
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;text-size-adjust:100%;scroll-behavior:smooth;margin:0;padding:0;width:100%;max-width:100%}
@supports (overflow-x:clip){html{overflow-x:clip}}
body{display:block;place-items:initial;min-width:0;min-height:100vh;margin:0;padding:0;max-width:100%;width:100%;overflow-x:hidden;overflow-x:clip;background:var(--bg);color:var(--ink);font-family:Inter,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;font-size:16px;line-height:1.6;-webkit-font-smoothing:antialiased;overflow-wrap:break-word}
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

/* navbar: phone = logo + credit badge + hamburger; desktop = links */
.nav{position:sticky;top:0;z-index:50;background:rgba(255,255,255,.96);backdrop-filter:saturate(180%) blur(14px);-webkit-backdrop-filter:saturate(180%) blur(14px);border-bottom:1px solid var(--line)}
.nav-in{max-width:1120px;margin:0 auto;padding:0 16px;height:var(--nav-h);display:flex;align-items:center;justify-content:space-between;gap:10px}
.brand{display:flex;align-items:center;gap:8px;font-weight:800;font-size:1.125rem;letter-spacing:-.02em;text-decoration:none;white-space:nowrap;color:#0f172a}
.nav-links,.nav-desktop{display:none}
.nav-right{display:flex;align-items:center;gap:8px}
.credit{display:inline-flex;gap:5px;align-items:center;min-height:36px;padding:4px 12px;border-radius:999px;border:1px solid #c7d2fe;background:var(--indigo-soft);color:#3730a3;font-size:.9375rem;text-decoration:none;font-weight:600;white-space:nowrap}
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
.tier{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;margin-top:18px}
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
.credit.pro{background:linear-gradient(135deg,#4f46e5,#c026d3);border-color:transparent;color:#fff}
@media(min-width:1024px){.nav-links a.opt{display:none}}
@media(min-width:1280px){.nav-links a.opt{display:inline-flex}}
.rev{height:10px;border-radius:999px;background:#e2e8f0;overflow:hidden;margin:4px 0 2px}
.rev-fill{height:100%;background:linear-gradient(90deg,#10b981,#f59e0b);border-radius:999px;transition:width .4s}
.rev-fill.full{background:#e11d48}
.dev{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 0;border-bottom:1px solid var(--line)}
.lvl{margin-top:14px;padding:12px;border:1px solid var(--line);border-radius:12px;background:#fff}
.lvl.sug{border-color:#818cf8;box-shadow:0 6px 20px rgba(79,70,229,.1)}
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
export const profile = writable({ credits: 0, pro_until: null, pro_plan: null, loaded: false });
export const credits = derived(profile, function (p) { return p.credits; });
export const isPro = derived(profile, function (p) { return !!(p.pro_until && new Date(p.pro_until).getTime() > Date.now()); });
export const deviceState = writable({ blocked: false, revoked: false, devices: [], limit: 1, plan: "free", loaded: false });
export const authModal = writable({ open: false, mode: "login", note: "" });
export const payModal = writable({ open: false, planId: "pro_year" });
export const showRecovery = writable(false);
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
    let r = await sb.from("profiles").select("credits,pro_until,pro_plan").eq("id", uid).maybeSingle();
    if (r.error) r = await sb.from("profiles").select("credits").eq("id", uid).maybeSingle();
    const d = r.data || {};
    profile.set({ credits: Number.isFinite(d.credits) ? d.credits : 0, pro_until: d.pro_until || null, pro_plan: d.pro_plan || null, loaded: true });
  } catch (e) {}
}
export const refreshCredits = refreshProfile;

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
      syncDevice("register");
      beat = setInterval(function () { if (document.visibilityState === "visible") syncDevice("register"); }, 4 * 60 * 1000);
    } else {
      profile.set({ credits: 0, pro_until: null, pro_plan: null, loaded: false });
      deviceState.set({ blocked: false, revoked: false, devices: [], limit: 1, plan: "free", loaded: false });
    }
  });
  let authSub = null;
  if (sb) {
    sb.auth.getSession().then(function (r) { session.set(r.data ? r.data.session : null); });
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

export function perContract(p) {
  return Math.round(p.price / (p.credits || 1));
}

/* ---------- Contract Memory: projects and invoices (Supabase, row-level security) ---------- */
export const projects = writable([]);
export const invoices = writable([]);

function friendly(e) {
  const m = String((e && e.message) || e || "");
  if (m.indexOf("FREE_LIMIT_PROJECTS") !== -1) return new Error("The Free plan allows 1 active project. Upgrade to Pro for unlimited projects.");
  if (m.indexOf("FREE_LIMIT_INVOICES") !== -1) return new Error("The Free plan allows 1 active invoice. Mark it paid or upgrade to Pro for unlimited invoices.");
  if (m.indexOf("PGRST205") !== -1 || m.indexOf("does not exist") !== -1 || m.indexOf("schema cache") !== -1) {
    return new Error("Contract Memory is not set up yet. Run supabase-v3.sql in the Supabase SQL Editor.");
  }
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
  if (!r.error) projects.set(r.data || []);
}

export async function saveProject(rec) {
  const u = need();
  const r = await sb.from("projects").insert(Object.assign({}, rec, { user_id: u.id })).select().single();
  if (r.error) throw friendly(r.error);
  await loadProjects();
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
  if (!r.error) invoices.set(r.data || []);
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

F("src/lib/Nav.svelte", String.raw`<script>
  import { route, user, credits, link, openAuth, openPay } from "./app.js";

  let open = false;
  const LINKS = [["/dashboard", "Scanner"], ["/sample", "Sample report"], ["/radar", "Risk calculator"], ["/vault", "Clause library"], ["/pricing", "Pricing"]];

  $: initial = $user && $user.email ? $user.email.charAt(0).toUpperCase() : "";
  $: short = $credits >= 10000 ? Math.floor($credits / 100) / 10 + "k" : String($credits);

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
        <a href={l[0]} class:active={$route === l[0]} on:click={(e) => nav(e, l[0])}>{l[1]}</a>
      {/each}
    </nav>

    <div class="nav-right">
      <a class="credit" href="/pricing" title={$credits + " credits"} on:click={(e) => nav(e, "/pricing")}>⚡ <b class="num">{short}</b></a>
      <div class="nav-desktop">
        <button class="btn sm" on:click={() => openPay(1)}>Buy credits</button>
        {#if $user}
          <a class="avatar" href="/account" title={$user.email} on:click={(e) => nav(e, "/account")}>{initial}</a>
        {:else}
          <button class="btn sm primary" on:click={() => openAuth("login")}>Log in</button>
        {/if}
      </div>
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
      <button class="mi" on:click={() => act(() => openPay(1))}>⚡ Buy credits</button>
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

F("src/lib/Footer.svelte", String.raw`<script>
  import { link } from "./app.js";
  import DisclaimerBanner from "./DisclaimerBanner.svelte";
  const LINKS = [["/dashboard", "Scanner"], ["/scope-guard", "Scope Guard"], ["/chaser", "Payment Chaser"], ["/sample", "Sample report"], ["/pricing", "Pricing"], ["/radar", "Risk calculator"], ["/vault", "Clause library"], ["/privacy", "Privacy"], ["/terms", "Terms"]];
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
  import { sb, user, deviceState, authModal, payModal, showRecovery, authHeaders, readJson, copyToClipboard, refreshProfile, revokeDevice, syncDevice, markFreshLogin, UPI_ID, fmtDate } from "./app.js";
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
        body: JSON.stringify({ image: b64, mime: "image/jpeg", plan: plan.id }),
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
  import { link } from "../lib/app.js";
  import { BENTO, FAQS } from "../lib/data.mjs";
  import DemoViewer from "../lib/DemoViewer.svelte";
  const ICONS = ["🛡️", "⏳", "🔐", "✉️"];
</script>

<section class="hero-bg">
  <div class="wrap hero">
    <a class="pill" href="/sample" on:click={(e) => link(e, "/sample")}>✨ Introducing ClauseRadar – Protect your freelance income &amp; liability <span aria-hidden="true">→</span></a>
    <h1 class="display">Audit client contracts in 30 seconds. <span class="grad">Stop uncapped liability before you sign.</span></h1>
    <p class="lead">ClauseRadar reads your client agreement, flags uncapped liability, Net-60 and Net-90 payment traps and IP grabs, explains each risk in plain English, and writes the counter-proposal email for you.</p>
    <div class="cta">
      <a class="btn primary lg" href="/dashboard" on:click={(e) => link(e, "/dashboard")}>Upload Contract</a>
      <a class="btn lg" href="/sample" on:click={(e) => link(e, "/sample")}>View Sample Audit Report</a>
    </div>
    <p class="small muted">Free scan • Pay only to unlock rewrites • PDF, DOCX or pasted text</p>
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

F("src/pages/Pricing.svelte", String.raw`<script>
  import { openPay, perContract } from "../lib/app.js";
  import { PACKS } from "../lib/data.mjs";

  const STEPS = [
    ["1", "Tap to pay", "Choose a pack and tap the UPI button. GPay, PhonePe or Paytm opens with the amount filled in."],
    ["2", "Capture the success screen", "Take a screenshot showing the amount, receiver and transaction ID."],
    ["3", "Upload and verify", "Upload it in the payment window. AI checks the details and adds your credits."],
  ];
</script>

<div class="wrap page">
  <div class="center">
    <h1 class="h2">Scan free. <span class="grad">Pay only to unlock.</span></h1>
    <p class="lead">No subscription. 1 credit = 1 full contract unlock.</p>
  </div>

  <div class="tier narrow" style="margin-left:auto;margin-right:auto">
    <div class="card">
      <b>Free scan</b>
      <div class="price num">₹0</div>
      <ul class="feat">
        <li>Overall risk score (0-100)</li>
        <li>Flags by category and severity</li>
        <li>Exact clause quotes with redline highlights</li>
        <li>Plain-English explanation of each risk</li>
      </ul>
    </div>
    <div class="card iri">
      <b>Full unlock</b>
      <div class="price num">from ₹49</div>
      <ul class="feat">
        <li>Everything in the free scan</li>
        <li>Suggested safer rewrite for every clause</li>
        <li>Counter-proposal emails, ready to send</li>
        <li>PDF report export</li>
      </ul>
    </div>
  </div>

  <div class="packs">
    {#each PACKS as p}
      <div class="pack" class:popular={p.popular}>
        {#if p.popular}<span class="ribbon">Most popular</span>{/if}
        <div style="font-size:1.7rem">{p.icon}</div>
        <b>{p.name}</b>
        <div class="price num">₹{p.price}</div>
        <p class="muted small">{p.credits} credit{p.credits === 1 ? "" : "s"} • ₹{perContract(p)} per contract</p>
        <ul class="feat">{#each p.features as f}<li>{f}</li>{/each}</ul>
        <button class="btn primary block" on:click={() => openPay(p.id)}>Tap to Pay with UPI ⚡</button>
      </div>
    {/each}
  </div>

  <h2 class="h2 center" style="margin-top:48px">How UPI payment works</h2>
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
  import { user, credits, isPro, profile, MAX_CHARS, authHeaders, readJson, openAuth, openPay, deriveScore, catLabel, fmt, refreshProfile } from "../lib/app.js";
  import { SAMPLE_CONTRACTS } from "../lib/data.mjs";
  import { openReport } from "../lib/report.js";
  import ClauseCard from "../lib/ClauseCard.svelte";
  import MemorySave from "../lib/MemorySave.svelte";
  import RiskBadge from "../lib/RiskBadge.svelte";
  import RiskGauge from "../lib/RiskGauge.svelte";
  import DisclaimerBanner from "../lib/DisclaimerBanner.svelte";

  const MAX_FILE = 10 * 1024 * 1024;
  const STEPS = ["Reading your document", "Detecting risky clauses", "Scoring severity", "Drafting safer rewrites"];

  let jur = "india";
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
  $: unlockLabel = $isPro ? "Unlock All Clauses (Pro) ⚡" : $credits >= 1 ? "Use 1 Credit to Unlock All Clauses (Balance: " + $credits + ") ⚡" : "Upgrade to Pro to Unlock All Clauses ⚡";

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

  function loadSample(key) {
    text = SAMPLE_CONTRACTS[key];
    jur = key === "india" ? "india" : "global";
    fileInfo = null;
    error = "";
  }

  /* ---------- scan ---------- */
  // The jurisdiction is passed to the AI as a short note placed before the contract text.
  function jurisdictionNote() {
    if (jur === "india") {
      return "[AUDITOR NOTE - not part of the contract: the freelancer works under Indian law. Consider the Indian Contract Act 1872 (for example restraint-of-trade clauses) and MSMED Act 2006 payment-period norms (45 days) when judging risk and writing counter-clauses. Never quote this note.]\n\n";
    }
    return "[AUDITOR NOTE - not part of the contract: the freelancer works remotely under US, UK or international terms. Prefer standard Net-14 or Net-30 payment, IP assignment only after full payment, and a liability cap equal to fees paid. Never quote this note.]\n\n";
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
        body: JSON.stringify({ text: payload, jurisdiction: jur }),
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

  // Pro (or 1 legacy credit) unlocks EVERY flagged clause of this audit in a single request.
  async function unlockAll() {
    error = "";
    if (!$user) { openAuth("login", "Log in to unlock. Pro and your account are saved across devices."); return; }
    if (!$isPro && $credits < 1) { openPay("pro_year"); return; }
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
      if ($user) refreshProfile($user.id);
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
      <button class="btn sm mfull" on:click={() => loadSample("india")}>Sample India</button>
      <button class="btn sm mfull" on:click={() => loadSample("us")}>Sample US</button>
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

    {#if flagged.length > 0 && !allUnlocked}
      <section class="card" style="border-color:#c7d2fe;background:#f5f7ff">
        <b>Unlock all {flagged.length} safer rewrites</b>
        <p class="muted small" style="margin:4px 0 12px">Includes every counter-proposal email. Pro also adds PDF reports, Scope Guard and Payment Chaser.</p>
        <button class="btn primary block" on:click={unlockAll} disabled={unlocking}>{unlocking ? "Unlocking all clauses..." : unlockLabel}</button>
        {#if unlockError}<div class="error" role="alert">⚠️ {unlockError}</div>{/if}
      </section>
    {/if}

    {#if flagged.length > 0}
      <MemorySave text={text} jur={jur} />
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
    <div style="margin-top:18px"><DisclaimerBanner /></div>
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

F("src/pages/Account.svelte", String.raw`<script>
  import { sb, user, credits, go, openAuth, openPay, refreshCredits } from "../lib/app.js";

  async function signOut() {
    if (sb) await sb.auth.signOut();
    go("/");
  }
  $: initial = $user && $user.email ? $user.email.charAt(0).toUpperCase() : "";
</script>

<div class="wrap narrow page">
  <h1 class="h2">Account</h1>
  <section class="card">
    {#if !sb}
      <div class="error">Login is not configured yet. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then redeploy.</div>
    {:else if $user}
      <div class="row" style="gap:14px;margin-bottom:14px">
        <span class="avatar" style="width:52px;height:52px;font-size:1.3rem">{initial}</span>
        <div>
          <div class="pre"><b>{$user.email}</b></div>
          <div class="num" style="font-size:1.4rem;font-weight:800">⚡ {$credits} credit{$credits === 1 ? "" : "s"}</div>
        </div>
      </div>
      <div class="row">
        <button class="btn primary mfull" on:click={() => openPay(1)}>Buy credits</button>
        <button class="btn mfull" on:click={() => refreshCredits($user.id)}>Refresh balance</button>
        <button class="btn mfull" on:click={signOut}>Sign out</button>
      </div>
    {:else}
      <p class="muted">Log in to save your credits and unlock rewrites on any device.</p>
      <div class="row">
        <button class="btn primary mfull" on:click={() => openAuth("login")}>Log in</button>
        <button class="btn mfull" on:click={() => openAuth("signup")}>Create account</button>
      </div>
    {/if}
  </section>
</div>
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
// ---------------------------------------------------------------------------
// v3 server files (written with the right module format for your project) + SQL
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
    const rows = await sbFetch("profiles?id=eq." + enc(userId) + "&select=credits,pro_until");
    return rows && rows[0] ? rows[0] : null;
  } catch (e) {
    try {
      const rows2 = await sbFetch("profiles?id=eq." + enc(userId) + "&select=credits");
      return rows2 && rows2[0] ? rows2[0] : null;
    } catch (e2) {
      return null;
    }
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

A("api/unlock.js", String.raw`__CRYPTO_IMPORT__// api/unlock.js - server-side paywall. Pro unlocks without limits; legacy credit holders spend 1 credit per audit.

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
    const rows = await sbFetch("profiles?id=eq." + enc(userId) + "&select=credits,pro_until");
    return rows && rows[0] ? rows[0] : null;
  } catch (e) {
    try {
      const rows2 = await sbFetch("profiles?id=eq." + enc(userId) + "&select=credits");
      return rows2 && rows2[0] ? rows2[0] : null;
    } catch (e2) {
      return null;
    }
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

// Legacy credits: read, then PATCH only if the balance is unchanged (compare-and-swap).
async function spendOneCredit(userId) {
  const id = enc(userId);
  for (let attempt = 0; attempt < 4; attempt++) {
    const rows = await sbFetch("profiles?id=eq." + id + "&select=credits");
    const current = rows && rows[0] ? Number(rows[0].credits) : NaN;
    if (!isFinite(current)) return { ok: false, reason: "noprofile" };
    if (current < 1) return { ok: false, reason: "nocredits" };
    const updated = await sbFetch("profiles?id=eq." + id + "&credits=eq." + current, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ credits: current - 1 }),
    });
    if (Array.isArray(updated) && updated.length === 1) return { ok: true, credits: current - 1 };
  }
  return { ok: false, reason: "busy" };
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
    const profile = await getProfile(user.id);
    const pro = proActive(profile);
    const gate = await deviceGate(user.id, req.headers["x-device-id"], pro);
    if (!gate.ok) return deviceFail(res, gate);

    // Decrypt EVERYTHING first. If any token is bad, nothing is charged.
    const items = [];
    for (let i = 0; i < tokens.length; i++) {
      const locked = unseal(tokens[i]);
      if (!locked || !locked.c) return res.status(400).json({ error: "Invalid unlock token (clause " + (i + 1) + "). Run the audit again." });
      if (Date.now() - Number(locked.t || 0) > MAX_AGE_MS) return res.status(400).json({ error: "This unlock token expired. Run the audit again." });
      items.push({ index: i, safe_counter_clause: locked.c, polite_client_negotiation_email: locked.e });
    }

    let credits = profile && isFinite(Number(profile.credits)) ? Number(profile.credits) : 0;
    if (!pro) {
      const spent = await spendOneCredit(user.id);
      if (!spent.ok) {
        if (spent.reason === "busy") return res.status(503).json({ error: "Server is busy. Please try again." });
        return res.status(402).json({ error: "Upgrade to Pro to unlock safer rewrites and counter-proposal emails.", code: "UPGRADE" });
      }
      credits = spent.credits;
    }
    const out = { success: true, unlocked: items, credits: credits, plan: pro ? "pro" : "free" };
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
    const rows = await sbFetch("profiles?id=eq." + enc(userId) + "&select=credits,pro_until");
    return rows && rows[0] ? rows[0] : null;
  } catch (e) {
    try {
      const rows2 = await sbFetch("profiles?id=eq." + enc(userId) + "&select=credits");
      return rows2 && rows2[0] ? rows2[0] : null;
    } catch (e2) {
      return null;
    }
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
      return res.status(500).json({ error: "Contract Memory is not set up yet. Run supabase-v3.sql in Supabase." });
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
    const rows = await sbFetch("profiles?id=eq." + enc(userId) + "&select=credits,pro_until");
    return rows && rows[0] ? rows[0] : null;
  } catch (e) {
    try {
      const rows2 = await sbFetch("profiles?id=eq." + enc(userId) + "&select=credits");
      return rows2 && rows2[0] ? rows2[0] : null;
    } catch (e2) {
      return null;
    }
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
    const until = await rpc("redeem_pro", {
      p_user: user.id, p_txn: txn, p_hash: hash, p_amount: pack.amount, p_days: pack.days, p_plan: planId,
    });
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

<section class="card">
  <b>Save to Contract Memory (Active Project)</b>
  {#if step === "idle" || step === "reading"}
    <p class="muted small" style="margin:6px 0 12px">Optional. We suggest the key terms from this contract (payment days, revision cap, scope, rates). You review and edit them before anything is saved. Your full contract is never stored. This powers Scope Guard and Payment Chaser.</p>
    <button class="btn primary block" on:click={start} disabled={step === "reading"}>{step === "reading" ? "Reading contract terms..." : "Save to Contract Memory (Active Project)"}</button>
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
    <div class="ok">✅ Saved. Your project is now active.</div>
    <div class="row" style="margin-top:12px">
      <a class="btn primary mfull" href="/scope-guard" on:click={(e) => link(e, "/scope-guard")}>Open Scope Guard</a>
      <a class="btn mfull" href="/chaser" on:click={(e) => link(e, "/chaser")}>Open Payment Chaser</a>
    </div>
  {/if}
  {#if error}<div class="error" role="alert">⚠️ {error}</div>{/if}
  {#if upgrade}<button class="btn primary block" style="margin-top:10px" on:click={() => openPay("pro_year")}>Upgrade to Pro ⚡</button>{/if}
</section>
`);

F("src/pages/ScopeGuard.svelte", String.raw`<script>
  import { user, isPro, authHeaders, readJson, openAuth, openPay, link, copyToClipboard, fmt, projects, loadProjects, updateProject, scopeUsage } from "../lib/app.js";
  import DisclaimerBanner from "../lib/DisclaimerBanner.svelte";

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
  $: if (!projectId && $projects.length) projectId = $projects[0].id;
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
  <div style="margin-top:18px"><DisclaimerBanner /></div>
</div>
`);
// ---------------------------------------------------------------------------
// v3: Payment Chaser, Pricing, Account, Nav, App shell
// ---------------------------------------------------------------------------
F("src/pages/Chaser.svelte", String.raw`<script>
  import { user, isPro, openAuth, openPay, link, copyToClipboard, projects, invoices, loadProjects, loadInvoices, saveInvoice, markInvoicePaid, deleteInvoice } from "../lib/app.js";
  import DisclaimerBanner from "../lib/DisclaimerBanner.svelte";

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
  $: if (!projectId && $projects.length) projectId = $projects[0].id;
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
  <div style="margin-top:18px"><DisclaimerBanner /></div>
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
  import { sb, user, isPro, profile, deviceState, openAuth, openPay, refreshProfile, syncDevice, revokeDevice, signOutThisDevice, fmtDate, projects, invoices, loadProjects, loadInvoices, deleteProject, scopeUsage } from "../lib/app.js";

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
        <p style="margin:0 0 4px">Pro is active until <b>{fmtDate($profile.pro_until)}</b>.</p>
        <p class="muted small" style="margin:0 0 12px">Renewal is manual: pay again before this date to extend. Automatic renewal is not enabled yet.</p>
      {:else}
        <p class="muted" style="margin:0 0 12px">You are on the Free plan. Go Pro to unlock every rewrite, unlimited Scope Guard and Payment Chaser, PDF exports and 3 devices.</p>
      {/if}
      {#if $profile.credits > 0}<p class="muted small" style="margin:0 0 12px">Legacy credits: <b class="num">{$profile.credits}</b> (still usable to unlock audits on the Free plan).</p>{/if}
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
  import { route, user, isPro, link, openAuth, openPay, signOutThisDevice } from "./app.js";

  let open = false;
  // opt = secondary links: always in the mobile menu, shown on very wide desktops only
  const LINKS = [
    ["/dashboard", "Scanner", false], ["/scope-guard", "Scope Guard", false], ["/chaser", "Payment Chaser", false],
    ["/sample", "Sample Report", false], ["/pricing", "Pricing", false],
    ["/radar", "Risk calculator", true], ["/vault", "Clause library", true],
  ];

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
      <a class="credit" class:pro={$isPro} href="/pricing" title={$isPro ? "Pro plan" : "Free plan. Tap to upgrade"} on:click={(e) => nav(e, "/pricing")}><span class="pl-pre">Plan: </span><b>{$isPro ? "Pro ⚡" : "Free"}</b></a>
      <div class="nav-desktop">
        {#if !$isPro}<button class="btn sm primary" on:click={() => openPay("pro_year")}>Upgrade</button>{/if}
        {#if $user}
          <a class="avatar" href="/account" title={$user.email} on:click={(e) => nav(e, "/account")}>{initial}</a>
        {:else}
          <button class="btn sm" on:click={() => openAuth("login")}>Log in</button>
        {/if}
      </div>
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
    '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />',
    "<style>html,body{margin:0;background:#f8fafc}</style>",
    '<meta name="seo-start" content="1" />',
    headStr.trim(),
    '<meta name="seo-end" content="1" />',
    "</head>",
    "<body>",
    '<seo-shell id="seo-shell" style="display:block">' + shellStr + "</seo-shell>",
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

function exportedNames(src) {
  const names = new Set();
  for (const m of src.matchAll(/export\s+(?:async\s+)?(?:function\*?|const|let|var|class)\s+([A-Za-z0-9_$]+)/g)) names.add(m[1]);
  for (const m of src.matchAll(/export\s*\{([^}]+)\}/g)) {
    m[1].split(",").forEach(function (x) {
      const n = x.trim().split(/\s+as\s+/).pop();
      if (n) names.add(n);
    });
  }
  return names;
}

function walkSrc(dir, out) {
  if (!fs.existsSync(dir)) return out;
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (d) {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) walkSrc(p, out);
    else if (/\.(svelte|m?js|ts)$/.test(d.name)) out.push(p);
  });
  return out;
}

// Warning-only hint: lists imports (in our files AND older files in src/) of names that will not exist after install.
// This is what causes Rollup "[MISSING_EXPORT]" build errors. It never blocks the install.
function checkImports(root) {
  const problems = [];
  const exp = {};
  Object.keys(FILES).forEach(function (rel) { if (/\.(m?js)$/.test(rel)) exp[rel] = exportedNames(FILES[rel]); });
  const entries = Object.keys(FILES).filter(function (r) { return /\.(svelte|m?js)$/.test(r); }).map(function (r) { return [r, FILES[r]]; });
  if (root) {
    walkSrc(path.join(root, "src"), []).forEach(function (abs) {
      const rel = path.relative(root, abs).split(path.sep).join("/");
      if (!FILES[rel]) entries.push([rel, fs.readFileSync(abs, "utf8")]);
    });
  }
  entries.forEach(function (en) {
    const rel = en[0];
    for (const m of en[1].matchAll(/import\s+(?:[A-Za-z0-9_$]+\s*,\s*)?\{([^}]+)\}\s+from\s+["'](\.[^"']+)["']/g)) {
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(rel), m[2]));
      if (!exp[target]) continue;
      m[1].split(",").map(function (x) { return x.trim().split(/\s+as\s+/)[0]; }).filter(Boolean).forEach(function (n) {
        if (!exp[target].has(n)) problems.push(rel + ': "' + n + '" is not exported by ' + target);
      });
    }
  });
  return problems;
}

function validateIndexHtml(html) {
  const problems = [];
  if ((html.match(/name="viewport"/g) || []).length !== 1) problems.push("index.html must have exactly one viewport meta tag");
  if (html.indexOf("width=device-width, initial-scale=1.0") === -1) problems.push("viewport meta must be width=device-width, initial-scale=1.0");
  if (!/<meta name="seo-start"/.test(html) || !/<meta name="seo-end"/.test(html)) problems.push("SEO head markers are missing");
  if (html.indexOf("<seo-shell") === -1 || html.indexOf("</seo-shell>") === -1) problems.push("static SEO shell is missing");
  if (!/<script\s+type="module"/.test(html)) problems.push("module script tag is missing");
  if ((html.match(/<div\s+id="/g) || []).length < 1) problems.push("app root element is missing");
  if (html.indexOf("Audit client contracts in 30 seconds") === -1) problems.push("hero copy is missing from the static shell");
  if (problems.length) throw new Error("index.html template check failed: " + problems.join("; "));
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
  try {
    const warn = checkImports(root);
    if (warn.length) console.warn("WARNING (not blocking): these imports may fail the build:\n  " + warn.join("\n  "));
  } catch (e) {}

  const seo = await import(pathToFileURL(path.join(stage, "scripts", "seo-content.mjs")).href);
  const html = buildIndexHtml(existingIndex, seo.headTags("/"), seo.shellHtml("/"));
  validateIndexHtml(html);

  // Dry-run the prerender step against a fake dist folder.
  fs.mkdirSync(path.join(stage, "dist"), { recursive: true });
  fs.writeFileSync(path.join(stage, "dist", "index.html"), html, "utf8");
  execSync("node scripts/prerender.mjs", { cwd: stage, stdio: "inherit" });
  const need = ["index.html", "scope-guard/index.html", "chaser/index.html", "sample/index.html", "dashboard/index.html", "pricing/index.html", "privacy/index.html", "terms/index.html", "sitemap.xml", "robots.txt"];
  need.forEach(function (f) {
    if (!fs.existsSync(path.join(stage, "dist", f))) throw new Error("Prerender dry-run did not create " + f);
  });
  const pricing = fs.readFileSync(path.join(stage, "dist", "pricing", "index.html"), "utf8");
  if (pricing.indexOf("<title>Pricing – ClauseRadar</title>") === -1) throw new Error("Prerender dry-run produced a wrong pricing page.");
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
    if (html.indexOf("Audit client contracts in 30 seconds") === -1) throw new Error("dist/index.html is missing the static hero copy.");
    if ((html.match(/name="viewport"/g) || []).length !== 1 || html.indexOf("width=device-width, initial-scale=1.0") === -1) throw new Error("dist/index.html must contain exactly one correct viewport meta tag.");
    ["pricing/index.html", "sample/index.html", "sitemap.xml", "robots.txt"].forEach(function (f) {
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
      sh('git commit -m "ClauseRadar v4: Pro plan, Scope Guard, Payment Chaser, Contract Memory, mobile gutter fix"', root);
    } catch (e) {
      console.log("Nothing new to commit, continuing to push.");
    }
    sh("git push --force-with-lease origin main", root);
    console.log("\nPushed. Vercel will redeploy automatically.");
    console.log("\nNEXT (required once): open Supabase > SQL Editor, paste supabase-v3.sql from your project root and run it.");
    console.log("Until it runs, Free plan features keep working but Pro, Contract Memory, Scope Guard, Payment Chaser and device limits stay inactive.");
    console.log("Env vars needed (you already have most): GROQ_API_KEY, GEMINI_API_KEY, SUPABASE_URL or VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.");
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
