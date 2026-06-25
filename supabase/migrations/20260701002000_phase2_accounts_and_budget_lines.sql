alter table accounts
  add column if not exists short_name text,
  add column if not exists account_type text not null default 'bank_account',
  add column if not exists show_in_budget boolean not null default true,
  add column if not exists include_in_net_worth boolean not null default true;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'accounts_short_name_not_blank'
  ) then
    alter table accounts
      add constraint accounts_short_name_not_blank
      check (short_name is null or length(trim(short_name)) > 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'accounts_account_type_known'
  ) then
    alter table accounts
      add constraint accounts_account_type_known
      check (
        account_type in (
          'bank_account',
          'credit_card',
          'savings',
          'investment_cash',
          'cash',
          'other'
        )
      );
  end if;
end $$;

update accounts
set
  account_type = case
    when is_credit_card then 'credit_card'
    when name = 'T212 Cash' then 'investment_cash'
    else 'bank_account'
  end,
  short_name = coalesce(short_name, case when name = 'T212 Cash' then 'T212 Cash' else name end),
  show_in_budget = coalesce(show_in_budget, true),
  include_in_net_worth = coalesce(include_in_net_worth, true);

create index if not exists accounts_budget_visibility_idx
  on accounts (show_in_budget, start_month, archived_from_month, sort_order);

create index if not exists accounts_net_worth_idx
  on accounts (include_in_net_worth, start_month, archived_from_month);

create unique index if not exists budget_items_month_system_source_uidx
  on budget_items (month, source_type)
  where source_type in (
    'realised_movements',
    'direct_debits',
    'day_to_day',
    'credit_card_payments',
    'salary'
  );
