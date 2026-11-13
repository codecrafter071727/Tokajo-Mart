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
scripts/dev-stack.sh          # identity 4001, catalog 4002, inventory 4003, order 4004, payment 4005, delivery 4006, payment 4005, notification 4007, gateway 4000
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

## Online payments (Razorpay)

Cash on delivery always works. Online payment turns on when these are set in the root `.env`
(never commit them; `.env` is gitignored):

| Variable                  | Where to get it                                                     |
| ------------------------- | ------------------------------------------------------------------- |
| `RAZORPAY_KEY_ID`         | Razorpay Dashboard, Test Mode, Account and Settings, API Keys       |
| `RAZORPAY_KEY_SECRET`     | Shown once when the key is generated                                |
| `RAZORPAY_WEBHOOK_SECRET` | Any strong random string you type when creating the webhook (below) |

Restart the stack after changing them. Without keys, checkout answers 503 "Online payments are not
configured".

How a payment flows:

1. The app places the order with `payment: "online"`. It waits in `pending_payment` with the stock
   held for 15 minutes, and has no delivery code yet.
2. The app calls `POST /v1/payments/orders/:orderId/checkout` and opens Razorpay Checkout with what
   it returns (`keyId`, `razorpayOrderId`, `amountPaise`, `name`, `description`, `prefill`).
3. On success the app sends `POST /v1/payments/verify` with `razorpayOrderId`, `razorpayPaymentId`
   and `razorpaySignature`. The server checks the signature and confirms the order.
4. The webhook confirms it too (whichever arrives first wins; both are safe to repeat). A payment
   that lands after the order expired or was cancelled is refunded automatically.
5. Cancelling a paid order refunds it in full. Unpaid orders expire after 15 minutes.

The webhook is optional in development, because step 3 confirms the order. To receive it anyway,
expose the gateway and register the URL in Razorpay (Test Mode, Account and Settings, Webhooks):

```bash
ngrok http 4000          # or: cloudflared tunnel --url http://localhost:4000
```

Webhook URL `https://<your-tunnel>/webhooks/razorpay`, secret = `RAZORPAY_WEBHOOK_SECRET`, events:
`payment.captured`, `payment.failed`, `order.paid`, `refund.processed`.

Test cards and UPI ids are on Razorpay's test mode page (for example UPI `success@razorpay`).

For CI and the end to end script, `PAYMENTS_FAKE_PROVIDER=1` swaps in a pretend Razorpay that never
calls the network, and the script signs its own webhook with `RAZORPAY_WEBHOOK_SECRET`:

```bash
PAYMENTS_FAKE_PROVIDER=1 RAZORPAY_WEBHOOK_SECRET=local-test scripts/dev-stack.sh
PAYMENTS_FAKE_PROVIDER=1 RAZORPAY_WEBHOOK_SECRET=local-test node scripts/e2e.mjs
```

The payment service refuses to start with the fake provider in production.

## Known differences from ARCHITECTURE.md

Services call each other over HTTP, not Pub/Sub. Payments are cash on delivery or Razorpay. OTP is a fixed
demo code until an SMS provider (MSG91 with DLT registration) is configured. Not built:
push notifications, live map and rider location, proof of delivery photo, address book,
notification and analytics services.

## More docs

- [Load tests](../tests/load/README.md): k6 scripts for browsing, checkout, warehouse and rider
  traffic against this local stack.
- [Runbooks](runbooks/README.md): what to do when payments, SMS, stock, dispatch or a service go
  wrong.
- [Decision records](adr/README.md): why the platform is built the way it is.
