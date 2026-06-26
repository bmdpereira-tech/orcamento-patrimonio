alter table salary_versions
  add column if not exists vacation_bonus_cents bigint not null default 0,
  add column if not exists vacation_bonus_month smallint not null default 7,
  add column if not exists christmas_bonus_cents bigint not null default 0,
  add column if not exists christmas_bonus_month smallint not null default 12;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'salary_versions_vacation_bonus_non_negative'
  ) then
    alter table salary_versions
      add constraint salary_versions_vacation_bonus_non_negative
      check (vacation_bonus_cents >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'salary_versions_christmas_bonus_non_negative'
  ) then
    alter table salary_versions
      add constraint salary_versions_christmas_bonus_non_negative
      check (christmas_bonus_cents >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'salary_versions_vacation_bonus_month_valid'
  ) then
    alter table salary_versions
      add constraint salary_versions_vacation_bonus_month_valid
      check (vacation_bonus_month between 1 and 12);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'salary_versions_christmas_bonus_month_valid'
  ) then
    alter table salary_versions
      add constraint salary_versions_christmas_bonus_month_valid
      check (christmas_bonus_month between 1 and 12);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'salary_versions_bonus_months_distinct'
  ) then
    alter table salary_versions
      add constraint salary_versions_bonus_months_distinct
      check (vacation_bonus_month <> christmas_bonus_month);
  end if;
end $$;
