<script>
  import { route, user, credits, link, openAuth, openPay } from "./app.js";

  let open = false;
  const LINKS = [["/dashboard", "Scanner"], ["/sample", "Sample report"], ["/radar", "Risk calculator"], ["/vault", "Clause library"], ["/pricing", "Pricing"]];

  $: initial = $user && $user.email ? $user.email.charAt(0).toUpperCase() : "";
  $: short = $credits >= 10000 ? Math.floor($credits / 100) / 10 + "k" : String($credits);

  function nav(e, p) {
    open = false;
    link(e, p);
  }
</script>

<header class="nav">
  <div class="nav-in">
    <a class="brand" href="/" on:click={(e) => nav(e, "/")}>
      <svg width="24" height="24" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="#4f46e5" /><circle cx="16" cy="16" r="9" fill="none" stroke="#fff" stroke-opacity=".9" stroke-width="2" /><circle cx="16" cy="16" r="4" fill="none" stroke="#fff" stroke-opacity=".9" stroke-width="2" /><circle cx="22" cy="10" r="2.6" fill="#fb7185" /></svg>
      ClauseRadar
    </a>
    <nav class="nav-links" aria-label="Main">
      {#each LINKS as l}
        <a href={l[0]} class:active={$route === l[0]} on:click={(e) => nav(e, l[0])}>{l[1]}</a>
      {/each}
    </nav>
    <div class="nav-right">
      <a class="credit" href="/pricing" title={$credits + " credits"} on:click={(e) => nav(e, "/pricing")}>⚡ <b class="num">{short}</b></a>
      <button class="btn sm hide-sm" on:click={() => openPay(1)}>Buy credits</button>
      {#if $user}
        <a class="avatar" href="/account" title={$user.email} on:click={(e) => nav(e, "/account")}>{initial}</a>
      {:else}
        <button class="btn sm primary" on:click={() => openAuth("login")}>Log in</button>
      {/if}
      <button class="burger" aria-label="Menu" on:click={() => (open = !open)}>{open ? "✕" : "☰"}</button>
    </div>
  </div>
  {#if open}
    <nav class="menu" aria-label="Mobile">
      {#each LINKS as l}
        <a href={l[0]} class:active={$route === l[0]} on:click={(e) => nav(e, l[0])}>{l[1]}</a>
      {/each}
      <a href="/pricing" on:click={(e) => { e.preventDefault(); open = false; openPay(1); }}>Buy credits</a>
    </nav>
  {/if}
</header>
