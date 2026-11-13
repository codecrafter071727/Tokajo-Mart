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
import {
  createFakeRazorpayClient,
  createHttpRazorpayClient,
  type RazorpayClient,
} from "./modules/payments/razorpay";
import { registerPaymentRoutes } from "./modules/payments/routes";
import { PaymentService, type PaymentConfig } from "./modules/payments/service";

export type BuildAppOptions = {
  db?: Kysely<DB>;
  orderClient?: InternalClient;
  /** Overrides the configured Razorpay (tests). Pass null to test "not configured". */
  config?: Partial<PaymentConfig>;
  now?: () => Date;
};

function configured(): PaymentConfig {
  const fake = env.PAYMENTS_FAKE_PROVIDER;
  if (fake && env.NODE_ENV === "production") {
    throw new Error("PAYMENTS_FAKE_PROVIDER must never be set in production.");
  }
  let razorpay: RazorpayClient | null = null;
  let keyId = env.RAZORPAY_KEY_ID ?? null;
  let keySecret = env.RAZORPAY_KEY_SECRET ?? null;
  if (fake) {
    razorpay = createFakeRazorpayClient().client;
    keyId ??= "rzp_test_fake";
    keySecret ??= "fake_key_secret";
  } else if (keyId && keySecret) {
    razorpay = createHttpRazorpayClient({ keyId, keySecret });
  }
  return {
    razorpay,
    keyId,
    keySecret,
    webhookSecret: env.RAZORPAY_WEBHOOK_SECRET ?? null,
    merchantName: env.PAYMENTS_MERCHANT_NAME,
  };
}

export async function buildApp(options: BuildAppOptions = {}) {
  const app = await createService({
    name: "payment",
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

  const config = { ...configured(), ...options.config };
  if (!config.razorpay) app.log.warn("Razorpay keys are not set: online payments are off");
  const order =
    options.orderClient ??
    createInternalClient({
      baseUrl: env.ORDER_SERVICE_URL ?? "http://localhost:4004",
      apiKey: env.INTERNAL_API_KEY,
    });
  registerPaymentRoutes(app, new PaymentService(db, order, config, options.now));
  return app;
}
