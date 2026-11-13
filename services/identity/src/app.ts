import {
  createDatabaseReadinessCheck,
  createDb,
  createInternalClient,
  createService,
  DEV_JWT_SECRET,
  type Kysely,
} from "@qc/service-kit";
import { env } from "./config/env";
import type { DB } from "./db/types.generated";
import type { DeletionClients } from "./modules/account/deletion";
import { registerAccountRoutes } from "./modules/account/routes";
import { registerAddressRoutes } from "./modules/addresses/routes";
import { registerAdminRoutes } from "./modules/admin/routes";
import { createMsg91Sender } from "./modules/auth/msg91";
import { demoSender, parseTestNumbers, type OtpSender } from "./modules/auth/otp";
import { registerAuthRoutes } from "./modules/auth/routes";
import { AuthService } from "./modules/auth/service";
import { registerInternalRoutes } from "./modules/internal/routes";

export type BuildAppOptions = {
  /** Injected in tests. Defaults to the configured database. */
  db?: Kysely<DB>;
  sender?: OtpSender;
  /** Overrides OTP_MODE and OTP_TEST_NUMBERS in tests */
  otpMode?: "demo" | "sms";
  testNumbers?: string;
  now?: () => Date;
  /** Other services account deletion clears data in. Injected in tests. */
  clients?: DeletionClients;
};

export async function buildApp(options: BuildAppOptions = {}) {
  const production = env.NODE_ENV === "production";
  const jwtSecret = env.JWT_SECRET ?? (production ? undefined : DEV_JWT_SECRET);
  if (!jwtSecret) throw new Error("JWT_SECRET must be set in production.");

  // Real SMS needs a provider (MSG91 with DLT registration in India). Until one is configured the
  // service stays in demo mode, which accepts a fixed code and sends nothing. Production must not.
  const otpMode = options.otpMode ?? env.OTP_MODE ?? (production ? "sms" : "demo");
  const msg91Configured = Boolean(env.MSG91_AUTH_KEY && env.MSG91_TEMPLATE_ID);
  if (otpMode === "sms" && !options.sender && !msg91Configured) {
    throw new Error(
      "OTP_MODE=sms needs MSG91_AUTH_KEY and MSG91_TEMPLATE_ID. Use OTP_MODE=demo outside production.",
    );
  }

  const app = await createService({
    name: "identity",
    env,
    readinessCheck: createDatabaseReadinessCheck({
      databaseUrl: env.DATABASE_URL,
      enabled: env.NODE_ENV !== "test",
    }),
  });

  // Tests that do not touch the database still build the app, so connect lazily to a placeholder
  const db =
    options.db ??
    createDb<DB>(
      env.DATABASE_URL ?? "postgresql://localhost:5432/qc_unconfigured",
      env.DATABASE_POOL_MAX,
    );
  app.addHook("onClose", async () => {
    if (!options.db) await db.destroy();
  });

  const auth = new AuthService(db, {
    jwtSecret,
    accessTtlSeconds: env.ACCESS_TOKEN_TTL_SECONDS,
    refreshTtlDays: env.REFRESH_TOKEN_TTL_DAYS,
    otpTtlSeconds: env.OTP_TTL_SECONDS,
    otpMode,
    sender:
      options.sender ??
      (otpMode === "sms"
        ? createMsg91Sender({
            authKey: env.MSG91_AUTH_KEY as string,
            templateId: env.MSG91_TEMPLATE_ID as string,
            expiryMinutes: Math.max(1, Math.round(env.OTP_TTL_SECONDS / 60)),
            baseUrl: env.MSG91_BASE_URL,
            onError: (reason) => app.log.error({ reason }, "sms delivery failed"),
          })
        : demoSender),
    testNumbers: parseTestNumbers(options.testNumbers ?? env.OTP_TEST_NUMBERS),
    now: options.now,
  });

  registerAuthRoutes(app, auth, db);
  registerAdminRoutes(app, db);
  registerAddressRoutes(app, db);
  const make = (baseUrl: string | undefined, fallback: string) =>
    createInternalClient({ baseUrl: baseUrl ?? fallback, apiKey: env.INTERNAL_API_KEY });
  registerAccountRoutes(
    app,
    db,
    options.clients ?? {
      order: make(env.ORDER_SERVICE_URL, "http://localhost:4004"),
      payment: make(env.PAYMENT_SERVICE_URL, "http://localhost:4005"),
      notification: make(env.NOTIFICATION_SERVICE_URL, "http://localhost:4007"),
    },
    options.now ?? (() => new Date()),
  );
  registerInternalRoutes(app, db);
  return app;
}
