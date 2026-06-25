create extension if not exists pgcrypto;

create type budget_item_category as enum (
  'expense',
  'income',
  'transfer',
  'credit_card_payment',
  'investment',
  'other'
);

create type budget_item_status as enum (
  'planned',
  'done',
  'cancelled'
);

create type recurring_frequency as enum (
  'monthly',
  'quarterly',
  'semiannual',
  'annual'
);

create type salary_status as enum (
  'planned',
  'received',
  'cancelled'
);

create table accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) > 0),
  is_credit_card boolean not null default false,
  linked_payment_account_id uuid references accounts(id) on delete set null,
  start_month date not null check (
    start_month = date_trunc('month', start_month)::date
    and start_month >= date '2026-07-01'
  ),
  archived_from_month date check (
    archived_from_month is null
    or (
      archived_from_month = date_trunc('month', archived_from_month)::date
      and archived_from_month >= start_month
    )
  ),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (is_credit_card or linked_payment_account_id is null)
);

create table account_month_states (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  month date not null check (
    month = date_trunc('month', month)::date
    and month >= date '2026-07-01'
  ),
  initial_balance_override_cents bigint,
  current_balance_override_cents bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, month),
  check (
    initial_balance_override_cents is null
    or month = date '2026-07-01'
  )
);

create table investment_assets (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) > 0),
  start_month date not null check (
    start_month = date_trunc('month', start_month)::date
    and start_month >= date '2026-07-01'
  ),
  archived_from_month date check (
    archived_from_month is null
    or (
      archived_from_month = date_trunc('month', archived_from_month)::date
      and archived_from_month >= start_month
    )
  ),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table investment_month_values (
  id uuid primary key default gen_random_uuid(),
  investment_asset_id uuid not null references investment_assets(id) on delete cascade,
  month date not null check (
    month = date_trunc('month', month)::date
    and month >= date '2026-07-01'
  ),
  value_cents bigint not null check (value_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (investment_asset_id, month)
);

create table budget_items (
  id uuid primary key default gen_random_uuid(),
  month date not null check (
    month = date_trunc('month', month)::date
    and month >= date '2026-07-01'
  ),
  description text not null check (length(trim(description)) > 0),
  category budget_item_category not null,
  status budget_item_status not null default 'planned',
  source_type text not null default 'manual',
  copied_from_id uuid references budget_items(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table budget_allocations (
  id uuid primary key default gen_random_uuid(),
  budget_item_id uuid not null references budget_items(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete restrict,
  amount_cents bigint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (budget_item_id, account_id)
);

create table recurring_rules (
  id uuid primary key default gen_random_uuid(),
  description text not null check (length(trim(description)) > 0),
  amount_cents bigint not null check (amount_cents <> 0),
  account_id uuid not null references accounts(id) on delete restrict,
  frequency recurring_frequency not null,
  start_month date not null check (
    start_month = date_trunc('month', start_month)::date
    and start_month >= date '2026-07-01'
  ),
  end_month date check (
    end_month is null
    or (
      end_month = date_trunc('month', end_month)::date
      and end_month >= start_month
    )
  ),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table recurring_occurrence_overrides (
  id uuid primary key default gen_random_uuid(),
  recurring_rule_id uuid not null references recurring_rules(id) on delete cascade,
  month date not null check (
    month = date_trunc('month', month)::date
    and month >= date '2026-07-01'
  ),
  status budget_item_status,
  amount_cents bigint,
  account_id uuid references accounts(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (recurring_rule_id, month)
);

create table daily_budget_versions (
  id uuid primary key default gen_random_uuid(),
  effective_from_month date not null check (
    effective_from_month = date_trunc('month', effective_from_month)::date
    and effective_from_month >= date '2026-07-01'
  ),
  daily_amount_cents bigint not null check (daily_amount_cents >= 0),
  account_id uuid not null references accounts(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (effective_from_month)
);

create table salary_versions (
  id uuid primary key default gen_random_uuid(),
  effective_from_month date not null check (
    effective_from_month = date_trunc('month', effective_from_month)::date
    and effective_from_month >= date '2026-07-01'
  ),
  amount_cents bigint not null check (amount_cents >= 0),
  account_id uuid not null references accounts(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (effective_from_month)
);

create table salary_month_overrides (
  id uuid primary key default gen_random_uuid(),
  month date not null unique check (
    month = date_trunc('month', month)::date
    and month >= date '2026-07-01'
  ),
  amount_cents bigint check (amount_cents is null or amount_cents >= 0),
  account_id uuid references accounts(id) on delete restrict,
  status salary_status,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table credit_card_statement_overrides (
  id uuid primary key default gen_random_uuid(),
  credit_card_account_id uuid not null references accounts(id) on delete cascade,
  month date not null check (
    month = date_trunc('month', month)::date
    and month >= date '2026-07-01'
  ),
  statement_amount_cents bigint not null check (statement_amount_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (credit_card_account_id, month)
);

create table app_settings (
  key text primary key,
  value jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index accounts_visible_month_idx on accounts (start_month, archived_from_month, sort_order);
create index account_month_states_month_idx on account_month_states (month);
create index budget_items_month_status_idx on budget_items (month, status);
create index budget_allocations_account_idx on budget_allocations (account_id);
create index recurring_rules_month_idx on recurring_rules (start_month, end_month, active);
create index investment_month_values_month_idx on investment_month_values (month);

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger accounts_set_updated_at
before update on accounts
for each row execute function set_updated_at();

create trigger account_month_states_set_updated_at
before update on account_month_states
for each row execute function set_updated_at();

create trigger investment_assets_set_updated_at
before update on investment_assets
for each row execute function set_updated_at();

create trigger investment_month_values_set_updated_at
before update on investment_month_values
for each row execute function set_updated_at();

create trigger budget_items_set_updated_at
before update on budget_items
for each row execute function set_updated_at();

create trigger budget_allocations_set_updated_at
before update on budget_allocations
for each row execute function set_updated_at();

create trigger recurring_rules_set_updated_at
before update on recurring_rules
for each row execute function set_updated_at();

create trigger recurring_occurrence_overrides_set_updated_at
before update on recurring_occurrence_overrides
for each row execute function set_updated_at();

create trigger daily_budget_versions_set_updated_at
before update on daily_budget_versions
for each row execute function set_updated_at();

create trigger salary_versions_set_updated_at
before update on salary_versions
for each row execute function set_updated_at();

create trigger salary_month_overrides_set_updated_at
before update on salary_month_overrides
for each row execute function set_updated_at();

create trigger credit_card_statement_overrides_set_updated_at
before update on credit_card_statement_overrides
for each row execute function set_updated_at();

create trigger app_settings_set_updated_at
before update on app_settings
for each row execute function set_updated_at();

alter table accounts enable row level security;
alter table account_month_states enable row level security;
alter table investment_assets enable row level security;
alter table investment_month_values enable row level security;
alter table budget_items enable row level security;
alter table budget_allocations enable row level security;
alter table recurring_rules enable row level security;
alter table recurring_occurrence_overrides enable row level security;
alter table daily_budget_versions enable row level security;
alter table salary_versions enable row level security;
alter table salary_month_overrides enable row level security;
alter table credit_card_statement_overrides enable row level security;
alter table app_settings enable row level security;

create policy no_client_access on accounts for all using (false) with check (false);
create policy no_client_access on account_month_states for all using (false) with check (false);
create policy no_client_access on investment_assets for all using (false) with check (false);
create policy no_client_access on investment_month_values for all using (false) with check (false);
create policy no_client_access on budget_items for all using (false) with check (false);
create policy no_client_access on budget_allocations for all using (false) with check (false);
create policy no_client_access on recurring_rules for all using (false) with check (false);
create policy no_client_access on recurring_occurrence_overrides for all using (false) with check (false);
create policy no_client_access on daily_budget_versions for all using (false) with check (false);
create policy no_client_access on salary_versions for all using (false) with check (false);
create policy no_client_access on salary_month_overrides for all using (false) with check (false);
create policy no_client_access on credit_card_statement_overrides for all using (false) with check (false);
create policy no_client_access on app_settings for all using (false) with check (false);
