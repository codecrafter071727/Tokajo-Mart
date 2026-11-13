import {
  createDatabaseReadinessCheck,
  createDb,
  createInternalClient,
  createService,
  type InternalClient,
} from "@qc/service-kit";
import { env } from "./config/env";
import type { DB } from "./db/types.generated";
import {
  createInMemoryInventoryRepository,
  createPostgresInventoryRepository,
  registerInventoryRoutes,
  seedStock,
  seedWarehouses,
  type InventoryRepository,
  type RestockNotifier,
} from "./modules/inventory";

export type BuildAppOptions = {
  /** Defaults to Postgres when a database is configured, the seeded in-memory data otherwise */
  repository?: InventoryRepository;
  /** Overrides the notification and catalog clients (tests). Null turns restock notices off. */
  notify?: { notification: InternalClient; catalog?: InternalClient } | null;
};

/**
 * Tells the notification service a product is back, with its name when the catalog answers. Fire
 * and forget: a slow or failing notification service never slows down or fails a stock change.
 */
function restockNotifier(
  clients: { notification: InternalClient; catalog?: InternalClient },
  log: (error: unknown) => void,
): RestockNotifier {
  return (warehouseId, productIds) => {
    void (async () => {
      const names = new Map<string, string>();
      if (clients.catalog) {
        try {
          const { items } = await clients.catalog.get<{ items: { id: string; name: string }[] }>(
            `/internal/products?ids=${productIds.map(encodeURIComponent).join(",")}`,
          );
          for (const p of items) names.set(p.id, p.name);
        } catch {
          // the notice still goes out, just without the product name
        }
      }
      await Promise.all(
        productIds.map((productId) =>
          clients.notification.post("/internal/stock-restocked", {
            warehouseId,
            productId,
            ...(names.get(productId) ? { productName: names.get(productId) } : {}),
          }),
        ),
      );
    })().catch(log);
  };
}

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

  const notifyClients =
    options.notify === undefined
      ? env.NODE_ENV === "test"
        ? null
        : {
            notification: createInternalClient({
              baseUrl: env.NOTIFICATION_SERVICE_URL ?? "http://localhost:4007",
              apiKey: env.INTERNAL_API_KEY,
              timeoutMs: 1500,
            }),
            catalog: createInternalClient({
              baseUrl: env.CATALOG_SERVICE_URL ?? "http://localhost:4002",
              apiKey: env.INTERNAL_API_KEY,
              timeoutMs: 1500,
            }),
          }
      : options.notify;
  const notifier = notifyClients
    ? restockNotifier(notifyClients, (error) =>
        app.log.warn({ err: error }, "restock notice failed"),
      )
    : undefined;

  registerInventoryRoutes(app, repository, notifier);

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
