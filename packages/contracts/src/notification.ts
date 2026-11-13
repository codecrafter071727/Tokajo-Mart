import { z } from "zod";

/** Kinds of notification. Free text on the wire so a new kind never breaks an old app. */
export const NOTIFICATION_TYPES = {
  orderConfirmed: "order.confirmed",
  orderPacking: "order.packing",
  orderOutForDelivery: "order.out_for_delivery",
  orderDelivered: "order.delivered",
  orderCancelled: "order.cancelled",
  orderRefunded: "order.refunded",
  riderAssigned: "delivery.rider_assigned",
  backInStock: "stock.back_in_stock",
} as const;

/** Where tapping a notification goes. Only these keys are understood by the apps. */
export const notificationDataSchema = z
  .object({
    orderId: z.string().optional(),
    orderNumber: z.string().optional(),
    productId: z.string().optional(),
    warehouseId: z.string().optional(),
  })
  .catchall(z.union([z.string(), z.number(), z.boolean(), z.null()]));
export type NotificationData = z.infer<typeof notificationDataSchema>;

export const notificationSchema = z.object({
  id: z.uuid(),
  type: z.string(),
  title: z.string(),
  body: z.string(),
  data: notificationDataSchema,
  readAt: z.string().nullable(),
  createdAt: z.string(),
});
export type Notification = z.infer<typeof notificationSchema>;

export const listNotificationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
  cursor: z.string().min(1).optional(),
});
export const listNotificationsResponseSchema = z.object({
  items: z.array(notificationSchema),
  nextCursor: z.string().nullable(),
});
export type ListNotificationsResponse = z.infer<typeof listNotificationsResponseSchema>;

export const unreadCountResponseSchema = z.object({ unread: z.number().int() });
export const notificationParamsSchema = z.object({ id: z.uuid() });

// --- Notify me -------------------------------------------------------------------------------

export const subscribeBodySchema = z.object({
  productId: z.string().min(1).max(100),
  warehouseId: z.string().min(1).max(100),
});
export type SubscribeBody = z.infer<typeof subscribeBodySchema>;

export const stockSubscriptionSchema = z.object({
  id: z.uuid(),
  productId: z.string(),
  warehouseId: z.string(),
  createdAt: z.string(),
});
export type StockSubscription = z.infer<typeof stockSubscriptionSchema>;
export const subscriptionsResponseSchema = z.object({ items: z.array(stockSubscriptionSchema) });
export type SubscriptionsResponse = z.infer<typeof subscriptionsResponseSchema>;

// --- Devices (stored for push later; nothing is sent yet) -----------------------------------

export const registerDeviceBodySchema = z.object({
  platform: z.enum(["ios", "android", "web"]),
  token: z.string().min(10).max(4096),
});

// --- Admin ----------------------------------------------------------------------------------

export const adminNotificationsQuerySchema = z.object({
  type: z.string().min(1).max(60).optional(),
  userId: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});
export const adminNotificationSchema = notificationSchema.extend({ userId: z.uuid() });
export type AdminNotification = z.infer<typeof adminNotificationSchema>;
export const adminNotificationsResponseSchema = z.object({
  items: z.array(adminNotificationSchema),
  counts: z.object({
    last24h: z.number().int(),
    unread: z.number().int(),
    openSubscriptions: z.number().int(),
  }),
});
export type AdminNotificationsResponse = z.infer<typeof adminNotificationsResponseSchema>;

// --- Internal -------------------------------------------------------------------------------

export const internalNotifyBodySchema = z.object({
  userId: z.uuid(),
  type: z.string().min(1).max(60),
  title: z.string().min(1).max(120),
  body: z.string().max(500).default(""),
  data: notificationDataSchema.default({}),
  /** The same key twice creates one notification, so a retried event is harmless */
  dedupeKey: z.string().min(1).max(200).optional(),
});
export type InternalNotifyBody = z.input<typeof internalNotifyBodySchema>;

export const stockRestockedBodySchema = z.object({
  warehouseId: z.string().min(1),
  productId: z.string().min(1),
  productName: z.string().max(120).optional(),
});
export type StockRestockedBody = z.input<typeof stockRestockedBodySchema>;
