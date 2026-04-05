-- Locked — schéma initial (PostgreSQL / Supabase)
-- Devise : Ariary (Ar), montants entiers

create extension if not exists "pgcrypto";

-- Niveaux utilisateur (stocké en enum pour cohérence)
do $$ begin
  create type user_level as enum (
    'standard',
    'classic',
    'gold',
    'premier',
    'world_elite',
    'infinite'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type goal_status as enum ('active', 'completed', 'cancelled');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type transaction_type as enum (
    'deposit',
    'withdrawal',
    'withdrawal_fee',
    'promo_bonus'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type payment_provider as enum ('mvola', 'orange_money', 'airtel_money', 'internal');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type transaction_status as enum ('pending', 'completed', 'failed', 'cancelled');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type loan_status as enum ('pending', 'active', 'repaid', 'defaulted', 'cancelled');
exception
  when duplicate_object then null;
end $$;

-- Profils (lié à auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  phone text,
  display_name text,
  lifetime_deposits_ar bigint not null default 0 check (lifetime_deposits_ar >= 0),
  level user_level not null default 'standard',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_level_idx on public.profiles (level);

-- Objectifs (tirelire)
create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  target_amount_ar bigint not null check (target_amount_ar > 0),
  deadline timestamptz not null,
  balance_ar bigint not null default 0 check (balance_ar >= 0),
  status goal_status not null default 'active',
  promo_code_id uuid,
  promo_bonus_ar bigint not null default 0 check (promo_bonus_ar >= 0),
  promo_requires_80_percent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists goals_user_id_idx on public.goals (user_id);
create index if not exists goals_status_idx on public.goals (status);

-- Codes promo influenceurs
create table if not exists public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  influencer_user_id uuid references public.profiles (id) on delete set null,
  percent_first_deposit int not null default 20 check (percent_first_deposit > 0 and percent_first_deposit <= 100),
  active boolean not null default true,
  max_uses int,
  uses_count int not null default 0 check (uses_count >= 0),
  created_at timestamptz not null default now()
);

alter table public.goals
  add constraint goals_promo_code_fk
  foreign key (promo_code_id) references public.promo_codes (id);

-- Utilisation d’un code promo par utilisateur (premier dépôt)
create table if not exists public.promo_redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  promo_code_id uuid not null references public.promo_codes (id) on delete restrict,
  goal_id uuid not null references public.goals (id) on delete cascade,
  bonus_amount_ar bigint not null check (bonus_amount_ar >= 0),
  created_at timestamptz not null default now(),
  unique (user_id, promo_code_id)
);

create index if not exists promo_redemptions_goal_idx on public.promo_redemptions (goal_id);

-- Mouvements financiers
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  type transaction_type not null,
  amount_ar bigint not null check (amount_ar >= 0),
  fee_ar bigint not null default 0 check (fee_ar >= 0),
  provider payment_provider,
  external_ref text,
  status transaction_status not null default 'pending',
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists transactions_goal_id_idx on public.transactions (goal_id);
create index if not exists transactions_user_id_idx on public.transactions (user_id);
create index if not exists transactions_status_idx on public.transactions (status);
create index if not exists transactions_created_at_idx on public.transactions (created_at desc);

-- Activité mensuelle (pour éligibilité prêt : 6 mois consécutifs avec activité)
create table if not exists public.user_monthly_activity (
  user_id uuid not null references public.profiles (id) on delete cascade,
  month_start date not null,
  activity_count int not null default 0 check (activity_count >= 0),
  primary key (user_id, month_start)
);

create index if not exists user_monthly_activity_month_idx on public.user_monthly_activity (month_start);

-- Prêts
create table if not exists public.loans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount_ar bigint not null check (amount_ar > 0),
  status loan_status not null default 'pending',
  due_date timestamptz,
  created_at timestamptz not null default now(),
  repaid_at timestamptz
);

create index if not exists loans_user_id_idx on public.loans (user_id);

-- Trigger profil à la création utilisateur Supabase Auth
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

drop trigger if exists goals_updated_at on public.goals;
create trigger goals_updated_at
  before update on public.goals
  for each row execute procedure public.set_updated_at();

-- RLS : le backend utilisera la service role pour contrôler l’accès ; policies strictes si accès client direct plus tard
alter table public.profiles enable row level security;
alter table public.goals enable row level security;
alter table public.promo_codes enable row level security;
alter table public.promo_redemptions enable row level security;
alter table public.transactions enable row level security;
alter table public.user_monthly_activity enable row level security;
alter table public.loans enable row level security;

-- Politique minimale : utilisateur ne lit/écrit que ses lignes (JWT Supabase)
create policy "profiles_own" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "goals_own" on public.goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "promo_codes_read" on public.promo_codes
  for select using (true);

create policy "promo_redemptions_own" on public.promo_redemptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "transactions_own" on public.transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "user_monthly_activity_own" on public.user_monthly_activity
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "loans_own" on public.loans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

comment on table public.goals is 'Objectifs tirelire : retrait bloqué avant deadline imposée par l’utilisateur';
comment on column public.goals.promo_requires_80_percent is 'Si vrai, retrait autorisé seulement si balance >= 80% de target (règle premier dépôt promo)';
comment on table public.user_monthly_activity is 'Pour prêt : 6 mois consécutifs avec activité';
