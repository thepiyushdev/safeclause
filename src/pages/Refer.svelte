<script>
  import { onMount } from "svelte";
  import { user, profile, referrals, payouts, refError, MIN_PAYOUT, openAuth, copyToClipboard, loadReferralData, requestPayout, referralLink, fmtDate } from "../lib/app.js";

  let method = "upi";
  let address = "";
  let busy = false;
  let msg = "";
  let msgOk = false;
  let copied = false;

  $: code = $profile.ref_code || ($user ? $user.id.slice(0, 8) : "");
  $: refLink = code ? referralLink(code) : "";
  $: wa = "https://wa.me/?text=" + encodeURIComponent("I use ClauseRadar to check freelance contracts for risky clauses. Try it free: " + refLink);
  $: li = "https://www.linkedin.com/sharing/share-offsite/?url=" + encodeURIComponent(refLink);
  $: counted = $referrals.filter(function (r) { return !r.reversed; });
  $: totalEarned = counted.reduce(function (s, r) { return s + Number(r.commission_amount || 0); }, 0);
  $: referredCount = new Set(counted.map(function (r) { return r.referred_user_id; })).size;
  $: balance = Number($profile.wallet_balance) || 0;
  $: paidOut = $payouts.filter(function (p) { return p.status === "approved"; }).reduce(function (s, p) { return s + Number(p.amount || 0); }, 0);
  $: chart = buildChart(counted);
  $: maxBar = Math.max(1, ...chart.map(function (c) { return c.amount; }));
  $: if ($user) loadReferralData();

  onMount(function () {
    const t = setInterval(function () { if ($user) loadReferralData(); }, 30000);
    return function () { clearInterval(t); };
  });

  function usd(n) {
    return "$" + (Number(n) || 0).toFixed(2);
  }

  function compact(n) {
    const v = Number(n) || 0;
    return v >= 1000 ? "$" + (v / 1000).toFixed(1).replace(/\.0$/, "") + "k" : "$" + (v % 1 ? v.toFixed(2) : String(v));
  }

  function buildChart(list) {
    const now = new Date();
    const out = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      out.push({ key: d.getFullYear() + "-" + d.getMonth(), label: d.toLocaleDateString("en-US", { month: "short" }), amount: 0 });
    }
    list.forEach(function (r) {
      const d = new Date(r.created_at);
      const slot = out.find(function (x) { return x.key === d.getFullYear() + "-" + d.getMonth(); });
      if (slot) slot.amount += Number(r.commission_amount || 0);
    });
    return out;
  }

  async function copyLink() {
    await copyToClipboard(refLink);
    copied = true;
    setTimeout(function () { copied = false; }, 1600);
  }

  function shortAddr(a) {
    const s = String(a || "");
    return s.length > 20 ? s.slice(0, 8) + "..." + s.slice(-6) : s;
  }

  async function withdraw() {
    msg = "";
    msgOk = false;
    if (balance < MIN_PAYOUT) { msg = "You need at least $" + MIN_PAYOUT + " in your balance to withdraw."; return; }
    busy = true;
    try {
      await requestPayout(method, address);
      msgOk = true;
      msg = "Payout requested ✅ It will show as approved after review.";
      address = "";
    } catch (e) {
      msg = e && e.message ? e.message : "Could not request the payout.";
    } finally {
      busy = false;
    }
  }
</script>

<div class="wrap narrow page">
  <div class="center">
    <span class="pill">Referral program</span>
    <h1 class="h2" style="margin-top:12px">Earn 30% 💸 on every sale</h1>
    <p class="lead">Refer friends to ClauseRadar Pro &amp; earn 30% recurring commission on every Pro subscription ($1.50 to $17.70 per sale), paid to your UPI (India) or USDT (TRC20) wallet!</p>
  </div>

  {#if !$user}
    <section class="card iri">
      <b>Get your referral link</b>
      <p class="muted small" style="margin:6px 0 12px">Log in to get your personal link and track your earnings.</p>
      <button class="btn primary lg block" on:click={() => openAuth("login", "Log in to get your referral link.")}>Log in to start earning</button>
    </section>
  {:else}
    <section class="card iri">
      <b>Your referral link</b>
      <div class="linkrow" style="margin:10px 0">
        <input readonly value={refLink} aria-label="Your referral link" on:focus={(e) => e.target.select()} />
        <button class="btn primary" on:click={copyLink}>{copied ? "Copied ✓" : "Copy Referral Link"}</button>
      </div>
      <div class="row" style="margin:0">
        <a class="btn mfull" href={wa} target="_blank" rel="noopener noreferrer">Share on WhatsApp</a>
        <a class="btn mfull" href={li} target="_blank" rel="noopener noreferrer">Share on LinkedIn</a>
      </div>
    </section>

    <div class="stats4">
      <div class="stat4"><span>Total Referrals</span><b class="num">{referredCount}</b></div>
      <div class="stat4"><span>Total Earned</span><b class="num">{usd(totalEarned)}</b></div>
      <div class="stat4"><span>Available Balance</span><b class="num">{usd(balance)}</b></div>
      <div class="stat4"><span>Paid Out</span><b class="num">{usd(paidOut)}</b></div>
    </div>

    {#if $refError}<div class="error" role="alert">⚠️ {$refError}</div>{/if}

    <section class="card">
      <b>Monthly earnings</b>
      <div class="bars" aria-label="Earnings for the last 6 months">
        {#each chart as c}
          <div class="barcol">
            <small class="num">{c.amount > 0 ? compact(c.amount) : ""}</small>
            <div class="bar" style="height:{Math.round((c.amount / maxBar) * 100)}%"></div>
            <small>{c.label}</small>
          </div>
        {/each}
      </div>
    </section>

    <section class="card">
      <b>Request payout</b>
      <p class="muted small" style="margin:6px 0 10px">Available: <b class="num">{usd(balance)}</b>. Minimum payout {"$" + MIN_PAYOUT}. We pay manually, so choose where to receive it.</p>
      <div class="seg" role="group" aria-label="Payout method">
        <button class:on={method === "upi"} on:click={() => { method = "upi"; address = ""; msg = ""; }}>UPI ID (India)</button>
        <button class:on={method === "usdt_trc20"} on:click={() => { method = "usdt_trc20"; address = ""; msg = ""; }}>USDT (TRC20, Global)</button>
      </div>
      {#if method === "upi"}
        <label for="rf-addr">Your UPI ID</label>
        <input id="rf-addr" bind:value={address} placeholder="name@bank" autocomplete="off" autocapitalize="off" />
        <p class="muted small" style="margin:0 0 8px">Paid in Indian rupees at the day's rate for the dollar amount.</p>
      {:else}
        <label for="rf-addr">Your USDT wallet address (TRON / TRC20)</label>
        <input id="rf-addr" bind:value={address} placeholder="T..." autocomplete="off" autocapitalize="off" spellcheck="false" />
        <p class="note" style="margin:0 0 8px">Send-to network must be <b>TRON (TRC20)</b>. Crypto transfers cannot be reversed, so double-check the address. We send only to the address you enter.</p>
      {/if}
      <button class="btn primary block" on:click={withdraw} disabled={busy || balance < MIN_PAYOUT}>{busy ? "Requesting..." : "Withdraw Balance"}</button>
      {#if msg}<div class={msgOk ? "ok" : "error"} role="alert">{msg}</div>{/if}
    </section>

    <section class="card">
      <b>Your payout requests</b>
      {#each $payouts as p (p.id)}
        <div class="payrow">
          <div style="min-width:0">
            <b class="num">{usd(p.amount)}</b>
            <span class={"mbadge " + (p.payout_method === "usdt_trc20" ? "mb-usdt" : "")}>{p.payout_method === "usdt_trc20" ? "USDT TRC20" : "UPI"}</span>
            <div class="muted small" style="overflow-wrap:anywhere">{p.payout_method === "usdt_trc20" ? shortAddr(p.payout_address) : (p.payout_address || p.upi_id)} • {fmtDate(p.created_at)}</div>
          </div>
          {#if p.status === "approved"}
            <span class="badge low"><i class="dot"></i>Payment Approved ✅</span>
          {:else if p.status === "rejected"}
            <span class="badge high"><i class="dot"></i>Rejected ❌ (refunded)</span>
          {:else}
            <span class="badge med"><i class="dot"></i>Pending ⏳</span>
          {/if}
        </div>
      {/each}
      {#if $payouts.length === 0}<p class="muted small" style="margin:8px 0 0">No payout requests yet.</p>{/if}
    </section>
  {/if}

  <section class="card">
    <b>How it works</b>
    <ol class="steps" style="margin:8px 0 0">
      <li>Share your link. When a friend signs up through it and subscribes to Pro, they are linked to you.</li>
      <li>You earn 30% of every subscription payment they make, including renewals: $1.50 to $17.70 per sale depending on their plan.</li>
      <li>Request a payout once you reach {"$" + MIN_PAYOUT}. Choose UPI in India or USDT on the TRON (TRC20) network. We review and send it manually.</li>
    </ol>
    <p class="muted small" style="margin:10px 0 0">Commissions are paid only on payments confirmed by Whop. Self-referrals, fake accounts and refunded payments are not eligible, and a refund reverses its commission. Payouts are reviewed manually.</p>
  </section>
</div>
