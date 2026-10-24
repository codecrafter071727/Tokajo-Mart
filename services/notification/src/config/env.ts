import { baseEnvSchema, loadServiceEnv, optionalString, optionalUrl } from "@qc/service-kit";
import { z } from "zod";

const envSchema = baseEnvSchema.extend({
  DATABASE_URL: optionalString(),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().optional(),
  SUPABASE_URL: optionalUrl(),
  SUPABASE_JWKS_URL: optionalUrl(),
  AWS_REGION: optionalString(),
  AWS_ENDPOINT_URL: optionalUrl(),
  FCM_SERVICE_ACCOUNT: optionalString(),
  RESEND_API_KEY: optionalString(),
  EMAIL_FROM: optionalString(),
  SUPABASE_SMS_HOOK_SECRET: optionalString(),
  SMS_PROVIDER: optionalString(),
  SMS_PROVIDER_API_KEY: optionalString(),
  SMS_PROVIDER_SENDER_ID: optionalString(),
  SMS_PROVIDER_OTP_TEMPLATE_ID: optionalString(),
});

export const env = loadServiceEnv(
  envSchema,
  process.env,
  { portKey: "NOTIFICATION_PORT", databaseUrlKey: "NOTIFICATIONS_DATABASE_URL" },
  process.cwd(),
);
