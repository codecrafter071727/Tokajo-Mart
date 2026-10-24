import { baseEnvSchema, loadServiceEnv, optionalUrl } from "@qc/service-kit";

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
});

export const env = loadServiceEnv(
  envSchema,
  process.env,
  { portKey: "GATEWAY_PORT" },
  process.cwd(),
);
