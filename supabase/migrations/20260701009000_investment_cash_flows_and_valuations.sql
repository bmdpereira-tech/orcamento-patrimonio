do $$
begin
  if not exists (
    select 1 from pg_type where typname = 'investment_cash_flow_type'
  ) then
    create type investment_cash_flow_type as enum (
      'contribution',
      'redemption'
    );
  end if;
end $$;

create table investment_cash_flows (
  id uuid primary key default gen_random_uuid(),
  investment_asset_id uuid not null references investment_assets(id) on delete cascade,
  flow_type investment_cash_flow_type not null,
  flow_date date not null check (flow_date >= date '2026-07-01'),
  amount_cents bigint not null check (amount_cents > 0),
  note text check (note is null or length(trim(note)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table investment_valuations (
  id uuid primary key default gen_random_uuid(),
  investment_asset_id uuid not null references investment_assets(id) on delete cascade,
  valuation_date date not null check (valuation_date >= date '2026-07-01'),
  market_value_cents bigint not null check (market_value_cents >= 0),
  note text check (note is null or length(trim(note)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (investment_asset_id, valuation_date)
);

create index investment_cash_flows_asset_date_idx
  on investment_cash_flows (investment_asset_id, flow_date);

create index investment_cash_flows_date_idx
  on investment_cash_flows (flow_date);

create index investment_cash_flows_type_idx
  on investment_cash_flows (flow_type);

create index investment_valuations_asset_date_idx
  on investment_valuations (investment_asset_id, valuation_date desc);

create index investment_valuations_date_idx
  on investment_valuations (valuation_date);

create trigger investment_cash_flows_set_updated_at
before update on investment_cash_flows
for each row execute function set_updated_at();

create trigger investment_valuations_set_updated_at
before update on investment_valuations
for each row execute function set_updated_at();

alter table investment_cash_flows enable row level security;
alter table investment_valuations enable row level security;

create policy no_client_access on investment_cash_flows for all using (false) with check (false);
create policy no_client_access on investment_valuations for all using (false) with check (false);
