# Run the whole platform on your machine

Everything runs against a **local Postgres**. The scripts refuse to start against a remote
database, so the hosted Supabase project in a developer's `.env` is never touched.

## One time

```bash
createdb qc_dev && createdb qc_test
DATABASE_URL=postgresql://localhost:5432/qc_dev node scripts/db-migrate.mjs --reset --seed
DATABASE_URL=postgresql://localhost:5432/qc_test node scripts/db-migrate.mjs --reset --seed
pnpm install
```

Node 22 or newer must be on your PATH.

## Start and stop the backend

```bash
scripts/dev-stack.sh          # identity 4001, catalog 4002, inventory 4003, order 4004, delivery 4006, gateway 4000
scripts/dev-stack.sh stop
```

Logs are in `.dev-stack/`. Clients only ever talk to the gateway on port 4000.

## One order, end to end

```bash
node scripts/e2e.mjs
```

A customer signs in and orders, the warehouse packs it, a rider delivers it with the customer's
code, and the customer sees it delivered. CI runs the same script.

## Tests

```bash
TEST_DATABASE_URL=postgresql://localhost:5432/qc_test pnpm test
```

Integration tests are skipped when `TEST_DATABASE_URL` is not set.

## Seeded accounts (development only)

| Who               | How to sign in                                                   |
| ----------------- | ---------------------------------------------------------------- |
| Customer          | Any phone number, code `1234` (creates the user)                 |
| Rider             | `+919810000011`, `+919810000012`, `+919810000013`, code `123456` |
| Warehouse manager | `manager@tokajo.dev` / `tokajo-dev`                              |
| Warehouse staff   | `packer@tokajo.dev` / `tokajo-dev`                               |
| Admin             | `admin@tokajo.dev` / `tokajo-dev`                                |

The fixed codes only work while `OTP_MODE=demo`, which is the default outside production. In
production the identity service refuses to start without an SMS provider.

## How a request flows

```
app ──► gateway :4000 ──► identity / catalog / inventory / order / delivery
        verifies the token, checks the role for the route, adds signed identity headers
order ──► catalog (prices) ──► inventory (pick warehouse, hold stock, sell, restock)
order ──► delivery (create delivery when packed)    delivery ──► order (picked up, delivered)
```

- Prices always come from the catalog. The app only sends product ids and quantities.
- `Idempotency-Key` makes a retried order return the same order, never a second one.
- The customer's delivery code is checked on the server. The rider app never receives it.
- `/internal/*` routes need a shared key and are never reachable through the gateway.

## Known differences from ARCHITECTURE.md

Services call each other over HTTP, not Pub/Sub. Payments are cash on delivery only. OTP is a fixed
demo code until an SMS provider (MSG91 with DLT registration) is configured. Not built: Razorpay,
push notifications, live map and rider location, proof of delivery photo, address book,
payment, notification and analytics services.
