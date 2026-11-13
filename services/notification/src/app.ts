import {
  createDatabaseReadinessCheck,
  createDb,
  createService,
  type Kysely,
} from "@qc/service-kit";
import { env } from "./config/env";
import type { DB } from "./db/types.generated";
import { registerNotificationRoutes } from "./modules/notifications/routes";
import { NotificationService } from "./modules/notifications/service";

export type BuildAppOptions = { db?: Kysely<DB>; now?: () => Date };

export async function buildApp(options: BuildAppOptions = {}) {
  const app = await createService({
    name: "notification",
    env,
    readinessCheck: createDatabaseReadinessCheck({
      databaseUrl: env.DATABASE_URL,
      enabled: env.NODE_ENV !== "test",
    }),
  });

  const db =
    options.db ??
    createDb<DB>(
      env.DATABASE_URL ?? "postgresql://localhost:5432/qc_unconfigured",
      env.DATABASE_POOL_MAX,
    );
  app.addHook("onClose", async () => {
    if (!options.db) await db.destroy();
  });

  registerNotificationRoutes(app, new NotificationService(db, options.now));
  return app;
}
