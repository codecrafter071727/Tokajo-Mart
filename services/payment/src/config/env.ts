import { baseEnvSchema, loadServiceEnv, optionalString, optionalUrl } from "@qc/service-kit";
import { z } from "zod";

const envSchema = baseEnvSchema.extend({
  DATABASE_URL: optionalString(),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().optional(),
  SUPABASE_URL: optionalUrl(),
  SUPABASE_JWKS_URL: optionalUrl(),
  AWS_REGION: optionalString(),
  AWS_ENDPOINT_URL: optionalUrl(),
  ORDER_SERVICE_URL: optionalUrl(),
  RAZORPAY_KEY_ID: optionalString(),
  RAZORPAY_KEY_SECRET: optionalString(),
  RAZORPAY_WEBHOOK_SECRET: optionalString(),
});

export const env = loadServiceEnv(
  envSchema,
  process.env,
  { portKey: "PAYMENT_PORT", databaseUrlKey: "PAYMENTS_DATABASE_URL" },
  process.cwd(),
);
