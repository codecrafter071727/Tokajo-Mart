# 0005. Hold, sell, release and restock

Status: accepted, November 2026

## Context

Two customers must never buy the last item, and stock must stay correct when payments fail, orders
are cancelled or holds are abandoned.

## Decision

`inventory.stock_items` keeps `on_hand` and `reserved`; `available = on_hand - reserved`, with a
check that `reserved <= on_hand`. Placing an order holds stock with one conditional update per line
inside a transaction (all lines or none), keyed by the order id as the reservation reference. COD
orders sell the hold immediately; online orders sell it when payment is captured; holds expire
after their time (15 minutes for online orders) and a sweep releases them. Cancelling a sold order
restocks it. Every change to `on_hand` writes an append only row to `inventory.stock_movements`.

## Consequences

- No overselling, even under concurrent orders.
- The ledger can always be reconciled against `on_hand` (see the stock mismatch runbook).
- Stock must never be edited by hand; adjustments go through the adjust endpoint with a reason.
