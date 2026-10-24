<script>
  import { go } from "../lib/app.js";
  const TERMS = [14, 30, 45, 60, 90, 120];
  let jur = "india";
  let value = 50000;
  let terms = 90;
  let liab = "uncapped";
  let ip = "creation";
  let rev = "unlimited";
  let rate = 12;

  function compute(v0, t0, l0, i0, r0, rate0) {
    const v = Math.max(0, Number(v0) || 0);
    const days = Number(t0) || 0;
    const delay = v * (Math.max(0, Number(rate0) || 0) / 100) * (days / 365);
    const revLeak = r0 === "unlimited" ? v * 0.15 : 0;
    const ipRisk = i0 === "creation" ? v : 0;
    const uncapped = l0 === "uncapped";
    let s = 0;
    s += days >= 90 ? 3 : days >= 60 ? 2 : days >= 30 ? 1 : 0;
    s += uncapped ? 3 : 0;
    s += i0 === "creation" ? 2 : 0;
    s += r0 === "unlimited" ? 2 : 0;
    const level = s >= 6 ? "HIGH" : s >= 3 ? "MEDIUM" : "LOW";
    return { v: v, days: days, delay: delay, revLeak: revLeak, ipRisk: ipRisk, uncapped: uncapped, level: level };
  }
  function money(n, j) {
    return (j === "india" ? "₹" : "$") + Math.round(Number(n) || 0).toLocaleString(j === "india" ? "en-IN" : "en-US");
  }
  const POS = { HIGH: 84, MEDIUM: 50, LOW: 16 };
  $: res = compute(value, terms, liab, ip, rev, rate);
  $: cls = res.level === "HIGH" ? "high" : res.level === "LOW" ? "low" : "med";
</script>

<div class="wrap narrow page">
  <h1 class="h2">Contract risk calculator</h1>
  <p class="muted">Estimate what risky terms could cost you before you sign.</p>

  <section class="card">
    <div class="seg" style="max-width:260px">
      <button class:on={jur === "india"} on:click={() => (jur = "india")}>₹ INR</button>
      <button class:on={jur === "global"} on:click={() => (jur = "global")}>$ USD</button>
    </div>
    <div class="grid2">
      <label>Project fee ({jur === "india" ? "₹" : "$"})<input type="number" min="0" inputmode="numeric" bind:value={value} /></label>
      <label>Payment terms
        <select bind:value={terms}>{#each TERMS as t}<option value={t}>Net-{t}</option>{/each}</select>
      </label>
      <label>Liability
        <select bind:value={liab}><option value="capped">Capped at fees paid</option><option value="uncapped">Uncapped</option></select>
      </label>
      <label>IP transfer
        <select bind:value={ip}><option value="payment">After full payment</option><option value="creation">On creation</option></select>
      </label>
      <label>Revisions
        <select bind:value={rev}><option value="limited">Limited rounds</option><option value="unlimited">Unlimited</option></select>
      </label>
      <label>Your cost of money (% per year)<input type="number" min="0" max="60" inputmode="numeric" bind:value={rate} /></label>
    </div>
  </section>

  <section class="card iri">
    <div class="row between">
      <b>Your estimated exposure</b>
      <span class="badge {cls}"><i class="dot"></i>{res.level} RISK</span>
    </div>
    <div class="meter"><div class="pin" style="left:{POS[res.level]}%"></div></div>
    <div class="mlabels"><span>LOW</span><span>MEDIUM</span><span>HIGH</span></div>
    <ul class="lines">
      <li><span>Cashflow frozen for</span><b class="num">{res.days} days</b></li>
      <li><span>Cost of delayed capital</span><b class="num">{money(res.delay, jur)}</b></li>
      {#if res.revLeak > 0}<li><span>Estimated unpaid revision leak</span><b class="num">{money(res.revLeak, jur)}</b></li>{/if}
      {#if res.ipRisk > 0}<li><span>Fee at risk if the client keeps the work unpaid</span><b class="num">{money(res.ipRisk, jur)}</b></li>{/if}
      <li><span>Liability ceiling</span><b class="num">{res.uncapped ? "None (uncapped)" : money(res.v, jur)}</b></li>
    </ul>
    <p class="muted small">Illustrative model, not a prediction: delayed-capital cost = fee × your yearly cost of money × days ÷ 365, and unlimited revisions are assumed to add unpaid work worth about 15% of the fee.</p>
    <button class="btn primary block" on:click={() => go("/dashboard")}>Now audit your real contract ⚡</button>
  </section>
</div>
