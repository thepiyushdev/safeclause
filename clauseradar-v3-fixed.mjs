// clauseradar-v3-fixed.mjs
// Run from the project root in Termux:  node clauseradar-v3-fixed.mjs
// Adds Contract Memory, Scope Guard and Payment Chaser, and replaces credit packs with a Pro plan
// (Rs 499/month or Rs 3,999/year, paid by UPI, 3 devices). Keeps every existing route, API and design token.
// Re-runnable over v2. Pre-flight (syntax, imports, prerender dry-run) happens in a staging folder first,
// and everything is rolled back if the build fails. After deploying, run supabase-v3.sql once in Supabase.
// Fixes over the first v3: side gutters on every page, PACKS compatibility export, nav links, plan pricing page,
// accessible modal backdrops, and pre-flight checks that compile every Svelte file and verify every import.

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { execSync, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

export const FILES = {};
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

F("src/pages/ScopeGuard.svelte", String.raw`<script>
  import { user, isPro, authHeaders, readJson, openAuth, openPay, link, copyToClipboard, fmt } from "../lib/app.js";
  import { projects, loadProjects, updateProject, scopeUsage } from "../lib/memory.js";
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

F("src/pages/Chaser.svelte", String.raw`<script>
  import { user, isPro, openAuth, openPay, link, copyToClipboard } from "../lib/app.js";
  import { projects, invoices, loadProjects, loadInvoices, saveInvoice, markInvoicePaid, deleteInvoice } from "../lib/memory.js";
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
  import { sb, user, isPro, profile, deviceState, openAuth, openPay, refreshProfile, syncDevice, revokeDevice, signOutThisDevice, fmtDate } from "../lib/app.js";
  import { projects, invoices, loadProjects, loadInvoices, deleteProject, scopeUsage } from "../lib/memory.js";

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
// Assets
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
// index.html
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
// Pre-flight checks
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
    throw new Error("npm run build exited with code " + r.status + (hits.length ? "\n  " + hits.join("\n  ") : ""));
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
  const importProblems = checkImports(root);
  if (importProblems.length) throw new Error("Import problems:\n  " + importProblems.join("\n  "));

  const seo = await import(pathToFileURL(path.join(stage, "scripts", "seo-content.mjs")).href);
  const html = buildIndexHtml(existingIndex, seo.headTags("/"), seo.shellHtml("/"));

  fs.mkdirSync(path.join(stage, "dist"), { recursive: true });
  fs.writeFileSync(path.join(stage, "dist", "index.html"), html, "utf8");
  execSync("node scripts/prerender.mjs", { cwd: stage, stdio: "inherit" });
  return html;
}

// ---------------------------------------------------------------------------
// Installer
// ---------------------------------------------------------------------------
function sh(cmd, cwd) {
  console.log("\n$ " + cmd);
  execSync(cmd, { stdio: "inherit", cwd: cwd });
}

async function main() {
  const root = process.cwd();
  const BACKUP = path.join(root, ".safeclause-backup", "cr-" + new Date().toISOString().replace(/[:.]/g, "-"));
  const STAGE = path.join(root, ".clauseradar-stage");

  if (!fs.existsSync(path.join(root, "package.json")) || !fs.existsSync(path.join(root, "src")) || !fs.existsSync(path.join(root, "index.html"))) {
    console.error("ERROR: run this from the project root.");
    process.exit(1);
  }

  const existingIndex = fs.readFileSync(path.join(root, "index.html"), "utf8");
  let indexHtml;
  let isESM = true;
  try {
    const pkg0 = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
    isESM = pkg0.type === "module";
    indexHtml = await stageAndCheck(STAGE, existingIndex, isESM, root);
    console.log("\nPre-flight OK: all files pass syntax checks and prerender dry-run.");
  } catch (e) {
    console.error("\nPRE-FLIGHT FAILED: " + e.message);
    fs.rmSync(STAGE, { recursive: true, force: true });
    process.exit(1);
  }
  fs.rmSync(STAGE, { recursive: true, force: true });

  const pkgPath = path.join(root, "package.json");
  const pkgOriginal = fs.readFileSync(pkgPath, "utf8");
  const pkg = JSON.parse(pkgOriginal);
  pkg.scripts = pkg.scripts || {};
  const build = pkg.scripts.build || "vite build";
  if (build.indexOf("prerender.mjs") === -1) pkg.scripts.build = build + " && node scripts/prerender.mjs";
  const pkgNew = JSON.stringify(pkg, null, 2) + "\n";

  if (!fs.existsSync(path.join(root, "node_modules", "@supabase", "supabase-js"))) {
    sh("npm install @supabase/supabase-js@2 --no-audit --no-fund", root);
  }

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

  try {
    runBuild(root, BACKUP);
    const dist = path.join(root, "dist");
    const html = fs.readFileSync(path.join(dist, "index.html"), "utf8");
    if (html.indexOf("Audit client contracts in 30 seconds") === -1) throw new Error("dist/index.html is missing hero copy.");
  } catch (e) {
    console.error("\nBUILD OR VERIFY FAILED: " + (e && e.message ? e.message : e));
    console.error("Nothing was pushed.");
    rollback();
    process.exit(1);
  }

  console.log("\nBuild OK. Static pages, sitemap.xml and robots.txt are in dist/.");
  try {
    sh("git add " + written.map(function (w) { return w.rel; }).join(" "), root);
    try {
      sh('git commit -m "ClauseRadar v3: Pro plan, Scope Guard, Payment Chaser, Contract Memory, mobile gutter fix"', root);
    } catch (e) {
      console.log("Nothing new to commit, continuing to push.");
    }
    sh("git push --force-with-lease origin main", root);
    console.log("\nPushed. Vercel will redeploy automatically.");
    console.log("\nNEXT (required once): open Supabase > SQL Editor, paste supabase-v3.sql from your project root and run it.");
  } catch (e) {
    console.error("\nGit push failed.");
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(function (e) {
    console.error(e);
    process.exit(1);
  });
}
