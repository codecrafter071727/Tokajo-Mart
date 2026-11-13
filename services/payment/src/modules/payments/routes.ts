import {
  checkoutResponseSchema,
  paymentOrderParamsSchema,
  paymentSchema,
  verifyPaymentBodySchema,
} from "@qc/contracts";
import { requireIdentity, requireRole, type ServiceApp } from "@qc/service-kit";
import { z } from "zod";
import type { PaymentService } from "./service";

export function registerPaymentRoutes(app: ServiceApp, payments: PaymentService): void {
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
