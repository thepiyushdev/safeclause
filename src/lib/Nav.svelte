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
      <svg width="26" height="26" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0;border-radius:7px">
  <defs>
    <linearGradient id="crBg" x1="0" y1="512" x2="512" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#4338ca"/>
      <stop offset="55%" stop-color="#5b46f5"/>
      <stop offset="100%" stop-color="#7c3aed"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="115" fill="url(#crBg)"/>
  <circle cx="256" cy="256" r="88" stroke="#a5b4fc" stroke-opacity="0.45" stroke-width="18"/>
  <circle cx="256" cy="256" r="56" stroke="#818cf8" stroke-opacity="0.35" stroke-width="14"/>
  <path d="M356 164 A 136 136 0 1 0 356 348" stroke="#ffffff" stroke-width="46" stroke-linecap="round"/>
  <circle cx="366" cy="160" r="26" fill="#ffffff"/>
  <circle cx="366" cy="352" r="26" fill="#ffffff"/>
  <circle cx="256" cy="256" r="25" fill="#ffffff"/>
  <line x1="256" y1="256" x2="395" y2="224" stroke="#eef2ff" stroke-width="20" stroke-linecap="round"/>
  <circle cx="424" cy="218" r="68" fill="#8b5cf6"/>
  <circle cx="424" cy="218" r="50" fill="#ffffff"/>
  <circle cx="424" cy="218" r="36" fill="#f87171"/>
</svg>
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
