-- Where and when a warehouse serves. Owned by warehouse-inventory.
--   service_areas      pincodes a warehouse delivers to. Once any warehouse lists pincodes, a request
--                      that carries a pincode is matched by pincode; otherwise the radius decides.
--   warehouse_hours    one opening window per weekday, India time. A closing time at or before the
--                      opening time means it closes after midnight. No rows: open all day.
--   warehouse_closures whole days a warehouse is shut, such as holidays.

create table inventory.service_areas (
  warehouse_id  text not null references inventory.warehouses (id) on delete cascade,
  pincode       text not null check (pincode ~ '^[1-9][0-9]{5}$'),
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  primary key (warehouse_id, pincode)
);

create index service_areas_pincode_idx on inventory.service_areas (pincode) where active;

create table inventory.warehouse_hours (
  warehouse_id  text not null references inventory.warehouses (id) on delete cascade,
  -- 0 Sunday to 6 Saturday
  weekday       smallint not null check (weekday between 0 and 6),
  opens_at      time not null,
  closes_at     time not null,
  updated_at    timestamptz not null default now(),
  primary key (warehouse_id, weekday),
  constraint warehouse_hours_not_empty check (opens_at <> closes_at)
);

create table inventory.warehouse_closures (
  id            uuid primary key default gen_random_uuid(),
  warehouse_id  text not null references inventory.warehouses (id) on delete cascade,
  starts_on     date not null,
  ends_on       date not null,
  reason        text not null check (length(trim(reason)) > 0),
  created_at    timestamptz not null default now(),
  constraint warehouse_closures_order check (ends_on >= starts_on)
);

create index warehouse_closures_warehouse_idx on inventory.warehouse_closures (warehouse_id, ends_on);

create trigger warehouse_hours_updated_at before update on inventory.warehouse_hours
  for each row execute function public.set_updated_at();
