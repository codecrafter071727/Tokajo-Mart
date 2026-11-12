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
