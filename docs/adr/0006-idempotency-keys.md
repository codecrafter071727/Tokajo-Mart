# 0006. Idempotency keys on order and refund creation

Status: accepted, November 2026

## Context

Mobile networks drop responses. A customer tapping "Place order" again, or the app retrying, must
never create two orders or two charges. The same applies to admin refunds.

## Decision

`POST /v1/orders` and admin refunds require an `Idempotency-Key` header. Orders are unique on
`(user_id, idempotency_key)`; a repeat returns the existing order with 200 instead of 201, and a
race between two identical requests resolves to one order through the unique constraint.
Internal calls are idempotent by their natural keys instead (reservation reference, order id,
Razorpay event id).

## Consequences

- Clients generate one key per checkout attempt and reuse it on retry.
- Keys are scoped per customer, so two customers can never collide.
- The load test checks that a retried request never creates a duplicate.
