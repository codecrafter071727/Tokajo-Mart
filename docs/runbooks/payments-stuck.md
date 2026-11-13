# Payments stuck

Online orders start as `pending_payment` with their stock held for 15 minutes. A payment is
confirmed either by the app (signature check on `POST /v1/payments/verify`) or by the Razorpay
webhook (`POST /webhooks/razorpay`, events `payment.captured`, `order.paid`, `payment.failed`,
`refund.processed`, `refund.failed`). Either one calls the order service
`POST /internal/orders/:id/payment-captured`, which confirms the order and sells the held stock.
Unpaid orders expire after 15 minutes and give the stock back.

## Symptom: customer paid but the order is not confirmed

```sql
-- The payment and the order side by side
select p.order_id, p.status as payment, p.razorpay_order_id, p.razorpay_payment_id,
       p.captured_at, o.number, o.status as order_status, o.placed_at
from payments.payments p
join orders.orders o on o.id = p.order_id
where p.status = 'captured' and o.status <> 'confirmed'
  and o.status not in ('packing','packed','picked_up','out_for_delivery','delivered','cancelled');
```

- Payment `captured` and order still `pending_payment`: the call to the order service failed.
  Repeat it; it is idempotent:
  ```bash
  curl -s -X POST -H "x-internal-key: $KEY" localhost:4004/internal/orders/<orderId>/payment-captured
  ```
- Order already `expired` but money captured: the payment came after the 15 minute window. Do not
  revive the order (its stock was released). Refund in full from admin (Payments, the order,
  Refund) and tell the customer.
- Payment still `created` but Razorpay shows it captured: the webhook never arrived and the app
  did not verify. Check the webhook (next section), then confirm the capture in the Razorpay
  dashboard before doing anything.

## Symptom: webhooks not arriving

```sql
select type, count(*), max(received_at) from payments.webhook_events
group by type order by max(received_at) desc;
```

- No recent rows: in the Razorpay dashboard check the webhook URL points at the gateway
  `/webhooks/razorpay`, the events above are enabled, and the secret matches
  `RAZORPAY_WEBHOOK_SECRET`. Locally the gateway must be exposed with a tunnel (see
  [../LOCAL-STACK.md](../LOCAL-STACK.md)).
- Rows arrive but nothing changes: the payment service log shows a signature failure when the
  secret is wrong. Duplicate event ids are ignored on purpose.

## Symptom: refunds failing

```sql
select r.razorpay_refund_id, r.amount_paise, r.status, r.created_at, p.order_id, p.refunded_paise, p.amount_paise
from payments.refunds r join payments.payments p on p.id = r.payment_id
where r.status <> 'processed' order by r.created_at desc limit 20;
```

- `failed`: read the reason in the Razorpay dashboard (often low balance on the account or the
  payment too old). Retry from admin (Payments, Refund); refunds can never exceed what was paid.
- `pending` for over a day: Razorpay is still processing; check the dashboard before retrying, or
  the customer may be refunded twice.
- A cancelled paid order with no refund row: the order service could not reach the payment
  service at cancel time. Refund from admin.

## Escalate

Captured money with no order and no refund older than 2 hours is SEV2. Any sign of a wrong
amount charged or refunded is SEV1.
