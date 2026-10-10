<script>
  import { SAMPLE_REPORT } from "../lib/data.mjs";
  import { link } from "../lib/app.js";
  import { openReport } from "../lib/report.js";
  import ClauseCard from "../lib/ClauseCard.svelte";
  import RiskBadge from "../lib/RiskBadge.svelte";
  import RiskGauge from "../lib/RiskGauge.svelte";

  const R = SAMPLE_REPORT;
  const unlocked = {};
  R.clauses.forEach(function (c, i) {
    unlocked[i] = { safe_counter_clause: c.safe_counter_clause, polite_client_negotiation_email: c.polite_client_negotiation_email };
  });
  const COUNTS = { HIGH: 0, MEDIUM: 0, LOW: 0 };
  R.clauses.forEach(function (c) { COUNTS[c.risk_level] += 1; });

  let filter = "ALL";
  let note = "";
  $: shown = R.clauses.map(function (c, i) { return { c: c, i: i }; }).filter(function (x) { return filter === "ALL" || x.c.risk_level === filter; });

  function exportPdf() {
    const ok = openReport({
      result: { overall_risk_score: R.level, executive_summary: R.summary, flagged_clauses: R.clauses },
      unlockedData: unlocked, jur: "global", score: R.score,
    });
    note = ok ? "" : "Allow pop-ups for this site to export the PDF.";
  }
</script>

<div class="wrap narrow page">
  <span class="pill">Interactive sample • fictional data</span>
  <h1 class="h2" style="margin-top:12px;font-size:clamp(1.6rem,5vw,2.3rem)">Sample audit report</h1>
  <p class="muted">{R.title}. Open the cards, filter by severity, and copy the rewrites. No upload needed.</p>

  <section class="card iri">
    <div class="report-head">
      <RiskGauge score={R.score} level={R.level} />
      <div>
        <div class="row" style="margin-bottom:6px"><RiskBadge level={R.level} /><span class="muted small num">{R.clauses.length} flagged clauses</span></div>
        <p style="margin:0 0 10px">{R.summary}</p>
        <button class="btn sm" on:click={exportPdf}>📄 Export PDF report</button>
        {#if note}<div class="error">{note}</div>{/if}
      </div>
    </div>
  </section>

  <div class="chips" style="margin-top:16px">
    <button class:on={filter === "ALL"} on:click={() => (filter = "ALL")}>All <span class="num">({R.clauses.length})</span></button>
    <button class:on={filter === "HIGH"} on:click={() => (filter = "HIGH")}>High <span class="num">({COUNTS.HIGH})</span></button>
    <button class:on={filter === "MEDIUM"} on:click={() => (filter = "MEDIUM")}>Medium <span class="num">({COUNTS.MEDIUM})</span></button>
    <button class:on={filter === "LOW"} on:click={() => (filter = "LOW")}>Low <span class="num">({COUNTS.LOW})</span></button>
  </div>

  {#each shown as x (x.i)}
    <ClauseCard clause={x.c} unlocked={unlocked[x.i]} startOpen={x.i === 0} />
  {/each}

  <div class="band" style="margin-top:28px">
    <h2 class="h2">Run this on your own contract</h2>
    <p class="muted" style="margin:0 0 16px">Scanning is free. Unlock the rewrites when you need them.</p>
    <a class="btn primary lg" href="/dashboard" on:click={(e) => link(e, "/dashboard")}>Upload Contract</a>
  </div>
</div>
