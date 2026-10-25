<script>
  import { sb, user, isPro, profile, deviceState, openAuth, openPay, refreshProfile, syncDevice, revokeDevice, signOutThisDevice, fmtDate, projects, invoices, loadProjects, loadInvoices, deleteProject, scopeUsage, memoryError } from "../lib/app.js";

  let used = null;
  let msg = "";
  $: initial = $user && $user.email ? $user.email.charAt(0).toUpperCase() : "";
  $: if ($user) { loadProjects(); loadInvoices(); syncDevice("list"); scopeUsage().then(function (n) { used = n; }); }
  $: openInv = $invoices.filter(function (i) { return !i.paid_at; }).length;
  $: devs = $deviceState.devices || [];
  $: activeCount = devs.filter(function (d) { return d.active; }).length;

  function ago(iso) {
    const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
    if (m < 2) return "just now";
    if (m < 60) return m + " min ago";
    if (m < 1440) return Math.round(m / 60) + " h ago";
    return Math.round(m / 1440) + " d ago";
  }
  async function removeProject(p) {
    msg = "";
    try { await deleteProject(p.id); } catch (e) { msg = e.message; }
  }
</script>

<div class="wrap narrow page">
  <h1 class="h2">Account</h1>

  {#if !sb}
    <section class="card"><div class="error">Login is not configured yet. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then redeploy.</div></section>
  {:else if !$user}
    <section class="card">
      <p class="muted" style="margin:0 0 12px">Log in to see your plan, projects and devices.</p>
      <div class="row">
        <button class="btn primary mfull" on:click={() => openAuth("login")}>Log in</button>
        <button class="btn mfull" on:click={() => openAuth("signup")}>Create account</button>
      </div>
    </section>
  {:else}
    <section class="card">
      <div class="row" style="gap:14px;margin-bottom:12px">
        <span class="avatar" style="width:52px;height:52px;font-size:1.3rem">{initial}</span>
        <div style="min-width:0">
          <div class="pre"><b>{$user.email}</b></div>
          <span class="badge {$isPro ? 'low' : 'med'}"><i class="dot"></i>Plan: {$isPro ? "Pro ⚡" : "Free"}</span>
        </div>
      </div>
      {#if $isPro}
        <p style="margin:0 0 4px">Pro ({$profile.pro_plan === "pro_year" ? "Yearly" : "Monthly"}) is active until <b>{fmtDate($profile.pro_until)}</b>.</p>
        <p class="muted small" style="margin:0 0 12px">Renewal is manual: pay again before this date to extend. Automatic renewal is not enabled yet.</p>
      {:else}
        <p class="muted" style="margin:0 0 12px">You are on the Free plan. Go Pro to unlock every rewrite, unlimited Scope Guard and Payment Chaser, PDF exports and 3 devices.</p>
      {/if}
      <div class="row">
        <button class="btn primary mfull" on:click={() => openPay("pro_year")}>{$isPro ? "Extend Pro" : "Upgrade to Pro"} ⚡</button>
        <button class="btn mfull" on:click={() => { refreshProfile($user.id); syncDevice("list"); }}>Refresh</button>
      </div>
    </section>

    <section class="card">
      <b>Usage</b>
      <ul class="lines">
        <li><span>Projects in Contract Memory</span><b class="num">{$projects.length}{$isPro ? "" : " of 1"}</b></li>
        <li><span>Open invoices</span><b class="num">{openInv}{$isPro ? "" : " of 1"}</b></li>
        <li><span>Scope Guard checks this month</span><b class="num">{used == null ? "-" : used}{$isPro ? "" : " of 3"}</b></li>
      </ul>
      {#if $memoryError}<div class="error" role="alert" style="margin:0 0 10px">⚠️ {$memoryError}</div>{/if}
      {#each $projects as p}
        <div class="row between" style="margin:0 0 6px">
          <span style="min-width:0;overflow-wrap:anywhere">{p.name}{p.client_name ? " – " + p.client_name : ""}</span>
          <button class="btn sm" on:click={() => removeProject(p)}>Delete</button>
        </div>
      {/each}
      {#if msg}<div class="error">{msg}</div>{/if}
    </section>

    <section class="card">
      <div class="row between" style="margin-bottom:4px"><b>Logged-in devices</b><span class="badge {activeCount > $deviceState.limit ? 'high' : 'low'}">Active {activeCount} of {$deviceState.limit}</span></div>
      <p class="muted small" style="margin:0 0 10px">{$isPro ? "Pro lets you use ClauseRadar on up to 3 devices at the same time." : "Free allows 1 device at a time. Pro allows up to 3."} A device counts as active for 20 minutes after its last use.</p>
      {#each devs as d (d.device_id)}
        <div class="dev">
          <div style="min-width:0">
            <b>{d.label}</b>{#if d.current} <span class="badge low">This device</span>{/if}
            <div class="muted small">{d.active ? "Active now" : "Last active " + ago(d.last_seen)}</div>
          </div>
          {#if !d.current}<button class="btn sm" on:click={() => revokeDevice(d.device_id)}>Sign out</button>{/if}
        </div>
      {/each}
      {#if devs.length === 0}<p class="muted small" style="margin:0">No device information yet.</p>{/if}
      <button class="btn block" style="margin-top:12px" on:click={signOutThisDevice}>Sign out of this device</button>
    </section>
  {/if}
</div>
