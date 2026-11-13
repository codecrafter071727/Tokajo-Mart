import { createDatabaseReadinessCheck, createDb, createService } from "@qc/service-kit";
import { env } from "./config/env";
import type { AnalyticsDb } from "./modules/analytics/reports";
import { registerAnalyticsRoutes } from "./modules/analytics/routes";

export type BuildAppOptions = {
  /** Injected in tests. Defaults to the configured database. */
  db?: AnalyticsDb;
  now?: () => Date;
};

export async function buildApp(options: BuildAppOptions = {}) {
  const app = await createService({
    name: "analytics",
    env,
    readinessCheck: createDatabaseReadinessCheck({
      databaseUrl: env.DATABASE_URL,
      enabled: env.NODE_ENV !== "test",
    }),
  });

  // Production should use a read only database user here. Reports also run in read only
  // transactions, so a write is refused by Postgres either way.
  const db =
    options.db ??
    createDb<Record<string, never>>(
      env.DATABASE_URL ?? "postgresql://localhost:5432/qc_unconfigured",
      env.DATABASE_POOL_MAX,
    );
  app.addHook("onClose", async () => {
    if (!options.db) await db.destroy();
  });

  registerAnalyticsRoutes(app, db, options.now);
  return app;
}
