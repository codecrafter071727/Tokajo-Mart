import {
  createDatabaseReadinessCheck,
  createDb,
  createInternalClient,
  createService,
  type InternalClient,
  type Kysely,
} from "@qc/service-kit";
import { env } from "./config/env";
import type { DB } from "./db/types.generated";
import { registerDeliveryRoutes } from "./modules/delivery/routes";
import { DeliveryService } from "./modules/delivery/service";

export type BuildAppOptions = {
  db?: Kysely<DB>;
  clients?: { order: InternalClient; identity: InternalClient };
  now?: () => Date;
};

export async function buildApp(options: BuildAppOptions = {}) {
  const app = await createService({
    name: "delivery",
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

  const clients = options.clients ?? {
    order: createInternalClient({
      baseUrl: env.ORDER_SERVICE_URL ?? "http://localhost:4004",
      apiKey: env.INTERNAL_API_KEY,
    }),
    identity: createInternalClient({
      baseUrl: env.IDENTITY_SERVICE_URL ?? "http://localhost:4001",
      apiKey: env.INTERNAL_API_KEY,
    }),
  };
  registerDeliveryRoutes(app, new DeliveryService(db, clients, options.now));
  return app;
}
