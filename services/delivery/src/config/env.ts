import { baseEnvSchema, loadServiceEnv, optionalString, optionalUrl } from "@qc/service-kit";
import { z } from "zod";

const envSchema = baseEnvSchema.extend({
  DATABASE_URL: optionalString(),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().optional(),
  IDENTITY_SERVICE_URL: optionalUrl(),
  ORDER_SERVICE_URL: optionalUrl(),
  GOOGLE_MAPS_SERVER_KEY: optionalString(),
});

export const env = loadServiceEnv(
  envSchema,
  process.env,
  { portKey: "DELIVERY_PORT", databaseUrlKey: "DELIVERY_DATABASE_URL" },
  process.cwd(),
);
