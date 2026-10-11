// upgrade-clauseradar.mjs
// Run from the project root in Termux:  node upgrade-clauseradar.mjs
// Stays on Svelte + Vite. Rebrands to ClauseRadar, adds real URLs (/sample /dashboard /pricing ...),
// build-time prerendered static HTML for every public route (view-source shows the full copy),
// metadata + Open Graph + robots.txt + sitemap.xml, a light design system, and keeps every backend flow
// (Supabase auth/credits, /api/audit, /api/unlock batch, /api/verify-payment) untouched.
// Pre-flight checks run in a staging folder first. If the build fails, everything is rolled back.

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
    description: "Scan contracts free. Unlock safer rewrites, counter-proposal emails and PDF reports from ₹49 per contract.",
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

F("src/lib/data.mjs", String.raw`export const PACKS = [
  { id: 1, credits: 1, price: 49, icon: "⚡", name: "Single Audit Pass", popular: false,
    features: ["1 full contract unlock", "Safer rewrite for every flagged clause", "Counter-proposal emails + PDF report"] },
  { id: 3, credits: 3, price: 129, icon: "🛡️", name: "Freelancer Shield Pack", popular: true,
    features: ["3 full contract unlocks", "Save ₹18 versus single passes", "Counter-proposal emails + PDF report"] },
  { id: 8, credits: 8, price: 299, icon: "👑", name: "Agency Pack", popular: false,
    features: ["8 full contract unlocks", "Lowest price per contract", "Built for agencies and teams"] },
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
  { q: "What does 1 credit unlock?", a: "One credit unlocks every flagged clause of one audited contract: all safer rewrites, all counter-proposal emails and the full PDF report." },
  { q: "Is my contract stored?", a: "We do not save your contract text in our database and we do not use it to train models. It is processed by third-party AI providers under their API terms, so avoid pasting anything you are not allowed to share." },
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
      { h: "Summary", p: ["We do not store your contracts and we do not use them to train models. We keep only what we need to run your account: your email address, your credit balance and payment-verification records."] },
      { h: "What happens to your contract", p: [
        "When you scan a contract, the text you paste or upload is read in your browser, sent to our server and forwarded to a third-party AI provider (currently Groq) to produce the audit. We do not save contract text in our database and we do not use your contracts to train models.",
        "Audit results are returned to your browser and are not stored by us. Because contract text passes through our hosting and AI providers while it is processed, please do not submit agreements you are not allowed to share.",
      ] },
      { h: "Account data", p: ["If you create an account we store your email address and your credit balance. Sign-in is handled by Supabase Authentication, and we never see your password."] },
      { h: "Payments", p: ["Payments are made by UPI directly to the UPI ID shown at checkout. When you upload a payment screenshot, it is analysed by an AI service (Google Gemini) to check the amount, receiver and status. We keep the transaction ID, a fingerprint (hash) of the image, the amount, the credits added, the time and your user ID, so the same payment cannot be used twice and for our accounting. We do not store the screenshot itself."] },
      { h: "Service providers", p: ["We use Vercel (hosting), Supabase (authentication and database), Groq (contract analysis) and Google (payment screenshot checks). Each processes data under its own terms. Fonts are loaded from Google Fonts."] },
      { h: "Cookies and tracking", p: ["We use your browser's local storage to keep you signed in. We do not run advertising trackers."] },
      { h: "Retention and deletion", p: ["We keep account and credit data while your account is active. Payment records are kept as long as needed for accounting and fraud prevention. To delete your account or ask what we hold about you, email " + CONTACT_EMAIL + ". We will delete your account data, except records we must keep for accounting or fraud prevention."] },
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
      { h: "Credits and payments", p: [
        "One credit unlocks the full results of one audited contract. Credits are added to your account after your UPI payment is verified, have no cash value and are used only within ClauseRadar.",
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
import { PACKS, BENTO, FAQS, SAMPLE_REPORT, VAULT } from "../src/lib/data.mjs";
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
      offers: { "@type": "AggregateOffer", priceCurrency: "INR", lowPrice: "49", highPrice: "299", offerCount: String(PACKS.length) },
    };
    h += '<script type="application/ld+json">' + JSON.stringify(ld) + "</script>\n";
  }
  return h;
}

const BTN = "display:inline-block;padding:11px 20px;border-radius:12px;font-weight:600;text-decoration:none;margin:4px 8px 4px 0;";
const NAVLINKS = [["/", "Home"], ["/dashboard", "Scanner"], ["/sample", "Sample report"], ["/pricing", "Pricing"], ["/radar", "Risk calculator"], ["/vault", "Clause library"], ["/privacy", "Privacy"], ["/terms", "Terms"]];

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
  h += sec("Zero contract training", ["We do not store or use your agreements to train models. Scans are ephemeral. Contract text is processed by third-party AI providers under their API terms."]);
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
    let h = h1("Pricing") + para("Scanning is free: you get the overall risk score, categorised flags, exact clause quotes and plain-English explanations. Unlock the full results of a contract, including safer rewrites, counter-proposal emails and a PDF report, with credits.");
    PACKS.forEach(function (k) { h += sec(k.name + " – ₹" + k.price, [k.credits + " credit(s). " + k.features.join(". ") + "."]); });
    return wrap(h);
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
// Design system + app state
// ---------------------------------------------------------------------------
F("src/lib/styles.css", String.raw`:root{color-scheme:light;background-color:#f8fafc;color:#0f172a;--bg:#f8fafc;--surface:#fff;--ink:#0f172a;--ink2:#334155;--muted:#64748b;--line:#e2e8f0;--indigo:#4f46e5;--indigo-soft:#eef2ff;--rose:#e11d48;--rose-bg:#fff1f2;--amber:#b45309;--amber-bg:#fffbeb;--green:#047857;--green-bg:#ecfdf5}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
html,body{margin:0;max-width:100%;overflow-x:hidden}
body{background:var(--bg);color:var(--ink);font-family:Inter,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;font-size:16px;line-height:1.55;-webkit-font-smoothing:antialiased}
a{color:inherit}
button{font:inherit;color:inherit;padding:0;margin:0;border:0;background:none;border-radius:0;cursor:pointer}
body{display:block;place-items:initial;min-width:0;min-height:100vh;margin:0}
#app{max-width:none;margin:0;padding:0;text-align:left}
.burger{padding:0}
.num{font-variant-numeric:tabular-nums}
.wrap{max-width:1120px;margin:0 auto;padding:0 18px}
.narrow{max-width:860px}
.page{padding:34px 0 64px}
.sec{padding:60px 0}
.center{text-align:center}
.muted{color:var(--muted)}
.small{font-size:.85rem}
.pre{white-space:pre-wrap;word-break:break-word}
.row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
.between{justify-content:space-between}
.grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:6px 14px}
.grid3{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:14px}
.display{font-size:clamp(2.1rem,6.4vw,3.7rem);line-height:1.04;letter-spacing:-.035em;font-weight:800;margin:18px auto 14px;max-width:880px}
.h2{font-size:clamp(1.5rem,4.2vw,2.1rem);letter-spacing:-.02em;font-weight:800;margin:0 0 8px}
.lead{font-size:1.12rem;color:var(--ink2);max-width:660px;margin:0 auto}
.grad{background:linear-gradient(90deg,#4f46e5,#c026d3 55%,#e11d48);-webkit-background-clip:text;background-clip:text;color:transparent}
.lbl{font-size:.7rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:16px 0 6px}
.pill{display:inline-flex;gap:8px;align-items:center;padding:5px 13px;border-radius:999px;background:var(--indigo-soft);border:1px solid #c7d2fe;color:#3730a3;font-size:.84rem;font-weight:600;text-decoration:none;transition:.15s}
.pill:hover{border-color:#818cf8}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:10px 16px;border-radius:11px;border:1px solid #cbd5e1;background:#fff;color:var(--ink);font-size:.92rem;font-weight:600;text-decoration:none;cursor:pointer;transition:border-color .15s,box-shadow .15s,transform .15s}
.btn:hover{border-color:#818cf8;box-shadow:0 2px 10px rgba(79,70,229,.12)}
.btn:active{transform:translateY(1px)}
.btn.primary{background:var(--indigo);border-color:var(--indigo);color:#fff;box-shadow:0 1px 2px rgba(15,23,42,.2),0 6px 16px rgba(79,70,229,.28)}
.btn.primary:hover{background:#4338ca}
.btn.sm{padding:6px 11px;font-size:.82rem;border-radius:9px}
.btn.lg{padding:13px 22px;font-size:1rem;border-radius:13px}
.btn.block{display:flex;width:100%}
.btn:disabled{opacity:.6;cursor:wait}
.card{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:18px;box-shadow:0 1px 2px rgba(15,23,42,.04);margin-top:14px}
.card.hover{transition:.18s}
.card.hover:hover{border-color:#a5b4fc;transform:translateY(-2px);box-shadow:0 10px 30px rgba(79,70,229,.1)}
.iri{position:relative}
.iri::before{content:"";position:absolute;inset:-1px;border-radius:inherit;padding:1px;background:linear-gradient(135deg,#a5b4fc,#f9a8d4,#fcd34d,#6ee7b7);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;pointer-events:none}
.badge{display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:999px;font-size:.72rem;font-weight:700;letter-spacing:.03em;white-space:nowrap}
.badge .dot{width:6px;height:6px;border-radius:50%;background:currentColor}
.badge.high{background:var(--rose-bg);color:#be123c;border:1px solid #fecdd3}
.badge.med{background:var(--amber-bg);color:var(--amber);border:1px solid #fde68a}
.badge.low{background:var(--green-bg);color:var(--green);border:1px solid #a7f3d0}
input,select,textarea{width:100%;background:#fff;color:var(--ink);border:1px solid #cbd5e1;border-radius:11px;padding:11px 12px;font:inherit;margin-bottom:8px;outline:none}
input:focus,select:focus,textarea:focus{border-color:var(--indigo);box-shadow:0 0 0 3px rgba(99,102,241,.2)}
textarea{resize:vertical;min-height:140px}
label{display:block;font-size:.82rem;font-weight:600;color:var(--ink2)}
.error{margin-top:10px;padding:11px 13px;border-radius:10px;background:var(--rose-bg);border:1px solid #fecdd3;color:#9f1239;font-size:.9rem;word-break:break-word;text-align:left}
.ok{margin-top:10px;padding:11px 13px;border-radius:10px;background:var(--green-bg);border:1px solid #a7f3d0;color:#065f46;font-size:.9rem}
.seg{display:flex;gap:6px;margin:0 0 12px}
.seg button,.chips button{padding:8px 12px;border-radius:10px;border:1px solid var(--line);background:#fff;color:var(--ink2);font-size:.85rem;font-weight:600;cursor:pointer;transition:.15s}
.seg button{flex:1}
.seg button.on,.chips button.on{border-color:var(--indigo);background:var(--indigo-soft);color:#3730a3}
.chips{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 12px}
.chips button{border-radius:999px;padding:6px 13px;font-size:.82rem}

/* nav */
.nav{position:sticky;top:0;z-index:40;background:rgba(255,255,255,.85);backdrop-filter:saturate(180%) blur(14px);-webkit-backdrop-filter:saturate(180%) blur(14px);border-bottom:1px solid var(--line)}
.nav-in{max-width:1120px;margin:0 auto;padding:10px 18px;display:flex;align-items:center;justify-content:space-between;gap:10px}
.brand{display:flex;align-items:center;gap:8px;font-weight:800;font-size:1.08rem;letter-spacing:-.02em;text-decoration:none;white-space:nowrap}
.nav-links{display:none;gap:2px}
.nav-links a,.menu a{padding:8px 12px;border-radius:9px;text-decoration:none;color:var(--ink2);font-size:.9rem;font-weight:500}
.nav-links a:hover,.menu a:hover{background:#f1f5f9}
.nav-links a.active,.menu a.active{color:#3730a3;background:var(--indigo-soft)}
.nav-right{display:flex;align-items:center;gap:8px}
.credit{display:inline-flex;gap:5px;align-items:center;padding:4px 10px;border-radius:999px;border:1px solid #c7d2fe;background:var(--indigo-soft);color:#3730a3;font-size:.8rem;text-decoration:none;font-weight:600}
.avatar{width:32px;height:32px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#4f46e5,#c026d3);color:#fff;font-weight:700;text-decoration:none;font-size:.9rem}
.burger{width:36px;height:34px;border-radius:9px;border:1px solid var(--line);background:#fff;font-size:1rem;cursor:pointer}
.menu{display:flex;flex-direction:column;max-width:1120px;margin:0 auto;padding:0 14px 12px}
.menu a{padding:11px 12px}
@media(max-width:560px){.hide-sm{display:none}}
@media(min-width:900px){.nav-links{display:flex}.burger,.menu{display:none}}

/* hero */
.hero-bg{background:radial-gradient(900px 420px at 15% -10%,rgba(99,102,241,.16),transparent),radial-gradient(700px 380px at 90% 0%,rgba(244,114,182,.14),transparent),radial-gradient(600px 300px at 50% 100%,rgba(251,191,36,.1),transparent)}
.hero{text-align:center;padding-top:52px;padding-bottom:44px}
.cta{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin:26px 0 12px}

/* demo viewer */
.demo{display:grid;grid-template-columns:1.15fr 1fr;border-radius:20px;background:#fff;overflow:hidden;box-shadow:0 20px 60px rgba(79,70,229,.12)}
.demo .doc{padding:22px;border-right:1px solid var(--line);font-family:Georgia,"Times New Roman",serif;font-size:.98rem;line-height:1.75;color:#1e293b;background:#fffefb}
.demo .doc p{margin:0 0 12px}
.hl{border:0;font:inherit;color:inherit;padding:1px 4px;border-radius:5px;cursor:pointer;transition:.15s}
.hl.rose{background:#fecdd3;box-shadow:0 0 0 0 rgba(225,29,72,.35)}
.hl.amber{background:#fde68a}
.hl.on.rose{box-shadow:0 0 0 3px rgba(225,29,72,.3)}
.hl.on.amber{box-shadow:0 0 0 3px rgba(217,119,6,.35)}
.demo .side{padding:18px;display:flex;flex-direction:column;gap:10px;background:#fbfcfe}
.find{border:1px solid var(--line);border-radius:14px;padding:12px 14px;background:#fff;cursor:pointer;text-align:left;font:inherit;color:inherit;transition:.15s}
.find.on{border-color:#818cf8;box-shadow:0 6px 20px rgba(79,70,229,.12)}
@media(max-width:780px){.demo{grid-template-columns:1fr}.demo .doc{border-right:0;border-bottom:1px solid var(--line)}}

/* bento */
.bento{display:grid;grid-template-columns:repeat(6,1fr);gap:14px}
.tile{padding:22px;border-radius:20px;background:#fff;border:1px solid var(--line);transition:.18s;grid-column:span 3}
.tile:hover{border-color:#a5b4fc;transform:translateY(-2px);box-shadow:0 12px 34px rgba(79,70,229,.1)}
.tile:nth-child(1),.tile:nth-child(4){grid-column:span 4}
.tile:nth-child(2),.tile:nth-child(3){grid-column:span 2}
.tile .ic{font-size:1.6rem;margin-bottom:10px}
.tile h3{margin:0 0 6px;font-size:1.08rem;letter-spacing:-.01em}
.tile p{margin:0;color:var(--ink2);font-size:.94rem}
@media(max-width:780px){.tile,.tile:nth-child(n){grid-column:span 6}}

/* trust + cta bands */
.trust{display:flex;gap:16px;align-items:flex-start;padding:22px;border-radius:20px;background:linear-gradient(135deg,#0f172a,#312e81);color:#e0e7ff}
.trust b{color:#fff;font-size:1.15rem}
.trust p{margin:6px 0 0;color:#c7d2fe;font-size:.94rem}
.band{text-align:center;padding:44px 20px;border-radius:24px;background:linear-gradient(135deg,#eef2ff,#fdf2f8 60%,#fffbeb);border:1px solid #e0e7ff}

/* faq */
.faq{background:#fff;border:1px solid var(--line);border-radius:14px;padding:2px 16px;margin-top:10px}
.faq summary{cursor:pointer;padding:13px 0;font-weight:600;list-style:none;display:flex;justify-content:space-between;gap:10px}
.faq summary::-webkit-details-marker{display:none}
.faq summary::after{content:"+";color:var(--muted);font-weight:500;font-size:1.2rem;line-height:1}
.faq[open] summary::after{content:"–"}
.faq p{margin:0 0 14px;color:var(--ink2);font-size:.94rem}

/* gauge */
.gauge{position:relative;width:210px;margin:0 auto}
.gauge svg{width:100%;display:block}
.gauge .trk{fill:none;stroke:#e2e8f0;stroke-width:10;stroke-linecap:round}
.gauge .val{fill:none;stroke-width:10;stroke-linecap:round;transition:stroke-dasharray .9s cubic-bezier(.2,.8,.2,1),stroke .3s}
.gauge .gnum{position:absolute;left:0;right:0;bottom:-2px;text-align:center;font-size:2.1rem;font-weight:800;line-height:1}
.gauge .gnum span{font-size:.85rem;color:var(--muted);font-weight:600}
.report-head{display:grid;grid-template-columns:230px 1fr;gap:20px;align-items:center}
@media(max-width:640px){.report-head{grid-template-columns:1fr}}

/* clause card */
.clause{background:#fff;border:1px solid var(--line);border-left:4px solid #94a3b8;border-radius:16px;padding:16px 16px 12px;margin-top:14px;box-shadow:0 1px 2px rgba(15,23,42,.04);transition:.18s}
.clause:hover{border-color:#c7d2fe}
.clause.high{border-left-color:var(--rose)}
.clause.med{border-left-color:#d97706}
.clause.low{border-left-color:#10b981}
.clause-h{display:flex;justify-content:space-between;align-items:center;gap:10px}
.catlabel{font-weight:700;letter-spacing:-.01em}
blockquote.redline{margin:0;padding:12px 14px;border-radius:10px;background:#fff7f8;border:1px solid #fecdd3;white-space:pre-wrap;font-size:.92rem;line-height:1.65;color:#4c0519}
.clause.med blockquote.redline{background:#fffdf5;border-color:#fde68a;color:#451a03}
.clause.low blockquote.redline{background:#f7fefb;border-color:#a7f3d0;color:#022c22}
.redline mark{background:#fecdd3;color:#881337;text-decoration:line-through;text-decoration-color:#e11d48;border-radius:3px;padding:0 2px}
.clause.med .redline mark{background:#fde68a;color:#78350f;text-decoration-color:#d97706}
.clause.low .redline mark{background:#bbf7d0;color:#14532d;text-decoration-color:#059669}
.why{margin:0;color:var(--ink2);font-size:.95rem}
.acc-btn{width:100%;display:flex;justify-content:space-between;align-items:center;margin-top:14px;padding:10px 12px;border-radius:11px;border:1px solid var(--line);background:#f8fafc;font-weight:600;font-size:.9rem;cursor:pointer;color:var(--ink);transition:.15s}
.acc-btn:hover{border-color:#818cf8;background:var(--indigo-soft)}
.chev{transition:transform .25s}
.chev.rot{transform:rotate(180deg)}
.acc{display:grid;grid-template-rows:0fr;transition:grid-template-rows .3s ease}
.acc.open{grid-template-rows:1fr}
.acc-in{overflow:hidden}
.acc.open .acc-in{padding-top:12px}
.ins{background:var(--green-bg);border:1px solid #a7f3d0;color:#064e3b;border-radius:10px;padding:12px 14px;margin:0 0 10px;line-height:1.65;font-size:.93rem;white-space:pre-wrap}
.mail{background:#f8fafc;border:1px solid var(--line);border-radius:10px;padding:12px 14px;font-size:.9rem;line-height:1.65;margin:0 0 10px;white-space:pre-wrap}
.rw-h{display:flex;justify-content:space-between;align-items:center;gap:8px;margin:2px 0 8px;flex-wrap:wrap}
.rw-tag{font-size:.7rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--green)}
.locked{position:relative}
.blurred{filter:blur(7px);opacity:.55;pointer-events:none;user-select:none}
.lock-over{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:6px}
.lock-card{width:100%;max-width:420px;text-align:center;padding:16px;border-radius:16px;background:rgba(255,255,255,.96);border:1px solid #c7d2fe;box-shadow:0 14px 40px rgba(15,23,42,.18)}
.lock-t{font-weight:700;margin-bottom:10px}

/* scanner */
.drop{border:1.5px dashed #94a3b8;border-radius:16px;padding:26px 16px;text-align:center;background:#f8fafc;cursor:pointer;transition:.15s;margin-bottom:12px}
.drop:hover,.drop.drag{border-color:var(--indigo);background:var(--indigo-soft)}
.drop .big{font-size:1.9rem}
.fileinfo{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:-2px 0 10px;font-size:.84rem;color:var(--ink2)}
.scan{padding:18px;border-radius:14px;background:var(--indigo-soft);border:1px solid #c7d2fe;margin-top:12px}
.scan li{list-style:none;padding:5px 0;color:#64748b;font-size:.92rem;display:flex;gap:8px;align-items:center}
.scan li.now{color:#3730a3;font-weight:700}
.scan li.done{color:var(--green)}
.scan ul{margin:0;padding:0}
.spin{width:14px;height:14px;border-radius:50%;border:2px solid #c7d2fe;border-top-color:var(--indigo);animation:sp .8s linear infinite;display:inline-block}
@keyframes sp{to{transform:rotate(360deg)}}

/* pricing */
.packs{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;margin-top:18px}
.pack{position:relative;background:#fff;border:1px solid var(--line);border-radius:20px;padding:24px 18px 18px;text-align:center;transition:.18s}
.pack:hover{border-color:#a5b4fc;transform:translateY(-2px)}
.pack.popular{border-color:#818cf8;box-shadow:0 14px 40px rgba(79,70,229,.16)}
.ribbon{position:absolute;top:-11px;left:50%;transform:translateX(-50%);background:linear-gradient(90deg,#4f46e5,#c026d3);color:#fff;font-size:.7rem;font-weight:700;padding:3px 12px;border-radius:999px;white-space:nowrap}
.price{font-size:2.5rem;font-weight:800;letter-spacing:-.03em;margin:4px 0}
.feat{list-style:none;padding:0;margin:12px 0 16px;text-align:left;font-size:.9rem;color:var(--ink2)}
.feat li{padding:4px 0 4px 24px;position:relative}
.feat li::before{content:"✓";position:absolute;left:0;color:var(--green);font-weight:800}
.tier{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px;margin-top:18px}
.stepno{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;margin-bottom:8px;background:var(--indigo-soft);color:#3730a3}

/* calculator + vault */
.meter{position:relative;height:10px;border-radius:999px;margin:10px 0 4px;background:linear-gradient(90deg,#10b981,#f59e0b,#e11d48)}
.pin{position:absolute;top:-5px;width:6px;height:20px;margin-left:-3px;border-radius:3px;background:var(--ink);transition:left .4s ease}
.mlabels{display:flex;justify-content:space-between;font-size:.7rem;color:var(--muted);margin-bottom:8px}
.lines{list-style:none;margin:12px 0;padding:0}
.lines li{display:flex;justify-content:space-between;gap:10px;padding:10px 0;border-bottom:1px solid var(--line);font-size:.92rem}
.lines li span{color:var(--ink2)}
.lines li b{text-align:right;white-space:nowrap}

/* prose (legal) */
.prose h2{font-size:1.2rem;margin:28px 0 6px;letter-spacing:-.01em}
.prose p{color:var(--ink2);margin:0 0 10px}

/* disclaimer + footer */
.disc{display:flex;gap:10px;padding:12px 14px;border-radius:12px;background:var(--amber-bg);border:1px solid #fde68a;color:#78350f;font-size:.85rem}
.foot{border-top:1px solid var(--line);background:#fff;padding:32px 0 40px;margin-top:20px}
.flinks{display:flex;gap:6px 18px;flex-wrap:wrap;margin:14px 0}
.flinks a{color:var(--ink2);text-decoration:none;font-size:.9rem}
.flinks a:hover{color:var(--indigo)}

/* modals */
.backdrop{position:fixed;inset:0;z-index:60;background:rgba(15,23,42,.5);display:flex;align-items:center;justify-content:center;padding:14px;overflow-y:auto;backdrop-filter:blur(3px)}
.modal{position:relative;width:100%;max-width:440px;max-height:92vh;overflow-y:auto;border-radius:20px;padding:22px 20px;background:#fff;box-shadow:0 30px 80px rgba(15,23,42,.35)}
.modal h2{margin:0 0 8px;font-size:1.25rem}
.x{position:absolute;top:12px;right:14px;background:none;border:0;color:var(--muted);font-size:1.1rem;cursor:pointer}
.links{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;margin-top:12px}
.links button,.linkbtn{background:none;border:0;color:var(--indigo);font:inherit;font-size:.86rem;font-weight:600;cursor:pointer;padding:0}
.upi{margin-bottom:8px}
h3.sub{margin:16px 0 6px;font-size:.72rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
`);

F("src/lib/app.js", String.raw`import { writable, derived } from "svelte/store";
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
export const credits = writable(0);
export const authModal = writable({ open: false, mode: "login", note: "" });
export const payModal = writable({ open: false, packId: 1 });
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

export async function refreshCredits(uid) {
  if (!sb) return;
  try {
    const r = await sb.from("profiles").select("credits").eq("id", uid).maybeSingle();
    credits.set(r.data && Number.isFinite(r.data.credits) ? r.data.credits : 0);
  } catch (e) {}
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
  const unsubUser = user.subscribe(function (u) {
    if (u) refreshCredits(u.id);
    else credits.set(0);
  });
  let authSub = null;
  if (sb) {
    sb.auth.getSession().then(function (r) { session.set(r.data ? r.data.session : null); });
    const res = sb.auth.onAuthStateChange(function (event, s) {
      session.set(s);
      if (event === "PASSWORD_RECOVERY") showRecovery.set(true);
    });
    authSub = res.data.subscription;
  }
  return function () {
    window.removeEventListener("popstate", onPop);
    unsubUser();
    if (authSub) authSub.unsubscribe();
  };
}

export async function authHeaders() {
  const r = await sb.auth.getSession();
  const t = r.data && r.data.session ? r.data.session.access_token : "";
  return { "Content-Type": "application/json", Authorization: "Bearer " + t };
}

export async function readJson(r) {
  const raw = await r.text();
  try { return JSON.parse(raw); } catch (e) { return { error: "Server error (HTTP " + r.status + ")" }; }
}

export function openAuth(mode, note) {
  authModal.set({ open: true, mode: mode || "login", note: note || "" });
}

export function openPay(id) {
  if (!currentUser) { openAuth("login", "Log in first so your credits are added to your account."); return; }
  payModal.set({ open: true, packId: id || 1 });
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
  return Math.round(p.price / p.credits);
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
</script>

<header class="nav">
  <div class="nav-in">
    <a class="brand" href="/" on:click={(e) => nav(e, "/")}>
      <svg width="24" height="24" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="#4f46e5" /><circle cx="16" cy="16" r="9" fill="none" stroke="#fff" stroke-opacity=".9" stroke-width="2" /><circle cx="16" cy="16" r="4" fill="none" stroke="#fff" stroke-opacity=".9" stroke-width="2" /><circle cx="22" cy="10" r="2.6" fill="#fb7185" /></svg>
      ClauseRadar
    </a>
    <nav class="nav-links" aria-label="Main">
      {#each LINKS as l}
        <a href={l[0]} class:active={$route === l[0]} on:click={(e) => nav(e, l[0])}>{l[1]}</a>
      {/each}
    </nav>
    <div class="nav-right">
      <a class="credit" href="/pricing" title={$credits + " credits"} on:click={(e) => nav(e, "/pricing")}>⚡ <b class="num">{short}</b></a>
      <button class="btn sm hide-sm" on:click={() => openPay(1)}>Buy credits</button>
      {#if $user}
        <a class="avatar" href="/account" title={$user.email} on:click={(e) => nav(e, "/account")}>{initial}</a>
      {:else}
        <button class="btn sm primary" on:click={() => openAuth("login")}>Log in</button>
      {/if}
      <button class="burger" aria-label="Menu" on:click={() => (open = !open)}>{open ? "✕" : "☰"}</button>
    </div>
  </div>
  {#if open}
    <nav class="menu" aria-label="Mobile">
      {#each LINKS as l}
        <a href={l[0]} class:active={$route === l[0]} on:click={(e) => nav(e, l[0])}>{l[1]}</a>
      {/each}
      <a href="/pricing" on:click={(e) => { e.preventDefault(); open = false; openPay(1); }}>Buy credits</a>
    </nav>
  {/if}
</header>
`);

F("src/lib/Footer.svelte", String.raw`<script>
  import { link } from "./app.js";
  import DisclaimerBanner from "./DisclaimerBanner.svelte";
  const LINKS = [["/dashboard", "Scanner"], ["/sample", "Sample report"], ["/pricing", "Pricing"], ["/radar", "Risk calculator"], ["/vault", "Clause library"], ["/privacy", "Privacy"], ["/terms", "Terms"]];
  const year = new Date().getFullYear();
</script>

<footer class="foot">
  <div class="wrap">
    <DisclaimerBanner />
    <div class="flinks">
      {#each LINKS as l}<a href={l[0]} on:click={(e) => link(e, l[0])}>{l[1]}</a>{/each}
    </div>
    <p class="muted small">Your contract text is not saved in our database and is not used to train models. It is processed by third-party AI providers under their API terms.</p>
    <p class="muted small">© {year} ClauseRadar. All rights reserved.</p>
  </div>
</footer>
`);

F("src/lib/Modals.svelte", String.raw`<script>
  import { sb, user, credits, authModal, payModal, showRecovery, authHeaders, readJson, copyToClipboard, UPI_ID } from "./app.js";
  import { PACKS } from "./data.mjs";

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

  $: pack = PACKS.find(function (p) { return p.id === $payModal.packId; }) || PACKS[0];
  $: upiLink = "upi://pay?pa=" + UPI_ID + "&pn=ClauseRadar&am=" + pack.price + "&cu=INR&tn=ClauseRadar_Credit";

  function closeAuth() {
    authModal.update(function (m) { return Object.assign({}, m, { open: false }); });
    authMsg = "";
  }
  function setMode(mode) {
    authModal.update(function (m) { return Object.assign({}, m, { mode: mode }); });
    authMsg = "";
  }
  function closePay() {
    payModal.update(function (m) { return Object.assign({}, m, { open: false }); });
    payMsg = "";
  }
  function pickPack(id) {
    payModal.update(function (m) { return Object.assign({}, m, { packId: id }); });
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
        closeAuth();
      }
    } catch (err) {
      authMsg = err && err.message ? err.message : "Something went wrong.";
    } finally {
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
        body: JSON.stringify({ image: b64, mime: "image/jpeg", pack: pack.id }),
      });
      const data = await readJson(r);
      if (!r.ok || !data.success) throw new Error(data.error || "Verification failed.");
      credits.set(data.credits);
      payOk = true;
      payMsg = "✅ Payment verified! " + data.creditsAdded + " credit(s) added.";
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
  <div class="backdrop" on:click|self={closeAuth}>
    <div class="modal" role="dialog" aria-modal="true">
      <button class="x" aria-label="Close" on:click={closeAuth}>✕</button>
      <h2>{$authModal.mode === "signup" ? "Create your account" : $authModal.mode === "forgot" ? "Reset password" : "Welcome back"}</h2>
      {#if $authModal.note}<p class="muted small">{$authModal.note}</p>{/if}
      {#if !sb}<div class="error">Supabase keys are missing, so login is disabled.</div>{/if}
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
  <div class="backdrop">
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
  <div class="backdrop" on:click|self={closePay}>
    <div class="modal" role="dialog" aria-modal="true">
      <button class="x" aria-label="Close" on:click={closePay}>✕</button>
      <h2>Buy credits</h2>
      <div class="chips">
        {#each PACKS as p}
          <button class:on={$payModal.packId === p.id} on:click={() => pickPack(p.id)}>{p.credits} credit{p.credits === 1 ? "" : "s"} • ₹{p.price}</button>
        {/each}
      </div>
      <p class="muted small">1 credit = 1 full contract unlock (all safer rewrites + counter-proposal emails + PDF report).</p>

      <h3 class="sub">Step 1: Pay ₹{pack.price}</h3>
      <a class="btn primary block upi" href={upiLink}>Tap to Pay with UPI ⚡</a>
      <p class="muted small">Opens GPay, PhonePe or Paytm on your phone. UPI ID: <b>{UPI_ID}</b>
        <button class="linkbtn" on:click={copyUpi}>{copied ? "Copied ✓" : "Copy"}</button>
      </p>

      <h3 class="sub">Step 2: Upload the payment screenshot</h3>
      <input type="file" accept="image/*" on:change={onShot} bind:this={shotInput} />
      <button class="btn block" on:click={verifyPayment} disabled={payBusy}>
        {payBusy ? "AI is verifying..." : "Verify payment & add credits"}
      </button>
      {#if payMsg}<div class={payOk ? "ok" : "error"}>{payMsg}</div>{/if}
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
          <p class="ins" style="margin:0;font-size:.85rem">{FIND[k].fix}</p>
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
      <p>We do not store or use your agreements to train models. Scans are ephemeral. Contract text is processed by third-party AI providers under their API terms.</p>
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
  <h1 class="h2" style="margin-top:12px;font-size:clamp(1.6rem,5vw,2.3rem)">Sample audit report</h1>
  <p class="muted">{R.title}. Open the cards, filter by severity, and copy the rewrites. No upload needed.</p>

  <section class="card iri">
    <div class="report-head">
      <RiskGauge score={R.score} level={R.level} />
      <div>
        <div class="row" style="margin-bottom:6px"><RiskBadge level={R.level} /><span class="muted small num">{R.clauses.length} flagged clauses</span></div>
        <p style="margin:0 0 10px">{R.summary}</p>
        <button class="btn sm" on:click={exportPdf}>📄 Export PDF report</button>
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
    <h1 class="h2" style="font-size:clamp(1.8rem,5.5vw,2.6rem)">Scan free. <span class="grad">Pay only to unlock.</span></h1>
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
  <h1 class="h2" style="font-size:clamp(1.8rem,5vw,2.4rem)">{doc.title}</h1>
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
  import { user, credits, MAX_CHARS, authHeaders, readJson, openAuth, openPay, deriveScore, catLabel, fmt } from "../lib/app.js";
  import { SAMPLE_CONTRACTS } from "../lib/data.mjs";
  import { openReport } from "../lib/report.js";
  import ClauseCard from "../lib/ClauseCard.svelte";
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
  $: unlockLabel = $credits < 1 ? "Unlock All Clauses for ₹49 (Get 1 Credit) ⚡" : "Use 1 Credit to Unlock All Clauses (Balance: " + $credits + ") ⚡";

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

  // 1 credit unlocks EVERY flagged clause of this audit in a single request.
  async function unlockAll() {
    error = "";
    if (!$user) { openAuth("login", "Log in to unlock. Your credits are saved to your account."); return; }
    if ($credits < 1) { openPay(1); return; }
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
      if (!r.ok || !data.success || !Array.isArray(data.unlocked)) {
        throw new Error(data.error || "Unlock failed (HTTP " + r.status + ").");
      }
      const map = {};
      data.unlocked.forEach(function (u) { map[u.index] = u; });
      unlockedData = map;
      credits.set(data.credits);
    } catch (err) {
      let msg = err && err.message ? err.message : "Unlock failed.";
      if (err instanceof TypeError) msg = "Network error. Check your connection and try again.";
      unlockError = msg;
    } finally {
      unlocking = false;
    }
  }

  function exportPdf() {
    const ok = openReport({ result: result, unlockedData: unlockedData, jur: jur, score: score });
    if (!ok) error = "Allow pop-ups for this site to download the PDF report.";
  }
</script>

<div class="wrap narrow page">
  <h1 class="h2" style="font-size:clamp(1.6rem,5vw,2.3rem)">Contract scanner</h1>
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
    <div class="row between">
      <span class="muted small num">{text.length} / {MAX_CHARS}</span>
      <span class="row" style="margin:0">
        <button class="btn sm" on:click={() => loadSample("india")}>Sample India</button>
        <button class="btn sm" on:click={() => loadSample("us")}>Sample US</button>
      </span>
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
          <button class="btn sm" on:click={exportPdf}>📄 {allUnlocked ? "Download full PDF report" : "Download PDF preview"}</button>
        </div>
      </div>
    </section>

    {#if flagged.length > 0 && !allUnlocked}
      <section class="card" style="border-color:#c7d2fe;background:#f5f7ff">
        <b>Unlock all {flagged.length} safer rewrites with one credit</b>
        <p class="muted small" style="margin:4px 0 12px">Includes every counter-proposal email and the full PDF report.</p>
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
  <h1 class="h2" style="font-size:clamp(1.6rem,5vw,2.3rem)">Contract risk calculator</h1>
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
  <h1 class="h2" style="font-size:clamp(1.6rem,5vw,2.3rem)">Clause library</h1>
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
      <button class="btn sm" on:click={() => copy(v)}>{copied === v.id ? "Copied ✓" : "Copy Clause"}</button>
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
  <h1 class="h2" style="font-size:clamp(1.6rem,5vw,2.3rem)">Account</h1>
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
        <button class="btn primary" on:click={() => openPay(1)}>Buy credits</button>
        <button class="btn" on:click={() => refreshCredits($user.id)}>Refresh balance</button>
        <button class="btn" on:click={signOut}>Sign out</button>
      </div>
    {:else}
      <p class="muted">Log in to save your credits and unlock rewrites on any device.</p>
      <div class="row">
        <button class="btn primary" on:click={() => openAuth("login")}>Log in</button>
        <button class="btn" on:click={() => openAuth("signup")}>Create account</button>
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

export async function stageAndCheck(stage, existingIndex) {
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
  if (bad) throw new Error(bad + " pre-flight problem(s) found. Nothing was changed.");

  const seo = await import(pathToFileURL(path.join(stage, "scripts", "seo-content.mjs")).href);
  const html = buildIndexHtml(existingIndex, seo.headTags("/"), seo.shellHtml("/"));

  // Dry-run the prerender step against a fake dist folder.
  fs.mkdirSync(path.join(stage, "dist"), { recursive: true });
  fs.writeFileSync(path.join(stage, "dist", "index.html"), html, "utf8");
  execSync("node scripts/prerender.mjs", { cwd: stage, stdio: "inherit" });
  const need = ["index.html", "sample/index.html", "dashboard/index.html", "pricing/index.html", "privacy/index.html", "terms/index.html", "sitemap.xml", "robots.txt"];
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
  const BACKUP = path.join(root, ".safeclause-backup");
  const STAGE = path.join(root, ".clauseradar-stage");

  if (!fs.existsSync(path.join(root, "package.json")) || !fs.existsSync(path.join(root, "src")) || !fs.existsSync(path.join(root, "index.html"))) {
    console.error("ERROR: run this from the project root (package.json, index.html and src/ must exist).");
    process.exit(1);
  }

  const existingIndex = fs.readFileSync(path.join(root, "index.html"), "utf8");
  let indexHtml;
  try {
    indexHtml = await stageAndCheck(STAGE, existingIndex);
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
  put("index.html", indexHtml);
  put("package.json", pkgNew);
  if (!fs.existsSync(path.join(root, "public", "favicon.svg"))) put("public/favicon.svg", FAVICON);
  if (!fs.existsSync(path.join(root, "public", "og.png"))) put("public/og.png", makeOgPng());

  try {
    sh("npm run build", root);
    const dist = path.join(root, "dist");
    const html = fs.readFileSync(path.join(dist, "index.html"), "utf8");
    if (html.indexOf("Audit client contracts in 30 seconds") === -1) throw new Error("dist/index.html is missing the static hero copy.");
    ["pricing/index.html", "sample/index.html", "sitemap.xml", "robots.txt"].forEach(function (f) {
      if (!fs.existsSync(path.join(dist, f))) throw new Error("dist/" + f + " was not created.");
    });
  } catch (e) {
    console.error("\nBUILD OR VERIFY FAILED: " + (e && e.message ? e.message : e));
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
      sh('git commit -m "ClauseRadar: rebrand, light redesign, real routes, prerendered SEO pages, sitemap and robots"', root);
    } catch (e) {
      console.log("Nothing new to commit, continuing to push.");
    }
    sh("git push --force-with-lease origin main", root);
    console.log("\nPushed. Vercel will redeploy automatically.");
    console.log("Check once in Vercel > Settings: Framework Preset = Vite, Build Command = npm run build, Output Directory = dist.");
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
