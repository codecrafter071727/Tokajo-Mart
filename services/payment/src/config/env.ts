import { baseEnvSchema, loadServiceEnv, optionalString, optionalUrl } from "@qc/service-kit";
import { z } from "zod";

const envSchema = baseEnvSchema.extend({
  DATABASE_URL: optionalString(),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().optional(),
  ORDER_SERVICE_URL: optionalUrl(),
  /** Razorpay API keys (Dashboard, Account and Settings, API keys). Test keys start with rzp_test_. */
  RAZORPAY_KEY_ID: optionalString(),
  RAZORPAY_KEY_SECRET: optionalString(),
  /** The secret set on the webhook in the Razorpay dashboard */
  RAZORPAY_WEBHOOK_SECRET: optionalString(),
  /** Shown at the top of the Razorpay checkout sheet */
  PAYMENTS_MERCHANT_NAME: z.string().default("Tokajo Mart"),
  /** CI and local tests only: a pretend Razorpay that never calls the network. Refused in production. */
  PAYMENTS_FAKE_PROVIDER: z
    .enum(["0", "1", "true", "false"])
    .optional()
    .transform((value) => value === "1" || value === "true"),
});

export const env = loadServiceEnv(
  envSchema,
  process.env,
  { portKey: "PAYMENT_PORT", databaseUrlKey: "PAYMENTS_DATABASE_URL" },
  process.cwd(),
);
