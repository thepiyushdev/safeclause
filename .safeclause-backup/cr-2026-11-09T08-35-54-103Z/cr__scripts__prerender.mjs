// Runs after "vite build". Writes one static HTML file per route plus robots.txt and sitemap.xml,
// then re-reads every file and fails the build if a title, canonical link or schema block is missing.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ROUTE_META, SITE } from "../src/lib/meta.mjs";
import { headTags, shellHtml, esc } from "./seo-content.mjs";
import { GUIDES } from "../src/lib/guides.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const tplPath = path.join(dist, "index.html");
if (!fs.existsSync(tplPath)) throw new Error("dist/index.html not found. Run vite build first.");
const tpl = fs.readFileSync(tplPath, "utf8");

function swapHead(html, content) {
  const a = /<meta name="seo-start"[^>]*>/.exec(html);
  const b = /<meta name="seo-end"[^>]*>/.exec(html);
  if (!a || !b || b.index < a.index) throw new Error("SEO head markers not found in dist/index.html");
  return html.slice(0, a.index + a[0].length) + "\n" + content + html.slice(b.index);
}

function swapShell(html, content) {
  const open = html.indexOf("<seo-shell");
  if (open === -1) throw new Error("seo-shell element not found in dist/index.html");
  const gt = html.indexOf(">", open);
  const close = html.indexOf("</seo-shell>", gt);
  if (gt === -1 || close === -1) throw new Error("seo-shell element is malformed");
  return html.slice(0, gt + 1) + content + html.slice(close);
}

function outFile(p) {
  return p === "/" ? tplPath : path.join(dist, p.slice(1), "index.html");
}

const paths = Object.keys(ROUTE_META);

// Every page needs its own title and description (duplicates hurt search results).
const seenTitle = {};
const seenDesc = {};
const dupes = [];
paths.forEach(function (p) {
  const m = ROUTE_META[p];
  if (seenTitle[m.title]) dupes.push(p + " repeats the title of " + seenTitle[m.title]);
  if (seenDesc[m.description]) dupes.push(p + " repeats the description of " + seenDesc[m.description]);
  seenTitle[m.title] = p;
  seenDesc[m.description] = p;
});
if (dupes.length) throw new Error("Duplicate SEO text: " + dupes.join("; "));

for (const p of paths) {
  const html = swapShell(swapHead(tpl, headTags(p)), shellHtml(p));
  const out = outFile(p);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, html, "utf8");
}

// Read everything back and check it.
const bad = [];
for (const p of paths) {
  const html = fs.readFileSync(outFile(p), "utf8");
  const m = ROUTE_META[p];
  const url = SITE + (p === "/" ? "" : p);
  if (html.indexOf("<title>" + esc(m.title) + "</title>") === -1) bad.push(p + ": title");
  if (html.indexOf('rel="canonical" href="' + url + '"') === -1) bad.push(p + ": canonical");
  if (html.indexOf('content="' + (m.index ? "index,follow" : "noindex,nofollow") + '"') === -1) bad.push(p + ": robots meta");
  if (html.indexOf("<h1") === -1) bad.push(p + ": h1");
}
GUIDES.forEach(function (g) {
  const html = fs.readFileSync(outFile(g.slug), "utf8");
  if (html.indexOf('"@type":"Article"') === -1) bad.push(g.slug + ": Article schema");
  if (html.indexOf('"@type":"FAQPage"') === -1) bad.push(g.slug + ": FAQPage schema");
  if (html.indexOf(esc(g.trap.slice(0, 40))) === -1) bad.push(g.slug + ": trap text");
  if (html.indexOf(esc(g.fix.slice(0, 40))) === -1) bad.push(g.slug + ": safer clause text");
});
const hub = fs.readFileSync(outFile("/guides"), "utf8");
if ((hub.match(/href="\/guide\//g) || []).length < GUIDES.length) bad.push("/guides: not every guide is linked");
const home = fs.readFileSync(tplPath, "utf8");
if (home.indexOf('"@type":"FAQPage"') === -1) bad.push("/: FAQPage schema");
if (home.indexOf('"@type":"SoftwareApplication"') === -1) bad.push("/: SoftwareApplication schema");
["BrandDeal Shield", "Offer Letter and Bond Shield", "Agency White-Label Shield", "Freelancers and developers"].forEach(function (k) {
  if (home.indexOf(k) === -1) bad.push("/: missing niche text '" + k + "'");
});
if (bad.length) throw new Error("Prerender verification failed: " + bad.join(", "));

const today = new Date().toISOString().slice(0, 10);
const urls = paths.filter(function (p) { return ROUTE_META[p].index; }).map(function (p) {
  return "  <url><loc>" + SITE + (p === "/" ? "/" : p) + "</loc><lastmod>" + today + "</lastmod><changefreq>weekly</changefreq><priority>" + ROUTE_META[p].priority + "</priority></url>";
});
fs.writeFileSync(path.join(dist, "sitemap.xml"), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls.join("\n") + "\n</urlset>\n", "utf8");
fs.writeFileSync(path.join(dist, "robots.txt"), "User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /account\n\nSitemap: " + SITE + "/sitemap.xml\n", "utf8");

console.log("prerender: wrote " + paths.length + " pages (" + urls.length + " in sitemap), verified titles, canonicals and schema, wrote sitemap.xml and robots.txt");
