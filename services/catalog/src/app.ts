import { createDatabaseReadinessCheck, createDb, createService } from "@qc/service-kit";
import type { DB } from "./db/types.generated";
import { env } from "./config/env";
import {
  createInMemoryCatalogRepository,
  createPostgresCatalogRepository,
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

  // Postgres when a database is configured, the seeded in-memory data otherwise (tests, quick demos)
  const repository =
    options.repository ??
    (env.DATABASE_URL && env.NODE_ENV !== "test"
      ? createPostgresCatalogRepository(createDb<DB>(env.DATABASE_URL, env.DATABASE_POOL_MAX))
      : createInMemoryCatalogRepository(seedCategories, seedProducts));

  registerCatalogRoutes(app, repository);

  return app;
}
