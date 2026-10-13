<script>
  import { openPay, isPro, profile, fmtDate } from "../lib/app.js";
  import { PLANS, FREE_FEATURES, PRO_FEATURES } from "../lib/data.mjs";

  const STEPS = [
    ["1", "Tap to pay", "Choose Monthly or Yearly and tap the UPI button. GPay, PhonePe or Paytm opens with the amount filled in."],
    ["2", "Capture the success screen", "Take a screenshot showing the amount, receiver and transaction ID."],
    ["3", "Upload and verify", "Upload it in the payment window. AI checks the details and adds Pro time to your account."],
  ];
  let billing = "pro_year";
  $: plan = PLANS.find(function (p) { return p.id === billing; }) || PLANS[1];
</script>

<div class="wrap page">
  <div class="center">
    <h1 class="h2">Scan free. <span class="grad">Go Pro when contracts get real.</span></h1>
    <p class="lead">One simple Pro plan unlocks every rewrite, Scope Guard, Payment Chaser and PDF reports.</p>
    {#if $isPro}<p class="ok" style="display:inline-block">You are Pro until {fmtDate($profile.pro_until)}. Paying again adds more time.</p>{/if}
  </div>

  <div class="tier">
    <div class="card">
      <b>Free Plan</b>
      <div class="price num">₹0</div>
      <ul class="feat">{#each FREE_FEATURES as f}<li>{f}</li>{/each}</ul>
      <p class="muted small" style="margin:0">Free works on 1 device at a time.</p>
    </div>

    <div class="card iri">
      <div class="row between" style="margin-bottom:6px"><b>Pro Subscription</b><span class="badge low"><i class="dot"></i>Save 33% yearly</span></div>
      <div class="seg" role="group" aria-label="Billing period">
        <button class:on={billing === "pro_month"} on:click={() => (billing = "pro_month")}>Monthly</button>
        <button class:on={billing === "pro_year"} on:click={() => (billing = "pro_year")}>Yearly</button>
      </div>
      <div class="price num">₹{plan.price.toLocaleString("en-IN")}<span class="muted small"> / {plan.per}</span></div>
      <p class="muted small" style="margin:0 0 4px">{plan.per === "year" ? "About ₹" + Math.round(plan.price / 12) + " per month. Save 33% versus monthly." : "₹499 per month."} Each payment adds {plan.days} days of Pro.</p>
      <ul class="feat">{#each PRO_FEATURES as f}<li>{f}</li>{/each}</ul>
      <button class="btn primary lg block" on:click={() => openPay(plan.id)}>{$isPro ? "Extend Pro" : "Upgrade with UPI"} ⚡</button>
    </div>
  </div>
  <p class="muted small center" style="margin-top:14px">Pay by UPI. Each verified payment adds time to your Pro plan. Automatic renewal is not enabled yet, so you renew by paying again before your Pro time ends.</p>

  <h2 class="h2 center" style="margin-top:44px">How UPI payment works</h2>
  <div class="grid3">
    {#each STEPS as s}
      <div class="card" style="margin-top:0">
        <div class="stepno">{s[0]}</div>
        <b>{s[1]}</b>
        <p class="muted small" style="margin:6px 0 0">{s[2]}</p>
      </div>
    {/each}
  </div>
  <p class="muted small center" style="margin-top:18px">Payments are verified automatically. Reused screenshots or transaction IDs are rejected.</p>
</div>
