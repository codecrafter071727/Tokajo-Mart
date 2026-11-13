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
import { createLocalPodStorage, type PodStorage } from "./modules/delivery/pod-storage";
import { registerDeliveryRoutes } from "./modules/delivery/routes";
import { TrackingService } from "./modules/delivery/tracking";
import { registerTrackingRoutes } from "./modules/delivery/tracking-routes";
import { DeliveryService } from "./modules/delivery/service";

export type BuildAppOptions = {
  db?: Kysely<DB>;
  clients?: { order: InternalClient; identity: InternalClient; notification?: InternalClient };
  now?: () => Date;
  /** Door photo storage. Null turns uploads off. */
  podStorage?: PodStorage | null;
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
    // A short timeout: a slow inbox must never hold up a rider
    notification: createInternalClient({
      baseUrl: env.NOTIFICATION_SERVICE_URL ?? "http://localhost:4007",
      apiKey: env.INTERNAL_API_KEY,
      timeoutMs: 1500,
    }),
  };
  registerDeliveryRoutes(app, new DeliveryService(db, clients, options.now));

  // Production must name its storage: a container's own disk is wiped on every deploy
  const podDir = env.POD_STORAGE_DIR ?? (env.NODE_ENV === "production" ? undefined : ".data/pod");
  const podStorage =
    options.podStorage !== undefined
      ? options.podStorage
      : podDir
        ? createLocalPodStorage(podDir)
        : null;
  registerTrackingRoutes(app, new TrackingService(db, clients.order, podStorage, options.now));
  return app;
}
