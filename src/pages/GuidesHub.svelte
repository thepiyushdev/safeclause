<script>
  import { GUIDES, MODE_LABELS, MODE_ORDER } from "../lib/guides.mjs";
  import { link } from "../lib/app.js";

  let cat = "all";
  let q = "";

  $: needle = q.trim().toLowerCase();
  $: list = GUIDES.filter(function (g) {
    const okCat = cat === "all" || g.mode === cat;
    const okText = needle === "" || (g.title + " " + g.description).toLowerCase().indexOf(needle) !== -1;
    return okCat && okText;
  });
  $: groups = MODE_ORDER.map(function (m) {
    return { mode: m, items: list.filter(function (g) { return g.mode === m; }) };
  }).filter(function (g) { return g.items.length > 0; });

  function count(m) {
    return GUIDES.filter(function (g) { return g.mode === m; }).length;
  }
</script>

<div class="wrap page">
  <div class="center" style="max-width:720px;margin:0 auto 18px">
    <h1 class="h2">Contract guides for freelancers, creators and job seekers</h1>
    <p class="lead">Plain-English help with job bonds, notice period buyouts, brand deal usage rights, late payment, scope creep and agency contracts. Each guide shows the risky clause, why it hurts, a safer rewrite and a message you can send.</p>
  </div>

  <div class="chips" role="group" aria-label="Guide category">
    <button class:on={cat === "all"} on:click={() => (cat = "all")}>All ({GUIDES.length})</button>
    {#each MODE_ORDER as m}
      <button class:on={cat === m} on:click={() => (cat = m)}>{MODE_LABELS[m]} ({count(m)})</button>
    {/each}
  </div>

  <label for="gq" class="muted small">Search guides</label>
  <input id="gq" type="search" bind:value={q} placeholder="Try: bond, notice period, whitelisting, MSMED" autocomplete="off" />

  {#each groups as g (g.mode)}
    <h2 class="sub" style="margin-top:22px">{MODE_LABELS[g.mode]}</h2>
    <div class="guides-grid">
      {#each g.items as it (it.slug)}
        <a class="gcard" href={it.slug} on:click={(e) => link(e, it.slug)}>
          <span class="mbadge">{MODE_LABELS[it.mode]}</span>
          <b>{it.h1}</b>
          <span class="d">{it.description}</span>
        </a>
      {/each}
    </div>
  {/each}
  {#if groups.length === 0}<p class="muted" style="margin-top:18px">No guides match your search.</p>{/if}
</div>
