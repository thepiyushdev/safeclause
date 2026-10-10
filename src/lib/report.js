import { fmt } from "./app.js";

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
