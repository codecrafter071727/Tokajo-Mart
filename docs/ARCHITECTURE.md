# Quick Commerce Platform: Architecture & Project Base

> Working name: **QC Platform** (npm scope `@qc/*`, rename once the client picks a brand).
> Built by TheHXD. Source of truth for structure, conventions and decisions. Update it in the same PR as any change that contradicts it.

| Item                | Value                                                                 |
| ------------------- | --------------------------------------------------------------------- |
| Model               | Warehouse (dark store) quick commerce, Blinkit-style                  |
| Surfaces            | Customer app, Rider app, Warehouse website, Main admin website        |
| Timeline            | 8 weeks (see [section 18](#18-8-week-delivery-map))                   |
| Team                | 2 co-founder developers                                               |
| Infra budget target | Rs. 2,100 to 4,500/month in the first 6 months (quoted to the client) |
| Locked decisions    | Next.js (web), React Native (apps), Fastify (backend microservices)   |

---

## Table of contents

1. [System overview](#1-system-overview)
2. [Tech stack](#2-tech-stack)
3. [Monorepo structure](#3-monorepo-structure)
4. [Services](#4-services)
5. [Service-to-service communication](#5-service-to-service-communication)
6. [Event catalog](#6-event-catalog)
7. [Data architecture](#7-data-architecture)
8. [Auth and authorization](#8-auth-and-authorization)
9. [Core flows](#9-core-flows)
10. [Location handling](#10-location-handling)
11. [API and coding conventions](#11-api-and-coding-conventions)
12. [Client apps](#12-client-apps)
13. [Infrastructure and deployment](#13-infrastructure-and-deployment)
14. [Observability](#14-observability)
15. [Security and compliance](#15-security-and-compliance)
16. [Testing strategy](#16-testing-strategy)
17. [Local development and workflow](#17-local-development-and-workflow)
18. [8-week delivery map](#18-8-week-delivery-map)
19. [Decision log](#19-decision-log)
20. [Risks, assumptions, client dependencies](#20-risks-assumptions-client-dependencies)
21. [Week 1 bootstrap checklist](#21-week-1-bootstrap-checklist)

---

## 1. System overview

### 1.1 Surfaces

| Surface         | Users                                | Tech                               | Notes                                                                                         |
| --------------- | ------------------------------------ | ---------------------------------- | --------------------------------------------------------------------------------------------- |
| `customer-app`  | Customers                            | React Native (Expo), Android + iOS | Browse, cart, checkout, tracking, reorder                                                     |
| `rider-app`     | Delivery riders                      | React Native (Expo), Android + iOS | Offers, handover, navigation, proof of delivery, earnings                                     |
| `warehouse-web` | Warehouse managers, pickers, packers | Next.js 15, responsive             | Used on a desktop at the packing desk or a phone/tablet on the floor. Scoped to one warehouse |
| `admin-web`     | Platform owner, admin team           | Next.js 15                         | Whole network: warehouses, catalog, orders, riders, customers, analytics, marketing           |

### 1.2 High-level diagram

```
 Customer App (RN)   Rider App (RN)   Warehouse Web (Next)   Admin Web (Next)
        \                 |                  |                    /
         \________________|__________________|___________________/
                          |   HTTPS + Supabase JWT
                    ┌─────▼───────┐
                    │   gateway   │   Fastify: authN, rate limit, routing, BFF aggregation
                    └─────┬───────┘
                          │  Internal ALB + IAM task roles, private ECS services
   ┌──────────┬───────────┼────────────┬───────────┬────────────┬───────────────┐
┌──▼───┐  ┌───▼───┐  ┌────▼──────────┐ ┌▼─────┐  ┌──▼────┐  ┌───▼─────┐  ┌──────▼───────┐
│identi│  │catalog│  │warehouse-     │ │order │  │payment│  │delivery │  │notification  │
│ty    │  │       │  │inventory      │ │      │  │       │  │         │  │              │
└──┬───┘  └───┬───┘  └────┬──────────┘ └┬─────┘  └──┬────┘  └───┬─────┘  └──────┬───────┘
   └──────────┴───────────┴──────┬──────┴───────────┴───────────┴───────────────┘
                                 │                               ┌───────────┐
        Supabase Postgres (+PostGIS)  schema per service ────────►│ analytics │ (read-only role)
        Supabase Auth · Realtime · Storage                       └───────────┘
        Amazon SNS + SQS (domain events) · SQS delay queues · EventBridge Scheduler

 External: Razorpay · Google Maps Platform · FCM/APNs · Resend · MSG91/Twilio (SMS OTP)
```

### 1.3 Architectural principles

1. **One owner per piece of data.** A table belongs to exactly one service schema. Other services get it through that service's API or through events, never through SQL joins.
2. **Sync only on the critical path.** HTTP between services only when the user is waiting on the answer (serviceability, stock reserve, pricing). Everything else is an event.
3. **Realtime goes to clients through Supabase Realtime,** not through our services. Services write rows, clients subscribe to rows they are allowed to see (RLS).
4. **Money is integers** (paise). Time is UTC `timestamptz`. IDs are UUIDs.
5. **Every write path that can be retried is idempotent** (checkout, payments, webhooks, event consumers).
6. **Cheap by default.** ECS Fargate desired count starts at 1 (0 in staging if idle cost matters), small images, small connection pools, no always-on infra beyond Supabase.
7. **Start modular, split later.** Fewer deployables with strict internal module boundaries beats more deployables with leaky ones.

---

## 2. Tech stack

| Layer                      | Choice                                                                 | Notes                                                                  |
| -------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Language                   | TypeScript (strict) everywhere                                         | One language across apps, web, services                                |
| Runtime                    | Node.js 22 LTS                                                         | Pin in `.nvmrc` and Dockerfiles                                        |
| Package manager / monorepo | pnpm workspaces + Turborepo                                            | Remote cache optional                                                  |
| Backend framework          | **Fastify** (v5)                                                       | One app per service                                                    |
| Validation / schemas       | Zod + `fastify-type-provider-zod`                                      | Same schemas power validation, types and OpenAPI                       |
| API docs                   | `@fastify/swagger` + Swagger UI                                        | OpenAPI per service, merged at gateway                                 |
| API client                 | Generated from OpenAPI into `@qc/api-client`                           | Used by web and mobile                                                 |
| Database                   | Supabase Postgres + PostGIS + `pg_trgm`                                | One project, schema per service                                        |
| DB access                  | Kysely + `kysely-codegen` (types from live DB)                         | Migrations are plain SQL (Supabase CLI)                                |
| Auth                       | Supabase Auth (phone OTP, Google, Apple, email+password for web staff) | Custom Access Token Hook adds role claims                              |
| Realtime                   | Supabase Realtime (Postgres changes + Broadcast)                       | RLS-protected                                                          |
| File storage               | Supabase Storage                                                       | Product images, rider docs, POD photos, invoices                       |
| Async messaging            | Amazon SNS + SQS                                                       | Filter policies; SQS consumers (private services cannot take SNS HTTP) |
| Delayed jobs               | SQS delay queues                                                       | Offer timeouts, reservation expiry (SQS max delay 15 minutes)          |
| Cron                       | Amazon EventBridge Scheduler                                           | Minimal job count, see [section 13.4](#134-scheduled-jobs)             |
| Compute                    | Amazon ECS on Fargate                                                  | One service per backend service and per web app                        |
| Secrets                    | AWS Secrets Manager                                                    |                                                                        |
| Container registry         | Amazon ECR                                                             |                                                                        |
| CI/CD                      | GitHub Actions (OIDC → IAM role) and EAS (mobile)                      |                                                                        |
| Payments                   | Razorpay (UPI, cards, netbanking, wallets) + COD                       | Orders API + webhooks                                                  |
| Maps                       | Google Maps Platform                                                   | Geocoding, Places (address), Directions/Distance Matrix, Maps SDK      |
| Push                       | Firebase Cloud Messaging                                               | `@react-native-firebase/messaging` on the apps                         |
| Email                      | Resend                                                                 |                                                                        |
| SMS OTP                    | MSG91 (or Twilio) via Supabase Send-SMS Hook                           | DLT registration required in India                                     |
| PDF                        | `pdf-lib` (invoices/receipts)                                          | Avoid headless Chrome on Fargate                                       |
| Logging                    | Pino (JSON) to CloudWatch Logs                                         |                                                                        |
| Errors                     | Sentry (apps, web, services)                                           | Free tier at start                                                     |
| Unit/integration tests     | Vitest                                                                 | Fastify `inject()` for routes                                          |
| Web E2E                    | Playwright                                                             |                                                                        |
| Mobile E2E                 | Maestro                                                                | Critical flows only                                                    |
| Lint / format              | ESLint (flat config) + Prettier                                        | Enforced in CI and pre-commit (lint-staged + husky)                    |

### 2.1 Backend plugin baseline (every service, via `@qc/service-kit`)

`@fastify/helmet`, `@fastify/cors`, `@fastify/sensible`, `@fastify/under-pressure` (health/backpressure), `@fastify/rate-limit`, `@fastify/swagger`, `@fastify/swagger-ui`, `fastify-type-provider-zod`, Pino request logging with request-id propagation, `jose` (JWKS JWT verification), `@aws-sdk/client-sts` / SigV4 (service-to-service), `@fastify/multipart` where uploads are needed.

### 2.2 Web baseline

Next.js 15 (App Router), Tailwind CSS, shadcn/ui, TanStack Query, TanStack Table, React Hook Form + Zod, Recharts (analytics), `@supabase/ssr` (session), `@vis.gl/react-google-maps`.

### 2.3 Mobile baseline

Expo (latest stable SDK at kickoff, with dev client / prebuild), Expo Router, TanStack Query, Zustand, `react-native-maps` (Google provider), `expo-location`, `@react-native-firebase/messaging`, `react-native-razorpay`, `@supabase/supabase-js` with `expo-secure-store` storage adapter, `expo-apple-authentication`, Google Sign-In, `expo-image`, EAS Build / Submit / Update.

---

## 3. Monorepo structure

```
qc-platform/
├── apps/
│   ├── customer-app/                 # Expo (React Native)
│   │   ├── app/                      # Expo Router routes
│   │   │   ├── (auth)/               # login, otp, onboarding
│   │   │   ├── (tabs)/               # home, categories, search, cart, account
│   │   │   ├── product/[id].tsx
│   │   │   ├── checkout/
│   │   │   ├── orders/[id].tsx       # tracking
│   │   │   └── _layout.tsx
│   │   ├── src/
│   │   │   ├── features/             # cart, catalog, checkout, orders, address, referral...
│   │   │   ├── components/
│   │   │   ├── lib/                  # supabase client, api client, push, location
│   │   │   ├── store/                # zustand stores
│   │   │   └── theme/
│   │   ├── app.config.ts
│   │   └── eas.json
│   ├── rider-app/                    # Expo (React Native), same layout, rider features
│   │   └── src/features/             # offers, active-delivery, handover, pod, earnings, trips
│   ├── warehouse-web/                # Next.js 15
│   │   ├── src/app/
│   │   │   ├── (auth)/login
│   │   │   ├── queue/                # live incoming orders
│   │   │   ├── orders/[id]/pick      # pick & pack workflow
│   │   │   ├── handover/
│   │   │   ├── inventory/            # stock, goods received, adjustments, batches
│   │   │   ├── reports/
│   │   │   └── settings/             # open/close, hours
│   │   └── src/{components,lib,hooks}
│   └── admin-web/                    # Next.js 15
│       └── src/app/
│           ├── (auth)/login
│           ├── dashboard/            # analytics
│           ├── warehouses/
│           ├── catalog/              # products, categories, CSV import
│           ├── inventory/
│           ├── orders/
│           ├── riders/
│           ├── customers/
│           ├── marketing/            # banners, coupons, push broadcasts
│           └── settings/             # fees, GST, staff accounts
│
├── services/
│   ├── gateway/
│   ├── identity/
│   ├── catalog/
│   ├── warehouse-inventory/
│   ├── order/
│   ├── payment/
│   ├── delivery/
│   ├── notification/
│   └── analytics/
│
├── packages/
│   ├── contracts/                    # zod schemas, event types, error codes, enums (single source of truth)
│   ├── api-client/                   # generated typed clients per service (from OpenAPI)
│   ├── service-kit/                  # Fastify bootstrap shared by all services
│   │   └── src/{app,auth,errors,logger,events,db,idempotency,health,internal-auth}.ts
│   ├── maps-client/                  # Google Maps server wrapper (geocode, distance matrix)
│   ├── ui-web/                       # shared shadcn-based components for the two web apps
│   ├── eslint-config/
│   └── tsconfig/
│
├── supabase/
│   ├── config.toml
│   ├── migrations/                   # ordered SQL, prefixed by schema (e.g. 0003_order_init.sql)
│   ├── seed.sql
│   └── functions/                    # only if an Edge Function is unavoidable (prefer services)
│
├── infra/
│   ├── docker/                       # shared Dockerfile templates, docker-compose.dev.yml (pubsub emulator)
│   ├── ecs/                          # per-service ECS/Fargate deploy config (services.json)
│   ├── sns/                          # topics.json, subscriptions.json (SNS + SQS)
│   ├── scheduler/                    # jobs.json
│   └── scripts/                      # bootstrap-gcp.sh, create-topics.sh, seed-staging.sh
│
├── .github/
│   ├── workflows/                    # ci.yml, deploy-services.yml, deploy-web.yml, eas-build.yml
│   ├── CODEOWNERS
│   └── pull_request_template.md
├── docs/
│   ├── ARCHITECTURE.md               # this file
│   ├── adr/                          # architecture decision records (0001-*.md ...)
│   ├── runbooks/                     # deploy, rollback, incident, razorpay-webhook-debug
│   └── api/                          # generated OpenAPI bundle
├── .nvmrc
├── .env.example
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
└── README.md
```

### 3.1 Standard service layout

Every service under `services/*` looks like this. Keep it identical so any service is navigable in seconds.

```
services/<name>/
├── src/
│   ├── server.ts                     # entry: build app, listen on $PORT
│   ├── app.ts                        # buildApp(): registers service-kit + modules
│   ├── config/env.ts                 # zod-validated environment, fails fast
│   ├── modules/
│   │   └── <module>/
│   │       ├── <module>.routes.ts    # public routes (exposed via gateway)
│   │       ├── <module>.internal.ts  # /internal/* routes (service-to-service only)
│   │       ├── <module>.service.ts   # business logic (no Fastify types)
│   │       ├── <module>.repo.ts      # DB access (Kysely), the only layer touching SQL
│   │       └── <module>.schemas.ts   # zod request/response schemas (re-exported from contracts if shared)
│   ├── events/
│   │   ├── publishers/               # typed publish helpers (write to outbox)
│   │   ├── consumers/                # one file per subscribed event, idempotent
│   │   └── outbox.worker.ts          # drains outbox to SNS
│   ├── clients/                      # typed clients for other services (from @qc/api-client)
│   ├── jobs/                         # handlers for /internal/jobs/:name
│   ├── db/{client.ts,types.generated.ts}
│   └── plugins/                      # service-specific Fastify plugins
├── test/{unit,integration}/
├── Dockerfile
├── package.json
├── tsconfig.json
└── .env.example
```

**Layering rule:** `routes → service → repo`. Routes never run SQL, repos never contain business rules, services never import Fastify.

### 3.2 Package responsibilities

| Package           | Purpose                                                                                                 | Rule                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `@qc/contracts`   | Zod schemas for DTOs, event payloads, enums (order status, roles), error codes                          | No runtime deps beyond zod. Breaking changes need a version bump on the event/route |
| `@qc/api-client`  | Typed HTTP clients generated from each service's OpenAPI                                                | Never hand-edited. Regenerated by `pnpm gen:api`                                    |
| `@qc/service-kit` | `createService()` bootstrap, JWT/role guards, error handler, logger, outbox, idempotency, internal auth | Every service uses it. Do not fork per service                                      |
| `@qc/maps-client` | Geocode, reverse geocode, distance matrix with caching                                                  | Server only                                                                         |
| `@qc/ui-web`      | Shared web components                                                                                   | Web apps only                                                                       |

---

## 4. Services

Nine deployables: one gateway plus eight domain services. Each section lists responsibility, owned data, public surface (through the gateway), internal surface, events, and dependencies.

### 4.1 `gateway`

**Responsibility:** the only public backend entry point.

- Verify the Supabase JWT (JWKS) and reject unauthenticated calls to protected routes.
- Coarse role check per route prefix (fine-grained authorization stays in each service).
- Rate limiting (per IP and per user, stricter on OTP and checkout).
- Proxy `/v1/<domain>/*` to the owning service over the internal ALB using the ECS task role (SigV4); forward `x-request-id`, user id, role and warehouse id as signed headers.
- **BFF aggregation endpoints** under `/v1/bff/*` for screens that need several services in one round trip (for example the customer home screen).
- Expose **public webhook endpoints** and forward them with the raw body untouched: Razorpay (`/webhooks/razorpay`) and Supabase Auth hooks (`/hooks/*`).
- Serve the merged OpenAPI document.

**Owns no data.** Stateless.

**Routing table**

| Public prefix                                                     | Target                                                          | Allowed roles                                          |
| ----------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------ |
| `/v1/identity/*`                                                  | identity                                                        | any authenticated (some admin-only)                    |
| `/v1/catalog/*`                                                   | catalog                                                         | public read for catalog browse, admin write            |
| `/v1/warehouses/*`, `/v1/inventory/*`                             | warehouse-inventory                                             | customer (serviceability only), warehouse roles, admin |
| `/v1/orders/*`, `/v1/cart/*`, `/v1/promotions/*`, `/v1/support/*` | order                                                           | by endpoint                                            |
| `/v1/payments/*`                                                  | payment                                                         | customer, admin                                        |
| `/v1/delivery/*`                                                  | delivery                                                        | rider, warehouse roles, admin, customer (tracking)     |
| `/v1/notifications/*`                                             | notification                                                    | any authenticated, admin for broadcasts                |
| `/v1/analytics/*`                                                 | analytics                                                       | warehouse_manager (scoped), admin                      |
| `/v1/bff/customer/*`                                              | gateway                                                         | customer                                               |
| `/v1/bff/rider/*`                                                 | gateway                                                         | rider                                                  |
| `/v1/bff/warehouse/*`                                             | gateway                                                         | warehouse roles                                        |
| `/v1/bff/admin/*`                                                 | gateway                                                         | admin                                                  |
| `/webhooks/razorpay`, `/hooks/*`                                  | payment, notification, identity (signature verified downstream) | public + signature                                     |

**BFF endpoints (initial)**

- `GET /v1/bff/customer/home?lat&lng` resolves serving warehouse (warehouse-inventory), then banners/collections/categories/products in stock (catalog, which holds the availability projection).
- `GET /v1/bff/customer/orders/:id/tracking` combines order status, rider info and live location pointer, delivery OTP (delivery).
- `GET /v1/bff/warehouse/queue` combines orders for the warehouse with pick-list summaries.

### 4.2 `identity`

**Responsibility:** who people are and what they are allowed to be.

**Modules:** `profiles`, `addresses`, `riders`, `staff`, `account-deletion`, `customers-admin`.

**Owns (schema `identity`):**

| Table               | Purpose                                                                                 |
| ------------------- | --------------------------------------------------------------------------------------- |
| `profiles`          | `id` (= `auth.users.id`), role, name, phone, email, status (active / blocked / deleted) |
| `addresses`         | Saved addresses with `lat`, `lng`, label, default flag, formatted address, pincode      |
| `rider_profiles`    | Vehicle, status (pending / active / suspended), KYC status                              |
| `rider_documents`   | Document type, storage path, verification status, reviewer, reviewed_at                 |
| `staff_profiles`    | `user_id`, `warehouse_id`, role (`warehouse_manager`, `warehouse_staff`)                |
| `deletion_requests` | Account deletion requests and processing state                                          |

**Public surface:** profile read/update, address CRUD, rider onboarding (admin), staff accounts (admin), block/unblock (admin), customer list and detail (admin), account deletion request.

**Internal surface:** `GET /internal/users/:id`, `GET /internal/users/batch`, `GET /internal/riders/:id`.

**Special duties**

- **Custom Access Token Hook** (Supabase): injects `app_role` and `warehouse_id` claims into every JWT from `profiles` / `staff_profiles`. Registered as an HTTPS hook routed through the gateway, signature-verified.
- Creates Supabase Auth users for staff and riders via the Auth Admin API (service role key only lives here).
- Geocodes and reverse-geocodes when an address is saved (`@qc/maps-client`).
- Account deletion: anonymize profile and addresses, keep order records required for tax/legal retention, emit `user.deleted`.

**Events:** publishes `user.created`, `user.blocked`, `user.deleted`, `rider.approved`, `rider.suspended`.

### 4.3 `catalog`

**Responsibility:** what we sell, how it is presented, and how it is found.

**Modules:** `products`, `categories`, `collections`, `banners`, `search`, `import`, `availability`, `affinity`.

**Owns (schema `catalog`):**

| Table                             | Purpose                                                                                                     |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `categories`                      | Hierarchical (category / subcategory), sort order, image                                                    |
| `products`                        | Name, description, brand, nutrition info, country of origin, shelf life, GST rate, active flag, soft delete |
| `product_variants`                | Weight/size option, SKU, barcode, `mrp_paise`, `price_paise`, GST handling                                  |
| `product_images`                  | Storage paths, sort order                                                                                   |
| `collections`, `collection_items` | Weekend Deals, Under 99, Flash Sale, with `starts_at` / `ends_at`                                           |
| `banners`                         | Image, deep link, schedule window, target warehouse(s) / city                                               |
| `product_availability`            | **Projection:** `(warehouse_id, variant_id, in_stock, updated_at)` fed by `stock.changed` events            |
| `product_affinity`                | Co-purchase counts feeding Frequently Bought Together                                                       |
| `product_stats`                   | Sales counts feeding Best Seller badge                                                                      |
| `import_jobs`                     | CSV import status and row-level errors                                                                      |

**Why the availability projection exists:** home, category and search must show only what the serving warehouse has in stock. Joining across services at read time is slow and couples catalog to inventory. Catalog keeps a small denormalized copy and answers in one query.

**Search:** `pg_trgm` + `tsvector` on product name, brand, category. Fuzzy match, prefix match, suggestions. Recent search history is stored on the client. No Elasticsearch.

**Badges:** Back in Stock (stock transition event), New Arrival (created within N days), Best Seller (from `product_stats`). Computed at read time from these tables.

**Time-windowed pricing and collections:** evaluate `starts_at` / `ends_at` at read time. Do not use activation cron jobs.

**Public surface:** browse (categories, collections, listing, detail, search, suggestions), admin CRUD, CSV import, image upload (signed upload URLs to Supabase Storage).

**Internal surface:** `POST /internal/products/batch-get` (used by order for pricing snapshot).

**Events:** publishes `product.upserted`, `product.deleted`. Consumes `stock.changed`, `order.confirmed` (affinity + stats).

### 4.4 `warehouse-inventory`

**Responsibility:** physical network and physical stock. The most correctness-critical service.

**Modules:** `warehouses`, `service-areas`, `serviceability`, `inventory`, `batches`, `receipts`, `adjustments`, `reservations`, `alerts`.

**Owns (schema `inventory`):**

| Table                                   | Purpose                                                                                                                          |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `warehouses`                            | Name, code, address, `location geography(Point)`, status, `is_open`, timezone                                                    |
| `warehouse_hours`                       | Operating hours per weekday                                                                                                      |
| `service_areas`                         | `warehouse_id`, type (`radius` / `pincode` / `polygon`), `geom`, `radius_m`, `pincode`, priority                                 |
| `stock_items`                           | `(warehouse_id, variant_id)` with `on_hand`, `reserved`, `reorder_level`, `rack_location`. `available = on_hand - reserved`      |
| `stock_batches`                         | Batch number, expiry date, quantity per stock item                                                                               |
| `stock_movements`                       | **Append-only ledger:** type (`grn`, `sale`, `adjustment`, `damage`, `expiry`, `return`), qty delta, reason, reference id, actor |
| `goods_receipts`, `goods_receipt_lines` | Inbound stock entries                                                                                                            |
| `reservations`, `reservation_lines`     | Per-order holds with `expires_at` and status (`held`, `committed`, `released`, `expired`)                                        |

**Serviceability and routing (v1 rules)**

1. Find warehouses whose service area contains the delivery point (PostGIS `ST_Covers` / `ST_DWithin` for radius, pincode match as fallback).
2. Keep those that are open and have **every** cart line available (no split shipments in v1).
3. Pick the nearest by straight-line distance (route distance can replace this later).
4. If none qualify, return either "outside service area" or the list of unavailable items, so the client can show the right message.

**Stock reservation rules**

- Reserve atomically: `UPDATE stock_items SET reserved = reserved + :qty WHERE ... AND on_hand - reserved >= :qty`. Zero rows updated means insufficient stock. No read-then-write.
- Reservation TTL (default 10 minutes) enforced by a Cloud Task per reservation plus a sweep job as a safety net.
- Commit (decrement `on_hand`, clear `reserved`, write `sale` movement) on `order.confirmed`. Release on cancel or expiry.
- Every change writes a `stock_movements` row. The ledger must always reconcile with `on_hand`.

**Public surface:** serviceability lookup, warehouse CRUD (admin), service area CRUD, stock views, goods received, adjustments with reason, batch and expiry views, open/close toggle, hours.

**Internal surface:** `POST /internal/serviceability/resolve`, `POST /internal/reservations` (reserve), `POST /internal/reservations/:id/commit`, `POST /internal/reservations/:id/release`, `POST /internal/stock/availability`.

**Events:** publishes `stock.changed` (with `inStockChanged` and `backInStock` flags), `stock.low`, `batch.near_expiry`, `warehouse.updated`. Consumes `order.confirmed`, `order.cancelled`.

### 4.5 `order`

**Responsibility:** from cart to delivered (and returned). The largest service, deliberately organized as strict internal modules so pieces can be extracted later.

**Modules:** `cart`, `pricing`, `checkout`, `orders` (state machine), `fulfilment` (pick/pack), `promotions` (coupons, referrals, wallet), `returns`, `ratings`, `invoices`, `support`, `settings`.

**Owns (schema `orders`):**

| Table                                 | Purpose                                                                                              |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `carts`, `cart_items`                 | Server-side persistent cart per user                                                                 |
| `orders`                              | Public order number, user, warehouse, address snapshot, totals (paise), payment method, status, slot |
| `order_items`                         | **Snapshot** of name, variant, price, MRP, GST at purchase time                                      |
| `order_status_history`                | Every transition with actor and timestamp                                                            |
| `pick_lists`, `pick_list_items`       | Generated per order, with rack location, picked quantity, flags                                      |
| `coupons`, `coupon_redemptions`       | Code, rules, limits, expiry                                                                          |
| `referral_codes`, `referrals`         | Referral relationships and reward state                                                              |
| `wallets`, `wallet_transactions`      | Store credits ledger (append-only)                                                                   |
| `returns`, `return_items`             | Return/replacement requests                                                                          |
| `ratings`                             | Product and rider ratings                                                                            |
| `invoices`                            | Invoice number, PDF storage path                                                                     |
| `support_tickets`, `support_messages` | Basic support and chat                                                                               |
| `platform_settings`                   | Delivery fee, platform fee, GST settings, slot config                                                |
| `idempotency_keys`                    | Checkout idempotency                                                                                 |
| `outbox`                              | Transactional outbox                                                                                 |

**Order state machine (internal states)**

```
PENDING_PAYMENT ──► CONFIRMED ──► PACKING ──► PACKED ──► PICKED_UP ──► OUT_FOR_DELIVERY ──► DELIVERED
       │                │            │          │             │               │
       └─► PAYMENT_FAILED / EXPIRED  └──────────┴─────────────┴───────────────┴─► CANCELLED
                                                                                      │
                                                    DELIVERED ──► RETURN_REQUESTED ──► RETURNED / REPLACED
```

Customer-visible mapping: Placed, Confirmed, Packed, Picked Up, Out for Delivery, Delivered.
COD orders skip `PENDING_PAYMENT` and go straight to `CONFIRMED`.
Transitions are validated centrally (`orders.service.ts`); invalid transitions throw. Who may trigger each one:

| Transition              | Triggered by                                        |
| ----------------------- | --------------------------------------------------- |
| to `CONFIRMED`          | `payment.captured` event, or COD at checkout        |
| to `PACKING` / `PACKED` | Warehouse staff via API                             |
| to `PICKED_UP`          | `delivery.picked_up` event (handover code verified) |
| to `OUT_FOR_DELIVERY`   | `delivery.started` event                            |
| to `DELIVERED`          | `delivery.delivered` event (OTP or photo POD)       |
| to `CANCELLED`          | Customer (before packing), admin, or system timeout |

**Pricing engine:** server-authoritative. Computes subtotal, delivery fee, platform fee, discount (coupon, wallet), GST breakup, total. The client preview calls the same endpoint. Totals are recomputed at checkout and never trusted from the client.

**Checkout sequence** (see [section 9.1](#91-checkout-and-payment)): idempotency check, resolve warehouse, price, reserve stock, create order, create payment, return payment payload.

**Invoices:** generated with `pdf-lib` on `order.delivered` (or on demand), stored in Supabase Storage, link returned through the API.

**Public surface:** cart, price preview, checkout, order list/detail/cancel, coupons apply, referral, wallet, returns, ratings, support tickets and messages, warehouse pick/pack endpoints (scoped by `warehouse_id` claim), admin order management (modify, cancel, refund initiation, feed), settings.

**Internal surface:** `GET /internal/orders/:id`, `POST /internal/orders/:id/transition` (restricted), `GET /internal/orders/batch`.

**Events:** publishes `order.placed`, `order.confirmed`, `order.packing_started`, `order.packed`, `order.cancelled`, `order.delivered`, `order.return_requested`. Consumes `payment.captured`, `payment.failed`, `delivery.*`, `stock.*` (reservation expiry).

**Extraction order if it grows:** `promotions` first, then `fulfilment`, then `support`.

### 4.6 `payment`

**Responsibility:** money movement only. Knows about orders by id and amount, nothing else.

**Owns (schema `payments`):**

| Table              | Purpose                                                                       |
| ------------------ | ----------------------------------------------------------------------------- |
| `payments`         | One per order: method (`razorpay` / `cod`), amount, status, Razorpay order id |
| `payment_attempts` | Each attempt, Razorpay payment id, failure reason (powers retry flow)         |
| `refunds`          | Amount, reason, status, Razorpay refund id                                    |
| `webhook_events`   | Raw events with unique event id for dedupe                                    |
| `outbox`           | Transactional outbox                                                          |

**Behavior**

- Create Razorpay order (amount in paise, receipt = order number).
- Verify client-returned signature, and independently trust the **webhook** (`payment.captured`, `payment.failed`, `refund.processed`) as the source of truth.
- Webhook handler: verify signature against the raw body, dedupe on event id, update state, emit event. Always return 2xx quickly for duplicates.
- COD: payment row created as `pending_collection`; marked `captured` on `delivery.delivered`.
- Refunds: full or partial, linked to an order, initiated by admin or by the return flow.

**Public surface:** create payment for order, verify payment, retry, payment status, admin refund initiation and list.
**Internal surface:** `POST /internal/payments` (called by order at checkout), `POST /internal/refunds`.
**Events:** publishes `payment.captured`, `payment.failed`, `refund.initiated`, `refund.processed`. Consumes `delivery.delivered` (COD), `order.cancelled` (refund trigger).

### 4.7 `delivery`

**Responsibility:** riders, assignment, handover, proof of delivery, earnings, live tracking.

**Owns (schema `delivery`):**

| Table                       | Purpose                                                                                                 |
| --------------------------- | ------------------------------------------------------------------------------------------------------- |
| `rider_status`              | Online/offline, last known `lat`/`lng`, `last_seen_at`, active order count                              |
| `assignments`               | `order_id`, `rider_id`, status, **handover code**, timestamps (assigned, picked up, started, delivered) |
| `assignment_offers`         | Offer sent to a rider, `expires_at`, outcome (accepted / rejected / expired)                            |
| `delivery_otps`             | Hashed customer delivery OTP and attempts                                                               |
| `proofs_of_delivery`        | Method (`otp` / `photo`), photo storage path, coordinates, timestamp                                    |
| `rider_locations`           | Throttled breadcrumb history, retained 30 days                                                          |
| `earnings`, `earning_rules` | Per-delivery earnings and the rules that produced them                                                  |

**Assignment algorithm (v1)**

1. Triggered on `order.confirmed` (pre-assign so the rider is heading to the warehouse while packing) or `order.packed`, configurable.
2. Candidates: online riders within N km of the warehouse, below max concurrent orders, sorted by distance.
3. Send an offer to the best candidate (FCM + Realtime), schedule a Cloud Task for the expiry (default 30 s). On reject or expiry, offer to the next. If candidates run out, flag the order in the admin feed for manual assignment.
4. Admin can assign manually at any time.

**Handover:** handover code generated at assignment, shown on the warehouse handover screen. Rider enters it to confirm pickup, which emits `delivery.picked_up`.

**Delivery completion:** a delivery OTP is generated when the order goes out for delivery and shown to the customer in their app. The rider enters it, or uploads a photo if OTP is not possible.

**Live location:** the rider app publishes position on a Supabase Realtime Broadcast channel `order:{orderId}` for the customer map. A throttled copy (every 15 to 30 s) is persisted to `rider_locations` through the API. ETA and distance use `@qc/maps-client`.

**Public surface:** rider online/offline, offers (accept/reject), active delivery, handover confirm, POD submit, earnings (day/week/month), trip history, location update, admin live rider list and manual assignment, warehouse handover view.
**Events:** publishes `rider.offered`, `rider.assigned`, `delivery.picked_up`, `delivery.started`, `delivery.delivered`, `delivery.failed`. Consumes `order.confirmed` / `order.packed`, `order.cancelled`, `rider.approved`.

### 4.8 `notification`

**Responsibility:** every message that leaves the platform. Pure consumer plus a few APIs.

**Owns (schema `notifications`):**

| Table                     | Purpose                                                       |
| ------------------------- | ------------------------------------------------------------- |
| `device_tokens`           | FCM tokens per user and device (apps register directly here)  |
| `templates`               | Push/email/SMS templates with variables and locale            |
| `notification_log`        | What was sent, to whom, channel, status                       |
| `preferences`             | Per-user channel and category opt-ins                         |
| `broadcasts`              | Admin-composed pushes with segment and schedule               |
| `segments`                | Segment definitions (all customers, by city, inactive N days) |
| `notify_me_subscriptions` | Out-of-stock "Notify Me" requests                             |

**Channels:** FCM push, Resend email, SMS (transactional only, via MSG91/Twilio).
**Supabase Send-SMS Hook:** `/hooks/send-sms` receives Supabase Auth OTP requests and delivers through the DLT-registered SMS template. Signature-verified.
**Consumes:** `order.*`, `payment.*`, `delivery.*`, `stock.changed` (Notify Me, back in stock), `stock.low` and `batch.near_expiry` (to warehouse managers and admins), `rider.offered`.
**Public surface:** register/unregister device, preferences, admin broadcast create/schedule/list, templates (admin).
**Publishes:** `notification.sent` (optional, for analytics).

### 4.9 `analytics`

**Responsibility:** read-only reporting.

- Connects with a **read-only database role** (`analytics_ro`) granted `SELECT` on curated views, not base tables.
- Curated SQL views and materialized views (refreshed by scheduled job): revenue by day/week/month and warehouse, top sellers, order volume and fulfilment rate, acquisition/retention, delivery performance, pick-and-pack time, stock-outs, rider performance.
- Warehouse-scoped reports for managers (filtered by `warehouse_id` claim); network-wide for admin.
- Can ship in Week 7. Until then, admin dashboards can read simple counts through the owning services.

**Owns (schema `analytics`):** views and materialized views only, plus `report_snapshots` if needed.

---

## 5. Service-to-service communication

### 5.1 Synchronous (HTTP)

- Only for request-path needs. Examples: `order → warehouse-inventory` (resolve + reserve), `order → catalog` (batch get for pricing), `order → payment` (create payment).
- Every service except `gateway` and the two web apps is **private** (internal ALB, no public IP). Callers use the ECS task IAM role (SigV4 on the internal ALB). Each service has its own task role with invoke rights only on what it calls.
- Internal routes live under `/internal/*`, are **not** proxied by the gateway, and additionally require the caller identity header check in `service-kit`.
- Typed clients come from `@qc/api-client`. Timeouts: 3 s default, 1 retry on idempotent GETs, none on non-idempotent POSTs unless an idempotency key is sent.
- No circular sync dependencies. Allowed direction: `gateway → any`, `order → {catalog, warehouse-inventory, payment, identity}`, `delivery → {order (internal read), identity}`, `payment → order (internal read)`. Anything else needs an ADR.

### 5.2 Asynchronous (SNS + SQS)

- One SNS topic per producing domain: `identity-events`, `catalog-events`, `inventory-events`, `order-events`, `payment-events`, `delivery-events`.
- Messages carry attributes `eventType`, `eventVersion`, `producer`; SQS subscriptions use SNS **filter policies** so each consumer only receives what it needs.
- Delivery is **pull**: each consumer has an SQS queue. Private ECS services cannot take inbound SNS HTTP. A worker in the service long-polls SQS and posts internally to `/internal/events/<name>`.
- **Transactional outbox:** a service writes the event row in the same DB transaction as its state change. `outbox.worker` publishes to SNS and marks as sent. This guarantees no lost events.
- **Idempotent consumers:** each consumer stores processed `eventId` (table `processed_events`) or uses naturally idempotent upserts. SQS is at-least-once.
- **Dead-letter queue** per subscription with max 5 receives. An alarm fires on any DLQ message.
- **Event envelope** (all events):

```json
{
  "eventId": "uuid",
  "eventType": "order.confirmed",
  "eventVersion": 1,
  "occurredAt": "2026-10-24T10:15:00.000Z",
  "producer": "order",
  "correlationId": "request-id-or-order-id",
  "data": {}
}
```

### 5.3 Realtime to clients (Supabase Realtime)

| Use                   | Mechanism                                                                    | Who subscribes          |
| --------------------- | ---------------------------------------------------------------------------- | ----------------------- |
| Customer order status | Postgres changes on `orders.orders` filtered by `user_id`, RLS enforced      | customer-app            |
| Warehouse live queue  | Postgres changes on `orders.orders` filtered by `warehouse_id`, RLS enforced | warehouse-web           |
| Admin order feed      | Postgres changes on `orders.orders`, admin RLS                               | admin-web               |
| Rider offers          | Postgres changes on `delivery.assignment_offers` filtered by `rider_id`      | rider-app               |
| Rider live location   | Broadcast channel `order:{orderId}`                                          | customer-app, admin-web |

Tables used by Realtime must be added to the `supabase_realtime` publication and have RLS policies. **Week 1 spike:** confirm Postgres-changes behavior on non-`public` schemas in our Supabase version; if limited, expose a thin `public` view/table mirror (`public.realtime_orders`) maintained by the order service.

---

## 6. Event catalog

| Event                                   | Producer            | Consumers                                                               | Key payload                                             |
| --------------------------------------- | ------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------- |
| `user.created`                          | identity            | notification                                                            | userId, role                                            |
| `user.blocked`                          | identity            | order (reject checkout), delivery                                       | userId                                                  |
| `user.deleted`                          | identity            | order, notification, delivery                                           | userId                                                  |
| `rider.approved` / `rider.suspended`    | identity            | delivery                                                                | riderId                                                 |
| `product.upserted` / `product.deleted`  | catalog             | warehouse-inventory (optional stock row seeding)                        | productId, variantIds                                   |
| `stock.changed`                         | warehouse-inventory | catalog, notification                                                   | warehouseId, variantId, available, inStock, backInStock |
| `stock.low`                             | warehouse-inventory | notification                                                            | warehouseId, variantId, available, reorderLevel         |
| `batch.near_expiry`                     | warehouse-inventory | notification                                                            | warehouseId, variantId, batchNo, expiryDate             |
| `order.placed`                          | order               | notification (optional)                                                 | orderId, userId, warehouseId, total                     |
| `order.confirmed`                       | order               | warehouse-inventory (commit), delivery, notification, catalog           | orderId, warehouseId, items[], paymentMethod            |
| `order.packing_started`                 | order               | notification                                                            | orderId                                                 |
| `order.packed`                          | order               | delivery, notification                                                  | orderId, warehouseId                                    |
| `order.cancelled`                       | order               | warehouse-inventory (release), payment (refund), delivery, notification | orderId, reason, actor                                  |
| `order.delivered`                       | order               | notification, analytics refresh                                         | orderId                                                 |
| `order.return_requested`                | order               | notification                                                            | orderId, returnId                                       |
| `payment.captured`                      | payment             | order                                                                   | orderId, paymentId, amountPaise, method                 |
| `payment.failed`                        | payment             | order, notification                                                     | orderId, reason                                         |
| `refund.initiated` / `refund.processed` | payment             | order, notification                                                     | orderId, refundId, amountPaise                          |
| `rider.offered`                         | delivery            | notification                                                            | orderId, riderId, expiresAt                             |
| `rider.assigned`                        | delivery            | order, notification                                                     | orderId, riderId                                        |
| `delivery.picked_up`                    | delivery            | order, notification                                                     | orderId, riderId                                        |
| `delivery.started`                      | delivery            | order, notification                                                     | orderId                                                 |
| `delivery.delivered`                    | delivery            | order, payment (COD), notification                                      | orderId, riderId, proofMethod                           |
| `delivery.failed`                       | delivery            | order, notification                                                     | orderId, reason                                         |

Event schemas live in `@qc/contracts/events`. Adding a field is non-breaking. Removing or renaming one requires a new `eventVersion` and a dual-publish window.

---

## 7. Data architecture

### 7.1 Layout

- **One Supabase project per environment.** One Postgres database.
- **Schema per service:** `identity`, `catalog`, `inventory`, `orders`, `payments`, `delivery`, `notifications`, `analytics`.
- **One DB role per service** with `USAGE` and DML only on its own schema. No service role can read another service's schema. `analytics_ro` gets `SELECT` on curated views only.
- **Migrations:** one ordered stream in `supabase/migrations/` using Supabase CLI. File naming: `NNNN_<schema>_<description>.sql`. A migration touches one schema unless it is a cross-cutting setup (extensions, roles).
- **Types:** `kysely-codegen` regenerates `db/types.generated.ts` per service from its schema. Run `pnpm db:types`.
- **Extensions:** `postgis`, `pg_trgm`, `pgcrypto`, `pg_stat_statements`.

### 7.2 Conventions

| Topic       | Rule                                                                                                  |
| ----------- | ----------------------------------------------------------------------------------------------------- |
| Naming      | `snake_case` in DB, `camelCase` in JSON (Kysely `CamelCasePlugin`)                                    |
| IDs         | `uuid` default `gen_random_uuid()`. Human order number is a separate column, format `QC-YYMMDD-XXXXX` |
| Money       | `integer`/`bigint` paise, column suffix `_paise`. INR only                                            |
| Time        | `timestamptz`, UTC. Convert to IST at the edge for display                                            |
| Audit       | `created_at`, `updated_at` (trigger) on every table. `created_by` where an actor matters              |
| Deletes     | Soft delete (`deleted_at`) for catalog and identity. Ledgers and history are append-only              |
| Enums       | Postgres enums for stable sets (order status), text + check for evolving ones                         |
| Geo         | `geography(Point, 4326)` for points, `geography(Polygon, 4326)` for areas, GiST indexes               |
| Search      | `tsvector` generated column + GIN index, trigram GIN on name                                          |
| Idempotency | `idempotency_keys(key, scope, request_hash, response, created_at)` with 48 h retention                |

### 7.3 Connections (important on Supabase)

- Services connect through the **Supavisor pooler in transaction mode** (port 6543).
- **Pool size max 3 to 5 per instance**, and ECS `desiredCount` / max autoscaling is capped per service. Budget the total against the plan's connection limit before raising either number.
- Use the direct connection only for migrations.

### 7.4 Row Level Security

RLS is on for every table that is readable by Realtime or by the client SDK directly. Services use their own DB role with RLS bypass and enforce authorization in code. The policies exist for the client-facing read paths:

- Customers: rows where `user_id = auth.uid()`.
- Warehouse roles: rows where `warehouse_id = (auth.jwt() ->> 'warehouse_id')::uuid`.
- Riders: rows where `rider_id = auth.uid()`.
- Admin: `auth.jwt() ->> 'app_role' = 'admin'`.

### 7.5 Storage buckets

| Bucket              | Visibility  | Contents                                |
| ------------------- | ----------- | --------------------------------------- |
| `product-images`    | public read | Product and banner images               |
| `rider-documents`   | private     | KYC documents (signed URLs, admin only) |
| `proof-of-delivery` | private     | POD photos                              |
| `invoices`          | private     | Invoice PDFs (signed URLs)              |
| `imports`           | private     | CSV import uploads                      |

---

## 8. Auth and authorization

### 8.1 Roles

| Role (`app_role` claim) | Who                           | Login                                          |
| ----------------------- | ----------------------------- | ---------------------------------------------- |
| `customer`              | App users                     | Phone OTP, Google, Apple (iOS)                 |
| `rider`                 | Delivery riders               | Phone OTP, must be pre-registered and approved |
| `warehouse_staff`       | Pickers, packers              | Email + password (web)                         |
| `warehouse_manager`     | Warehouse managers            | Email + password (web)                         |
| `admin`                 | Platform owner and admin team | Email + password, MFA recommended              |

### 8.2 Token flow

1. Client authenticates with Supabase Auth and receives a JWT.
2. The **Custom Access Token Hook** (served by `identity`) adds `app_role` and, for staff, `warehouse_id`.
3. Client sends `Authorization: Bearer <jwt>` to the gateway.
4. Gateway verifies against Supabase JWKS, applies coarse route-prefix role rules, forwards identity to the target service in signed internal headers.
5. The service enforces fine-grained rules with `service-kit` guards, for example `requireRole('warehouse_staff')` plus `assertWarehouseScope(order.warehouseId)`.

### 8.3 Rules

- **Never trust role or warehouse from the request body.** Only from verified claims.
- Rider app login: after OTP, if there is no active `rider_profiles` row, the session is rejected (hook returns an error).
- Staff and riders are created by an admin through `identity`. There is no self-signup for those roles.
- Blocked users: `identity` flips status, the access token hook refuses to issue tokens, existing tokens expire on their short TTL (1 hour).
- Service role key lives only in `identity` and AWS Secrets Manager. Apps only ever hold the anon key.

---

## 9. Core flows

### 9.1 Checkout and payment

```
Customer app
  │ POST /v1/orders/checkout   (Idempotency-Key, addressId, slot, paymentMethod, couponCode?, useWallet?)
  ▼
gateway ──► order
  1. idempotency check (return stored response on replay)
  2. address → lat/lng (identity internal read)
  3. warehouse-inventory.resolve(lat,lng, cart items) → warehouseId | error with reason
  4. catalog.batch-get(variants) → authoritative price, MRP, GST
  5. pricing engine → totals (coupon, wallet, fees, GST)
  6. warehouse-inventory.reserve(warehouseId, items, ttl=10m) → reservationId | insufficient stock
  7. insert order (PENDING_PAYMENT, or CONFIRMED for COD) + items snapshot + outbox row   [one DB txn]
  8. razorpay: payment.create(orderId, amount) → razorpay order id   (skipped for COD)
  9. respond { orderId, orderNumber, payment: { razorpayOrderId, keyId, amount } }

Client opens Razorpay checkout ──► Razorpay ──► webhook ──► gateway /webhooks/razorpay ──► payment
  payment: verify signature on raw body, dedupe, mark captured, emit payment.captured
  order: consume payment.captured → CONFIRMED → emit order.confirmed
  warehouse-inventory: consume order.confirmed → commit reservation
  notification, delivery, catalog consume order.confirmed
```

Failure handling: payment failed event moves the order to `PAYMENT_FAILED` and keeps the reservation until TTL so the customer can retry; expiry releases stock and moves the order to `EXPIRED`. The client's own "payment success" callback is only a hint. The webhook decides.

### 9.2 Pick, pack, handover

1. `order.confirmed` makes the order appear in the warehouse queue (Realtime) with sound and a time-to-pack timer.
2. Staff open the order → pick list (item, quantity, rack location) is generated.
3. Staff tick items, flag out-of-stock lines (triggers substitution/partial-cancel rules and a stock adjustment), then mark **Packed**.
4. `order.packed` triggers the rider assignment (if not already pre-assigned).
5. Warehouse handover screen shows the rider and handover code. Rider enters the code in their app, which emits `delivery.picked_up`.

### 9.3 Delivery

1. Rider taps Start Delivery, which emits `delivery.started`. Order becomes Out for Delivery. Delivery OTP is generated and shown to the customer.
2. Rider app streams location; customer sees the rider on the map with an ETA countdown.
3. At the door, rider enters the customer's OTP (or uploads a photo). `delivery.delivered` emitted. Order becomes Delivered. COD amounts are marked collected. Earnings row is created. Invoice is generated.

### 9.4 Cancellation and refund

Customer can cancel until `PACKING`. After that only admin can cancel. `order.cancelled` releases or restocks inventory, notifies, and triggers a refund request in `payment` if money was captured. Refund status is visible to the customer.

---

## 10. Location handling

Location is split by data ownership:

| Concern                                                  | Service               | Mechanism                                                    |
| -------------------------------------------------------- | --------------------- | ------------------------------------------------------------ |
| Serviceability, nearest-warehouse routing, service areas | `warehouse-inventory` | PostGIS (`ST_Covers`, `ST_DWithin`, `ST_Distance`)           |
| Saved addresses, pin-drop result, geocoding on save      | `identity`            | `@qc/maps-client`                                            |
| Live rider location, ETA, distance                       | `delivery`            | Realtime Broadcast + throttled persistence + Distance Matrix |

Rules:

- Google Maps **server key** stays on the backend. Mobile and web use separate **restricted client keys** (package name / bundle id / HTTP referrer restrictions).
- Cache geocode results (by normalized address) and distance results (by rounded coordinate pairs) to control Maps costs.
- The home endpoint resolves the serving warehouse from coordinates once, then everything downstream uses `warehouseId`.
- Changing the delivery address re-resolves the warehouse and re-validates the cart. Items unavailable at the new warehouse are surfaced before checkout.
- Rider background location uses a foreground service on Android and the proper "Always" justification on iOS. Plan the store-review wording early.

---

## 11. API and coding conventions

### 11.1 REST

| Topic       | Convention                                                                                      |
| ----------- | ----------------------------------------------------------------------------------------------- |
| Base path   | `/v1/...` (breaking changes require `/v2` for that resource)                                    |
| Resources   | Plural nouns, kebab-case paths. Actions as sub-resources: `POST /v1/orders/:id/cancel`          |
| JSON        | `camelCase`. Dates as ISO 8601 UTC strings. Money as integer paise with `Paise` suffix in names |
| Pagination  | Cursor-based: `?limit=20&cursor=...` returns `{ items, nextCursor }`                            |
| Filtering   | Query params, documented in the schema                                                          |
| Idempotency | `Idempotency-Key` header required on checkout, payment create, refund create                    |
| Request id  | `x-request-id` generated at the gateway if absent, propagated everywhere, returned in responses |
| Rate limits | Gateway defaults plus stricter on OTP, checkout, search suggestions                             |

### 11.2 Errors

All errors share one shape, defined in `@qc/contracts`:

```json
{
  "error": {
    "code": "STOCK_INSUFFICIENT",
    "message": "Some items are no longer available.",
    "details": { "unavailable": [{ "variantId": "..." }] },
    "requestId": "..."
  }
}
```

Error `code` values are an enum in contracts (clients switch on `code`, never on message). HTTP status mapping is centralized in `service-kit`.

### 11.3 Code rules

- TypeScript `strict`, no `any` without a comment. No default exports in services.
- Validate **every** input and **every** response with Zod. Response validation is on in non-production and in tests.
- Business logic lives in `*.service.ts` as plain functions/classes. They receive dependencies (db, clients, clock) as arguments, which keeps them unit-testable.
- No cross-schema SQL. If you need another service's data, call its API or consume its events.
- Never log secrets, tokens, full phone numbers, or full addresses. Mask phone as `+91******1234`.
- Config only through `config/env.ts`. No `process.env` elsewhere.
- Feature flags (simple): rows in `platform_settings`, read with a short cache.

### 11.4 Git and PRs

- Trunk-based. Short-lived branches from `main`: `feat/…`, `fix/…`, `chore/…`. Conventional Commits.
- `main` protected: CI green and one review required.
- Merge to `main` auto-deploys **staging**. **Production** deploys on a version tag with manual approval.
- PR template checklist: tests added, migration included and reversible, contracts updated, OpenAPI regenerated, events versioned if changed, docs/ADR updated.

---

## 12. Client apps

### 12.1 Mobile (customer and rider)

- **Structure:** Expo Router, feature folders (`src/features/<feature>`) each with `api.ts` (uses `@qc/api-client`), `hooks.ts` (TanStack Query), `components/`, `screens` composed in `app/`.
- **State:** server state in TanStack Query. Local UI/cart-draft state in Zustand. No Redux.
- **Auth:** Supabase session in `expo-secure-store`. The API client attaches the JWT and refreshes on 401.
- **Realtime:** one subscription manager per app that attaches on login and detaches on logout.
- **Push:** `@react-native-firebase/messaging` for FCM tokens on both platforms (APNs key uploaded to Firebase). Token registered with `notification` on login and on refresh.
- **Payments:** `react-native-razorpay` (customer only). Payment result is advisory, the app polls order status after return.
- **Builds:** EAS dev client for development (native modules require it), EAS Build for staging and production, EAS Submit for store uploads, EAS Update for JS-only hotfixes.
- **Environments:** `app.config.ts` reads `APP_ENV` (`staging` | `production`) for API base URL, Supabase keys, Maps key, bundle ids (staging uses a suffix so both can be installed).
- **Compliance bits baked in from day one:** Sign in with Apple, in-app account deletion, privacy policy and terms links, permission rationale strings, data-safety declarations inputs.
- **Rider app extras:** background location task, offer notification with accept/reject, Google Maps deep link for navigation, camera for POD photo.

### 12.2 Web (warehouse and admin)

- **Rendering:** App Router. Authenticated pages are client-driven via TanStack Query (dashboards, live queues); server components for layout and session. Middleware protects routes by role.
- **Auth:** `@supabase/ssr` cookies. Role from the JWT claim decides which app sections render. Warehouse app additionally pins all requests to the user's `warehouse_id`.
- **Warehouse-web specifics:** Realtime subscription to the queue, audible new-order alert (user gesture to unlock audio at login), large touch targets, works on phone/tablet, optional PWA manifest for add-to-home-screen.
- **Admin-web specifics:** data tables (server-side pagination), CSV import with row error report, charts with Recharts, map for live riders and service-area drawing.
- Both apps deploy as separate ECS Fargate services (standalone Next output).

---

## 13. Infrastructure and deployment

### 13.1 Environments

| Env          | Purpose                           | Backend                              | Supabase                                    |
| ------------ | --------------------------------- | ------------------------------------ | ------------------------------------------- |
| `local`      | Development                       | `pnpm dev` (nodemon)                 | `supabase start` (local stack) + LocalStack |
| `staging`    | Client review, milestone APK/URLs | AWS account `qc-staging`             | Separate Supabase project (free tier)       |
| `production` | Live                              | AWS account `qc-prod` (client-owned) | Pro plan project (client-owned)             |

Accounts are set up under the client's ownership as promised in the proposal. Staging can live under TheHXD accounts until handover.

### 13.2 ECS Fargate configuration (defaults)

| Setting         | Value                                                                                                          |
| --------------- | -------------------------------------------------------------------------------------------------------------- |
| Region          | `ap-south-1` (Mumbai), same region as the Supabase project where possible                                      |
| Network         | Public ALB for `gateway` and the two web apps. Internal ALB for every other service (no public IP)             |
| CPU / memory    | 256 CPU units (0.25 vCPU), 512 MiB (1024 MiB where it fits)                                                    |
| Autoscaling     | Target tracking on CPU / ALB request count. Cap at 5–10 tasks, sized against the DB connection budget          |
| Desired count   | 1 in staging. In production consider 2 for `gateway` and `order` if checkout latency after deploys is an issue |
| Request timeout | 30 s default on the ALB, 300 s for CSV import jobs                                                             |
| Startup         | Lazy-load heavy modules, small images (multi-stage, `turbo prune`)                                             |
| IAM             | One task role per service, least privilege. GitHub deploys via OIDC (no long-lived access keys)                |

### 13.3 SNS, SQS

- Topics and filtered SQS subscriptions declared in `infra/sns/*.json`, applied by `infra/scripts/create-topics.sh`.
- Dead-letter queue for every subscription, with a CloudWatch alarm.
- Delay queues (SQS, max 15 minutes): `reservation-expiry`, `offer-expiry`, `order-timeouts`. Workers call `/internal/jobs/*`.

### 13.4 Scheduled jobs

Each service exposes **one tick endpoint per cadence** and fans out internally, rather than one EventBridge rule per task.

| Job                 | Cadence          | Service             | Purpose                                                                                          |
| ------------------- | ---------------- | ------------------- | ------------------------------------------------------------------------------------------------ |
| `inventory-tick`    | every 15 min     | warehouse-inventory | Low-stock scan, reservation sweep (safety net), near-expiry check (daily window inside the tick) |
| `order-tick`        | every 5 min      | order               | Unpaid-order timeout, warehouse-not-acting alerts, scheduled-slot releases                       |
| `delivery-tick`     | every 5 min      | delivery            | Stuck-offer sweep, riders offline cleanup                                                        |
| `notification-tick` | every 5 min      | notification        | Send due scheduled broadcasts                                                                    |
| `analytics-refresh` | hourly           | analytics           | Refresh materialized views                                                                       |
| `housekeeping`      | daily, 03:00 IST | each service        | Purge old idempotency keys (48 h), rider breadcrumbs (30 days), processed events (14 days)       |

Sub-minute timing (offer expiry, reservation TTL) uses SQS delay queues, not EventBridge.

### 13.5 CI/CD

**On every PR:** install (pnpm cache), `turbo run lint typecheck test build --filter=...[origin/main]`, migration lint (no destructive statements without a flag), OpenAPI regeneration check (fails if generated client drifted).

**On merge to `main`:**

1. Detect affected services/apps with Turborepo.
2. Build Docker images, push to Amazon ECR (tag = git SHA).
3. Apply Supabase migrations to staging (before deploying code that needs them).
4. Register a new ECS task definition and update the Fargate service in staging.
5. Smoke test (health + a gateway round trip).

**On version tag `vX.Y.Z`:** same pipeline to production behind a manual approval. Migrations follow **expand → migrate → contract** so a rollback of code never needs a rollback of schema.

**Mobile:** EAS Build on tag for staging/prod profiles. EAS Submit is manual in Week 8.

**Auth to AWS:** GitHub OIDC → IAM deploy role. No long-lived access keys in GitHub.

### 13.6 Cost guardrails

- AWS Budgets and alerts on both accounts (50 / 80 / 100%).
- ECS autoscaling max-task caps. Fargate Spot is allowed in staging only.
- Google Maps quotas capped per API, with daily limits.
- Supabase: Pro plan for production only. Watch DB size, egress, MAUs.
- Log exclusion filters for health checks to avoid paying for noise.

---

## 14. Observability

| Area        | Approach                                                                                                                                                     |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Logs        | Pino JSON to stdout, collected by CloudWatch Logs. Mandatory fields: `service`, `requestId`, `userId` (hashed or id), `role`, `route`, `status`, `latencyMs` |
| Correlation | `x-request-id` flows gateway → services → events (`correlationId`)                                                                                           |
| Errors      | Sentry in all services and apps, release tagged with git SHA, source maps uploaded for web and mobile                                                        |
| Metrics     | ALB and ECS built-ins (latency, task count, 5xx). Custom: orders/min, stock reservation failures, payment webhook lag, assignment time                       |
| Tracing     | OpenTelemetry to AWS X-Ray (optional, add after Week 5 if debugging needs it)                                                                                |
| Health      | `GET /health/live` (process) and `GET /health/ready` (DB reachable) on every service                                                                         |
| Alerts      | 5xx rate, p95 latency on gateway, DLQ depth > 0, webhook failures, payment captured but order not confirmed after 2 min, outbox backlog                      |
| Uptime      | Route 53 health checks (or CloudWatch Synthetics) on gateway and both web apps                                                                               |

Runbooks in `docs/runbooks/` for: deploy and rollback, Razorpay webhook debugging, stuck order investigation, stock ledger reconciliation, DLQ replay.

---

## 15. Security and compliance

- **Transport:** TLS everywhere (ALB HTTPS). HSTS on web apps.
- **Secrets:** AWS Secrets Manager only. `.env` files are local, git-ignored, and each has a committed `.env.example`.
- **Service identity:** per-service service accounts, least-privilege IAM.
- **Webhooks:** verify HMAC on the raw request body (Razorpay, Supabase hooks). Reject replays using event ids.
- **Input handling:** Zod on all inputs, parameterized queries only (Kysely), file uploads restricted by type and size, signed URLs for private files.
- **Headers/CORS:** Helmet on services and web. CORS allow-list limited to our web origins. Mobile apps do not need CORS.
- **Abuse controls:** OTP rate limits (Supabase + gateway), checkout rate limit, coupon redemption limits, blocked-user enforcement.
- **Data minimization and DPDP Act, 2023:** consent screens at signup, privacy policy link (client provides), in-app account deletion that anonymizes personal data while retaining legally required transaction records, data-retention settings documented.
- **Payments:** card data never touches our servers (Razorpay handles it). No PAN storage.
- **PII access:** admin views of rider documents use short-lived signed URLs, access logged.
- **Dependency hygiene:** Dependabot/Renovate weekly, `pnpm audit` in CI (warn on moderate, fail on high).
- **Backups:** Supabase Pro daily backups. Document restore procedure in runbooks and test it once before launch.

---

## 16. Testing strategy

| Level             | Tool                                                                             | Scope                                                                                        | Gate                             |
| ----------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------- |
| Unit              | Vitest                                                                           | Services layer: pricing, state machine, assignment, reservation math                         | CI required                      |
| Route/integration | Vitest + Fastify `inject()` + real Postgres (local Supabase / PostGIS container) | Each service's HTTP and DB behavior, RLS-sensitive queries                                   | CI required                      |
| Contract          | Generated client vs OpenAPI, event schema validation                             | Prevents drift between services                                                              | CI required                      |
| Event flow        | Integration tests with LocalStack (SNS/SQS)                                      | Outbox → publish → idempotent consume                                                        | CI for order, payment, inventory |
| Web E2E           | Playwright                                                                       | Warehouse pick/pack flow, admin product create, login by role                                | Nightly + before release         |
| Mobile E2E        | Maestro                                                                          | Login → add to cart → checkout (test Razorpay) → tracking; rider accept → handover → deliver | Before each milestone build      |
| Load (light)      | k6                                                                               | Checkout and search at expected launch peak, stock reservation under contention              | Before production                |

**Must-have test cases (write first):**

1. Concurrent reservations never oversell (N parallel requests for the last unit).
2. Order state machine rejects invalid transitions.
3. Pricing: coupon + wallet + GST totals match a fixture table to the paisa.
4. Razorpay webhook replay produces exactly one `payment.captured` effect.
5. Reservation expiry releases stock exactly once.
6. Warehouse staff cannot read or modify another warehouse's orders.
7. Assignment cascades through offers on reject and on timeout.
8. Idempotent checkout: same key returns the same order.

---

## 17. Local development and workflow

### 17.1 Prerequisites

Node 22 (nvm), pnpm, Docker, Supabase CLI, AWS CLI, EAS CLI, Xcode / Android Studio as needed.

### 17.2 Commands (root `package.json`)

```
pnpm install                  # install all workspaces
pnpm supabase:start           # local Postgres/Auth/Realtime/Storage
pnpm db:migrate               # apply migrations locally
pnpm db:types                 # regenerate Kysely types for all services
pnpm infra:up                 # docker compose: LocalStack (SNS/SQS)
pnpm dev                      # turbo: all services + both web apps
pnpm dev --filter=order       # a single service
pnpm gen:api                  # regenerate OpenAPI and @qc/api-client
pnpm lint | typecheck | test  # across the repo (turbo, cached)
pnpm mobile:customer          # expo start (dev client)
pnpm mobile:rider
```

### 17.3 Local ports

| Component                  | Port                  |
| -------------------------- | --------------------- |
| gateway                    | 4000                  |
| identity                   | 4001                  |
| catalog                    | 4002                  |
| warehouse-inventory        | 4003                  |
| order                      | 4004                  |
| payment                    | 4005                  |
| delivery                   | 4006                  |
| notification               | 4007                  |
| analytics                  | 4008                  |
| warehouse-web              | 3000                  |
| admin-web                  | 3001                  |
| Supabase API / DB / Studio | 54321 / 54322 / 54323 |
| LocalStack                 | 4566                  |

### 17.4 Environment variables

The repo-root `.env.example` lists shared and per-service keys. Shared ones:

| Variable                                                            | Used by                              | Notes                                   |
| ------------------------------------------------------------------- | ------------------------------------ | --------------------------------------- |
| `NODE_ENV`, `APP_ENV`, `PORT`, `LOG_LEVEL`                          | all                                  |                                         |
| `DATABASE_URL`                                                      | all services                         | Pooler URL, service-specific role       |
| `SUPABASE_URL`, `SUPABASE_JWKS_URL`                                 | gateway, services verifying JWTs     |                                         |
| `SUPABASE_SERVICE_ROLE_KEY`                                         | identity only                        | AWS Secrets Manager in cloud            |
| `AWS_REGION`, `AWS_ENDPOINT_URL` (local)                            | event-using services                 | LocalStack uses `http://localhost:4566` |
| `INTERNAL_SERVICE_URLS` or per-service `*_SERVICE_URL`              | callers                              |                                         |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | payment                              |                                         |
| `GOOGLE_MAPS_SERVER_KEY`                                            | identity, delivery (via maps-client) |                                         |
| `FCM_SERVICE_ACCOUNT`                                               | notification                         |                                         |
| `RESEND_API_KEY`                                                    | notification                         |                                         |
| `SMS_PROVIDER_*`                                                    | notification                         | MSG91/Twilio, DLT template ids          |
| `SENTRY_DSN`                                                        | all                                  |                                         |

### 17.5 Seed data

`supabase/seed.sql` plus a `pnpm seed` script creates: 2 warehouses with overlapping and non-overlapping service areas, admin / manager / staff / 3 riders / 5 customers (with fixed test OTP in local), 3 categories, about 60 products with stock spread across warehouses (including near-expiry and out-of-stock cases), 3 coupons, sample banners. Staging uses the same script.

---

## 18. 8-week delivery map

Aligned to the proposal and its milestone payments.

| Week  | Build focus                                                                                                                                                                                 | Services / apps touched                              | Exit criteria                                                                                           |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **1** | Repo, tooling, CI/CD skeleton, `service-kit`, `contracts`, DB schemas and migrations, auth + roles + access token hook, gateway skeleton, staging deploy of hello-world through the gateway | all (skeletons), identity, gateway                   | Staging shows authenticated request across gateway → identity. Realtime-on-custom-schema spike resolved |
| **2** | Catalog (products, categories, images, search), warehouses and service areas, inventory basics, availability projection                                                                     | catalog, warehouse-inventory                         | **Milestone:** schema, API endpoints, auth flow testable in Postman                                     |
| **3** | Customer app: auth/onboarding, address and location, home, categories, search, listing, detail                                                                                              | customer-app, gateway BFF home                       | Browsing works against staging for a serving warehouse                                                  |
| **4** | Cart, pricing, promos, checkout, nearest-warehouse routing, reservations, Razorpay + COD                                                                                                    | order, payment, customer-app                         | **Milestone 1 (30% payment):** installable customer APK, end-to-end test payment                        |
| **5** | Order tracking and realtime, Maps integration, warehouse website queue and pick/pack                                                                                                        | order, delivery (basic), warehouse-web, customer-app | Order flows from placement to Packed on staging                                                         |
| **6** | Rider app, assignment, handover, POD, earnings                                                                                                                                              | delivery, rider-app, notification (push)             | Full order lifecycle to Delivered. Rider APK + warehouse staging URL                                    |
| **7** | Admin website (orders, catalog, analytics, riders, warehouses), warehouse inventory + reports, analytics service, referrals/wallet, returns, support chat                                   | admin-web, warehouse-web, analytics, order           | Admin and warehouse sites complete on staging                                                           |
| **8** | QA, bug fixes, load test, production deploy on client AWS, Play Store and App Store submissions, docs, handover                                                                             | all                                                  | Production live, store submissions in review, source + docs delivered, 30-day support starts            |

Parallelization: backend services for a week land before the apps that consume them (Weeks 2→3, 4→5, 5→6), so mobile work is never blocked on missing APIs. Use generated clients and fixtures to unblock.

---

## 19. Decision log

Lightweight ADR table. Full records for anything significant go in `docs/adr/`.

| #   | Decision                                                                                    | Status                              | Why / alternatives                                                                      |
| --- | ------------------------------------------------------------------------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------- |
| D1  | Next.js for web, React Native (Expo) for mobile, Fastify for backend                        | **Locked**                          | Team stack and proposal                                                                 |
| D2  | Microservices, but merged where tightly coupled (warehouse + inventory)                     | **Locked** (merge level adjustable) | Two devs, 8 weeks; boundaries stay in code                                              |
| D3  | pnpm + Turborepo monorepo                                                                   | Proposed                            | Shared contracts and clients, affected-only CI                                          |
| D4  | One Supabase project, schema per service, role per service                                  | Proposed                            | Budget (one Pro plan) while keeping ownership boundaries                                |
| D5  | Kysely + SQL migrations (Supabase CLI)                                                      | Proposed                            | Typed queries, no ORM migration engine fighting Supabase. Drizzle is an acceptable swap |
| D6  | Zod + OpenAPI → generated client                                                            | Proposed                            | One schema for validation, types and docs                                               |
| D7  | SNS + SQS for events with outbox + idempotent consumers                                     | Proposed                            | Managed, cheap; SQS pull fits private ECS tasks                                         |
| D8  | SQS delay queues for sub-minute timers, EventBridge ticks for the rest                      | Proposed                            | Keeps Scheduler rules minimal; SQS delay max 15 minutes                                 |
| D9  | Catalog keeps an availability projection from stock events                                  | Proposed                            | One-query home/search, no read-time cross-service join                                  |
| D10 | No split shipments in v1 (one warehouse fulfils the whole order)                            | Proposed                            | Simplicity. Revisit post-launch                                                         |
| D11 | Private services on ECS Fargate behind an internal ALB; public ALB only for gateway and web | Proposed                            | VPC is required on AWS; task roles + security groups replace Cloud Run invoker IAM      |
| D12 | `@react-native-firebase/messaging` for push                                                 | Proposed                            | Same FCM token path on Android and iOS, requires dev client                             |
| D13 | Prices are GST-inclusive (invoice shows tax breakup)                                        | **Needs client confirmation**       | Standard Indian retail practice                                                         |
| D14 | Email + password for warehouse/admin web login, MFA for admin                               | Proposed                            | Staff are not guaranteed to have app-based phone login on shared desks                  |
| D15 | Realtime via Postgres changes on `orders.orders`                                            | **Pending spike (Week 1)**          | Fallback: public mirror table                                                           |

---

## 20. Risks, assumptions, client dependencies

### 20.1 Technical risks

| Risk                                          | Impact                        | Mitigation                                                                                                      |
| --------------------------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Supabase connection limits with nine services | Random 5xx under load         | Pooler (transaction mode), pool size 3 to 5, capped ECS max tasks, budget in D4                                 |
| Cold starts on checkout path                  | Slow first order after idle   | Small images, lazy loading. Min instance 1 on `gateway` and `order` in prod only if measured need (cost impact) |
| `order` service grows too large               | Slow changes, merge conflicts | Strict internal modules, extraction order defined in [4.5](#45-order)                                           |
| Realtime custom-schema limits                 | Rework of live queue/tracking | Week 1 spike, public mirror fallback                                                                            |
| Rider background location and store review    | Rejection or delays           | Early policy wording, foreground service, test on real devices in Week 6                                        |
| Oversell under concurrency                    | Customer trust and refunds    | Atomic reserve SQL, ledger reconciliation job, contention test                                                  |
| Payment captured but order not confirmed      | Money taken, no order         | Webhook as source of truth, alert on stuck state, reconciliation runbook                                        |
| Event loss or duplicates                      | Inconsistent state            | Outbox + idempotent consumers + DLQ alerting                                                                    |
| Two developers, many deployables              | Overhead                      | `service-kit` + generator template, shared CI, merged services (D2)                                             |

### 20.2 Client dependencies to start chasing in Week 1

These are on the critical path and have lead times outside our control:

1. **Developer accounts:** Apple Developer Program and Google Play Console, with TheHXD added as team members. Check the current Google Play requirements for new developer accounts (testing requirements before production release can add weeks).
2. **Razorpay merchant KYC and approval.**
3. **SMS DLT registration** (entity, header, templates) required in India before OTP SMS works in production.
4. **AWS billing account and Supabase organization** under the client for production, plus Google Maps billing enabled.
5. **Domain** and DNS access.
6. **Catalog data and images**, warehouse addresses, service areas, operating hours, initial stock.
7. **Business licences:** GST, FSSAI, Shops & Establishment (client responsibility per proposal, but needed before store listing and launch).
8. **Privacy policy, terms, refund/return policy URLs** (store submission blocker).
9. **Brand name, logo, app icons** (replace the "QC Platform" placeholder).

### 20.3 Assumptions

- Single city/region at launch, multiple warehouses supported by design.
- One tenant (this client). No multi-tenancy.
- INR only, English UI at launch (i18n-ready strings).
- Return and replacement flow is request + admin approval, not automated logistics.
- No barcode scanner hardware, WMS/ERP integration, or purchase-order management (out of scope per proposal).

---

## 21. Week 1 bootstrap checklist

**Repo and tooling**

- [ ] Create repo, `pnpm-workspace.yaml`, `turbo.json`, `.nvmrc`, shared `tsconfig` and ESLint configs, Prettier, husky + lint-staged
- [ ] Branch protection, `CODEOWNERS`, PR template, Conventional Commits check
- [ ] Add this file to `docs/ARCHITECTURE.md`, create `docs/adr/` and first ADRs for D2, D4, D7

**Shared packages**

- [ ] `@qc/contracts`: enums (roles, order status), error codes, event envelope and first event schemas, shared DTOs
- [ ] `@qc/service-kit`: `createService()`, env loader, logger, JWT verification (JWKS), role guards, error handler, health routes, outbox helper, idempotency helper, internal-auth (SigV4 / task-role) client and verifier
- [ ] `@qc/api-client` generation pipeline (OpenAPI → client) wired to `pnpm gen:api`
- [ ] Service generator script (`pnpm new:service <name>`) producing the standard layout from [3.1](#31-standard-service-layout)

**Database**

- [ ] `supabase init`, extensions migration (`postgis`, `pg_trgm`, `pgcrypto`), schema and role creation migration
- [ ] Initial tables for `identity`, `catalog`, `inventory` (Weeks 1 to 2), triggers for `updated_at`
- [ ] `kysely-codegen` script, seed skeleton
- [ ] Realtime spike on non-`public` schema and RLS (resolve D15)

**Auth**

- [ ] Supabase Auth providers configured on staging (phone OTP with test numbers, Google, Apple placeholders)
- [ ] Custom Access Token Hook (`identity`) adding `app_role` and `warehouse_id`
- [ ] Gateway JWT verification and first protected proxy route

**Infra**

- [ ] AWS staging account, ECR, ECS cluster, IAM task roles, GitHub OIDC deploy role
- [ ] SNS topics, SQS queues and DLQs for all domains (empty is fine), delay queues
- [ ] Dockerfile template (multi-stage with `turbo prune`), deploy workflow for one service
- [ ] Sentry projects, CloudWatch log retention, AWS Budgets alerts
- [ ] **Smoke test:** `app → gateway → identity` on staging with a real JWT

**Client coordination**

- [ ] Send the dependency list from [20.2](#202-client-dependencies-to-start-chasing-in-week-1) to the client with dates

---

_Last updated: 24 Oct 2026. Owners: TheHXD co-founders. Change this document through PRs._
