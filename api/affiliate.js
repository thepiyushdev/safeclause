import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

function makeRefCode(email = "", uid = "") {
  const clean = (email.split("@")[0] || "user").replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 6);
  const suffix = (uid || Math.random().toString(36).substring(2, 6)).replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 3);
  return `${clean}${suffix}`;
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
