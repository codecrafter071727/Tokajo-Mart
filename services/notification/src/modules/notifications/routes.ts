import {
  adminNotificationsQuerySchema,
  adminNotificationsResponseSchema,
  internalNotifyBodySchema,
  listNotificationsQuerySchema,
  listNotificationsResponseSchema,
  notificationParamsSchema,
  notificationSchema,
  registerDeviceBodySchema,
  stockRestockedBodySchema,
  stockSubscriptionSchema,
  subscribeBodySchema,
  subscriptionsResponseSchema,
  unreadCountResponseSchema,
} from "@qc/contracts";
import { requireIdentity, requireRole, type ServiceApp } from "@qc/service-kit";
import { z } from "zod";
import type { NotificationService } from "./service";

const ok = z.object({ ok: z.literal(true) });

export function registerNotificationRoutes(app: ServiceApp, notifications: NotificationService) {
  // --- The signed in person's inbox ------------------------------------------------------
  app.get(
    "/v1/notifications/me",
    {
      schema: {
        tags: ["notifications"],
        summary: "My notifications, newest first",
        querystring: listNotificationsQuerySchema,
        response: { 200: listNotificationsResponseSchema },
      },
    },
    async (request) =>
      notifications.list(
        requireIdentity(request).userId,
        request.query.limit,
        request.query.cursor,
      ),
  );

  app.get(
    "/v1/notifications/me/unread-count",
    {
      schema: {
        tags: ["notifications"],
        summary: "How many are unread",
        response: { 200: unreadCountResponseSchema },
      },
    },
    async (request) => ({
      unread: await notifications.unreadCount(requireIdentity(request).userId),
    }),
  );

  app.post(
    "/v1/notifications/me/read-all",
    {
      schema: {
        tags: ["notifications"],
        summary: "Mark everything read",
        response: { 200: z.object({ updated: z.number().int() }) },
      },
    },
    async (request) => ({
      updated: await notifications.markAllRead(requireIdentity(request).userId),
    }),
  );

  app.post(
    "/v1/notifications/me/:id/read",
    {
      schema: {
        tags: ["notifications"],
        summary: "Mark one read",
        params: notificationParamsSchema,
        response: { 200: notificationSchema },
      },
    },
    async (request) => notifications.markRead(requireIdentity(request).userId, request.params.id),
  );

  // --- Notify me (customers) ---------------------------------------------------------------
  app.get(
    "/v1/notifications/me/subscriptions",
    {
      schema: {
        tags: ["notifications"],
        summary: "Items I asked to be told about",
        response: { 200: subscriptionsResponseSchema },
      },
    },
    async (request) => ({
      items: await notifications.subscriptions(requireRole(request, "customer").userId),
    }),
  );

  app.post(
    "/v1/notifications/me/subscriptions",
    {
      schema: {
        tags: ["notifications"],
        summary: "Tell me when this item is back",
        body: subscribeBodySchema,
        response: { 200: stockSubscriptionSchema },
      },
    },
    async (request) =>
      notifications.subscribe(
        requireRole(request, "customer").userId,
        request.body.productId,
        request.body.warehouseId,
      ),
  );

  app.delete(
    "/v1/notifications/me/subscriptions",
    {
      schema: {
        tags: ["notifications"],
        summary: "Stop waiting for this item",
        body: subscribeBodySchema,
        response: { 200: ok },
      },
    },
    async (request) => {
      await notifications.unsubscribe(
        requireRole(request, "customer").userId,
        request.body.productId,
        request.body.warehouseId,
      );
      return { ok: true as const };
    },
  );

  app.post(
    "/v1/notifications/me/devices",
    {
      schema: {
        tags: ["notifications"],
        summary: "Remember this device for push (nothing is sent yet)",
        body: registerDeviceBodySchema,
        response: { 200: ok },
      },
    },
    async (request) => {
      await notifications.registerDevice(
        requireIdentity(request).userId,
        request.body.platform,
        request.body.token,
      );
      return { ok: true as const };
    },
  );

  // --- Admin -----------------------------------------------------------------------------
  app.get(
    "/v1/notifications/admin",
    {
      schema: {
        tags: ["admin"],
        summary: "Recently sent notifications",
        querystring: adminNotificationsQuerySchema,
        response: { 200: adminNotificationsResponseSchema },
      },
    },
    async (request) => notifications.adminList(requireIdentity(request), request.query),
  );

  // --- Internal (other services) -----------------------------------------------------------
  app.post(
    "/internal/notify",
    {
      schema: {
        tags: ["internal"],
        summary: "Send one notification (idempotent with a dedupe key)",
        body: internalNotifyBodySchema,
        response: { 200: z.object({ id: z.uuid(), created: z.boolean() }) },
      },
    },
    async (request) => {
      const { notification, created } = await notifications.notify(request.body);
      return { id: notification.id, created };
    },
  );

  app.post(
    "/internal/stock-restocked",
    {
      schema: {
        tags: ["internal"],
        summary: "A product is back at a warehouse: tell whoever was waiting",
        body: stockRestockedBodySchema,
        response: { 200: z.object({ notified: z.number().int() }) },
      },
    },
    async (request) => notifications.stockRestocked(request.body),
  );
}
