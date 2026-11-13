# 0001. Services call each other over HTTP, not Pub/Sub

Status: accepted, November 2026

## Context

ARCHITECTURE.md describes domain events on Pub/Sub with a transactional outbox per service. For
the first release we had two developers, one week for an end to end order, and no cloud project
set up. An event bus adds infrastructure, local emulation, retries and dead letter handling
before the first order can be placed.

## Decision

Services call each other synchronously over HTTP on `/internal/*` routes, guarded by a shared
`INTERNAL_API_KEY` and never routed by the gateway. Every internal call that changes state is
idempotent (reservations by reference, order transitions by target status, deliveries by order
id, refunds by key), so a caller can simply retry. Side effects that must never block an order,
such as notifications, are fire and forget with a short timeout.

## Consequences

- Simple to run locally (`scripts/dev-stack.sh`) and to test end to end.
- A downstream outage fails the user action instead of being queued; callers turn it into a clear
  503 and the user retries.
- The outbox worker files and `infra/sns/topics.json` exist but are unused. Moving to events later
  means publishing from the same places the HTTP calls are made today.
