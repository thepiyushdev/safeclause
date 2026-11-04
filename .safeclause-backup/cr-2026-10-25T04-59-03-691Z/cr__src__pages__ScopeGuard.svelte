<script>
  import { user, isPro, authHeaders, readJson, openAuth, openPay, link, copyToClipboard, fmt, projects, loadProjects, updateProject, scopeUsage } from "../lib/app.js";
  import DisclaimerBanner from "../lib/DisclaimerBanner.svelte";

  const V = {
    IN_SCOPE: { label: "In Scope (Free)", cls: "low" },
    OUT_OF_SCOPE: { label: "Out of Scope (Billable)", cls: "high" },
    GREY_AREA: { label: "Grey Area", cls: "med" },
  };
  const FREE_LIMIT = 3;

  let projectId = "";
  let message = "";
  let loading = false;
  let error = "";
  let upgrade = false;
  let result = null;
  let used = null;
  let copied = "";
  let counted = false;

  $: if ($user) { loadProjects(); refreshUsage(); }
  $: if (!projectId && $projects.length) projectId = $projects[0].id;
  $: project = $projects.find(function (p) { return p.id === projectId; }) || null;
  $: revUsed = project ? project.revisions_used || 0 : 0;
  $: revCap = project && project.revision_cap != null ? project.revision_cap : null;
  $: revPct = revCap ? Math.min(100, Math.round((revUsed / revCap) * 100)) : 0;
  $: revWarn = revCap == null ? "" : revUsed >= revCap ? "Revision cap reached. Further revisions are billable." : revUsed === revCap - 1 ? "Last included revision remaining." : "";

  async function refreshUsage() {
    used = await scopeUsage();
  }

  async function check() {
    error = "";
    upgrade = false;
    result = null;
    counted = false;
    if (!project) { error = "Select a project first."; return; }
    if (message.trim().length < 10) { error = "Paste the client's message first."; return; }
    loading = true;
    try {
      const r = await fetch("/api/scope-check", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ project_id: project.id, message: message.trim() }),
      });
      const d = await readJson(r);
      if (d.usage && typeof d.usage.used === "number") used = d.usage.used;
      if (!r.ok || !d.success) {
        upgrade = d.code === "UPGRADE";
        throw new Error(d.error || "Scope check failed.");
      }
      result = d.result;
    } catch (e) {
      error = e && e.message ? e.message : "Scope check failed.";
    } finally {
      loading = false;
    }
  }

  async function countRevision() {
    if (!project || counted) return;
    try {
      await updateProject(project.id, { revisions_used: revUsed + 1 });
      counted = true;
    } catch (e) {
      error = e && e.message ? e.message : "Could not update the revision count.";
    }
  }

  async function copy(id, text) {
    await copyToClipboard(text);
    copied = id;
    setTimeout(function () { if (copied === id) copied = ""; }, 1600);
  }
</script>

<div class="wrap narrow page">
  <h1 class="h2">Scope Guard</h1>
  <p class="lead" style="margin:0 0 14px;text-align:left">Paste the client's "quick tweak" message. Find out in 10 seconds if it is free, paid, or scope creep.</p>

  {#if !$user}
    <section class="card">
      <p style="margin:0 0 12px">Log in to use Scope Guard with your saved projects.</p>
      <button class="btn primary block" on:click={() => openAuth("login", "Log in to use Scope Guard.")}>Log in</button>
    </section>
  {:else if $projects.length === 0}
    <section class="card">
      <b>No active project yet</b>
      <p class="muted small" style="margin:6px 0 12px">Scan a contract and choose Save to Contract Memory. Scope Guard compares client messages with the scope and revision cap you saved.</p>
      <a class="btn primary block" href="/dashboard" on:click={(e) => link(e, "/dashboard")}>Scan a contract</a>
    </section>
  {:else}
    <section class="card">
      <label for="sg-project">Active project</label>
      <select id="sg-project" bind:value={projectId}>
        {#each $projects as p}<option value={p.id}>{p.name}{p.client_name ? " – " + p.client_name : ""}</option>{/each}
      </select>

      {#if project}
        <div class="row between" style="margin:2px 0 6px">
          <b class="num">{revCap == null ? "No revision cap saved" : "Round " + revUsed + " of " + revCap + " used"}</b>
          {#if $isPro}<span class="muted small">Unlimited checks</span>{:else}<span class="muted small num">{used == null ? "" : used + " of " + FREE_LIMIT + " checks used this month"}</span>{/if}
        </div>
        {#if revCap != null}
          <div class="rev"><div class="rev-fill" class:full={revUsed >= revCap} style="width:{revPct}%"></div></div>
        {/if}
        {#if revWarn}<div class="error" style="margin-top:8px">⚠️ {revWarn}</div>{/if}
      {/if}

      <label for="sg-msg" style="margin-top:12px">Client message (email, Slack or WhatsApp)</label>
      <textarea id="sg-msg" rows="6" maxlength="4000" bind:value={message} placeholder="e.g. Can you also add a dark mode and change the homepage layout? Should be quick."></textarea>
      <button class="btn primary lg block" on:click={check} disabled={loading}>{loading ? "Checking against your contract..." : "Check scope ⚡"}</button>
      <p class="muted small" style="margin:8px 0 0">The message is not stored. We only count the check.</p>
      {#if error}<div class="error" role="alert">⚠️ {error}</div>{/if}
      {#if upgrade}<button class="btn primary block" style="margin-top:10px" on:click={() => openPay("pro_year")}>Upgrade to Pro for unlimited checks ⚡</button>{/if}
    </section>

    {#if result}
      <section class="card iri">
        <div class="row between">
          <b>Verdict</b>
          <span class="badge {V[result.verdict].cls}"><i class="dot"></i>{V[result.verdict].label}</span>
        </div>
        <p class="pre" style="margin:0 0 8px">{fmt(result.reasoning)}</p>

        <div class="lbl">Contract clause</div>
        {#if result.clause_quote}
          <blockquote class="redline">{fmt(result.clause_quote)}</blockquote>
        {:else}
          <p class="muted small" style="margin:0">No saved clause covers this request, so treat it as a conversation with the client.</p>
        {/if}

        {#if result.counts_as_revision}
          <div class="row" style="margin-top:12px">
            <span class="muted small">This looks like a revision round.</span>
            <button class="btn sm mfull" on:click={countRevision} disabled={counted}>{counted ? "Counted ✓" : "Count as revision round (+1)"}</button>
          </div>
        {/if}

        <div class="rw-h" style="margin-top:14px">
          <span class="rw-tag">Ready-to-send reply</span>
          <button class="btn sm primary" on:click={() => copy("reply", result.reply_script)}>{copied === "reply" ? "Copied ✓" : "Copy reply"}</button>
        </div>
        <div class="mail">{fmt(result.reply_script)}</div>

        {#if result.change_order_text}
          <div class="rw-h" style="margin-top:6px">
            <span class="rw-tag">Change-order quote</span>
            <button class="btn sm" on:click={() => copy("co", result.change_order_text)}>{copied === "co" ? "Copied ✓" : "Copy change order"}</button>
          </div>
          <div class="mail">{fmt(result.change_order_text)}</div>
          {#if result.estimated_hours}
            <p class="muted small" style="margin:0">Estimated {result.estimated_hours} hours{result.estimated_cost ? " (about " + result.estimated_cost + ")" : ""}. Adjust the hours and rate before sending.</p>
          {/if}
        {/if}
      </section>
    {/if}
  {/if}
  <div style="margin-top:18px"><DisclaimerBanner /></div>
</div>
