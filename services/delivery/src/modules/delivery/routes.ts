import {
  adminDeliveriesResponseSchema,
  adminLiveQuerySchema,
  adminLiveResponseSchema,
  adminRiderDeliveriesQuerySchema,
  adminRiderDetailSchema,
  adminRiderParamsSchema,
  adminRidersResponseSchema,
  createDeliveryBodySchema,
  deliveryParamsSchema,
  handoverListResponseSchema,
  riderActionBodySchema,
  riderStateSchema,
  setOnlineBodySchema,
} from "@qc/contracts";
import { requireRole, type ServiceApp } from "@qc/service-kit";
import { z } from "zod";
import { HttpError } from "./errors";
import { toRiderDelivery, type DeliveryService } from "./service";

const STAFF = ["warehouse_staff", "warehouse_manager", "admin"] as const;

export function registerDeliveryRoutes(app: ServiceApp, delivery: DeliveryService): void {
  // --- Rider ---------------------------------------------------------------------------------
  app.get(
    "/v1/delivery/me",
    {
      schema: {
        tags: ["delivery"],
        summary: "My state: online or not, the offer or active delivery, and today's history",
        response: { 200: riderStateSchema },
      },
    },
    async (request) => {
      const rider = requireRole(request, "rider");
      return delivery.state(rider.userId, rider.warehouseId);
    },
  );

  app.post(
    "/v1/delivery/me/online",
    {
      schema: {
        tags: ["delivery"],
        summary: "Go online or offline",
        body: setOnlineBodySchema,
        response: { 200: riderStateSchema },
      },
    },
    async (request) => {
      const rider = requireRole(request, "rider");
      return delivery.setOnline(rider.userId, rider.warehouseId, request.body.online);
    },
  );

  app.post(
    "/v1/delivery/:id/actions",
    {
      schema: {
        tags: ["delivery"],
        summary: "Accept, decline or move a delivery to its next step",
        params: deliveryParamsSchema,
        body: riderActionBodySchema,
        response: { 200: riderStateSchema },
      },
    },
    async (request) => {
      const rider = requireRole(request, "rider");
      return delivery.act(rider.userId, rider.warehouseId, request.params.id, request.body);
    },
  );

  // --- Warehouse and admin -------------------------------------------------------------------
  app.get(
    "/v1/delivery/handovers",
    {
      schema: {
        tags: ["warehouse"],
        summary: "Orders waiting for a rider, with the handover code to show them",
        querystring: z.object({ warehouseId: z.string().min(1).optional() }),
        response: { 200: handoverListResponseSchema },
      },
    },
    async (request) => {
      const staff = requireRole(request, ...STAFF);
      const warehouseId =
        staff.role === "admin" ? request.query.warehouseId : (staff.warehouseId ?? undefined);
      if (!warehouseId) throw new HttpError(400, "Say which warehouse to show.");
      return { items: await delivery.handovers(warehouseId) };
    },
  );

  app.get(
    "/v1/delivery/admin/riders",
    {
      schema: {
        tags: ["admin"],
        summary: "Riders with their live status",
        querystring: z.object({ warehouseId: z.string().min(1).optional() }),
        response: { 200: adminRidersResponseSchema },
      },
    },
    async (request) => {
      const staff = requireRole(request, "admin", "warehouse_manager");
      const warehouseId =
        staff.role === "admin" ? request.query.warehouseId : (staff.warehouseId ?? undefined);
      return { items: await delivery.adminRiders(warehouseId) };
    },
  );

  app.get(
    "/v1/delivery/admin/riders/:id",
    {
      schema: {
        tags: ["admin"],
        summary: "One rider with today's and 30 day stats and the current delivery",
        params: adminRiderParamsSchema,
        response: { 200: adminRiderDetailSchema },
      },
    },
    async (request) =>
      delivery.adminRiderDetail(
        requireRole(request, "admin", "warehouse_manager"),
        request.params.id,
      ),
  );

  app.get(
    "/v1/delivery/admin/riders/:id/deliveries",
    {
      schema: {
        tags: ["admin"],
        summary: "A rider's deliveries, newest first",
        params: adminRiderParamsSchema,
        querystring: adminRiderDeliveriesQuerySchema,
        response: { 200: adminDeliveriesResponseSchema },
      },
    },
    async (request) =>
      delivery.adminRiderDeliveries(
        requireRole(request, "admin", "warehouse_manager"),
        request.params.id,
        request.query.limit,
        request.query.cursor,
      ),
  );

  app.get(
    "/v1/delivery/admin/live",
    {
      schema: {
        tags: ["admin"],
        summary: "Deliveries on the way right now, oldest first",
        querystring: adminLiveQuerySchema,
        response: { 200: adminLiveResponseSchema },
      },
    },
    async (request) => ({
      items: await delivery.live(
        requireRole(request, "admin", "warehouse_manager"),
        request.query.warehouseId,
      ),
    }),
  );

  // --- Internal ------------------------------------------------------------------------------
  app.post(
    "/internal/deliveries",
    {
      schema: {
        tags: ["internal"],
        summary: "Create the delivery for a packed order (idempotent on the order id)",
        body: createDeliveryBodySchema,
        response: { 200: z.object({ id: z.uuid(), status: z.string() }) },
      },
    },
    async (request) => {
      const row = await delivery.create(request.body);
      return { id: row.id, status: row.status };
    },
  );

  app.post(
    "/internal/deliveries/by-order/:orderId/cancel",
    {
      schema: {
        tags: ["internal"],
        summary: "Stop a delivery because its order was cancelled",
        params: z.object({ orderId: z.uuid() }),
        response: { 200: z.object({ ok: z.literal(true) }) },
      },
    },
    async (request) => {
      await delivery.cancelForOrder(request.params.orderId);
      return { ok: true as const };
    },
  );
}

export { toRiderDelivery };
