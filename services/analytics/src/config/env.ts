import { baseEnvSchema, loadServiceEnv, optionalString, optionalUrl } from "@qc/service-kit";
import { z } from "zod";

const envSchema = baseEnvSchema.extend({
  DATABASE_URL: optionalString(),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().optional(),
  SUPABASE_URL: optionalUrl(),
  SUPABASE_JWKS_URL: optionalUrl(),
});

export const env = loadServiceEnv(
  envSchema,
  process.env,
  { portKey: "ANALYTICS_PORT", databaseUrlKey: "ANALYTICS_DATABASE_URL" },
  process.cwd(),
);
