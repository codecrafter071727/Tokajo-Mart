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

// --- Admin ------------------------------------------------------------------------------------

const adminDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-11-13");

export const adminPaymentsQuerySchema = z.object({
  status: paymentStatusSchema.optional(),
  /** India local days, both ends included */
  from: adminDay.optional(),
  to: adminDay.optional(),
  /** Order number, Razorpay order or payment id, or customer name or phone */
  q: z.string().trim().min(1).max(60).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().min(1).max(200).optional(),
});
export type AdminPaymentsQuery = z.input<typeof adminPaymentsQuerySchema>;

export const refundSchema = z.object({
  id: z.uuid(),
  razorpayRefundId: z.string().nullable(),
  amountPaise: z.number().int(),
  status: z.enum(["pending", "processed", "failed"]),
  reason: z.string().nullable(),
  /** Null for refunds started by a cancellation */
  actorId: z.uuid().nullable(),
  createdAt: z.string(),
});
export type Refund = z.infer<typeof refundSchema>;

export const adminPaymentSchema = z.object({
  orderId: z.uuid(),
  orderNumber: z.string().nullable(),
  userId: z.uuid(),
  customerName: z.string().nullable(),
  customerPhone: z.string().nullable(),
  status: paymentStatusSchema,
  amountPaise: z.number().int(),
  refundedPaise: z.number().int(),
  method: z.string().nullable(),
  razorpayOrderId: z.string(),
  razorpayPaymentId: z.string().nullable(),
  errorCode: z.string().nullable(),
  errorDescription: z.string().nullable(),
  createdAt: z.string(),
  capturedAt: z.string().nullable(),
});
export type AdminPayment = z.infer<typeof adminPaymentSchema>;

export const adminPaymentsResponseSchema = z.object({
  items: z.array(adminPaymentSchema),
  nextCursor: z.string().nullable(),
  /** Totals over the whole filtered range, not just this page */
  stats: z.object({
    capturedPaise: z.number().int(),
    capturedCount: z.number().int(),
    refundedPaise: z.number().int(),
    failedCount: z.number().int(),
    pendingCount: z.number().int(),
  }),
});
export type AdminPaymentsResponse = z.infer<typeof adminPaymentsResponseSchema>;

export const adminPaymentDetailSchema = adminPaymentSchema.extend({
  refunds: z.array(refundSchema),
  /** What can still be refunded */
  refundablePaise: z.number().int(),
});
export type AdminPaymentDetail = z.infer<typeof adminPaymentDetailSchema>;

export const adminRefundBodySchema = z.object({
  /** Leave out for a full refund of what is left */
  amountPaise: z.number().int().positive().optional(),
  reason: z.string().trim().min(3, "Say why, in a few words.").max(200),
});
export type AdminRefundBody = z.input<typeof adminRefundBodySchema>;

/** For the order service: payment status of several orders at once */
export const paymentBatchItemSchema = z.object({
  orderId: z.uuid(),
  status: paymentStatusSchema,
  refundedPaise: z.number().int(),
});
export type PaymentBatchItem = z.infer<typeof paymentBatchItemSchema>;
