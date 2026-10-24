import { baseEnvSchema, loadServiceEnv, optionalString, optionalUrl } from "@qc/service-kit";
import { z } from "zod";

const envSchema = baseEnvSchema.extend({
  DATABASE_URL: optionalString(),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().optional(),
  SUPABASE_URL: optionalUrl(),
  SUPABASE_JWKS_URL: optionalUrl(),
  AWS_REGION: optionalString(),
  AWS_ENDPOINT_URL: optionalUrl(),
  IDENTITY_SERVICE_URL: optionalUrl(),
  CATALOG_SERVICE_URL: optionalUrl(),
  WAREHOUSE_INVENTORY_SERVICE_URL: optionalUrl(),
  PAYMENT_SERVICE_URL: optionalUrl(),
});

export const env = loadServiceEnv(
  envSchema,
  process.env,
  { portKey: "ORDER_PORT", databaseUrlKey: "ORDERS_DATABASE_URL" },
  process.cwd(),
);
