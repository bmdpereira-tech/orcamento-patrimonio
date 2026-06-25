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
