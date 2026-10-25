-- ClauseRadar v5: 30% referral / affiliate program + payout requests.
-- Run this ONCE in Supabase > SQL Editor, AFTER supabase-v3.sql. Safe to run again.

alter table public.profiles add column if not exists ref_code text unique;
alter table public.profiles add column if not exists referred_by uuid references auth.users(id) on delete set null;
alter table public.profiles add column if not exists wallet_balance numeric not null default 0 check (wallet_balance >= 0);

-- every profile gets a short unique referral code (first 8 characters of the user id)
create or replace function public.set_ref_code() returns trigger
language plpgsql as $$
begin
  if new.ref_code is null then
    new.ref_code := substr(new.id::text, 1, 8);
    if exists (select 1 from public.profiles where ref_code = new.ref_code) then
      new.ref_code := substr(replace(new.id::text, '-', ''), 1, 12);
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists trg_ref_code on public.profiles;
create trigger trg_ref_code before insert on public.profiles for each row execute function public.set_ref_code();

do $$
declare r record;
begin
  for r in select id from public.profiles where ref_code is null loop
    begin
      update public.profiles set ref_code = substr(r.id::text, 1, 8) where id = r.id;
    exception when unique_violation then
      update public.profiles set ref_code = substr(replace(r.id::text, '-', ''), 1, 12) where id = r.id;
    end;
  end loop;
end $$;

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references auth.users(id) on delete cascade,
  referred_user_id uuid not null references auth.users(id) on delete cascade,
  plan text,
  sale_amount numeric not null,
  commission_amount numeric not null,
  txn_id text,
  created_at timestamptz not null default now()
);
create index if not exists referrals_referrer_idx on public.referrals(referrer_id);
alter table public.referrals enable row level security;
drop policy if exists "referrals own select" on public.referrals;
create policy "referrals own select" on public.referrals for select using (auth.uid() = referrer_id);

create table if not exists public.payout_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text,
  amount numeric not null check (amount > 0),
  upi_id text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  approved_at timestamptz
);
create index if not exists payout_requests_user_idx on public.payout_requests(user_id);
alter table public.payout_requests enable row level security;
drop policy if exists "payouts own select" on public.payout_requests;
create policy "payouts own select" on public.payout_requests for select using (auth.uid() = user_id);

-- a logged-in user attaches the referral code they arrived with (only once, never to themselves)
create or replace function public.claim_referral(p_code text) returns boolean
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); rid uuid;
begin
  if uid is null or p_code is null then return false; end if;
  select id into rid from public.profiles where ref_code = lower(trim(p_code)) and id <> uid;
  if rid is null then return false; end if;
  insert into public.profiles(id) values (uid) on conflict do nothing;
  update public.profiles set referred_by = rid where id = uid and referred_by is null;
  return found;
end; $$;
revoke all on function public.claim_referral(text) from public, anon;
grant execute on function public.claim_referral(text) to authenticated;

-- withdraw: creates a pending request and takes the amount out of the wallet in one step
create or replace function public.request_payout(p_upi text, p_amount numeric default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); bal numeric; amt numeric; em text; rid uuid; upi text := lower(trim(coalesce(p_upi, '')));
begin
  if uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if upi !~ '^[a-z0-9._-]{2,64}@[a-z0-9]{2,32}$' then raise exception 'INVALID_UPI'; end if;
  if exists (select 1 from public.payout_requests where user_id = uid and status = 'pending') then raise exception 'PENDING_EXISTS'; end if;
  select wallet_balance into bal from public.profiles where id = uid for update;
  amt := coalesce(p_amount, bal);
  if amt is null or bal is null or amt > bal then raise exception 'INSUFFICIENT_BALANCE'; end if;
  if amt < 100 then raise exception 'MIN_PAYOUT'; end if;
  select email into em from auth.users where id = uid;
  insert into public.payout_requests(user_id, email, amount, upi_id) values (uid, em, amt, upi) returning id into rid;
  update public.profiles set wallet_balance = wallet_balance - amt where id = uid;
  return rid;
end; $$;
revoke all on function public.request_payout(text, numeric) from public, anon;
grant execute on function public.request_payout(text, numeric) to authenticated;

-- admin actions (called only by the server with the service role)
create or replace function public.admin_approve_payout(p_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  update public.payout_requests set status = 'approved', approved_at = now() where id = p_id and status = 'pending';
  return found;
end; $$;

create or replace function public.admin_reject_payout(p_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_user uuid; v_amt numeric;
begin
  update public.payout_requests set status = 'rejected', approved_at = now() where id = p_id and status = 'pending' returning user_id, amount into v_user, v_amt;
  if not found then return false; end if;
  update public.profiles set wallet_balance = wallet_balance + v_amt where id = v_user;
  return true;
end; $$;
revoke all on function public.admin_approve_payout(uuid) from public, anon, authenticated;
revoke all on function public.admin_reject_payout(uuid) from public, anon, authenticated;
grant execute on function public.admin_approve_payout(uuid) to service_role;
grant execute on function public.admin_reject_payout(uuid) to service_role;

-- Pro payment -> Pro time, plus 30% commission to the referrer. Returns the new pro_until, or null if the payment was already used.
drop function if exists public.redeem_pro(uuid, text, text, int, int, text);
create or replace function public.redeem_pro(p_user uuid, p_txn text, p_hash text, p_amount int, p_days int, p_plan text, p_ref_code text default null) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare v timestamptz; v_ref uuid; v_commission numeric;
begin
  insert into public.profiles(id) values (p_user) on conflict do nothing;
  insert into public.payments(user_id, txn_id, image_hash, amount, credits, plan) values (p_user, p_txn, p_hash, p_amount, 0, p_plan);
  update public.profiles
     set pro_until = greatest(coalesce(pro_until, now()), now()) + make_interval(days => p_days),
         pro_plan = p_plan
   where id = p_user
   returning pro_until into v;

  select referred_by into v_ref from public.profiles where id = p_user;
  if v_ref is null and p_ref_code is not null and length(trim(p_ref_code)) > 0 then
    select id into v_ref from public.profiles where ref_code = lower(trim(p_ref_code)) and id <> p_user;
    if v_ref is not null then
      update public.profiles set referred_by = v_ref where id = p_user and referred_by is null;
    end if;
  end if;
  if v_ref is not null and v_ref <> p_user and p_amount in (499, 3999) then
    v_commission := round(p_amount * 0.30);
    insert into public.referrals(referrer_id, referred_user_id, plan, sale_amount, commission_amount, txn_id)
      values (v_ref, p_user, p_plan, p_amount, v_commission, p_txn);
    update public.profiles set wallet_balance = coalesce(wallet_balance, 0) + v_commission where id = v_ref;
  end if;
  return v;
exception when unique_violation then
  return null;
end; $$;
revoke all on function public.redeem_pro(uuid, text, text, int, int, text, text) from public, anon, authenticated;
grant execute on function public.redeem_pro(uuid, text, text, int, int, text, text) to service_role;
