import { baseEnvSchema, loadServiceEnv, optionalString, optionalUrl } from "@qc/service-kit";
import { z } from "zod";

const envSchema = baseEnvSchema.extend({
  DATABASE_URL: optionalString(),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().optional(),
  IDENTITY_SERVICE_URL: optionalUrl(),
  ORDER_SERVICE_URL: optionalUrl(),
  GOOGLE_MAPS_SERVER_KEY: optionalString(),
  /**
   * Where door photos are kept. Development defaults to services/delivery/.data/pod. Production
   * must set it (or a later S3 adapter); without it uploads answer 503 instead of using a
   * container disk that disappears on deploy.
   */
  POD_STORAGE_DIR: optionalString(),
});

export const env = loadServiceEnv(
  envSchema,
  process.env,
  { portKey: "DELIVERY_PORT", databaseUrlKey: "DELIVERY_DATABASE_URL" },
  process.cwd(),
);
