<script>
  import { link } from "./app.js";
  import DisclaimerBanner from "./DisclaimerBanner.svelte";
  const LINKS = [["/dashboard", "Scanner"], ["/scope-guard", "Scope Guard"], ["/chaser", "Payment Chaser"], ["/sample", "Sample report"], ["/pricing", "Pricing"], ["/refer", "Earn 30% 💸"], ["/radar", "Risk calculator"], ["/vault", "Clause library"], ["/privacy", "Privacy"], ["/terms", "Terms"]];
  const year = new Date().getFullYear();
</script>

<footer class="foot">
  <div class="wrap">
    <DisclaimerBanner />
    <div class="flinks">
      {#each LINKS as l}<a href={l[0]} on:click={(e) => link(e, l[0])}>{l[1]}</a>{/each}
    </div>
    <p class="muted small">Scans are not saved by default and your contracts are never used to train models. Contract Memory is opt-in and stores only the terms you approve. Contract text is processed by third-party AI providers under their API terms.</p>
    <p class="muted small">© {year} ClauseRadar. All rights reserved.</p>
  </div>
</footer>
