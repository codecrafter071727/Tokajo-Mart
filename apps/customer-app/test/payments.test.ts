import { describe, expect, it } from "vitest";
import type { CheckoutResponse } from "@qc/contracts";
import { HttpError } from "../src/lib/httpError";
import {
  canPay,
  checkoutHtml,
  checkoutOptions,
  describePaymentError,
  formatCountdown,
  fromRazorpayFailure,
  fromRazorpaySuccess,
  isNotConfigured,
  parseWebViewMessage,
  paymentPhase,
  paymentSecondsLeft,
  PAYMENT_WINDOW_MS,
} from "../src/lib/payments";

const placedAt = "2026-11-13T10:00:00.000Z";
const at = (mins: number) => new Date(Date.parse(placedAt) + mins * 60_000);
const online = { payment: "online" as const, placedAt };

const checkout: CheckoutResponse = {
  orderId: "11111111-1111-4111-8111-111111111111",
  razorpayOrderId: "order_abc",
  keyId: "rzp_test_public",
  amountPaise: 9400,
  currency: "INR",
  name: "Milcki",
  description: "Order QC-1",
  prefill: { contact: "+919999000001", name: "Asha" },
};

describe("payment window and countdown", () => {
  it("counts down 15 minutes from placing and stops at zero", () => {
    expect(PAYMENT_WINDOW_MS).toBe(15 * 60_000);
    expect(paymentSecondsLeft(placedAt, at(0))).toBe(900);
    expect(paymentSecondsLeft(placedAt, at(14.5))).toBe(30);
    expect(paymentSecondsLeft(placedAt, at(20))).toBe(0);
  });

  it("formats minutes and seconds", () => {
    expect(formatCountdown(900)).toBe("15:00");
    expect(formatCountdown(754)).toBe("12:34");
    expect(formatCountdown(5)).toBe("0:05");
    expect(formatCountdown(-3)).toBe("0:00");
  });
});

describe("payment phase", () => {
  it("is cash for cash on delivery, whatever else is true", () => {
    expect(paymentPhase({ payment: "cod", placedAt }, null, at(1))).toBe("cash");
  });

  it("waits for payment inside the window, and can be paid", () => {
    const phase = paymentPhase({ ...online, serverStatus: "pending_payment" }, null, at(2));
    expect(phase).toBe("awaiting");
    expect(canPay(phase)).toBe(true);
  });

  it("shows a failed attempt as retryable while time is left", () => {
    const failed = { status: "failed" as const, refundedPaise: 0, errorDescription: "Declined" };
    expect(paymentPhase({ ...online, serverStatus: "pending_payment" }, failed, at(3))).toBe(
      "failed",
    );
  });

  it("expires when the window is over, even before the server sweeps it", () => {
    expect(paymentPhase({ ...online, serverStatus: "pending_payment" }, null, at(16))).toBe(
      "expired",
    );
    expect(paymentPhase({ ...online, serverStatus: "expired" }, null, at(2))).toBe("expired");
    expect(canPay("expired")).toBe(false);
  });

  it("is paid once captured or once the server confirmed the order", () => {
    const captured = { status: "captured" as const, refundedPaise: 0, errorDescription: null };
    expect(paymentPhase({ ...online, serverStatus: "confirmed" }, captured, at(1))).toBe("paid");
    // The payment record can lag behind the order
    expect(paymentPhase({ ...online, serverStatus: "packing" }, null, at(30))).toBe("paid");
  });

  it("shows the refund for a cancelled paid order", () => {
    const captured = { status: "captured" as const, refundedPaise: 0, errorDescription: null };
    expect(paymentPhase({ ...online, serverStatus: "cancelled" }, captured, at(1))).toBe(
      "refund_started",
    );
    const refunded = { status: "refunded" as const, refundedPaise: 9400, errorDescription: null };
    expect(paymentPhase({ ...online, serverStatus: "cancelled" }, refunded, at(1))).toBe(
      "refunded",
    );
  });

  it("treats a cancelled unpaid online order as not charged, never refunded", () => {
    expect(paymentPhase({ ...online, serverStatus: "cancelled" }, null, at(1))).toBe("not_charged");
  });
});

describe("razorpay results", () => {
  it("reads a complete success and rejects an incomplete one", () => {
    expect(
      fromRazorpaySuccess({
        razorpay_order_id: "order_abc",
        razorpay_payment_id: "pay_1",
        razorpay_signature: "f".repeat(64),
      }),
    ).toEqual({
      kind: "success",
      razorpayOrderId: "order_abc",
      razorpayPaymentId: "pay_1",
      razorpaySignature: "f".repeat(64),
    });
    expect(fromRazorpaySuccess({ razorpay_order_id: "order_abc" }).kind).toBe("failed");
    expect(fromRazorpaySuccess(undefined).kind).toBe("failed");
  });

  it("keeps Razorpay's failure reason, or gives a plain one", () => {
    expect(fromRazorpayFailure({ error: { description: "Card declined" } })).toEqual({
      kind: "failed",
      description: "Card declined",
    });
    expect(fromRazorpayFailure({}).kind).toBe("failed");
  });

  it("parses the WebView messages and ignores anything else", () => {
    expect(parseWebViewMessage(JSON.stringify({ type: "dismissed" }))).toEqual({
      kind: "dismissed",
    });
    expect(
      parseWebViewMessage(
        JSON.stringify({ type: "failed", payload: { error: { description: "Timed out" } } }),
      ),
    ).toEqual({ kind: "failed", description: "Timed out" });
    expect(parseWebViewMessage("not json")).toBeNull();
    expect(parseWebViewMessage(JSON.stringify({ type: "hello" }))).toBeNull();
  });
});

describe("checkout options and page", () => {
  it("sends only the public key, the brand colour and the server's amount", () => {
    const options = checkoutOptions(checkout);
    expect(options).toMatchObject({
      key: "rzp_test_public",
      amount: 9400,
      currency: "INR",
      order_id: "order_abc",
      theme: { color: "#42C86E" },
    });
    expect(JSON.stringify(options)).not.toMatch(/secret/i);
  });

  it("escapes the options so a name cannot break out of the script", () => {
    const html = checkoutHtml({ ...checkout, name: "</script><script>alert(1)</script>" });
    expect(html).not.toContain("</script><script>alert(1)");
    expect(html).toContain("\\u003c/script>");
    expect(html).toContain("https://checkout.razorpay.com/v1/checkout.js");
  });
});

describe("payment errors", () => {
  it("recognises payments being switched off", () => {
    const off = new HttpError("Online payments are not configured.", 503, "SERVICE_UNAVAILABLE");
    expect(isNotConfigured(off)).toBe(true);
    expect(describePaymentError(off)).toMatch(/cash on delivery/);
    expect(isNotConfigured(new HttpError("Order not found.", 404, "NOT_FOUND"))).toBe(false);
  });

  it("passes on the server's message and covers network failures", () => {
    expect(
      describePaymentError(
        new HttpError("The time to pay for this order ran out.", 409, "CONFLICT"),
      ),
    ).toBe("The time to pay for this order ran out.");
    expect(describePaymentError(new TypeError("fetch failed"))).toMatch(/connection/);
  });
});
