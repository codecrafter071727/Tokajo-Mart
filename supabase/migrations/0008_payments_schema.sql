-- payments: online payments through Razorpay. Owned by the payment service.
-- One payment row per order. The webhook event table makes every webhook safe to receive twice.

create schema if not exists payments;

create table payments.payments (
  id                    uuid primary key default gen_random_uuid(),
  order_id              uuid not null unique,
  user_id               uuid not null,
  amount_paise          integer not null check (amount_paise > 0),
  currency              text not null default 'INR' check (currency = 'INR'),
  razorpay_order_id     text not null unique,
  razorpay_payment_id   text unique,
  status                text not null default 'created' check (
    status in ('created', 'captured', 'failed', 'refunded', 'partially_refunded')
  ),
  method                text,
  error_code            text,
  error_description     text,
  refunded_paise        integer not null default 0 check (refunded_paise >= 0),
  captured_at           timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint payments_refund_within_amount check (refunded_paise <= amount_paise)
);

create table payments.webhook_events (
  event_id     text primary key,
  type         text not null,
  received_at  timestamptz not null default now()
);

create table payments.refunds (
  id                  uuid primary key default gen_random_uuid(),
  payment_id          uuid not null references payments.payments (id),
  razorpay_refund_id  text not null unique,
  amount_paise        integer not null check (amount_paise > 0),
  status              text not null default 'pending' check (status in ('pending', 'processed', 'failed')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create trigger payments_updated_at before update on payments.payments
  for each row execute function public.set_updated_at();
create trigger refunds_updated_at before update on payments.refunds
  for each row execute function public.set_updated_at();

-- Orders may now be paid online. Replacing the check constraint drops the old one, which only
-- widens what is allowed, so no data is lost.
-- allow-destructive
alter table orders.orders drop constraint if exists orders_payment_method_check;
alter table orders.orders
  add constraint orders_payment_method_check check (payment_method in ('cod', 'online'));
