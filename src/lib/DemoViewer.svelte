<script>
  import RiskBadge from "./RiskBadge.svelte";

  const ORDER = ["liab", "pay"];
  const FIND = {
    liab: {
      level: "HIGH",
      title: "Uncapped liability",
      why: "You could owe far more than the project paid. One dispute could wipe out a year of income.",
      fix: "The Contractor total liability shall not exceed the fees actually paid under this Agreement.",
    },
    pay: {
      level: "MEDIUM",
      title: "Net-90 delayed payout",
      why: "You would finance the client for three months, which puts your own rent and tools at risk.",
      fix: "Invoices are payable within fourteen (14) days. Unpaid amounts accrue a late fee of 1.5% per month.",
    },
  };
  let active = "liab";
  function key(e, k) {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); active = k; }
  }
</script>

<div class="demo iri">
  <div class="doc" aria-label="Sample contract text">
    <p><b>INDEPENDENT CONTRACTOR AGREEMENT</b></p>
    <p>7. Payment. Client shall pay Contractor within <button class="hl amber" class:on={active === "pay"} on:mouseenter={() => (active = "pay")} on:click={() => (active = "pay")}>ninety (90) days</button> of invoice approval.</p>
    <p>9. Liability. Contractor shall be liable for all losses of Client <button class="hl rose" class:on={active === "liab"} on:mouseenter={() => (active = "liab")} on:click={() => (active = "liab")}>without any limit or cap</button>, including indirect and consequential damages.</p>
    <p>11. Termination. Either party may terminate this Agreement on thirty (30) days written notice.</p>
  </div>
  <div class="side">
    {#each ORDER as k}
      <div class="find" class:on={active === k} role="button" tabindex="0" on:click={() => (active = k)} on:keydown={(e) => key(e, k)}>
        <div class="row between" style="margin:0"><b>{FIND[k].title}</b><RiskBadge level={FIND[k].level} /></div>
        {#if active === k}
          <p class="muted small" style="margin:8px 0 4px">{FIND[k].why}</p>
          <div class="lbl" style="margin:8px 0 4px">Suggested safer rewrite</div>
          <p class="ins" style="margin:0">{FIND[k].fix}</p>
        {/if}
      </div>
    {/each}
    <div class="small muted">Click a highlight or a finding. Sample text only.</div>
  </div>
</div>
