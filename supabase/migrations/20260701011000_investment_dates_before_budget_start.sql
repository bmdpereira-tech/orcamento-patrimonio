do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'investment_assets_start_month_check'
      and conrelid = 'investment_assets'::regclass
  ) then
    alter table investment_assets
      drop constraint investment_assets_start_month_check;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'investment_assets_start_month_is_month_start'
      and conrelid = 'investment_assets'::regclass
  ) then
    alter table investment_assets
      add constraint investment_assets_start_month_is_month_start
      check (start_month = date_trunc('month', start_month)::date);
  end if;

  if exists (
    select 1
    from pg_constraint
    where conname = 'investment_assets_archived_from_month_check'
      and conrelid = 'investment_assets'::regclass
  ) then
    alter table investment_assets
      drop constraint investment_assets_archived_from_month_check;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'investment_assets_archived_from_month_valid'
      and conrelid = 'investment_assets'::regclass
  ) then
    alter table investment_assets
      add constraint investment_assets_archived_from_month_valid
      check (
        archived_from_month is null
        or (
          archived_from_month = date_trunc('month', archived_from_month)::date
          and archived_from_month >= start_month
        )
      );
  end if;

  if exists (
    select 1
    from pg_constraint
    where conname = 'investment_cash_flows_flow_date_check'
      and conrelid = 'investment_cash_flows'::regclass
  ) then
    alter table investment_cash_flows
      drop constraint investment_cash_flows_flow_date_check;
  end if;

  if exists (
    select 1
    from pg_constraint
    where conname = 'investment_valuations_valuation_date_check'
      and conrelid = 'investment_valuations'::regclass
  ) then
    alter table investment_valuations
      drop constraint investment_valuations_valuation_date_check;
  end if;
end $$;
