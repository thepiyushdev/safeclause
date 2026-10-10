import { writable, derived } from "svelte/store";
import { createClient } from "@supabase/supabase-js";
import { ROUTE_META, SITE } from "./meta.mjs";

const SB_URL = import.meta.env.VITE_SUPABASE_URL;
const SB_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const sb = SB_URL && SB_KEY ? createClient(SB_URL, SB_KEY) : null;

export const UPI_ID = "8796021247@fam";
export const MAX_CHARS = 10000;

export function normalize(p) {
  let x = String(p || "/").split("?")[0].split("#")[0];
  if (x.length > 1) x = x.replace(/\/+$/, "");
  return x || "/";
}

export const route = writable(typeof window === "undefined" ? "/" : normalize(window.location.pathname));
export const session = writable(null);
export const credits = writable(0);
export const authModal = writable({ open: false, mode: "login", note: "" });
export const payModal = writable({ open: false, packId: 1 });
export const showRecovery = writable(false);
export const user = derived(session, function (s) { return s ? s.user : null; });

let currentUser = null;
user.subscribe(function (u) { currentUser = u; });

function setAttr(sel, attr, val) {
  const el = document.querySelector(sel);
  if (el) el.setAttribute(attr, val);
}

export function applyMeta(p) {
  const m = ROUTE_META[p];
  const title = m ? m.title : "Page not found – ClauseRadar";
  const desc = m ? m.description : "This page could not be found.";
  const url = SITE + (p === "/" ? "" : p);
  document.title = title;
  setAttr('meta[name="description"]', "content", desc);
  setAttr('link[rel="canonical"]', "href", url);
  setAttr('meta[name="robots"]', "content", m && m.index ? "index,follow" : "noindex,nofollow");
  setAttr('meta[property="og:title"]', "content", title);
  setAttr('meta[property="og:description"]', "content", desc);
  setAttr('meta[property="og:url"]', "content", url);
  setAttr('meta[name="twitter:title"]', "content", title);
  setAttr('meta[name="twitter:description"]', "content", desc);
}

export function go(path) {
  if (typeof window === "undefined") return;
  const p = normalize(path);
  if (normalize(window.location.pathname) !== p) window.history.pushState({}, "", p);
  route.set(p);
  applyMeta(p);
  window.scrollTo(0, 0);
}

export function link(e, path) {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1) return;
  e.preventDefault();
  go(path);
}

export async function refreshCredits(uid) {
  if (!sb) return;
  try {
    const r = await sb.from("profiles").select("credits").eq("id", uid).maybeSingle();
    credits.set(r.data && Number.isFinite(r.data.credits) ? r.data.credits : 0);
  } catch (e) {}
}

export function initApp() {
  const shell = document.getElementById("seo-shell");
  if (shell) shell.remove();
  const onPop = function () {
    const p = normalize(window.location.pathname);
    route.set(p);
    applyMeta(p);
    window.scrollTo(0, 0);
  };
  window.addEventListener("popstate", onPop);
  applyMeta(normalize(window.location.pathname));
  const unsubUser = user.subscribe(function (u) {
    if (u) refreshCredits(u.id);
    else credits.set(0);
  });
  let authSub = null;
  if (sb) {
    sb.auth.getSession().then(function (r) { session.set(r.data ? r.data.session : null); });
    const res = sb.auth.onAuthStateChange(function (event, s) {
      session.set(s);
      if (event === "PASSWORD_RECOVERY") showRecovery.set(true);
      if (event === "SIGNED_IN") {
        // After Google sign-in the browser returns to the home page; send the user back to where they were.
        let back = null;
        try { back = window.sessionStorage.getItem("cr_return"); window.sessionStorage.removeItem("cr_return"); } catch (e) {}
        if (back && ROUTE_META[normalize(back)] && normalize(window.location.pathname) !== normalize(back)) go(back);
      }
    });
    authSub = res.data.subscription;
  }
  if (window.location.search.indexOf("debug=layout") !== -1) setTimeout(debugLayout, 900);
  return function () {
    window.removeEventListener("popstate", onPop);
    unsubUser();
    if (authSub) authSub.unsubscribe();
  };
}

// Open any page with ?debug=layout to see the real viewport width and which elements overflow it.
export function debugLayout() {
  const vw = document.documentElement.clientWidth;
  const bad = [];
  document.querySelectorAll("body *").forEach(function (el) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && (r.right > vw + 1 || r.left < -1)) bad.push(el);
  });
  bad.slice(0, 12).forEach(function (el) { el.style.outline = "2px solid red"; });
  const names = bad.slice(0, 6).map(function (el) {
    return el.tagName.toLowerCase() + (typeof el.className === "string" && el.className ? "." + el.className.split(" ").join(".") : "");
  });
  const meta = document.querySelector('meta[name="viewport"]');
  window.alert("innerWidth=" + window.innerWidth + " clientWidth=" + vw + " dpr=" + window.devicePixelRatio + "\nviewport meta: " + (meta ? meta.content : "MISSING") + "\noverflowing: " + (names.length ? names.join(" | ") : "none"));
}

export async function authHeaders() {
  const r = await sb.auth.getSession();
  const t = r.data && r.data.session ? r.data.session.access_token : "";
  return { "Content-Type": "application/json", Authorization: "Bearer " + t };
}

export async function readJson(r) {
  const raw = await r.text();
  try { return JSON.parse(raw); } catch (e) { return { error: "Server error (HTTP " + r.status + ")" }; }
}

export function openAuth(mode, note) {
  authModal.set({ open: true, mode: mode || "login", note: note || "" });
}

export function openPay(id) {
  if (!currentUser) { openAuth("login", "Log in first so your credits are added to your account."); return; }
  payModal.set({ open: true, packId: id || 1 });
}

export function fmt(s) {
  return String(s || "").replace(/\r\n/g, "\n").replace(/\\n/g, "\n");
}

export async function copyToClipboard(text) {
  const value = fmt(text);
  try {
    await navigator.clipboard.writeText(value);
  } catch (e) {
    const ta = document.createElement("textarea");
    ta.value = value;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } catch (e2) {}
    document.body.removeChild(ta);
  }
}

export function catLabel(c) {
  const s = String(c || "GENERAL").toUpperCase();
  if (s.indexOf("IP") === 0) return "IP Rights";
  if (s === "REVISIONS") return "Scope Creep";
  return s.toLowerCase().split("_").map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1); }).join(" ");
}

const RISKY = /(\b\d{2,3}\s*days?\b|\bunlimited\b|\bwithout (?:any )?limit\b|\bno cap\b|\buncapped\b|\bsole discretion\b|\bat no (?:extra|additional) cost\b|\bnet[- ]?\d{2,3}\b|\bwork made for hire\b|\bfrom the moment of creation\b|\bwithout notice\b|\bconsequential\b|\bwithout additional compensation\b)/gi;

export function segments(text) {
  const t = fmt(text);
  const out = [];
  let last = 0;
  t.replace(RISKY, function (m, g, idx) {
    if (idx > last) out.push({ t: t.slice(last, idx), hit: false });
    out.push({ t: m, hit: true });
    last = idx + m.length;
    return m;
  });
  if (last < t.length) out.push({ t: t.slice(last), hit: false });
  return out.length ? out : [{ t: t, hit: false }];
}

export function deriveScore(res) {
  const W = { HIGH: 26, MEDIUM: 14, LOW: 6 };
  let s = 0;
  (res.flagged_clauses || []).forEach(function (c) { s += W[c.risk_level] || 0; });
  const lvl = res.overall_risk_score;
  const lo = lvl === "HIGH" ? 70 : lvl === "MEDIUM" ? 40 : 0;
  const hi = lvl === "HIGH" ? 98 : lvl === "MEDIUM" ? 69 : 39;
  return Math.max(lo, Math.min(hi, s));
}

export function perContract(p) {
  return Math.round(p.price / p.credits);
}
