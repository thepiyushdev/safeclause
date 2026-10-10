<script>
  import { LEGAL } from "../lib/legal.mjs";
  import DisclaimerBanner from "../lib/DisclaimerBanner.svelte";
  export let kind = "privacy";
  $: doc = LEGAL[kind] || LEGAL.privacy;
</script>

<div class="wrap narrow page prose">
  <h1 class="h2">{doc.title}</h1>
  <p class="muted small">Last updated {doc.updated}</p>
  <DisclaimerBanner />
  {#each doc.sections as s}
    <h2>{s.h}</h2>
    {#each s.p as para}<p>{para}</p>{/each}
  {/each}
</div>
