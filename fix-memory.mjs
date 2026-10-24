import fs from "node:fs";

const file = process.argv[2] || "clauseradar-v3-fixed.mjs";
let s = fs.readFileSync(file, "utf8");
const BT = String.fromCharCode(96);

function fail(msg) {
  console.error("Cannot patch: " + msg);
  process.exit(1);
}
function once(oldText, newText) {
  const n = s.split(oldText).length - 1;
  if (n !== 1) fail("expected 1 match but found " + n + " for:\n  " + oldText.slice(0, 90));
  s = s.replace(oldText, function () { return newText; });
}

const open = 'F("src/lib/memory.js", String.raw' + BT;
const head = 'import { writable, get } from "svelte/store";\nimport { sb, user } from "./app.js";\n\n';
const i = s.indexOf(open);
if (i === -1) fail("the memory.js block was not found. Wrong file, or it is already patched.");
const j = s.indexOf(BT + ");", i) + 3;
const block = s.slice(i, j);
if (block.indexOf(open + head) !== 0) fail("the memory.js block has an unexpected start.");
const body = block.slice(open.length + head.length, block.length - 3);
s = s.slice(0, i) + s.slice(j).replace(/^\n+/, "");

once("// v3: Contract Memory, Scope Guard\n", "// v3: Contract Memory, Scope Guard (the memory helpers live in src/lib/app.js)\n");

once(String.raw`  import { user, isPro, authHeaders, readJson, openAuth, openPay, link } from "./app.js";
  import { saveProject } from "./memory.js";
`, String.raw`  import { user, isPro, authHeaders, readJson, openAuth, openPay, link, saveProject } from "./app.js";
`);
once(String.raw`  import { user, isPro, authHeaders, readJson, openAuth, openPay, link, copyToClipboard, fmt } from "../lib/app.js";
  import { projects, loadProjects, updateProject, scopeUsage } from "../lib/memory.js";
`, String.raw`  import { user, isPro, authHeaders, readJson, openAuth, openPay, link, copyToClipboard, fmt, projects, loadProjects, updateProject, scopeUsage } from "../lib/app.js";
`);
once(String.raw`  import { user, isPro, openAuth, openPay, link, copyToClipboard } from "../lib/app.js";
  import { projects, invoices, loadProjects, loadInvoices, saveInvoice, markInvoicePaid, deleteInvoice } from "../lib/memory.js";
`, String.raw`  import { user, isPro, openAuth, openPay, link, copyToClipboard, projects, invoices, loadProjects, loadInvoices, saveInvoice, markInvoicePaid, deleteInvoice } from "../lib/app.js";
`);
once(String.raw`  import { sb, user, isPro, profile, deviceState, openAuth, openPay, refreshProfile, syncDevice, revokeDevice, signOutThisDevice, fmtDate } from "../lib/app.js";
  import { projects, invoices, loadProjects, loadInvoices, deleteProject, scopeUsage } from "../lib/memory.js";
`, String.raw`  import { sb, user, isPro, profile, deviceState, openAuth, openPay, refreshProfile, syncDevice, revokeDevice, signOutThisDevice, fmtDate, projects, invoices, loadProjects, loadInvoices, deleteProject, scopeUsage } from "../lib/app.js";
`);

once('import { writable, derived } from "svelte/store";', 'import { writable, derived, get } from "svelte/store";');
const anchor = "export function perContract(p) {\n  return Math.round(p.price / (p.credits || 1));\n}\n";
once(anchor, anchor + "\n/* ---------- Contract Memory: projects and invoices (Supabase, row-level security) ---------- */\n" + body);

once(String.raw`  try {
    runBuild(root, BACKUP);`, String.raw`  const missing = written.filter(function (w) { return !fs.existsSync(path.join(root, w.rel)); });
  if (missing.length) {
    console.error("\nWRITE CHECK FAILED. These files are missing after writing: " + missing.map(function (w) { return w.rel; }).join(", "));
    rollback();
    process.exit(1);
  }

  try {
    runBuild(root, BACKUP);`);
once(String.raw`    console.error("Nothing was pushed.");
    rollback();`, String.raw`    try {
      console.error("\nsrc/lib now contains: " + fs.readdirSync(path.join(root, "src", "lib")).join(", "));
      console.error("src/pages now contains: " + fs.readdirSync(path.join(root, "src", "pages")).join(", "));
    } catch (e2) {}
    console.error("Nothing was pushed.");
    rollback();`);

fs.copyFileSync(file, file + ".bak");
fs.writeFileSync(file, s, "utf8");
console.log("Patched " + file + " (backup: " + file + ".bak). Now run: node " + file);
