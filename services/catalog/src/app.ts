import { createDatabaseReadinessCheck, createService } from "@qc/service-kit";
import { env } from "./config/env";
import {
  createInMemoryCatalogRepository,
  registerCatalogRoutes,
  seedCategories,
  seedProducts,
  type CatalogRepository,
} from "./modules/catalog";

export type BuildAppOptions = {
  /** Defaults to the seeded in-memory repository until the catalog schema exists */
  repository?: CatalogRepository;
};

export async function buildApp(options: BuildAppOptions = {}) {
  const app = await createService({
    name: "catalog",
    env,
    readinessCheck: createDatabaseReadinessCheck({
      databaseUrl: env.DATABASE_URL,
      enabled: env.NODE_ENV !== "test",
    }),
  });

  registerCatalogRoutes(
    app,
    options.repository ?? createInMemoryCatalogRepository(seedCategories, seedProducts),
  );

  return app;
}
