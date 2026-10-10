<script>
  import { link } from "../lib/app.js";
  import { BENTO, FAQS } from "../lib/data.mjs";
  import DemoViewer from "../lib/DemoViewer.svelte";
  const ICONS = ["🛡️", "⏳", "🔐", "✉️"];
</script>

<section class="hero-bg">
  <div class="wrap hero">
    <a class="pill" href="/sample" on:click={(e) => link(e, "/sample")}>✨ Introducing ClauseRadar – Protect your freelance income &amp; liability <span aria-hidden="true">→</span></a>
    <h1 class="display">Audit client contracts in 30 seconds. <span class="grad">Stop uncapped liability before you sign.</span></h1>
    <p class="lead">ClauseRadar reads your client agreement, flags uncapped liability, Net-60 and Net-90 payment traps and IP grabs, explains each risk in plain English, and writes the counter-proposal email for you.</p>
    <div class="cta">
      <a class="btn primary lg" href="/dashboard" on:click={(e) => link(e, "/dashboard")}>Upload Contract</a>
      <a class="btn lg" href="/sample" on:click={(e) => link(e, "/sample")}>View Sample Audit Report</a>
    </div>
    <p class="small muted">Free scan • Pay only to unlock rewrites • PDF, DOCX or pasted text</p>
  </div>
</section>

<section class="wrap narrow" style="padding-bottom:24px">
  <DemoViewer />
</section>

<section class="wrap sec">
  <div class="center" style="margin-bottom:22px">
    <h2 class="h2">The clauses that quietly cost freelancers money</h2>
    <p class="muted">ClauseRadar finds them, explains them, and hands you the fix.</p>
  </div>
  <div class="bento">
    {#each BENTO as b, i}
      <div class="tile">
        <div class="ic">{ICONS[i]}</div>
        <h3>{b.title}</h3>
        <p>{b.text}</p>
      </div>
    {/each}
  </div>
</section>

<section class="wrap" style="padding-bottom:24px">
  <div class="trust">
    <div style="font-size:1.8rem" aria-hidden="true">🔒</div>
    <div>
      <b>Zero contract training.</b>
      <p>We do not store or use your agreements to train models. Scans are ephemeral. Contract text is processed by third-party AI providers under their API terms.</p>
    </div>
  </div>
</section>

<section class="wrap narrow sec">
  <h2 class="h2 center">Frequently asked questions</h2>
  {#each FAQS as f}
    <details class="faq"><summary>{f.q}</summary><p>{f.a}</p></details>
  {/each}
</section>

<section class="wrap" style="padding-bottom:40px">
  <div class="band">
    <h2 class="h2">Ready to protect your next freelance invoice?</h2>
    <p class="muted" style="max-width:520px;margin:0 auto 18px">Paste the contract, see the risks, and walk into the negotiation with the right clauses ready.</p>
    <a class="btn primary lg" href="/dashboard" on:click={(e) => link(e, "/dashboard")}>Upload Contract</a>
  </div>
</section>
