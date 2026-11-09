// fix-root.mjs: gives the app its mount element back in index.html, rebuilds and pushes.
import fs from "node:fs";
import { execSync } from "node:child_process";

const run = (c) => execSync(c, { stdio: "inherit" });
const before = fs.readFileSync("index.html", "utf8");

let main = "";
for (const n of ["main.js", "main.ts", "main.mjs"]) {
  try { main = fs.readFileSync("src/" + n, "utf8"); break; } catch (e) {}
}
const m = main.match(/getElementById\(\s*["']([^"']+)["']\s*\)/) || main.match(/querySelector\(\s*["']#([^"']+)["']\s*\)/);
const id = m && m[1] !== "boot" ? m[1] : "app";
const root = '<div id="' + id + '"></div>';

if (new RegExp('<div\\s+id="' + id + '"').test(before)) {
  console.log('index.html already has <div id="' + id + '">. Nothing to fix.');
  process.exit(0);
}

let after;
if (before.includes('<div id="boot"></div>')) {
  after = before.replace('<div id="boot"></div>', root);
} else if (/<script\s+type="module"/i.test(before)) {
  after = before.replace(/<script\s+type="module"/i, root + '\n<script type="module"');
} else {
  console.error("Could not find the module script in index.html. Nothing changed.");
  process.exit(1);
}

fs.writeFileSync("index.html", after);
console.log("Restored " + root + " in index.html. Building...");
try {
  run("npm run build");
} catch (e) {
  fs.writeFileSync("index.html", before);
  console.error("Build failed. index.html was restored. Nothing was pushed.");
  process.exit(1);
}
run("git add -A");
try { run('git commit -m "Fix app root element (boot skeleton was used as mount target)"'); } catch (e) {}
run("git push --force-with-lease origin main");
console.log("Done. Wait for Vercel to deploy, then open the site in an incognito tab.");
