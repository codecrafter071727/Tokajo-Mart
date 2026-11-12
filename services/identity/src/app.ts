import {
  createDatabaseReadinessCheck,
  createDb,
  createService,
  DEV_JWT_SECRET,
  type Kysely,
} from "@qc/service-kit";
import { env } from "./config/env";
import type { DB } from "./db/types.generated";
import { registerAdminRoutes } from "./modules/admin/routes";
import { demoSender, type OtpSender } from "./modules/auth/otp";
import { registerAuthRoutes } from "./modules/auth/routes";
import { AuthService } from "./modules/auth/service";
import { registerInternalRoutes } from "./modules/internal/routes";

export type BuildAppOptions = {
  /** Injected in tests. Defaults to the configured database. */
  db?: Kysely<DB>;
  sender?: OtpSender;
  now?: () => Date;
};

export async function buildApp(options: BuildAppOptions = {}) {
  const production = env.NODE_ENV === "production";
  const jwtSecret = env.JWT_SECRET ?? (production ? undefined : DEV_JWT_SECRET);
  if (!jwtSecret) throw new Error("JWT_SECRET must be set in production.");

  // Real SMS needs a provider (MSG91 with DLT registration in India). Until one is configured the
  // service stays in demo mode, which accepts a fixed code and sends nothing. Production must not.
  const otpMode = env.OTP_MODE ?? (production ? "sms" : "demo");
  if (otpMode === "sms" && !options.sender) {
    throw new Error(
      "OTP_MODE=sms needs an SMS provider. None is configured yet; use OTP_MODE=demo outside production.",
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
    sender: options.sender ?? demoSender,
    now: options.now,
  });

  registerAuthRoutes(app, auth, db);
  registerAdminRoutes(app, db);
  registerInternalRoutes(app, db);
  return app;
}
