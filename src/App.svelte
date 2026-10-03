<script>
  import { onMount } from 'svelte';
  import { supabase } from './lib/supabase.js';

  // Navigation State
  let currentPage = 'home';
  let mobileMenuOpen = false;
  let legalModal = null;

  // Paywall & Credit State
  let userCredits = 0;
  let hasUnlocked = false;

  // Merchant Configuration
  const upiId = 'paytm.s2b5x4t@pty';
  const payeeName = 'Ashok ray';

  // Payment Modal State
  let paymentModalOpen = false;
  let selectedPlan = { name: 'Single Pass', price: 49, credits: 1 };
  let screenshotBase64 = null;
  let screenshotPreview = null;
  let verifyingPayment = false;
  let paymentSuccess = false;
  let paymentError = '';
  let verifiedUtr = '';

  // User Auth State
  let currentUser = null;
  let authMode = 'login';
  let authEmail = '';
  let authPassword = '';
  let authLoading = false;
  let authMessage = '';
  let authError = '';

  // Audit Tool State
  let jurisdiction = 'INDIA';
  let contractTitle = '';
  let contractText = '';
  let loading = false;
  let auditResult = null;
  let errorMessage = '';
  let copiedIndex = null;
  let copiedEmailIndex = null;

  onMount(async () => {
    try {
      const { data } = await supabase.auth.getSession();
      currentUser = data?.session?.user || null;
      if (currentUser) {
        await loadUserCredits(currentUser.id, currentUser.email);
      }

      supabase.auth.onAuthStateChange(async (_event, session) => {
        currentUser = session?.user || null;
        if (currentUser) {
          await loadUserCredits(currentUser.id, currentUser.email);
        } else {
          userCredits = 0;
          hasUnlocked = false;
        }
      });
    } catch (e) {
      console.warn("Supabase offline:", e.message);
    }
  });

  async function loadUserCredits(userId, email) {
    try {
      let { data } = await supabase
        .from('profiles')
        .select('credits')
        .eq('id', userId)
        .single();

      if (!data) {
        await supabase.from('profiles').upsert({ id: userId, email: email, credits: 0 });
        userCredits = 0;
      } else {
        userCredits = data.credits || 0;
      }
    } catch (e) {
      console.warn("Credits error:", e.message);
    }
  }

  function navigateTo(page) {
    currentPage = page;
    mobileMenuOpen = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function openPayment(planName, price, creditsToAdd) {
    if (!currentUser) {
      navigateTo('auth');
      return;
    }
    selectedPlan = { name: planName, price: price, credits: creditsToAdd };
    screenshotBase64 = null;
    screenshotPreview = null;
    paymentSuccess = false;
    paymentError = '';
    verifiedUtr = '';
    paymentModalOpen = true;
  }

  // Handle Screenshot Upload & Compression
  function handleScreenshotSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    paymentError = '';
    const reader = new FileReader();

    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Compress image to max 900px width for fast AI processing
        const canvas = document.createElement('canvas');
        const maxDim = 900;
        let width = img.width;
        let height = img.height;

        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        screenshotBase64 = canvas.toDataURL('image/jpeg', 0.85);
        screenshotPreview = screenshotBase64;
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  }

  async function submitAiVerification() {
    if (!screenshotBase64) {
      paymentError = 'Please upload your UPI payment screenshot.';
      return;
    }

    verifyingPayment = true;
    paymentError = '';

    try {
      const res = await fetch('/api/verify-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: screenshotBase64,
          expectedPrice: selectedPlan.price,
          planName: selectedPlan.name,
          userId: currentUser?.id
        })
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Receipt verification failed.');
      }

      userCredits = json.credits;
      verifiedUtr = json.utr;
      paymentSuccess = true;

      setTimeout(() => {
        paymentModalOpen = false;
        if (currentPage === 'audit' && auditResult && !hasUnlocked) {
          useCreditToUnlock();
        }
      }, 2000);
    } catch (err) {
      paymentError = err.message || 'AI failed to verify the screenshot. Make sure it is clear.';
    } finally {
      verifyingPayment = false;
    }
  }

  async function useCreditToUnlock() {
    if (userCredits <= 0) {
      openPayment('Single Pass', 49, 1);
      return;
    }

    try {
      const newBalance = userCredits - 1;
      await supabase
        .from('profiles')
        .update({ credits: newBalance })
        .eq('id', currentUser.id);

      userCredits = newBalance;
      hasUnlocked = true;
    } catch (e) {
      userCredits = Math.max(0, userCredits - 1);
      hasUnlocked = true;
    }
  }

  async function handleAuth() {
    authError = '';
    authMessage = '';
    authLoading = true;

    try {
      if (authMode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: authEmail,
          password: authPassword
        });
        if (error) throw error;
        currentUser = data.user;
        await loadUserCredits(currentUser.id, currentUser.email);
        authMessage = "Account ready!";
        setTimeout(() => { navigateTo('audit'); }, 600);
      } else if (authMode === 'login') {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password: authPassword
        });
        if (error) throw error;
        currentUser = data.user;
        await loadUserCredits(currentUser.id, currentUser.email);
        authMessage = "Logged in successfully!";
        setTimeout(() => { navigateTo('audit'); }, 600);
      } else if (authMode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(authEmail);
        if (error) throw error;
        authMessage = "Password reset instructions sent!";
      }
    } catch (err) {
      authError = err.message || "Authentication failed.";
    } finally {
      authLoading = false;
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    currentUser = null;
    userCredits = 0;
    hasUnlocked = false;
    navigateTo('home');
  }

  async function handleAudit() {
    if (!contractText || contractText.trim().length < 40) {
      errorMessage = 'Please paste at least 40 characters of contract clauses.';
      return;
    }

    loading = true;
    errorMessage = '';
    auditResult = null;
    hasUnlocked = false;

    try {
      const res = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractTitle, contractText, jurisdiction })
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Audit failed');

      auditResult = json.data;
      setTimeout(() => {
        const el = document.getElementById('audit-results');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (err) {
      errorMessage = err.message || 'Error occurred while auditing.';
    } finally {
      loading = false;
    }
  }

  async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    contractTitle = file.name.replace(/\.[^/.]+$/, "");
    errorMessage = '';

    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      try {
        if (!window.pdfjsLib) {
          await new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
            script.onload = () => {
              window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
              resolve();
            };
            script.onerror = () => reject(new Error("PDF engine error"));
            document.head.appendChild(script);
          });
        }
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = "";
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const pageText = content.items.map(item => item.str).join(" ");
          fullText += pageText + "\n\n";
        }
        if (fullText.trim().length > 20) {
          contractText = fullText.trim();
        } else {
          errorMessage = "Could not extract text. Please copy-paste clauses directly.";
        }
      } catch (err) {
        errorMessage = "Error reading PDF. Please paste the clauses into the text box.";
      }
    } else {
      const reader = new FileReader();
      reader.onload = (event) => { contractText = event.target.result; };
      reader.readAsText(file);
    }
  }

  function copyText(text, index, type) {
    navigator.clipboard.writeText(text);
    if (type === 'clause') {
      copiedIndex = index;
      setTimeout(() => { copiedIndex = null; }, 2000);
    } else {
      copiedEmailIndex = index;
      setTimeout(() => { copiedEmailIndex = null; }, 2000);
    }
  }

  function loadSample(type) {
    if (type === 'india') {
      jurisdiction = 'INDIA';
      contractTitle = "India Freelance Dev Contract";
      contractText = `1. PAYMENT TERMS: Payments will be released Net-90 days after internal client sign-off.
2. NON-COMPETE: Developer shall not work with any competing client across India for 24 months post-termination.
3. INDEMNITY: Developer provides unlimited indemnification for any third-party claims or server outages.`;
    } else {
      jurisdiction = 'GLOBAL';
      contractTitle = "US Remote Design Agreement";
      contractText = `1. INTELLECTUAL PROPERTY: All tools, frameworks, and design assets assign to client prior to invoice payment.
2. TERMINATION: Client may cancel contract at will with zero notice and no kill-fee for active milestones.
3. GOVERNING LAW: Exclusive jurisdiction of Delaware Courts; contractor waives local protections.`;
    }
  }
</script>

<div class="app-wrapper">
  <!-- NAVBAR -->
  <header class="app-header">
    <div class="brand" on:click={() => navigateTo('home')}>
      <div class="brand-shield">🛡️</div>
      <div class="brand-info">
        <span class="brand-title">SafeClause</span>
        <span class="brand-sub">Contract Risk Shield</span>
      </div>
    </div>

    <div class="header-actions">
      {#if currentUser}
        <div class="credit-pill" on:click={() => openPayment('Single Pass', 49, 1)}>
          ⚡ {userCredits} {userCredits === 1 ? 'Credit' : 'Credits'}
        </div>
      {:else}
        <button class="btn-nav-quick" on:click={() => navigateTo('audit')}>Try Free</button>
      {/if}
      <button class="hamburger-btn" on:click={() => { mobileMenuOpen = !mobileMenuOpen; }} aria-label="Menu">
        {mobileMenuOpen ? '✕' : '☰'}
      </button>
    </div>
  </header>

  <!-- DRAWER -->
  {#if mobileMenuOpen}
    <div class="drawer-backdrop" on:click={() => { mobileMenuOpen = false; }}>
      <nav class="mobile-drawer" on:click|stopPropagation>
        <div class="drawer-links">
          <button class="drawer-item {currentPage === 'home' ? 'active' : ''}" on:click={() => navigateTo('home')}>
            <span>🏠</span> Overview
          </button>
          <button class="drawer-item {currentPage === 'audit' ? 'active' : ''}" on:click={() => navigateTo('audit')}>
            <span>⚡</span> Contract Auditor
          </button>
          <button class="drawer-item {currentPage === 'pricing' ? 'active' : ''}" on:click={() => navigateTo('pricing')}>
            <span>💎</span> Pricing & UPI
          </button>
        </div>

        <div class="drawer-footer">
          {#if currentUser}
            <div class="drawer-user">
              <span class="dot-online"></span>
              <span class="user-email">{currentUser.email}</span>
            </div>
            <div class="drawer-credits-box">
              <span>Available Audits:</span>
              <strong>⚡ {userCredits} {userCredits === 1 ? 'Credit' : 'Credits'}</strong>
            </div>
            <button class="btn-drawer-danger" on:click={handleLogout}>Log Out</button>
          {:else}
            <button class="btn-drawer-primary" on:click={() => navigateTo('auth')}>
              Sign In / Register
            </button>
          {/if}
        </div>
      </nav>
    </div>
  {/if}

  <!-- MAIN VIEWPORT -->
  <div class="viewport">
    {#if currentPage === 'home'}
      <section class="hero-card">
        <div class="badge-pill">⚖️ Calibrated for Indian & Global Law</div>
        <h1 class="hero-heading">Never Sign a Bad Client Contract Again.</h1>
        <p class="hero-description">
          Clients hide Net-90 delays, unlimited liabilities, and illegal non-competes in the fine print. SafeClause spots predatory clauses in 30 seconds and generates safe, copy-paste counter-clauses.
        </p>

        <div class="hero-actions">
          <button class="btn-cta-main" on:click={() => navigateTo('audit')}>
            Audit Your Agreement Free ⚡
          </button>
          <div class="trust-bullets">
            <span>✓ Direct UPI Instant</span>
            <span>✓ Section 27 Protection</span>
            <span>✓ In-Memory Privacy</span>
          </div>
        </div>
      </section>

      <section class="section-block">
        <div class="block-eyebrow">THE 3 BIGGEST TRAPS</div>
        <h2 class="block-title">How Bad Contracts Trap Freelancers</h2>

        <div class="cards-list">
          <div class="danger-card">
            <div class="danger-icon">💸</div>
            <div class="danger-body">
              <h3>Net-90 Payment Withholding</h3>
              <p>Ambiguous "paid upon client review" clauses that let clients withhold your hard-earned invoice for months.</p>
            </div>
          </div>

          <div class="danger-card">
            <div class="danger-icon">⚠️</div>
            <div class="danger-body">
              <h3>Uncapped Corporate Indemnity</h3>
              <p>Forcing individual developers to assume limitless liability for company servers, bugs, or third-party lawsuits.</p>
            </div>
          </div>

          <div class="danger-card">
            <div class="danger-icon">🚫</div>
            <div class="danger-body">
              <h3>Illegal Non-Competes</h3>
              <p>Post-termination industry bans that are completely void under Section 27 of the Indian Contract Act, 1872.</p>
            </div>
          </div>
        </div>
      </section>

      <section class="card cta-box">
        <h3>Have a contract waiting to be signed?</h3>
        <p>Don't gamble your hard work on unfair terms.</p>
        <button class="btn-cta-main" on:click={() => navigateTo('audit')}>Launch Free Auditor →</button>
      </section>

    {:else if currentPage === 'audit'}
      <section class="tool-view">
        <div class="view-header">
          <h2>Contract Safety Auditor</h2>
          <p>Choose governing jurisdiction, then paste text or pick a document.</p>
        </div>

        <div class="jur-container">
          <button class="jur-tab {jurisdiction === 'INDIA' ? 'active' : ''}" on:click={() => { jurisdiction = 'INDIA'; }}>
            🇮🇳 India (Act 1872 / MSMED)
          </button>
          <button class="jur-tab {jurisdiction === 'GLOBAL' ? 'active' : ''}" on:click={() => { jurisdiction = 'GLOBAL'; }}>
            🌐 US / UK / Remote Global
          </button>
        </div>

        <div class="card workspace">
          <div class="workspace-top">
            <label for="c-title" class="input-lbl">Contract Title</label>
            <div class="samples">
              <button class="sample-link" on:click={() => loadSample('india')}>Sample India</button>
              <span class="sep">•</span>
              <button class="sample-link" on:click={() => loadSample('global')}>Sample US</button>
            </div>
          </div>

          <input id="c-title" class="app-input" type="text" bind:value={contractTitle} placeholder="e.g. Master Services Agreement" />

          <div class="file-picker">
            <label class="file-btn">
              <span>📄 Choose PDF or TXT Contract</span>
              <input type="file" accept=".pdf,.txt" on:change={handleFileUpload} />
            </label>
          </div>

          <label for="c-text" class="input-lbl mt-12">Contract Text / Clauses</label>
          <textarea id="c-text" class="app-textarea" rows="6" bind:value={contractText} placeholder="Paste payment terms, non-compete clauses, or entire contract clauses..."></textarea>

          <button class="btn-cta-main full mt-14" on:click={handleAudit} disabled={loading}>
            {#if loading}
              <span class="btn-spinner"></span> Scanning under {jurisdiction} Law...
            {:else}
              Run Instant Risk Audit ⚡
            {/if}
          </button>

          {#if errorMessage}
            <div class="toast error">{errorMessage}</div>
          {/if}
        </div>

        {#if auditResult}
          <div id="audit-results" class="results-wrapper">
            <div class="card summary-panel">
              <div class="panel-meta">
                <span class="risk-tag {auditResult.overall_risk_score.toLowerCase()}">
                  {auditResult.overall_risk_score} RISK
                </span>
                <span class="jur-tag">{auditResult.jurisdiction} LAW</span>
              </div>
              <h3 class="panel-title">{auditResult.contract_title || 'Audit Report'}</h3>
              <p class="panel-desc">{auditResult.summary}</p>

              {#if !hasUnlocked}
                <div class="audit-paywall-banner">
                  <div class="banner-badge">💎 PROTECTED REPORT</div>
                  <div class="banner-title">5 Vulnerabilities Flagged</div>
                  <p class="banner-sub">Counter-clauses & polite negotiation emails are locked.</p>
                  
                  {#if userCredits > 0}
                    <button class="btn-cta-main full mt-10" on:click={useCreditToUnlock}>
                      Use 1 Credit to Unlock Full Report ⚡ ({userCredits} available)
                    </button>
                  {:else}
                    <button class="btn-cta-main full mt-10" on:click={() => openPayment('Single Pass', 49, 1)}>
                      Unlock for ₹49 (Get 1 Pass Credit) ⚡
                    </button>
                  {/if}
                </div>
              {:else}
                <div class="unlocked-badge">✓ Full Report Unlocked</div>
              {/if}
            </div>

            <div class="flagged-title">⚠️ Flagged Clauses ({auditResult.flagged_clauses.length})</div>

            {#each auditResult.flagged_clauses as item, idx}
              <div class="card result-card {item.risk_level.toLowerCase()}">
                <div class="result-top">
                  <span class="category-name">{item.category.replace(/_/g, ' ')}</span>
                  <span class="risk-badge {item.risk_level.toLowerCase()}">{item.risk_level} RISK</span>
                </div>

                <div class="result-row">
                  <div class="field-title danger">Problematic Fine Print:</div>
                  <div class="quote-text">"{item.extracted_text}"</div>
                </div>

                <div class="result-row">
                  <div class="field-title warning">Why It Hurts You:</div>
                  <div class="body-text">{item.issue}</div>
                </div>

                {#if hasUnlocked}
                  <div class="result-row">
                    <div class="flex-title">
                      <span class="field-title success">Safe Counter-Clause:</span>
                      <button class="btn-pill" on:click={() => copyText(item.safe_counter_clause, idx, 'clause')}>
                        {copiedIndex === idx ? '✓ Copied' : 'Copy Clause'}
                      </button>
                    </div>
                    <div class="snippet-box">{item.safe_counter_clause}</div>
                  </div>

                  <div class="result-row">
                    <div class="flex-title">
                      <span class="field-title info">Polite Client Negotiation Email:</span>
                      <button class="btn-pill ghost" on:click={() => copyText(item.negotiation_note, idx, 'email')}>
                        {copiedEmailIndex === idx ? '✓ Copied' : 'Copy Email'}
                      </button>
                    </div>
                    <div class="email-box">{item.negotiation_note}</div>
                  </div>
                {:else}
                  <div class="locked-container">
                    <div class="blurred-preview">
                      <div class="field-title success">Safe Counter-Clause:</div>
                      <div class="snippet-box">Invoices shall be paid strictly within fifteen (15) calendar days...</div>
                    </div>
                    <div class="lock-overlay">
                      <div class="lock-icon">🔒</div>
                      <div class="lock-text">Safe Counter-Clause & Client Email Locked</div>
                      {#if userCredits > 0}
                        <button class="btn-unlock-cta" on:click={useCreditToUnlock}>Use 1 Credit to Unlock ⚡</button>
                      {:else}
                        <button class="btn-unlock-cta" on:click={() => openPayment('Single Pass', 49, 1)}>Unlock for ₹49 ⚡</button>
                      {/if}
                    </div>
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </section>

    {:else if currentPage === 'pricing'}
      <section class="pricing-view">
        <div class="view-header">
          <h2>Predictable, Fair Pricing</h2>
          <p>Instant UPI checkout via Paytm Merchant — Verified by Vision AI.</p>
        </div>

        <div class="pricing-stack">
          <div class="card plan-card featured">
            <div class="plan-ribbon">RECOMMENDED</div>
            <div class="plan-header">
              <h3>Single Pass</h3>
              <div class="plan-price">₹49</div>
            </div>
            <p class="plan-subtitle">Includes 1 Full Audit Credit</p>
            <ul class="plan-features">
              <li>✓ 1 Audit Credit added to your account</li>
              <li>✓ Balanced, safe counter-clauses unlocked</li>
              <li>✓ Ready-to-send polite client emails</li>
              <li>✓ AI Instant Verification</li>
            </ul>
            <button class="btn-cta-main full" on:click={() => openPayment('Single Pass', 49, 1)}>
              Buy 1 Pass Credit (₹49) ⚡
            </button>
          </div>

          <div class="card plan-card">
            <div class="plan-header">
              <h3>Pro Monthly</h3>
              <div class="plan-price">₹199</div>
            </div>
            <p class="plan-subtitle">Includes 10 Full Audit Credits</p>
            <ul class="plan-features">
              <li>✓ 10 Audit Credits added to your account</li>
              <li>✓ Subcontractor & vendor agreement reviews</li>
              <li>✓ Priority AI pipeline speed</li>
            </ul>
            <button class="btn-plan-outline" on:click={() => openPayment('Pro Monthly', 199, 10)}>
              Get 10 Credits (₹199) ⚡
            </button>
          </div>
        </div>
      </section>

    {:else if currentPage === 'auth'}
      <section class="auth-view">
        <div class="card auth-container">
          <div class="auth-toggle">
            <button class="toggle-btn {authMode === 'login' ? 'active' : ''}" on:click={() => { authMode = 'login'; authError = ''; authMessage = ''; }}>Sign In</button>
            <button class="toggle-btn {authMode === 'signup' ? 'active' : ''}" on:click={() => { authMode = 'signup'; authError = ''; authMessage = ''; }}>Create Account</button>
            <button class="toggle-btn {authMode === 'forgot' ? 'active' : ''}" on:click={() => { authMode = 'forgot'; authError = ''; authMessage = ''; }}>Forgot?</button>
          </div>

          {#if authMode === 'login'}
            <h2>Welcome Back</h2>
            <p class="auth-helper">Sign in to access your audit credits.</p>
          {:else if authMode === 'signup'}
            <h2>Create Free Account</h2>
            <p class="auth-helper">Sign up to retain contract audit history safely.</p>
          {:else}
            <h2>Reset Password</h2>
            <p class="auth-helper">Enter your email for password reset instructions.</p>
          {/if}

          <form on:submit|preventDefault={handleAuth}>
            <label for="a-email" class="input-lbl">Email Address</label>
            <input id="a-email" class="app-input" type="email" bind:value={authEmail} placeholder="you@domain.com" required />

            {#if authMode !== 'forgot'}
              <div class="pwd-head">
                <label for="a-pwd" class="input-lbl mt-12">Password</label>
                {#if authMode === 'login'}
                  <button type="button" class="forgot-link" on:click={() => { authMode = 'forgot'; authError = ''; authMessage = ''; }}>Forgot password?</button>
                {/if}
              </div>
              <input id="a-pwd" class="app-input" type="password" bind:value={authPassword} placeholder="••••••••" required />
            {/if}

            <button class="btn-cta-main full mt-16" type="submit" disabled={authLoading}>
              {#if authLoading}
                <span class="btn-spinner"></span> Connecting...
              {:else if authMode === 'login'}
                Sign In
              {:else if authMode === 'signup'}
                Create Free Account
              {:else}
                Send Reset Link
              {/if}
            </button>
          </form>

          {#if authMessage}
            <div class="toast success mt-12">{authMessage}</div>
          {/if}
          {#if authError}
            <div class="toast error mt-12">{authError}</div>
          {/if}
        </div>
      </section>
    {/if}
  </div>

  <!-- AI VISION PAYMENT MODAL (NO UTR TYPING) -->
  {#if paymentModalOpen}
    <div class="modal-layer" on:click={() => { paymentModalOpen = false; }}>
      <div class="modal-box payment-sheet" on:click|stopPropagation>
        <div class="modal-header">
          <div>
            <h3 class="pay-title">Instant UPI Payment</h3>
            <span class="pay-plan-badge">{selectedPlan.name} • ₹{selectedPlan.price} FIXED (+{selectedPlan.credits} Credit)</span>
          </div>
          <button class="modal-close" on:click={() => { paymentModalOpen = false; }}>✕</button>
        </div>

        {#if paymentSuccess}
          <div class="pay-success-box">
            <span class="success-icon">🎉</span>
            <h4>Receipt Verified by AI!</h4>
            <p><strong>UTR: {verifiedUtr}</strong> verified. +{selectedPlan.credits} Credit added to your account!</p>
          </div>
        {:else}
          <div class="pay-body">
            <!-- 1. Tap To Pay -->
            <a 
              class="btn-upi-intent" 
              href="upi://pay?pa={upiId}&pn={encodeURIComponent(payeeName)}&am={selectedPlan.price}.00&cu=INR&tn=SafeClause-{selectedPlan.name.replace(/\s+/g,'')}&mode=02"
            >
              <span class="upi-logo">⚡</span>
              <span>1. Tap to Pay ₹{selectedPlan.price} (GPay/PhonePe/Paytm)</span>
            </a>

            <!-- 2. Screenshot Upload with AI -->
            <div class="ai-verify-section">
              <label class="input-lbl mt-14">2. Upload Payment Success Screenshot</label>
              <p class="utr-tip">Take a screenshot of the payment receipt and upload it. OpenRouter Vision AI will verify it instantly.</p>

              <label class="upload-dropzone">
                {#if screenshotPreview}
                  <img src={screenshotPreview} alt="Receipt Preview" class="receipt-thumb" />
                  <span class="change-txt">Tap to change image</span>
                {:else}
                  <span class="drop-icon">📸</span>
                  <span class="drop-txt">Tap to select payment screenshot</span>
                {/if}
                <input type="file" accept="image/*" on:change={handleScreenshotSelect} />
              </label>

              <button 
                class="btn-cta-main full mt-14" 
                on:click={submitAiVerification} 
                disabled={verifyingPayment || !screenshotBase64}
              >
                {#if verifyingPayment}
                  <span class="btn-spinner"></span> AI Scanning Receipt & Bank UTR...
                {:else}
                  AI Verify & Unlock Credit ⚡
                {/if}
              </button>

              {#if paymentError}
                <div class="toast error mt-10">{paymentError}</div>
              {/if}
            </div>
          </div>
        {/if}
      </div>
    </div>
  {/if}

  <!-- FOOTER -->
  <footer class="app-footer">
    <div class="footer-pills">
      <button on:click={() => { legalModal = 'privacy'; }}>Privacy</button>
      <span class="sep">•</span>
      <button on:click={() => { legalModal = 'terms'; }}>Terms</button>
      <span class="sep">•</span>
      <button on:click={() => { legalModal = 'refund'; }}>Refunds</button>
    </div>
    <div class="footer-note">SafeClause is an AI document auditing tool. Outputs do not constitute formal legal counsel.</div>
    <div class="footer-copy">© 2026 SafeClause. Built for independent creators.</div>
  </footer>
</div>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    background-color: #07090e;
    color: #f1f5f9;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    overflow-x: hidden;
  }

  .app-wrapper {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background: radial-gradient(circle at 50% 0%, rgba(16, 185, 129, 0.08) 0%, transparent 50%), #07090e;
  }

  .viewport {
    flex: 1;
    max-width: 600px;
    width: 100%;
    margin: 0 auto;
    padding: 16px;
    box-sizing: border-box;
  }

  .app-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: rgba(11, 15, 23, 0.85);
    backdrop-filter: blur(12px);
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
    position: sticky;
    top: 0;
    z-index: 50;
  }

  .brand { display: flex; align-items: center; gap: 10px; cursor: pointer; }
  .brand-shield { font-size: 1.4rem; line-height: 1; }
  .brand-info { display: flex; flex-direction: column; }
  .brand-title { font-size: 1.05rem; font-weight: 800; color: #ffffff; }
  .brand-sub { font-size: 0.65rem; color: #10b981; font-weight: 600; }

  .header-actions { display: flex; align-items: center; gap: 8px; }
  .credit-pill {
    background: rgba(16, 185, 129, 0.15);
    border: 1px solid #10b981;
    color: #10b981;
    font-size: 0.75rem;
    font-weight: 800;
    padding: 6px 12px;
    border-radius: 999px;
    cursor: pointer;
  }

  .btn-nav-quick {
    background: rgba(16, 185, 129, 0.15);
    border: 1px solid rgba(16, 185, 129, 0.3);
    color: #10b981;
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 700;
    cursor: pointer;
  }

  .hamburger-btn {
    width: 36px;
    height: 36px;
    background: #111726;
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #ffffff;
    font-size: 1.1rem;
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .drawer-backdrop {
    position: fixed;
    top: 61px; left: 0; right: 0; bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    z-index: 49;
  }

  .mobile-drawer {
    background: #0d121f;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .drawer-links { display: flex; flex-direction: column; gap: 8px; }
  .drawer-item {
    display: flex;
    align-items: center;
    gap: 10px;
    background: transparent;
    border: none;
    color: #94a3b8;
    font-size: 0.95rem;
    font-weight: 600;
    padding: 12px 14px;
    border-radius: 8px;
    text-align: left;
    cursor: pointer;
  }
  .drawer-item.active { background: #162035; color: #10b981; }

  .drawer-footer { border-top: 1px solid rgba(255, 255, 255, 0.08); padding-top: 12px; }
  .drawer-user { display: flex; align-items: center; gap: 8px; font-size: 0.8rem; color: #cbd5e1; margin-bottom: 6px; }
  .dot-online { width: 8px; height: 8px; background: #10b981; border-radius: 50%; }
  .drawer-credits-box {
    display: flex;
    justify-content: space-between;
    background: #111a2d;
    padding: 8px 12px;
    border-radius: 8px;
    font-size: 0.8rem;
    color: #94a3b8;
    margin-bottom: 12px;
  }
  .drawer-credits-box strong { color: #10b981; }

  .btn-drawer-primary {
    width: 100%;
    background: #10b981;
    color: #000;
    font-weight: 700;
    padding: 12px;
    border: none;
    border-radius: 8px;
    font-size: 0.9rem;
    cursor: pointer;
  }

  .btn-drawer-danger {
    width: 100%;
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid #ef4444;
    color: #f87171;
    padding: 10px;
    border-radius: 8px;
    font-weight: 700;
    font-size: 0.85rem;
    cursor: pointer;
  }

  .card {
    background: #0e1422;
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 14px;
    padding: 16px;
    box-sizing: border-box;
  }

  .hero-card { text-align: center; padding: 24px 8px 16px; }
  .badge-pill {
    display: inline-block;
    background: rgba(16, 185, 129, 0.12);
    border: 1px solid rgba(16, 185, 129, 0.25);
    color: #10b981;
    font-size: 0.72rem;
    font-weight: 700;
    padding: 4px 12px;
    border-radius: 999px;
    margin-bottom: 14px;
  }

  .hero-heading { font-size: 1.65rem; font-weight: 800; line-height: 1.25; margin: 0 0 12px; color: #ffffff; }
  .hero-description { font-size: 0.9rem; color: #94a3b8; line-height: 1.5; margin: 0 0 20px; }
  .hero-actions { display: flex; flex-direction: column; align-items: center; gap: 12px; }

  .btn-cta-main {
    background: #10b981;
    color: #000000;
    font-weight: 800;
    font-size: 0.95rem;
    padding: 14px 20px;
    border: none;
    border-radius: 10px;
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(16, 185, 129, 0.3);
  }
  .btn-cta-main.full { width: 100%; }
  .btn-cta-main:disabled { opacity: 0.5; cursor: not-allowed; }

  .trust-bullets { display: flex; gap: 10px; font-size: 0.7rem; color: #64748b; }

  .section-block { padding-top: 32px; }
  .block-eyebrow { font-size: 0.68rem; font-weight: 800; color: #10b981; letter-spacing: 0.08em; margin-bottom: 4px; }
  .block-title { font-size: 1.25rem; font-weight: 800; margin: 0 0 14px; }

  .cards-list { display: flex; flex-direction: column; gap: 10px; }
  .danger-card {
    display: flex;
    gap: 12px;
    background: #0e1422;
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 12px;
    padding: 14px;
  }
  .danger-icon { font-size: 1.3rem; }
  .danger-body h3 { font-size: 0.9rem; font-weight: 700; margin: 0 0 4px; }
  .danger-body p { font-size: 0.8rem; color: #94a3b8; margin: 0; line-height: 1.4; }

  .cta-box { margin-top: 32px; text-align: center; border-color: rgba(16, 185, 129, 0.3); }
  .cta-box h3 { margin: 0 0 6px; font-size: 1.15rem; }
  .cta-box p { font-size: 0.85rem; color: #94a3b8; margin: 0 0 16px; }

  .tool-view { padding-top: 8px; }
  .view-header h2 { font-size: 1.3rem; font-weight: 800; margin: 0 0 4px; }
  .view-header p { font-size: 0.8rem; color: #94a3b8; margin: 0 0 14px; }

  .jur-container { display: flex; gap: 8px; margin-bottom: 12px; }
  .jur-tab {
    flex: 1;
    background: #0e1422;
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #94a3b8;
    padding: 10px 8px;
    border-radius: 8px;
    font-size: 0.75rem;
    font-weight: 700;
    cursor: pointer;
  }
  .jur-tab.active { background: #142036; border-color: #38bdf8; color: #ffffff; }

  .workspace-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
  .input-lbl { font-size: 0.78rem; font-weight: 700; color: #cbd5e1; display: block; }
  .samples { display: flex; align-items: center; gap: 4px; }
  .sample-link { background: transparent; border: none; color: #10b981; font-size: 0.72rem; font-weight: 700; cursor: pointer; padding: 0; }
  .sep { color: #475569; font-size: 0.7rem; }

  .app-input, .app-textarea {
    width: 100%;
    background: #07090e;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 10px 12px;
    color: #ffffff;
    font-size: 0.88rem;
    box-sizing: border-box;
  }
  .app-input:focus, .app-textarea:focus { border-color: #10b981; outline: none; }

  .file-picker { margin-top: 10px; }
  .file-btn {
    display: block;
    background: #07090e;
    border: 1px dashed rgba(255, 255, 255, 0.15);
    padding: 10px;
    text-align: center;
    border-radius: 8px;
    font-size: 0.78rem;
    color: #94a3b8;
    cursor: pointer;
  }
  .file-btn input { display: none; }

  .mt-10 { margin-top: 10px; }
  .mt-12 { margin-top: 12px; }
  .mt-14 { margin-top: 14px; }
  .mt-16 { margin-top: 16px; }

  .toast { padding: 10px 12px; border-radius: 8px; font-size: 0.8rem; margin-top: 10px; line-height: 1.4; }
  .toast.error { background: rgba(239, 68, 68, 0.15); border: 1px solid #ef4444; color: #fca5a5; }
  .toast.success { background: rgba(16, 185, 129, 0.15); border: 1px solid #10b981; color: #6ee7b7; }

  .results-wrapper { margin-top: 20px; }
  .summary-panel { background: #111a2e; border-color: rgba(56, 189, 248, 0.3); }
  .panel-meta { display: flex; justify-content: space-between; margin-bottom: 8px; }
  .risk-tag { font-size: 0.68rem; font-weight: 800; padding: 3px 8px; border-radius: 4px; }
  .risk-tag.high { background: #ef4444; color: #fff; }
  .risk-tag.medium { background: #f59e0b; color: #000; }
  .risk-tag.low { background: #10b981; color: #000; }
  .jur-tag { font-size: 0.68rem; font-weight: 700; color: #38bdf8; }
  .panel-title { font-size: 1.1rem; margin: 0 0 6px; font-weight: 800; }
  .panel-desc { font-size: 0.82rem; color: #cbd5e1; margin: 0; line-height: 1.4; }

  .audit-paywall-banner {
    margin-top: 14px;
    background: linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(56, 189, 248, 0.12));
    border: 1px solid rgba(16, 185, 129, 0.4);
    border-radius: 10px;
    padding: 12px;
    text-align: center;
  }
  .banner-badge { font-size: 0.68rem; font-weight: 800; color: #fbbf24; margin-bottom: 2px; }
  .banner-title { font-size: 0.95rem; font-weight: 800; color: #ffffff; }
  .banner-sub { font-size: 0.75rem; color: #94a3b8; margin: 2px 0 0; }
  .unlocked-badge { margin-top: 10px; font-size: 0.78rem; font-weight: 700; color: #34d399; }

  .flagged-title { font-size: 1.05rem; font-weight: 800; margin: 20px 0 10px; }
  .result-card { border-left: 4px solid #ef4444; margin-bottom: 12px; }
  .result-card.medium { border-left-color: #f59e0b; }
  .result-top { display: flex; justify-content: space-between; margin-bottom: 8px; }
  .category-name { font-size: 0.72rem; font-weight: 700; color: #94a3b8; }
  .risk-badge { font-size: 0.65rem; font-weight: 800; padding: 2px 6px; border-radius: 4px; }
  .risk-badge.high { background: rgba(239, 68, 68, 0.2); color: #f87171; }
  .risk-badge.medium { background: rgba(245, 158, 11, 0.2); color: #fbbf24; }

  .result-row { margin-top: 8px; }
  .field-title { font-size: 0.72rem; font-weight: 700; margin-bottom: 2px; }
  .field-title.danger { color: #f87171; }
  .field-title.warning { color: #fbbf24; }
  .field-title.success { color: #34d399; }
  .field-title.info { color: #38bdf8; }

  .quote-text { font-style: italic; color: #fca5a5; font-size: 0.8rem; line-height: 1.35; }
  .body-text { color: #cbd5e1; font-size: 0.8rem; line-height: 1.35; }

  .flex-title { display: flex; justify-content: space-between; align-items: center; }
  .btn-pill { background: #10b981; color: #000; font-size: 0.68rem; font-weight: 800; padding: 3px 8px; border-radius: 4px; border: none; cursor: pointer; }
  .btn-pill.ghost { background: #1e293b; color: #f8fafc; }

  .snippet-box {
    background: #07090e;
    border: 1px solid rgba(16, 185, 129, 0.4);
    border-radius: 6px;
    padding: 8px;
    color: #a7f3d0;
    font-family: monospace;
    font-size: 0.78rem;
    margin-top: 4px;
    white-space: pre-wrap;
  }

  .email-box {
    background: #07090e;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 6px;
    padding: 8px;
    color: #cbd5e1;
    font-size: 0.78rem;
    margin-top: 4px;
    white-space: pre-wrap;
  }

  .locked-container {
    position: relative;
    margin-top: 10px;
    border-radius: 8px;
    overflow: hidden;
    background: #07090e;
    border: 1px dashed rgba(255, 255, 255, 0.15);
  }
  .blurred-preview {
    filter: blur(4.5px);
    opacity: 0.3;
    user-select: none;
    pointer-events: none;
    padding: 10px;
  }
  .lock-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: rgba(7, 9, 14, 0.78);
    backdrop-filter: blur(2px);
    padding: 12px;
    text-align: center;
  }
  .lock-icon { font-size: 1.2rem; margin-bottom: 2px; }
  .lock-text { font-size: 0.78rem; color: #e2e8f0; font-weight: 700; margin-bottom: 8px; }
  .btn-unlock-cta {
    background: #10b981;
    color: #000;
    font-weight: 800;
    font-size: 0.78rem;
    padding: 8px 14px;
    border-radius: 6px;
    border: none;
    cursor: pointer;
    box-shadow: 0 2px 10px rgba(16, 185, 129, 0.4);
  }

  .pricing-view { padding-top: 8px; }
  .pricing-stack { display: flex; flex-direction: column; gap: 12px; }
  .plan-card { position: relative; }
  .plan-card.featured { border-color: rgba(16, 185, 129, 0.5); background: #0f1c29; }
  .plan-ribbon {
    position: absolute;
    top: -9px; right: 14px;
    background: #10b981;
    color: #000;
    font-size: 0.62rem;
    font-weight: 800;
    padding: 2px 6px;
    border-radius: 4px;
  }
  .plan-header { display: flex; justify-content: space-between; align-items: baseline; }
  .plan-header h3 { margin: 0; font-size: 1.05rem; }
  .plan-price { font-size: 1.5rem; font-weight: 800; }
  .plan-subtitle { font-size: 0.75rem; color: #94a3b8; margin: 2px 0 12px; }
  .plan-features { list-style: none; padding: 0; margin: 0 0 14px; display: flex; flex-direction: column; gap: 6px; font-size: 0.78rem; }
  .btn-plan-outline {
    width: 100%;
    background: #141c2c;
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #ffffff;
    padding: 10px;
    border-radius: 8px;
    font-weight: 700;
    font-size: 0.82rem;
    cursor: pointer;
  }

  .auth-view { padding-top: 16px; }
  .auth-container { max-width: 380px; margin: 0 auto; }
  .auth-toggle { display: flex; border-bottom: 1px solid rgba(255, 255, 255, 0.08); margin-bottom: 14px; }
  .toggle-btn {
    flex: 1;
    background: transparent;
    border: none;
    padding: 8px 4px;
    color: #94a3b8;
    font-weight: 700;
    font-size: 0.8rem;
    cursor: pointer;
    border-bottom: 2px solid transparent;
  }
  .toggle-btn.active { color: #10b981; border-bottom-color: #10b981; }
  .auth-container h2 { margin: 0 0 4px; font-size: 1.2rem; }
  .auth-helper { font-size: 0.78rem; color: #94a3b8; margin: 0 0 14px; }
  .pwd-head { display: flex; justify-content: space-between; align-items: baseline; }
  .forgot-link { background: transparent; border: none; color: #38bdf8; font-size: 0.72rem; font-weight: 600; cursor: pointer; padding: 0; }

  /* PAYMENT SHEET & DROPZONE */
  .payment-sheet {
    max-width: 420px;
    background: #0d1322;
    border-color: rgba(16, 185, 129, 0.4);
    box-shadow: 0 10px 30px rgba(0,0,0,0.8);
  }
  .pay-title { margin: 0; font-size: 1.1rem; font-weight: 800; }
  .pay-plan-badge { font-size: 0.75rem; color: #10b981; font-weight: 700; }

  .btn-upi-intent {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    background: #10b981;
    color: #000;
    font-weight: 800;
    font-size: 0.88rem;
    padding: 13px;
    border-radius: 8px;
    text-decoration: none;
    margin-top: 14px;
    text-align: center;
  }
  .upi-logo { font-size: 1.1rem; }

  .upload-dropzone {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    border: 1px dashed rgba(16, 185, 129, 0.4);
    background: #07090e;
    border-radius: 10px;
    padding: 16px;
    margin-top: 8px;
    cursor: pointer;
    text-align: center;
  }
  .upload-dropzone input { display: none; }
  .drop-icon { font-size: 1.6rem; margin-bottom: 4px; }
  .drop-txt { font-size: 0.8rem; color: #94a3b8; font-weight: 600; }
  .receipt-thumb { max-height: 140px; border-radius: 6px; object-fit: contain; margin-bottom: 6px; }
  .change-txt { font-size: 0.72rem; color: #10b981; font-weight: 700; }
  .utr-tip { font-size: 0.72rem; color: #64748b; margin: 2px 0 8px; }

  .pay-success-box { text-align: center; padding: 24px 8px; }
  .success-icon { font-size: 2.2rem; display: block; margin-bottom: 8px; }
  .pay-success-box h4 { margin: 0 0 6px; font-size: 1.2rem; color: #10b981; }
  .pay-success-box p { margin: 0; font-size: 0.82rem; color: #cbd5e1; line-height: 1.4; }

  .app-footer {
    padding: 24px 16px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    text-align: center;
    margin-top: 32px;
  }
  .footer-pills { display: flex; justify-content: center; align-items: center; gap: 8px; margin-bottom: 8px; }
  .footer-pills button { background: transparent; border: none; color: #64748b; font-size: 0.75rem; cursor: pointer; }
  .footer-pills button:hover { color: #10b981; }
  .footer-note { font-size: 0.68rem; color: #475569; max-width: 440px; margin: 0 auto 6px; line-height: 1.4; }
  .footer-copy { font-size: 0.65rem; color: #334155; }

  .btn-spinner {
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid #000;
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    vertical-align: middle;
    margin-right: 4px;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .modal-layer {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    z-index: 100;
  }
  .modal-box {
    background: #0e1422;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 18px;
    max-width: 440px;
    width: 100%;
  }
  .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
  .modal-header h3 { margin: 0; font-size: 1rem; }
  .modal-close { background: transparent; border: none; color: #94a3b8; font-size: 1.1rem; cursor: pointer; }
</style>
