# A service is down or slow

## Symptoms

- Apps show "could not reach a service" or spin; the gateway answers 502 (not reachable) or 504
  (took longer than 10 s).
- One area fails while others work (for example the catalog loads but orders do not).

## Checks

```bash
# Liveness (process is up) and readiness (database reachable) for every service
for p in 4000 4001 4002 4003 4004 4005 4006 4007; do
  printf "$p live "; curl -s -m3 localhost:$p/health/live; printf "  ready "; curl -s -m3 localhost:$p/health/ready; echo
done

# Which processes listen where
lsof -iTCP -sTCP:LISTEN -nP | grep -E ':(400[0-7])'

# Recent errors (local stack started with scripts/dev-stack.sh writes one log per service)
tail -n 80 .dev-stack/order.log
grep -h '"level":50' .dev-stack/*.log | tail -20     # pino level 50 = error

# Follow one request across services
grep -h '<request id>' .dev-stack/*.log
```

Database:

```bash
psql "$DB" -c "select count(*), state from pg_stat_activity group by state;"
psql "$DB" -c "select pid, now() - query_start as running_for, left(query, 120) from pg_stat_activity where state <> 'idle' order by running_for desc limit 10;"
df -h .      # a full disk breaks builds, logs and Postgres; it has happened on this machine
```

## Fixes

- Restart in dependency order: identity, catalog, inventory, payment, notification, order,
  delivery, then gateway. Locally `scripts/dev-stack.sh stop` then `scripts/dev-stack.sh` does
  exactly that.
- Readiness says the database is not reachable: check Postgres is running
  (`pg_isready -h localhost`), the `DATABASE_URL`, and connection counts above.
- Slow but up: look for a long running query above; cancel it with
  `select pg_cancel_backend(<pid>);` only if it is a read.
- 429 answers under load: each service allows 300 requests a minute per client address, and
  sign in 10 a minute. See [../../tests/load/README.md](../../tests/load/README.md).
- A full disk: clear build caches (`.turbo`, `apps/*/.next/cache`) before anything else.

## Escalate

If the database itself is unhealthy or a restart does not help within 15 minutes, treat it as
SEV1 ([incident-response.md](incident-response.md)).
