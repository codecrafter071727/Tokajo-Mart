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

// ---------------------------------------------------------------------------------------------
// Warehouse tools: stock list, receiving, adjustments, ledger, warehouses (staff and admin only)
// ---------------------------------------------------------------------------------------------

const warehouseIdField = z.string().min(1).max(60);

export const stockRowSchema = z.object({
  productId: z.string(),
  warehouseId: z.string(),
  onHand: z.number().int().nonnegative(),
  reserved: z.number().int().nonnegative(),
  /** What can still be sold: on hand minus what is held for orders */
  available: z.number().int().nonnegative(),
  maxPerOrder: z.number().int().positive().nullable(),
  rackLocation: z.string().nullable(),
  updatedAt: z.string(),
});
export type StockRow = z.infer<typeof stockRowSchema>;

export const stockListQuerySchema = z.object({
  /** Staff always see their own warehouse. Admins must say which one. */
  warehouseId: warehouseIdField.optional(),
  /** Matches part of the product id */
  q: z.string().trim().min(1).max(60).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().min(1).optional(),
});
export const stockListResponseSchema = z.object({
  items: z.array(stockRowSchema),
  nextCursor: z.string().nullable(),
});
export type StockListResponse = z.infer<typeof stockListResponseSchema>;

export const receiveStockBodySchema = z.object({
  warehouseId: warehouseIdField.optional(),
  /** For example a supplier invoice or GRN number */
  reference: z.string().trim().min(1).max(100).optional(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().min(1).max(100_000),
        /** Best before or expiry date (YYYY-MM-DD). Recorded as a batch so it can be flagged. */
        expiresOn: z.iso.date().optional(),
        /** The supplier's batch or lot code, if any */
        batchCode: z.string().trim().min(1).max(60).optional(),
      }),
    )
    .min(1)
    .max(100),
});
export type ReceiveStockBody = z.input<typeof receiveStockBodySchema>;
export const receiveStockResponseSchema = z.object({ items: z.array(stockRowSchema) });

export const stockAdjustmentTypeSchema = z.enum(["adjustment", "damage", "expiry"]);
export const adjustStockBodySchema = z
  .object({
    warehouseId: warehouseIdField.optional(),
    productId: z.string().min(1),
    type: stockAdjustmentTypeSchema,
    /** Positive adds stock (a recount found more), negative removes it */
    quantityDelta: z
      .number()
      .int()
      .refine((n) => n !== 0, "The change cannot be zero."),
    reason: z.string().trim().min(3).max(200),
  })
  .refine((b) => b.type === "adjustment" || b.quantityDelta < 0, {
    message: "Damage and expiry remove stock, so the change must be negative.",
    path: ["quantityDelta"],
  });
export type AdjustStockBody = z.input<typeof adjustStockBodySchema>;

export const updateStockBodySchema = z
  .object({
    warehouseId: warehouseIdField.optional(),
    maxPerOrder: z.number().int().min(1).max(1000).nullable().optional(),
    rackLocation: z.string().trim().max(40).nullable().optional(),
  })
  .refine((b) => b.maxPerOrder !== undefined || b.rackLocation !== undefined, {
    message: "Send maxPerOrder or rackLocation.",
  });
export type UpdateStockBody = z.input<typeof updateStockBodySchema>;
export const stockProductParamsSchema = z.object({ productId: z.string().min(1) });

/** One product across every warehouse that stocks it (admin) */
export const productStockResponseSchema = z.object({
  productId: z.string(),
  items: z.array(stockRowSchema),
  totals: z.object({
    onHand: z.number().int().nonnegative(),
    reserved: z.number().int().nonnegative(),
    available: z.number().int().nonnegative(),
  }),
});
export type ProductStockResponse = z.infer<typeof productStockResponseSchema>;

export const stockMovementTypeSchema = z.enum([
  "grn",
  "sale",
  "adjustment",
  "damage",
  "expiry",
  "return",
]);
export const stockMovementSchema = z.object({
  id: z.string(),
  warehouseId: z.string(),
  productId: z.string(),
  type: stockMovementTypeSchema,
  quantityDelta: z.number().int(),
  reason: z.string().nullable(),
  reference: z.string().nullable(),
  actorId: z.string().nullable(),
  createdAt: z.string(),
});
export type StockMovement = z.infer<typeof stockMovementSchema>;

export const stockMovementsQuerySchema = z.object({
  warehouseId: warehouseIdField.optional(),
  productId: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().min(1).optional(),
});
export const stockMovementsResponseSchema = z.object({
  items: z.array(stockMovementSchema),
  nextCursor: z.string().nullable(),
});
export type StockMovementsResponse = z.infer<typeof stockMovementsResponseSchema>;

export const adminWarehouseSchema = z.object({
  id: z.string(),
  name: z.string(),
  lat: z.number(),
  lng: z.number(),
  radiusKm: z.number(),
  open: z.boolean(),
});
export type AdminWarehouse = z.infer<typeof adminWarehouseSchema>;
export const adminWarehousesResponseSchema = z.object({ items: z.array(adminWarehouseSchema) });

export const createWarehouseBodySchema = z.object({
  id: z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and dashes.")
    .max(60),
  name: z.string().trim().min(2).max(100),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radiusKm: z.number().min(0.5).max(50),
  open: z.boolean().default(true),
});
export type CreateWarehouseBody = z.input<typeof createWarehouseBodySchema>;

export const updateWarehouseBodySchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
    radiusKm: z.number().min(0.5).max(50).optional(),
    open: z.boolean().optional(),
  })
  .strict()
  .refine((b) => Object.keys(b).length > 0, { message: "Send at least one field to change." });
export type UpdateWarehouseBody = z.infer<typeof updateWarehouseBodySchema>;
export const warehouseParamsSchema = z.object({ id: z.string().min(1) });

// ---------------------------------------------------------------------------------------------
// Expiry and stock alerts (staff and admin)
// ---------------------------------------------------------------------------------------------

export const expiringQuerySchema = z.object({
  warehouseId: z.string().min(1).optional(),
  days: z.coerce.number().int().min(0).max(90).default(7),
});

export const expiringBatchSchema = z.object({
  id: z.string(),
  warehouseId: z.string(),
  productId: z.string(),
  batchCode: z.string().nullable(),
  quantity: z.number().int(),
  /** What is still on hand for the product, so a batch is never shown as more than exists */
  onHand: z.number().int(),
  expiresOn: z.string(),
  /** Negative once the date has passed */
  daysLeft: z.number().int(),
  receivedAt: z.string(),
});
export type ExpiringBatch = z.infer<typeof expiringBatchSchema>;
export const expiringResponseSchema = z.object({ items: z.array(expiringBatchSchema) });
export type ExpiringResponse = z.infer<typeof expiringResponseSchema>;

export const stockAlertKindSchema = z.enum(["out_of_stock", "low_stock", "expiring", "expired"]);
export type StockAlertKind = z.infer<typeof stockAlertKindSchema>;

export const stockAlertSchema = z.object({
  kind: stockAlertKindSchema,
  warehouseId: z.string(),
  productId: z.string(),
  /** Free to sell now (on hand minus held) */
  available: z.number().int(),
  /** For expiry alerts */
  expiresOn: z.string().nullable(),
  daysLeft: z.number().int().nullable(),
  quantity: z.number().int().nullable(),
});
export type StockAlert = z.infer<typeof stockAlertSchema>;

export const stockAlertsQuerySchema = z.object({
  warehouseId: z.string().min(1).optional(),
  /** Low stock means available is above zero and at or below this */
  lowThreshold: z.coerce.number().int().min(1).max(1000).default(5),
  expiryDays: z.coerce.number().int().min(0).max(90).default(7),
});
export const stockAlertsResponseSchema = z.object({
  items: z.array(stockAlertSchema),
  counts: z.object({
    outOfStock: z.number().int(),
    lowStock: z.number().int(),
    expiring: z.number().int(),
    expired: z.number().int(),
  }),
});
export type StockAlertsResponse = z.infer<typeof stockAlertsResponseSchema>;
