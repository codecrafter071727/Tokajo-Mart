import { z } from "zod";

export const riderDeliveryStatusSchema = z.enum([
  "offered",
  "assigned",
  "at_store",
  "picked_up",
  "at_customer",
  "delivered",
]);
export type RiderDeliveryStatus = z.infer<typeof riderDeliveryStatusSchema>;

const placeSchema = z.object({
  name: z.string(),
  address: z.string(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
});

/**
 * A delivery as the rider sees it. It deliberately has no delivery code: the customer reads that
 * out at the door and the server checks what the rider types.
 */
export const riderDeliverySchema = z.object({
  id: z.uuid(),
  orderNumber: z.string(),
  status: riderDeliveryStatusSchema,
  store: placeSchema,
  customer: placeSchema.extend({ phone: z.string(), instructions: z.string().nullable() }),
  items: z.array(
    z.object({ id: z.string(), name: z.string(), quantity: z.number().int(), emoji: z.string() }),
  ),
  distanceKm: z.number(),
  etaMins: z.number().int(),
  payoutPaise: z.number().int(),
  tipPaise: z.number().int(),
  /** Cash to collect at the door, or null when the order is already paid */
  codPaise: z.number().int().nullable(),
  deliveredAt: z.string().nullable(),
  /** True once a door photo has been uploaded for this delivery */
  podUploaded: z.boolean().optional(),
});
export type RiderDelivery = z.infer<typeof riderDeliverySchema>;

export const riderStateSchema = z.object({
  online: z.boolean(),
  /** The offer on screen or the delivery in progress */
  active: riderDeliverySchema.nullable(),
  /** Deliveries completed today, newest first */
  history: z.array(riderDeliverySchema),
});
export type RiderState = z.infer<typeof riderStateSchema>;

export const setOnlineBodySchema = z.object({ online: z.boolean() });

export const riderActionBodySchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("accept") }),
  z.object({ type: z.literal("decline") }),
  z.object({ type: z.literal("arrive_store") }),
  z.object({
    type: z.literal("pick_up"),
    checkedItemIds: z.array(z.string()),
    /** The code on the warehouse handover screen */
    handoverCode: z.string().regex(/^[0-9]{4}$/),
  }),
  z.object({ type: z.literal("arrive_customer") }),
  z.object({ type: z.literal("deliver"), code: z.string().regex(/^[0-9]{4}$/) }),
]);
export type RiderAction = z.infer<typeof riderActionBodySchema>;

export const deliveryParamsSchema = z.object({ id: z.uuid() });

// --- Warehouse handover screen ---------------------------------------------------------------

export const handoverSchema = z.object({
  deliveryId: z.uuid(),
  orderNumber: z.string(),
  status: z.enum([
    "unassigned",
    "offered",
    "assigned",
    "at_store",
    "picked_up",
    "at_customer",
    "delivered",
    "cancelled",
  ]),
  itemCount: z.number().int(),
  rider: z.object({ name: z.string(), phone: z.string().nullable() }).nullable(),
  /** The rider enters this to confirm pickup. Shown to warehouse staff only. */
  handoverCode: z.string(),
});
export type Handover = z.infer<typeof handoverSchema>;
export const handoverListResponseSchema = z.object({ items: z.array(handoverSchema) });

// --- Admin ------------------------------------------------------------------------------------

export const adminRiderSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  phone: z.string().nullable(),
  vehicle: z.string(),
  rating: z.number(),
  status: z.enum(["online", "on_delivery", "offline"]),
  deliveriesToday: z.number().int(),
  warehouseId: z.string(),
});
export type AdminRider = z.infer<typeof adminRiderSchema>;
export const adminRidersResponseSchema = z.object({ items: z.array(adminRiderSchema) });

export const riderStatsSchema = z.object({
  deliveries: z.number().int().nonnegative(),
  /** Payout plus tips for delivered orders */
  earningsPaise: z.number().int().nonnegative(),
  /** Minutes from the order being packed to delivered, null when nothing was delivered */
  averageMins: z.number().nullable(),
  /** Wrong customer codes typed at the door */
  wrongCodes: z.number().int().nonnegative(),
});
export type RiderStats = z.infer<typeof riderStatsSchema>;

export const adminDeliveryStatusSchema = z.enum([
  "unassigned",
  "offered",
  "assigned",
  "at_store",
  "picked_up",
  "at_customer",
  "delivered",
  "cancelled",
]);

/** One delivery as an admin sees it. Never carries the handover or customer codes. */
export const adminDeliverySchema = z.object({
  id: z.uuid(),
  orderId: z.uuid(),
  orderNumber: z.string(),
  warehouseId: z.string(),
  status: adminDeliveryStatusSchema,
  rider: z.object({ id: z.uuid(), name: z.string(), phone: z.string().nullable() }).nullable(),
  customerName: z.string(),
  customerAddress: z.string(),
  itemCount: z.number().int(),
  distanceKm: z.number(),
  payoutPaise: z.number().int(),
  tipPaise: z.number().int(),
  codPaise: z.number().int().nullable(),
  createdAt: z.string(),
  deliveredAt: z.string().nullable(),
  /** Minutes since the delivery was created (active) or that it took (delivered) */
  minutes: z.number().int().nonnegative(),
});
export type AdminDelivery = z.infer<typeof adminDeliverySchema>;

export const adminRiderDetailSchema = z.object({
  rider: adminRiderSchema,
  today: riderStatsSchema,
  last30Days: riderStatsSchema,
  current: adminDeliverySchema.nullable(),
});
export type AdminRiderDetail = z.infer<typeof adminRiderDetailSchema>;

export const adminRiderParamsSchema = z.object({ id: z.uuid() });
export const adminRiderDeliveriesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().min(1).optional(),
});
export const adminDeliveriesResponseSchema = z.object({
  items: z.array(adminDeliverySchema),
  nextCursor: z.string().nullable(),
});
export type AdminDeliveriesResponse = z.infer<typeof adminDeliveriesResponseSchema>;

export const adminLiveQuerySchema = z.object({ warehouseId: z.string().min(1).optional() });
export const adminLiveResponseSchema = z.object({ items: z.array(adminDeliverySchema) });
export type AdminLiveResponse = z.infer<typeof adminLiveResponseSchema>;

// --- Internal ---------------------------------------------------------------------------------

export const createDeliveryBodySchema = z.object({
  orderId: z.uuid(),
  orderNumber: z.string(),
  warehouseId: z.string(),
  store: z.object({ name: z.string(), address: z.string(), lat: z.number(), lng: z.number() }),
  customer: z.object({
    name: z.string(),
    phone: z.string(),
    address: z.string(),
    lat: z.number().nullable(),
    lng: z.number().nullable(),
    instructions: z.string().nullable(),
  }),
  items: z
    .array(
      z.object({ id: z.string(), name: z.string(), quantity: z.number().int(), emoji: z.string() }),
    )
    .min(1),
  distanceKm: z.number(),
  etaMins: z.number().int(),
  tipPaise: z.number().int(),
  codPaise: z.number().int().nullable(),
  deliveryCode: z.string().regex(/^[0-9]{4}$/),
});
export type CreateDeliveryBody = z.infer<typeof createDeliveryBodySchema>;

// --- Live location and tracking ----------------------------------------------------------------

/** One reading from the rider's phone. Only the latest is kept. */
export const riderLocationBodySchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracyM: z.number().min(0).max(10_000).nullable().optional(),
  heading: z.number().min(0).lt(360).nullable().optional(),
  /** Metres per second, as the phone reports it */
  speed: z.number().min(0).max(100).nullable().optional(),
  /** When the phone took the reading (ISO time) */
  recordedAt: z.iso.datetime({ offset: true }),
});
export type RiderLocationBody = z.input<typeof riderLocationBodySchema>;

export const riderLocationAckSchema = z.object({
  accepted: z.literal(true),
  nextInSeconds: z.number(),
});

const pointSchema = z.object({ lat: z.number(), lng: z.number() });

export const riderPositionSchema = pointSchema.extend({
  heading: z.number().nullable(),
  updatedAt: z.string(),
  /** Seconds since the phone took the reading */
  ageSeconds: z.number().int(),
});
export type RiderPosition = z.infer<typeof riderPositionSchema>;

/**
 * What the customer sees while their order is on the way. `active` is false before pickup and
 * after delivery, and then nothing about the rider's position is returned.
 */
export const trackingSchema = z.object({
  active: z.boolean(),
  status: z.string(),
  rider: riderPositionSchema.nullable(),
  store: pointSchema.nullable(),
  destination: pointSchema.nullable(),
  /** Straight line distance from the rider (or the store) to the customer */
  distanceKm: z.number().nullable(),
  etaMins: z.number().int().nullable(),
  podAvailable: z.boolean(),
});
export type Tracking = z.infer<typeof trackingSchema>;
export const trackingParamsSchema = z.object({ orderId: z.uuid() });

// --- Proof of delivery photo ---------------------------------------------------------------------

/** Largest door photo we keep, after the app has compressed it */
export const POD_MAX_BYTES = 1_500_000;

export const podUploadBodySchema = z.object({
  contentType: z.literal("image/jpeg"),
  /** The JPEG, base64 encoded (no data: prefix) */
  // A loose bound: the service decodes it and answers 413 when the photo itself is too big
  imageBase64: z.string().min(100).max(2_250_000),
});
export type PodUploadBody = z.infer<typeof podUploadBodySchema>;
export const podUploadResponseSchema = z.object({
  uploaded: z.literal(true),
  bytes: z.number().int(),
  uploadedAt: z.string(),
});

/** The delivery side of an order, for the admin order page */
export const adminOrderDeliverySchema = z.object({
  deliveryId: z.uuid(),
  status: adminDeliveryStatusSchema,
  riderLocation: riderPositionSchema.nullable(),
  podAvailable: z.boolean(),
  podUploadedAt: z.string().nullable(),
});
export type AdminOrderDelivery = z.infer<typeof adminOrderDeliverySchema>;
