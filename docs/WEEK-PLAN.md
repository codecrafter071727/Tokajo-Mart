# One-week plan: Vishu and Anshul

Goal for the week: **one real order, end to end, on staging.** A customer signs in on the app, browses real catalog data, pays by COD, the warehouse packs the order on the web, a rider delivers it, and the customer sees live status.

This is a thin slice, not the full platform. ARCHITECTURE.md budgets 8 weeks for everything. Today the customer app is ~7,200 lines of UI on mock data; every service is a ~40 line skeleton, the web apps are ~25 lines each, the rider app is empty, and there are no database migrations. What we skip is listed at the bottom.

## Status: Vishu's lane (updated Nov 12)

All of Vishu's items are built and on `main`. The ones that depend on Anshul's services run on demo data behind interfaces, so switching to the real services changes one file each, not the screens.

| Item                     | State                                                                                                                                               |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| V1 contracts, api-client | Done. Catalog and inventory contracts, a typed client with timeouts, cancellation and typed errors, and `updateProduct`.                            |
| V2 catalog service       | Done. List, ranked search, paging, detail and `PATCH` edit. 16 tests.                                                                               |
| V3 inventory service     | Done. Serviceability and availability. 14 tests.                                                                                                    |
| V4, V6 app data layer    | Done. Home, categories, search and product pages read the API with loading, error and empty states. Real ETA and stock states.                      |
| V5 login                 | Built on demo OTP `1234`: persisted session, route guard, onboarding. Needs Anshul's identity service for real phone OTP. Address is still fixed.   |
| V7 cart and checkout     | Built. One pricing function in paise for cart, checkout and order; idempotent order placing; cash on delivery only. Needs the order service.        |
| V8 orders and tracking   | Built. Orders list with working filters and Reorder, tracking with status over time and the delivery code. Needs the order service for live status. |
| V9 rider app             | Built. Login, online toggle, offers with countdown, the full delivery flow with the 4 digit handover code, earnings. Needs the delivery service.    |
| V10 admin web            | Built. Catalog table with edit, orders and riders pages. Orders and riders are demo data until the order and delivery services exist.               |

**What Anshul needs to provide, and where it plugs in:**

- **Database (A1):** implement `CatalogRepository` and `InventoryRepository` with Kysely and swap them in each service's `buildApp`. Routes and tests stay as they are.
- **Gateway and identity (A2):** route `/v1/catalog/*` to port 4002 and `/v1/inventory/*` to 4003, enforce the admin role on `PATCH /v1/catalog/products/:id`, and issue real sessions. The customer app and rider app then replace their demo sign in.
- **Order service (A3, A7):** publish the order contract. The draft is `apps/customer-app/src/lib/orders.ts` (`Order`, `PlaceOrderInput`, `OrderRepository`). Implement an HTTP `OrderRepository` in the app and the screens work unchanged. The service must price the order itself from the items, as the in-memory one does, and honour the idempotency key.
- **Delivery service (A4):** the draft is `apps/rider-app/src/lib/delivery.ts` (`Delivery`, the actions, `DeliveryRepository`). The state machine and its rules (every item checked, the customer's code to finish) are tested there and should be mirrored on the server.
- **Admin pages:** the demo types in `apps/admin-web/src/lib/demo.ts` become the real order and delivery contracts.

**Not done:** real payments (Razorpay), push notifications, live map, proof of delivery photo, address capture and editing, and a shared UI package (the rider app copies the customer app's design tokens).

## Day 0 (before anything else): repo security cleanup

Nothing else starts until this is done. A worm-style payload reached `main` and also sits in other repos on Vishu's Mac, so both accounts and both machines are treated as exposed. The full checklist, with the exact commands, is in [SECURITY-CLEANUP.md](SECURITY-CLEANUP.md).

Already done: `main` on GitHub is clean and the 15 dependabot branches are deleted.

| Owner  | Day 0 task                                                                                                                                                  |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vishu  | From a clean device: rotate every credential, revoke GitHub sessions, tokens and SSH keys. Wipe or clean the Mac. Clean and report the other infected repos |
| Anshul | Check your machine for the payload and clean it. Repo owner account: rotate Actions and GCP secrets, turn on branch protection, commit the security guard   |

Until both machines are clean, do not open the repo in VS Code or Cursor and do not run `pnpm dev`, `start` or `build`.

## Who owns what (lanes)

Rule: **you only edit files in your lane.** If you need a change in the other lane, open a PR or ask. This is what prevents merge conflicts.

The split is by feature, so each of us owns a feature from database access to screen:

- **Vishu: the catalog side.** Everything about what we sell and who shops: customer app, rider app, catalog, inventory, admin web.
- **Anshul: the order side.** Everything about an order's life: database, auth, orders, delivery, warehouse web, CI and deploys.

| Lane            | Owner  | Paths                                                                                                                                                                                                                                                         |
| --------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A: Catalog side | Vishu  | `apps/customer-app/**`, `apps/rider-app/**`, `apps/admin-web/**`, `services/catalog/**`, `services/warehouse-inventory/**`, `packages/api-client/**`, `packages/contracts/src/{catalog,inventory}.ts`                                                         |
| B: Order side   | Anshul | `supabase/**` (all migrations), `services/{identity,gateway,order,delivery,notification,payment,analytics}/**`, `packages/service-kit/**`, `packages/contracts/src/{identity,order,delivery,warehouse}.ts`, `apps/warehouse-web/**`, `.github/**`, `infra/**` |
| Shared          | both   | root `package.json`, `pnpm-lock.yaml`, `turbo.json`, `ARCHITECTURE.md`, `docs/**`, `packages/ui-web/**` (add new files only, never edit the other person's)                                                                                                   |

Working agreements:

- **Contract first.** Each of us publishes request and response shapes for our features in `packages/contracts` on Day 1. The other builds against fixtures until the real API lands, so neither waits.
- **One owner for migrations.** Only Anshul writes `supabase/migrations`, so numbering never collides. Vishu sends table needs in chat on Day 1 (catalog and inventory first).
- **Branches:** `vishu/<thing>` and `anshul/<thing>`, one PR per feature, squash merge, under 400 changed lines where possible. Rebase on `main` before opening the PR. The other person reviews.
- **Lockfile:** never hand-merge `pnpm-lock.yaml`. On conflict, take main's version and run `pnpm install`.
- **New dependency:** say it in chat first, add it in its own small PR.
- **Daily 15 minute sync**, same time every day: what shipped, what is blocked, what each of us needs from the other.
- Commit messages follow the existing commitlint config (`feat:`, `fix:`, `style:`).

## Workload (in dev-days, so it is even)

| Vishu                                                          | Days     | Anshul                                                                 | Days     |
| -------------------------------------------------------------- | -------- | ---------------------------------------------------------------------- | -------- |
| V1 Catalog and inventory contracts, `api-client`               | 1.0      | A1 Database schema, migrations, seed data                              | 1.5      |
| V2 Catalog service (list, search, detail)                      | 1.0      | A2 Identity and gateway (JWT, roles, routing)                          | 1.5      |
| V3 Inventory and serviceability service                        | 1.0      | A3 Order service (pricing, reserve stock, create, status, idempotency) | 2.5      |
| V4 Customer app: API layer, loading, empty, error states       | 0.5      | A4 Delivery service (assignment, status)                               | 1.5      |
| V5 Customer app: auth and address                              | 1.0      | A5 Warehouse web: live queue, pick and pack, handover                  | 2.0      |
| V6 Customer app: home, categories, search, product on real API | 1.5      | A6 CI, staging deploy, runbook, security guard                         | 2.0      |
| V7 Customer app: cart and checkout (COD)                       | 1.5      | A7 Contracts for identity, order, delivery, warehouse                  | 0.5      |
| V8 Customer app: orders list and live tracking                 | 1.0      |                                                                        |          |
| V9 Rider app: login, assigned order, picked up, delivered      | 1.5      |                                                                        |          |
| V10 Admin web: catalog edit, orders list, rider list           | 1.5      |                                                                        |          |
| **Total**                                                      | **11.5** | **Total**                                                              | **11.5** |

Each of us also has 0.5 day of buffer for bugs and polish, so both are planned at 12 days of work over Days 1 to 6. Day 7 is shared QA.

## Day by day

Each person is planned at about 2 dev-days per day.

| Day | Vishu                                                                            | Anshul                                                                             | Handoff at end of day                                    |
| --- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------- |
| 1   | V1 contracts and `api-client`. V4 API layer and states. Start V2 catalog service | A7 contracts. A1 catalog and inventory tables plus seed first. Start A6 (CI guard) | Contracts from both merged. Catalog tables and seed load |
| 2   | Finish V2. V3 inventory service. Start V5 auth (test phone numbers, no real SMS) | Finish A1 schema. A2 identity and gateway. Start A3 order service                  | Gateway authenticates requests and routes to catalog     |
| 3   | Finish V5 auth and address. V6 home, categories, search, product on real data    | Finish A2. A3 pricing, stock reservation, create order                             | App browses real data on staging                         |
| 4   | V7 cart and checkout (against fixtures). Start V8 orders list                    | Finish A3 (status transitions, idempotency). A4 delivery service                   | Order service and delivery service callable              |
| 5   | V8 live tracking and switch checkout to the live order API. V9 rider app         | A5 warehouse web queue and pick and pack. A6 staging deploy through CI             | Order goes placed, packed, out for delivery              |
| 6   | V10 admin web. Polish and bug fixes                                              | Finish A5 handover. A6 runbook. Bug fixes                                          | Everything on staging, builds installable                |
| 7   | Shared: full test on a real phone, fix list, EAS preview builds, demo script     | Shared: same, plus deploy and rollback check                                       | Demo: one order from tap to delivered                    |

### Handoffs that could block someone

| Needed by      | What                                      | From   | Due           |
| -------------- | ----------------------------------------- | ------ | ------------- |
| Vishu (V2)     | Catalog and inventory tables, seed data   | Anshul | End of Day 1  |
| Vishu (V5, V6) | Working login and gateway routing         | Anshul | Morning Day 3 |
| Vishu (V7)     | Order contract (shapes only)              | Anshul | End of Day 1  |
| Vishu (V8)     | Live order create, get and list API       | Anshul | End of Day 4  |
| Vishu (V9)     | Delivery service and contract             | Anshul | End of Day 4  |
| Anshul (A3)    | Catalog prices and stock check endpoint   | Vishu  | End of Day 2  |
| Anshul (A5)    | Product names and images for pick screens | Vishu  | End of Day 2  |
| Anshul (A2)    | Serviceability check (is address served)  | Vishu  | End of Day 3  |

If a day slips, protect the order flow (Days 1 to 5) and drop V10 (admin web) and the polish buffers first.

## Definition of done for the week

- A new user signs up, adds items, places a COD order, and sees live status.
- The warehouse web shows that order, packs it, and a rider marks it delivered.
- `pnpm typecheck` and `pnpm lint` pass in CI. Staging is deployed from `main` by CI only.
- Both of us can run the stack from a clean clone using `README.md`.

## Not in week one (explicit cuts)

Razorpay live payments (test mode only if time), Apple sign-in, real SMS OTP (needs DLT registration), referrals and wallet, returns, support chat, analytics service, Hindi, dark mode, store submissions, load testing, production deploy on the client's GCP. These follow the 8-week map in ARCHITECTURE.md section 18.

## Risks

- **Repo compromise** (see Day 0). Biggest risk to the week.
- **Realtime on custom Postgres schemas** is flagged as a spike in ARCHITECTURE.md. If it fails on Day 5, fall back to polling every 5 seconds for tracking.
- **Expo Go limits:** the app currently runs in Expo Go, which has no Razorpay or Firebase push. Real payments and push need a development build.
- **Product photos** are hotlinked from Open Food Facts and Unsplash. Fine for the demo; host our own images before launch.
- **Estimates are guesses.** If either of us is more than half a day behind at the Day 3 sync, move work to the other person's buffer instead of staying late.
