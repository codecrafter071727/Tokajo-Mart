import { randomBytes } from "node:crypto";

export type RazorpayOrder = { id: string; amount: number; currency: string; status: string };
export type RazorpayRefund = { id: string; payment_id: string; amount: number; status: string };
export type RazorpayPayment = {
  id: string;
  order_id: string;
  amount: number;
  status: string;
  method: string | null;
};

/** The few Razorpay calls we make. Tests and CI use the fake below, never the network. */
export interface RazorpayClient {
  createOrder(input: {
    amountPaise: number;
    receipt: string;
    notes: Record<string, string>;
  }): Promise<RazorpayOrder>;
  refund(
    paymentId: string,
    amountPaise: number,
    notes: Record<string, string>,
  ): Promise<RazorpayRefund>;
  fetchPayment(paymentId: string): Promise<RazorpayPayment>;
}

export class RazorpayError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "RazorpayError";
    this.status = status;
  }
}

export function createHttpRazorpayClient(options: {
  keyId: string;
  keySecret: string;
  baseUrl?: string;
  fetch?: typeof fetch;
}): RazorpayClient {
  const base = options.baseUrl ?? "https://api.razorpay.com/v1";
  const doFetch = options.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const auth = `Basic ${Buffer.from(`${options.keyId}:${options.keySecret}`).toString("base64")}`;

  async function call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
    let res: Response;
    try {
      res = await doFetch(`${base}${path}`, {
        method,
        headers: {
          authorization: auth,
          accept: "application/json",
          ...(body ? { "content-type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new RazorpayError(0, "Could not reach Razorpay.");
    }
    const json = (await res.json().catch(() => null)) as
      (T & { error?: { description?: string } }) | null;
    if (!res.ok || !json) {
      // Razorpay's description is safe to log; the key never appears in it
      throw new RazorpayError(
        res.status,
        json?.error?.description ?? `Razorpay answered ${res.status}.`,
      );
    }
    return json;
  }

  return {
    createOrder: ({ amountPaise, receipt, notes }) =>
      call<RazorpayOrder>("POST", "/orders", {
        amount: amountPaise,
        currency: "INR",
        receipt: receipt.slice(0, 40),
        notes,
      }),
    refund: (paymentId, amountPaise, notes) =>
      call<RazorpayRefund>("POST", `/payments/${encodeURIComponent(paymentId)}/refund`, {
        amount: amountPaise,
        notes,
      }),
    fetchPayment: (paymentId) =>
      call<RazorpayPayment>("GET", `/payments/${encodeURIComponent(paymentId)}`),
  };
}

/** A pretend Razorpay for tests and CI. It remembers what it was asked so tests can check. */
export function createFakeRazorpayClient() {
  const orders = new Map<string, RazorpayOrder & { receipt: string }>();
  const refunds: RazorpayRefund[] = [];
  const state = { failRefunds: false };
  const id = (prefix: string) => `${prefix}_fake${randomBytes(6).toString("hex")}`;
  const client: RazorpayClient = {
    async createOrder({ amountPaise, receipt }) {
      const order = {
        id: id("order"),
        amount: amountPaise,
        currency: "INR",
        status: "created",
        receipt,
      };
      orders.set(order.id, order);
      return order;
    },
    async refund(paymentId, amountPaise) {
      if (state.failRefunds) throw new RazorpayError(502, "Refunds are down.");
      const refund = {
        id: id("rfnd"),
        payment_id: paymentId,
        amount: amountPaise,
        status: "processed",
      };
      refunds.push(refund);
      return refund;
    },
    async fetchPayment(paymentId) {
      return { id: paymentId, order_id: "", amount: 0, status: "captured", method: "upi" };
    },
  };
  return { client, orders, refunds, state };
}
