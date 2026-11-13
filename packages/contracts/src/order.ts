import { z } from "zod";
import { paymentStatusSchema } from "./payment";

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

export const paymentMethodSchema = z.enum(["cod", "online"]);
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

export const placeOrderBodySchema = z.object({
  items: z
    .array(z.object({ productId: z.string().min(1), quantity: z.number().int().min(1).max(100) }))
    .min(1)
    .max(100),
  /** Whole paise, set by the customer. The server never accepts a total from the client. */
  tipPaise: z.number().int().min(0).max(50_000).default(0),
  address: addressInputSchema,
  /** Cash on delivery, or online through Razorpay (the order waits in pending_payment until paid) */
  payment: paymentMethodSchema,
  /** A coupon code. The server checks and prices it; the client never sends a discount. */
  couponCode: z
    .string()
    .trim()
    .min(1)
    .max(20)
    .transform((c) => c.toUpperCase())
    .optional(),
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
  /** Taken off by a coupon (a free delivery coupon shows as a zero delivery fee instead) */
  discountPaise: z.number().int(),
  couponCode: z.string().nullable(),
  totalPaise: z.number().int(),
  paymentMethod: paymentMethodSchema,
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

export const adminOrderSchema = queueOrderSchema.extend({
  customerName: z.string(),
  customerPhone: z.string(),
  userId: z.uuid(),
  /** Null for cash on delivery, or when the payment service could not be reached */
  paymentStatus: paymentStatusSchema.nullable(),
});
export type AdminOrder = z.infer<typeof adminOrderSchema>;

const adminDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-11-13");

export const adminOrdersQuerySchema = z.object({
  status: orderStatusSchema.optional(),
  warehouseId: z.string().min(1).optional(),
  userId: z.uuid().optional(),
  paymentMethod: paymentMethodSchema.optional(),
  /** Part of an order number, for example 00042 or QC-261113 */
  q: z.string().trim().min(1).max(40).optional(),
  /** India local days, both ends included */
  from: adminDay.optional(),
  to: adminDay.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});
export type AdminOrdersQuery = z.input<typeof adminOrdersQuerySchema>;
export const adminOrdersResponseSchema = z.object({ items: z.array(adminOrderSchema) });
export type AdminOrdersResponse = z.infer<typeof adminOrdersResponseSchema>;

/** One order for the admin detail page: everything in the list row plus the full address. */
export const adminOrderDetailSchema = adminOrderSchema.extend({
  addressLat: z.number().nullable(),
  addressLng: z.number().nullable(),
  instructions: z.string().nullable(),
  outForDeliveryAt: z.string().nullable(),
});
export type AdminOrderDetail = z.infer<typeof adminOrderDetailSchema>;

export const orderHistoryEntrySchema = z.object({
  fromStatus: orderStatusSchema.nullable(),
  toStatus: orderStatusSchema,
  actorRole: z.string().nullable(),
  actorId: z.uuid().nullable(),
  note: z.string().nullable(),
  at: z.string(),
});
export type OrderHistoryEntry = z.infer<typeof orderHistoryEntrySchema>;
export const orderHistoryResponseSchema = z.object({ items: z.array(orderHistoryEntrySchema) });
export type OrderHistoryResponse = z.infer<typeof orderHistoryResponseSchema>;

// --- Reports ----------------------------------------------------------------------------------

const dayString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-11-13");

/** Days are India local days. Both ends are included. Default is the last 7 days up to today. */
export const orderSummaryQuerySchema = z.object({
  from: dayString.optional(),
  to: dayString.optional(),
  /** Admins may pick one warehouse. Managers always get their own. */
  warehouseId: z.string().min(1).optional(),
});

export const orderSummarySchema = z.object({
  from: dayString,
  to: dayString,
  warehouseId: z.string().nullable(),
  totals: z.object({
    orders: z.number().int(),
    delivered: z.number().int(),
    cancelled: z.number().int(),
    /** Placed and not yet delivered or cancelled */
    active: z.number().int(),
    /** Value of delivered orders only */
    gmvPaise: z.number().int(),
    /** GMV divided by delivered orders, 0 when none */
    averageOrderPaise: z.number().int(),
    /** Cancelled as a share of all orders, one decimal */
    cancelRatePercent: z.number(),
    /** Placed to delivered, over delivered orders. Null when none. */
    averageDeliveryMins: z.number().nullable(),
    /** Delivered within the promised time, share of delivered orders. Null when none. */
    onTimePercent: z.number().nullable(),
  }),
  byStatus: z.record(z.string(), z.number().int()),
  /** One entry per day in the range, zero filled. GMV is delivered orders only. */
  daily: z.array(
    z.object({ date: dayString, orders: z.number().int(), gmvPaise: z.number().int() }),
  ),
  /** Top 10 by revenue among orders that were not cancelled, failed or expired */
  topProducts: z.array(
    z.object({
      productId: z.string(),
      name: z.string(),
      quantity: z.number().int(),
      revenuePaise: z.number().int(),
    }),
  ),
  /** Admin only, empty for managers */
  byWarehouse: z.array(
    z.object({ warehouseId: z.string(), orders: z.number().int(), gmvPaise: z.number().int() }),
  ),
});
export type OrderSummary = z.infer<typeof orderSummarySchema>;

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

// --- Coupons -----------------------------------------------------------------------------------

export const couponTypeSchema = z.enum(["percent", "flat", "free_delivery"]);
export type CouponType = z.infer<typeof couponTypeSchema>;

const couponCodeSchema = z
  .string()
  .trim()
  .transform((c) => c.toUpperCase())
  .pipe(z.string().regex(/^[A-Z0-9]{3,20}$/, "Use 3 to 20 letters or digits."));

/** What a customer sees of a coupon, with whether they can use it right now and why not. */
export const couponOfferSchema = z.object({
  code: z.string(),
  title: z.string(),
  description: z.string(),
  type: couponTypeSchema,
  value: z.number().int(),
  maxDiscountPaise: z.number().int().nullable(),
  minOrderPaise: z.number().int(),
  endsAt: z.string().nullable(),
  eligible: z.boolean(),
  /** Why it cannot be used, for example "Only on your first order". Null when eligible. */
  reason: z.string().nullable(),
});
export type CouponOffer = z.infer<typeof couponOfferSchema>;
export const couponOffersResponseSchema = z.object({ items: z.array(couponOfferSchema) });

export const validateCouponBodySchema = z.object({
  code: z.string().trim().min(1).max(20),
  items: placeOrderBodySchema.shape.items,
  tipPaise: z.number().int().min(0).max(50_000).default(0),
});
export type ValidateCouponBody = z.input<typeof validateCouponBodySchema>;

export const priceBreakdownSchema = z.object({
  itemTotalPaise: z.number().int(),
  mrpTotalPaise: z.number().int(),
  savingsPaise: z.number().int(),
  deliveryFeePaise: z.number().int(),
  handlingFeePaise: z.number().int(),
  tipPaise: z.number().int(),
  totalPaise: z.number().int(),
  toFreeDeliveryPaise: z.number().int(),
  discountPaise: z.number().int(),
  deliveryWaivedPaise: z.number().int(),
  couponSavingsPaise: z.number().int(),
  appliedCoupon: z.object({ code: z.string(), type: couponTypeSchema }).nullable(),
  couponShortfallPaise: z.number().int(),
});

export const validateCouponResponseSchema = z.object({
  valid: z.boolean(),
  /** Why the coupon does not apply, null when it does */
  reason: z.string().nullable(),
  coupon: couponOfferSchema.nullable(),
  /** The cart priced with the coupon when valid, without it otherwise */
  price: priceBreakdownSchema,
});
export type ValidateCouponResponse = z.infer<typeof validateCouponResponseSchema>;

export const adminCouponSchema = z.object({
  id: z.uuid(),
  code: z.string(),
  title: z.string(),
  description: z.string(),
  type: couponTypeSchema,
  value: z.number().int(),
  maxDiscountPaise: z.number().int().nullable(),
  minOrderPaise: z.number().int(),
  startsAt: z.string().nullable(),
  endsAt: z.string().nullable(),
  usageLimitTotal: z.number().int().nullable(),
  usageLimitPerUser: z.number().int().nullable(),
  firstOrderOnly: z.boolean(),
  active: z.boolean(),
  /** live, scheduled, ended, used_up or inactive */
  state: z.enum(["live", "scheduled", "ended", "used_up", "inactive"]),
  redemptions: z.number().int(),
  discountGivenPaise: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type AdminCoupon = z.infer<typeof adminCouponSchema>;
export const adminCouponsResponseSchema = z.object({ items: z.array(adminCouponSchema) });

const couponFields = {
  title: z.string().trim().min(1).max(80),
  description: z.string().trim().max(300).default(""),
  type: couponTypeSchema,
  value: z.number().int().min(0).max(10_000_000),
  maxDiscountPaise: z.number().int().positive().nullable().default(null),
  minOrderPaise: z.number().int().min(0).default(0),
  startsAt: z.iso.datetime({ offset: true }).nullable().default(null),
  endsAt: z.iso.datetime({ offset: true }).nullable().default(null),
  usageLimitTotal: z.number().int().positive().nullable().default(null),
  usageLimitPerUser: z.number().int().positive().nullable().default(1),
  firstOrderOnly: z.boolean().default(false),
  active: z.boolean().default(true),
};

function checkCouponValue(
  body: { type?: CouponType; value?: number; startsAt?: string | null; endsAt?: string | null },
  ctx: z.RefinementCtx,
) {
  if (body.type === "percent" && body.value !== undefined && (body.value < 1 || body.value > 100)) {
    ctx.addIssue({ code: "custom", path: ["value"], message: "A percent coupon is 1 to 100." });
  }
  if (body.type === "flat" && body.value !== undefined && body.value < 1) {
    ctx.addIssue({ code: "custom", path: ["value"], message: "A flat coupon needs an amount." });
  }
  if (body.startsAt && body.endsAt && Date.parse(body.startsAt) >= Date.parse(body.endsAt)) {
    ctx.addIssue({ code: "custom", path: ["endsAt"], message: "The end must be after the start." });
  }
}

export const createCouponBodySchema = z
  .object({ code: couponCodeSchema, ...couponFields })
  .superRefine(checkCouponValue);
export type CreateCouponBody = z.input<typeof createCouponBodySchema>;

export const updateCouponBodySchema = z
  .object({
    title: couponFields.title.optional(),
    description: z.string().trim().max(300).optional(),
    type: couponTypeSchema.optional(),
    value: couponFields.value.optional(),
    maxDiscountPaise: z.number().int().positive().nullable().optional(),
    minOrderPaise: z.number().int().min(0).optional(),
    startsAt: z.iso.datetime({ offset: true }).nullable().optional(),
    endsAt: z.iso.datetime({ offset: true }).nullable().optional(),
    usageLimitTotal: z.number().int().positive().nullable().optional(),
    usageLimitPerUser: z.number().int().positive().nullable().optional(),
    firstOrderOnly: z.boolean().optional(),
    active: z.boolean().optional(),
  })
  .strict()
  .refine((b) => Object.keys(b).length > 0, { message: "Send at least one field to change." })
  .superRefine(checkCouponValue);
export type UpdateCouponBody = z.input<typeof updateCouponBodySchema>;

export const couponParamsSchema = z.object({ id: z.uuid() });
