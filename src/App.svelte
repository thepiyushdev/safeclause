<script>
  import { onMount, onDestroy } from "svelte";
  import { createClient } from "@supabase/supabase-js";

  const SB_URL = import.meta.env.VITE_SUPABASE_URL;
  const SB_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const sb = SB_URL && SB_KEY ? createClient(SB_URL, SB_KEY) : null;

  const UPI_ID = "8796021247@fam";
  const MAX_CHARS = 10000;
  // Set to your REAL number of audits run. While it is 0, no scan counter is shown anywhere.
  const SCANNED_COUNT = 0;

  /* ---------- router ---------- */
  const ROUTES = ["home", "audit", "radar", "vault", "pricing", "account"];
  const NAV = [
    { id: "home", label: "Home" },
    { id: "audit", label: "Audit Scanner" },
    { id: "radar", label: "Risk Radar" },
    { id: "vault", label: "Clause Vault" },
    { id: "pricing", label: "Pricing" },
  ];
  let currentRoute = "home";
  let menuOpen = false;

  const PACKS = [
    { id: 1, credits: 1, price: 49, icon: "⚡", name: "Single Audit Pass", popular: false,
      features: ["1 full contract unlock", "All counter-clauses + emails", "PDF safety report"] },
    { id: 3, credits: 3, price: 129, icon: "🛡️", name: "Freelancer Shield Pack", popular: true,
      features: ["3 full contract unlocks", "Save ₹18 vs singles", "PDF safety report"] },
    { id: 8, credits: 8, price: 299, icon: "👑", name: "Agency / Power Pack", popular: false,
      features: ["8 full contract unlocks", "Lowest price per contract", "Built for agencies and teams"] },
  ];

  const PLACEHOLDER =
    "The Contractor shall invoice the Client upon delivery and the Client shall pay each invoice within fourteen (14) days. Late amounts accrue interest. Liability is limited to the fees paid under this Agreement. Ownership of all deliverables transfers only after payment in full.";
  const PLACEHOLDER_EMAIL =
    "Subject: Request to update payment and liability terms\n\nHi [Client Name],\n\nThank you for sending the agreement. Before signing, I would like to propose a few changes so both sides are protected...";

  const SAMPLES = {
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

  const VAULT_CATS = ["All", "Payment", "IP", "Liability", "Scope", "Termination"];
  const VAULT = [
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

  const DEMOS = [
    { label: "Payment", bad: "The Contractor will be paid within 90 days after project completion, and the Client may withhold payment if it is not fully satisfied.", good: "Invoices are due within fourteen (14) days of the invoice date. Unpaid amounts accrue a late fee of 1.5% per month.", threat: "Net-90 plus a vague satisfaction test means you finance the client for months and they can walk away without paying.", win: "A clear Net-14 deadline with a late fee puts the cashflow risk back on the client." },
    { label: "IP", bad: "All work, drafts and materials belong to the Client from the moment of creation, whether or not payment has been made.", good: "Ownership of deliverables transfers to the Client only upon receipt of full payment.", threat: "The client can use your work and never pay, and you have little leverage to get paid.", win: "You keep ownership until the invoice is paid, which gives you real leverage." },
    { label: "Liability", bad: "The Contractor is liable for all direct, indirect and consequential losses of the Client, without any limit.", good: "The Contractor total liability shall not exceed the fees paid under this Agreement.", threat: "One bug could cost you far more than the project was worth.", win: "Your worst-case loss is capped at what you were actually paid." },
  ];

  const PAINS = [
    { icon: "🧊", title: "Net-90 cashflow freeze", text: "A ₹50,000 project on Net-90 means you fund three months of rent, tools and time before you see a rupee." },
    { icon: "🔓", title: "IP grab before payment", text: "If the contract says everything belongs to the client from creation, they can use your work and you have little leverage to get paid." },
    { icon: "💥", title: "Uncapped liability", text: "An unlimited liability clause lets a client claim losses far above your fee when something breaks after launch." },
  ];

  const COMPARE = [
    ["Payment terms", "Net-90 buried in clause 4. You find out in month 3.", "Flagged instantly, with a Net-14 counter-clause ready to paste."],
    ["IP ownership", "Ownership transfers on creation, even if unpaid.", "Ownership moves only after full payment."],
    ["Liability", "Uncapped. One bug can cost more than the project.", "Capped at the fees you were paid."],
    ["Revisions", "Unlimited revisions and unpaid scope creep.", "Revision cap plus paid change requests."],
    ["Pushback", "You stay silent or write an awkward email.", "A polite, ready-to-send email for every clause."],
    ["Time", "Hours of legalese, still unsure.", "Seconds to a risk-rated summary."],
  ];

  const FAQS = [
    { q: "Is this legal advice?", a: "No. SafeClause is an automated AI review tool, not a law firm. It highlights common risks and suggests standard protective wording. For high-value or unusual contracts, have a qualified lawyer review the final terms." },
    { q: "How fast is the audit?", a: "Most audits finish in a few seconds. Longer contracts (up to 10,000 characters) can take a little longer." },
    { q: "Will asking for changes upset my client?", a: "The negotiation emails are written to be polite and professional, presenting changes as standard protective terms. Many clients accept balanced terms, but there are no guarantees, and you decide what to send." },
    { q: "What does 1 credit unlock?", a: "One credit unlocks every flagged clause of one audited contract: all safe counter-clauses and all negotiation emails, plus the full PDF report." },
    { q: "How fast is payment verification?", a: "After you upload your UPI screenshot, AI checks the amount, receiver and status, usually within a minute. Upload the full success screen with the transaction ID visible. Reused screenshots or transaction IDs are rejected." },
    { q: "Is my contract stored?", a: "We do not save your contract text in our database. It is sent to a third-party AI provider to generate the audit, so avoid pasting anything you are not allowed to share." },
    { q: "Does it work for Indian contracts?", a: "Yes. Choose the India setting and the audit is tuned for the Indian Contract Act 1872 and MSMED Act payment norms. Choose Global for US, UK and remote contracts." },
  ];

  const TERMS = [14, 30, 45, 60, 90, 120];
  const STEPS = [
    { n: "1", t: "Tap to pay", d: "Choose a pack and tap the UPI button. GPay, PhonePe or Paytm opens with the amount filled in." },
    { n: "2", t: "Screenshot the success screen", d: "Capture the full payment-success screen with the amount, receiver and transaction ID visible." },
    { n: "3", t: "Upload and verify", d: "Upload it in the payment window. AI checks the details and adds your credits." },
  ];
  const BADGES = [
    { i: "🔒", t: "Contract text not saved", d: "Your contract is not stored in our database." },
    { i: "✅", t: "Every payment verified", d: "Amount, receiver, status and transaction ID are checked." },
    { i: "🧾", t: "Pay per contract", d: "No subscription. Buy credits only when you need them." },
    { i: "📲", t: "Direct UPI", d: "Pay straight from GPay, PhonePe or Paytm." },
  ];

  let session = null;
  let credits = 0;
  let jur = "india";

  let contractText = "";
  let loading = false;
  let error = "";
  let result = null;
  let unlockedData = {};
  let unlockError = "";
  let unlocking = false;
  let copied = "";
  let pdfBusy = false;
  let pdfInput;

  let demoIdx = 0;
  let demoSafe = false;

  let vaultQuery = "";
  let vaultCat = "All";

  let calcValue = 50000;
  let calcTerms = 90;
  let calcLiab = "uncapped";
  let calcIp = "creation";
  let calcRev = "unlimited";
  let calcRate = 12;

  let authOpen = false;
  let authMode = "login";
  let authNote = "";
  let email = "";
  let password = "";
  let authMsg = "";
  let authOk = false;
  let authBusy = false;
  let showRecovery = false;
  let newPassword = "";

  let payOpen = false;
  let packId = 1;
  let shot = null;
  let shotInput;
  let payBusy = false;
  let payMsg = "";
  let payOk = false;

  let sub = null;

  const STAT_DELAY = money(computeRisk(50000, 90, "capped", "payment", "limited", 12).delayCost, "india");

  $: user = session ? session.user : null;
  $: initial = user && user.email ? user.email.charAt(0).toUpperCase() : "";
  $: if (user) { refreshCredits(user.id); } else { credits = 0; }
  $: pack = PACKS.find(function (p) { return p.id === packId; }) || PACKS[0];
  $: upiLink = "upi://pay?pa=" + UPI_ID + "&pn=SafeClause&am=" + pack.price + "&cu=INR&tn=SafeClause_Credit";
  $: flagged = result && Array.isArray(result.flagged_clauses) ? result.flagged_clauses : [];
  $: highCount = flagged.filter(function (c) { return c.risk_level === "HIGH"; }).length;
  $: allUnlocked = flagged.length > 0 && flagged.every(function (c, i) { return !!unlockedData[i]; });
  $: calcResult = computeRisk(calcValue, calcTerms, calcLiab, calcIp, calcRev, calcRate);
  $: demo = DEMOS[demoIdx];
  $: vaultFiltered = filterVault(VAULT, vaultQuery, vaultCat);

  onMount(async function () {
    const r0 = routeFromHash();
    if (r0) currentRoute = r0;
    window.addEventListener("hashchange", onHash);
    if (!sb) return;
    const res0 = await sb.auth.getSession();
    session = res0.data ? res0.data.session : null;
    const res = sb.auth.onAuthStateChange(function (event, s) {
      session = s;
      if (event === "PASSWORD_RECOVERY") showRecovery = true;
    });
    sub = res.data.subscription;
  });
  onDestroy(function () {
    if (typeof window !== "undefined") window.removeEventListener("hashchange", onHash);
    if (sub) sub.unsubscribe();
  });

  /* ---------- router functions ---------- */
  function routeFromHash() {
    const m = String(window.location.hash || "").match(/^#\/([a-z]+)$/);
    return m && ROUTES.indexOf(m[1]) !== -1 ? m[1] : null;
  }

  function onHash() {
    const r = routeFromHash();
    if (r) {
      currentRoute = r;
      menuOpen = false;
      window.scrollTo(0, 0);
    }
  }

  function go(r) {
    if (ROUTES.indexOf(r) === -1) return;
    currentRoute = r;
    menuOpen = false;
    try {
      if (window.location.hash !== "#/" + r) window.location.hash = "#/" + r;
    } catch (e) {}
    window.scrollTo(0, 0);
  }

  /* ---------- helpers ---------- */
  async function refreshCredits(uid) {
    try {
      const r = await sb.from("profiles").select("credits").eq("id", uid).maybeSingle();
      credits = r.data && Number.isFinite(r.data.credits) ? r.data.credits : 0;
    } catch (e) {}
  }

  async function authHeaders() {
    const r = await sb.auth.getSession();
    const t = r.data && r.data.session ? r.data.session.access_token : "";
    return { "Content-Type": "application/json", Authorization: "Bearer " + t };
  }

  async function readJson(r) {
    const raw = await r.text();
    try { return JSON.parse(raw); } catch (e) { return { error: "Server error (HTTP " + r.status + ")" }; }
  }

  function fmt(s) {
    return String(s || "").replace(/\r\n/g, "\n").replace(/\\n/g, "\n");
  }

  function esc(s) {
    return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function riskClass(l) {
    return l === "HIGH" ? "high" : l === "LOW" ? "low" : "med";
  }

  function meterPos(l) {
    return l === "HIGH" ? 84 : l === "LOW" ? 16 : 50;
  }

  function shortCredits(n) {
    const v = Number(n) || 0;
    return v >= 10000 ? Math.floor(v / 100) / 10 + "k" : String(v);
  }

  function perContract(p) {
    return Math.round(p.price / p.credits);
  }

  function money(n, j) {
    const v = Math.round(Number(n) || 0);
    return (j === "india" ? "₹" : "$") + v.toLocaleString(j === "india" ? "en-IN" : "en-US");
  }

  function scrollToId(id) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function pickDemo(i) {
    demoIdx = i;
    demoSafe = false;
  }

  function filterVault(list, q, cat) {
    const needle = String(q || "").trim().toLowerCase();
    return list.filter(function (v) {
      const okCat = cat === "All" || v.cat === cat;
      const okQ = !needle || (v.title + " " + v.text + " " + v.cat).toLowerCase().indexOf(needle) !== -1;
      return okCat && okQ;
    });
  }

  /* ---------- risk calculator (illustrative model) ---------- */
  function computeRisk(value, terms, liab, ip, rev, rate) {
    const v = Math.max(0, Number(value) || 0);
    const days = Number(terms) || 0;
    const delayCost = v * (Math.max(0, Number(rate) || 0) / 100) * (days / 365);
    const revLeak = rev === "unlimited" ? v * 0.15 : 0;
    const ipAtRisk = ip === "creation" ? v : 0;
    const uncapped = liab === "uncapped";
    let score = 0;
    score += days >= 90 ? 3 : days >= 60 ? 2 : days >= 30 ? 1 : 0;
    score += uncapped ? 3 : 0;
    score += ip === "creation" ? 2 : 0;
    score += rev === "unlimited" ? 2 : 0;
    const level = score >= 6 ? "HIGH" : score >= 3 ? "MEDIUM" : "LOW";
    return { v: v, days: days, delayCost: delayCost, revLeak: revLeak, ipAtRisk: ipAtRisk, uncapped: uncapped, level: level };
  }

  /* ---------- auth ---------- */
  function openAuth(mode, note) {
    authMode = mode || "login";
    authNote = note || "";
    authMsg = "";
    authOk = false;
    authOpen = true;
  }

  async function submitAuth(e) {
    if (e) e.preventDefault();
    if (!sb) { authMsg = "Login is not configured yet (Supabase keys missing)."; return; }
    authBusy = true;
    authMsg = "";
    authOk = false;
    try {
      if (authMode === "forgot") {
        const r = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
        if (r.error) throw r.error;
        authOk = true;
        authMsg = "Password reset link sent. Check your email.";
      } else if (authMode === "signup") {
        const r = await sb.auth.signUp({ email: email.trim(), password: password, options: { emailRedirectTo: window.location.origin } });
        if (r.error) throw r.error;
        if (r.data && r.data.session) {
          authOpen = false;
        } else {
          authOk = true;
          authMsg = "Account created. Check your email to confirm, then log in.";
        }
      } else {
        const r = await sb.auth.signInWithPassword({ email: email.trim(), password: password });
        if (r.error) throw r.error;
        authOpen = false;
        password = "";
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
      showRecovery = false;
      newPassword = "";
    } catch (err) {
      authMsg = err && err.message ? err.message : "Could not update password.";
    } finally {
      authBusy = false;
    }
  }

  async function signOut() {
    if (sb) await sb.auth.signOut();
    unlockedData = {};
    unlockError = "";
    go("home");
  }

  /* ---------- contract input ---------- */
  function loadSample(key) {
    contractText = SAMPLES[key];
    jur = key === "india" ? "india" : "global";
    error = "";
  }

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

  async function onPdf(e) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    error = "";
    if (f.size > 10 * 1024 * 1024) { error = "PDF is too large (max 10 MB)."; return; }
    pdfBusy = true;
    try {
      const lib = await loadPdfJs();
      const doc = await lib.getDocument({ data: await f.arrayBuffer() }).promise;
      let out = "";
      const pages = Math.min(doc.numPages, 30);
      for (let p = 1; p <= pages && out.length < MAX_CHARS; p++) {
        const page = await doc.getPage(p);
        const tc = await page.getTextContent();
        out += tc.items.map(function (it) { return it.str; }).join(" ") + "\n";
      }
      out = out.replace(/[ \t]+/g, " ").trim();
      if (!out) throw new Error("No text found. This looks like a scanned PDF. Paste the text instead.");
      contractText = out.slice(0, MAX_CHARS);
    } catch (err) {
      error = err && err.message ? err.message : "Could not read this PDF.";
    } finally {
      pdfBusy = false;
      if (pdfInput) pdfInput.value = "";
    }
  }

  /* ---------- audit ---------- */
  // The jurisdiction is passed to the AI as a short note placed before the contract text.
  function jurisdictionNote() {
    if (jur === "india") {
      return "[AUDITOR NOTE - not part of the contract: the freelancer works under Indian law. Consider the Indian Contract Act 1872 (for example restraint-of-trade clauses) and MSMED Act 2006 payment-period norms (45 days) when judging risk and writing counter-clauses. Never quote this note.]\n\n";
    }
    return "[AUDITOR NOTE - not part of the contract: the freelancer works remotely under US, UK or international terms. Prefer standard Net-14 or Net-30 payment, IP assignment only after full payment, and a liability cap equal to fees paid. Never quote this note.]\n\n";
  }

  async function runAudit() {
    error = "";
    const text = contractText.trim();
    if (text.length < 50) { error = "Paste your contract text first (at least a few lines)."; return; }
    loading = true;
    result = null;
    unlockedData = {};
    unlockError = "";
    try {
      const note = jurisdictionNote();
      const payload = note + text.slice(0, MAX_CHARS - note.length);
      const r = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: payload, jurisdiction: jur }),
      });
      const data = await readJson(r);
      if (!r.ok) throw new Error(data.error || "Server error (HTTP " + r.status + ")");
      result = data;
      setTimeout(function () { scrollToId("results"); }, 80);
    } catch (err) {
      error = err && err.message ? err.message : "Something went wrong. Please try again.";
    } finally {
      loading = false;
    }
  }

  // 1 credit unlocks EVERY flagged clause of this audit in a single request.
  async function unlockAll() {
    error = "";
    if (!user) { openAuth("login", "Log in to unlock. Your credits are saved to your account."); return; }
    if (credits < 1) { openPay(1); return; }
    if (flagged.length === 0 || unlocking) return;
    unlocking = true;
    unlockError = "";
    try {
      const headers = await authHeaders();
      if (headers.Authorization === "Bearer ") throw new Error("Session expired. Please log in again.");
      const tokens = flagged.map(function (c) { return c.locked_token; });
      const r = await fetch("/api/unlock", {
        method: "POST",
        headers: headers,
        body: JSON.stringify({ tokens: tokens }),
      });
      const data = await readJson(r);
      if (r.status === 401) throw new Error("Session expired. Please log in again.");
      if (!r.ok || !data.success || !Array.isArray(data.unlocked)) {
        throw new Error(data.error || "Unlock failed (HTTP " + r.status + ").");
      }
      const map = {};
      data.unlocked.forEach(function (u) { map[u.index] = u; });
      unlockedData = map;
      credits = data.credits;
    } catch (err) {
      let msg = err && err.message ? err.message : "Unlock failed.";
      if (err instanceof TypeError) msg = "Network error. Check your connection and try again.";
      unlockError = msg;
    } finally {
      unlocking = false;
    }
  }

  /* ---------- PDF safety report (browser print dialog, "Save as PDF") ---------- */
  const REPORT_CSS = "body{font-family:Arial,Helvetica,sans-serif;color:#111;max-width:760px;margin:24px auto;padding:0 18px;line-height:1.5}h1{font-size:22px;margin:0}h2{font-size:15px;margin:22px 0 6px}.sub{color:#555;font-size:12px}.badge{display:inline-block;padding:2px 10px;border-radius:99px;font-size:11px;font-weight:700;background:#eee}.clause{border:1px solid #ddd;border-radius:8px;padding:12px 14px;margin:14px 0;page-break-inside:avoid}.q{border-left:3px solid #d33;padding:6px 10px;background:#faf3f3;font-style:italic;white-space:pre-wrap}.t{white-space:pre-wrap}.lbl{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#666;margin:10px 0 3px}.foot{margin-top:24px;font-size:11px;color:#666;border-top:1px solid #ddd;padding-top:10px}";

  function buildReportHtml() {
    let h = '<!doctype html><html><head><meta charset="utf-8"><title>SafeClause Audit Report</title><sty' + "le>" + REPORT_CSS + "</sty" + "le></head><body>";
    h += "<h1>🛡️ SafeClause Contract Safety Report</h1>";
    h += '<div class="sub">Generated ' + esc(new Date().toLocaleDateString()) + " • " + (jur === "india" ? "India" : "US / UK / Global") + " review</div>";
    h += "<h2>Overall risk: " + esc(result.overall_risk_score) + "</h2>";
    h += '<div class="t">' + esc(fmt(result.executive_summary)) + "</div>";
    flagged.forEach(function (c, i) {
      h += '<div class="clause"><b>' + esc(c.category) + '</b> <span class="badge">' + esc(c.risk_level) + " RISK</span>";
      h += '<div class="lbl">Problematic fine print</div><div class="q">' + esc(fmt(c.problematic_fine_print)) + "</div>";
      h += '<div class="lbl">Why it hurts</div><div class="t">' + esc(fmt(c.why_it_hurts)) + "</div>";
      if (unlockedData[i]) {
        h += '<div class="lbl">Safe counter-clause</div><div class="t">' + esc(fmt(unlockedData[i].safe_counter_clause)) + "</div>";
        h += '<div class="lbl">Suggested negotiation email</div><div class="t">' + esc(fmt(unlockedData[i].polite_client_negotiation_email)) + "</div>";
      }
      h += "</div>";
    });
    if (!allUnlocked) {
      h += '<div class="foot"><b>Preview report.</b> Unlock this audit in SafeClause to include counter-clauses and negotiation emails.</div>';
    }
    h += '<div class="foot">SafeClause is an automated AI review tool, not a law firm. This report is not legal advice.</div></body></html>';
    return h;
  }

  function downloadReport() {
    if (!result) return;
    const w = window.open("", "_blank");
    if (!w) { error = "Allow pop-ups for this site to download the PDF report."; return; }
    w.document.open();
    w.document.write(buildReportHtml());
    w.document.close();
    setTimeout(function () { try { w.focus(); w.print(); } catch (e) {} }, 500);
  }

  async function copyText(text, id) {
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
    copied = id;
    setTimeout(function () { if (copied === id) copied = ""; }, 1800);
  }

  /* ---------- payments ---------- */
  function openPay(id) {
    if (!user) { openAuth("login", "Log in first so your credits are added to your account."); return; }
    packId = id || 1;
    payMsg = "";
    payOk = false;
    payOpen = true;
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
      credits = data.credits;
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

<svelte:head>
  <title>SafeClause - AI Contract Risk Audit for Freelancers</title>
  <meta name="description" content="Scan client contracts in seconds. Spot hidden liability traps, Net-90 payment delays and IP risks before you sign." />
</svelte:head>

<div class="app">
  <!-- NAVBAR (persists on every view) -->
  <div class="navwrap">
    <header class="nav">
      <button class="logo" on:click={() => go("home")}><span>🛡️</span><span>SafeClause</span></button>
      <nav class="links-d">
        {#each NAV as n}
          <button class:active={currentRoute === n.id} on:click={() => go(n.id)}>{n.label}</button>
        {/each}
      </nav>
      <div class="nav-right">
        <button class="chip" on:click={() => go("pricing")} title={credits + " credits"}>⚡ {shortCredits(credits)}</button>
        <button class="btn sm accent" on:click={() => openPay(1)}><span class="long">Buy Credits</span><span class="short">Buy</span></button>
        {#if user}
          <button class="avatar" on:click={() => go("account")} title={user.email}>{initial}</button>
        {:else}
          <button class="btn sm" on:click={() => openAuth("login")}>Login</button>
        {/if}
        <button class="burger" aria-label="Menu" on:click={() => (menuOpen = !menuOpen)}>{menuOpen ? "✕" : "☰"}</button>
      </div>
    </header>
    {#if menuOpen}
      <nav class="menu">
        {#each NAV as n}
          <button class:active={currentRoute === n.id} on:click={() => go(n.id)}>{n.label}</button>
        {/each}
        {#if user}<button class:active={currentRoute === "account"} on:click={() => go("account")}>Account</button>{/if}
      </nav>
    {/if}
  </div>

  <main class="view">
    {#if currentRoute === "home"}
      <!-- ============ VIEW: HOME ============ -->
      <section class="hero wrap">
        <div class="pill">
          {#if SCANNED_COUNT > 0}
            ✅ Over {SCANNED_COUNT.toLocaleString("en-IN")}+ contracts scanned
          {:else}
            🇮🇳 Built for freelancers in India &amp; the US
          {/if}
        </div>
        <h1>Never sign a contract that <span class="grad">can bankrupt you.</span></h1>
        <p class="sub">Scan client contracts in seconds. Spot hidden liability traps, Net-90 payment delays, and IP theft before you sign.</p>
        <div class="cta-row">
          <button class="btn primary big" on:click={() => go("audit")}>Launch Audit Scanner ⚡</button>
          <button class="btn big" on:click={() => go("radar")}>Test Risk Calculator 💸</button>
        </div>
        <div class="trust">
          <span>⚡ Results in seconds</span><span>🔒 Contract text not saved</span><span>📄 PDF safety report</span>
        </div>
      </section>

      <section class="wrap narrow">
        <div class="glass demo">
          <div class="demo-head">
            <b>See a trap get fixed</b>
            <span class="muted small">Illustrative example</span>
          </div>
          <div class="chips">
            {#each DEMOS as d, i}
              <button class:on={demoIdx === i} on:click={() => pickDemo(i)}>{d.label}</button>
            {/each}
          </div>
          <div class="demo-tag" class:ok={demoSafe}>{demoSafe ? "✅ SafeClause rewrite" : "⚠️ Predatory clause"}</div>
          <blockquote class:good={demoSafe}>{demoSafe ? demo.good : demo.bad}</blockquote>
          <p class="muted">{demoSafe ? demo.win : demo.threat}</p>
          <div class="row">
            <button class="btn primary" on:click={() => (demoSafe = !demoSafe)}>{demoSafe ? "↺ Show original" : "Rewrite with SafeClause ✨"}</button>
            <button class="btn" on:click={() => go("audit")}>Try it on my contract</button>
          </div>
        </div>
      </section>

      <section class="wrap sec">
        <h2 class="sec-title">Why freelancers lose money</h2>
        <p class="sec-sub">Common contract traps, shown as illustrative examples.</p>
        <div class="grid3">
          {#each PAINS as p}
            <div class="glass card pain">
              <div class="pain-ic">{p.icon}</div>
              <h3 class="pain-t">{p.title}</h3>
              <p class="muted">{p.text}</p>
            </div>
          {/each}
        </div>
      </section>

      <section class="wrap sec">
        <h2 class="sec-title">Before vs after SafeClause</h2>
        <div class="glass tbl-wrap">
          <table>
            <thead><tr><th></th><th>Signing blindly</th><th>With SafeClause</th></tr></thead>
            <tbody>
              {#each COMPARE as r}
                <tr><td>{r[0]}</td><td class="bad">{r[1]}</td><td class="good">{r[2]}</td></tr>
              {/each}
            </tbody>
          </table>
        </div>
      </section>

      <section class="wrap sec">
        <h2 class="sec-title">SafeClause by the numbers</h2>
        <p class="sec-sub">What every audit covers, plus one worked example.</p>
        <div class="stats">
          {#if SCANNED_COUNT > 0}
            <div class="glass stat"><b>{SCANNED_COUNT.toLocaleString("en-IN")}+</b><span>contracts scanned</span></div>
          {/if}
          <div class="glass stat"><b>3-5</b><span>riskiest clauses flagged per audit</span></div>
          <div class="glass stat"><b>10,000</b><span>characters analysed per contract</span></div>
          <div class="glass stat"><b>2</b><span>jurisdiction modes: India and Global</span></div>
          <div class="glass stat"><b>{STAT_DELAY}</b><span>cost of waiting 90 days on a ₹50,000 invoice at 12% a year (illustrative)</span></div>
        </div>
      </section>

      <section class="wrap sec narrow">
        <h2 class="sec-title">Frequently asked questions</h2>
        {#each FAQS as f}
          <details class="glass faq">
            <summary>{f.q}</summary>
            <p>{f.a}</p>
          </details>
        {/each}
      </section>

      <section class="wrap sec">
        <div class="final">
          <h2>Ready to protect your next freelance invoice?</h2>
          <p>Paste the contract, see the risks, and walk into the negotiation with the right clauses ready.</p>
          <button class="btn primary big" on:click={() => go("audit")}>Launch Audit Scanner ⚡</button>
        </div>
      </section>

    {:else if currentRoute === "audit"}
      <!-- ============ VIEW: AUDIT ============ -->
      <div class="wrap narrow">
        <div class="vhead"><h1>Audit Scanner</h1><p class="muted">Paste a contract and get a risk-rated breakdown in seconds.</p></div>

        <div class="seg" role="group" aria-label="Jurisdiction">
          <button class:on={jur === "india"} on:click={() => (jur = "india")}>🇮🇳 India <small>(Act 1872 / MSMED)</small></button>
          <button class:on={jur === "global"} on:click={() => (jur = "global")}>🌐 US / UK / Remote Global</button>
        </div>

        <section class="glass card">
          <div class="row">
            <button class="btn sm" on:click={() => loadSample("india")}>Sample India</button>
            <button class="btn sm" on:click={() => loadSample("us")}>Sample US</button>
            <label class="btn sm file">
              {pdfBusy ? "Reading PDF..." : "📄 Upload PDF"}
              <input type="file" accept="application/pdf" on:change={onPdf} bind:this={pdfInput} disabled={pdfBusy} hidden />
            </label>
          </div>
          <textarea bind:value={contractText} rows="11" maxlength={MAX_CHARS} placeholder="Paste your client contract here, or upload a PDF..."></textarea>
          <div class="count">{contractText.length} / {MAX_CHARS} characters</div>
          <button class="btn primary block big" class:loading={loading} on:click={runAudit} disabled={loading}>
            {loading ? "Scanning every clause..." : "Run Instant AI Risk Audit ⚡"}
          </button>
          {#if error}
            <div class="error" role="alert">⚠️ {error}</div>
          {/if}
        </section>

        {#if result}
          <section id="results" class="glass card">
            <div class="row between">
              <h2>Executive Risk Meter</h2>
              <span class="badge {riskClass(result.overall_risk_score)}">{result.overall_risk_score} RISK</span>
            </div>
            <div class="meter"><div class="meter-pin" style="left: {meterPos(result.overall_risk_score)}%"></div></div>
            <div class="meter-labels"><span>LOW</span><span>MEDIUM</span><span>HIGH</span></div>
            <p class="pre">{fmt(result.executive_summary)}</p>
            <p class="muted">{flagged.length} flagged clause{flagged.length === 1 ? "" : "s"} • {highCount} high risk</p>
            {#if flagged.length > 0}
              <button class="btn sm" on:click={downloadReport}>📄 {allUnlocked ? "Download Full PDF Report" : "Download PDF Preview Report"}</button>
              <span class="muted small"> Choose "Save as PDF" in the print window.</span>
            {/if}
          </section>

          {#each flagged as c, i}
            <article class="glass card">
              <div class="row between">
                <span class="cat">{c.category}</span>
                <span class="badge {riskClass(c.risk_level)}">{c.risk_level} RISK</span>
              </div>

              <h3>Problematic Fine Print</h3>
              <blockquote>{fmt(c.problematic_fine_print)}</blockquote>

              <h3>Why It Hurts You</h3>
              <p class="pre">{fmt(c.why_it_hurts)}</p>

              <div class="locked-wrap">
                {#if unlockedData[i]}
                  <div class="premium">
                    <h3>Safe Counter-Clause</h3>
                    <div class="box pre">{fmt(unlockedData[i].safe_counter_clause)}</div>
                    <button class="btn sm" on:click={() => copyText(unlockedData[i].safe_counter_clause, "c" + i)}>
                      {copied === "c" + i ? "Copied ✓" : "Copy Clause"}
                    </button>
                    <h3>Polite Client Negotiation Email</h3>
                    <div class="box pre">{fmt(unlockedData[i].polite_client_negotiation_email)}</div>
                    <button class="btn sm" on:click={() => copyText(unlockedData[i].polite_client_negotiation_email, "e" + i)}>
                      {copied === "e" + i ? "Copied ✓" : "Copy Email"}
                    </button>
                  </div>
                {:else}
                  <div class="premium blurred" aria-hidden="true">
                    <h3>Safe Counter-Clause</h3>
                    <div class="box pre">{PLACEHOLDER}</div>
                    <h3>Polite Client Negotiation Email</h3>
                    <div class="box pre">{PLACEHOLDER_EMAIL}</div>
                  </div>
                  <div class="lock-overlay">
                    <div class="lock-card">
                      <div class="lock-title">🔒 Counter-Clause &amp; Negotiation Email Locked</div>
                      <button class="btn primary block" on:click={unlockAll} disabled={unlocking}>
                        {#if unlocking}
                          Unlocking all clauses...
                        {:else if credits < 1}
                          Unlock All Clauses for ₹49 (Get 1 Credit) ⚡
                        {:else}
                          Use 1 Credit to Unlock All Clauses (Balance: {credits}) ⚡
                        {/if}
                      </button>
                      {#if unlockError}
                        <div class="error" role="alert">⚠️ {unlockError}</div>
                      {/if}
                    </div>
                  </div>
                {/if}
              </div>
            </article>
          {/each}

          {#if flagged.length === 0}
            <section class="glass card"><p>No major red flags found in the text you pasted. ✅</p></section>
          {/if}
        {/if}
      </div>

    {:else if currentRoute === "radar"}
      <!-- ============ VIEW: RISK RADAR ============ -->
      <div class="wrap narrow">
        <div class="vhead"><h1>Risk Radar</h1><p class="muted">Estimate your financial exposure before you sign.</p></div>

        <section class="glass card">
          <h2>💸 Contract Risk &amp; Loss Calculator</h2>
          <div class="seg slim">
            <button class:on={jur === "india"} on:click={() => (jur = "india")}>🇮🇳 INR</button>
            <button class:on={jur === "global"} on:click={() => (jur = "global")}>🌐 USD</button>
          </div>
          <div class="grid2">
            <label>Project fee ({jur === "india" ? "₹" : "$"})
              <input type="number" min="0" inputmode="numeric" bind:value={calcValue} />
            </label>
            <label>Payment terms
              <select bind:value={calcTerms}>
                {#each TERMS as t}<option value={t}>Net-{t}</option>{/each}
              </select>
            </label>
            <label>Liability type
              <select bind:value={calcLiab}>
                <option value="capped">Capped at fees paid</option>
                <option value="uncapped">Uncapped</option>
              </select>
            </label>
            <label>IP transfer condition
              <select bind:value={calcIp}>
                <option value="payment">Transfers after full payment</option>
                <option value="creation">Transfers on creation</option>
              </select>
            </label>
            <label>Revision limits
              <select bind:value={calcRev}>
                <option value="limited">Limited rounds</option>
                <option value="unlimited">Unlimited</option>
              </select>
            </label>
            <label>Your cost of money (% / year)
              <input type="number" min="0" max="60" inputmode="numeric" bind:value={calcRate} />
            </label>
          </div>
        </section>

        <section class="glass card">
          <div class="row between">
            <h2>Your estimated exposure</h2>
            <span class="badge {riskClass(calcResult.level)}">{calcResult.level} RISK</span>
          </div>
          <div class="meter"><div class="meter-pin" style="left: {meterPos(calcResult.level)}%"></div></div>
          <div class="meter-labels"><span>LOW</span><span>MEDIUM</span><span>HIGH</span></div>
          <ul class="lines">
            <li><span>⏳ Cashflow frozen for</span><b>{calcResult.days} days</b></li>
            <li><span>Cost of delayed capital</span><b>{money(calcResult.delayCost, jur)}</b></li>
            {#if calcResult.revLeak > 0}
              <li><span>Estimated unpaid revision leak</span><b>{money(calcResult.revLeak, jur)}</b></li>
            {/if}
            {#if calcResult.ipAtRisk > 0}
              <li><span>Fee at risk if the client keeps the work unpaid</span><b>{money(calcResult.ipAtRisk, jur)}</b></li>
            {/if}
            <li><span>Liability ceiling</span><b>{calcResult.uncapped ? "None (uncapped)" : money(calcResult.v, jur)}</b></li>
          </ul>
          <p class="muted small">Illustrative model, not a prediction: delayed-capital cost = fee × your yearly cost of money × days ÷ 365, and unlimited revisions are assumed to add unpaid work worth about 15% of the fee.</p>
          <button class="btn primary block" on:click={() => go("audit")}>Now Audit Your Real Contract Against These Traps ⚡</button>
        </section>
      </div>

    {:else if currentRoute === "vault"}
      <!-- ============ VIEW: CLAUSE VAULT ============ -->
      <div class="wrap narrow">
        <div class="vhead"><h1>Clause Vault</h1><p class="muted">Contractor-friendly clauses. Copy, paste, and fill in the [brackets]. Have a lawyer review high-value deals.</p></div>

        <input class="vsearch" type="search" placeholder="Search clauses (e.g. kill fee, deposit, liability)..." bind:value={vaultQuery} />
        <div class="chips">
          {#each VAULT_CATS as c}
            <button class:on={vaultCat === c} on:click={() => (vaultCat = c)}>{c}</button>
          {/each}
        </div>

        {#each vaultFiltered as v}
          <article class="glass card vault">
            <div class="row between">
              <span class="cat">{v.title}</span>
              <span class="badge low">{v.cat}</span>
            </div>
            <div class="box pre small">{v.text}</div>
            <button class="btn sm" on:click={() => copyText(v.text, v.id)}>{copied === v.id ? "Copied ✓" : "Copy Clause"}</button>
          </article>
        {/each}
        {#if vaultFiltered.length === 0}
          <section class="glass card"><p class="muted">No clauses match your search. Try a different word or category.</p></section>
        {/if}
      </div>

    {:else if currentRoute === "pricing"}
      <!-- ============ VIEW: PRICING ============ -->
      <div class="wrap">
        <div class="vhead center"><h1>Pay per contract. <span class="grad">No subscription.</span></h1><p class="muted">1 credit = 1 full contract unlock (all counter-clauses + negotiation emails).</p></div>

        <div class="packs">
          {#each PACKS as p}
            <div class="glass pack" class:popular={p.popular}>
              {#if p.popular}<span class="ribbon">Most Popular</span>{/if}
              <div class="pk-icon">{p.icon}</div>
              <div class="pk-name">{p.name}</div>
              <div class="price">₹{p.price}</div>
              <p class="muted">{p.credits} credit{p.credits === 1 ? "" : "s"} • ₹{perContract(p)} per contract</p>
              <ul class="feat">{#each p.features as f}<li>{f}</li>{/each}</ul>
              <button class="btn primary block" on:click={() => openPay(p.id)}>Tap to Pay with UPI ⚡</button>
            </div>
          {/each}
        </div>

        <h2 class="sec-title sec">How UPI payment works</h2>
        <div class="grid3">
          {#each STEPS as s}
            <div class="glass card stepcard">
              <div class="stepno">{s.n}</div>
              <b>{s.t}</b>
              <p class="muted">{s.d}</p>
            </div>
          {/each}
        </div>
        <p class="muted center">UPI ID: <b>{UPI_ID}</b> <button class="linkbtn" on:click={() => copyText(UPI_ID, "upi2")}>{copied === "upi2" ? "Copied ✓" : "Copy"}</button></p>

        <div class="badges">
          {#each BADGES as b}
            <div class="glass badgecard"><span class="bi">{b.i}</span><div><b>{b.t}</b><div class="muted small">{b.d}</div></div></div>
          {/each}
        </div>
      </div>

    {:else}
      <!-- ============ VIEW: ACCOUNT ============ -->
      <div class="wrap narrow">
        <div class="vhead"><h1>Account</h1></div>
        <section class="glass card">
          {#if !sb}
            <div class="error">Login is not configured yet. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then redeploy.</div>
          {:else if user}
            <div class="acct">
              <div class="avatar big">{initial}</div>
              <div>
                <div class="pre"><b>{user.email}</b></div>
                <div class="bigtxt">⚡ {credits} credit{credits === 1 ? "" : "s"}</div>
              </div>
            </div>
            <div class="row">
              <button class="btn accent" on:click={() => openPay(1)}>Buy Credits</button>
              <button class="btn" on:click={() => refreshCredits(user.id)}>Refresh balance</button>
              <button class="btn" on:click={signOut}>Sign out</button>
            </div>
          {:else}
            <p class="muted">Log in to save your credits and unlock fixes on any device.</p>
            <div class="row">
              <button class="btn primary" on:click={() => openAuth("login")}>Login</button>
              <button class="btn" on:click={() => openAuth("signup")}>Create account</button>
            </div>
          {/if}
        </section>
      </div>
    {/if}
  </main>

  <footer class="wrap foot">
    <div class="flinks">
      <button on:click={() => go("home")}>Home</button>
      <button on:click={() => go("audit")}>Audit Scanner</button>
      <button on:click={() => go("radar")}>Risk Radar</button>
      <button on:click={() => go("vault")}>Clause Vault</button>
      <button on:click={() => go("pricing")}>Pricing</button>
    </div>
    <p class="muted small">SafeClause is an automated AI review tool, not a law firm. Nothing here is legal advice. Your contract text is not saved in our database; it is processed by a third-party AI provider to generate the audit.</p>
  </footer>
</div>

{#if authOpen}
  <div class="backdrop" on:click|self={() => (authOpen = false)}>
    <div class="modal glass" role="dialog" aria-modal="true">
      <button class="x" on:click={() => (authOpen = false)}>✕</button>
      <h2>{authMode === "signup" ? "Create account" : authMode === "forgot" ? "Reset password" : "Welcome back"}</h2>
      {#if authNote}<p class="muted">{authNote}</p>{/if}
      {#if !sb}<div class="error">Supabase keys are missing, so login is disabled.</div>{/if}
      <form on:submit={submitAuth}>
        <input type="email" placeholder="Email" bind:value={email} required autocomplete="email" />
        {#if authMode !== "forgot"}
          <input type="password" placeholder="Password (min 6 characters)" bind:value={password} required minlength="6" autocomplete={authMode === "signup" ? "new-password" : "current-password"} />
        {/if}
        <button class="btn primary block" type="submit" disabled={authBusy}>
          {authBusy ? "Please wait..." : authMode === "signup" ? "Sign up" : authMode === "forgot" ? "Send reset link" : "Login"}
        </button>
      </form>
      {#if authMsg}<div class={authOk ? "okmsg" : "error"}>{authMsg}</div>{/if}
      <div class="links">
        {#if authMode !== "login"}<button on:click={() => (authMode = "login")}>Login</button>{/if}
        {#if authMode !== "signup"}<button on:click={() => (authMode = "signup")}>Create account</button>{/if}
        {#if authMode !== "forgot"}<button on:click={() => (authMode = "forgot")}>Forgot password?</button>{/if}
      </div>
    </div>
  </div>
{/if}

{#if showRecovery}
  <div class="backdrop">
    <div class="modal glass" role="dialog" aria-modal="true">
      <h2>Set a new password</h2>
      <form on:submit={saveNewPassword}>
        <input type="password" placeholder="New password" bind:value={newPassword} minlength="6" required autocomplete="new-password" />
        <button class="btn primary block" type="submit" disabled={authBusy}>{authBusy ? "Saving..." : "Save password"}</button>
      </form>
      {#if authMsg}<div class="error">{authMsg}</div>{/if}
    </div>
  </div>
{/if}

{#if payOpen}
  <div class="backdrop" on:click|self={() => (payOpen = false)}>
    <div class="modal glass" role="dialog" aria-modal="true">
      <button class="x" on:click={() => (payOpen = false)}>✕</button>
      <h2>Buy Credits</h2>
      <div class="row">
        {#each PACKS as p}
          <button class="btn sm" class:accent={packId === p.id} on:click={() => (packId = p.id)}>{p.credits} Credit{p.credits === 1 ? "" : "s"} • ₹{p.price}</button>
        {/each}
      </div>
      <p class="muted">1 credit = 1 full contract unlock (all counter-clauses + negotiation emails)</p>

      <h3>Step 1: Pay ₹{pack.price}</h3>
      <a class="btn primary block upi" href={upiLink}>Tap to Pay with UPI ⚡</a>
      <p class="muted">Opens GPay, PhonePe or Paytm on your phone. UPI ID: <strong>{UPI_ID}</strong>
        <button class="linkbtn" on:click={() => copyText(UPI_ID, "upi")}>{copied === "upi" ? "Copied ✓" : "Copy"}</button>
      </p>

      <h3>Step 2: Upload payment screenshot</h3>
      <input type="file" accept="image/*" on:change={onShot} bind:this={shotInput} />
      <button class="btn accent block" on:click={verifyPayment} disabled={payBusy}>
        {payBusy ? "AI is verifying..." : "Verify Payment & Add Credits"}
      </button>
      {#if payMsg}<div class={payOk ? "okmsg" : "error"}>{payMsg}</div>{/if}
    </div>
  </div>
{/if}

<style>
  :global(:root) { --bg: #070a12; --indigo: #6366f1; --emerald: #10b981; --text: #e7eaf3; --muted: #8b95a8; --line: rgba(255, 255, 255, 0.09); }
  :global(*) { box-sizing: border-box; }
  :global(html), :global(body) { margin: 0; max-width: 100%; overflow-x: hidden; }
  :global(body) { background: var(--bg); color: var(--text); font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  .app { min-height: 100vh; display: flex; flex-direction: column; background: radial-gradient(900px 520px at 12% -8%, rgba(99, 102, 241, 0.26), transparent), radial-gradient(760px 460px at 100% 4%, rgba(16, 185, 129, 0.14), transparent); }
  .view { flex: 1; padding-bottom: 20px; }
  .wrap { max-width: 1040px; margin: 0 auto; padding-left: 14px; padding-right: 14px; }
  .narrow { max-width: 820px; }
  .glass { background: rgba(255, 255, 255, 0.045); border: 1px solid var(--line); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); }

  /* navbar */
  .navwrap { position: sticky; top: 0; z-index: 30; background: rgba(7, 10, 18, 0.84); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); border-bottom: 1px solid var(--line); }
  .nav { max-width: 1100px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 10px 14px; }
  .logo { display: flex; align-items: center; gap: 6px; white-space: nowrap; flex-shrink: 0; font-weight: 800; font-size: 1.05rem; background: none; border: 0; color: inherit; font-family: inherit; cursor: pointer; padding: 0; }
  .links-d { display: none; gap: 2px; }
  .links-d button, .menu button { background: none; border: 0; color: #a3adc0; font: inherit; font-size: 0.9rem; padding: 8px 12px; border-radius: 9px; cursor: pointer; }
  .links-d button.active, .menu button.active { color: #fff; background: rgba(99, 102, 241, 0.22); }
  .nav-right { display: flex; align-items: center; gap: 6px; min-width: 0; }
  .chip { flex-shrink: 0; white-space: nowrap; background: rgba(99, 102, 241, 0.18); border: 1px solid rgba(99, 102, 241, 0.55); color: #cfd0ff; padding: 3px 8px; font-size: 0.75rem; border-radius: 999px; font-family: inherit; font-weight: 700; cursor: pointer; box-shadow: 0 0 12px rgba(99, 102, 241, 0.35); }
  .nav-right .btn.sm { padding: 5px 10px; font-size: 0.75rem; white-space: nowrap; }
  .avatar { width: 32px; height: 32px; border-radius: 50%; border: 1px solid rgba(16, 185, 129, 0.6); background: linear-gradient(135deg, #6366f1, #10b981); color: #fff; font-weight: 800; font-family: inherit; cursor: pointer; flex-shrink: 0; }
  .avatar.big { width: 52px; height: 52px; font-size: 1.3rem; }
  .burger { width: 34px; height: 32px; flex-shrink: 0; border-radius: 9px; border: 1px solid var(--line); background: rgba(255, 255, 255, 0.05); color: var(--text); font-size: 1rem; cursor: pointer; }
  .menu { display: flex; flex-direction: column; gap: 2px; max-width: 1100px; margin: 0 auto; padding: 4px 14px 12px; }
  .menu button { text-align: left; padding: 11px 12px; }
  .short { display: none; }
  @media (max-width: 560px) { .long { display: none; } .short { display: inline; } }
  @media (min-width: 880px) {
    .links-d { display: flex; }
    .burger { display: none; }
    .menu { display: none; }
  }

  /* home hero */
  .hero { text-align: center; padding-top: 38px; padding-bottom: 26px; }
  .pill { display: inline-block; padding: 6px 14px; border-radius: 999px; font-size: 0.8rem; background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.45); color: #86efc4; }
  .hero h1 { margin: 16px auto 12px; max-width: 760px; font-size: clamp(1.9rem, 6.2vw, 3.3rem); line-height: 1.1; letter-spacing: -0.02em; }
  .grad { background: linear-gradient(90deg, #818cf8, #34d399); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .sub { margin: 0 auto; max-width: 640px; color: #a3adc0; font-size: 1.02rem; line-height: 1.55; }
  .cta-row { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; margin: 22px 0 16px; }
  .trust { display: flex; flex-wrap: wrap; gap: 8px 16px; justify-content: center; color: var(--muted); font-size: 0.8rem; }

  /* demo card */
  .demo { border-radius: 18px; padding: 16px; box-shadow: 0 0 40px rgba(99, 102, 241, 0.18); }
  .demo-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
  .chips { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px; }
  .chips button { padding: 6px 13px; border-radius: 999px; border: 1px solid var(--line); background: rgba(255, 255, 255, 0.04); color: #a3adc0; font: inherit; font-size: 0.82rem; cursor: pointer; }
  .chips button.on { color: #fff; border-color: rgba(99, 102, 241, 0.7); background: rgba(99, 102, 241, 0.25); }
  .demo-tag { font-size: 0.75rem; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: #ff8793; margin-bottom: 6px; }
  .demo-tag.ok { color: #6ee7b7; }
  blockquote.good { border-left-color: #10b981; }

  /* view headers + segmented */
  .vhead { padding: 26px 0 6px; }
  .vhead h1 { margin: 0 0 4px; font-size: clamp(1.5rem, 5vw, 2.1rem); }
  .vhead p { margin: 0; }
  .center { text-align: center; }
  .seg { display: flex; gap: 6px; margin: 12px 0 0; }
  .seg button { flex: 1; padding: 9px 8px; border-radius: 10px; border: 1px solid var(--line); background: rgba(255, 255, 255, 0.03); color: #a3adc0; font: inherit; font-size: 0.85rem; cursor: pointer; }
  .seg button.on { color: #fff; border-color: rgba(16, 185, 129, 0.65); background: rgba(16, 185, 129, 0.16); }
  .seg small { color: inherit; opacity: 0.75; }
  .seg.slim { margin: 6px 0 12px; max-width: 260px; }

  /* generic */
  .card { border-radius: 16px; padding: 16px; margin-top: 14px; }
  h2 { margin: 0 0 8px; font-size: 1.15rem; }
  h3 { margin: 16px 0 6px; font-size: 0.76rem; text-transform: uppercase; letter-spacing: 0.07em; color: #9aa4b5; }
  .row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-bottom: 10px; }
  .between { justify-content: space-between; }
  .muted { color: var(--muted); font-size: 0.85rem; }
  .small { font-size: 0.78rem; }
  .pre { white-space: pre-wrap; word-break: break-word; line-height: 1.55; }
  .btn { font: inherit; cursor: pointer; border-radius: 11px; border: 1px solid rgba(255, 255, 255, 0.14); background: rgba(255, 255, 255, 0.06); color: var(--text); padding: 10px 14px; text-decoration: none; display: inline-block; text-align: center; }
  .btn.sm { padding: 6px 11px; font-size: 0.85rem; }
  .btn.big { padding: 13px 20px; font-size: 1rem; font-weight: 700; }
  .btn.block { display: block; width: 100%; }
  .btn.primary { border: 0; font-weight: 700; color: #fff; background: linear-gradient(135deg, #6366f1, #4f46e5); box-shadow: 0 0 24px rgba(99, 102, 241, 0.5); }
  .btn.accent { border-color: rgba(16, 185, 129, 0.6); background: rgba(16, 185, 129, 0.14); color: #a7f3d0; }
  .btn:disabled { opacity: 0.65; cursor: wait; }
  .btn.loading { background: linear-gradient(90deg, #4f46e5, #10b981, #4f46e5); background-size: 200% 100%; animation: shimmer 1.2s linear infinite; }
  @keyframes shimmer { 0% { background-position: 0% 0; } 100% { background-position: 200% 0; } }
  .btn.file { cursor: pointer; }
  .upi { background: linear-gradient(135deg, #059669, #10b981); box-shadow: 0 0 22px rgba(16, 185, 129, 0.4); margin-bottom: 8px; }
  textarea, input[type="email"], input[type="password"], input[type="number"], input[type="search"], select { width: 100%; background: rgba(5, 8, 15, 0.7); color: inherit; border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 11px; padding: 11px; font: inherit; margin-bottom: 8px; }
  textarea { resize: vertical; }
  input[type="file"] { width: 100%; margin-bottom: 8px; color: #9aa4b5; }
  .vsearch { margin-top: 12px; }
  label { display: block; font-size: 0.8rem; color: #a3adc0; }
  .grid2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 4px 12px; }
  .count { font-size: 0.75rem; color: #7d889b; margin: -2px 0 10px; }
  .error { margin-top: 10px; padding: 11px 13px; border-radius: 10px; background: rgba(120, 25, 35, 0.45); border: 1px solid rgba(248, 113, 113, 0.5); color: #ffc2c8; font-size: 0.9rem; word-break: break-word; text-align: left; }
  .okmsg { margin-top: 10px; padding: 11px 13px; border-radius: 10px; background: rgba(20, 100, 60, 0.4); border: 1px solid rgba(74, 222, 128, 0.5); color: #bbf7d0; font-size: 0.9rem; }
  .badge { padding: 3px 10px; border-radius: 999px; font-size: 0.72rem; font-weight: 700; }
  .badge.high { background: rgba(239, 68, 68, 0.2); color: #ff8793; }
  .badge.med { background: rgba(245, 158, 11, 0.2); color: #ffd36b; }
  .badge.low { background: rgba(16, 185, 129, 0.2); color: #6ee7b7; }
  .cat { font-weight: 800; font-size: 0.85rem; letter-spacing: 0.05em; }
  blockquote { margin: 0 0 8px; padding: 10px 14px; border-left: 3px solid #ff8793; background: rgba(255, 255, 255, 0.04); border-radius: 6px; white-space: pre-wrap; font-style: italic; }
  .box { background: rgba(5, 8, 15, 0.6); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 10px; padding: 12px; margin-bottom: 8px; }

  /* meter + calculator */
  .meter { position: relative; height: 10px; border-radius: 999px; margin: 10px 0 4px; background: linear-gradient(90deg, #10b981, #f59e0b, #ef4444); }
  .meter-pin { position: absolute; top: -5px; width: 6px; height: 20px; margin-left: -3px; border-radius: 3px; background: #fff; box-shadow: 0 0 10px rgba(255, 255, 255, 0.8); transition: left 0.4s ease; }
  .meter-labels { display: flex; justify-content: space-between; font-size: 0.68rem; color: var(--muted); margin-bottom: 8px; }
  .lines { list-style: none; margin: 12px 0; padding: 0; }
  .lines li { display: flex; justify-content: space-between; gap: 10px; padding: 9px 0; border-bottom: 1px solid var(--line); font-size: 0.9rem; }
  .lines li span { color: #a3adc0; }
  .lines li b { text-align: right; white-space: nowrap; }

  /* paywall */
  .locked-wrap { position: relative; margin-top: 6px; }
  .premium.blurred { filter: blur(8px); opacity: 0.35; pointer-events: none; user-select: none; }
  .lock-overlay { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; padding: 10px; }
  .lock-card { width: 100%; max-width: 400px; text-align: center; padding: 18px 16px; border-radius: 16px; background: rgba(8, 11, 20, 0.9); border: 1px solid rgba(255, 255, 255, 0.16); backdrop-filter: blur(8px); box-shadow: 0 12px 40px rgba(0, 0, 0, 0.55), 0 0 30px rgba(99, 102, 241, 0.25); }
  .lock-title { font-weight: 800; margin-bottom: 12px; }

  /* pricing */
  .packs { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 14px; margin-top: 14px; }
  .pack { position: relative; text-align: center; border-radius: 18px; padding: 22px 16px 18px; }
  .pack.popular { border-color: rgba(99, 102, 241, 0.75); box-shadow: 0 0 34px rgba(99, 102, 241, 0.32); }
  .ribbon { position: absolute; top: -11px; left: 50%; transform: translateX(-50%); background: linear-gradient(90deg, #6366f1, #10b981); color: #fff; font-size: 0.7rem; font-weight: 800; padding: 3px 12px; border-radius: 999px; white-space: nowrap; }
  .pk-icon { font-size: 1.8rem; }
  .pk-name { font-weight: 800; margin-top: 4px; }
  .price { font-size: 2.4rem; font-weight: 800; margin: 6px 0; }
  .feat { list-style: none; padding: 0; margin: 12px 0 16px; text-align: left; font-size: 0.88rem; color: #c3cad8; }
  .feat li { padding: 4px 0 4px 22px; position: relative; }
  .feat li::before { content: "✓"; position: absolute; left: 0; color: var(--emerald); font-weight: 800; }
  .stepcard { margin-top: 0; }
  .stepno { width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; margin-bottom: 8px; background: linear-gradient(135deg, #6366f1, #10b981); }
  .badges { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 10px; margin-top: 18px; }
  .badgecard { display: flex; gap: 10px; align-items: flex-start; padding: 12px; border-radius: 14px; }
  .bi { font-size: 1.4rem; }

  /* home sections */
  .sec { padding-top: 44px; }
  .sec-title { text-align: center; font-size: clamp(1.4rem, 4.5vw, 2rem); margin: 0 0 6px; }
  .sec-sub { text-align: center; color: var(--muted); margin: 0 0 18px; }
  .grid3 { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px; }
  .pain { margin-top: 0; }
  .pain-ic { font-size: 1.8rem; }
  .pain-t { margin: 8px 0 6px; font-size: 1rem; text-transform: none; letter-spacing: 0; color: var(--text); }
  .tbl-wrap { border-radius: 16px; overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 0.86rem; }
  th, td { padding: 12px 12px; text-align: left; vertical-align: top; border-bottom: 1px solid var(--line); }
  th { color: #a3adc0; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.06em; }
  td:first-child { font-weight: 700; white-space: nowrap; }
  td.bad { color: #fca5a5; }
  td.good { color: #86efc4; }
  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px; }
  .stat { border-radius: 16px; padding: 18px 14px; text-align: center; }
  .stat b { display: block; font-size: 1.8rem; background: linear-gradient(90deg, #818cf8, #34d399); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .stat span { display: block; margin-top: 4px; color: var(--muted); font-size: 0.8rem; }
  .faq { border-radius: 14px; padding: 4px 16px; margin-top: 10px; }
  .faq summary { cursor: pointer; padding: 12px 0; font-weight: 700; }
  .faq p { margin: 0 0 12px; color: #b4bccb; line-height: 1.6; font-size: 0.92rem; }
  .final { text-align: center; padding: 34px 18px; border-radius: 22px; border: 1px solid rgba(99, 102, 241, 0.5); background: linear-gradient(135deg, rgba(99, 102, 241, 0.22), rgba(16, 185, 129, 0.14)); box-shadow: 0 0 50px rgba(99, 102, 241, 0.25); }
  .final h2 { font-size: clamp(1.3rem, 4.5vw, 1.9rem); }
  .final p { color: #b4bccb; max-width: 520px; margin: 0 auto 18px; }
  .acct { display: flex; align-items: center; gap: 14px; margin: 10px 0 14px; }
  .bigtxt { font-size: 1.3rem; font-weight: 800; margin-top: 4px; }

  /* footer */
  .foot { text-align: center; padding-top: 36px; padding-bottom: 30px; }
  .flinks { display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; margin-bottom: 10px; }
  .flinks button, .links button, .linkbtn { background: none; border: 0; color: #818cf8; font: inherit; font-size: 0.85rem; cursor: pointer; padding: 0; }

  /* modals */
  .backdrop { position: fixed; inset: 0; z-index: 50; background: rgba(3, 5, 10, 0.74); display: flex; align-items: center; justify-content: center; padding: 14px; overflow-y: auto; }
  .modal { position: relative; width: 100%; max-width: 430px; max-height: 92vh; overflow-y: auto; border-radius: 18px; padding: 20px 18px; background: rgba(12, 17, 30, 0.96); }
  .x { position: absolute; top: 10px; right: 12px; background: none; border: 0; color: #9aa4b5; font-size: 1.1rem; cursor: pointer; }
  .links { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; margin-top: 12px; }
</style>
