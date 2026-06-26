alter table investment_assets
  add column if not exists description text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'investment_assets_description_not_blank'
      and conrelid = 'investment_assets'::regclass
  ) then
    alter table investment_assets
      add constraint investment_assets_description_not_blank
      check (description is null or length(trim(description)) > 0);
  end if;
end $$;
