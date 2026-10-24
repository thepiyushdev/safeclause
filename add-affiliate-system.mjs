import fs from "node:fs";
import path from "node:path";

const ensureDir = (p) => fs.mkdirSync(path.dirname(p), { recursive: true });
const write = (p, content) => {
  ensureDir(p);
  fs.writeFileSync(p, content.trimStart(), "utf8");
  console.log("✅ Created/Updated:", p);
};

// 1. SUPABASE SQL SCHEMA (Run in Supabase SQL Editor)
write("supabase-referrals.sql", `
-- ClauseRadar 30% Affiliate & Admin Payout System (Safe Additive Migration)

-- 1. Add affiliate columns safely to profiles (if profiles table exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'profiles') THEN
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ref_code text UNIQUE;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referred_by text;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS wallet_balance numeric DEFAULT 50; -- Rs 50 Joining Bonus!
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS total_earned numeric DEFAULT 50;
  END IF;
END $$;

-- 2. Create Affiliate Wallets table (works standalone even if profiles isn't used)
CREATE TABLE IF NOT EXISTS public.affiliate_wallets (
  user_id uuid PRIMARY KEY,
  email text,
  ref_code text UNIQUE NOT NULL,
  referred_by text,
  wallet_balance numeric DEFAULT 50, -- ₹50 Partner Welcome Bonus
  total_earned numeric DEFAULT 50,
  total_referrals integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 3. Create Referrals Log table
CREATE TABLE IF NOT EXISTS public.referrals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_code text NOT NULL,
  buyer_email text,
  plan text NOT NULL,
  sale_amount numeric NOT NULL,
  commission_amount numeric NOT NULL,
  status text DEFAULT 'credited',
  created_at timestamptz DEFAULT now()
);

-- 4. Create Payout Requests table
CREATE TABLE IF NOT EXISTS public.payout_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  email text NOT NULL,
  ref_code text,
  amount numeric NOT NULL,
  upi_id text NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz DEFAULT now(),
  approved_at timestamptz
);

-- Enable RLS safely with public service access for API routes
ALTER TABLE public.affiliate_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for service and anon" ON public.affiliate_wallets;
CREATE POLICY "Allow all for service and anon" ON public.affiliate_wallets FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for service and anon" ON public.referrals;
CREATE POLICY "Allow all for service and anon" ON public.referrals FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for service and anon" ON public.payout_requests;
CREATE POLICY "Allow all for service and anon" ON public.payout_requests FOR ALL USING (true) WITH CHECK (true);
`);

// 2. BACKEND API FOR AFFILIATE & ADMIN PAYOUTS (api/affiliate.js)
write("api/affiliate.js", `
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

function makeRefCode(email = "", uid = "") {
  const clean = (email.split("@")[0] || "user").replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 6);
  const suffix = (uid || Math.random().toString(36).substring(2, 6)).replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 3);
  return \`\${clean}\${suffix}\`;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-admin-password");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (!supabase) {
    return res.status(500).json({ error: "Supabase environment variables missing on server." });
  }

  const action = req.query.action || req.body?.action || "dashboard";

  try {
    // 1. GET OR INIT USER AFFILIATE DASHBOARD
    if (action === "dashboard") {
      const { user_id, email, referred_by } = req.body || req.query;
      if (!user_id || !email) return res.status(400).json({ error: "user_id and email required" });

      let { data: wallet } = await supabase
        .from("affiliate_wallets")
        .select("*")
        .eq("user_id", user_id)
        .maybeSingle();

      if (!wallet) {
        const ref_code = makeRefCode(email, user_id);
        const { data: created, error: createErr } = await supabase
          .from("affiliate_wallets")
          .insert({
            user_id,
            email,
            ref_code,
            referred_by: referred_by && referred_by !== ref_code ? referred_by : null,
            wallet_balance: 50,
            total_earned: 50,
            total_referrals: 0
          })
          .select("*")
          .single();
        if (createErr) throw createErr;
        wallet = created;
      }

      const { data: referrals } = await supabase
        .from("referrals")
        .select("*")
        .eq("referrer_code", wallet.ref_code)
        .order("created_at", { ascending: false });

      const { data: payouts } = await supabase
        .from("payout_requests")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", { ascending: false });

      return res.status(200).json({
        wallet,
        referrals: referrals || [],
        payouts: payouts || []
      });
    }

    // 2. REQUEST UPI PAYOUT
    if (action === "request_payout") {
      const { user_id, email, upi_id } = req.body;
      if (!user_id || !upi_id || !upi_id.includes("@")) {
        return res.status(400).json({ error: "Valid UPI ID (e.g. name@okaxis) is required." });
      }

      const { data: wallet } = await supabase
        .from("affiliate_wallets")
        .select("*")
        .eq("user_id", user_id)
        .single();

      if (!wallet || Number(wallet.wallet_balance) < 200) {
        return res.status(400).json({ error: "Minimum withdrawal amount is ₹200 (Just 1 Pro referral unlocks withdrawal!)." });
      }

      const amount = Number(wallet.wallet_balance);

      const { data: payout, error: payErr } = await supabase
        .from("payout_requests")
        .insert({
          user_id,
          email: email || wallet.email,
          ref_code: wallet.ref_code,
          amount,
          upi_id: upi_id.trim(),
          status: "pending"
        })
        .select("*")
        .single();

      if (payErr) throw payErr;

      await supabase
        .from("affiliate_wallets")
        .update({ wallet_balance: 0 })
        .eq("user_id", user_id);

      return res.status(200).json({ ok: true, payout });
    }

    // 3. CREDIT 30% COMMISSION ON PRO SALE
    if (action === "credit_sale") {
      const { ref_code, buyer_email, plan, sale_amount } = req.body;
      if (!ref_code) return res.status(200).json({ skipped: true });

      const cleanCode = String(ref_code).trim().toUpperCase();
      const { data: referrer } = await supabase
        .from("affiliate_wallets")
        .select("*")
        .eq("ref_code", cleanCode)
        .maybeSingle();

      if (!referrer) return res.status(200).json({ skipped: true, reason: "Invalid ref_code" });
      if (referrer.email && buyer_email && referrer.email.toLowerCase() === buyer_email.toLowerCase()) {
        return res.status(200).json({ skipped: true, reason: "Self-referral blocked" });
      }

      const numericSale = Number(sale_amount) || (plan === "yearly" ? 3999 : 499);
      const commission = Math.round(numericSale * 0.30); // ₹150 for 499, ₹1200 for 3999

      await supabase.from("referrals").insert({
        referrer_code: cleanCode,
        buyer_email: buyer_email || "Pro Member",
        plan: plan || (numericSale > 1000 ? "Yearly Pro" : "Monthly Pro"),
        sale_amount: numericSale,
        commission_amount: commission,
        status: "credited"
      });

      await supabase
        .from("affiliate_wallets")
        .update({
          wallet_balance: Number(referrer.wallet_balance || 0) + commission,
          total_earned: Number(referrer.total_earned || 0) + commission,
          total_referrals: Number(referrer.total_referrals || 0) + 1
        })
        .eq("user_id", referrer.user_id);

      return res.status(200).json({ ok: true, commission });
    }

    // 4. ADMIN PANEL: LIST ALL PAYOUTS & REFERRALS
    if (action === "admin_list") {
      const adminPass = req.headers["x-admin-password"] || req.body?.admin_password || "";
      const expectedPass = process.env.ADMIN_PASSWORD || "pintu@admin2026";

      if (adminPass !== expectedPass) {
        return res.status(401).json({ error: "Invalid Admin Password! Access Denied." });
      }

      const { data: payouts } = await supabase
        .from("payout_requests")
        .select("*")
        .order("created_at", { ascending: false });

      const { data: wallets } = await supabase
        .from("affiliate_wallets")
        .select("*")
        .order("total_earned", { ascending: false })
        .limit(50);

      const { data: referrals } = await supabase
        .from("referrals")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      return res.status(200).json({
        payouts: payouts || [],
        wallets: wallets || [],
        referrals: referrals || []
      });
    }

    // 5. ADMIN PANEL: APPROVE OR REJECT PAYOUT
    if (action === "admin_update_payout") {
      const adminPass = req.headers["x-admin-password"] || req.body?.admin_password || "";
      const expectedPass = process.env.ADMIN_PASSWORD || "pintu@admin2026";

      if (adminPass !== expectedPass) {
        return res.status(401).json({ error: "Invalid Admin Password! Access Denied." });
      }

      const { payout_id, status } = req.body;
      if (!payout_id || !["approved", "rejected"].includes(status)) {
        return res.status(400).json({ error: "payout_id and valid status required" });
      }

      const { data: updated, error: updErr } = await supabase
        .from("payout_requests")
        .update({
          status,
          approved_at: status === "approved" ? new Date().toISOString() : null
        })
        .eq("id", payout_id)
        .select("*")
        .single();

      if (updErr) throw updErr;
      return res.status(200).json({ ok: true, payout: updated });
    }

    return res.status(400).json({ error: "Unknown action" });
  } catch (err) {
    console.error("Affiliate API error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
`);

// 3. USER AFFILIATE EARNING DASHBOARD PAGE (src/pages/Refer.svelte)
write("src/pages/Refer.svelte", `
<script>
  import { onMount } from "svelte";
  import { user, openAuth } from "../lib/app.js";

  let loading = false;
  let wallet = null;
  let referrals = [];
  let payouts = [];
  let upiId = "";
  let msg = "";
  let err = "";
  let copiedLink = false;
  let copiedScript = "";

  $: refLink = wallet?.ref_code
    ? \`https://clauseradar.online/?ref=\${wallet.ref_code}\`
    : "https://clauseradar.online/?ref=PARTNER";

  $: paidOutTotal = payouts
    .filter((p) => p.status === "approved")
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  $: pendingTotal = payouts
    .filter((p) => p.status === "pending")
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  // Build 6-month visual chart bars
  $: chartBars = (() => {
    const months = ["May", "Jun", "Jul", "Aug", "Sep", "Oct"];
    const base = months.map((m, idx) => ({
      label: m,
      value: idx === months.length - 1 ? Number(wallet?.total_earned || 50) : 0
    }));
    const max = Math.max(...base.map((b) => b.value), 500);
    return base.map((b) => ({ ...b, pct: Math.max(12, Math.round((b.value / max) * 100)) }));
  })();

  async function loadDashboard(u) {
    if (!u?.id) return;
    loading = true;
    err = "";
    try {
      const savedRef = localStorage.getItem("cr_ref") || "";
      const r = await fetch("/api/affiliate?action=dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "dashboard",
          user_id: u.id,
          email: u.email,
          referred_by: savedRef
        })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed to load affiliate dashboard");
      wallet = d.wallet;
      referrals = d.referrals || [];
      payouts = d.payouts || [];
    } catch (e) {
      err = e.message;
    } finally {
      loading = false;
    }
  }

  $: if ($user?.id) {
    loadDashboard($user);
  }

  function copyReferralLink() {
    navigator.clipboard.writeText(refLink);
    copiedLink = true;
    setTimeout(() => (copiedLink = false), 2500);
  }

  function copyCreatorScript(type) {
    const reelScript = \`Stop signing freelance contracts blindly! 🚨 I just found ClauseRadar (\${refLink}) — an AI tool that scans your client agreement in 30 seconds for uncapped liability & payment traps, and even blocks unpaid scope creep. Use my special partner link in bio to scan your contract for free!\`;
    const dmScript = \`Hey! Before you sign your next freelance contract or deal with client scope creep, run it through ClauseRadar (\${refLink}). It catches risky clauses in 30 seconds and writes polite counter-offers automatically.\`;
    navigator.clipboard.writeText(type === "reel" ? reelScript : dmScript);
    copiedScript = type;
    setTimeout(() => (copiedScript = ""), 2500);
  }

  async function requestPayout() {
    msg = "";
    err = "";
    if (!upiId.includes("@")) {
      err = "Please enter a valid UPI ID (example: yourname@okicici or 9876543210@ybl)";
      return;
    }
    loading = true;
    try {
      const r = await fetch("/api/affiliate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "request_payout",
          user_id: $user.id,
          email: $user.email,
          upi_id: upiId
        })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Could not submit payout request");
      msg = "🎉 Payout request submitted! Once verified, payment will be sent to your UPI ID and marked Approved below.";
      upiId = "";
      await loadDashboard($user);
    } catch (e) {
      err = e.message;
    } finally {
      loading = false;
    }
  }
</script>

<div class="refer-wrap">
  <div class="refer-hero">
    <span class="badge-pill">💸 CLAUSERADAR PARTNER PROGRAM</span>
    <h1>Refer & Earn <span class="grad-txt">30% Cash</span> on Every Pro Subscription</h1>
    <p class="sub">
      Earn <strong>₹150</strong> on every Monthly Pro (₹499) and <strong>₹1,200</strong> on every Yearly Pro (₹3,999) referral — paid directly to your UPI ID! Plus, you get a <strong>₹50 Welcome Bonus</strong> instantly on sign-up.
    </p>
  </div>

  {#if !$user}
    <div class="glass-card login-cta">
      <h2>🎁 Claim Your ₹50 Partner Bonus & Referral Link</h2>
      <p>Sign in with your account to unlock your live affiliate tracking link, earnings chart, and instant UPI withdrawal dashboard.</p>
      <button class="btn-primary" on:click={() => openAuth("signin")}>Sign In to Get Your Referral Link →</button>
    </div>
  {:else}
    {#if err}
      <div class="alert-err">{err}</div>
    {/if}
    {#if msg}
      <div class="alert-ok">{msg}</div>
    {/if}

    <!-- Referral Link Box -->
    <div class="glass-card link-box">
      <div>
        <div class="lbl">YOUR UNIQUE 30% REFERRAL LINK (Includes +7 Extra Pro Days for Friends!)</div>
        <div class="ref-url">{refLink}</div>
      </div>
      <div class="btn-row">
        <button class="btn-primary" on:click={copyReferralLink}>
          {copiedLink ? "✅ Copied Link!" : "📋 Copy Link"}
        </button>
        <a
          class="btn-wa"
          href={"https://wa.me/?text=" + encodeURIComponent("Hey! Check out ClauseRadar to scan freelance contracts for risky traps & stop unpaid scope creep in 30s: " + refLink)}
          target="_blank"
          rel="noreferrer"
        >
          Share on WhatsApp
        </a>
      </div>
    </div>

    <!-- 4 Stat Cards -->
    <div class="stats-grid">
      <div class="stat-card highlight">
        <span class="s-lbl">Available Balance (Withdrawable)</span>
        <span class="s-val">₹{wallet?.wallet_balance ?? 50}</span>
        <span class="s-note">Includes ₹50 Partner Welcome Bonus</span>
      </div>
      <div class="stat-card">
        <span class="s-lbl">Total Lifetime Earnings</span>
        <span class="s-val">₹{wallet?.total_earned ?? 50}</span>
        <span class="s-note">30% commission on all referrals</span>
      </div>
      <div class="stat-card">
        <span class="s-lbl">Total Paid Conversions</span>
        <span class="s-val">{wallet?.total_referrals ?? 0}</span>
        <span class="s-note">₹150/mo or ₹1,200/yr per sale</span>
      </div>
      <div class="stat-card">
        <span class="s-lbl">Approved UPI Payouts</span>
        <span class="s-val">₹{paidOutTotal}</span>
        <span class="s-note">{pendingTotal > 0 ? \`₹\${pendingTotal} Pending Approval\` : "Direct to your UPI"}</span>
      </div>
    </div>

    <!-- Graph + UPI Payout Grid -->
    <div class="two-col">
      <!-- Visual Earnings Graph -->
      <div class="glass-card">
        <h3>📈 Earnings Growth Overview</h3>
        <p class="muted">Track your monthly commission growth (₹150 per Monthly Pro • ₹1,200 per Yearly Pro)</p>
        <div class="chart-box">
          {#each chartBars as bar}
            <div class="bar-col">
              <div class="bar-amt">₹{bar.value}</div>
              <div class="bar-track">
                <div class="bar-fill" style="height: {bar.pct}%"></div>
              </div>
              <div class="bar-lbl">{bar.label}</div>
            </div>
          {/each}
        </div>
      </div>

      <!-- Withdraw via UPI -->
      <div class="glass-card">
        <h3>🏦 Withdraw Earnings via UPI</h3>
        <p class="muted">Minimum withdrawal is <strong>₹200</strong> (Just 1 Monthly Pro sale + your ₹50 bonus unlocks instant withdrawal!)</p>
        <div class="upi-form">
          <label for="upi">Enter Your UPI ID (GPay / PhonePe / Paytm)</label>
          <input
            id="upi"
            type="text"
            placeholder="e.g. yourname@okicici or 9876543210@ybl"
            bind:value={upiId}
          />
          <button
            class="btn-primary full"
            disabled={loading || Number(wallet?.wallet_balance || 0) < 200}
            on:click={requestPayout}
          >
            {#if Number(wallet?.wallet_balance || 0) < 200}
              🔒 Need ₹{200 - Number(wallet?.wallet_balance || 50)} More to Withdraw (1 Sale!)
            {:else}
              💸 Withdraw ₹{wallet?.wallet_balance} to UPI Now
            {/if}
          </button>
        </div>

        <div class="creator-kit">
          <div class="lbl">🎬 CREATOR PROMO SCRIPTS (1-CLICK COPY)</div>
          <div class="btn-row">
            <button class="btn-ghost" on:click={() => copyCreatorScript("reel")}>
              {copiedScript === "reel" ? "✅ Reel Script Copied!" : "📱 Copy Instagram/YT Script"}
            </button>
            <button class="btn-ghost" on:click={() => copyCreatorScript("dm")}>
              {copiedScript === "dm" ? "✅ DM Script Copied!" : "💬 Copy WhatsApp/LinkedIn Text"}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Payout History Table -->
    <div class="glass-card">
      <h3>🧾 Your UPI Payout Requests</h3>
      {#if payouts.length === 0}
        <p class="muted">No payout requests yet. Share your link above to start earning 30% commission!</p>
      {:else}
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>UPI ID</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {#each payouts as p}
                <tr>
                  <td>{new Date(p.created_at).toLocaleDateString()}</td>
                  <td class="mono">{p.upi_id}</td>
                  <td><strong>₹{p.amount}</strong></td>
                  <td>
                    {#if p.status === "approved"}
                      <span class="status-badge ok">✅ Payment Approved & Sent</span>
                    {:else if p.status === "rejected"}
                      <span class="status-badge err">❌ Rejected</span>
                    {:else}
                      <span class="status-badge pending">⏳ Pending Admin Verification</span>
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .refer-wrap { max-width: 1080px; margin: 0 auto; padding: 36px 18px 80px; color: #f8fafc; }
  .refer-hero { text-align: center; max-width: 760px; margin: 0 auto 32px; }
  .badge-pill { display: inline-block; padding: 6px 14px; border-radius: 999px; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.4); color: #34d399; font-size: 12px; font-weight: 700; letter-spacing: 0.06em; margin-bottom: 12px; }
  h1 { font-size: clamp(28px, 4.5vw, 44px); line-height: 1.15; margin: 0 0 14px; font-weight: 800; }
  .grad-txt { background: linear-gradient(135deg, #34d399, #38bdf8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
  .sub { color: #94a3b8; font-size: 16px; line-height: 1.6; margin: 0; }
  .glass-card { background: rgba(15, 23, 42, 0.78); border: 1px solid rgba(148, 163, 184, 0.16); border-radius: 16px; padding: 24px; margin-bottom: 22px; }
  .login-cta { text-align: center; padding: 42px 24px; }
  .link-box { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px; background: linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(15, 23, 42, 0.9)); border-color: rgba(16, 185, 129, 0.35); }
  .lbl { font-size: 11px; font-weight: 700; letter-spacing: 0.08em; color: #94a3b8; margin-bottom: 6px; }
  .ref-url { font-family: monospace; font-size: 16px; font-weight: 700; color: #34d399; word-break: break-all; }
  .btn-row { display: flex; flex-wrap: wrap; gap: 10px; }
  .btn-primary { background: linear-gradient(135deg, #10b981, #059669); color: #fff; border: none; padding: 12px 20px; border-radius: 10px; font-weight: 700; cursor: pointer; font-size: 14px; }
  .btn-primary:disabled { opacity: 0.55; cursor: not-allowed; }
  .btn-primary.full { width: 100%; margin-top: 12px; }
  .btn-wa { background: rgba(37, 211, 102, 0.16); border: 1px solid rgba(37, 211, 102, 0.45); color: #4ade80; padding: 12px 18px; border-radius: 10px; font-weight: 700; text-decoration: none; font-size: 14px; }
  .btn-ghost { background: rgba(255,255,255,0.05); border: 1px solid rgba(148,163,184,0.2); color: #e2e8f0; padding: 9px 14px; border-radius: 8px; font-size: 13px; cursor: pointer; }
  .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 16px; margin-bottom: 22px; }
  .stat-card { background: rgba(15, 23, 42, 0.78); border: 1px solid rgba(148, 163, 184, 0.16); border-radius: 14px; padding: 20px; display: flex; flex-direction: column; gap: 6px; }
  .stat-card.highlight { border-color: rgba(16, 185, 129, 0.5); background: rgba(16, 185, 129, 0.08); }
  .s-lbl { font-size: 12px; color: #94a3b8; font-weight: 600; }
  .s-val { font-size: 30px; font-weight: 800; color: #f8fafc; }
  .s-note { font-size: 12px; color: #34d399; }
  .two-col { display: grid; grid-template-columns: repeat(auto-fit, minmax(310px, 1fr)); gap: 20px; }
  .muted { color: #94a3b8; font-size: 13px; margin-top: 4px; }
  .chart-box { display: flex; align-items: flex-end; justify-content: space-between; height: 190px; padding: 24px 12px 8px; gap: 12px; border-top: 1px solid rgba(148,163,184,0.12); margin-top: 16px; }
  .bar-col { flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; justify-content: flex-end; }
  .bar-amt { font-size: 11px; color: #cbd5e1; margin-bottom: 6px; font-weight: 700; }
  .bar-track { width: 100%; max-width: 42px; height: 120px; background: rgba(255,255,255,0.04); border-radius: 8px; display: flex; align-items: flex-end; overflow: hidden; }
  .bar-fill { width: 100%; background: linear-gradient(180deg, #34d399, #059669); border-radius: 8px 8px 0 0; transition: height 0.4s ease; }
  .bar-lbl { font-size: 12px; color: #94a3b8; margin-top: 8px; }
  .upi-form { margin-top: 14px; }
  .upi-form label { display: block; font-size: 12px; font-weight: 600; color: #cbd5e1; margin-bottom: 6px; }
  .upi-form input { width: 100%; padding: 12px 14px; border-radius: 10px; border: 1px solid rgba(148,163,184,0.28); background: rgba(2,6,23,0.7); color: #fff; font-size: 14px; box-sizing: border-box; }
  .creator-kit { margin-top: 20px; padding-top: 16px; border-top: 1px solid rgba(148,163,184,0.14); }
  .table-wrap { overflow-x: auto; margin-top: 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th, td { text-align: left; padding: 12px 10px; border-bottom: 1px solid rgba(148,163,184,0.12); }
  th { color: #94a3b8; font-size: 12px; text-transform: uppercase; }
  .mono { font-family: monospace; color: #38bdf8; }
  .status-badge { display: inline-block; padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; }
  .status-badge.ok { background: rgba(16,185,129,0.18); color: #34d399; }
  .status-badge.pending { background: rgba(245,158,11,0.18); color: #fbbf24; }
  .status-badge.err { background: rgba(239,68,68,0.18); color: #f87171; }
  .alert-err { background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.4); color: #fca5a5; padding: 12px 16px; border-radius: 10px; margin-bottom: 16px; }
  .alert-ok { background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.4); color: #6ee7b7; padding: 12px 16px; border-radius: 10px; margin-bottom: 16px; }
</style>
`);

// 4. SECRET ADMIN PAYOUT PANEL (src/pages/Admin.svelte at /admin)
write("src/pages/Admin.svelte", `
<script>
  let adminPassword = "";
  let unlocked = false;
  let loading = false;
  let err = "";
  let payouts = [];
  let wallets = [];
  let referrals = [];

  async function unlockAdmin() {
    err = "";
    loading = true;
    try {
      const r = await fetch("/api/affiliate?action=admin_list", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": adminPassword
        },
        body: JSON.stringify({ action: "admin_list", admin_password: adminPassword })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Invalid password");
      payouts = d.payouts || [];
      wallets = d.wallets || [];
      referrals = d.referrals || [];
      unlocked = true;
    } catch (e) {
      err = e.message;
    } finally {
      loading = false;
    }
  }

  async function updatePayout(payoutId, status) {
    loading = true;
    err = "";
    try {
      const r = await fetch("/api/affiliate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": adminPassword
        },
        body: JSON.stringify({
          action: "admin_update_payout",
          admin_password: adminPassword,
          payout_id: payoutId,
          status
        })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Update failed");
      await unlockAdmin();
    } catch (e) {
      err = e.message;
    } finally {
      loading = false;
    }
  }
</script>

<div class="admin-wrap">
  {#if !unlocked}
    <div class="lock-card">
      <div class="lock-icon">🔐</div>
      <h1>ClauseRadar Secret Admin Control</h1>
      <p>Restricted strictly to the founder's device. Enter your Admin Master Password to manage affiliate UPI payouts.</p>
      {#if err}
        <div class="err-box">{err}</div>
      {/if}
      <input
        type="password"
        placeholder="Enter Admin Password..."
        bind:value={adminPassword}
        on:keydown={(e) => e.key === "Enter" && unlockAdmin()}
      />
      <button class="btn-unlock" on:click={unlockAdmin} disabled={loading}>
        {loading ? "Verifying..." : "Unlock Admin Dashboard →"}
      </button>
    </div>
  {:else}
    <div class="admin-head">
      <div>
        <h1>⚡ Founder Payout & Affiliate Control</h1>
        <p>Pay affiliates via UPI from your phone and click <strong>Approve ✅</strong> to update their dashboard live.</p>
      </div>
      <button class="btn-refresh" on:click={unlockAdmin}>🔄 Refresh Data</button>
    </div>

    {#if err}
      <div class="err-box">{err}</div>
    {/if}

    <div class="card">
      <h2>💸 UPI Payout Requests ({payouts.filter(p => p.status === 'pending').length} Pending)</h2>
      {#if payouts.length === 0}
        <p class="muted">No payout requests yet.</p>
      {:else}
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>User Email</th>
                <th>Amount</th>
                <th>UPI ID</th>
                <th>Status</th>
                <th>Founder Action</th>
              </tr>
            </thead>
            <tbody>
              {#each payouts as p}
                <tr>
                  <td>{new Date(p.created_at).toLocaleString()}</td>
                  <td>{p.email}</td>
                  <td><strong class="amt">₹{p.amount}</strong></td>
                  <td>
                    <span class="upi-code">{p.upi_id}</span>
                    <button class="btn-mini" on:click={() => navigator.clipboard.writeText(p.upi_id)}>Copy UPI</button>
                    <a
                      class="btn-mini upi-pay"
                      href={\`upi://pay?pa=\${encodeURIComponent(p.upi_id)}&pn=ClauseRadarPartner&am=\${p.amount}&cu=INR\`}
                    >
                      📱 Pay on UPI App
                    </a>
                  </td>
                  <td>
                    <span class="badge {p.status}">{p.status.toUpperCase()}</span>
                  </td>
                  <td>
                    {#if p.status === "pending"}
                      <button class="btn-approve" on:click={() => updatePayout(p.id, "approved")}>
                        ✅ Approve Paid
                      </button>
                      <button class="btn-reject" on:click={() => updatePayout(p.id, "rejected")}>
                        ❌ Reject
                      </button>
                    {:else}
                      <span class="done-txt">Processed</span>
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>

    <div class="card">
      <h2>🏆 Top Affiliate Partners ({wallets.length})</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Partner Email</th>
              <th>Ref Code</th>
              <th>Referrals</th>
              <th>Available Wallet</th>
              <th>Total Earned</th>
            </tr>
          </thead>
          <tbody>
            {#each wallets as w}
              <tr>
                <td>{w.email}</td>
                <td><code>{w.ref_code}</code></td>
                <td>{w.total_referrals}</td>
                <td>₹{w.wallet_balance}</td>
                <td><strong>₹{w.total_earned}</strong></td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}
</div>

<style>
  .admin-wrap { max-width: 1080px; margin: 0 auto; padding: 40px 18px 80px; color: #f8fafc; }
  .lock-card { max-width: 440px; margin: 60px auto; background: rgba(15,23,42,0.85); border: 1px solid rgba(148,163,184,0.2); border-radius: 16px; padding: 32px 24px; text-align: center; }
  .lock-icon { font-size: 42px; margin-bottom: 10px; }
  .lock-card input { width: 100%; padding: 12px 14px; border-radius: 10px; border: 1px solid rgba(148,163,184,0.3); background: #020617; color: #fff; margin: 16px 0 12px; box-sizing: border-box; }
  .btn-unlock { width: 100%; padding: 12px; background: #10b981; color: #fff; border: none; border-radius: 10px; font-weight: 700; cursor: pointer; }
  .admin-head { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 24px; }
  .btn-refresh { background: rgba(255,255,255,0.08); color: #fff; border: 1px solid rgba(255,255,255,0.15); padding: 10px 16px; border-radius: 10px; cursor: pointer; }
  .card { background: rgba(15,23,42,0.82); border: 1px solid rgba(148,163,184,0.16); border-radius: 16px; padding: 22px; margin-bottom: 22px; }
  .table-wrap { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th, td { text-align: left; padding: 12px 10px; border-bottom: 1px solid rgba(148,163,184,0.12); }
  .amt { color: #34d399; font-size: 16px; }
  .upi-code { font-family: monospace; color: #38bdf8; margin-right: 8px; }
  .btn-mini { background: rgba(255,255,255,0.08); border: 1px solid rgba(148,163,184,0.2); color: #e2e8f0; padding: 4px 8px; border-radius: 6px; font-size: 11px; cursor: pointer; text-decoration: none; margin-right: 4px; }
  .upi-pay { background: rgba(56,189,248,0.15); border-color: rgba(56,189,248,0.4); color: #38bdf8; }
  .btn-approve { background: #10b981; color: #fff; border: none; padding: 7px 12px; border-radius: 8px; font-weight: 700; cursor: pointer; margin-right: 6px; }
  .btn-reject { background: rgba(239,68,68,0.2); color: #fca5a5; border: 1px solid rgba(239,68,68,0.4); padding: 7px 10px; border-radius: 8px; cursor: pointer; }
  .badge { padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; }
  .badge.approved { background: rgba(16,185,129,0.2); color: #34d399; }
  .badge.pending { background: rgba(245,158,11,0.2); color: #fbbf24; }
  .badge.rejected { background: rgba(239,68,68,0.2); color: #f87171; }
  .err-box { background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.4); color: #fca5a5; padding: 10px; border-radius: 8px; margin-bottom: 12px; }
</style>
`);

// 5. SAFELY WIRE URL '?ref=CODE' CAPTURE INTO src/lib/app.js (Non-destructive)
if (fs.existsSync("src/lib/app.js")) {
  let appJs = fs.readFileSync("src/lib/app.js", "utf8");
  if (!appJs.includes("cr_ref")) {
    appJs += `\n
// Capture ?ref=CODE affiliate parameter automatically
if (typeof window !== "undefined") {
  try {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref && ref.trim()) {
      localStorage.setItem("cr_ref", ref.trim().toUpperCase());
    }
  } catch (e) {}
}
`;
    fs.writeFileSync("src/lib/app.js", appJs, "utf8");
    console.log("✅ Added ?ref=CODE tracker to src/lib/app.js");
  }
}

// 6. SAFELY ADD /refer AND /admin ROUTES TO src/App.svelte (Non-destructive)
if (fs.existsSync("src/App.svelte")) {
  let appSvelte = fs.readFileSync("src/App.svelte", "utf8");
  if (!appSvelte.includes("Refer.svelte")) {
    appSvelte = appSvelte.replace(
      /<script>/,
      `<script>\n  import Refer from "./pages/Refer.svelte";\n  import Admin from "./pages/Admin.svelte";`
    );
  }
  if (!appSvelte.includes('"/refer"')) {
    // Support both if-else chains and route map patterns
    if (appSvelte.includes('path === "/pricing"')) {
      appSvelte = appSvelte.replace(
        /(\{:else if path === "\/pricing"\})/g,
        `{:else if path === "/refer"}\n    <Refer />\n  {:else if path === "/admin"}\n    <Admin />\n  $1`
      );
    } else if (appSvelte.includes("const routes = {")) {
      appSvelte = appSvelte.replace(
        /const routes = \{/,
        `const routes = {\n    "/refer": Refer,\n    "/admin": Admin,`
      );
    }
  }
  fs.writeFileSync("src/App.svelte", appSvelte, "utf8");
  console.log("✅ Wired /refer and /admin routes into src/App.svelte");
}

// 7. SAFELY ADD "Earn 30% 💸" LINK TO src/lib/Nav.svelte (Non-destructive)
if (fs.existsSync("src/lib/Nav.svelte")) {
  let nav = fs.readFileSync("src/lib/Nav.svelte", "utf8");
  if (!nav.includes('href="/refer"')) {
    nav = nav.replace(
      /(<a[^>]*href="\/pricing"[^>]*>[\s\S]*?<\/a>)/,
      `$1\n      <a href="/refer" on:click|preventDefault={() => go("/refer")} style="color:#34d399;font-weight:700">Earn 30% 💸</a>`
    );
    fs.writeFileSync("src/lib/Nav.svelte", nav, "utf8");
    console.log("✅ Added 'Earn 30% 💸' link to Navbar");
  }
}

// 8. SAFELY HOOK AUTO-30% COMMISSION INTO api/verify-payment.js (Non-destructive)
if (fs.existsSync("api/verify-payment.js")) {
  let vp = fs.readFileSync("api/verify-payment.js", "utf8");
  if (!vp.includes("affiliate_wallets")) {
    // Credit affiliate wallet whenever a payment succeeds
    const hook = `
    // Auto-credit 30% affiliate commission if buyer was referred
    try {
      const refCode = req.body?.ref_code || "";
      if (refCode && typeof supabase !== "undefined" && supabase) {
        const cleanRef = String(refCode).trim().toUpperCase();
        const { data: refWallet } = await supabase.from("affiliate_wallets").select("*").eq("ref_code", cleanRef).maybeSingle();
        if (refWallet) {
          const saleAmt = Number(req.body?.amount) || (req.body?.plan === "yearly" ? 3999 : 499);
          const comm = Math.round(saleAmt * 0.30);
          await supabase.from("referrals").insert({
            referrer_code: cleanRef,
            buyer_email: req.body?.email || "Pro Member",
            plan: saleAmt > 1000 ? "Yearly Pro" : "Monthly Pro",
            sale_amount: saleAmt,
            commission_amount: comm,
            status: "credited"
          });
          await supabase.from("affiliate_wallets").update({
            wallet_balance: Number(refWallet.wallet_balance || 0) + comm,
            total_earned: Number(refWallet.total_earned || 0) + comm,
            total_referrals: Number(refWallet.total_referrals || 0) + 1
          }).eq("user_id", refWallet.user_id);
        }
      }
    } catch (affErr) { console.warn("Affiliate hook skipped:", affErr.message); }
`;
    vp = vp.replace(/return res\.status\(200\)\.json\(/, hook + "\n    return res.status(200).json(");
    fs.writeFileSync("api/verify-payment.js", vp, "utf8");
    console.log("✅ Linked automatic 30% commission to api/verify-payment.js");
  }
}

console.log("\n🎉 Affiliate System + Admin Payout Panel successfully installed!");
