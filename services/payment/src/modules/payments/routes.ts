import {
  adminPaymentDetailSchema,
  adminPaymentsQuerySchema,
  adminPaymentsResponseSchema,
  adminRefundBodySchema,
  checkoutResponseSchema,
  paymentBatchItemSchema,
  paymentOrderParamsSchema,
  paymentSchema,
  verifyPaymentBodySchema,
} from "@qc/contracts";
import { requireIdentity, requireRole, type ServiceApp } from "@qc/service-kit";
import { z } from "zod";
import type { PaymentService } from "./service";

export function registerPaymentRoutes(app: ServiceApp, payments: PaymentService): void {
  app.get(
    "/v1/payments/config",
    {
      schema: {
        tags: ["payments"],
        summary: "Whether online payment is offered at checkout",
        response: { 200: z.object({ onlineEnabled: z.boolean() }) },
      },
    },
    async (request) => {
      requireIdentity(request);
      return payments.config();
    },
  );

  app.post(
    "/v1/payments/orders/:orderId/checkout",
    {
      schema: {
        tags: ["payments"],
        summary: "Start or resume paying for an online order",
        params: paymentOrderParamsSchema,
        response: { 200: checkoutResponseSchema },
      },
    },
    async (request) => payments.checkout(requireRole(request, "customer"), request.params.orderId),
  );

  app.post(
    "/v1/payments/verify",
    {
      schema: {
        tags: ["payments"],
        summary: "Confirm a payment with the signature Razorpay Checkout returned",
        body: verifyPaymentBodySchema,
        response: { 200: paymentSchema },
      },
    },
    async (request) => payments.verify(requireRole(request, "customer"), request.body),
  );

  app.get(
    "/v1/payments/orders/:orderId",
    {
      schema: {
        tags: ["payments"],
        summary: "Where the payment for an order stands",
        params: paymentOrderParamsSchema,
        response: { 200: paymentSchema },
      },
    },
    async (request) => payments.status(requireIdentity(request), request.params.orderId),
  );

  // --- Admin ---------------------------------------------------------------------------------
  app.get(
    "/v1/payments/admin",
    {
      schema: {
        tags: ["admin"],
        summary: "Payments, newest first, with totals for the filtered range",
        querystring: adminPaymentsQuerySchema,
        response: { 200: adminPaymentsResponseSchema },
      },
    },
    async (request) => {
      requireRole(request, "admin");
      return payments.adminList(request.query);
    },
  );

  app.get(
    "/v1/payments/admin/:orderId",
    {
      schema: {
        tags: ["admin"],
        summary: "One order's payment with its refunds",
        params: paymentOrderParamsSchema,
        response: { 200: adminPaymentDetailSchema },
      },
    },
    async (request) => {
      requireRole(request, "admin");
      return payments.adminDetail(request.params.orderId);
    },
  );

  app.post(
    "/v1/payments/admin/orders/:orderId/refund",
    {
      // The role is checked before the body, so a stranger never learns what a valid body is
      preValidation: async (request) => {
        requireRole(request, "admin");
      },
      schema: {
        tags: ["admin"],
        summary: "Refund all or part of a payment (needs an Idempotency-Key header)",
        params: paymentOrderParamsSchema,
        body: adminRefundBodySchema,
        response: { 200: adminPaymentDetailSchema },
      },
    },
    async (request) => {
      const key = request.headers["idempotency-key"];
      return payments.adminRefund(
        requireRole(request, "admin"),
        request.params.orderId,
        request.body,
        typeof key === "string" ? key : undefined,
      );
    },
  );

  app.get(
    "/internal/payments/batch",
    {
      schema: {
        tags: ["internal"],
        summary: "Payment status of several orders",
        querystring: z.object({
          orderIds: z
            .string()
            .min(1)
            .transform((value) => [
              ...new Set(
                value
                  .split(",")
                  .map((id) => id.trim())
                  .filter(Boolean),
              ),
            ])
            .pipe(z.array(z.uuid()).max(200)),
        }),
        response: { 200: z.object({ items: z.array(paymentBatchItemSchema) }) },
      },
    },
    async (request) => ({ items: await payments.batch(request.query.orderIds) }),
  );

  app.get(
    "/internal/payments/orders/:orderId",
    {
      schema: {
        tags: ["internal"],
        summary: "Status and Razorpay payment id of one order (for its invoice)",
        params: paymentOrderParamsSchema,
        response: {
          200: z.object({
            status: z.string(),
            method: z.string().nullable(),
            razorpayPaymentId: z.string().nullable(),
          }),
        },
      },
    },
    async (request) => payments.forOrder(request.params.orderId),
  );

  app.post(
    "/internal/payments/customers/:userId/scrub",
    {
      schema: {
        tags: ["internal"],
        summary: "Drop a deleted customer's name and phone from their payments",
        params: z.object({ userId: z.uuid() }),
        response: { 200: z.object({ payments: z.number().int() }) },
      },
    },
    async (request) => payments.scrubCustomer(request.params.userId),
  );

  app.post(
    "/internal/payments/orders/:orderId/refund",
    {
      schema: {
        tags: ["internal"],
        summary: "Refund an order's payment in full (idempotent)",
        params: paymentOrderParamsSchema,
        response: { 200: z.object({ refunded: z.boolean() }) },
      },
    },
    async (request) => payments.refund(request.params.orderId),
  );

  // Webhooks are verified over the raw bytes, so this route keeps the body as a Buffer
  void app.register(async (scope) => {
    scope.removeAllContentTypeParsers();
    scope.addContentTypeParser("*", { parseAs: "buffer" }, (_request, body, done) =>
      done(null, body),
    );
    scope.post("/webhooks/razorpay", async (request) => {
      const header = (name: string) => {
        const value = request.headers[name];
        return typeof value === "string" ? value : undefined;
      };
      const raw = Buffer.isBuffer(request.body) ? request.body : Buffer.alloc(0);
      return payments.webhook(raw, header("x-razorpay-signature"), header("x-razorpay-event-id"));
    });
  });
}
