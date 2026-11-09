<script>
  import { copyToClipboard } from "../lib/app.js";
  import { VAULT, VAULT_CATS } from "../lib/data.mjs";
  let q = "";
  let cat = "All";
  let copied = "";

  function filter(list, query, c) {
    const needle = String(query || "").trim().toLowerCase();
    return list.filter(function (v) {
      const okCat = c === "All" || v.cat === c;
      const okQ = !needle || (v.title + " " + v.text + " " + v.cat).toLowerCase().indexOf(needle) !== -1;
      return okCat && okQ;
    });
  }
  $: items = filter(VAULT, q, cat);

  async function copy(v) {
    await copyToClipboard(v.text);
    copied = v.id;
    setTimeout(function () { if (copied === v.id) copied = ""; }, 1600);
  }
</script>

<div class="wrap narrow page">
  <h1 class="h2">Clause library</h1>
  <p class="muted">Contractor-friendly clauses. Copy, paste, and fill in the [brackets]. Have a lawyer review high-value deals.</p>

  <input type="search" placeholder="Search clauses (kill fee, deposit, liability...)" bind:value={q} />
  <div class="chips">
    {#each VAULT_CATS as c}<button class:on={cat === c} on:click={() => (cat = c)}>{c}</button>{/each}
  </div>

  {#each items as v (v.id)}
    <article class="card hover">
      <div class="row between" style="margin-bottom:8px">
        <b>{v.title}</b>
        <span class="badge low">{v.cat}</span>
      </div>
      <p class="ins" style="margin:0 0 10px">{v.text}</p>
      <button class="btn sm mfull" on:click={() => copy(v)}>{copied === v.id ? "Copied ✓" : "Copy Clause"}</button>
    </article>
  {/each}
  {#if items.length === 0}
    <section class="card"><p class="muted" style="margin:0">No clauses match your search. Try another word or category.</p></section>
  {/if}
</div>
