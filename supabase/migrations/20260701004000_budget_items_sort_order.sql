alter table budget_items
  add column if not exists sort_order integer not null default 0;

create index if not exists budget_items_month_source_sort_idx
  on budget_items (month, source_type, sort_order);
