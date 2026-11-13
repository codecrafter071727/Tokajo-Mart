# Database migrations and rollback

Migrations are plain SQL files in `supabase/migrations`, numbered `0001_` upward, applied in order
by `scripts/db-migrate.mjs`, and recorded in `public.schema_migrations (name, applied_at)`. Each
file runs in one transaction, so a failing file leaves nothing half applied.

## Apply

```bash
# Local
DATABASE_URL=postgresql://localhost:5432/qc_dev node scripts/db-migrate.mjs
# See what is applied
psql "$DB" -c "select name, applied_at from public.schema_migrations order by name;"
```

`--reset` and `--seed` only work against localhost, on purpose. Production is migrated by the
deploy pipeline, never from a laptop.

## Writing one

- Next free number only. Two branches with the same number must be renumbered before merge.
- Additive first: new tables, new nullable columns, new indexes. Ship the code that uses them in a
  later deploy.
- Dropping or narrowing anything (drop table, drop column, drop or change a check constraint)
  needs the line `-- allow-destructive` and a comment saying why; CI rejects the file otherwise.
- After changing a schema regenerate the service's types, for example
  `pnpm --filter @qc/order db:types` with `DATABASE_URL` set.

## Rollback

There are no automatic down migrations. To undo:

1. If the code is the problem, roll back the code first; additive migrations are safe to leave.
2. If the schema must go back, write a new forward migration that reverses it (next number), test
   it on a copy of production data locally, and deploy it like any other.
3. Only on a local database: `node scripts/db-migrate.mjs --reset --seed` rebuilds everything.

Never delete a row from `public.schema_migrations` to "re-run" a file in production, and never
edit a migration that has already been applied anywhere.

## Before a risky migration in production

- Take a backup or confirm point in time recovery is on.
- Check locks: large `alter table` on `orders.orders` or `inventory.stock_items` can block
  checkout. Prefer `create index concurrently` (in its own file, outside a transaction).
- Run it when order volume is lowest and watch [service-down.md](service-down.md) checks.
