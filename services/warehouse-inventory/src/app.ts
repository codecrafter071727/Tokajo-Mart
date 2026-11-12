import { createDatabaseReadinessCheck, createService } from "@qc/service-kit";
import { env } from "./config/env";
import {
  createInMemoryInventoryRepository,
  registerInventoryRoutes,
  seedStock,
  seedWarehouses,
  type InventoryRepository,
} from "./modules/inventory";

export type BuildAppOptions = {
  /** Defaults to the seeded in-memory repository until the inventory schema exists */
  repository?: InventoryRepository;
};

export async function buildApp(options: BuildAppOptions = {}) {
  const app = await createService({
    name: "warehouse-inventory",
    env,
    readinessCheck: createDatabaseReadinessCheck({
      databaseUrl: env.DATABASE_URL,
      enabled: env.NODE_ENV !== "test",
    }),
  });

  registerInventoryRoutes(
    app,
    options.repository ?? createInMemoryInventoryRepository(seedWarehouses, seedStock),
  );

  return app;
}
