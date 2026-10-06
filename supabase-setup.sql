-- SafeClause: run this once in Supabase > SQL Editor

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  credits int not null default 0 check (credits >= 0),
  created_at timestamptz default now()
);
alter table public.profiles enable row level security;
drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles for select using (auth.uid() = id);

create table if not exists public.payments (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  txn_id text unique,
  image_hash text unique not null,
  amount int not null,
  credits int not null,
  created_at timestamptz default now()
);
alter table public.payments enable row level security;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, email) values (new.id, new.email) on conflict do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for users that signed up before this script ran
insert into public.profiles(id, email) select id, email from auth.users on conflict do nothing;

create or replace function public.spend_credit(p_user uuid) returns int
language plpgsql security definer set search_path = public as $$
declare v int;
begin
  update public.profiles set credits = credits - 1 where id = p_user and credits >= 1 returning credits into v;
  if v is null then return -1; end if;
  return v;
end; $$;

create or replace function public.redeem_payment(p_user uuid, p_txn text, p_hash text, p_amount int, p_credits int) returns int
language plpgsql security definer set search_path = public as $$
declare v int;
begin
  insert into public.profiles(id) values (p_user) on conflict do nothing;
  insert into public.payments(user_id, txn_id, image_hash, amount, credits) values (p_user, p_txn, p_hash, p_amount, p_credits);
  update public.profiles set credits = credits + p_credits where id = p_user returning credits into v;
  return v;
exception when unique_violation then
  return -1;
end; $$;

revoke all on function public.spend_credit(uuid) from public, anon, authenticated;
revoke all on function public.redeem_payment(uuid, text, text, int, int) from public, anon, authenticated;
grant execute on function public.spend_credit(uuid) to service_role;
grant execute on function public.redeem_payment(uuid, text, text, int, int) to service_role;
