import { writable, derived, get } from "svelte/store";
import { createClient } from "@supabase/supabase-js";
import { ROUTE_META, SITE } from "./meta.mjs";
import { WHOP, ASIA_COUNTRIES, ASIA_TIMEZONES } from "./data.mjs";

const SB_URL = import.meta.env.VITE_SUPABASE_URL;
const SB_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const sb = SB_URL && SB_KEY ? createClient(SB_URL, SB_KEY) : null;

export const MAX_CHARS = 10000;

export function normalize(p) {
  let x = String(p || "/").split("?")[0].split("#")[0];
  if (x.length > 1) x = x.replace(/\/+$/, "");
  return x || "/";
}

export const route = writable(typeof window === "undefined" ? "/" : normalize(window.location.pathname));
export const session = writable(null);
export const profile = writable({ pro_until: null, pro_plan: null, ref_code: null, wallet_balance: 0, loaded: false });
export const isPro = derived(profile, function (p) { return !!(p.pro_until && new Date(p.pro_until).getTime() > Date.now()); });
export const deviceState = writable({ blocked: false, revoked: false, devices: [], limit: 1, plan: "free", loaded: false });
export const authModal = writable({ open: false, mode: "login", note: "" });
export const payModal = writable({ open: false, planId: "pro_year" });
export const showRecovery = writable(false);
export const scanMode = writable("freelance");
export const authReady = writable(false);
export const scanJur = writable("india");
export const bootSlow = writable(false);
export const region = writable("global");
export const country = writable("");
export const toast = writable({ open: false, text: "", ok: false });
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

export async function refreshProfile(uid) {
  if (!sb) return;
  try {
    let r = await sb.from("profiles").select("pro_until,pro_plan,ref_code,wallet_balance").eq("id", uid).maybeSingle();
    if (r.error) r = await sb.from("profiles").select("pro_until,pro_plan").eq("id", uid).maybeSingle();
    const d = r.error ? {} : r.data || {};
    profile.set({ pro_until: d.pro_until || null, pro_plan: d.pro_plan || null, ref_code: d.ref_code || null, wallet_balance: Number(d.wallet_balance) || 0, loaded: true });
  } catch (e) {
    profile.update(function (p) { return Object.assign({}, p, { loaded: true }); });
  }
}

/* ---------- devices (Free: 1 at a time, Pro: 3) ---------- */
export function getDeviceId() {
  try {
    let id = window.localStorage.getItem("cr_device");
    if (!id) {
      id = window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : "d" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      window.localStorage.setItem("cr_device", id);
    }
    return id;
  } catch (e) {
    return "device-" + Math.random().toString(36).slice(2, 14);
  }
}

export function deviceLabel() {
  const ua = String(window.navigator.userAgent || "");
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /SamsungBrowser/.test(ua) ? "Samsung Internet" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /Android/.test(ua) ? "Android" : /iPhone|iPad|iPod/.test(ua) ? "iOS" : /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "device";
  return browser + " on " + os;
}

export function markFreshLogin() {
  try { window.sessionStorage.setItem("cr_fresh", "1"); } catch (e) {}
}

async function deviceCall(action, extra) {
  const headers = await authHeaders();
  const body = Object.assign({ action: action, device_id: getDeviceId(), label: deviceLabel() }, extra || {});
  const r = await fetch("/api/device", { method: "POST", headers: headers, body: JSON.stringify(body) });
  return readJson(r);
}

export async function syncDevice(action) {
  if (!sb) return;
  try {
    let fresh = false;
    try { fresh = window.sessionStorage.getItem("cr_fresh") === "1"; window.sessionStorage.removeItem("cr_fresh"); } catch (e) {}
    const d = await deviceCall(action || "register", { fresh: fresh });
    if (d.error) return;
    if (d.revoked) { await sb.auth.signOut({ scope: "local" }); return; }
    deviceState.set({ blocked: !!d.blocked, revoked: false, devices: d.devices || [], limit: d.limit || 1, plan: d.plan || "free", loaded: true });
  } catch (e) {}
}

export async function revokeDevice(target) {
  if (!sb) return;
  try {
    const d = await deviceCall("revoke", { target: target });
    if (!d.error) deviceState.set({ blocked: !!d.blocked, revoked: false, devices: d.devices || [], limit: d.limit || 1, plan: d.plan || "free", loaded: true });
    if (d.blocked) await syncDevice("register");
  } catch (e) {}
}

export async function signOutThisDevice() {
  if (!sb) return;
  try { await deviceCall("revoke", { target: getDeviceId() }); } catch (e) {}
  await sb.auth.signOut({ scope: "local" });
  deviceState.set({ blocked: false, revoked: false, devices: [], limit: 1, plan: "free", loaded: false });
}

export function initApp() {
  const shell = document.getElementById("seo-shell");
  if (shell) shell.remove();
  const boot = document.getElementById("boot");
  if (boot) boot.remove();
  const bootErr = document.getElementById("boot-err");
  if (bootErr) bootErr.remove();
  setTimeout(function () { bootSlow.set(true); }, 3000);
  captureRef();
  detectRegion();
  handleCheckoutReturn();
  if (!sb) authReady.set(true);
  const onPop = function () {
    const p = normalize(window.location.pathname);
    route.set(p);
    applyMeta(p);
    window.scrollTo(0, 0);
  };
  window.addEventListener("popstate", onPop);
  applyMeta(normalize(window.location.pathname));
  let beat = null;
  const unsubUser = user.subscribe(function (u) {
    if (beat) { clearInterval(beat); beat = null; }
    if (u) {
      refreshProfile(u.id);
      claimReferral(u);
      if (returnedFromWhop) verifyCheckout(true);
      else if (hasPendingCheckout()) verifyCheckout(false);
      syncDevice("register");
      beat = setInterval(function () { if (document.visibilityState === "visible") syncDevice("register"); }, 4 * 60 * 1000);
    } else {
      profile.set({ pro_until: null, pro_plan: null, ref_code: null, wallet_balance: 0, loaded: false });
      deviceState.set({ blocked: false, revoked: false, devices: [], limit: 1, plan: "free", loaded: false });
    }
  });
  let authSub = null;
  if (sb) {
    try {
      sb.auth.getSession().then(function (r) { session.set(r.data ? r.data.session : null); authReady.set(true); if (returnedFromWhop && !(r.data && r.data.session)) showToast("Payment received? Log in with the email you used at checkout and Pro will activate.", 10000, false); }).catch(function () { authReady.set(true); });
    } catch (e) {
      authReady.set(true);
    }
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
    if (beat) clearInterval(beat);
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
  return { "Content-Type": "application/json", Authorization: "Bearer " + t, "x-device-id": getDeviceId() };
}

export async function readJson(r) {
  const raw = await r.text();
  try { return JSON.parse(raw); } catch (e) { return { error: "Server error (HTTP " + r.status + ")" }; }
}

export function openAuth(mode, note) {
  authModal.set({ open: true, mode: mode || "login", note: note || "" });
}

export function openPay(planId) {
  if (!currentUser) { openAuth("login", "Log in first so Pro is added to your account."); return; }
  payModal.set({ open: true, planId: typeof planId === "string" ? planId : "pro_year" });
}

/* ---------- Whop checkout. Pro is granted only by the server after a signed Whop webhook. ---------- */
const CHECKOUT_FLAG = "whop_checkout_initiated";
let toastTimer = null;
let returnedFromWhop = false;
let verifying = false;

export function showToast(text, ms, ok) {
  clearTimeout(toastTimer);
  toast.set({ open: true, text: text, ok: !!ok });
  if (ms) toastTimer = setTimeout(function () { toast.update(function (t) { return Object.assign({}, t, { open: false }); }); }, ms);
}

function lookupCountry(url) {
  const ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = setTimeout(function () { if (ctl) ctl.abort(); }, 3500);
  return fetch(url, ctl ? { signal: ctl.signal } : {}).then(function (r) { return r.json(); }).then(function (d) {
    clearTimeout(timer);
    const c = String((d && (d.country_code || d.country)) || "").toUpperCase();
    return c.length === 2 ? c : "";
  }).catch(function () { clearTimeout(timer); return ""; });
}

// Region: an instant answer from the time zone, then the IP lookup (ipapi.co, then ipwho.is) replaces it.
export function detectRegion() {
  let cached = null;
  try { cached = JSON.parse(window.localStorage.getItem("cr_geo") || "null"); } catch (e) {}
  if (cached && cached.c && Date.now() - cached.t < 7 * 24 * 3600 * 1000) {
    country.set(cached.c);
    region.set(ASIA_COUNTRIES.indexOf(cached.c) !== -1 ? "asia" : "global");
    return;
  }
  let tz = "";
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) {}
  region.set(ASIA_TIMEZONES.indexOf(tz) !== -1 ? "asia" : "global");
  lookupCountry("https://ipapi.co/json/").then(function (c) { return c || lookupCountry("https://ipwho.is/"); }).then(function (c) {
    if (!c) return;
    country.set(c);
    region.set(ASIA_COUNTRIES.indexOf(c) !== -1 ? "asia" : "global");
    try { window.localStorage.setItem("cr_geo", JSON.stringify({ c: c, t: Date.now() })); } catch (e) {}
  });
}

export function checkoutUrl(planId, reg) {
  const set = reg === "asia" ? WHOP.asia : WHOP.global;
  return (planId === "pro_month" ? set.month : set.year).url;
}

export async function startCheckout(planId) {
  if (!currentUser) { openAuth("login", "Log in first so Pro is added to your account."); return; }
  try { window.localStorage.setItem(CHECKOUT_FLAG, String(Date.now())); } catch (e) {}
  // make sure the referral code is attached to this account before the payment happens
  try { await Promise.race([claimReferral(currentUser), new Promise(function (res) { setTimeout(res, 1500); })]); } catch (e) {}
  window.location.href = checkoutUrl(planId, get(region));
}

function hasPendingCheckout() {
  try {
    const t = Number(window.localStorage.getItem(CHECKOUT_FLAG)) || 0;
    if (t && Date.now() - t > 48 * 3600 * 1000) { window.localStorage.removeItem(CHECKOUT_FLAG); return false; }
    return !!t;
  } catch (e) { return false; }
}

// The return link from Whop only tells us the buyer came back. It unlocks nothing by itself.
function handleCheckoutReturn() {
  try {
    if (!/[?&](whop_vip_unlock|paid)=/.test(window.location.search || "")) return;
    returnedFromWhop = true;
    if (!window.localStorage.getItem(CHECKOUT_FLAG)) window.localStorage.setItem(CHECKOUT_FLAG, String(Date.now() - 2 * 3600 * 1000));
    window.history.replaceState({}, document.title, window.location.pathname);
  } catch (e) {}
}

// Asks our server whether Whop confirmed a payment for this account. loud = show progress and keep checking for about a minute.
export async function verifyCheckout(loud) {
  if (verifying || !get(user)) return;
  verifying = true;
  let since = 0;
  try { since = Number(window.localStorage.getItem(CHECKOUT_FLAG)) || 0; } catch (e) {}
  if (!since) since = Date.now() - 2 * 3600 * 1000;
  if (loud) showToast("Verifying your payment...", 0, false);
  try {
    for (let i = 0; i < (loud ? 12 : 1); i++) {
      if (!get(user)) break;
      const r = await fetch("/api/whop-claim", { method: "POST", headers: await authHeaders(), body: JSON.stringify({ since: since - 10 * 60 * 1000 }) });
      const d = await readJson(r);
      if (r.ok && d.confirmed > 0) {
        try { window.localStorage.removeItem(CHECKOUT_FLAG); } catch (e) {}
        await refreshProfile(get(user).id);
        payModal.update(function (m) { return Object.assign({}, m, { open: false }); });
        showToast("🎉 Welcome to ClauseRadar Pro! Unlimited Scans Unlocked", 8000, true);
        return;
      }
      if (!r.ok) { if (loud) showToast(d.error || "Could not check your payment right now.", 8000, false); return; }
      if (loud && i < 11) await new Promise(function (res) { setTimeout(res, 5000); });
    }
    if (loud) showToast("We have not received the payment confirmation yet. It can take a minute. Use the same email as your ClauseRadar account at checkout. If you were charged and Pro does not appear, contact support and we will activate it.", 14000, false);
  } catch (e) {
    if (loud) showToast("Could not check your payment right now. Please try again in a minute.", 8000, false);
  } finally {
    verifying = false;
  }
}

export function planLabel(pro) {
  return pro ? "Pro" : "Free";
}

export function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
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


/* ---------- Contract Memory: projects and invoices (Supabase, row-level security) ---------- */
export const projects = writable([]);
export const invoices = writable([]);
export const activeProject = writable("");
export const memoryError = writable("");

const SCHEMA_HELP = "Please ensure supabase-v3.sql was executed in Supabase SQL editor.";

function isSchemaError(e) {
  const code = String((e && e.code) || "");
  const m = String((e && e.message) || e || "");
  return code === "PGRST205" || code === "PGRST204" || code === "42P01" || m.indexOf("schema cache") !== -1 || m.indexOf("does not exist") !== -1 || m.indexOf("Could not find the table") !== -1;
}

function friendly(e) {
  const m = String((e && e.message) || e || "");
  if (m.indexOf("FREE_LIMIT_PROJECTS") !== -1) return new Error("The Free plan allows 1 active project. Upgrade to Pro for unlimited projects.");
  if (m.indexOf("FREE_LIMIT_INVOICES") !== -1) return new Error("The Free plan allows 1 active invoice. Mark it paid or upgrade to Pro for unlimited invoices.");
  if (isSchemaError(e)) return new Error(SCHEMA_HELP);
  return new Error(m || "Database error. Please try again.");
}

function need() {
  if (!sb) throw new Error("Login is not configured yet.");
  const u = get(user);
  if (!u) throw new Error("Please log in first.");
  return u;
}

export async function loadProjects() {
  if (!sb || !get(user)) return;
  const r = await sb.from("projects").select("*").order("created_at", { ascending: false });
  if (r.error) { memoryError.set(friendly(r.error).message); return; }
  memoryError.set("");
  projects.set(r.data || []);
}

export async function saveProject(rec) {
  const u = need();
  const r = await sb.from("projects").insert(Object.assign({}, rec, { user_id: u.id })).select().single();
  if (r.error) throw friendly(r.error);
  projects.update(function (list) { return [r.data].concat(list.filter(function (p) { return p.id !== r.data.id; })); });
  activeProject.set(r.data.id);
  memoryError.set("");
  loadProjects();
  return r.data;
}

export async function updateProject(id, patch) {
  need();
  const r = await sb.from("projects").update(patch).eq("id", id);
  if (r.error) throw friendly(r.error);
  await loadProjects();
}

export async function deleteProject(id) {
  need();
  const r = await sb.from("projects").delete().eq("id", id);
  if (r.error) throw friendly(r.error);
  await loadProjects();
}

export async function loadInvoices() {
  if (!sb || !get(user)) return;
  const r = await sb.from("invoices").select("*").order("due_date", { ascending: true });
  if (r.error) { memoryError.set(friendly(r.error).message); return; }
  invoices.set(r.data || []);
}

export async function saveInvoice(rec) {
  const u = need();
  const r = await sb.from("invoices").insert(Object.assign({}, rec, { user_id: u.id }));
  if (r.error) throw friendly(r.error);
  await loadInvoices();
}

export async function markInvoicePaid(id, dateIso) {
  need();
  const r = await sb.from("invoices").update({ paid_at: dateIso }).eq("id", id);
  if (r.error) throw friendly(r.error);
  await loadInvoices();
}

export async function deleteInvoice(id) {
  need();
  const r = await sb.from("invoices").delete().eq("id", id);
  if (r.error) throw friendly(r.error);
  await loadInvoices();
}

export async function scopeUsage() {
  if (!sb || !get(user)) return null;
  const d = new Date();
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
  const r = await sb.from("scope_checks").select("id", { count: "exact", head: true }).gte("created_at", start);
  return r.error ? null : r.count || 0;
}

/* ---------- Referral program (30% commission) ---------- */
export const MIN_PAYOUT = 5;
export const referrals = writable([]);
export const payouts = writable([]);
export const refError = writable("");
const REF_SCHEMA_HELP = "Please ensure supabase-v4-referrals.sql was executed in Supabase SQL editor.";

export function captureRef() {
  try {
    const m = String(window.location.search || "").match(/[?&]ref=([A-Za-z0-9]{4,16})/);
    if (m) window.localStorage.setItem("cr_ref", m[1].toLowerCase());
  } catch (e) {}
}

export function getRef() {
  try { return window.localStorage.getItem("cr_ref") || ""; } catch (e) { return ""; }
}

export function referralLink(code) {
  return SITE + "/?ref=" + code;
}

export async function claimReferral(u) {
  const code = getRef();
  if (!sb || !u || !code) return;
  const key = "cr_ref_claimed_" + u.id;
  try { if (window.localStorage.getItem(key) === code) return; } catch (e) {}
  try {
    const r = await sb.rpc("claim_referral", { p_code: code });
    if (!r.error) window.localStorage.setItem(key, code);
  } catch (e) {}
}

function refFriendly(e) {
  const code = String((e && e.code) || "");
  const m = String((e && e.message) || e || "");
  if (m.indexOf("INVALID_UPI") !== -1) return new Error("Enter a valid UPI ID, like name@bank.");
  if (m.indexOf("INVALID_TRC20") !== -1) return new Error("That is not a valid TRON (TRC20) address. It starts with T and has 34 characters.");
  if (m.indexOf("INVALID_METHOD") !== -1) return new Error("Choose UPI or USDT (TRC20).");
  if (m.indexOf("MIN_PAYOUT") !== -1) return new Error("The minimum payout is $" + MIN_PAYOUT + ".");
  if (m.indexOf("INSUFFICIENT_BALANCE") !== -1) return new Error("You do not have enough balance.");
  if (m.indexOf("PENDING_EXISTS") !== -1) return new Error("You already have a pending payout. Wait for it to be approved.");
  if (code === "PGRST205" || code === "PGRST202" || code === "42P01" || m.indexOf("schema cache") !== -1 || m.indexOf("does not exist") !== -1 || m.indexOf("Could not find") !== -1) return new Error(REF_SCHEMA_HELP);
  return new Error(m || "Something went wrong. Please try again.");
}

export async function loadReferralData() {
  const u = get(user);
  if (!sb || !u) return;
  const a = await sb.from("referrals").select("*").order("created_at", { ascending: false });
  const b = await sb.from("payout_requests").select("*").order("created_at", { ascending: false });
  const err = a.error || b.error;
  if (err) { refError.set(refFriendly(err).message); return; }
  refError.set("");
  referrals.set(a.data || []);
  payouts.set(b.data || []);
  await refreshProfile(u.id);
}

// TRON addresses are base58check: 1 version byte (0x41) + 20 bytes + a 4-byte double-SHA256 checksum. This catches typos before money is sent.
export async function isValidTron(addr) {
  const a = String(addr || "");
  if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(a)) return false;
  try {
    const ALPHA = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    let n = BigInt(0);
    for (let i = 0; i < a.length; i++) n = n * BigInt(58) + BigInt(ALPHA.indexOf(a[i]));
    const hex = n.toString(16).padStart(50, "0");
    if (hex.length !== 50) return false;
    const bytes = new Uint8Array(25);
    for (let i = 0; i < 25; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    const h1 = await crypto.subtle.digest("SHA-256", bytes.slice(0, 21));
    const h2 = new Uint8Array(await crypto.subtle.digest("SHA-256", h1));
    return bytes[0] === 65 && h2[0] === bytes[21] && h2[1] === bytes[22] && h2[2] === bytes[23] && h2[3] === bytes[24];
  } catch (e) {
    return true;
  }
}

export async function requestPayout(method, address) {
  if (!sb || !get(user)) throw new Error("Please log in first.");
  const a = String(address || "").trim();
  if (method === "usdt_trc20" && !(await isValidTron(a))) throw new Error("That does not look like a valid TRON (TRC20) address. Copy it again from your wallet and make sure the network is TRON (TRC20).");
  const r = await sb.rpc("request_payout", { p_method: method, p_address: a });
  if (r.error) throw refFriendly(r.error);
  await loadReferralData();
  return r.data;
}
