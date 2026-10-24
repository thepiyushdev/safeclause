import fs from "node:fs";
import { execSync } from "node:child_process";

// 1. Pehle Nav.svelte, App.svelte aur index.html ko clean state me laate hain
try {
  execSync("git checkout HEAD~1 -- src/lib/Nav.svelte src/App.svelte index.html", { stdio: "ignore" });
  console.log("✅ Restored original clean Nav, App & index.html");
} catch (e) {
  console.log("ℹ️ Using current files as base");
}

// 2. Aapka exact Purple-Blue Radar 'C' Logo (SVG format - never breaks!)
const radarLogoSvg = `<svg width="30" height="30" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0;border-radius:8px;box-shadow:0 2px 8px rgba(79,70,229,0.25)">
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
</svg>`;

// Save as public/favicon.svg as well so browser tab icon matches!
fs.writeFileSync("public/favicon.svg", radarLogoSvg, "utf8");

// Make sure index.html uses /favicon.svg
if (fs.existsSync("index.html")) {
  let idx = fs.readFileSync("index.html", "utf8");
  idx = idx.replace(/<link rel="icon"[^>]*>/, '<link rel="icon" type="image/svg+xml" href="/favicon.svg" />');
  fs.writeFileSync("index.html", idx, "utf8");
}

// 3. Nav.svelte me Left Corner Logo lagao + Menu ke andar clean font me "Earn 30%" jodo
if (fs.existsSync("src/lib/Nav.svelte")) {
  let nav = fs.readFileSync("src/lib/Nav.svelte", "utf8");

  // Remove any messy inline Earn 30% link if present
  nav = nav.replace(/<a[^>]*href="\/refer"[^>]*>[\s\S]*?<\/a>/g, "");

  // Put exact Radar Logo SVG right before ClauseRadar text in brand link
  if (nav.includes("<svg")) {
    nav = nav.replace(/<svg[\s\S]*?<\/svg>/, radarLogoSvg);
  } else if (nav.includes('<img src="/logo.png"')) {
    nav = nav.replace(/<img src="\/logo\.png"[^>]*>/, radarLogoSvg);
  } else {
    nav = nav.replace(/(ClauseRadar)/, `${radarLogoSvg}\n      $1`);
  }

  // Add "Refer & Earn 30%" cleanly inside the navigation links list (same font & style as Pricing)
  nav = nav.replace(
    /(<a[^>]*href="\/pricing"[^>]*>[\s\S]*?<\/a>)/g,
    `$1\n      <a href="/refer" class:active={$route === "/refer" || (typeof path !== "undefined" && path === "/refer")} on:click|preventDefault={() => { if (typeof go === "function") go("/refer"); else { window.history.pushState({}, "", "/refer"); window.dispatchEvent(new PopStateEvent("popstate")); } }}>Refer & Earn 30%</a>`
  );

  // Also support button-based nav items if Nav uses buttons
  if (!nav.includes('"/refer"')) {
    nav = nav.replace(
      /(Pricing<\/button>)/g,
      `$1\n      <button class="nav-link" on:click={() => go("/refer")}>Refer & Earn 30%</button>`
    );
  }

  fs.writeFileSync("src/lib/Nav.svelte", nav, "utf8");
  console.log("✅ Fixed Navbar: Original font restored + Radar 'C' logo added in top-left corner!");
}

// 4. App.svelte me /refer aur /admin routing 100% bullet-proof karo
if (fs.existsSync("src/App.svelte")) {
  let app = fs.readFileSync("src/App.svelte", "utf8");

  if (!app.includes("import Refer")) {
    app = app.replace(
      /<script>/,
      `<script>\n  import Refer from "./pages/Refer.svelte";\n  import Admin from "./pages/Admin.svelte";`
    );
  }

  // Clean any old broken blocks first
  app = app.replace(/\{:else if [^}]*\/refer[^}]*\}[\s\S]*?<Admin \/>\s*/g, "");

  // Detect what router variable App.svelte uses ($route, route, path, currentPath, page)
  const routeVarMatch = app.match(/\{#if\s+([a-zA-Z0-9_$]+)\s*===\s*["']\/["']/);
  const routeVar = routeVarMatch ? routeVarMatch[1] : null;

  if (routeVar) {
    app = app.replace(
      new RegExp(`(\\{#if\\s+\\${routeVar}\\s*===\\s*["']\\/["'])`),
      `{#if ${routeVar} === "/refer"}\n    <Refer />\n  {:else if ${routeVar} === "/admin"}\n    <Admin />\n  {:else if ${routeVar} === "/"`
    );
    console.log(`✅ Wired /refer and /admin in App.svelte using '${routeVar}'`);
  } else if (app.includes("<Pricing")) {
    app = app.replace(
      /(\{:else if ([^\n}]+)pricing[^\n}]*\})/i,
      `{:else if $2.includes("/refer")}\n    <Refer />\n  {:else if $2.includes("/admin")}\n    <Admin />\n  $1`
    );
    console.log("✅ Wired /refer and /admin right before Pricing in App.svelte");
  }

  fs.writeFileSync("src/App.svelte", app, "utf8");
}

// 5. Make sure go("/refer") works in src/lib/app.js if route whitelist exists
if (fs.existsSync("src/lib/app.js")) {
  let appJs = fs.readFileSync("src/lib/app.js", "utf8");
  if (appJs.includes('"/pricing"') && !appJs.includes('"/refer"')) {
    appJs = appJs.replace('"/pricing"', '"/pricing", "/refer", "/admin"');
    fs.writeFileSync("src/lib/app.js", appJs, "utf8");
    console.log("✅ Added /refer and /admin to route list in src/lib/app.js");
  }
}

console.log("\n🎉 All UI & Routing fixes applied!");
