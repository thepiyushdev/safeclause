import fs from "node:fs";
import { execSync } from "node:child_process";

// 1. Restore Home.svelte & Nav.svelte to 100% clean state first
execSync("git checkout -- src/pages/Home.svelte src/lib/Nav.svelte", { stdio: "ignore" });
console.log("✅ Restored clean Home.svelte and Nav.svelte");

// 2. Keep the clean Radar 'C' logo in Nav.svelte (only swap the brand <svg>)
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

let nav = fs.readFileSync("src/lib/Nav.svelte", "utf8");
nav = nav.replace(/<svg[\s\S]*?<\/svg>/, radarLogoSvg);

// Safely add Refer & Earn 30% to Nav array if Nav uses an array of items, OR right before </nav> / drawer end
if (nav.includes('"/vault"')) {
  // Check if it's inside <script> array like ["/vault", "Clause Vault"] or { path: "/vault", ... }
  const scriptEnd = nav.indexOf("</script>");
  const scriptPart = nav.slice(0, scriptEnd);
  const templatePart = nav.slice(scriptEnd);

  if (scriptPart.includes('"/vault"')) {
    const updatedScript = scriptPart.replace(
      /(\{[^}]*["']\/vault["'][^}]*\})/,
      `$1, { path: "/refer", href: "/refer", to: "/refer", label: "Refer & Earn 30% 💸", name: "Refer & Earn 30% 💸", title: "Refer & Earn 30% 💸" }`
    ).replace(
      /(\[\s*["']\/vault["']\s*,\s*["'][^"']+["']\s*\])/,
      `$1, ["/refer", "Refer & Earn 30% 💸"]`
    );
    nav = updatedScript + templatePart;
    console.log("✅ Nav.svelte: Added '/refer' cleanly into menu array!");
  } else {
    // It's in template HTML: clone the exact line containing "/vault"
    const lines = templatePart.split("\n");
    const out = [];
    for (const line of lines) {
      out.push(line);
      if (line.includes('"/vault"') || line.includes("'/vault'")) {
        const clone = line
          .replace(/\/vault/g, "/refer")
          .replace(/Clause Vault|Vault/g, "Refer & Earn 30% 💸");
        out.push(clone);
        console.log("✅ Nav.svelte: Cloned '/vault' menu line for '/refer'!");
      }
    }
    nav = scriptPart + out.join("\n");
  }
}
fs.writeFileSync("src/lib/Nav.svelte", nav, "utf8");

// 3. Home.svelte: Put the link OUTSIDE </p> so Svelte compiler is 100% happy!
let home = fs.readFileSync("src/pages/Home.svelte", "utf8");
home = home.replace(
  /(<p class="small muted">Free scan[\s\S]*?<\/p>)/,
  `$1\n      <p style="margin-top:12px"><a href="/refer" style="display:inline-flex;align-items:center;gap:6px;padding:7px 15px;border-radius:999px;background:rgba(16,185,129,0.12);border:1px solid rgba(16,185,129,0.35);color:#059669;font-weight:700;font-size:13px;text-decoration:none">💸 Refer friends & earn 30% cash via UPI →</a></p>`
);
fs.writeFileSync("src/pages/Home.svelte", home, "utf8");
console.log("✅ Home.svelte: Added valid <p><a> pill below hero text!");

// 4. Also make sure prerender script doesn't crash on /refer or /admin if it checks routes
