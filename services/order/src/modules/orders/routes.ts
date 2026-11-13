import {
  adminCouponSchema,
  adminCouponsResponseSchema,
  couponOffersResponseSchema,
  couponParamsSchema,
  createCouponBodySchema,
  updateCouponBodySchema,
  validateCouponBodySchema,
  validateCouponResponseSchema,
  adminOrderDetailSchema,
  adminOrdersQuerySchema,
  adminOrdersResponseSchema,
  orderHistoryResponseSchema,
  cancelOrderBodySchema,
  listOrdersQuerySchema,
  orderSummaryQuerySchema,
  orderSummarySchema,
  listOrdersResponseSchema,
  invoiceLinkResponseSchema,
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
import { DEV_INTERNAL_KEY, requireIdentity, requireRole, type ServiceApp } from "@qc/service-kit";
import { env } from "../../config/env";
import { z } from "zod";
import { badRequest } from "./errors";
import { STAFF_ROLES, toOrder, type OrderService } from "./service";

export function registerOrderRoutes(app: ServiceApp, orders: OrderService): void {
  registerCouponRoutes(app, orders);

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

  // --- Invoices ------------------------------------------------------------------------------
  // Signs the short lived links. Production always has INTERNAL_API_KEY (internal calls refuse to
  // work without it), so the development fallback never signs a real invoice link.
  const linkSecret = env.INTERNAL_API_KEY ?? DEV_INTERNAL_KEY;
  const sendPdf = (
    reply: { header: (k: string, v: string) => unknown; send: (b: Buffer) => unknown },
    file: { pdf: Uint8Array; filename: string },
    disposition: "attachment" | "inline",
  ) => {
    reply.header("content-type", "application/pdf");
    reply.header("content-disposition", `${disposition}; filename="${file.filename}"`);
    reply.header("cache-control", "private, no-store");
    return reply.send(Buffer.from(file.pdf));
  };

  app.get(
    "/v1/orders/:id/invoice.pdf",
    {
      schema: {
        tags: ["orders"],
        summary: "Invoice PDF of a delivered order (its customer, admin, warehouse manager)",
        params: orderParamsSchema,
      },
    },
    async (request, reply) =>
      sendPdf(
        reply,
        await orders.invoiceFor(requireIdentity(request), request.params.id),
        "attachment",
      ),
  );

  app.post(
    "/v1/orders/:id/invoice-link",
    {
      schema: {
        tags: ["orders"],
        summary: "A 10 minute link that opens the invoice in a browser",
        params: orderParamsSchema,
        response: { 200: invoiceLinkResponseSchema },
      },
    },
    async (request) => orders.invoiceLink(requireIdentity(request), request.params.id, linkSecret),
  );

  app.get(
    "/v1/invoices/:token",
    {
      config: { rateLimit: { max: 60, timeWindow: "1 minute" } },
      schema: {
        tags: ["orders"],
        summary: "Open an invoice from a short lived link (no sign in)",
        params: z.object({ token: z.string().min(10).max(200) }),
      },
    },
    async (request, reply) =>
      sendPdf(reply, await orders.invoiceByToken(request.params.token, linkSecret), "inline"),
  );

  // Internal: the identity service clears a customer's details when they delete their account
  app.get(
    "/internal/customers/:userId/active-orders",
    {
      schema: {
        tags: ["internal"],
        summary: "A customer's orders that are still in progress",
        params: z.object({ userId: z.uuid() }),
        response: { 200: z.object({ count: z.number().int(), numbers: z.array(z.string()) }) },
      },
    },
    async (request) => orders.activeOrdersFor(request.params.userId),
  );

  app.post(
    "/internal/customers/:userId/scrub",
    {
      schema: {
        tags: ["internal"],
        summary: "Remove a deleted customer's name, phone and notes from their past orders",
        params: z.object({ userId: z.uuid() }),
        response: { 200: z.object({ orders: z.number().int() }) },
      },
    },
    async (request) => orders.scrubCustomer(request.params.userId),
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

function registerCouponRoutes(app: ServiceApp, orders: OrderService): void {
  app.post(
    "/v1/orders/coupons/validate",
    {
      schema: {
        tags: ["coupons"],
        summary: "Price a cart with a coupon code and say whether it applies",
        body: validateCouponBodySchema,
        response: { 200: validateCouponResponseSchema },
      },
    },
    async (request) => orders.validateCoupon(requireIdentity(request), request.body),
  );

  app.get(
    "/v1/orders/coupons/available",
    {
      schema: {
        tags: ["coupons"],
        summary: "Offers the customer can see now, with whether each one can be used",
        response: { 200: couponOffersResponseSchema },
      },
    },
    async (request) => ({ items: await orders.availableCoupons(requireIdentity(request)) }),
  );

  app.get(
    "/v1/orders/admin/coupons",
    {
      schema: {
        tags: ["admin"],
        summary: "Every coupon with its state, uses and discount given",
        response: { 200: adminCouponsResponseSchema },
      },
    },
    async (request) => {
      requireRole(request, "admin");
      return { items: await orders.adminListCoupons() };
    },
  );

  app.get(
    "/v1/orders/admin/coupons/:id",
    {
      schema: {
        tags: ["admin"],
        summary: "One coupon",
        params: couponParamsSchema,
        response: { 200: adminCouponSchema },
      },
    },
    async (request) => {
      requireRole(request, "admin");
      return orders.adminGetCoupon(request.params.id);
    },
  );

  app.post(
    "/v1/orders/admin/coupons",
    {
      schema: {
        tags: ["admin"],
        summary: "Create a coupon",
        body: createCouponBodySchema,
        response: { 201: adminCouponSchema },
      },
    },
    async (request, reply) => {
      requireRole(request, "admin");
      return reply.status(201).send(await orders.adminCreateCoupon(request.body));
    },
  );

  app.patch(
    "/v1/orders/admin/coupons/:id",
    {
      schema: {
        tags: ["admin"],
        summary: "Change a coupon (send active false to deactivate it)",
        params: couponParamsSchema,
        body: updateCouponBodySchema,
        response: { 200: adminCouponSchema },
      },
    },
    async (request) => {
      requireRole(request, "admin");
      return orders.adminUpdateCoupon(request.params.id, request.body);
    },
  );

  app.post(
    "/v1/orders/admin/coupons/:id/deactivate",
    {
      schema: {
        tags: ["admin"],
        summary: "Stop a coupon. Orders already placed with it keep their discount.",
        params: couponParamsSchema,
        response: { 200: adminCouponSchema },
      },
    },
    async (request) => {
      requireRole(request, "admin");
      return orders.adminUpdateCoupon(request.params.id, { active: false });
    },
  );
}
