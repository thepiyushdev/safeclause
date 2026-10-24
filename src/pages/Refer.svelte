<script>
  import { onMount } from "svelte";
  import { user, openAuth } from "../lib/app.js";

  let loading = false;
  let wallet = null;
  let referrals = [];
  let payouts = [];
  let upiId = "";
  let msg = "";
  let err = "";
  let copiedLink = false;
  let copiedScript = "";

  $: refLink = wallet?.ref_code
    ? `https://clauseradar.online/?ref=${wallet.ref_code}`
    : "https://clauseradar.online/?ref=PARTNER";

  $: paidOutTotal = payouts
    .filter((p) => p.status === "approved")
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  $: pendingTotal = payouts
    .filter((p) => p.status === "pending")
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  // Build 6-month visual chart bars
  $: chartBars = (() => {
    const months = ["May", "Jun", "Jul", "Aug", "Sep", "Oct"];
    const base = months.map((m, idx) => ({
      label: m,
      value: idx === months.length - 1 ? Number(wallet?.total_earned || 50) : 0
    }));
    const max = Math.max(...base.map((b) => b.value), 500);
    return base.map((b) => ({ ...b, pct: Math.max(12, Math.round((b.value / max) * 100)) }));
  })();

  async function loadDashboard(u) {
    if (!u?.id) return;
    loading = true;
    err = "";
    try {
      const savedRef = localStorage.getItem("cr_ref") || "";
      const r = await fetch("/api/affiliate?action=dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "dashboard",
          user_id: u.id,
          email: u.email,
          referred_by: savedRef
        })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed to load affiliate dashboard");
      wallet = d.wallet;
      referrals = d.referrals || [];
      payouts = d.payouts || [];
    } catch (e) {
      err = e.message;
    } finally {
      loading = false;
    }
  }

  $: if ($user?.id) {
    loadDashboard($user);
  }

  function copyReferralLink() {
    navigator.clipboard.writeText(refLink);
    copiedLink = true;
    setTimeout(() => (copiedLink = false), 2500);
  }

  function copyCreatorScript(type) {
    const reelScript = `Stop signing freelance contracts blindly! 🚨 I just found ClauseRadar (${refLink}) — an AI tool that scans your client agreement in 30 seconds for uncapped liability & payment traps, and even blocks unpaid scope creep. Use my special partner link in bio to scan your contract for free!`;
    const dmScript = `Hey! Before you sign your next freelance contract or deal with client scope creep, run it through ClauseRadar (${refLink}). It catches risky clauses in 30 seconds and writes polite counter-offers automatically.`;
    navigator.clipboard.writeText(type === "reel" ? reelScript : dmScript);
    copiedScript = type;
    setTimeout(() => (copiedScript = ""), 2500);
  }

  async function requestPayout() {
    msg = "";
    err = "";
    if (!upiId.includes("@")) {
      err = "Please enter a valid UPI ID (example: yourname@okicici or 9876543210@ybl)";
      return;
    }
    loading = true;
    try {
      const r = await fetch("/api/affiliate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "request_payout",
          user_id: $user.id,
          email: $user.email,
          upi_id: upiId
        })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Could not submit payout request");
      msg = "🎉 Payout request submitted! Once verified, payment will be sent to your UPI ID and marked Approved below.";
      upiId = "";
      await loadDashboard($user);
    } catch (e) {
      err = e.message;
    } finally {
      loading = false;
    }
  }
</script>

<div class="refer-wrap">
  <div class="refer-hero">
    <span class="badge-pill">💸 CLAUSERADAR PARTNER PROGRAM</span>
    <h1>Refer & Earn <span class="grad-txt">30% Cash</span> on Every Pro Subscription</h1>
    <p class="sub">
      Earn <strong>₹150</strong> on every Monthly Pro (₹499) and <strong>₹1,200</strong> on every Yearly Pro (₹3,999) referral — paid directly to your UPI ID! Plus, you get a <strong>₹50 Welcome Bonus</strong> instantly on sign-up.
    </p>
  </div>

  {#if !$user}
    <div class="glass-card login-cta">
      <h2>🎁 Claim Your ₹50 Partner Bonus & Referral Link</h2>
      <p>Sign in with your account to unlock your live affiliate tracking link, earnings chart, and instant UPI withdrawal dashboard.</p>
      <button class="btn-primary" on:click={() => openAuth("signin")}>Sign In to Get Your Referral Link →</button>
    </div>
  {:else}
    {#if err}
      <div class="alert-err">{err}</div>
    {/if}
    {#if msg}
      <div class="alert-ok">{msg}</div>
    {/if}

    <!-- Referral Link Box -->
    <div class="glass-card link-box">
      <div>
        <div class="lbl">YOUR UNIQUE 30% REFERRAL LINK (Includes +7 Extra Pro Days for Friends!)</div>
        <div class="ref-url">{refLink}</div>
      </div>
      <div class="btn-row">
        <button class="btn-primary" on:click={copyReferralLink}>
          {copiedLink ? "✅ Copied Link!" : "📋 Copy Link"}
        </button>
        <a
          class="btn-wa"
          href={"https://wa.me/?text=" + encodeURIComponent("Hey! Check out ClauseRadar to scan freelance contracts for risky traps & stop unpaid scope creep in 30s: " + refLink)}
          target="_blank"
          rel="noreferrer"
        >
          Share on WhatsApp
        </a>
      </div>
    </div>

    <!-- 4 Stat Cards -->
    <div class="stats-grid">
      <div class="stat-card highlight">
        <span class="s-lbl">Available Balance (Withdrawable)</span>
        <span class="s-val">₹{wallet?.wallet_balance ?? 50}</span>
        <span class="s-note">Includes ₹50 Partner Welcome Bonus</span>
      </div>
      <div class="stat-card">
        <span class="s-lbl">Total Lifetime Earnings</span>
        <span class="s-val">₹{wallet?.total_earned ?? 50}</span>
        <span class="s-note">30% commission on all referrals</span>
      </div>
      <div class="stat-card">
        <span class="s-lbl">Total Paid Conversions</span>
        <span class="s-val">{wallet?.total_referrals ?? 0}</span>
        <span class="s-note">₹150/mo or ₹1,200/yr per sale</span>
      </div>
      <div class="stat-card">
        <span class="s-lbl">Approved UPI Payouts</span>
        <span class="s-val">₹{paidOutTotal}</span>
        <span class="s-note">{pendingTotal > 0 ? `₹${pendingTotal} Pending Approval` : "Direct to your UPI"}</span>
      </div>
    </div>

    <!-- Graph + UPI Payout Grid -->
    <div class="two-col">
      <!-- Visual Earnings Graph -->
      <div class="glass-card">
        <h3>📈 Earnings Growth Overview</h3>
        <p class="muted">Track your monthly commission growth (₹150 per Monthly Pro • ₹1,200 per Yearly Pro)</p>
        <div class="chart-box">
          {#each chartBars as bar}
            <div class="bar-col">
              <div class="bar-amt">₹{bar.value}</div>
              <div class="bar-track">
                <div class="bar-fill" style="height: {bar.pct}%"></div>
              </div>
              <div class="bar-lbl">{bar.label}</div>
            </div>
          {/each}
        </div>
      </div>

      <!-- Withdraw via UPI -->
      <div class="glass-card">
        <h3>🏦 Withdraw Earnings via UPI</h3>
        <p class="muted">Minimum withdrawal is <strong>₹200</strong> (Just 1 Monthly Pro sale + your ₹50 bonus unlocks instant withdrawal!)</p>
        <div class="upi-form">
          <label for="upi">Enter Your UPI ID (GPay / PhonePe / Paytm)</label>
          <input
            id="upi"
            type="text"
            placeholder="e.g. yourname@okicici or 9876543210@ybl"
            bind:value={upiId}
          />
          <button
            class="btn-primary full"
            disabled={loading || Number(wallet?.wallet_balance || 0) < 200}
            on:click={requestPayout}
          >
            {#if Number(wallet?.wallet_balance || 0) < 200}
              🔒 Need ₹{200 - Number(wallet?.wallet_balance || 50)} More to Withdraw (1 Sale!)
            {:else}
              💸 Withdraw ₹{wallet?.wallet_balance} to UPI Now
            {/if}
          </button>
        </div>

        <div class="creator-kit">
          <div class="lbl">🎬 CREATOR PROMO SCRIPTS (1-CLICK COPY)</div>
          <div class="btn-row">
            <button class="btn-ghost" on:click={() => copyCreatorScript("reel")}>
              {copiedScript === "reel" ? "✅ Reel Script Copied!" : "📱 Copy Instagram/YT Script"}
            </button>
            <button class="btn-ghost" on:click={() => copyCreatorScript("dm")}>
              {copiedScript === "dm" ? "✅ DM Script Copied!" : "💬 Copy WhatsApp/LinkedIn Text"}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Payout History Table -->
    <div class="glass-card">
      <h3>🧾 Your UPI Payout Requests</h3>
      {#if payouts.length === 0}
        <p class="muted">No payout requests yet. Share your link above to start earning 30% commission!</p>
      {:else}
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>UPI ID</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {#each payouts as p}
                <tr>
                  <td>{new Date(p.created_at).toLocaleDateString()}</td>
                  <td class="mono">{p.upi_id}</td>
                  <td><strong>₹{p.amount}</strong></td>
                  <td>
                    {#if p.status === "approved"}
                      <span class="status-badge ok">✅ Payment Approved & Sent</span>
                    {:else if p.status === "rejected"}
                      <span class="status-badge err">❌ Rejected</span>
                    {:else}
                      <span class="status-badge pending">⏳ Pending Admin Verification</span>
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .refer-wrap { max-width: 1080px; margin: 0 auto; padding: 36px 18px 80px; color: #f8fafc; }
  .refer-hero { text-align: center; max-width: 760px; margin: 0 auto 32px; }
  .badge-pill { display: inline-block; padding: 6px 14px; border-radius: 999px; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.4); color: #34d399; font-size: 12px; font-weight: 700; letter-spacing: 0.06em; margin-bottom: 12px; }
  h1 { font-size: clamp(28px, 4.5vw, 44px); line-height: 1.15; margin: 0 0 14px; font-weight: 800; }
  .grad-txt { background: linear-gradient(135deg, #34d399, #38bdf8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
  .sub { color: #94a3b8; font-size: 16px; line-height: 1.6; margin: 0; }
  .glass-card { background: rgba(15, 23, 42, 0.78); border: 1px solid rgba(148, 163, 184, 0.16); border-radius: 16px; padding: 24px; margin-bottom: 22px; }
  .login-cta { text-align: center; padding: 42px 24px; }
  .link-box { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px; background: linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(15, 23, 42, 0.9)); border-color: rgba(16, 185, 129, 0.35); }
  .lbl { font-size: 11px; font-weight: 700; letter-spacing: 0.08em; color: #94a3b8; margin-bottom: 6px; }
  .ref-url { font-family: monospace; font-size: 16px; font-weight: 700; color: #34d399; word-break: break-all; }
  .btn-row { display: flex; flex-wrap: wrap; gap: 10px; }
  .btn-primary { background: linear-gradient(135deg, #10b981, #059669); color: #fff; border: none; padding: 12px 20px; border-radius: 10px; font-weight: 700; cursor: pointer; font-size: 14px; }
  .btn-primary:disabled { opacity: 0.55; cursor: not-allowed; }
  .btn-primary.full { width: 100%; margin-top: 12px; }
  .btn-wa { background: rgba(37, 211, 102, 0.16); border: 1px solid rgba(37, 211, 102, 0.45); color: #4ade80; padding: 12px 18px; border-radius: 10px; font-weight: 700; text-decoration: none; font-size: 14px; }
  .btn-ghost { background: rgba(255,255,255,0.05); border: 1px solid rgba(148,163,184,0.2); color: #e2e8f0; padding: 9px 14px; border-radius: 8px; font-size: 13px; cursor: pointer; }
  .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 16px; margin-bottom: 22px; }
  .stat-card { background: rgba(15, 23, 42, 0.78); border: 1px solid rgba(148, 163, 184, 0.16); border-radius: 14px; padding: 20px; display: flex; flex-direction: column; gap: 6px; }
  .stat-card.highlight { border-color: rgba(16, 185, 129, 0.5); background: rgba(16, 185, 129, 0.08); }
  .s-lbl { font-size: 12px; color: #94a3b8; font-weight: 600; }
  .s-val { font-size: 30px; font-weight: 800; color: #f8fafc; }
  .s-note { font-size: 12px; color: #34d399; }
  .two-col { display: grid; grid-template-columns: repeat(auto-fit, minmax(310px, 1fr)); gap: 20px; }
  .muted { color: #94a3b8; font-size: 13px; margin-top: 4px; }
  .chart-box { display: flex; align-items: flex-end; justify-content: space-between; height: 190px; padding: 24px 12px 8px; gap: 12px; border-top: 1px solid rgba(148,163,184,0.12); margin-top: 16px; }
  .bar-col { flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; justify-content: flex-end; }
  .bar-amt { font-size: 11px; color: #cbd5e1; margin-bottom: 6px; font-weight: 700; }
  .bar-track { width: 100%; max-width: 42px; height: 120px; background: rgba(255,255,255,0.04); border-radius: 8px; display: flex; align-items: flex-end; overflow: hidden; }
  .bar-fill { width: 100%; background: linear-gradient(180deg, #34d399, #059669); border-radius: 8px 8px 0 0; transition: height 0.4s ease; }
  .bar-lbl { font-size: 12px; color: #94a3b8; margin-top: 8px; }
  .upi-form { margin-top: 14px; }
  .upi-form label { display: block; font-size: 12px; font-weight: 600; color: #cbd5e1; margin-bottom: 6px; }
  .upi-form input { width: 100%; padding: 12px 14px; border-radius: 10px; border: 1px solid rgba(148,163,184,0.28); background: rgba(2,6,23,0.7); color: #fff; font-size: 14px; box-sizing: border-box; }
  .creator-kit { margin-top: 20px; padding-top: 16px; border-top: 1px solid rgba(148,163,184,0.14); }
  .table-wrap { overflow-x: auto; margin-top: 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th, td { text-align: left; padding: 12px 10px; border-bottom: 1px solid rgba(148,163,184,0.12); }
  th { color: #94a3b8; font-size: 12px; text-transform: uppercase; }
  .mono { font-family: monospace; color: #38bdf8; }
  .status-badge { display: inline-block; padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; }
  .status-badge.ok { background: rgba(16,185,129,0.18); color: #34d399; }
  .status-badge.pending { background: rgba(245,158,11,0.18); color: #fbbf24; }
  .status-badge.err { background: rgba(239,68,68,0.18); color: #f87171; }
  .alert-err { background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.4); color: #fca5a5; padding: 12px 16px; border-radius: 10px; margin-bottom: 16px; }
  .alert-ok { background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.4); color: #6ee7b7; padding: 12px 16px; border-radius: 10px; margin-bottom: 16px; }
</style>
