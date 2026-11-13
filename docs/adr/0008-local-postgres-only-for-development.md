# 0008. Local Postgres for development, never the hosted database

Status: accepted, November 2026

## Context

During a repository compromise the hosted Supabase credentials sat in a local `.env`. Scripts that
reset and seed data must never be able to reach a shared or production database by mistake.

## Decision

Development and tests run against local Postgres only (`qc_dev`, `qc_test`). `db-migrate.mjs`
refuses `--reset` and `--seed` for any non local host, `dev-stack.sh` refuses a non local database,
and the load test helper refuses any non localhost target. CI uses its own throwaway Postgres
service.

## Consequences

- No developer action can wipe shared data.
- Production migrations run only through the deploy pipeline.
- The hosted credentials must still be rotated (see the security cleanup doc).
