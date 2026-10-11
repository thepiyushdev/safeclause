// Runs after "vite build". Writes one static HTML file per route plus robots.txt and sitemap.xml.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ROUTE_META, SITE } from "../src/lib/meta.mjs";
import { headTags, shellHtml } from "./seo-content.mjs";

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

const paths = Object.keys(ROUTE_META);
for (const p of paths) {
  const html = swapShell(swapHead(tpl, headTags(p)), shellHtml(p));
  const out = p === "/" ? tplPath : path.join(dist, p.slice(1), "index.html");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, html, "utf8");
}

const today = new Date().toISOString().slice(0, 10);
const urls = paths.filter(function (p) { return ROUTE_META[p].index; }).map(function (p) {
  return "  <url><loc>" + SITE + (p === "/" ? "/" : p) + "</loc><lastmod>" + today + "</lastmod><changefreq>weekly</changefreq><priority>" + ROUTE_META[p].priority + "</priority></url>";
});
fs.writeFileSync(path.join(dist, "sitemap.xml"), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls.join("\n") + "\n</urlset>\n", "utf8");
fs.writeFileSync(path.join(dist, "robots.txt"), "User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /account\n\nSitemap: " + SITE + "/sitemap.xml\n", "utf8");

console.log("prerender: wrote " + paths.length + " pages, sitemap.xml and robots.txt");
