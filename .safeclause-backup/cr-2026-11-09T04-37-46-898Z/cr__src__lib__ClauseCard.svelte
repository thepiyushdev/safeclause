<script>
  import RiskBadge from "./RiskBadge.svelte";
  import RewriteBox from "./RewriteBox.svelte";
  import { catLabel, segments, fmt } from "./app.js";

  export let clause;
  export let unlocked = null;
  export let startOpen = false;
  export let unlockLabel = "Unlock";
  export let unlocking = false;
  export let unlockError = "";
  export let onUnlock = function () {};

  let open = startOpen;
  let wasUnlocked = !!unlocked;
  $: if (unlocked && !wasUnlocked) { open = true; wasUnlocked = true; }
  $: segs = segments(clause.problematic_fine_print);
  $: cls = clause.risk_level === "HIGH" ? "high" : clause.risk_level === "LOW" ? "low" : "med";
</script>

<article class="clause {cls}">
  <div class="clause-h">
    <span class="catlabel">{catLabel(clause.category)}</span>
    <RiskBadge level={clause.risk_level} />
  </div>

  <div class="lbl">Clause found</div>
  <blockquote class="redline">{#each segs as s}{#if s.hit}<mark>{s.t}</mark>{:else}{s.t}{/if}{/each}</blockquote>

  <div class="lbl">Why this is dangerous</div>
  <p class="why pre">{fmt(clause.why_it_hurts)}</p>

  <button class="acc-btn" aria-expanded={open} on:click={() => (open = !open)}>
    <span>Suggested safer rewrite &amp; counter-proposal</span>
    <span class="chev" class:rot={open}>▾</span>
  </button>
  <div class="acc" class:open>
    <div class="acc-in">
      {#if unlocked}
        <RewriteBox clause={unlocked.safe_counter_clause} email={unlocked.polite_client_negotiation_email} />
      {:else}
        <div class="locked">
          <div class="blurred" aria-hidden="true">
            <p class="ins">The Contractor shall invoice the Client upon delivery and the Client shall pay each invoice within fourteen (14) days. Liability is limited to the fees paid under this Agreement.</p>
            <div class="mail">Subject: Request to update payment and liability terms{"\n\n"}Hi [Client Name], thank you for sending the agreement. Before signing, I would like to propose a few changes so both sides are protected...</div>
          </div>
          <div class="lock-over">
            <div class="lock-card">
              <div class="lock-t">🔒 Safer rewrite &amp; counter-proposal email locked</div>
              <button class="btn primary block" on:click={onUnlock} disabled={unlocking}>
                {unlocking ? "Unlocking all clauses..." : unlockLabel}
              </button>
              {#if unlockError}<div class="error" role="alert">⚠️ {unlockError}</div>{/if}
            </div>
          </div>
        </div>
      {/if}
    </div>
  </div>
</article>
