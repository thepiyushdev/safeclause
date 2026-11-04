import { ROUTE_META, SITE, BRAND, OG_IMAGE } from "../src/lib/meta.mjs";
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
  let h = '<p style="display:inline-block;padding:4px 12px;border-radius:999px;background:#eef2ff;color:#3730a3;font-size:14px;font-weight:600">ClauseRadar – contract protection for freelancers, creators, job seekers &amp; agencies</p>';
  h += h1("Audit any contract in 30 seconds. Stop risky clauses before you sign.");
  h += para("ClauseRadar reads your freelance contract, creator brand deal, job offer letter or agency agreement, flags the traps (Net-90 payments, perpetual ad rights, employment bonds, pay-when-paid clauses), explains each risk in plain English and writes the counter-email for you.");
  h += "<p>" + cta("/dashboard", "Upload Contract", true) + cta("/sample", "View Sample Audit Report", false) + "</p>";
  h += sec("Freelancers and developers", ["Scan client contracts for scope creep, Net-60 and Net-90 payment traps, uncapped liability and IP grabs."]);
  h += sec("BrandDeal Shield for creators and influencers", ["Check brand sponsorship agreements for perpetual ad usage and whitelisting rights, category exclusivity, reshoots, payment deadlines and kill fees."]);
  h += sec("Offer Letter and Bond Shield for job seekers", ["Check job offers for service bonds, 90-day notice buyouts, side-project IP claims and non-competes, with Section 27 of the Indian Contract Act 1872 in mind for India."]);
  h += sec("Agency White-Label Shield", ["Check sub-contractor and agency agreements for pay-when-paid traps, non-solicitation, portfolio restrictions, SLA penalties and uncapped indemnification."]);
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
    return wrap(h1("Contract scanner") + para("Upload a PDF or DOCX, or paste contract text, and pick a mode: freelance client contract, BrandDeal Shield for creator sponsorships, Offer Letter and Bond Shield for job seekers, or Agency White-Label Shield. ClauseRadar flags the risky clauses, explains each one in plain English and suggests a safer rewrite.") + "<p>" + cta("/sample", "View Sample Audit Report", false) + "</p>");
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
  if (p === "/refer") {
    return wrap(h1("Earn 30% on every ClauseRadar sale") + para("Refer friends to ClauseRadar Pro and earn 30% cash on every verified payment (₹150 per month or ₹1,200 per year per user), paid to your UPI. Get your personal link, track your earnings and request payouts.") + "<p>" + cta("/refer", "Get your referral link", true) + "</p>");
  }
  if (p === "/radar") {
    return wrap(h1("Freelance contract risk calculator") + para("Enter your project fee, payment terms, liability, IP transfer and revision limits to estimate what late payment, unpaid revisions and uncapped liability could cost you."));
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
