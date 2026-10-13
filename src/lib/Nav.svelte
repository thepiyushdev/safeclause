<script>
  import { route, user, isPro, link, openAuth, openPay, signOutThisDevice } from "./app.js";

  let open = false;
  // opt = secondary links: always in the mobile menu, shown on very wide desktops only
  const LINKS = [
    ["/dashboard", "Scanner", false], ["/scope-guard", "Scope Guard", false], ["/chaser", "Payment Chaser", false],
    ["/sample", "Sample Report", false], ["/pricing", "Pricing", false],
    ["/radar", "Risk calculator", true], ["/vault", "Clause library", true],
  ];

  $: initial = $user && $user.email ? $user.email.charAt(0).toUpperCase() : "";

  function nav(e, p) {
    open = false;
    link(e, p);
  }
  function act(fn) {
    open = false;
    fn();
  }
</script>

<svelte:window on:keydown={(e) => { if (e.key === "Escape") open = false; }} />

<header class="nav">
  <div class="nav-in">
    <a class="brand" href="/" on:click={(e) => nav(e, "/")}>
      <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="#4f46e5" /><circle cx="16" cy="16" r="9" fill="none" stroke="#fff" stroke-opacity=".9" stroke-width="2" /><circle cx="16" cy="16" r="4" fill="none" stroke="#fff" stroke-opacity=".9" stroke-width="2" /><circle cx="22" cy="10" r="2.6" fill="#fb7185" /></svg>
      ClauseRadar
    </a>

    <nav class="nav-links" aria-label="Main">
      {#each LINKS as l}
        <a href={l[0]} class:opt={l[2]} class:active={$route === l[0]} on:click={(e) => nav(e, l[0])}>{l[1]}</a>
      {/each}
    </nav>

    <div class="nav-right">
      <a class="credit" class:pro={$isPro} href="/pricing" title={$isPro ? "Pro plan" : "Free plan. Tap to upgrade"} on:click={(e) => nav(e, "/pricing")}><span class="pl-pre">Plan: </span><b>{$isPro ? "Pro ⚡" : "Free"}</b></a>
      <div class="nav-desktop">
        {#if !$isPro}<button class="btn sm primary" on:click={() => openPay("pro_year")}>Upgrade</button>{/if}
        {#if $user}
          <a class="avatar" href="/account" title={$user.email} on:click={(e) => nav(e, "/account")}>{initial}</a>
        {:else}
          <button class="btn sm" on:click={() => openAuth("login")}>Log in</button>
        {/if}
      </div>
      <button class="burger" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} on:click={() => (open = !open)}>{open ? "✕" : "☰"}</button>
    </div>
  </div>

  {#if open}
    <button class="scrim" aria-label="Close menu" on:click={() => (open = false)}></button>
    <nav class="menu" aria-label="Mobile">
      {#each LINKS as l}
        <a href={l[0]} class:active={$route === l[0]} on:click={(e) => nav(e, l[0])}>{l[1]}</a>
      {/each}
      <hr />
      {#if !$isPro}<button class="mi" on:click={() => act(() => openPay("pro_year"))}>⚡ Upgrade to Pro</button>{/if}
      {#if $user}
        <a href="/account" class:active={$route === "/account"} on:click={(e) => nav(e, "/account")}>👤 Account ({$user.email})</a>
      {:else}
        <button class="mi" on:click={() => act(() => openAuth("login"))}>Log in</button>
        <button class="mi" on:click={() => act(() => openAuth("signup"))}>Create account</button>
      {/if}
    </nav>
  {/if}
</header>
