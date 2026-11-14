# Load tests (k6)

Four scripts that put realistic traffic through the gateway, plus a shared `lib.js`. They only
ever run against `localhost`: `lib.js` refuses any other `BASE_URL`.

## Before you run

```bash
brew install k6
DATABASE_URL=postgresql://localhost:5432/qc_dev node scripts/db-migrate.mjs --reset --seed
scripts/dev-stack.sh
```

The identity service must be in demo OTP mode (the default outside production), because the
scripts sign in with the fixed demo codes.

## Run

```bash
k6 run tests/load/browse.js                      # smoke profile, under a minute
PROFILE=load k6 run tests/load/checkout.js       # 5 minute steady load
PROFILE=stress k6 run tests/load/warehouse.js    # ramps past the load level
BASE_URL=http://127.0.0.1:4000 k6 run tests/load/rider.js
```

| Variable        | Default                                      | Used by          |
| --------------- | -------------------------------------------- | ---------------- |
| `PROFILE`       | `smoke` (or `load`, `stress`)                | all              |
| `BASE_URL`      | `http://localhost:4000`                      | all              |
| `WAREHOUSE_ID`  | `wh-noida-62`                                | browse, checkout |
| `CUSTOMER_POOL` | `8` customers signed in during setup         | checkout         |
| `MANAGER_EMAIL` | `manager@milcki.dev` (password `milcki-dev`) | warehouse        |
| `RIDER_PHONES`  | the three seeded riders                      | rider            |

## What each script proves

| Script         | Traffic                                                                 | Proves                                                                                   |
| -------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `browse.js`    | categories, product list, search, product detail, stock availability    | the public read path stays fast as shoppers grow                                         |
| `checkout.js`  | place a COD order, send the same request again, cancel it               | ordering holds up, the Idempotency-Key never makes a duplicate, cancel returns the stock |
| `warehouse.js` | warehouse queue and handover list every 4 s, like the warehouse tablets | many open packing screens do not slow the order and delivery services                    |
| `rider.js`     | rider state every 4 s while online, like the rider app                  | dispatch reads hold up with many riders on duty                                          |

`checkout.js` cancels every order it places, so stock comes back and a run can be repeated on the
same database. It still writes orders, so never point it at anything but a local database.

## Thresholds

ARCHITECTURE.md asks for an alert on gateway p95 latency but sets no number, so these are ours,
for a laptop running every service at once:

- fewer than 1% failed requests, more than 99% of checks passing
- p95: categories and product detail under 200 ms, availability under 250 ms, product list,
  queue, handovers and rider state under 300 ms, search under 400 ms, placing or cancelling an
  order under 800 ms
- `duplicate_orders` must stay at 0

A failed threshold makes k6 exit non zero, so the scripts can run in CI later.

## Reading the results

- `http_req_duration{name:...}` rows: the p95 column against the thresholds above.
- `http_req_failed`: anything above 0 is worth a look in the service logs (`.dev-stack/*.log`).
- `checks`: which step failed, by name.
- `rate_limited`: requests the services answered with 429 (counted apart from real errors).

## Limits you will meet on purpose

These are protections, not bugs. The load and stress profiles are expected to reach them:

- Every service allows 300 requests a minute per client address. Behind the gateway all traffic
  comes from one address, so each service tops out near 300 a minute in local tests. The
  `rate_limited` counter shows when that happens. Raising it for production needs the gateway to
  pass the real client address through and the services to key on it.
- Sign in is limited to 10 requests a minute per client by the identity service (and 20 at the
  gateway), and each phone may ask for 5 codes an hour. That is why sessions are created once in
  setup, 13 seconds apart, so `checkout.js` spends about two minutes signing in before the load
  starts.
  Rerunning `rider.js` more than five times in an hour runs the seeded riders out of codes.
- Placing orders is limited to 30 a minute per customer. Raise `CUSTOMER_POOL` for heavier runs.
