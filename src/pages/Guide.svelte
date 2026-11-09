<script>
  import { GUIDES, MODE_LABELS } from "../lib/guides.mjs";
  import { scanMode, scanJur, link } from "../lib/app.js";
  import RewriteBox from "../lib/RewriteBox.svelte";

  export let path = "";

  $: guide = GUIDES.find(function (g) { return g.slug === path; }) || null;
  $: related = guide ? pickRelated(guide) : [];

  function pickRelated(g) {
    const same = GUIDES.filter(function (x) { return x.mode === g.mode; });
    const i = same.findIndex(function (x) { return x.slug === g.slug; });
    const out = [];
    for (let k = 1; k <= 5 && k < same.length; k++) out.push(same[(i + k) % same.length]);
    return out;
  }

  function scan(e) {
    scanMode.set(guide.mode);
    scanJur.set(guide.jur);
    link(e, "/dashboard");
  }
</script>

<div class="wrap narrow page">
  {#if !guide}
    <h1 class="h2">Guide not found</h1>
    <p class="lead">That guide does not exist. Browse all of them instead.</p>
    <a class="btn primary" href="/guides" on:click={(e) => link(e, "/guides")}>See all guides</a>
  {:else}
    <p class="crumbs">
      <a href="/guides" on:click={(e) => link(e, "/guides")}>Guides</a> › {MODE_LABELS[guide.mode]}
    </p>
    <h1 class="h2">{guide.h1}</h1>
    <p class="lead" style="margin-top:8px">{guide.description}</p>

    <section class="gsec">
      <h2>The risky clause</h2>
      <blockquote class="trap">{guide.trap}</blockquote>
    </section>

    <section class="gsec">
      <h2>Why it is dangerous</h2>
      <p style="margin:0;overflow-wrap:break-word">{guide.why}</p>
    </section>

    <section class="gsec">
      <h2>Safer clause and message to send</h2>
      <RewriteBox clause={guide.fix} email={guide.email} />
    </section>

    <section class="gsec">
      <h2>Frequently asked questions</h2>
      {#each guide.faqs as f}
        <details class="faq">
          <summary>{f.q}</summary>
          <p>{f.a}</p>
        </details>
      {/each}
    </section>

    {#if related.length}
      <section class="gsec">
        <h2>Related guides</h2>
        <ul class="gl">
          {#each related as r (r.slug)}
            <li><a class="gcard" href={r.slug} on:click={(e) => link(e, r.slug)}><b>{r.h1}</b><span class="d">{r.description}</span></a></li>
          {/each}
        </ul>
      </section>
    {/if}

    <p class="muted small" style="margin-top:24px">General information for contractors, creators and employees, not legal advice. For high-value or disputed contracts, ask a qualified lawyer.</p>

    <div class="stickycta">
      <b>Have a contract or offer letter like this? Scan your full document free in 30s →</b>
      <a class="btn primary" href="/dashboard" on:click={scan}>Scan my contract</a>
    </div>
  {/if}
</div>
