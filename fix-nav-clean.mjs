import fs from "node:fs";
import { execSync } from "node:child_process";

// 1. Find the clean commit before affiliate script touched Nav.svelte / App.svelte
const log = execSync("git log --oneline -n 10", { encoding: "utf8" }).split("\n");
let cleanCommit = "HEAD~2";
for (const line of log) {
  if (!line.toLowerCase().includes("affiliate") && !line.toLowerCase().includes("refer") && !line.toLowerCase().includes("logo")) {
    const hash = line.trim().split(" ")[0];
    if (hash) { cleanCommit = hash; break; }
  }
}

try {
  execSync(`git checkout ${cleanCommit} -- src/lib/Nav.svelte src/App.svelte`, { stdio: "ignore" });
  console.log("✅ Restored 100% original clean Nav.svelte & App.svelte from commit:", cleanCommit);
} catch (e) {
  console.log("⚠️ Could not checkout old commit, cleaning manually...");
}

// 2. Clean Purple-Blue Radar 'C' Logo SVG (26x26 so it never crowds ClauseRadar text)
const radarLogoSvg = `<svg width="26" height="26" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0;border-radius:7px">
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

fs.writeFileSync("public/favicon.svg", radarLogoSvg, "utf8");

// 3. Update Nav.svelte safely: ONLY replace the brand SVG and clone the "/vault" or "/Scope" menu item inside the menu
let nav = fs.readFileSync("src/lib/Nav.svelte", "utf8");

// Remove any leftover broken /refer links
nav = nav.replace(/<a[^>]*href="\/refer"[^>]*>[\s\S]*?<\/a>/g, "");

// Replace the brand SVG icon with the Radar C logo
nav = nav.replace(/<svg[\s\S]*?<\/svg>/, radarLogoSvg);

// Fix the "PlanFree" overlap by adding a tiny space between Plan and Free if needed, or keeping original CSS intact
nav = nav.replace(/Plan\s*<span/g, "Plan&nbsp;<span");

// Clone the "/vault" (Clause Vault) or "/pricing" link ONLY where it appears inside the nav menu (not the Plan pill!)
nav = nav.replace(/(<a[^>]*href="\/vault"[^>]*>[\s\S]*?<\/a>)/g, (match) => {
  const referClone = match
    .replace(/\/vault/g, "/refer")
    .replace(/>[^<]+<\/a>$/, ">Refer & Earn 30%</a>");
  return match + "\n      " + referClone;
});

fs.writeFileSync("src/lib/Nav.svelte", nav, "utf8");
console.log("✅ Nav.svelte cleaned: Top bar restored + Refer link placed neatly inside menu!");

// 4. Inspect App.svelte and wire /refer and /admin properly
let app = fs.readFileSync("src/App.svelte", "utf8");
if (!app.includes("import Refer")) {
  app = app.replace(
    /<script>/,
    `<script>\n  import Refer from "./pages/Refer.svelte";\n  import Admin from "./pages/Admin.svelte";`
  );
}

// Clone how "/vault" is routed in App.svelte so /refer and /admin work 100% identically
if (!app.includes('"/refer"')) {
  if (app.includes('"/vault"')) {
    app = app.replace(
      /(\{:else if ([a-zA-Z0-9_$.]+)\s*===\s*["']\/vault["']\})/,
      `{:else if $2 === "/refer"}\n    <Refer />\n  {:else if $2 === "/admin"}\n    <Admin />\n  $1`
    );
  }
  // Also handle map/component routing if used
  if (app.includes('"/vault":')) {
    app = app.replace(
      /["']\/vault["']\s*:/,
      `"/refer": Refer,\n    "/admin": Admin,\n    "/vault":`
    );
  }
}
fs.writeFileSync("src/App.svelte", app, "utf8");
console.log("✅ App.svelte router wired identically to /vault!");
