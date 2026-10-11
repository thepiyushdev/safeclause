
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
