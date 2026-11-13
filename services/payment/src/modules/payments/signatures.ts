import { createHmac, timingSafeEqual } from "node:crypto";

const hmac = (secret: string, data: string | Buffer) =>
  createHmac("sha256", secret).update(data).digest("hex");

function same(expected: string, given: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** The signature Razorpay Checkout hands the app after a successful payment. */
export const checkoutSignature = (keySecret: string, razorpayOrderId: string, paymentId: string) =>
  hmac(keySecret, `${razorpayOrderId}|${paymentId}`);

export const isValidCheckoutSignature = (
  keySecret: string,
  razorpayOrderId: string,
  paymentId: string,
  signature: string,
) => same(checkoutSignature(keySecret, razorpayOrderId, paymentId), signature);

/** Webhooks are signed over the raw request body, byte for byte, with the webhook secret. */
export const webhookSignature = (webhookSecret: string, rawBody: Buffer | string) =>
  hmac(webhookSecret, rawBody);

export const isValidWebhookSignature = (
  webhookSecret: string,
  rawBody: Buffer,
  signature: string,
) => same(webhookSignature(webhookSecret, rawBody), signature);
