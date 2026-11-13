-- ClauseRadar v12: Whop subscriptions. Run ONCE in Supabase > SQL Editor (after supabase-v3.sql). Safe to run again.
-- Pro is granted only by the server, from a signed Whop webhook. The browser can never write these tables.

create table if not exists public.whop_payments (
  id text primary key,                       -- Whop payment id (pay_...)
  email text,
  plan_id text,
  days int not null default 0,
  user_id uuid references auth.users(id) on delete set null,
  granted boolean not null default false,
  note text,
  created_at timestamptz not null default now(),
  granted_at timestamptz
);
create index if not exists whop_payments_email_idx on public.whop_payments (lower(email));
create index if not exists whop_payments_user_idx on public.whop_payments (user_id);
alter table public.whop_payments enable row level security;   -- no policies on purpose: only the service role can read or write

create or replace function public.whop_extend(p_uid uuid, p_days int) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare v timestamptz;
begin
  insert into public.profiles(id) values (p_uid) on conflict do nothing;
  update public.profiles
     set pro_until = greatest(coalesce(pro_until, now()), now()) + make_interval(days => p_days),
         pro_plan = case when p_days >= 300 then 'pro_year' else 'pro_month' end
   where id = p_uid
   returning pro_until into v;
  return v;
end; $$;

-- called by the webhook for every payment.succeeded. Idempotent on the Whop payment id.
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
  return 'granted';
end; $$;

-- called when the logged-in user asks about their payment. Only payments made with the user's own confirmed email can be claimed.
create or replace function public.whop_claim(p_uid uuid, p_since timestamptz) returns json
language plpgsql security definer set search_path = public as $$
declare em text; r record; n int := 0; c int; u timestamptz;
begin
  select lower(email) into em from auth.users where id = p_uid and email_confirmed_at is not null;
  if em is not null then
    for r in select id, days from public.whop_payments where granted = false and days > 0 and lower(email) = em for update loop
      perform public.whop_extend(p_uid, r.days);
      update public.whop_payments set user_id = p_uid, granted = true, granted_at = now() where id = r.id;
      n := n + 1;
    end loop;
  end if;
  select count(*) into c from public.whop_payments where user_id = p_uid and granted = true and created_at >= p_since;
  select pro_until into u from public.profiles where id = p_uid;
  return json_build_object('granted', n, 'confirmed', c, 'pro_until', u);
end; $$;

-- refund.created: take back the days that payment added
create or replace function public.whop_refund(p_pay text) returns text
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  select user_id, days, granted into r from public.whop_payments where id = p_pay and coalesce(note, '') <> 'refunded' for update;
  if not found then return 'unknown'; end if;
  if r.granted and r.user_id is not null then
    update public.profiles set pro_until = greatest(now(), pro_until - make_interval(days => r.days)) where id = r.user_id;
  end if;
  update public.whop_payments set note = 'refunded' where id = p_pay;
  return 'refunded';
end; $$;

revoke all on function public.whop_extend(uuid, int) from public, anon, authenticated;
revoke all on function public.whop_apply(text, text, text, int) from public, anon, authenticated;
revoke all on function public.whop_claim(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.whop_refund(text) from public, anon, authenticated;
grant execute on function public.whop_extend(uuid, int) to service_role;
grant execute on function public.whop_apply(text, text, text, int) to service_role;
grant execute on function public.whop_claim(uuid, timestamptz) to service_role;
grant execute on function public.whop_refund(text) to service_role;
