<script>
  import { createEventDispatcher } from "svelte";
  import { region, user, startCheckout, verifyCheckout, openAuth } from "./app.js";
  import { PLANS } from "./data.mjs";

  export let planId = "pro_year";
  const dispatch = createEventDispatcher();

  $: plan = PLANS.find(function (p) { return p.id === planId; }) || PLANS[1];
  $: asia = $region === "asia";
  $: price = asia ? plan.asiaPrice : plan.price;
  $: save = plan.per === "year" ? (asia ? 42 : 45) : 0;

  function choose(id) {
    planId = id;
    dispatch("change", id);
  }

  function go() {
    if (!$user) { openAuth("login", "Log in first so Pro is added to your account."); return; }
    startCheckout(plan.id);
  }
</script>

<div class="seg" role="group" aria-label="Billing period">
  <button class:on={planId === "pro_month"} on:click={() => choose("pro_month")}>Monthly</button>
  <button class:on={planId === "pro_year"} on:click={() => choose("pro_year")}>Yearly{#if !asia} (save 45%){:else} (save 42%){/if}</button>
</div>

<div class="price num">{"$" + price}<span class="muted small"> / {plan.per}</span></div>
<p class="muted small" style="margin:0 0 4px">
  {#if plan.per === "year"}{"$" + (price / 12).toFixed(2)} per month, save {save}% versus monthly.{:else}Billed monthly.{/if}
  {asia ? " Asia special pricing for your region." : " Global pricing."}
</p>

<button class="btn primary lg block" on:click={go}>Continue to secure checkout ⚡</button>
<p class="note">ℹ️ Auto-Pay Active: This is a recurring subscription billed automatically (monthly or yearly). You have 100% control and can cancel auto-pay anytime in 1 click from your Whop receipt or dashboard—no questions asked.</p>
{#if $user}
  <p class="muted small" style="margin:8px 0 0">Use the same email as your ClauseRadar account (<b>{$user.email}</b>) at checkout so Pro activates automatically.</p>
  <button class="linkbtn" on:click={() => verifyCheckout(true)}>Already paid? Check my status</button>
{/if}
