insert into app_settings (key, value)
values ('initial_month', '"2026-07-01"'::jsonb)
on conflict (key) do update set value = excluded.value;

with legacy_cash_account as (
  select id
  from accounts
  where name in ('Trading 212 Disponivel', 'Trading 212 Disponível')
    and not exists (
      select 1
      from accounts existing_account
      where existing_account.name = 'T212 Cash'
    )
  order by created_at
  limit 1
)
update accounts
set name = 'T212 Cash'
where id in (select id from legacy_cash_account);

update investment_assets
set name = 'Trading 212 — Investimentos'
where name = 'Trading 212 - Investimentos';

insert into accounts (
  name,
  short_name,
  account_type,
  is_credit_card,
  start_month,
  sort_order,
  show_in_budget,
  include_in_net_worth
)
values
  ('Santander', 'Santander', 'bank_account', false, date '2026-07-01', 10, true, true),
  ('ActivoBank', 'ActivoBank', 'bank_account', false, date '2026-07-01', 30, true, true),
  ('T212 Cash', 'T212 Cash', 'investment_cash', false, date '2026-07-01', 50, true, true),
  ('N26', 'N26', 'bank_account', false, date '2026-07-01', 60, true, true),
  ('IGCP', 'IGCP', 'savings', false, date '2026-07-01', 70, true, true)
on conflict (name) do update set
  short_name = excluded.short_name,
  account_type = excluded.account_type,
  is_credit_card = excluded.is_credit_card,
  start_month = excluded.start_month,
  sort_order = excluded.sort_order,
  show_in_budget = excluded.show_in_budget,
  include_in_net_worth = excluded.include_in_net_worth;

insert into accounts (
  name,
  short_name,
  account_type,
  is_credit_card,
  linked_payment_account_id,
  start_month,
  sort_order,
  show_in_budget,
  include_in_net_worth
)
values
  (
    'CC Santander',
    'CC Santander',
    'credit_card',
    true,
    (select id from accounts where name = 'Santander'),
    date '2026-07-01',
    20,
    true,
    true
  ),
  (
    'CC ActivoBank',
    'CC ActivoBank',
    'credit_card',
    true,
    (select id from accounts where name = 'ActivoBank'),
    date '2026-07-01',
    40,
    true,
    true
  )
on conflict (name) do update set
  short_name = excluded.short_name,
  account_type = excluded.account_type,
  is_credit_card = excluded.is_credit_card,
  linked_payment_account_id = excluded.linked_payment_account_id,
  start_month = excluded.start_month,
  sort_order = excluded.sort_order,
  show_in_budget = excluded.show_in_budget,
  include_in_net_worth = excluded.include_in_net_worth;

insert into investment_assets (name, start_month, sort_order)
values ('Trading 212 — Investimentos', date '2026-07-01', 10)
on conflict (name) do update set
  start_month = excluded.start_month,
  sort_order = excluded.sort_order;
