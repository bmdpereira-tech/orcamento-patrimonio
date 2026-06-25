create type actual_movement_type as enum (
  'income',
  'expense'
);

create table actual_movements (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete restrict,
  movement_date date not null check (movement_date >= date '2026-07-01'),
  description text not null check (length(trim(description)) > 0),
  amount_cents bigint not null check (amount_cents >= 0),
  movement_type actual_movement_type not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index actual_movements_account_date_idx
  on actual_movements (account_id, movement_date);

create index actual_movements_date_idx
  on actual_movements (movement_date);

create trigger actual_movements_set_updated_at
before update on actual_movements
for each row execute function set_updated_at();

alter table actual_movements enable row level security;

create policy no_client_access on actual_movements for all using (false) with check (false);
