-- inventory: where stock is and who can be served from where. Owned by warehouse-inventory.
-- available = on_hand - reserved. Stock moves in three steps so two customers can never buy the
-- last item:
--   reserve  reserved goes up            when an order is placed (atomic, never read then write)
--   commit   on_hand and reserved go down when the order is confirmed and packed
--   release  reserved goes down           when the order is cancelled or the hold expires
-- Every change to on_hand writes a row to stock_movements, so the ledger always reconciles.

create schema if not exists inventory;

create table inventory.warehouses (
  id          text primary key,
  name        text not null,
  lat         double precision not null check (lat between -90 and 90),
  lng         double precision not null check (lng between -180 and 180),
  -- v1 service area: everything within this distance of the warehouse
  radius_km   numeric(6, 2) not null check (radius_km > 0),
  open        boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table inventory.stock_items (
  warehouse_id   text not null references inventory.warehouses (id),
  product_id     text not null,
  on_hand        integer not null default 0 check (on_hand >= 0),
  reserved       integer not null default 0 check (reserved >= 0),
  max_per_order  integer check (max_per_order is null or max_per_order > 0),
  rack_location  text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  primary key (warehouse_id, product_id),
  -- Can never promise more than is physically there
  constraint stock_reserved_within_on_hand check (reserved <= on_hand)
);

-- Append only ledger of physical stock changes.
create table inventory.stock_movements (
  id              bigserial primary key,
  warehouse_id    text not null,
  product_id      text not null,
  type            text not null check (type in ('grn', 'sale', 'adjustment', 'damage', 'expiry', 'return')),
  quantity_delta  integer not null check (quantity_delta <> 0),
  reason          text,
  reference       text,
  actor_id        uuid,
  created_at      timestamptz not null default now()
);

create index stock_movements_item_idx on inventory.stock_movements (warehouse_id, product_id, id);

create table inventory.reservations (
  id            uuid primary key default gen_random_uuid(),
  warehouse_id  text not null references inventory.warehouses (id),
  -- The caller's own reference (the order id): unique, so a retry finds the same hold
  reference     text not null unique,
  status        text not null default 'held' check (status in ('held', 'committed', 'released', 'expired')),
  expires_at    timestamptz not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table inventory.reservation_lines (
  reservation_id  uuid not null references inventory.reservations (id) on delete cascade,
  product_id      text not null,
  quantity        integer not null check (quantity > 0),
  primary key (reservation_id, product_id)
);

create index reservations_held_expiry_idx on inventory.reservations (expires_at) where status = 'held';

create trigger warehouses_updated_at before update on inventory.warehouses
  for each row execute function public.set_updated_at();
create trigger stock_items_updated_at before update on inventory.stock_items
  for each row execute function public.set_updated_at();
create trigger reservations_updated_at before update on inventory.reservations
  for each row execute function public.set_updated_at();
