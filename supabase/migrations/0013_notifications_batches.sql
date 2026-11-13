-- notifications: what we tell people, owned by the notification service.
-- inventory.batches: received stock with an expiry date, owned by warehouse-inventory.

create schema if not exists notifications;

-- The in-app inbox. Push and SMS delivery can be added later; the row is the source of truth.
create table notifications.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  type        text not null check (length(type) between 1 and 60),
  title       text not null check (length(title) between 1 and 120),
  body        text not null default '' check (length(body) <= 500),
  -- Where tapping it goes, for example {"orderId": "..."} or {"productId": "p1"}
  data        jsonb not null default '{}'::jsonb,
  -- A sender may pass a key so a retried event never shows twice
  dedupe_key  text unique,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index notifications_user_idx on notifications.notifications (user_id, created_at desc, id desc);
create index notifications_unread_idx on notifications.notifications (user_id) where read_at is null;
create index notifications_type_idx on notifications.notifications (type, created_at desc);

-- "Notify me" for an out of stock product at the customer's serving warehouse.
create table notifications.subscriptions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null,
  product_id    text not null,
  warehouse_id  text not null,
  created_at    timestamptz not null default now(),
  -- Set when the product came back and we told them; the subscription is then closed
  notified_at   timestamptz,
  cancelled_at  timestamptz
);

-- One open subscription per person, product and warehouse
create unique index subscriptions_open_unique on notifications.subscriptions (user_id, product_id, warehouse_id)
  where notified_at is null and cancelled_at is null;
create index subscriptions_open_product_idx on notifications.subscriptions (warehouse_id, product_id)
  where notified_at is null and cancelled_at is null;

-- Push tokens, kept ready for when Firebase is configured. Nothing sends to them yet.
create table notifications.device_tokens (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null,
  platform      text not null check (platform in ('ios', 'android', 'web')),
  token         text not null unique check (length(token) between 10 and 4096),
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now()
);

create index device_tokens_user_idx on notifications.device_tokens (user_id);

-- Stock received with an expiry date. Quantity is what came in for that batch; selling does not
-- reduce it (we do not pick by batch yet), so "expiring" is capped by what is on hand.
create table inventory.batches (
  id            uuid primary key default gen_random_uuid(),
  warehouse_id  text not null references inventory.warehouses (id),
  product_id    text not null,
  batch_code    text,
  quantity      integer not null check (quantity > 0),
  expires_on    date not null,
  received_at   timestamptz not null default now(),
  actor_id      uuid
);

create index batches_expiry_idx on inventory.batches (warehouse_id, expires_on);
create index batches_product_idx on inventory.batches (warehouse_id, product_id, expires_on);
