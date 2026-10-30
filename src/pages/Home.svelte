<script>
  import { link, scanMode } from "../lib/app.js";
  import { BENTO, FAQS } from "../lib/data.mjs";
  import DemoViewer from "../lib/DemoViewer.svelte";
  const ICONS = ["🛡️", "⏳", "🔐", "✉️"];
  const MODES = [
    { key: "freelance", icon: "💻", title: "Freelancers & Devs", text: "Client contracts: scope creep, Net-60/90 payment traps, uncapped liability and IP grabs." },
    { key: "creator", icon: "🎬", title: "BrandDeal Shield for Creators", text: "Sponsorship deals: perpetual ad usage and whitelisting, exclusivity, reshoots, payment terms and kill fees." },
    { key: "employment", icon: "🎓", title: "Offer Letter & Bond Shield", text: "Job offers: employment bonds, 90-day notice buyouts, side-project IP claims and non-competes." },
    { key: "agency", icon: "🏢", title: "Agency White-Label Shield", text: "Sub-contracts: pay-when-paid traps, non-solicitation, SLA penalties and uncapped indemnification." },
  ];
  function pickMode(e, key) {
    scanMode.set(key);
    link(e, "/dashboard");
  }
</script>

<section class="hero-bg">
  <div class="wrap hero">
    <a class="pill" href="/sample" on:click={(e) => link(e, "/sample")}>✨ ClauseRadar – contract protection for freelancers, creators, job seekers &amp; agencies <span aria-hidden="true">→</span></a>
    <h1 class="display">Audit any contract in 30 seconds. <span class="grad">Stop risky clauses before you sign.</span></h1>
    <p class="lead">ClauseRadar reads your freelance contract, creator brand deal, job offer letter or agency agreement, flags the traps (Net-90 payments, perpetual ad rights, employment bonds, pay-when-paid clauses), explains each risk in plain English and writes the counter-email for you.</p>
    <div class="cta">
      <a class="btn primary lg" href="/dashboard" on:click={(e) => link(e, "/dashboard")}>Upload Contract</a>
      <a class="btn lg" href="/sample" on:click={(e) => link(e, "/sample")}>View Sample Audit Report</a>
    </div>
    <p class="small muted">Free scan • Go Pro to unlock rewrites • PDF, DOCX or pasted text</p>
  </div>
</section>

<section class="wrap sec" style="padding-top:4px;padding-bottom:8px">
  <div class="center" style="margin-bottom:18px">
    <h2 class="h2">One scanner for every contract you sign</h2>
    <p class="muted">Pick your mode. ClauseRadar checks the traps that matter for your situation.</p>
  </div>
  <div class="grid3">
    {#each MODES as m}
      <a class="card hover" href="/dashboard" on:click={(e) => pickMode(e, m.key)} style="margin-top:0;text-decoration:none">
        <div style="font-size:1.6rem">{m.icon}</div>
        <b style="display:block;margin:6px 0 4px;font-size:1.0625rem">{m.title}</b>
        <p class="muted small" style="margin:0">{m.text}</p>
      </a>
    {/each}
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
      <p>We never use your agreements to train models, and scans are not stored by default. If you opt in to Contract Memory, we save only the terms and short clause excerpts you review. Contract text is processed by third-party AI providers under their API terms.</p>
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
