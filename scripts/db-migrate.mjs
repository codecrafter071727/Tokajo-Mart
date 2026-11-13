#!/usr/bin/env node
// Applies supabase/migrations/*.sql in order and records them in public.schema_migrations.
// Uses psql, so it runs the same locally and in CI, and each file runs in one transaction.
//
//   node scripts/db-migrate.mjs                 apply anything new
//   node scripts/db-migrate.mjs --seed          ...then load supabase/seed.sql (local databases only)
//   node scripts/db-migrate.mjs --reset --seed  drop the service schemas first (local databases only)
//
// The target is DATABASE_URL, or postgresql://localhost:5432/qc_dev.

import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const url = process.env.DATABASE_URL ?? "postgresql://localhost:5432/qc_dev";
const args = new Set(process.argv.slice(2));
const SCHEMAS = ["catalog", "inventory", "identity", "orders", "delivery", "payments"];

const host = new URL(url).hostname;
const isLocal = host === "localhost" || host === "127.0.0.1" || host === "::1";
if ((args.has("--reset") || args.has("--seed")) && !isLocal) {
  console.error(`Refusing to reset or seed ${host}: only local databases are allowed.`);
  process.exit(1);
}

function psql(extra, input) {
  const result = spawnSync("psql", [url, "-X", "-q", "-v", "ON_ERROR_STOP=1", ...extra], {
    encoding: "utf8",
    input,
  });
  if (result.status !== 0) {
    console.error(result.stderr || result.stdout);
    process.exit(result.status ?? 1);
  }
  return result.stdout;
}

if (args.has("--reset")) {
  psql([
    "-c",
    SCHEMAS.map((s) => `drop schema if exists ${s} cascade;`).join(" ") +
      " drop table if exists public.schema_migrations;",
  ]);
  console.log("reset: dropped", SCHEMAS.join(", "));
}

psql([
  "-c",
  "create table if not exists public.schema_migrations (name text primary key, applied_at timestamptz not null default now())",
]);
const applied = new Set(
  psql(["-At", "-c", "select name from public.schema_migrations"]).split("\n").filter(Boolean),
);

const dir = path.join(root, "supabase", "migrations");
const files = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort();
let count = 0;
for (const file of files) {
  if (applied.has(file)) continue;
  psql(["-1", "-f", path.join(dir, file)]);
  psql(["-c", `insert into public.schema_migrations (name) values ('${file}')`]);
  console.log("applied", file);
  count += 1;
}
console.log(count === 0 ? "migrations are up to date" : `applied ${count} migration(s)`);

if (args.has("--seed")) {
  psql(["-1", "-f", path.join(root, "supabase", "seed.sql")]);
  console.log("seeded supabase/seed.sql");
}
