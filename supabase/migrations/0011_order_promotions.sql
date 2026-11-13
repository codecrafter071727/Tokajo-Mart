-- Promotions: coupon codes the order service checks and applies. Owned by the order service.
-- A redemption is written in the same transaction as the order, under a lock on the coupon row, so
-- usage limits hold even when two customers race for the last use. A cancelled or expired order
-- deletes its redemption, which gives the use back.

create table orders.coupons (
  id                    uuid primary key default gen_random_uuid(),
  code                  text not null check (code ~ '^[A-Z0-9]{3,20}$'),
  title                 text not null check (length(trim(title)) > 0),
  description           text not null default '',
  type                  text not null check (type in ('percent', 'flat', 'free_delivery')),
  -- percent: whole percent 1 to 100; flat: paise; free_delivery: 0
  value                 integer not null default 0 check (value >= 0),
  max_discount_paise    integer check (max_discount_paise is null or max_discount_paise > 0),
  min_order_paise       integer not null default 0 check (min_order_paise >= 0),
  starts_at             timestamptz,
  ends_at               timestamptz,
  usage_limit_total     integer check (usage_limit_total is null or usage_limit_total > 0),
  usage_limit_per_user  integer check (usage_limit_per_user is null or usage_limit_per_user > 0),
  first_order_only      boolean not null default false,
  active                boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint coupons_percent_range check (type <> 'percent' or (value between 1 and 100)),
  constraint coupons_flat_positive check (type <> 'flat' or value > 0),
  constraint coupons_window check (starts_at is null or ends_at is null or starts_at < ends_at)
);

-- Codes are stored upper case, so this also makes them unique ignoring case
create unique index coupons_code_idx on orders.coupons (code);

create trigger coupons_updated_at before update on orders.coupons
  for each row execute function public.set_updated_at();

create table orders.coupon_redemptions (
  id              uuid primary key default gen_random_uuid(),
  coupon_id       uuid not null references orders.coupons (id),
  order_id        uuid not null unique references orders.orders (id) on delete cascade,
  user_id         uuid not null,
  discount_paise  integer not null check (discount_paise >= 0),
  created_at      timestamptz not null default now()
);

create index coupon_redemptions_coupon_idx on orders.coupon_redemptions (coupon_id, user_id);

-- The discount is part of the order, so the total check has to include it.
-- allow-destructive: drops only the old check constraint, which is recreated just below.
alter table orders.orders add column discount_paise integer not null default 0 check (discount_paise >= 0);
alter table orders.orders add column coupon_code text;
alter table orders.orders drop constraint orders_total_adds_up; -- allow-destructive
alter table orders.orders add constraint orders_total_adds_up check (
  total_paise = item_total_paise + delivery_fee_paise + handling_fee_paise + tip_paise - discount_paise
);
