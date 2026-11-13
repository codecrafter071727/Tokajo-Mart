import { baseEnvSchema, loadServiceEnv, optionalString } from "@qc/service-kit";
import { z } from "zod";

const envSchema = baseEnvSchema.extend({
  DATABASE_URL: optionalString(),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().optional(),
  /** Push and email are not wired yet; these stay for when Firebase and Resend are set up */
  FCM_SERVICE_ACCOUNT: optionalString(),
  RESEND_API_KEY: optionalString(),
  EMAIL_FROM: optionalString(),
});

export const env = loadServiceEnv(
  envSchema,
  process.env,
  { portKey: "NOTIFICATION_PORT", databaseUrlKey: "NOTIFICATIONS_DATABASE_URL" },
  process.cwd(),
);
