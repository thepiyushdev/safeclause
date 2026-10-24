<script>
  import { openPay, perContract } from "../lib/app.js";
  import { PACKS } from "../lib/data.mjs";

  const STEPS = [
    ["1", "Tap to pay", "Choose a pack and tap the UPI button. GPay, PhonePe or Paytm opens with the amount filled in."],
    ["2", "Capture the success screen", "Take a screenshot showing the amount, receiver and transaction ID."],
    ["3", "Upload and verify", "Upload it in the payment window. AI checks the details and adds your credits."],
  ];
</script>

<div class="wrap page">
  <div class="center">
    <h1 class="h2">Scan free. <span class="grad">Pay only to unlock.</span></h1>
    <p class="lead">No subscription. 1 credit = 1 full contract unlock.</p>
  </div>

  <div class="tier narrow" style="margin-left:auto;margin-right:auto">
    <div class="card">
      <b>Free scan</b>
      <div class="price num">₹0</div>
      <ul class="feat">
        <li>Overall risk score (0-100)</li>
        <li>Flags by category and severity</li>
        <li>Exact clause quotes with redline highlights</li>
        <li>Plain-English explanation of each risk</li>
      </ul>
    </div>
    <div class="card iri">
      <b>Full unlock</b>
      <div class="price num">from ₹49</div>
      <ul class="feat">
        <li>Everything in the free scan</li>
        <li>Suggested safer rewrite for every clause</li>
        <li>Counter-proposal emails, ready to send</li>
        <li>PDF report export</li>
      </ul>
    </div>
  </div>

  <div class="packs">
    {#each PACKS as p}
      <div class="pack" class:popular={p.popular}>
        {#if p.popular}<span class="ribbon">Most popular</span>{/if}
        <div style="font-size:1.7rem">{p.icon}</div>
        <b>{p.name}</b>
        <div class="price num">₹{p.price}</div>
        <p class="muted small">{p.credits} credit{p.credits === 1 ? "" : "s"} • ₹{perContract(p)} per contract</p>
        <ul class="feat">{#each p.features as f}<li>{f}</li>{/each}</ul>
        <button class="btn primary block" on:click={() => openPay(p.id)}>Tap to Pay with UPI ⚡</button>
      </div>
    {/each}
  </div>

  <h2 class="h2 center" style="margin-top:48px">How UPI payment works</h2>
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
