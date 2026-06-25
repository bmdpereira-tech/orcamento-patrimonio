alter table recurring_rules
  add column if not exists charge_day integer not null default 1,
  add column if not exists archived_at timestamptz,
  add column if not exists sort_order integer not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'recurring_rules_charge_day_range'
  ) then
    alter table recurring_rules
      add constraint recurring_rules_charge_day_range
      check (charge_day between 1 and 31);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'recurring_rules_amount_positive'
  ) then
    alter table recurring_rules
      add constraint recurring_rules_amount_positive
      check (amount_cents > 0)
      not valid;
  end if;
end $$;

create index if not exists recurring_rules_account_idx
  on recurring_rules (account_id);

create index if not exists recurring_rules_status_month_idx
  on recurring_rules (active, archived_at, start_month, end_month, account_id);

create index if not exists recurring_rules_sort_idx
  on recurring_rules (archived_at, sort_order, description);
