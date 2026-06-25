create table if not exists recurring_rule_month_states (
  id uuid primary key default gen_random_uuid(),
  recurring_rule_id uuid not null references recurring_rules(id) on delete cascade,
  month_start date not null check (month_start = date_trunc('month', month_start)::date),
  excluded_from_forecast boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (recurring_rule_id, month_start)
);

create index if not exists recurring_rule_month_states_month_idx
  on recurring_rule_month_states (month_start);

create index if not exists recurring_rule_month_states_rule_idx
  on recurring_rule_month_states (recurring_rule_id);

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'recurring_rule_month_states_set_updated_at'
  ) then
    create trigger recurring_rule_month_states_set_updated_at
    before update on recurring_rule_month_states
    for each row execute function set_updated_at();
  end if;
end $$;

alter table recurring_rule_month_states enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'recurring_rule_month_states'
      and policyname = 'no_client_access'
  ) then
    create policy no_client_access on recurring_rule_month_states
      for all using (false) with check (false);
  end if;
end $$;
