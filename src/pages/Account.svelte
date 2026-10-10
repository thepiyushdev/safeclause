<script>
  import { sb, user, credits, go, openAuth, openPay, refreshCredits } from "../lib/app.js";

  async function signOut() {
    if (sb) await sb.auth.signOut();
    go("/");
  }
  $: initial = $user && $user.email ? $user.email.charAt(0).toUpperCase() : "";
</script>

<div class="wrap narrow page">
  <h1 class="h2">Account</h1>
  <section class="card">
    {#if !sb}
      <div class="error">Login is not configured yet. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then redeploy.</div>
    {:else if $user}
      <div class="row" style="gap:14px;margin-bottom:14px">
        <span class="avatar" style="width:52px;height:52px;font-size:1.3rem">{initial}</span>
        <div>
          <div class="pre"><b>{$user.email}</b></div>
          <div class="num" style="font-size:1.4rem;font-weight:800">⚡ {$credits} credit{$credits === 1 ? "" : "s"}</div>
        </div>
      </div>
      <div class="row">
        <button class="btn primary mfull" on:click={() => openPay(1)}>Buy credits</button>
        <button class="btn mfull" on:click={() => refreshCredits($user.id)}>Refresh balance</button>
        <button class="btn mfull" on:click={signOut}>Sign out</button>
      </div>
    {:else}
      <p class="muted">Log in to save your credits and unlock rewrites on any device.</p>
      <div class="row">
        <button class="btn primary mfull" on:click={() => openAuth("login")}>Log in</button>
        <button class="btn mfull" on:click={() => openAuth("signup")}>Create account</button>
      </div>
    {/if}
  </section>
</div>
