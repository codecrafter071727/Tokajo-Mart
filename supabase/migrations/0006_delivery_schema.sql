-- delivery: getting a packed order to the customer. Owned by the delivery service.
-- A delivery is created when the warehouse packs an order, offered to one online rider at a time,
-- and finished with the customer's 4 digit code.

create schema if not exists delivery;

create table delivery.rider_state (
  rider_id    uuid primary key,
  online      boolean not null default false,
  updated_at  timestamptz not null default now()
);

create table delivery.deliveries (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null unique,
  order_number      text not null,
  warehouse_id      text not null,
  status            text not null default 'unassigned' check (
    status in ('unassigned', 'offered', 'assigned', 'at_store', 'picked_up', 'at_customer', 'delivered', 'cancelled')
  ),
  rider_id          uuid,
  -- The rider the offer is currently with, and who has already turned it down
  offered_to        uuid,
  offered_at        timestamptz,
  declined_by       uuid[] not null default '{}',
  store_name        text not null,
  store_address     text not null,
  store_lat         double precision not null,
  store_lng         double precision not null,
  customer_name     text not null default '',
  customer_phone    text not null default '',
  customer_address  text not null,
  customer_lat      double precision,
  customer_lng      double precision,
  instructions      text,
  items             jsonb not null,
  distance_km       numeric(6, 2) not null default 0,
  eta_mins          integer not null default 10,
  payout_paise      integer not null check (payout_paise >= 0),
  tip_paise         integer not null default 0 check (tip_paise >= 0),
  -- Cash the rider must collect, null when already paid
  cod_paise         integer check (cod_paise is null or cod_paise >= 0),
  -- Shown on the warehouse handover screen; the rider enters it to confirm pickup
  handover_code     text not null check (handover_code ~ '^[0-9]{4}$'),
  -- The customer's code. Never sent to the rider app; the server checks what the rider types.
  delivery_code     text not null check (delivery_code ~ '^[0-9]{4}$'),
  -- Wrong tries at the door and at the handover, so a code cannot be guessed
  code_attempts     integer not null default 0,
  delivered_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index deliveries_dispatch_idx on delivery.deliveries (warehouse_id, created_at)
  where status = 'unassigned';
create index deliveries_rider_idx on delivery.deliveries (rider_id, status);

create trigger rider_state_updated_at before update on delivery.rider_state
  for each row execute function public.set_updated_at();
create trigger deliveries_updated_at before update on delivery.deliveries
  for each row execute function public.set_updated_at();
