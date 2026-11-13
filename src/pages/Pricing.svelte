<script>
  import { isPro, profile, fmtDate } from "../lib/app.js";
  import { FREE_FEATURES, PRO_FEATURES } from "../lib/data.mjs";
  import PlanPicker from "../lib/PlanPicker.svelte";

  const STEPS = [
    ["1", "Choose your plan", "Pick Monthly or Yearly. The price adjusts to your region automatically."],
    ["2", "Pay securely on Whop", "Whop handles the payment. Use the same email as your ClauseRadar account."],
    ["3", "Pro activates automatically", "Our server confirms the payment with Whop and unlocks Pro, usually within a minute."],
  ];
  let billing = "pro_year";
</script>

<div class="wrap page">
  <div class="center">
    <h1 class="h2">Scan free. <span class="grad">Go Pro when contracts get real.</span></h1>
    <p class="lead">One simple Pro plan unlocks every rewrite, Scope Guard, Payment Chaser and PDF reports.</p>
    {#if $isPro}<p class="ok" style="display:inline-block">You are Pro until {fmtDate($profile.pro_until)}. Your subscription renews automatically through Whop.</p>{/if}
  </div>

  <div class="tier">
    <div class="card">
      <b>Free Plan</b>
      <div class="price num">$0</div>
      <ul class="feat">{#each FREE_FEATURES as f}<li>{f}</li>{/each}</ul>
      <p class="muted small" style="margin:0">Free works on 1 device at a time.</p>
    </div>

    <div class="card iri">
      <div class="row between" style="margin-bottom:6px"><b>Pro Subscription</b></div>
      <PlanPicker bind:planId={billing} />
      <ul class="feat" style="margin-top:14px">{#each PRO_FEATURES as f}<li>{f}</li>{/each}</ul>
    </div>
  </div>

  <h2 class="h2 center" style="margin-top:44px">How checkout works</h2>
  <div class="grid3">
    {#each STEPS as s}
      <div class="card" style="margin-top:0">
        <div class="stepno">{s[0]}</div>
        <b>{s[1]}</b>
        <p class="muted small" style="margin:6px 0 0">{s[2]}</p>
      </div>
    {/each}
  </div>
  <p class="muted small center" style="margin-top:18px">Payments are processed by Whop. We never see your card details. Pro is activated only after Whop confirms the payment to our server.</p>
</div>
