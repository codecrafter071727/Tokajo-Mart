import {
  adminOrderDeliverySchema,
  deliveryParamsSchema,
  podUploadBodySchema,
  podUploadResponseSchema,
  riderLocationAckSchema,
  riderLocationBodySchema,
  trackingParamsSchema,
  trackingSchema,
} from "@qc/contracts";
import { requireIdentity, requireRole, type ServiceApp } from "@qc/service-kit";
import type { TrackingService } from "./tracking";

/** Base64 of the largest photo plus the JSON around it */
const POD_BODY_LIMIT = 2_300_000;

export function registerTrackingRoutes(app: ServiceApp, tracking: TrackingService): void {
  app.post(
    "/v1/delivery/me/location",
    {
      schema: {
        tags: ["delivery"],
        summary: "Report where the rider is (latest only, at most every few seconds)",
        body: riderLocationBodySchema,
        response: { 200: riderLocationAckSchema },
      },
    },
    async (request) => tracking.publishLocation(requireRole(request, "rider").userId, request.body),
  );

  app.get(
    "/v1/delivery/orders/:orderId/tracking",
    {
      schema: {
        tags: ["delivery"],
        summary: "Where my order is while it is on the way (the customer who placed it only)",
        params: trackingParamsSchema,
        response: { 200: trackingSchema },
      },
    },
    async (request, reply) => {
      reply.header("cache-control", "no-store");
      return tracking.tracking(requireIdentity(request), request.params.orderId);
    },
  );

  app.post(
    "/v1/delivery/:id/pod",
    {
      bodyLimit: POD_BODY_LIMIT,
      schema: {
        tags: ["delivery"],
        summary: "Upload the photo taken at the door",
        params: deliveryParamsSchema,
        body: podUploadBodySchema,
        response: { 200: podUploadResponseSchema },
      },
    },
    async (request) =>
      tracking.uploadPod(requireRole(request, "rider").userId, request.params.id, request.body),
  );

  const sendPhoto = (bytes: Buffer, reply: { header: (k: string, v: string) => unknown }) => {
    reply.header("content-type", "image/jpeg");
    reply.header("cache-control", "private, max-age=300");
    reply.header("x-content-type-options", "nosniff");
    return bytes;
  };

  app.get(
    "/v1/delivery/:id/pod",
    { schema: { tags: ["delivery"], summary: "The door photo", params: deliveryParamsSchema } },
    async (request, reply) =>
      sendPhoto(
        await tracking.readPod(requireIdentity(request), { deliveryId: request.params.id }),
        reply,
      ),
  );

  app.get(
    "/v1/delivery/orders/:orderId/pod",
    {
      schema: {
        tags: ["delivery"],
        summary: "The door photo for an order",
        params: trackingParamsSchema,
      },
    },
    async (request, reply) =>
      sendPhoto(
        await tracking.readPod(requireIdentity(request), { orderId: request.params.orderId }),
        reply,
      ),
  );

  app.get(
    "/v1/delivery/admin/orders/:orderId",
    {
      schema: {
        tags: ["admin"],
        summary: "The delivery side of an order: rider position and the door photo",
        params: trackingParamsSchema,
        response: { 200: adminOrderDeliverySchema },
      },
    },
    async (request) =>
      tracking.adminOrderDelivery(
        requireRole(request, "admin", "warehouse_manager"),
        request.params.orderId,
      ),
  );
}
