import { createDatabaseReadinessCheck, createDb, createService } from "@qc/service-kit";
import { env } from "./config/env";
import type { DB } from "./db/types.generated";
import {
  createInMemoryInventoryRepository,
  createPostgresInventoryRepository,
  registerInventoryRoutes,
  seedStock,
  seedWarehouses,
  type InventoryRepository,
} from "./modules/inventory";

export type BuildAppOptions = {
  /** Defaults to Postgres when a database is configured, the seeded in-memory data otherwise */
  repository?: InventoryRepository;
};

/** How often held stock whose time is up is given back. */
const SWEEP_INTERVAL_MS = 30_000;

export async function buildApp(options: BuildAppOptions = {}) {
  const app = await createService({
    name: "warehouse-inventory",
    env,
    readinessCheck: createDatabaseReadinessCheck({
      databaseUrl: env.DATABASE_URL,
      enabled: env.NODE_ENV !== "test",
    }),
  });

  const repository =
    options.repository ??
    (env.DATABASE_URL && env.NODE_ENV !== "test"
      ? createPostgresInventoryRepository(createDb<DB>(env.DATABASE_URL, env.DATABASE_POOL_MAX))
      : createInMemoryInventoryRepository(seedWarehouses, seedStock));

  registerInventoryRoutes(app, repository);

  // A held reservation that is never confirmed must not lock stock forever
  if (env.NODE_ENV !== "test") {
    let timer: NodeJS.Timeout | undefined;
    app.addHook("onReady", async () => {
      timer = setInterval(() => {
        repository
          .expireDue(new Date())
          .catch((error: unknown) => app.log.error({ err: error }, "reservation sweep failed"));
      }, SWEEP_INTERVAL_MS);
    });
    app.addHook("onClose", async () => {
      if (timer) clearInterval(timer);
    });
  }

  return app;
}
