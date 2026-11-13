import { z } from "zod";

/** What the app needs to open Razorpay Checkout for one order. Money is integer paise. */
export const checkoutResponseSchema = z.object({
  orderId: z.uuid(),
  razorpayOrderId: z.string(),
  /** Public key id (rzp_test_... or rzp_live_...). The secret never leaves the server. */
  keyId: z.string(),
  amountPaise: z.number().int().positive(),
  currency: z.literal("INR"),
  /** Shown at the top of the Razorpay sheet */
  name: z.string(),
  description: z.string(),
  prefill: z.object({ contact: z.string(), name: z.string() }),
});
export type CheckoutResponse = z.infer<typeof checkoutResponseSchema>;

/** Sent by the app after Razorpay's success handler. The server checks the signature. */
export const verifyPaymentBodySchema = z.object({
  razorpayOrderId: z.string().min(1).max(100),
  razorpayPaymentId: z.string().min(1).max(100),
  razorpaySignature: z.string().regex(/^[0-9a-f]{64}$/),
});
export type VerifyPaymentBody = z.infer<typeof verifyPaymentBodySchema>;

export const paymentStatusSchema = z.enum([
  "created",
  "captured",
  "failed",
  "refunded",
  "partially_refunded",
]);
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;

export const paymentSchema = z.object({
  orderId: z.uuid(),
  status: paymentStatusSchema,
  amountPaise: z.number().int(),
  refundedPaise: z.number().int(),
  method: z.string().nullable(),
  /** Razorpay's reason for the last failed attempt, safe to show the customer */
  errorDescription: z.string().nullable(),
});
export type Payment = z.infer<typeof paymentSchema>;

export const paymentOrderParamsSchema = z.object({ orderId: z.uuid() });
