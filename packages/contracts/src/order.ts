import { z } from "zod";

export const orderStatusSchema = z.enum([
  "pending_payment",
  "confirmed",
  "packing",
  "packed",
  "picked_up",
  "out_for_delivery",
  "delivered",
  "cancelled",
  "payment_failed",
  "expired",
]);
export type OrderStatus = z.infer<typeof orderStatusSchema>;

/** Who may move an order to each status, and from where (see ARCHITECTURE.md 4.5). */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending_payment: ["confirmed", "payment_failed", "expired", "cancelled"],
  confirmed: ["packing", "cancelled"],
  packing: ["packed", "cancelled"],
  packed: ["picked_up", "cancelled"],
  picked_up: ["out_for_delivery", "cancelled"],
  out_for_delivery: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
  payment_failed: ["pending_payment", "expired"],
  expired: [],
};

/** A customer may cancel until the warehouse starts packing. After that only an admin can. */
export const CUSTOMER_CANCELLABLE: OrderStatus[] = ["pending_payment", "confirmed"];

export const orderItemSchema = z.object({
  productId: z.string(),
  name: z.string(),
  unit: z.string(),
  quantity: z.number().int().positive(),
  unitPricePaise: z.number().int().nonnegative(),
  mrpPaise: z.number().int().nonnegative(),
  emoji: z.string(),
  imageUrl: z.string().nullable(),
  /** Ticked by the picker during packing */
  picked: z.boolean(),
});
export type OrderItem = z.infer<typeof orderItemSchema>;

export const addressInputSchema = z.object({
  tag: z.string().trim().min(1).max(30),
  line1: z.string().trim().min(1).max(200),
  line2: z.string().trim().max(200).default(""),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  instructions: z.string().trim().max(200).nullable().optional(),
});
export type AddressInput = z.input<typeof addressInputSchema>;

export const placeOrderBodySchema = z.object({
  items: z
    .array(z.object({ productId: z.string().min(1), quantity: z.number().int().min(1).max(100) }))
    .min(1)
    .max(100),
  /** Whole paise, set by the customer. The server never accepts a total from the client. */
  tipPaise: z.number().int().min(0).max(50_000).default(0),
  address: addressInputSchema,
  payment: z.literal("cod"),
});
export type PlaceOrderBody = z.input<typeof placeOrderBodySchema>;

const riderInfoSchema = z.object({
  name: z.string(),
  phone: z.string().nullable(),
  rating: z.number(),
});

export const orderSchema = z.object({
  id: z.uuid(),
  number: z.string(),
  status: orderStatusSchema,
  warehouseId: z.string(),
  items: z.array(orderItemSchema),
  itemTotalPaise: z.number().int(),
  mrpTotalPaise: z.number().int(),
  savingsPaise: z.number().int(),
  deliveryFeePaise: z.number().int(),
  handlingFeePaise: z.number().int(),
  tipPaise: z.number().int(),
  totalPaise: z.number().int(),
  paymentMethod: z.literal("cod"),
  promisedMins: z.number().int(),
  address: z.object({ tag: z.string(), line1: z.string(), line2: z.string() }),
  /** The customer reads this to the rider at the door. Only shown to the customer who owns the order. */
  deliveryCode: z.string().nullable(),
  rider: riderInfoSchema.nullable(),
  placedAt: z.string(),
  confirmedAt: z.string().nullable(),
  packedAt: z.string().nullable(),
  pickedUpAt: z.string().nullable(),
  deliveredAt: z.string().nullable(),
  cancelledAt: z.string().nullable(),
  cancelReason: z.string().nullable(),
});
export type Order = z.infer<typeof orderSchema>;

export const orderParamsSchema = z.object({ id: z.uuid() });

export const listOrdersQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
  /** Only for admins: look at one customer's orders */
  userId: z.uuid().optional(),
});
export const listOrdersResponseSchema = z.object({ items: z.array(orderSchema) });
export type ListOrdersResponse = z.infer<typeof listOrdersResponseSchema>;

export const cancelOrderBodySchema = z.object({ reason: z.string().trim().max(200).optional() });

// --- Warehouse (pick and pack) ---------------------------------------------------------------

export const queueOrderSchema = orderSchema.omit({ deliveryCode: true });
export type QueueOrder = z.infer<typeof queueOrderSchema>;

export const queueResponseSchema = z.object({ items: z.array(queueOrderSchema) });
export type QueueResponse = z.infer<typeof queueResponseSchema>;

// --- Admin and manager overview ---------------------------------------------------------------

export const adminOrderSchema = queueOrderSchema.extend({ customerName: z.string() });
export type AdminOrder = z.infer<typeof adminOrderSchema>;

export const adminOrdersQuerySchema = z.object({
  status: orderStatusSchema.optional(),
  warehouseId: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});
export const adminOrdersResponseSchema = z.object({ items: z.array(adminOrderSchema) });
export type AdminOrdersResponse = z.infer<typeof adminOrdersResponseSchema>;

export const pickItemBodySchema = z.object({ picked: z.boolean() });
export const pickItemParamsSchema = z.object({ id: z.uuid(), productId: z.string().min(1) });

// --- Internal ---------------------------------------------------------------------------------

export const transitionBodySchema = z.object({
  to: orderStatusSchema,
  actorId: z.uuid().nullable(),
  actorRole: z.string(),
  note: z.string().max(200).optional(),
  riderId: z.uuid().optional(),
});
export type TransitionBody = z.infer<typeof transitionBodySchema>;
