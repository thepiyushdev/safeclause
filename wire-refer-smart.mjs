import fs from "node:fs";

// 1. SMART WIRE: src/lib/Nav.svelte
const navPath = "src/lib/Nav.svelte";
if (fs.existsSync(navPath)) {
  let nav = fs.readFileSync(navPath, "utf8");

  // Clean any old attempts first
  nav = nav.replace(/[^\n]*\/refer[^\n]*\n?/g, "");

  let addedInNav = false;

  // Case A: Nav uses an array of links like [{ href: "/dashboard", label: "..." }, ...]
  if (/\{\s*(href|path|to)\s*:\s*["']\/[^"']+["']/.test(nav)) {
    nav = nav.replace(
      /(\{\s*(href|path|to)\s*:\s*["']\/(vault|pricing|dashboard|radar)["'][^}]*\})/,
      `$1,\n    { $2: "/refer", label: "Refer & Earn 30% 💸", name: "Refer & Earn 30% 💸", title: "Refer & Earn 30% 💸" }`
    );
    addedInNav = true;
    console.log("✅ Added '/refer' into Nav links array");
  }

  // Case B: Nav uses <a ...> tags inside menu/drawer/nav-links
  if (!addedInNav) {
    // Find all <a> or <button> items that navigate to /vault, /dashboard, /radar, or /pricing (excluding the PlanFree pill)
    const lines = nav.split("\n");
    const newLines = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      newLines.push(line);

      // Skip the PlanFree badge line so we NEVER crowd the top mobile header bar
      if (line.includes("Plan") || line.includes("plan-pill") || line.includes("badge")) continue;

      // Match any navigation link for /vault, /radar, or /dashboard, or /pricing inside menu
      if (
        (line.includes('"/vault"') || line.includes("'/vault'") ||
         line.includes('"/radar"') || line.includes("'/radar'") ||
         (line.includes('"/pricing"') && !line.includes("Free") && !line.includes("Pro"))) &&
        (line.includes("<a ") || line.includes("<button "))
      ) {
        const targetRoute = line.includes("/vault")
          ? "/vault"
          : line.includes("/radar")
          ? "/radar"
          : "/pricing";

        const cloned = line
          .replaceAll(targetRoute, "/refer")
          .replace(/>([^<]+)<\/(a|button)>/, ">💸 Refer & Earn 30%</$2>");

        newLines.push(cloned);
        addedInNav = true;
        console.log("✅ Cloned menu link for '/refer' right after:", targetRoute);
      }
    }
    if (addedInNav) {
      nav = newLines.join("\n");
    }
  }

  fs.writeFileSync(navPath, nav, "utf8");
  if (!addedInNav) {
    console.log("⚠️ Could not auto-match Nav pattern. Printing Nav.svelte lines:");
    console.log(nav);
  }
}

// 2. SMART WIRE: src/lib/Footer.svelte (Add link in Footer too so it's always accessible!)
const footPath = "src/lib/Footer.svelte";
if (fs.existsSync(footPath)) {
  let foot = fs.readFileSync(footPath, "utf8");
  if (!foot.includes("/refer")) {
    const lines = foot.split("\n");
    const out = [];
    let done = false;
    for (const line of lines) {
      out.push(line);
      if (!done && (line.includes('"/pricing"') || line.includes("'/pricing'")) && (line.includes("<a") || line.includes("<button"))) {
        out.push(
          line
            .replaceAll("/pricing", "/refer")
            .replace(/>([^<]+)<\/(a|button)>/, ">Refer & Earn 30% 💸</$2>")
        );
        done = true;
      }
    }
    fs.writeFileSync(footPath, out.join("\n"), "utf8");
    if (done) console.log("✅ Added 'Refer & Earn 30% 💸' to Footer as well");
  }
}

// 3. SMART WIRE: src/App.svelte (Router)
const appPath = "src/App.svelte";
if (fs.existsSync(appPath)) {
  let app = fs.readFileSync(appPath, "utf8");

  if (!app.includes("import Refer")) {
    app = app.replace(
      /<script>/,
      `<script>\n  import Refer from "./pages/Refer.svelte";\n  import Admin from "./pages/Admin.svelte";`
    );
  }

  // Remove any partial /refer blocks
  app = app.replace(/\{:else if [^\n}]*\/refer[^\n}]*\}[\s\S]*?<Admin \/>\s*/g, "");

  // Match ANY {:else if ... === "/pricing"} or similar route condition in App.svelte
  const routeRegex = /\{:else if\s+([^}]+?)(["']\/pricing["'])([^}]*)\}/;
  const m = app.match(routeRegex);

  if (m) {
    const fullMatch = m[0];
    const before = m[1];
    const after = m[3];
    const referCond = `{:else if ${before}"/refer"${after}}\n    <Refer />\n  {:else if ${before}"/admin"${after}}\n    <Admin />\n  ${fullMatch}`;
    app = app.replace(fullMatch, referCond);
    console.log("✅ Wired '/refer' and '/admin' into App.svelte router!");
  } else {
    console.log("⚠️ App.svelte router pattern different. Printing App.svelte:");
    console.log(app);
  }

  fs.writeFileSync(appPath, app, "utf8");
}
