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
