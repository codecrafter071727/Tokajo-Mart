# Packed orders not reaching riders

When the warehouse marks an order packed, the order service creates a row in
`delivery.deliveries` (status `unassigned`). Dispatch is pull based: when an online, free rider's
app asks for its state (`GET /v1/delivery/me`, every 4 seconds), the oldest unassigned delivery of
their warehouse is offered to them for 25 seconds. A declined or ignored offer goes back with
that rider remembered in `declined_by`; they can be offered it again after 60 seconds.

## Checks

```sql
-- Waiting deliveries and who has the offer
select order_number, warehouse_id, status, offered_to, offered_at, declined_by, created_at
from delivery.deliveries
where status in ('unassigned', 'offered') order by created_at;

-- Riders on duty per warehouse (rider warehouses live in identity.rider_profiles)
select p.warehouse_id, u.name, u.phone, s.online, s.updated_at
from delivery.rider_state s
join identity.users u on u.id = s.rider_id
join identity.rider_profiles p on p.user_id = s.rider_id
order by p.warehouse_id, s.online desc;

-- Riders busy with a delivery
select rider_id, order_number, status, updated_at
from delivery.deliveries where status in ('assigned', 'at_store', 'picked_up', 'at_customer');
```

The admin Riders page shows the same live status.

## Causes and fixes

| What you see                                      | Cause and fix                                                                                                             |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Packed order with no `delivery.deliveries` row    | the order service could not reach delivery at pack time. Press "Mark packed" again in warehouse web; it is idempotent     |
| `unassigned`, no rider `online` in that warehouse | nobody is on duty. Call riders; the admin dashboard lists "no riders online" under Needs attention                        |
| Riders online but nothing offered                 | their apps are not polling (closed, no network). Ask them to reopen the app                                               |
| Every online rider is in `declined_by`            | they all turned it down; it comes back to them 60 seconds after the last offer                                            |
| Rider blocked                                     | blocked riders cannot sign in; unblock in admin if it was a mistake                                                       |
| Rider cannot finish: wrong handover or door code  | 5 wrong codes lock the step (`code_attempts`). The warehouse shows the handover code; the customer's code is in their app |

## Escalate

Packed orders waiting more than 10 minutes past their promised time with riders on duty is SEV2.
