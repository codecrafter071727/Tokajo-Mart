import { baseEnvSchema, loadServiceEnv, optionalString, optionalUrl } from "@qc/service-kit";
import { z } from "zod";

const envSchema = baseEnvSchema.extend({
  DATABASE_URL: optionalString(),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().optional(),
  SUPABASE_URL: optionalUrl(),
  SUPABASE_JWKS_URL: optionalUrl(),
  AWS_REGION: optionalString(),
  AWS_ENDPOINT_URL: optionalUrl(),
  SUPABASE_SERVICE_ROLE_KEY: optionalString(),
  SUPABASE_AUTH_HOOK_SECRET: optionalString(),
  GOOGLE_MAPS_SERVER_KEY: optionalString(),
  /** Signs access tokens (HS256). Required in production; development has a fixed fallback. */
  JWT_SECRET: optionalString(),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).default(3600),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).default(30),
  /** "demo" accepts a fixed code and sends no SMS. "sms" needs a configured SMS provider. */
  OTP_MODE: z.enum(["demo", "sms"]).optional(),
  OTP_TTL_SECONDS: z.coerce.number().int().min(30).default(300),
});

export const env = loadServiceEnv(
  envSchema,
  process.env,
  { portKey: "IDENTITY_PORT", databaseUrlKey: "IDENTITY_DATABASE_URL" },
  process.cwd(),
);
