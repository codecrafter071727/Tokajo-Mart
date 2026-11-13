import {
  adminOrderDetailSchema,
  adminOrdersQuerySchema,
  adminOrdersResponseSchema,
  orderHistoryResponseSchema,
  cancelOrderBodySchema,
  listOrdersQuerySchema,
  orderSummaryQuerySchema,
  orderSummarySchema,
  listOrdersResponseSchema,
  orderParamsSchema,
  orderSchema,
  orderStatusSchema,
  paymentMethodSchema,
  pickItemBodySchema,
  pickItemParamsSchema,
  placeOrderBodySchema,
  queueOrderSchema,
  queueResponseSchema,
  transitionBodySchema,
} from "@qc/contracts";
import { requireIdentity, requireRole, type ServiceApp } from "@qc/service-kit";
import { z } from "zod";
import { badRequest } from "./errors";
import { STAFF_ROLES, toOrder, type OrderService } from "./service";

export function registerOrderRoutes(app: ServiceApp, orders: OrderService): void {
  app.post(
    "/v1/orders",
    {
      schema: {
        tags: ["orders"],
        summary: "Place an order (customer). Needs an Idempotency-Key header.",
        body: placeOrderBodySchema,
        response: { 200: orderSchema, 201: orderSchema },
      },
    },
    async (request, reply) => {
      const identity = requireIdentity(request);
      const key = request.headers["idempotency-key"];
      if (typeof key !== "string" || key.length < 8 || key.length > 100) {
        throw badRequest("Send an Idempotency-Key header of 8 to 100 characters.");
      }
      const { order, created } = await orders.place(identity, key, request.body);
      return reply.status(created ? 201 : 200).send(order);
    },
  );

  app.get(
    "/v1/orders",
    {
      schema: {
        tags: ["orders"],
        summary: "My orders, newest first (admins can pass userId)",
        querystring: listOrdersQuerySchema,
        response: { 200: listOrdersResponseSchema },
      },
    },
    async (request) => ({
      items: await orders.listFor(
        requireIdentity(request),
        request.query.limit,
        request.query.userId,
      ),
    }),
  );

  // Warehouse screens. These sit before /:id so "queue" is not read as an order id.
  app.get(
    "/v1/orders/queue",
    {
      schema: {
        tags: ["warehouse"],
        summary: "Orders waiting to be packed at my warehouse",
        querystring: z.object({ warehouseId: z.string().min(1).optional() }),
        response: { 200: queueResponseSchema },
      },
    },
    async (request) => ({
      items: await orders.queue(requireRole(request, ...STAFF_ROLES), request.query.warehouseId),
    }),
  );

  app.get(
    "/v1/orders/admin",
    {
      schema: {
        tags: ["admin"],
        summary: "All orders, newest first (admin, or a manager for their warehouse)",
        querystring: adminOrdersQuerySchema,
        response: { 200: adminOrdersResponseSchema },
      },
    },
    async (request) => ({
      items: await orders.listAll(
        requireRole(request, "admin", "warehouse_manager"),
        request.query,
      ),
    }),
  );

  app.get(
    "/v1/orders/admin/summary",
    {
      schema: {
        tags: ["admin"],
        summary:
          "Sales and delivery numbers for a date range (admin, or a manager for their warehouse)",
        querystring: orderSummaryQuerySchema,
        response: { 200: orderSummarySchema },
      },
    },
    async (request) =>
      orders.summary(requireRole(request, "admin", "warehouse_manager"), request.query),
  );

  app.get(
    "/v1/orders/admin/:id",
    {
      schema: {
        tags: ["admin"],
        summary: "One order for the admin detail page",
        params: orderParamsSchema,
        response: { 200: adminOrderDetailSchema },
      },
    },
    async (request) =>
      orders.adminGet(requireRole(request, "admin", "warehouse_manager"), request.params.id),
  );

  app.get(
    "/v1/orders/:id/history",
    {
      schema: {
        tags: ["admin"],
        summary: "Every status change of an order, with who made it",
        params: orderParamsSchema,
        response: { 200: orderHistoryResponseSchema },
      },
    },
    async (request) => ({
      items: await orders.historyFor(
        requireRole(request, "admin", "warehouse_manager"),
        request.params.id,
      ),
    }),
  );

  app.get(
    "/v1/orders/:id",
    {
      schema: {
        tags: ["orders"],
        summary: "One order",
        params: orderParamsSchema,
        response: { 200: orderSchema },
      },
    },
    async (request) => orders.get(requireIdentity(request), request.params.id),
  );

  app.post(
    "/v1/orders/:id/cancel",
    {
      schema: {
        tags: ["orders"],
        summary: "Cancel an order (customer until packing starts, admin any time)",
        params: orderParamsSchema,
        body: cancelOrderBodySchema,
        response: { 200: orderSchema },
      },
    },
    async (request) =>
      orders.cancel(requireIdentity(request), request.params.id, request.body.reason),
  );

  app.post(
    "/v1/orders/:id/start-packing",
    {
      schema: {
        tags: ["warehouse"],
        summary: "Start packing an order",
        params: orderParamsSchema,
        response: { 200: queueOrderSchema },
      },
    },
    async (request) => orders.startPacking(requireRole(request, ...STAFF_ROLES), request.params.id),
  );

  app.post(
    "/v1/orders/:id/items/:productId/picked",
    {
      schema: {
        tags: ["warehouse"],
        summary: "Tick or untick an item while packing",
        params: pickItemParamsSchema,
        body: pickItemBodySchema,
        response: { 200: queueOrderSchema },
      },
    },
    async (request) =>
      orders.setPicked(
        requireRole(request, ...STAFF_ROLES),
        request.params.id,
        request.params.productId,
        request.body.picked,
      ),
  );

  app.post(
    "/v1/orders/:id/packed",
    {
      schema: {
        tags: ["warehouse"],
        summary: "Mark packed once every item is ticked, and request a rider",
        params: orderParamsSchema,
        response: { 200: queueOrderSchema },
      },
    },
    async (request) => orders.markPacked(requireRole(request, ...STAFF_ROLES), request.params.id),
  );

  // Internal: called by the delivery service as the rider moves the order along
  app.post(
    "/internal/orders/:id/transition",
    {
      schema: {
        tags: ["internal"],
        summary: "Move an order to its next status",
        params: orderParamsSchema,
        body: transitionBodySchema,
        response: { 200: orderSchema },
      },
    },
    async (request) => {
      await orders.transition(request.params.id, request.body);
      return orders.internalGet(request.params.id);
    },
  );

  app.get(
    "/internal/orders/:id",
    {
      schema: {
        tags: ["internal"],
        summary: "One order including its delivery code",
        params: orderParamsSchema,
        response: { 200: orderSchema },
      },
    },
    async (request) => orders.internalGet(request.params.id),
  );

  // Internal: the payment service reads what it needs and reports a captured payment
  app.get(
    "/internal/orders/:id/payment-info",
    {
      schema: {
        tags: ["internal"],
        summary: "Who owns an order, what it costs and whether it is waiting for payment",
        params: orderParamsSchema,
        response: {
          200: z.object({
            id: z.uuid(),
            number: z.string(),
            userId: z.uuid(),
            status: orderStatusSchema,
            paymentMethod: paymentMethodSchema,
            totalPaise: z.number().int(),
            customerName: z.string(),
            customerPhone: z.string(),
          }),
        },
      },
    },
    async (request) => orders.paymentInfo(request.params.id),
  );

  app.post(
    "/internal/orders/:id/payment-captured",
    {
      schema: {
        tags: ["internal"],
        summary: "The payment for an online order was captured (idempotent)",
        params: orderParamsSchema,
        response: { 200: orderSchema },
      },
    },
    async (request) => {
      await orders.paymentCaptured(request.params.id);
      return orders.internalGet(request.params.id);
    },
  );
}

export { toOrder };
