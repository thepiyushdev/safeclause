import { ROUTE_META, SITE, BRAND, OG_IMAGE } from "../src/lib/meta.mjs";
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
      offers: { "@type": "AggregateOffer", priceCurrency: "USD", lowPrice: "5", highPrice: "59", offerCount: String(PLANS.length) },
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
    PLANS.forEach(function (k) { h += sec(k.name + " – $" + k.price + " per " + k.per, ["Global price. Asia special pricing is $" + k.asiaPrice + " per " + k.per + " for India, Pakistan, Bangladesh, Nepal, Sri Lanka, Indonesia, the Philippines, Vietnam and Nigeria. Billed automatically through Whop. Cancel auto-pay at any time."]); });
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
    return wrap(h1("Earn 30% on every ClauseRadar sale") + para("Refer freelancers, creators, job seekers and agencies to ClauseRadar Pro and earn 30% recurring commission on every Pro subscription ($1.50 to $17.70 per sale), paid to your UPI (India) or your USDT TRC20 wallet (global). Get your personal link, track your earnings and request payouts.") + modesBlock() + "<p>" + cta("/refer", "Get your referral link", true) + "</p>");
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
