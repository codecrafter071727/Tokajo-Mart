#!/usr/bin/env bash
# Starts the whole backend on this machine against a LOCAL Postgres, never a hosted one.
#   scripts/dev-stack.sh            start every service (gateway on :4000)
# Online payments use RAZORPAY_* from the root .env. PAYMENTS_FAKE_PROVIDER=1 uses a pretend
# Razorpay instead (for CI and the end to end script), never the network.
#   scripts/dev-stack.sh stop       stop them
# Needs Node 22+ on PATH and a migrated, seeded database:
#   DATABASE_URL=postgresql://localhost:5432/qc_dev node scripts/db-migrate.mjs --reset --seed
set -euo pipefail
cd "$(dirname "$0")/.."

DB="${LOCAL_DATABASE_URL:-postgresql://localhost:5432/qc_dev}"
HOST="$(printf '%s' "$DB" | sed -E 's#^[a-z]+://([^@/]*@)?(\[[^]]*\]|[^:/]+).*#\2#')"
case "$HOST" in
  localhost|127.0.0.1|"[::1]") ;;
  *) echo "Refusing to run: the database must be on this machine, got host '$HOST'" >&2; exit 1 ;;
esac

ROOT="$(pwd)"
RUN_DIR="$ROOT/.dev-stack"
mkdir -p "$RUN_DIR"

if [ "${1:-}" = "stop" ]; then
  for f in "$RUN_DIR"/*.pid; do
    [ -e "$f" ] || continue
    kill "$(cat "$f")" 2>/dev/null || true
    rm -f "$f"
  done
  echo "stopped"
  exit 0
fi

CORS="${DEV_CORS_ORIGINS:-http://localhost:8083,http://localhost:8084,http://localhost:8085,http://localhost:8086,http://localhost:3000,http://localhost:3001}"
BASE="NODE_ENV=development APP_ENV=local LOG_LEVEL=warn DATABASE_URL=$DB CORS_ORIGINS=$CORS"

start() { # name port dir [extra env...]
  local name=$1 port=$2 dir=$3; shift 3
  cd "$ROOT/services/$dir"
  env $BASE PORT="$port" "$@" ./node_modules/.bin/tsx --conditions=qc-source src/server.ts \
    > "$RUN_DIR/$name.log" 2>&1 &
  echo $! > "$RUN_DIR/$name.pid"
  cd "$ROOT"
  echo "started $name on :$port"
}

start identity 4001 identity
start catalog 4002 catalog
start inventory 4003 warehouse-inventory
start order 4004 order
start payment 4005 payment
start delivery 4006 delivery
start gateway 4000 gateway
echo "logs in $RUN_DIR/. Gateway: http://localhost:4000"
