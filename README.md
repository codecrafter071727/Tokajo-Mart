# QC Platform

Warehouse-based quick commerce platform (dark store model). Customers order from a mobile app; a nearby warehouse picks and packs; a rider delivers.

Working name **QC Platform** (`@qc/*`). Built by TheHXD. Rename when the client brand is confirmed.

| Surface       | Package             | Stack                   |
| ------------- | ------------------- | ----------------------- |
| Customer app  | `@qc/customer-app`  | Expo (React Native)     |
| Rider app     | `@qc/rider-app`     | Expo (React Native)     |
| Warehouse web | `@qc/warehouse-web` | Next.js 15              |
| Admin web     | `@qc/admin-web`     | Next.js 15              |
| Backend       | `services/*`        | Fastify 5 on Node.js 22 |

The full design — service boundaries, events, data ownership, auth, and the 8-week plan — is in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Treat that file as the source of truth.

## Current status

The monorepo, tooling, Fastify bootstrap, Dockerfiles, and local run commands are in place. Domain APIs, database migrations, and product UI are not implemented yet. Each service currently exposes health endpoints only.

## Prerequisites

| Tool                   | Version                                |
| ---------------------- | -------------------------------------- |
| Node.js                | 22.13+ (pinned in `.nvmrc` as 22.23.4) |
| pnpm                   | 10.18+                                 |
| Docker                 | Required for LocalStack (SNS/SQS)      |
| Supabase CLI           | Installed via `pnpm install`           |
| AWS CLI                | Staging and production deploys         |
| EAS CLI                | Mobile builds                          |
| Xcode / Android Studio | Native app development                 |

## Quick start

```sh
pnpm install
cp .env.example .env
pnpm supabase:start
pnpm infra:up
pnpm dev
```

All nine backend services start with nodemon. Confirm:

```text
GET http://localhost:4000/health/live
```

| Command                       | What it starts                          |
| ----------------------------- | --------------------------------------- |
| `pnpm dev`                    | All Fastify services                    |
| `pnpm --filter @qc/order dev` | One service                             |
| `pnpm dev:web`                | Warehouse (`:3000`) and admin (`:3001`) |
| `pnpm dev:all`                | Services and both web apps              |
| `pnpm mobile:customer`        | Customer Expo dev client                |
| `pnpm mobile:rider`           | Rider Expo dev client                   |

Stop local extras with `pnpm supabase:stop` and `pnpm infra:down`.

## Repository layout

```text
apps/          Customer and rider (Expo), warehouse and admin (Next.js)
services/      Nine Fastify services, one ECS Fargate service each
packages/      Shared contracts, service-kit, API client, maps client, UI, configs
supabase/      Config, SQL migrations, seed
infra/         Docker, ECS, SNS/SQS, EventBridge Scheduler
docs/          Architecture, ADRs, runbooks
```

## Backend services

Every service is a Fastify 5 app bootstrapped by `@qc/service-kit` (Helmet, CORS, rate limits, Zod, OpenAPI, health, structured logs). Local ports:

| Service               | Port | Responsibility                                         |
| --------------------- | ---- | ------------------------------------------------------ |
| `gateway`             | 4000 | Public entry: JWT, rate limit, routing, BFF            |
| `identity`            | 4001 | Profiles, addresses, roles, staff, riders              |
| `catalog`             | 4002 | Products, search, collections, availability projection |
| `warehouse-inventory` | 4003 | Warehouses, service areas, stock, reservations         |
| `order`               | 4004 | Cart, checkout, fulfilment, promotions                 |
| `payment`             | 4005 | Razorpay, COD, refunds, webhooks                       |
| `delivery`            | 4006 | Assignment, handover, POD, earnings                    |
| `notification`        | 4007 | Push, email, SMS                                       |
| `analytics`           | 4008 | Read-only reporting                                    |

Swagger UI is available at `/docs` on each service while `NODE_ENV` is not `production`.

## Environment

One file at the repo root covers every Fastify service.

```sh
cp .env.example .env
```

Shared keys (Supabase, AWS, CORS, Razorpay, Maps) appear once. Local listen ports are `GATEWAY_PORT`, `IDENTITY_PORT`, and so on. Local database URLs are `IDENTITY_DATABASE_URL`, `ORDERS_DATABASE_URL`, and so on — each service uses its own Postgres role.

On ECS Fargate, the platform sets `PORT=8080` and injects per-service `DATABASE_URL`. Those values take precedence over the local `*_PORT` / `*_DATABASE_URL` names.

Do not commit `.env`. Warehouse and admin web still use `apps/<app>/.env` because Next.js loads that path.

## Scripts

| Script            | Purpose                                  |
| ----------------- | ---------------------------------------- |
| `pnpm lint`       | ESLint across workspaces                 |
| `pnpm typecheck`  | TypeScript `--noEmit`                    |
| `pnpm test`       | Vitest                                   |
| `pnpm build`      | Production builds (Turborepo)            |
| `pnpm format`     | Prettier                                 |
| `pnpm db:migrate` | Apply Supabase migrations locally        |
| `pnpm db:types`   | Regenerate Kysely types                  |
| `pnpm gen:api`    | Regenerate `@qc/api-client` from OpenAPI |

Commits follow [Conventional Commits](https://www.conventionalcommits.org/). Husky runs lint-staged and commitlint. CI on pull requests runs format, lint, typecheck, test, and build for affected packages.

## Documentation

| Document                                     | Contents                                 |
| -------------------------------------------- | ---------------------------------------- |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design, conventions, delivery map |
| [docs/adr/](docs/adr/)                       | Architecture decision records            |
| [docs/runbooks/](docs/runbooks/)             | Deploy, rollback, incident procedures    |

## Licence

Proprietary. All rights reserved. TheHXD.
