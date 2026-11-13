-- ClauseRadar v13: referral commission on Whop payments (US dollar ledger) and UPI / USDT TRC20 payouts.
-- Run ONCE in Supabase > SQL Editor, AFTER supabase-v5-whop.sql. Safe to run again.

create table if not exists public.app_flags (key text primary key, at timestamptz not null default now());
alter table public.app_flags enable row level security;

-- payout methods
alter table public.payout_requests add column if not exists payout_method text not null default 'upi';
alter table public.payout_requests add column if not exists payout_address text;
alter table public.payout_requests add column if not exists legacy_inr numeric;
alter table public.payout_requests alter column upi_id drop not null;
update public.payout_requests set payout_address = upi_id where payout_address is null;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'payout_method_check') then
    alter table public.payout_requests add constraint payout_method_check check (payout_method in ('upi', 'usdt_trc20'));
  end if;
end $$;

-- commission rows can be reversed on refund
alter table public.referrals add column if not exists reversed boolean not null default false;
alter table public.referrals add column if not exists note text;
create unique index if not exists referrals_whop_pay_uidx on public.referrals (txn_id) where left(txn_id, 4) = 'pay_';

-- ONE-TIME: the ledger was in rupees (UPI era). Convert balances, commissions and payout amounts to dollars at 85 rupees per dollar.
-- The original rupee amount of each payout request is kept in legacy_inr.
do $$
begin
  if not exists (select 1 from public.app_flags where key = 'ledger_usd') then
    update public.payout_requests set legacy_inr = amount where legacy_inr is null;
    update public.payout_requests set amount = greatest(round(amount / 85.0, 2), 0.01);
    update public.referrals set sale_amount = round(sale_amount / 85.0, 2), commission_amount = round(commission_amount / 85.0, 2);
    update public.profiles set wallet_balance = round(wallet_balance / 85.0, 2);
    insert into public.app_flags(key) values ('ledger_usd');
  end if;
end $$;

-- price of each Whop plan in dollars (commission = 30% of this)
create or replace function public.whop_plan_price(p_plan text) returns numeric
language sql immutable as $$
  select (case p_plan
    when 'plan_2cmqmRXvCGKS1' then 5
    when 'plan_KrnnSLsfIvu4t' then 35
    when 'plan_gCA9uEvLhFlmm' then 9
    when 'plan_MFivxwEnHBRnp' then 59
    else null end)::numeric
$$;

-- credit 30% to the buyer's referrer. Runs once per Whop payment id.
create or replace function public.whop_commission(p_pay text, p_uid uuid, p_plan text) returns numeric
language plpgsql security definer set search_path = public as $$
declare ref uuid; price numeric; c numeric;
begin
  price := public.whop_plan_price(p_plan);
  if price is null or price <= 0 then return 0; end if;
  select referred_by into ref from public.profiles where id = p_uid;
  if ref is null or ref = p_uid then return 0; end if;
  if exists (select 1 from public.referrals where txn_id = p_pay) then return 0; end if;
  c := round(price * 0.30, 2);
  insert into public.referrals(referrer_id, referred_user_id, plan, sale_amount, commission_amount, txn_id)
    values (ref, p_uid, case when price in (5, 9) then 'pro_month' else 'pro_year' end, price, c, p_pay);
  update public.profiles set wallet_balance = coalesce(wallet_balance, 0) + c where id = ref;
  return c;
end; $$;

create or replace function public.whop_apply(p_pay text, p_email text, p_plan text, p_days int) returns text
language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  insert into public.whop_payments(id, email, plan_id, days, note)
    values (p_pay, lower(trim(p_email)), p_plan, greatest(p_days, 0), case when p_days > 0 then null else 'unknown plan id' end)
    on conflict (id) do nothing;
  if not found then return 'duplicate'; end if;
  if p_days <= 0 then return 'unknown_plan'; end if;
  select id into uid from auth.users where lower(email) = lower(trim(p_email)) and email_confirmed_at is not null limit 1;
  if uid is null then return 'unclaimed'; end if;
  perform public.whop_extend(uid, p_days);
  update public.whop_payments set user_id = uid, granted = true, granted_at = now() where id = p_pay;
  perform public.whop_commission(p_pay, uid, p_plan);
  return 'granted';
end; $$;

create or replace function public.whop_claim(p_uid uuid, p_since timestamptz) returns json
language plpgsql security definer set search_path = public as $$
declare em text; r record; n int := 0; c int; u timestamptz;
begin
  select lower(email) into em from auth.users where id = p_uid and email_confirmed_at is not null;
  if em is not null then
    for r in select id, days, plan_id from public.whop_payments where granted = false and days > 0 and lower(email) = em for update loop
      perform public.whop_extend(p_uid, r.days);
      update public.whop_payments set user_id = p_uid, granted = true, granted_at = now() where id = r.id;
      perform public.whop_commission(r.id, p_uid, r.plan_id);
      n := n + 1;
    end loop;
  end if;
  select count(*) into c from public.whop_payments where user_id = p_uid and granted = true and created_at >= p_since;
  select pro_until into u from public.profiles where id = p_uid;
  return json_build_object('granted', n, 'confirmed', c, 'pro_until', u);
end; $$;

-- refund: take back the Pro days and reverse the commission if it has not been withdrawn yet
create or replace function public.whop_refund(p_pay text) returns text
language plpgsql security definer set search_path = public as $$
declare r record; cr record; w numeric; take numeric;
begin
  select user_id, days, granted into r from public.whop_payments where id = p_pay and coalesce(note, '') <> 'refunded' for update;
  if not found then return 'unknown'; end if;
  if r.granted and r.user_id is not null then
    update public.profiles set pro_until = greatest(now(), pro_until - make_interval(days => r.days)) where id = r.user_id;
  end if;
  select id, referrer_id, commission_amount into cr from public.referrals where txn_id = p_pay and reversed = false for update;
  if found then
    select coalesce(wallet_balance, 0) into w from public.profiles where id = cr.referrer_id;
    take := least(w, cr.commission_amount);
    update public.profiles set wallet_balance = wallet_balance - take where id = cr.referrer_id;
    update public.referrals
       set reversed = true,
           note = case when take < cr.commission_amount then 'refund: ' || (cr.commission_amount - take) || ' already withdrawn' else 'refund: reversed' end
     where id = cr.id;
  end if;
  update public.whop_payments set note = 'refunded' where id = p_pay;
  return 'refunded';
end; $$;

-- withdraw: UPI ID or USDT (TRON / TRC20) address. Takes the amount out of the wallet in the same step.
drop function if exists public.request_payout(text, numeric);
create or replace function public.request_payout(p_method text, p_address text, p_amount numeric default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); bal numeric; amt numeric; em text; rid uuid;
        m text := lower(trim(coalesce(p_method, ''))); a text := trim(coalesce(p_address, ''));
begin
  if uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if m = 'upi' then
    a := lower(a);
    if a !~ '^[a-z0-9._-]{2,64}@[a-z0-9]{2,32}$' then raise exception 'INVALID_UPI'; end if;
  elsif m = 'usdt_trc20' then
    if a !~ '^T[1-9A-HJ-NP-Za-km-z]{33}$' then raise exception 'INVALID_TRC20'; end if;
  else
    raise exception 'INVALID_METHOD';
  end if;
  if exists (select 1 from public.payout_requests where user_id = uid and status = 'pending') then raise exception 'PENDING_EXISTS'; end if;
  select wallet_balance into bal from public.profiles where id = uid for update;
  amt := round(coalesce(p_amount, bal), 2);
  if amt is null or bal is null or amt > bal then raise exception 'INSUFFICIENT_BALANCE'; end if;
  if amt < 5 then raise exception 'MIN_PAYOUT'; end if;
  select email into em from auth.users where id = uid;
  insert into public.payout_requests(user_id, email, amount, upi_id, payout_method, payout_address)
    values (uid, em, amt, case when m = 'upi' then a else null end, m, a) returning id into rid;
  update public.profiles set wallet_balance = wallet_balance - amt where id = uid;
  return rid;
end; $$;

revoke all on function public.whop_plan_price(text) from public, anon, authenticated;
revoke all on function public.whop_commission(text, uuid, text) from public, anon, authenticated;
revoke all on function public.whop_apply(text, text, text, int) from public, anon, authenticated;
revoke all on function public.whop_claim(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.whop_refund(text) from public, anon, authenticated;
grant execute on function public.whop_plan_price(text) to service_role;
grant execute on function public.whop_commission(text, uuid, text) to service_role;
grant execute on function public.whop_apply(text, text, text, int) to service_role;
grant execute on function public.whop_claim(uuid, timestamptz) to service_role;
grant execute on function public.whop_refund(text) to service_role;
revoke all on function public.request_payout(text, text, numeric) from public, anon;
grant execute on function public.request_payout(text, text, numeric) to authenticated;
