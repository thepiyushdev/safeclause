import { ROUTE_META, SITE, BRAND, OG_IMAGE } from "../src/lib/meta.mjs";
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
