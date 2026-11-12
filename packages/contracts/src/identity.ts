import { z } from "zod";

export const roleSchema = z.enum([
  "customer",
  "rider",
  "warehouse_staff",
  "warehouse_manager",
  "admin",
]);
export type Role = z.infer<typeof roleSchema>;

/** Roles that sign in with a phone code. Staff and admins use email and password. */
export const phoneRoleSchema = z.enum(["customer", "rider"]);

export const phoneSchema = z
  .string()
  .regex(/^\+[0-9]{8,15}$/, "Use international format, for example +919876543210");

export const authUserSchema = z.object({
  id: z.uuid(),
  role: roleSchema,
  name: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  warehouseId: z.string().nullable(),
});
export type AuthUser = z.infer<typeof authUserSchema>;

export const authResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  /** Seconds until the access token expires */
  expiresIn: z.number().int().positive(),
  user: authUserSchema,
});
export type AuthResponse = z.infer<typeof authResponseSchema>;

export const otpRequestBodySchema = z.object({
  phone: phoneSchema,
  role: phoneRoleSchema.default("customer"),
});
export type OtpRequestBody = z.input<typeof otpRequestBodySchema>;

export const otpRequestResponseSchema = z.object({
  expiresInSeconds: z.number().int().positive(),
  /** How many digits the code has, so the app can show the right number of boxes */
  codeLength: z.number().int(),
  /** True when no SMS provider is configured and a fixed demo code is accepted */
  demoMode: z.boolean(),
});
export type OtpRequestResponse = z.infer<typeof otpRequestResponseSchema>;

export const otpVerifyBodySchema = z.object({
  phone: phoneSchema,
  role: phoneRoleSchema.default("customer"),
  code: z.string().regex(/^[0-9]{4,6}$/),
  /** Used when a new customer account is created */
  name: z.string().trim().min(1).max(80).optional(),
});
export type OtpVerifyBody = z.input<typeof otpVerifyBodySchema>;

export const passwordLoginBodySchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(1).max(200),
});
export type PasswordLoginBody = z.input<typeof passwordLoginBodySchema>;

export const refreshBodySchema = z.object({ refreshToken: z.string().min(20).max(200) });
export type RefreshBody = z.infer<typeof refreshBodySchema>;

/** What is inside the access token. The gateway trusts only these, never the request body. */
export const tokenClaimsSchema = z.object({
  sub: z.string(),
  app_role: roleSchema,
  warehouse_id: z.string().optional(),
  iat: z.number(),
  exp: z.number(),
});
export type TokenClaims = z.infer<typeof tokenClaimsSchema>;

/** Headers the gateway sets for the services behind it (after verifying the token). */
export const GATEWAY_HEADERS = {
  userId: "x-user-id",
  role: "x-user-role",
  warehouseId: "x-warehouse-id",
  /** HMAC of the three headers above, proving they came from the gateway */
  signature: "x-gateway-signature",
} as const;
