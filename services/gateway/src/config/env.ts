import { baseEnvSchema, loadServiceEnv, optionalString, optionalUrl } from "@qc/service-kit";

const envSchema = baseEnvSchema.extend({
  IDENTITY_SERVICE_URL: optionalUrl(),
  CATALOG_SERVICE_URL: optionalUrl(),
  WAREHOUSE_INVENTORY_SERVICE_URL: optionalUrl(),
  ORDER_SERVICE_URL: optionalUrl(),
  PAYMENT_SERVICE_URL: optionalUrl(),
  DELIVERY_SERVICE_URL: optionalUrl(),
  NOTIFICATION_SERVICE_URL: optionalUrl(),
  ANALYTICS_SERVICE_URL: optionalUrl(),
  SUPABASE_URL: optionalUrl(),
  SUPABASE_JWKS_URL: optionalUrl(),
  /** Verifies access tokens signed by the identity service. Development has a fixed fallback. */
  JWT_SECRET: optionalString(),
});

export const env = loadServiceEnv(
  envSchema,
  process.env,
  { portKey: "GATEWAY_PORT" },
  process.cwd(),
);
