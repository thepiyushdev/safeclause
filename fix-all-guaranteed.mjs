import fs from "node:fs";

// 1. FIX src/App.svelte (Guaranteed Route Mounting)
const appFile = "src/App.svelte";
if (fs.existsSync(appFile)) {
  let app = fs.readFileSync(appFile, "utf8");

  // Clean old imports/routes if any
  app = app.replace(/import Refer from "\.\/pages\/Refer\.svelte";\n?/g, "");
  app = app.replace(/import Admin from "\.\/pages\/Admin\.svelte";\n?/g, "");
  app = app.replace(/\{:else if [^}]*refer[^}]*\}[\s\S]*?<Admin \/>\s*/g, "");

  // Add imports at top of <script>
  app = app.replace(
    /<script>/,
    `<script>\n  import Refer from "./pages/Refer.svelte";\n  import Admin from "./pages/Admin.svelte";`
  );

  // Find ANY Pricing component render `<Pricing` and inject Refer & Admin right before its condition
  // Example: {:else if $route === '/pricing'} or {:else if route.startsWith('/pricing')}
  const pricingRegex = /(\{:else if\s+([^}]+?)(['"]\/pricing['"])([^}]*)\}\s*<Pricing)/;
  if (pricingRegex.test(app)) {
    app = app.replace(
      pricingRegex,
      `{:else if $2"/refer"$4}\n    <Refer />\n  {:else if $2"/admin"$4}\n    <Admin />\n  $1`
    );
    console.log("✅ App.svelte: Injected /refer & /admin right before <Pricing />");
  } else {
    // Fallback: Wrap main router block with direct URL pathname check so /refer & /admin ALWAYS work!
    app = app.replace(
      /(<Nav\s*[^>]*\/>)/,
      `$1\n{#if typeof window !== "undefined" && window.location.pathname.startsWith("/refer")}\n  <Refer />\n{:else if typeof window !== "undefined" && window.location.pathname.startsWith("/admin")}\n  <Admin />\n{:else}`
    );
    if (app.includes("<Footer")) {
      app = app.replace(/(<Footer)/, `{/if}\n$1`);
    } else {
      app += "\n{/if}\n";
    }
    console.log("✅ App.svelte: Mounted direct pathname router for /refer & /admin");
  }

  fs.writeFileSync(appFile, app, "utf8");
}

// 2. FIX src/lib/Nav.svelte (Multi-line safe injection inside menu & desktop nav ONLY)
const navFile = "src/lib/Nav.svelte";
if (fs.existsSync(navFile)) {
  let nav = fs.readFileSync(navFile, "utf8");

  // Remove any previous /refer tag
  nav = nav.replace(/<a[^>]*\/refer[\s\S]*?<\/a>/g, "");
  nav = nav.replace(/<button[^>]*\/refer[\s\S]*?<\/button>/g, "");

  let count = 0;

  // Match any <a ...>...</a> or <button ...>...</button> across multiple lines
  nav = nav.replace(/<(a|button)\b([\s\S]*?)>([\s\S]*?)<\/\1>/g, (fullMatch, tag, attrs, inner) => {
    const cleanInner = inner.replace(/<[^>]+>/g, "").trim();
    // ONLY clone the menu link whose visible text is "Pricing" or "Clause Vault" (never "PlanFree"!)
    if (/^(Pricing|Clause Vault|Vault)$/i.test(cleanInner)) {
      count++;
      let referItem = fullMatch
        .replace(/\/pricing|\/vault/g, "/refer")
        .replace(inner, "💸 Refer & Earn 30%");
      return fullMatch + "\n      " + referItem;
    }
    return fullMatch;
  });

  console.log(`✅ Nav.svelte: Added '💸 Refer & Earn 30%' in ${count} menu locations (Desktop + Mobile ☰ Drawer)`);
  fs.writeFileSync(navFile, nav, "utf8");
}

// 3. FIX src/lib/Footer.svelte (Also put link in Footer)
const footFile = "src/lib/Footer.svelte";
if (fs.existsSync(footFile)) {
  let foot = fs.readFileSync(footFile, "utf8");
  foot = foot.replace(/<a[^>]*\/refer[\s\S]*?<\/a>/g, "");
  foot = foot.replace(/<(a|button)\b([\s\S]*?)>([\s\S]*?)<\/\1>/g, (fullMatch, tag, attrs, inner) => {
    if (inner.trim() === "Pricing") {
      const clone = fullMatch.replace(/\/pricing/g, "/refer").replace(inner, "Refer & Earn 30% 💸");
      return fullMatch + "\n          " + clone;
    }
    return fullMatch;
  });
  fs.writeFileSync(footFile, foot, "utf8");
  console.log("✅ Footer.svelte: Added 'Refer & Earn 30% 💸'");
}

// 4. ALSO ADD A CLEAN FLOATING/ANNOUNCEMENT PILL OR LINK IF NEEDED ON HOME
const homeFile = "src/pages/Home.svelte";
if (fs.existsSync(homeFile)) {
  let home = fs.readFileSync(homeFile, "utf8");
  if (!home.includes("/refer")) {
    // Make the top "Introducing ClauseRadar..." pill or add a clean partner banner below hero subtext
    home = home.replace(
      /(Free scan\s*•\s*Pay only to unlock rewrites[^<]*)/,
      `$1\n      <div style="margin-top:14px"><a href="/refer" style="display:inline-flex;align-items:center;gap:6px;padding:6px 14px;border-radius:999px;background:rgba(16,185,129,0.12);border:1px solid rgba(16,185,129,0.35);color:#059669;font-weight:700;font-size:13px;text-decoration:none">💸 New: Refer friends & earn 30% cash via UPI →</a></div>`
    );
    fs.writeFileSync(homeFile, home, "utf8");
    console.log("✅ Home.svelte: Added clean 'Refer friends & earn 30% cash via UPI →' pill below hero buttons!");
  }
}
