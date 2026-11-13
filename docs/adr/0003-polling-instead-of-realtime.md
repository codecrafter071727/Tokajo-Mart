# 0003. Apps poll instead of Supabase Realtime

Status: accepted, November 2026

## Context

Live order status, the warehouse queue, rider offers and tracking need near real time updates.
Realtime on custom Postgres schemas was flagged as a risk in the plan, and it ties clients to the
database.

## Decision

Clients poll the gateway with TanStack Query `refetchInterval`: rider state and the warehouse
queue every 4 s, order tracking and live location every 5 s, the admin orders view every 20 s,
notification counts every 30 s. Polling stops when the screen is not visible.

## Consequences

- No extra infrastructure, and the same endpoints serve the first load and the updates.
- Up to a few seconds of delay, acceptable for a 10 to 15 minute delivery.
- Load grows with open screens; the k6 scripts in `tests/load` measure exactly this traffic.
- Server push (SSE or websockets) can replace a poll later without changing the data shape.
