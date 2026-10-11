<script>
  import "./lib/styles.css";
  import { onMount } from "svelte";
  import { route, initApp, link } from "./lib/app.js";
  import Nav from "./lib/Nav.svelte";
  import Footer from "./lib/Footer.svelte";
  import Modals from "./lib/Modals.svelte";
  import Home from "./pages/Home.svelte";
  import Sample from "./pages/Sample.svelte";
  import Dashboard from "./pages/Dashboard.svelte";
  import Pricing from "./pages/Pricing.svelte";
  import Legal from "./pages/Legal.svelte";
  import Radar from "./pages/Radar.svelte";
  import Vault from "./pages/Vault.svelte";
  import Account from "./pages/Account.svelte";

  onMount(function () {
    return initApp();
  });
</script>

<Nav />

<main>
  {#if $route === "/"}
    <Home />
  {:else if $route === "/sample"}
    <Sample />
  {:else if $route === "/dashboard"}
    <Dashboard />
  {:else if $route === "/pricing"}
    <Pricing />
  {:else if $route === "/privacy"}
    <Legal kind="privacy" />
  {:else if $route === "/terms"}
    <Legal kind="terms" />
  {:else if $route === "/radar"}
    <Radar />
  {:else if $route === "/vault"}
    <Vault />
  {:else if $route === "/account"}
    <Account />
  {:else}
    <div class="wrap narrow page center">
      <h1 class="h2">Page not found</h1>
      <p class="muted">That page does not exist.</p>
      <a class="btn primary" href="/" on:click={(e) => link(e, "/")}>Back to home</a>
    </div>
  {/if}
</main>

<Footer />
<Modals />
