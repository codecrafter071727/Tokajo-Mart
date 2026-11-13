# Stock looks wrong

`available = on_hand - reserved` per `inventory.stock_items` row. Placing an order holds stock
(`reserved` up). A COD order sells it right away (`on_hand` and `reserved` down, a `sale`
movement). An online order holds it until paid, or until it expires after 15 minutes. A cancelled
sold order is restocked (`on_hand` up, a `return` movement). Holds past `expires_at` are released
by a sweep every 30 seconds in the inventory service. Every change to `on_hand` writes a row to
`inventory.stock_movements`.

## Symptom: items show out of stock but the shelf is full

```sql
-- Holds that should have expired already (the sweep is not running, or failing)
select r.reference, r.warehouse_id, r.status, r.expires_at, l.product_id, l.quantity
from inventory.reservations r join inventory.reservation_lines l on l.reservation_id = r.id
where r.status = 'held' and r.expires_at < now() - interval '2 minutes';

-- Reserved per item compared with what open holds say
select s.warehouse_id, s.product_id, s.reserved,
       coalesce(sum(l.quantity) filter (where r.status = 'held'), 0) as held_by_open_holds
from inventory.stock_items s
left join inventory.reservations r on r.warehouse_id = s.warehouse_id and r.status = 'held'
left join inventory.reservation_lines l on l.reservation_id = r.id and l.product_id = s.product_id
group by s.warehouse_id, s.product_id, s.reserved
having s.reserved <> coalesce(sum(l.quantity) filter (where r.status = 'held'), 0);
```

- Expired holds still `held`: check the inventory log for "reservation sweep failed" and restart
  the service. Release one by hand through the service, never by editing rows:
  ```bash
  curl -s -X POST -H "x-internal-key: $KEY" localhost:4003/internal/reservations/<reference>/release
  ```

## Symptom: the count on the shelf differs from the system

```sql
-- Ledger reconciliation: on_hand should equal the sum of all movements for the item
select s.warehouse_id, s.product_id, s.on_hand,
       coalesce(sum(m.quantity_delta), 0) as ledger_total
from inventory.stock_items s
left join inventory.stock_movements m on m.warehouse_id = s.warehouse_id and m.product_id = s.product_id
group by s.warehouse_id, s.product_id, s.on_hand
having s.on_hand <> coalesce(sum(m.quantity_delta), 0);

-- The last changes for one item
select created_at, type, quantity_delta, reason, reference, actor_id
from inventory.stock_movements where warehouse_id = 'wh-noida-62' and product_id = 'p1'
order by id desc limit 30;
```

Seeded opening stock may have no movement row, so a constant difference equal to the seed
quantity is expected on a fresh database.

## Fixes

- After a physical count, record the difference in admin or warehouse web (Inventory, Adjust,
  type `adjustment` with a reason). This writes the movement, so the ledger stays true.
- Damaged or expired goods: Adjust with type `damage` or `expiry`.
- Never `update inventory.stock_items` by hand. A change without a movement breaks reconciliation
  for good.

## Escalate

Orders being accepted for stock that does not exist (oversell) is SEV2: close the warehouse in
admin while you look.
