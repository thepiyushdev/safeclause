-- ClauseRadar v3: Pro subscription, Contract Memory, Scope Guard, Payment Chaser, device limits.
-- Run this ONCE in Supabase > SQL Editor. It is safe to run again.

alter table public.profiles add column if not exists pro_until timestamptz;
alter table public.profiles add column if not exists pro_plan text;
alter table public.payments add column if not exists plan text;

create or replace function public.is_pro(uid uuid) returns boolean
language sql security definer set search_path = public stable as $$
  select coalesce((select pro_until > now() from public.profiles where id = uid), false);
$$;

-- Contract Memory: structured terms + short clause excerpts only (never the full contract)
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  client_name text,
  jurisdiction text default 'india',
  payment_days int,
  late_fee_pct_month numeric,
  revision_cap int,
  revisions_used int not null default 0,
  hourly_rate numeric,
  liability_cap text,
  scope_items jsonb not null default '[]'::jsonb,
  excerpts jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.projects enable row level security;
drop policy if exists "projects own select" on public.projects;
drop policy if exists "projects own insert" on public.projects;
drop policy if exists "projects own update" on public.projects;
drop policy if exists "projects own delete" on public.projects;
create policy "projects own select" on public.projects for select using (auth.uid() = user_id);
create policy "projects own insert" on public.projects for insert with check (auth.uid() = user_id);
create policy "projects own update" on public.projects for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "projects own delete" on public.projects for delete using (auth.uid() = user_id);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  amount numeric not null check (amount > 0),
  invoice_date date not null,
  due_date date not null,
  paid_at date,
  note text,
  created_at timestamptz not null default now()
);
alter table public.invoices enable row level security;
drop policy if exists "invoices own select" on public.invoices;
drop policy if exists "invoices own insert" on public.invoices;
drop policy if exists "invoices own update" on public.invoices;
drop policy if exists "invoices own delete" on public.invoices;
create policy "invoices own select" on public.invoices for select using (auth.uid() = user_id);
create policy "invoices own insert" on public.invoices for insert with check (auth.uid() = user_id);
create policy "invoices own update" on public.invoices for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "invoices own delete" on public.invoices for delete using (auth.uid() = user_id);

-- Scope Guard usage log (verdict only, never the client's message)
create table if not exists public.scope_checks (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  verdict text,
  created_at timestamptz not null default now()
);
alter table public.scope_checks enable row level security;
drop policy if exists "scope_checks own select" on public.scope_checks;
create policy "scope_checks own select" on public.scope_checks for select using (auth.uid() = user_id);

-- Devices (Free: 1 at a time, Pro: 3). Written only by the server.
create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null,
  label text,
  revoked boolean not null default false,
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, device_id)
);
alter table public.devices enable row level security;
drop policy if exists "devices own select" on public.devices;
create policy "devices own select" on public.devices for select using (auth.uid() = user_id);

-- Free plan limits, enforced in the database so they cannot be bypassed from the browser
create or replace function public.enforce_project_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_pro(new.user_id) and (select count(*) from public.projects where user_id = new.user_id) >= 1 then
    raise exception 'FREE_LIMIT_PROJECTS';
  end if;
  return new;
end; $$;
drop trigger if exists trg_project_limit on public.projects;
create trigger trg_project_limit before insert on public.projects for each row execute function public.enforce_project_limit();

create or replace function public.enforce_invoice_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_pro(new.user_id) and (select count(*) from public.invoices where user_id = new.user_id and paid_at is null) >= 1 then
    raise exception 'FREE_LIMIT_INVOICES';
  end if;
  return new;
end; $$;
drop trigger if exists trg_invoice_limit on public.invoices;
create trigger trg_invoice_limit before insert on public.invoices for each row execute function public.enforce_invoice_limit();

-- Verified UPI payment -> adds Pro time. Returns the new pro_until, or null if the payment was already used.
create or replace function public.redeem_pro(p_user uuid, p_txn text, p_hash text, p_amount int, p_days int, p_plan text) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare v timestamptz;
begin
  insert into public.profiles(id) values (p_user) on conflict do nothing;
  insert into public.payments(user_id, txn_id, image_hash, amount, credits, plan) values (p_user, p_txn, p_hash, p_amount, 0, p_plan);
  update public.profiles
     set pro_until = greatest(coalesce(pro_until, now()), now()) + make_interval(days => p_days),
         pro_plan = p_plan
   where id = p_user
   returning pro_until into v;
  return v;
exception when unique_violation then
  return null;
end; $$;

revoke all on function public.redeem_pro(uuid, text, text, int, int, text) from public, anon, authenticated;
grant execute on function public.redeem_pro(uuid, text, text, int, int, text) to service_role;
