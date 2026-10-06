<script>
  import { onMount, onDestroy } from "svelte";
  import { createClient } from "@supabase/supabase-js";

  const SB_URL = import.meta.env.VITE_SUPABASE_URL;
  const SB_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const sb = SB_URL && SB_KEY ? createClient(SB_URL, SB_KEY) : null;

  const UPI_ID = "8796021247@fam";
  const MAX_CHARS = 10000;
  const PACKS = [
    { id: 1, credits: 1, price: 49, name: "Single Contract", note: "1 full contract unlock" },
    { id: 3, credits: 3, price: 129, name: "Popular Pack", note: "3 full contracts, save ₹18" },
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

  let tab = "audit";
  let session = null;
  let credits = 0;

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

  $: user = session ? session.user : null;
  $: if (user) { refreshCredits(user.id); } else { credits = 0; }
  $: pack = PACKS.find(function (p) { return p.id === packId; }) || PACKS[0];
  $: upiLink = "upi://pay?pa=" + UPI_ID + "&pn=SafeClause&am=" + pack.price + "&cu=INR&tn=SafeClause_Credit";
  $: flagged = result && Array.isArray(result.flagged_clauses) ? result.flagged_clauses : [];
  $: highCount = flagged.filter(function (c) { return c.risk_level === "HIGH"; }).length;

  onMount(async function () {
    if (!sb) return;
    const res0 = await sb.auth.getSession();
    session = res0.data ? res0.data.session : null;
    const res = sb.auth.onAuthStateChange(function (event, s) {
      session = s;
      if (event === "PASSWORD_RECOVERY") showRecovery = true;
    });
    sub = res.data.subscription;
  });
  onDestroy(function () { if (sub) sub.unsubscribe(); });

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

  function riskClass(l) {
    return l === "HIGH" ? "high" : l === "LOW" ? "low" : "med";
  }

  function shortCredits(n) {
    const v = Number(n) || 0;
    return v >= 10000 ? Math.floor(v / 100) / 10 + "k" : String(v);
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
    tab = "audit";
  }

  /* ---------- contract input ---------- */
  function loadSample(key) {
    contractText = SAMPLES[key];
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
  async function runAudit() {
    error = "";
    const text = contractText.trim();
    if (text.length < 50) { error = "Paste your contract text first (at least a few lines)."; return; }
    loading = true;
    result = null;
    unlockedData = {};
    unlockError = "";
    try {
      const r = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.slice(0, MAX_CHARS) }),
      });
      const data = await readJson(r);
      if (!r.ok) throw new Error(data.error || "Server error (HTTP " + r.status + ")");
      result = data;
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

<div class="app">
  <nav class="nav glass">
    <button class="logo" on:click={() => (tab = "audit")}><span>🛡️</span><span>SafeClause</span></button>
    <div class="nav-right">
      <button class="chip" on:click={() => (tab = "pricing")} title={credits + " credits"}>⚡ {shortCredits(credits)}</button>
      <button class="btn sm accent buybtn" on:click={() => openPay(1)}><span class="long">Buy Credits</span><span class="short">Buy</span></button>
      {#if user}
        <button class="btn sm userbtn" on:click={() => (tab = "account")} title={user.email}>👤 <span class="uname">{user.email.split("@")[0]}</span></button>
      {:else}
        <button class="btn sm" on:click={() => openAuth("login")}>Login</button>
      {/if}
    </div>
  </nav>

  <div class="tabs">
    <button class:active={tab === "audit"} on:click={() => (tab = "audit")}><span class="long">Document Audit</span><span class="short">Audit</span></button>
    <button class:active={tab === "pricing"} on:click={() => (tab = "pricing")}><span class="long">Pricing / Store</span><span class="short">Pricing</span></button>
    <button class:active={tab === "account"} on:click={() => (tab = "account")}>Account</button>
  </div>

  <main>
    {#if tab === "audit"}
      <section class="hero">
        <h1>Spot the contract traps <span class="grad">before you sign</span></h1>
        <p>AI risk audit for freelancers. See the danger free, unlock every fix with 1 credit.</p>
      </section>

      <section class="glass card">
        <div class="row">
          <button class="btn sm" on:click={() => loadSample("india")}>Sample India (Freelance)</button>
          <button class="btn sm" on:click={() => loadSample("us")}>Sample US/Remote</button>
          <label class="btn sm file">
            {pdfBusy ? "Reading PDF..." : "📄 Upload PDF"}
            <input type="file" accept="application/pdf" on:change={onPdf} bind:this={pdfInput} disabled={pdfBusy} hidden />
          </label>
        </div>
        <textarea bind:value={contractText} rows="11" maxlength={MAX_CHARS} placeholder="Paste your client contract here, or upload a PDF..."></textarea>
        <div class="count">{contractText.length} / {MAX_CHARS} characters</div>
        <button class="btn primary block" on:click={runAudit} disabled={loading}>
          {loading ? "Auditing contract..." : "Run Instant Risk Audit ⚡"}
        </button>
        {#if error}
          <div class="error" role="alert">⚠️ {error}</div>
        {/if}
      </section>

      {#if result}
        <section class="glass card">
          <div class="row between">
            <h2>Executive Summary</h2>
            <span class="badge {riskClass(result.overall_risk_score)}">{result.overall_risk_score} RISK</span>
          </div>
          <p class="pre">{fmt(result.executive_summary)}</p>
          <p class="muted">{flagged.length} flagged clause{flagged.length === 1 ? "" : "s"} • {highCount} high risk</p>
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

    {:else if tab === "pricing"}
      <section class="hero">
        <h1>Buy <span class="grad">credits</span></h1>
        <p>1 credit = 1 full contract unlock (all counter-clauses + negotiation emails)</p>
      </section>
      <div class="packs">
        {#each PACKS as p}
          <div class="glass card pack" class:popular={p.id === 3}>
            {#if p.id === 3}<span class="ribbon">Popular</span>{/if}
            <h2>{p.name}</h2>
            <div class="price">₹{p.price}</div>
            <p class="muted">{p.credits} credit{p.credits === 1 ? "" : "s"} • {p.note}</p>
            <button class="btn primary block" on:click={() => openPay(p.id)}>Tap to Pay with UPI ⚡</button>
          </div>
        {/each}
      </div>
      <p class="muted center">Pay with GPay, PhonePe or Paytm, then upload the screenshot. Credits are added automatically after AI verification.</p>

    {:else}
      <section class="glass card">
        <h2>Account</h2>
        {#if !sb}
          <div class="error">Login is not configured yet. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then redeploy.</div>
        {:else if user}
          <p class="pre"><strong>{user.email}</strong></p>
          <p class="big">⚡ {credits} credit{credits === 1 ? "" : "s"}</p>
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
    {/if}
  </main>

  <footer>SafeClause is an AI tool, not a lawyer. Have important contracts reviewed by a qualified professional.</footer>
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
  :global(*) { box-sizing: border-box; }
  :global(html), :global(body) { margin: 0; max-width: 100%; overflow-x: hidden; }
  :global(body) { background: #090d16; color: #e6e9ef; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  .app { min-height: 100vh; background: radial-gradient(900px 500px at 15% -10%, rgba(109, 94, 252, 0.22), transparent), radial-gradient(700px 400px at 100% 0%, rgba(34, 211, 238, 0.12), transparent); }
  main, .tabs, footer { max-width: 780px; margin: 0 auto; padding-left: 14px; padding-right: 14px; }
  main { padding-bottom: 30px; }
  .glass { background: rgba(255, 255, 255, 0.045); border: 1px solid rgba(255, 255, 255, 0.09); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); }

  .nav { position: sticky; top: 0; z-index: 20; display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 10px 14px; border-width: 0 0 1px 0; }
  .logo { display: flex; align-items: center; gap: 6px; white-space: nowrap; flex-shrink: 0; font-weight: 800; font-size: 1.05rem; background: none; border: 0; color: inherit; font-family: inherit; cursor: pointer; padding: 0; }
  .nav-right { display: flex; flex-wrap: nowrap; align-items: center; gap: 6px; min-width: 0; }
  .chip { flex-shrink: 0; white-space: nowrap; background: rgba(109, 94, 252, 0.18); border: 1px solid rgba(109, 94, 252, 0.5); color: #cfc9ff; padding: 3px 8px; font-size: 0.75rem; border-radius: 999px; font-family: inherit; font-weight: 700; cursor: pointer; box-shadow: 0 0 12px rgba(109, 94, 252, 0.35); }
  .nav-right .btn.sm { padding: 5px 9px; font-size: 0.75rem; white-space: nowrap; }
  .buybtn { flex-shrink: 0; }
  .userbtn { display: flex; align-items: center; gap: 4px; min-width: 0; }
  .uname { display: inline-block; max-width: 90px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .short { display: none; }
  @media (max-width: 430px) {
    .nav { padding: 10px 12px; gap: 6px; }
    .logo { font-size: 0.98rem; }
    .long { display: none; }
    .short { display: inline; }
    .uname { max-width: 52px; }
  }
  @media (max-width: 340px) {
    .uname { display: none; }
  }

  .tabs { display: flex; gap: 6px; margin-top: 12px; overflow-x: auto; }
  .tabs button { flex: 1 1 0; min-width: 0; white-space: nowrap; padding: 9px 6px; font-size: 0.9rem; text-align: center; border-radius: 10px; border: 1px solid rgba(255, 255, 255, 0.08); background: transparent; color: #9aa4b5; font-family: inherit; cursor: pointer; }
  .tabs button.active { color: #fff; background: rgba(109, 94, 252, 0.22); border-color: rgba(109, 94, 252, 0.55); }
  .hero { text-align: center; padding: 22px 0 10px; }
  .hero h1 { margin: 0 0 8px; font-size: 1.7rem; line-height: 1.2; }
  .hero p { margin: 0; color: #9aa4b5; }
  .grad { background: linear-gradient(90deg, #8b7cff, #22d3ee); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .card { border-radius: 16px; padding: 16px; margin-top: 14px; }
  h2 { margin: 0 0 8px; font-size: 1.15rem; }
  h3 { margin: 16px 0 6px; font-size: 0.76rem; text-transform: uppercase; letter-spacing: 0.07em; color: #9aa4b5; }
  .row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-bottom: 10px; }
  .between { justify-content: space-between; }
  .muted { color: #8b95a8; font-size: 0.85rem; }
  .center { text-align: center; }
  .big { font-size: 1.4rem; font-weight: 800; margin: 8px 0; }
  .pre { white-space: pre-wrap; word-break: break-word; line-height: 1.55; }
  .btn { font: inherit; cursor: pointer; border-radius: 11px; border: 1px solid rgba(255, 255, 255, 0.14); background: rgba(255, 255, 255, 0.06); color: #e6e9ef; padding: 10px 14px; text-decoration: none; display: inline-block; text-align: center; }
  .btn.sm { padding: 6px 11px; font-size: 0.85rem; }
  .btn.block { display: block; width: 100%; }
  .btn.primary { border: 0; font-weight: 700; color: #fff; background: linear-gradient(135deg, #6d5efc, #3b82f6); box-shadow: 0 0 22px rgba(99, 102, 241, 0.45); }
  .btn.accent { border-color: rgba(34, 211, 238, 0.6); background: rgba(34, 211, 238, 0.14); color: #b8f4ff; }
  .btn:disabled { opacity: 0.6; cursor: wait; }
  .btn.file { cursor: pointer; }
  .upi { background: linear-gradient(135deg, #16a34a, #22c55e); box-shadow: 0 0 22px rgba(34, 197, 94, 0.4); margin-bottom: 8px; }
  textarea, input[type="email"], input[type="password"] { width: 100%; background: rgba(5, 8, 15, 0.7); color: inherit; border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 11px; padding: 11px; font: inherit; margin-bottom: 8px; }
  textarea { resize: vertical; }
  input[type="file"] { width: 100%; margin-bottom: 8px; color: #9aa4b5; }
  .count { font-size: 0.75rem; color: #7d889b; margin: -2px 0 10px; }
  .error { margin-top: 10px; padding: 11px 13px; border-radius: 10px; background: rgba(120, 25, 35, 0.45); border: 1px solid rgba(248, 113, 113, 0.5); color: #ffc2c8; font-size: 0.9rem; word-break: break-word; text-align: left; }
  .okmsg { margin-top: 10px; padding: 11px 13px; border-radius: 10px; background: rgba(20, 100, 60, 0.4); border: 1px solid rgba(74, 222, 128, 0.5); color: #bbf7d0; font-size: 0.9rem; }
  .badge { padding: 3px 10px; border-radius: 999px; font-size: 0.72rem; font-weight: 700; }
  .badge.high { background: rgba(239, 68, 68, 0.2); color: #ff8793; }
  .badge.med { background: rgba(245, 158, 11, 0.2); color: #ffd36b; }
  .badge.low { background: rgba(34, 197, 94, 0.2); color: #6ee7a0; }
  .cat { font-weight: 800; font-size: 0.85rem; letter-spacing: 0.05em; }
  blockquote { margin: 0; padding: 10px 14px; border-left: 3px solid #ff8793; background: rgba(255, 255, 255, 0.04); border-radius: 6px; white-space: pre-wrap; font-style: italic; }
  .box { background: rgba(5, 8, 15, 0.6); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 10px; padding: 12px; margin-bottom: 8px; }
  .locked-wrap { position: relative; margin-top: 6px; }
  .premium.blurred { filter: blur(8px); opacity: 0.35; pointer-events: none; user-select: none; }
  .lock-overlay { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; padding: 10px; }
  .lock-card { width: 100%; max-width: 400px; text-align: center; padding: 18px 16px; border-radius: 16px; background: rgba(8, 11, 20, 0.9); border: 1px solid rgba(255, 255, 255, 0.16); backdrop-filter: blur(8px); box-shadow: 0 12px 40px rgba(0, 0, 0, 0.55), 0 0 30px rgba(109, 94, 252, 0.25); }
  .lock-title { font-weight: 800; margin-bottom: 12px; }
  .packs { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; }
  .pack { position: relative; text-align: center; }
  .pack.popular { border-color: rgba(109, 94, 252, 0.7); box-shadow: 0 0 30px rgba(109, 94, 252, 0.3); }
  .ribbon { position: absolute; top: -10px; right: 14px; background: linear-gradient(90deg, #6d5efc, #22d3ee); color: #fff; font-size: 0.7rem; font-weight: 800; padding: 3px 10px; border-radius: 999px; }
  .price { font-size: 2.2rem; font-weight: 800; margin: 6px 0; }
  .backdrop { position: fixed; inset: 0; z-index: 50; background: rgba(3, 5, 10, 0.72); display: flex; align-items: center; justify-content: center; padding: 14px; overflow-y: auto; }
  .modal { position: relative; width: 100%; max-width: 420px; max-height: 92vh; overflow-y: auto; border-radius: 18px; padding: 20px 18px; background: rgba(14, 19, 32, 0.95); }
  .x { position: absolute; top: 10px; right: 12px; background: none; border: 0; color: #9aa4b5; font-size: 1.1rem; cursor: pointer; }
  .links { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; margin-top: 12px; }
  .links button, .linkbtn { background: none; border: 0; color: #8b7cff; font: inherit; font-size: 0.85rem; cursor: pointer; padding: 0; }
  footer { text-align: center; color: #667085; font-size: 0.75rem; padding-top: 10px; padding-bottom: 30px; }
</style>
