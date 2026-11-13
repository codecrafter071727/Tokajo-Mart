# 0007. Handover and delivery codes are checked by the server

Status: accepted, November 2026

## Context

The first rider app draft compared the customer's delivery code on the phone, which means the code
was sent to the rider and a rider could mark an order delivered without meeting the customer.

## Decision

Each delivery has two 4 digit codes. The handover code is shown on the warehouse screen and typed
by the rider at pickup; the delivery code is shown only to the customer who owns the order and
typed by the rider at the door. Both are compared by the delivery service, never sent to the rider
app, and never included in admin or warehouse order responses. Five wrong tries lock the step.

## Consequences

- A delivery can only be completed with the customer present (or sharing the code).
- Tests assert that rider, admin and queue responses never contain either code.
- Support needs a manual override path for a locked delivery (not built yet).
