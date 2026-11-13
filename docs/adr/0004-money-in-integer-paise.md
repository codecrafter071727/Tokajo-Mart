# 0004. All money is integer paise

Status: accepted, November 2026

## Context

Floating point rupees round badly (0.1 + 0.2), and totals must match to the paisa across the app,
the order service, Razorpay and refunds.

## Decision

Every amount on the wire, in the database and in code is an integer number of paise
(`price_paise`, `total_paise`, `amount_paise`). One shared function, `priceCart` in
`@qc/contracts`, prices a cart for both the apps and the order service. Rupees exist only when
formatting for display. The order table has a check that the total adds up.

## Consequences

- The app's preview and the server's charge cannot disagree.
- The server never accepts a price or total from a client; it prices from the catalog.
- Display code must divide by 100 and format consistently (`formatPaise`).
