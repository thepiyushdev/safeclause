import { writable, derived, get } from "svelte/store";
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
export const profile = writable({ pro_until: null, pro_plan: null, ref_code: null, wallet_balance: 0, loaded: false });
export const isPro = derived(profile, function (p) { return !!(p.pro_until && new Date(p.pro_until).getTime() > Date.now()); });
export const deviceState = writable({ blocked: false, revoked: false, devices: [], limit: 1, plan: "free", loaded: false });
export const authModal = writable({ open: false, mode: "login", note: "" });
export const payModal = writable({ open: false, planId: "pro_year" });
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

export async function refreshProfile(uid) {
  if (!sb) return;
  try {
    let r = await sb.from("profiles").select("pro_until,pro_plan,ref_code,wallet_balance").eq("id", uid).maybeSingle();
    if (r.error) r = await sb.from("profiles").select("pro_until,pro_plan").eq("id", uid).maybeSingle();
    const d = r.error ? {} : r.data || {};
    profile.set({ pro_until: d.pro_until || null, pro_plan: d.pro_plan || null, ref_code: d.ref_code || null, wallet_balance: Number(d.wallet_balance) || 0, loaded: true });
  } catch (e) {}
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
  captureRef();
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
      syncDevice("register");
      beat = setInterval(function () { if (document.visibilityState === "visible") syncDevice("register"); }, 4 * 60 * 1000);
    } else {
      profile.set({ pro_until: null, pro_plan: null, ref_code: null, wallet_balance: 0, loaded: false });
      deviceState.set({ blocked: false, revoked: false, devices: [], limit: 1, plan: "free", loaded: false });
    }
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
export const MIN_PAYOUT = 100;
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
  if (m.indexOf("MIN_PAYOUT") !== -1) return new Error("The minimum payout is ₹" + MIN_PAYOUT + ".");
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

export async function requestPayout(upi) {
  if (!sb || !get(user)) throw new Error("Please log in first.");
  const r = await sb.rpc("request_payout", { p_upi: String(upi || "").trim() });
  if (r.error) throw refFriendly(r.error);
  await loadReferralData();
  return r.data;
}
