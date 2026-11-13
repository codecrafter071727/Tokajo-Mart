import type { CheckoutResponse, Payment } from "@qc/contracts";
import { HttpError } from "./httpError";

/**
 * Online payment logic, kept free of React so it is easy to test. The server owns the truth: the
 * order is pending_payment until the payment service confirms it, and expires after the window.
 */

/** How long an online order waits for its payment before the server expires it (15 minutes). */
export const PAYMENT_WINDOW_MS = 15 * 60 * 1000;

/** The brand green for the Razorpay sheet, so it feels like part of the app. */
export const RAZORPAY_THEME_COLOR = "#42C86E";

export const RAZORPAY_SCRIPT_URL = "https://checkout.razorpay.com/v1/checkout.js";

/** What came back from the Razorpay sheet. */
export type CheckoutResult =
  | {
      kind: "success";
      razorpayOrderId: string;
      razorpayPaymentId: string;
      razorpaySignature: string;
    }
  | { kind: "dismissed" }
  | { kind: "failed"; description: string };

/** Seconds left to pay, counted from when the order was placed. Never below 0. */
export function paymentSecondsLeft(placedAt: string, now: Date): number {
  const deadline = Date.parse(placedAt) + PAYMENT_WINDOW_MS;
  return Math.max(0, Math.floor((deadline - now.getTime()) / 1000));
}

/** 754 becomes "12:34". */
export function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Where an order's payment stands, for the screens. */
export type PaymentPhase =
  | "cash" // cash on delivery, nothing to pay now
  | "awaiting" // online, not paid yet, still inside the window
  | "failed" // the last attempt failed, still inside the window
  | "expired" // the window ran out without a payment
  | "not_charged" // cancelled before it was paid
  | "paid"
  | "refund_started" // a paid order was cancelled and the refund is on its way
  | "refunded";

export function paymentPhase(
  order: { payment: "cod" | "online"; placedAt: string; serverStatus?: string },
  payment: Pick<Payment, "status" | "refundedPaise" | "errorDescription"> | null | undefined,
  now: Date,
): PaymentPhase {
  if (order.payment === "cod") return "cash";
  const serverStatus = order.serverStatus;
  if (payment?.status === "refunded") return "refunded";
  if (payment?.status === "partially_refunded") return "refund_started";
  if (payment?.status === "captured") {
    return serverStatus === "cancelled" ? "refund_started" : "paid";
  }
  if (serverStatus && serverStatus !== "pending_payment") {
    // The server moved on: confirmed means it was paid (the payment row may lag), the rest ended it
    if (serverStatus === "expired") return "expired";
    if (serverStatus === "cancelled") return "not_charged";
    if (serverStatus === "payment_failed") return "expired";
    return "paid";
  }
  if (paymentSecondsLeft(order.placedAt, now) === 0) return "expired";
  return payment?.status === "failed" ? "failed" : "awaiting";
}

/** True while the customer can still open the payment sheet for this order. */
export const canPay = (phase: PaymentPhase) => phase === "awaiting" || phase === "failed";

/** The options checkout.js takes. Only the public key id is ever sent to the app. */
export function checkoutOptions(checkout: CheckoutResponse) {
  return {
    key: checkout.keyId,
    amount: checkout.amountPaise,
    currency: checkout.currency,
    name: checkout.name,
    description: checkout.description,
    order_id: checkout.razorpayOrderId,
    prefill: { contact: checkout.prefill.contact, name: checkout.prefill.name },
    theme: { color: RAZORPAY_THEME_COLOR },
    // The customer can try another method inside the sheet without closing it
    retry: { enabled: true, max_count: 3 },
  };
}

/** Razorpay's success handler gives snake_case fields; anything missing is treated as a failure. */
export function fromRazorpaySuccess(response: unknown): CheckoutResult {
  const r = (response ?? {}) as Record<string, unknown>;
  const orderId = r.razorpay_order_id;
  const paymentId = r.razorpay_payment_id;
  const signature = r.razorpay_signature;
  if (typeof orderId !== "string" || typeof paymentId !== "string" || typeof signature !== "string")
    return { kind: "failed", description: "The payment response was incomplete. Try again." };
  return {
    kind: "success",
    razorpayOrderId: orderId,
    razorpayPaymentId: paymentId,
    razorpaySignature: signature,
  };
}

/** Razorpay's payment.failed event carries `error.description`; fall back to a plain line. */
export function fromRazorpayFailure(response: unknown): CheckoutResult {
  const description = (response as { error?: { description?: unknown } } | undefined)?.error
    ?.description;
  return {
    kind: "failed",
    description:
      typeof description === "string" && description.trim()
        ? description
        : "The payment did not go through. Try again or use another method.",
  };
}

/** A message from the inline checkout page in the native WebView. Anything unexpected is ignored. */
export function parseWebViewMessage(data: string): CheckoutResult | null {
  let message: { type?: unknown; payload?: unknown };
  try {
    message = JSON.parse(data) as { type?: unknown; payload?: unknown };
  } catch {
    return null;
  }
  if (message.type === "success") return fromRazorpaySuccess(message.payload);
  if (message.type === "failed") return fromRazorpayFailure(message.payload);
  if (message.type === "dismissed") return { kind: "dismissed" };
  return null;
}

/**
 * The small page the native WebView loads: it pulls in checkout.js, opens the sheet and reports
 * back. The options are JSON escaped so nothing in them can break out of the script tag.
 */
export function checkoutHtml(checkout: CheckoutResponse): string {
  const options = JSON.stringify(checkoutOptions(checkout)).replace(/</g, "\\u003c");
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;height:100%;background:#fff;font-family:-apple-system,system-ui,sans-serif}
.wait{display:flex;height:100%;align-items:center;justify-content:center;color:#6B7A77;font-size:15px}</style>
</head><body><div class="wait">Opening secure payment</div>
<script src="${RAZORPAY_SCRIPT_URL}"></script>
<script>
(function(){
  function post(type,payload){window.ReactNativeWebView.postMessage(JSON.stringify({type:type,payload:payload}));}
  if(!window.Razorpay){post("failed",{error:{description:"Could not load the payment page. Check your connection."}});return;}
  var options=${options};
  var lastFailure=null;
  options.handler=function(r){post("success",r);};
  options.modal={ondismiss:function(){if(lastFailure){post("failed",lastFailure);}else{post("dismissed");}},confirm_close:true};
  var rzp=new window.Razorpay(options);
  // The sheet lets the customer retry after a failure, so a failure only counts if they then close it
  rzp.on("payment.failed",function(r){lastFailure={error:{description:r&&r.error&&r.error.description}};});
  rzp.open();
})();
</script></body></html>`;
}

/** Plain words for a failed payment step. */
export function describePaymentError(error: unknown): string {
  if (error instanceof HttpError) {
    if (error.status === 503 && /not configured/i.test(error.message)) {
      return "Online payments are not available right now. Please choose cash on delivery.";
    }
    if (error.status >= 500) return error.message || "Something went wrong. Try again in a moment.";
    return error.message;
  }
  return "We could not reach the payment service. Check your connection and try again.";
}

/** True when the server says online payments are switched off. */
export function isNotConfigured(error: unknown): boolean {
  return (
    error instanceof HttpError && error.status === 503 && /not configured/i.test(error.message)
  );
}
