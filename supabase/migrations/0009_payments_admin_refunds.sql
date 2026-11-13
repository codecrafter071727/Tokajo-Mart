-- Admin refunds: partial refunds started by an admin, each with a reason and an idempotency key,
-- and the order number and customer kept on the payment so the payments list needs no join.

alter table payments.payments add column if not exists order_number text;
alter table payments.payments add column if not exists customer_name text;
alter table payments.payments add column if not exists customer_phone text;
create index if not exists payments_created_idx on payments.payments (created_at desc);
create index if not exists payments_order_number_idx on payments.payments (order_number);

-- A refund row is written before Razorpay is called, so it has no Razorpay id at first
alter table payments.refunds alter column razorpay_refund_id drop not null;
alter table payments.refunds add column if not exists reason text;
alter table payments.refunds add column if not exists actor_id uuid;
alter table payments.refunds add column if not exists idempotency_key text;
create unique index if not exists refunds_idempotency_key_idx
  on payments.refunds (idempotency_key) where idempotency_key is not null;
