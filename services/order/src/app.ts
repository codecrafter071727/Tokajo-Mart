import {
  createDatabaseReadinessCheck,
  createDb,
  createService,
  type Kysely,
} from "@qc/service-kit";
import { env } from "./config/env";
import type { DB } from "./db/types.generated";
import { createClients, type Clients } from "./modules/orders/clients";
import { registerOrderRoutes } from "./modules/orders/routes";
import { OrderService } from "./modules/orders/service";

export type BuildAppOptions = {
  /** Injected in tests. Defaults to the configured database and real service URLs. */
  db?: Kysely<DB>;
  clients?: Clients;
  now?: () => Date;
};

export async function buildApp(options: BuildAppOptions = {}) {
  const app = await createService({
    name: "order",
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

  registerOrderRoutes(app, new OrderService(db, options.clients ?? createClients(), options.now));
  return app;
}
