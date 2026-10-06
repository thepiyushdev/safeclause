<script>
  const PAYMENT_LINK = "";
  const STORAGE_KEY = "safeclause_credits";
  const MAX_CHARS = 10000;

  let contractText = "";
  let loading = false;
  let error = "";
  let result = null;
  let unlocked = [];
  let copied = "";
  let payNote = "";
  let credits = loadCredits();

  $: clauses = result && Array.isArray(result.clauses) ? result.clauses : [];
  $: highCount = clauses.filter(function (c) { return String(c.risk_level).toUpperCase() === "HIGH"; }).length;

  function loadCredits() {
    try {
      const n = parseInt(localStorage.getItem(STORAGE_KEY) || "0", 10);
      return Number.isFinite(n) && n > 0 ? n : 0;
    } catch (e) {
      return 0;
    }
  }

  function saveCredits() {
    try { localStorage.setItem(STORAGE_KEY, String(credits)); } catch (e) {}
  }

  function addCredits(n) {
    credits = credits + n;
    saveCredits();
  }

  function fmt(s) {
    return String(s || "").replace(/\r\n/g, "\n").replace(/\\n/g, "\n");
  }

  function riskClass(level) {
    const l = String(level || "").toUpperCase();
    return l === "HIGH" ? "high" : l === "LOW" ? "low" : "med";
  }

  async function runAudit() {
    error = "";
    const text = contractText.trim();
    if (text.length < 50) {
      error = "Paste your contract text first (at least a few lines).";
      return;
    }
    loading = true;
    result = null;
    unlocked = [];
    try {
      const r = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.slice(0, MAX_CHARS) }),
      });
      const raw = await r.text();
      let data = null;
      try { data = JSON.parse(raw); } catch (e) {}
      if (!r.ok || !data) {
        throw new Error((data && data.error) || "Server error (HTTP " + r.status + ")");
      }
      result = data;
    } catch (e) {
      error = e && e.message ? e.message : "Something went wrong. Please try again.";
    } finally {
      loading = false;
    }
  }

  function unlockWithCredit(i) {
    if (credits < 1 || unlocked.includes(i)) return;
    credits = credits - 1;
    saveCredits();
    unlocked = [...unlocked, i];
  }

  function startCheckout() {
    if (PAYMENT_LINK) {
      window.open(PAYMENT_LINK, "_blank", "noopener");
      return;
    }
    const el = document.getElementById("pricing");
    if (el) el.scrollIntoView({ behavior: "smooth" });
  }

  function onUnlock(i) {
    if (credits > 0) unlockWithCredit(i);
    else startCheckout();
  }

  function buyCredit() {
    if (PAYMENT_LINK) {
      payNote = "";
      window.open(PAYMENT_LINK, "_blank", "noopener");
    } else {
      payNote = "Payment link is not configured yet.";
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
</script>

<main>
  <header class="top">
    <h1>🛡️ SafeClause</h1>
    <p class="tag">Find the contract traps before you sign. Built for freelancers.</p>
    <div class="credits">Credits: <strong>{credits}</strong></div>
  </header>

  <section class="input-card">
    <textarea
      bind:value={contractText}
      rows="10"
      placeholder="Paste your client contract or agreement here..."
    ></textarea>
    <div class="count">{contractText.length} / {MAX_CHARS} characters (only the first {MAX_CHARS} are analyzed)</div>
    <button class="primary" on:click={runAudit} disabled={loading}>
      {loading ? "Auditing contract..." : "Run Instant Risk Audit ⚡"}
    </button>
    {#if error}
      <div class="error" role="alert">⚠️ {error}</div>
    {/if}
  </section>

  {#if result}
    <section class="summary">
      <div class="summary-head">
        <h2>Executive Summary</h2>
        <span class="badge {riskClass(result.overall_risk)}">{String(result.overall_risk || "MEDIUM").toUpperCase()} RISK</span>
      </div>
      <p>{fmt(result.executive_summary)}</p>
      <p class="stats">{clauses.length} risky clause{clauses.length === 1 ? "" : "s"} found • {highCount} high risk</p>
    </section>

    {#each clauses as c, i}
      <article class="card">
        <div class="card-head">
          <span class="cat">{c.category}</span>
          <span class="badge {riskClass(c.risk_level)}">{String(c.risk_level).toUpperCase()} RISK</span>
        </div>

        <h3>Problematic Fine Print</h3>
        <blockquote>{fmt(c.problematic_fine_print)}</blockquote>

        <h3>Why It Hurts You</h3>
        <p class="pre">{fmt(c.why_it_hurts)}</p>

        <div class="locked-wrap">
          <div class="premium" class:blurred={!unlocked.includes(i)}>
            <h3>Safe Counter-Clause</h3>
            <div class="box pre">{fmt(c.safe_counter_clause)}</div>
            {#if unlocked.includes(i)}
              <button class="ghost" on:click={() => copyText(c.safe_counter_clause, "clause-" + i)}>
                {copied === "clause-" + i ? "Copied ✓" : "Copy Clause"}
              </button>
            {/if}

            <h3>Polite Client Negotiation Email</h3>
            <div class="box pre">{fmt(c.polite_client_negotiation_email)}</div>
            {#if unlocked.includes(i)}
              <button class="ghost" on:click={() => copyText(c.polite_client_negotiation_email, "email-" + i)}>
                {copied === "email-" + i ? "Copied ✓" : "Copy Email"}
              </button>
            {/if}
          </div>

          {#if !unlocked.includes(i)}
            <div class="lock-overlay">
              <div class="lock-card">
                <div class="lock-title">🔒 Counter-Clause &amp; Negotiation Email Locked</div>
                <button class="primary" on:click={() => onUnlock(i)}>
                  {#if credits > 0}
                    Use 1 Credit to Unlock (Balance: {credits}) ⚡
                  {:else}
                    Unlock for ₹49 (Get 1 Credit) ⚡
                  {/if}
                </button>
              </div>
            </div>
          {/if}
        </div>
      </article>
    {/each}

    {#if clauses.length === 0}
      <section class="summary"><p>No major red flags detected in the text you pasted. ✅</p></section>
    {/if}
  {/if}

  <section id="pricing" class="pricing">
    <h2>Simple pricing</h2>
    <p>₹49 = 1 credit = 1 unlocked clause fix (counter-clause + negotiation email).</p>
    <button class="primary" on:click={buyCredit}>Buy 1 Credit — ₹49 ⚡</button>
    {#if payNote}<p class="note">{payNote}</p>{/if}
  </section>

  <footer>SafeClause is an AI tool, not a lawyer. Have important contracts reviewed by a qualified professional.</footer>
</main>

<style>
  :global(body) { margin: 0; background: #0b0f17; color: #e6e9ef; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  main { max-width: 760px; margin: 0 auto; padding: 20px 16px 60px; }
  .top { text-align: center; margin-bottom: 20px; }
  h1 { margin: 0; font-size: 1.8rem; }
  .tag { color: #9aa4b5; margin: 6px 0 10px; }
  .credits { display: inline-block; padding: 4px 12px; border-radius: 999px; background: #151b28; border: 1px solid #263044; font-size: 0.85rem; }
  .input-card, .summary, .card, .pricing { background: #121826; border: 1px solid #263044; border-radius: 14px; padding: 16px; margin-bottom: 16px; }
  textarea { width: 100%; box-sizing: border-box; background: #0b0f17; color: inherit; border: 1px solid #263044; border-radius: 10px; padding: 12px; font: inherit; resize: vertical; }
  .count { font-size: 0.75rem; color: #7d889b; margin: 6px 0 12px; }
  button { font: inherit; cursor: pointer; border-radius: 10px; border: 0; }
  button.primary { width: 100%; padding: 13px 16px; font-weight: 700; color: #fff; background: linear-gradient(135deg, #6d5efc, #3b82f6); }
  button.primary:disabled { opacity: 0.6; cursor: wait; }
  button.ghost { margin-top: 8px; padding: 8px 14px; background: #1c2536; color: #e6e9ef; border: 1px solid #2d3a52; }
  .error { margin-top: 12px; padding: 12px 14px; border-radius: 10px; background: #3a1519; border: 1px solid #7f2a33; color: #ffb4bc; font-size: 0.9rem; word-break: break-word; }
  .summary-head, .card-head { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; }
  h2 { margin: 0 0 8px; font-size: 1.15rem; }
  h3 { margin: 16px 0 6px; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.06em; color: #9aa4b5; }
  .stats { color: #9aa4b5; font-size: 0.85rem; }
  .cat { font-weight: 700; font-size: 0.85rem; letter-spacing: 0.05em; }
  .badge { padding: 3px 10px; border-radius: 999px; font-size: 0.72rem; font-weight: 700; }
  .badge.high { background: #4a1a20; color: #ff8793; }
  .badge.med { background: #44340f; color: #ffd36b; }
  .badge.low { background: #123a26; color: #6ee7a0; }
  blockquote { margin: 0; padding: 10px 14px; border-left: 3px solid #ff8793; background: #1a1f2e; border-radius: 6px; white-space: pre-wrap; font-style: italic; }
  .pre { white-space: pre-wrap; word-break: break-word; line-height: 1.55; }
  .box { background: #0b0f17; border: 1px solid #263044; border-radius: 10px; padding: 12px; }
  .locked-wrap { position: relative; margin-top: 6px; }
  .premium.blurred { filter: blur(8px); opacity: 0.35; pointer-events: none; user-select: none; }
  .lock-overlay { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; padding: 10px; }
  .lock-card { width: 100%; max-width: 400px; text-align: center; padding: 18px 16px; border-radius: 14px; background: rgba(10, 14, 22, 0.88); border: 1px solid rgba(255, 255, 255, 0.14); backdrop-filter: blur(6px); box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5); }
  .lock-title { font-weight: 700; margin-bottom: 12px; }
  .pricing { text-align: center; }
  .note { color: #ffd36b; font-size: 0.85rem; }
  footer { text-align: center; color: #6b7588; font-size: 0.75rem; margin-top: 24px; }
</style>
