import { z } from "zod";

/** Is this address inside a service area, and which warehouse would serve it. */
export const serviceabilityQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});
export type ServiceabilityQuery = { lat: number; lng: number };

export const serviceabilityResponseSchema = z.object({
  serviceable: z.boolean(),
  warehouseId: z.string().nullable(),
  /** Delivery promise from the serving warehouse, null when not serviceable */
  etaMins: z.number().int().positive().nullable(),
  /** Set when not serviceable, for example "OUTSIDE_SERVICE_AREA" or "WAREHOUSE_CLOSED" */
  reason: z.string().nullable(),
});
export type ServiceabilityResponse = z.infer<typeof serviceabilityResponseSchema>;

export const stockStatusSchema = z.enum(["in_stock", "low", "out"]);
export type StockStatus = z.infer<typeof stockStatusSchema>;

export const availabilityQuerySchema = z.object({
  warehouseId: z.string().min(1),
  /** Comma separated product ids, up to 100 */
  productIds: z
    .string()
    .min(1)
    .transform((value) =>
      value
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.string()).min(1).max(100)),
});

export const availabilityItemSchema = z.object({
  productId: z.string(),
  status: stockStatusSchema,
  /** Real count, only exposed to the client when status is "low" (3 or fewer) */
  remaining: z.number().int().nonnegative().nullable(),
  /** Per order limit, null when there is none */
  maxPerOrder: z.number().int().positive().nullable(),
});
export type AvailabilityItem = z.infer<typeof availabilityItemSchema>;

export const availabilityResponseSchema = z.object({
  items: z.array(availabilityItemSchema),
});
export type AvailabilityResponse = z.infer<typeof availabilityResponseSchema>;

// ---------------------------------------------------------------------------------------------
// Internal surface (called by the order service, never exposed through the gateway)
// ---------------------------------------------------------------------------------------------

export const stockLineSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1).max(100),
});
export type StockLine = z.infer<typeof stockLineSchema>;

/** Which warehouse should serve this basket at this place, if any. */
export const resolveRequestSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  items: z.array(stockLineSchema).min(1).max(100),
});
export type ResolveRequest = z.infer<typeof resolveRequestSchema>;

export const resolveResponseSchema = z.object({
  serviceable: z.boolean(),
  warehouseId: z.string().nullable(),
  etaMins: z.number().int().positive().nullable(),
  distanceKm: z.number().nullable(),
  /** "OUTSIDE_SERVICE_AREA", "WAREHOUSE_CLOSED" or "ITEMS_UNAVAILABLE" when not serviceable */
  reason: z.string().nullable(),
  /** Lines the nearest open warehouse cannot cover, when reason is ITEMS_UNAVAILABLE */
  unavailable: z.array(
    z.object({ productId: z.string(), requested: z.number(), available: z.number() }),
  ),
});
export type ResolveResponse = z.infer<typeof resolveResponseSchema>;

export const reserveRequestSchema = z.object({
  warehouseId: z.string().min(1),
  /** The caller's own reference, normally the order id. Sending it again returns the same hold. */
  reference: z.string().min(1).max(100),
  items: z.array(stockLineSchema).min(1).max(100),
  ttlSeconds: z.number().int().min(30).max(3600).default(600),
});
export type ReserveRequest = z.input<typeof reserveRequestSchema>;

export const reservationSchema = z.object({
  id: z.string(),
  warehouseId: z.string(),
  reference: z.string(),
  status: z.enum(["held", "committed", "released", "expired"]),
  expiresAt: z.string(),
});
export type Reservation = z.infer<typeof reservationSchema>;

export const reservationRefParamsSchema = z.object({ reference: z.string().min(1) });

export const warehouseSchema = z.object({
  id: z.string(),
  name: z.string(),
  lat: z.number(),
  lng: z.number(),
  open: z.boolean(),
});
export type Warehouse = z.infer<typeof warehouseSchema>;
