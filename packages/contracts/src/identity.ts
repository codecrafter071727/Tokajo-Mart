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

// --- Admin: user administration ---------------------------------------------------------------

export const userStatusSchema = z.enum(["active", "blocked", "pending"]);

export const adminUsersQuerySchema = z.object({
  role: roleSchema.optional(),
  status: userStatusSchema.optional(),
  /** Matches part of a name, phone number or email */
  q: z.string().trim().min(1).max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  /** Opaque cursor from the previous page */
  cursor: z.string().min(1).max(200).optional(),
});

export const adminUserSchema = z.object({
  id: z.uuid(),
  role: roleSchema,
  name: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  status: userStatusSchema,
  warehouseId: z.string().nullable(),
  createdAt: z.string(),
  /** Only for riders */
  vehicle: z.string().nullable(),
  rating: z.number().nullable(),
});
export type AdminUser = z.infer<typeof adminUserSchema>;

export const adminUsersResponseSchema = z.object({
  items: z.array(adminUserSchema),
  nextCursor: z.string().nullable(),
});
export type AdminUsersResponse = z.infer<typeof adminUsersResponseSchema>;

export const updateRiderBodySchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    vehicle: z.string().trim().max(80).optional(),
    warehouseId: z.string().min(1).optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: "Send at least one field to change.",
  });

export const updateStaffBodySchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    role: z.enum(["warehouse_staff", "warehouse_manager"]).optional(),
    warehouseId: z.string().min(1).optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: "Send at least one field to change.",
  });

export const resetPasswordBodySchema = z.object({ password: z.string().min(10).max(200) });

// --- Customer addresses ------------------------------------------------------------------------

export const MAX_ADDRESSES = 20;

export const addressKindSchema = z.enum(["home", "work", "other"]);
export type AddressKind = z.infer<typeof addressKindSchema>;

export const customerAddressSchema = z.object({
  id: z.uuid(),
  kind: addressKindSchema,
  /** Name shown for an "other" address, for example "Parents". Empty for home and work. */
  label: z.string(),
  line1: z.string(),
  line2: z.string(),
  landmark: z.string(),
  instructions: z.string(),
  lat: z.number(),
  lng: z.number(),
  pincode: z.string().nullable(),
  /** The service area preset picked in the app, when there is one */
  areaId: z.string().nullable(),
  isDefault: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type CustomerAddress = z.infer<typeof customerAddressSchema>;

const addressFields = {
  kind: addressKindSchema,
  label: z.string().trim().max(30),
  line1: z.string().trim().min(3).max(200),
  line2: z.string().trim().max(150),
  landmark: z.string().trim().max(150),
  instructions: z.string().trim().max(200),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  pincode: z
    .string()
    .trim()
    .regex(/^[1-9][0-9]{5}$/, "A pincode has 6 digits.")
    .nullable(),
  areaId: z.string().trim().min(1).max(40).nullable(),
};

/** "Other" addresses need a name; home and work never keep one. */
const labelRule = (body: { kind?: AddressKind; label?: string }) =>
  body.kind !== "other" || (body.label ?? "").length >= 2;

export const createAddressBodySchema = z
  .object({
    ...addressFields,
    label: addressFields.label.default(""),
    line2: addressFields.line2.default(""),
    landmark: addressFields.landmark.default(""),
    instructions: addressFields.instructions.default(""),
    pincode: addressFields.pincode.default(null),
    areaId: addressFields.areaId.default(null),
    isDefault: z.boolean().default(false),
  })
  .strict()
  .refine(labelRule, { message: "Give this address a name, like Parents.", path: ["label"] });
export type CreateAddressBody = z.input<typeof createAddressBodySchema>;

export const updateAddressBodySchema = z
  .object({
    kind: addressFields.kind.optional(),
    label: addressFields.label.optional(),
    line1: addressFields.line1.optional(),
    line2: addressFields.line2.optional(),
    landmark: addressFields.landmark.optional(),
    instructions: addressFields.instructions.optional(),
    lat: addressFields.lat.optional(),
    lng: addressFields.lng.optional(),
    pincode: addressFields.pincode.optional(),
    areaId: addressFields.areaId.optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, { message: "Send at least one field to change." })
  .refine((body) => (body.lat === undefined) === (body.lng === undefined), {
    message: "Send latitude and longitude together.",
  });
export type UpdateAddressBody = z.input<typeof updateAddressBodySchema>;

export const addressParamsSchema = z.object({ id: z.uuid() });
export const addressListResponseSchema = z.object({ items: z.array(customerAddressSchema) });
export type AddressListResponse = z.infer<typeof addressListResponseSchema>;
