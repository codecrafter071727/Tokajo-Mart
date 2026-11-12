-- orders: the order and its history. Owned by the order service.
-- Item prices are snapshotted at order time, so later catalog edits never change a past order.

create schema if not exists orders;

create table orders.orders (
  id                  uuid primary key default gen_random_uuid(),
  -- Human readable number shown to customers and staff, for example QC-261112-00042
  number              text not null unique,
  user_id             uuid not null,
  warehouse_id        text not null,
  -- COD orders start at confirmed. pending_payment, payment_failed and expired are for online payment.
  status              text not null default 'confirmed' check (
    status in ('pending_payment', 'confirmed', 'packing', 'packed', 'picked_up', 'out_for_delivery',
               'delivered', 'cancelled', 'payment_failed', 'expired')
  ),
  payment_method      text not null check (payment_method in ('cod')),
  item_total_paise    integer not null check (item_total_paise >= 0),
  mrp_total_paise     integer not null check (mrp_total_paise >= 0),
  savings_paise       integer not null check (savings_paise >= 0),
  delivery_fee_paise  integer not null check (delivery_fee_paise >= 0),
  handling_fee_paise  integer not null check (handling_fee_paise >= 0),
  tip_paise           integer not null check (tip_paise >= 0),
  total_paise         integer not null check (total_paise >= 0),
  promised_mins       integer not null check (promised_mins > 0),
  -- The customer reads this to the rider at the door
  delivery_code       text not null check (delivery_code ~ '^[0-9]{4}$'),
  customer_name       text not null default '',
  customer_phone      text not null default '',
  address_tag         text not null,
  address_line1       text not null,
  address_line2       text not null default '',
  address_lat         double precision,
  address_lng         double precision,
  instructions        text,
  reservation_id      uuid,
  rider_id            uuid,
  idempotency_key     text not null,
  placed_at           timestamptz not null default now(),
  confirmed_at        timestamptz,
  packing_started_at  timestamptz,
  packed_at           timestamptz,
  picked_up_at        timestamptz,
  out_for_delivery_at timestamptz,
  delivered_at        timestamptz,
  cancelled_at        timestamptz,
  cancel_reason       text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  -- A retried request with the same key must find the same order, never create a second one
  constraint orders_idempotency unique (user_id, idempotency_key),
  constraint orders_total_adds_up check (
    total_paise = item_total_paise + delivery_fee_paise + handling_fee_paise + tip_paise
  )
);

create index orders_user_idx on orders.orders (user_id, placed_at desc);
create index orders_queue_idx on orders.orders (warehouse_id, status, placed_at)
  where status in ('confirmed', 'packing', 'packed');

create table orders.order_items (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references orders.orders (id) on delete cascade,
  product_id        text not null,
  name              text not null,
  unit              text not null default '',
  quantity          integer not null check (quantity > 0),
  unit_price_paise  integer not null check (unit_price_paise >= 0),
  mrp_paise         integer not null check (mrp_paise >= 0),
  emoji             text not null default '',
  image_url         text,
  -- Ticked by the picker during picking
  picked            boolean not null default false,
  created_at        timestamptz not null default now(),
  unique (order_id, product_id)
);

-- Append only history: every transition with the actor and the time. Never updated or deleted.
create table orders.order_status_history (
  id          bigserial primary key,
  order_id    uuid not null references orders.orders (id) on delete cascade,
  from_status text,
  to_status   text not null,
  actor_id    uuid,
  actor_role  text,
  note        text,
  created_at  timestamptz not null default now()
);

create index order_status_history_order_idx on orders.order_status_history (order_id, id);

create sequence orders.order_number_seq;

create trigger orders_updated_at before update on orders.orders
  for each row execute function public.set_updated_at();
