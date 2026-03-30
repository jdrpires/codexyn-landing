create extension if not exists "pgcrypto";

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists wallets (
  id uuid primary key default gen_random_uuid(),
  address text not null,
  chain text not null default 'ethereum',
  wallet_type text not null default 'self_custody',
  provider text,
  label text,
  created_at timestamptz not null default now(),
  constraint uq_wallet_chain unique (address, chain)
);

create table if not exists user_wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  wallet_id uuid not null references wallets(id) on delete cascade,
  nickname text,
  connected_via text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz,
  constraint uq_user_wallet unique (user_id, wallet_id)
);

create table if not exists exchange_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  exchange_name text not null,
  label text,
  external_account_id text,
  api_key_hint text,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

alter table exchange_accounts add column if not exists api_key_encrypted bytea;
alter table exchange_accounts add column if not exists api_secret_encrypted bytea;
alter table exchange_accounts add column if not exists last_synced_at timestamptz;

create table if not exists portfolio_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  total_value_usd numeric(20, 2),
  snapshot_at timestamptz not null default now()
);

create table if not exists ai_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  report_type text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_user_wallets_user_id on user_wallets(user_id);
create index if not exists idx_wallets_address_chain on wallets(address, chain);
create index if not exists idx_exchange_accounts_user_id on exchange_accounts(user_id);
create index if not exists idx_portfolio_snapshots_user_id on portfolio_snapshots(user_id);
create index if not exists idx_ai_reports_user_id on ai_reports(user_id);
