import { DEV_INTERNAL_KEY, createDb, signIdentityHeaders } from "@qc/service-kit";
import type { InternalClient } from "@qc/service-kit";
import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app";
import type { DB } from "../../src/db/types.generated";
import { createFakeRazorpayClient } from "../../src/modules/payments/razorpay";
import { checkoutSignature, webhookSignature } from "../../src/modules/payments/signatures";

// Runs only with a migrated test database (see scripts/db-migrate.mjs)
const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

const ALICE = "aaaa0000-0000-4000-8000-0000000000a1";
const BOB = "bbbb0000-0000-4000-8000-0000000000b2";
const KEY_SECRET = "test_key_secret";
const WEBHOOK_SECRET = "test_webhook_secret";

type FakeOrder = {
  id: string;
  number: string;
  userId: string;
  status: string;
  paymentMethod: "cod" | "online";
  totalPaise: number;
};

suite("payment service", async () => {
  const db = createDb<DB>(url as string, 5);
  const razorpay = createFakeRazorpayClient();
  const orders = new Map<string, FakeOrder>();
  const orderCalls: string[] = [];
  const orderState = { down: false };
  const orderClient: InternalClient = {
    get: async (path) => {
      const id = path.split("/")[3] as string;
      const order = orders.get(id);
      if (!order) {
        const { InternalCallError } = await import("@qc/service-kit");
        throw new InternalCallError("Order not found.", 404, "NOT_FOUND");
      }
      return { ...order, customerName: "Alice", customerPhone: "+919999000001" } as never;
    },
    post: async (path) => {
      if (orderState.down) {
        const { InternalCallError } = await import("@qc/service-kit");
        throw new InternalCallError("down", 0, "SERVICE_UNAVAILABLE");
      }
      orderCalls.push(path);
      const id = path.split("/")[3] as string;
      const order = orders.get(id) as FakeOrder;
      if (order.status === "pending_payment") order.status = "confirmed";
      return { status: order.status } as never;
    },
  };
  const config = {
    razorpay: razorpay.client,
    keyId: "rzp_test_abc",
    keySecret: KEY_SECRET,
    webhookSecret: WEBHOOK_SECRET,
    merchantName: "Tokajo Mart",
  };
  const app = await buildApp({ db, orderClient, config });
  const off = await buildApp({
    db,
    orderClient,
    config: { razorpay: null, keyId: null, keySecret: null, webhookSecret: null },
  });

  const alice = signIdentityHeaders(
    { userId: ALICE, role: "customer", warehouseId: null },
    DEV_INTERNAL_KEY,
  );
  const bob = signIdentityHeaders(
    { userId: BOB, role: "customer", warehouseId: null },
    DEV_INTERNAL_KEY,
  );

  const newOrder = (overrides: Partial<FakeOrder> = {}) => {
    const order: FakeOrder = {
      id: randomUUID(),
      number: `QC-T-${orders.size}`,
      userId: ALICE,
      status: "pending_payment",
      paymentMethod: "online",
      totalPaise: 25_900,
      ...overrides,
    };
    orders.set(order.id, order);
    return order;
  };
  const checkout = (orderId: string, headers = alice, target = app) =>
    target.inject({ method: "POST", url: `/v1/payments/orders/${orderId}/checkout`, headers });
  const verify = (body: object, headers = alice) =>
    app.inject({ method: "POST", url: "/v1/payments/verify", headers, payload: body });
  const webhook = (
    body: object,
    opts: { secret?: string; eventId?: string; tamper?: boolean } = {},
  ) => {
    const raw = JSON.stringify(body);
    const signature = webhookSignature(opts.secret ?? WEBHOOK_SECRET, raw);
    return app.inject({
      method: "POST",
      url: "/webhooks/razorpay",
      headers: {
        "content-type": "application/json",
        "x-razorpay-signature": signature,
        "x-razorpay-event-id": opts.eventId ?? `evt_${randomUUID()}`,
      },
      payload: opts.tamper ? raw.replace("captured", "capturex") : raw,
    });
  };
  const captured = (razorpayOrderId: string, paymentId = `pay_${randomUUID().slice(0, 8)}`) => ({
    event: "payment.captured",
    payload: {
      payment: {
        entity: {
          id: paymentId,
          order_id: razorpayOrderId,
          amount: 25_900,
          method: "upi",
          status: "captured",
        },
      },
    },
  });

  beforeEach(async () => {
    orderCalls.length = 0;
    orderState.down = false;
    razorpay.state.failRefunds = false;
    await db.deleteFrom("payments.refunds").execute();
    await db.deleteFrom("payments.payments").where("userId", "in", [ALICE, BOB]).execute();
  });
  afterAll(async () => {
    await db.deleteFrom("payments.refunds").execute();
    await db.deleteFrom("payments.payments").where("userId", "in", [ALICE, BOB]).execute();
    await app.close();
    await off.close();
    await db.destroy();
  });

  describe("checkout", () => {
    it("creates one Razorpay order for the order's own total and reuses it", async () => {
      const order = newOrder();
      const first = await checkout(order.id);
      expect(first.statusCode).toBe(200);
      expect(first.json()).toMatchObject({
        orderId: order.id,
        keyId: "rzp_test_abc",
        amountPaise: 25_900,
        currency: "INR",
        name: "Tokajo Mart",
        prefill: { contact: "+919999000001", name: "Alice" },
      });
      const again = await checkout(order.id);
      expect(again.json().razorpayOrderId).toBe(first.json().razorpayOrderId);
      expect(razorpay.orders.get(first.json().razorpayOrderId)?.amount).toBe(25_900);
      // The secret never goes to the app
      expect(JSON.stringify(first.json())).not.toContain(KEY_SECRET);
    });

    it("refuses other people's orders, cash orders and orders not waiting for payment", async () => {
      expect((await checkout(newOrder().id, bob)).statusCode).toBe(404);
      expect(
        (await checkout(newOrder({ paymentMethod: "cod", status: "confirmed" }).id)).statusCode,
      ).toBe(409);
      const expired = await checkout(newOrder({ status: "expired" }).id);
      expect(expired.statusCode).toBe(409);
      expect(expired.json().error.message).toMatch(/ran out/);
      expect((await checkout(randomUUID())).statusCode).toBe(404);
    });

    it("answers 503 when online payments are not configured", async () => {
      const res = await checkout(newOrder().id, alice, off);
      expect(res.statusCode).toBe(503);
      expect(res.json().error.message).toBe("Online payments are not configured.");
    });

    it("needs a signed in customer", async () => {
      const order = newOrder();
      expect(
        (await app.inject({ method: "POST", url: `/v1/payments/orders/${order.id}/checkout` }))
          .statusCode,
      ).toBe(401);
    });
  });

  describe("verify from the app", () => {
    it("accepts Razorpay's signature, confirms the order, and is safe to repeat", async () => {
      const order = newOrder();
      const { razorpayOrderId } = (await checkout(order.id)).json();
      const body = {
        razorpayOrderId,
        razorpayPaymentId: "pay_abc123",
        razorpaySignature: checkoutSignature(KEY_SECRET, razorpayOrderId, "pay_abc123"),
      };
      const res = await verify(body);
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ status: "captured", amountPaise: 25_900 });
      expect((await verify(body)).json().status).toBe("captured");
      expect(
        orderCalls.filter((p) => p.endsWith("/payment-captured")).length,
      ).toBeGreaterThanOrEqual(1);
      expect(orders.get(order.id)?.status).toBe("confirmed");
    });

    it("rejects a tampered signature or someone else's payment", async () => {
      const order = newOrder();
      const { razorpayOrderId } = (await checkout(order.id)).json();
      const forged = checkoutSignature("wrong_secret", razorpayOrderId, "pay_x");
      expect(
        (await verify({ razorpayOrderId, razorpayPaymentId: "pay_x", razorpaySignature: forged }))
          .statusCode,
      ).toBe(400);
      const good = checkoutSignature(KEY_SECRET, razorpayOrderId, "pay_x");
      expect(
        (await verify({ razorpayOrderId, razorpayPaymentId: "pay_y", razorpaySignature: good }))
          .statusCode,
      ).toBe(400);
      expect(
        (
          await verify(
            { razorpayOrderId, razorpayPaymentId: "pay_x", razorpaySignature: good },
            bob,
          )
        ).statusCode,
      ).toBe(404);
      expect(orders.get(order.id)?.status).toBe("pending_payment");
    });

    it("keeps the capture and asks the app to wait when the order service is down", async () => {
      const order = newOrder();
      const { razorpayOrderId } = (await checkout(order.id)).json();
      orderState.down = true;
      const res = await verify({
        razorpayOrderId,
        razorpayPaymentId: "pay_d",
        razorpaySignature: checkoutSignature(KEY_SECRET, razorpayOrderId, "pay_d"),
      });
      expect(res.statusCode).toBe(503);
      orderState.down = false;
      // The webhook (or a retry) finishes the job
      expect((await webhook(captured(razorpayOrderId, "pay_d"))).statusCode).toBe(200);
      expect(orders.get(order.id)?.status).toBe("confirmed");
    });
  });

  describe("webhooks", () => {
    it("confirms the order on payment.captured with a valid signature", async () => {
      const order = newOrder();
      const { razorpayOrderId } = (await checkout(order.id)).json();
      const res = await webhook(captured(razorpayOrderId));
      expect(res.json()).toEqual({ handled: true, duplicate: false });
      expect(orders.get(order.id)?.status).toBe("confirmed");
      const status = await app.inject({
        method: "GET",
        url: `/v1/payments/orders/${order.id}`,
        headers: alice,
      });
      expect(status.json()).toMatchObject({ status: "captured", method: "upi" });
    });

    it("rejects a bad signature and a body changed after signing", async () => {
      const order = newOrder();
      const { razorpayOrderId } = (await checkout(order.id)).json();
      expect((await webhook(captured(razorpayOrderId), { secret: "nope" })).statusCode).toBe(400);
      expect((await webhook(captured(razorpayOrderId), { tamper: true })).statusCode).toBe(400);
      expect(orders.get(order.id)?.status).toBe("pending_payment");
    });

    it("handles each event once", async () => {
      const order = newOrder();
      const { razorpayOrderId } = (await checkout(order.id)).json();
      expect(
        (await webhook(captured(razorpayOrderId), { eventId: "evt_same_1" })).json().duplicate,
      ).toBe(false);
      expect(
        (await webhook(captured(razorpayOrderId), { eventId: "evt_same_1" })).json().duplicate,
      ).toBe(true);
      await db.deleteFrom("payments.webhookEvents").where("eventId", "=", "evt_same_1").execute();
    });

    it("records a failed attempt so the customer can see why and try again", async () => {
      const order = newOrder();
      const { razorpayOrderId } = (await checkout(order.id)).json();
      await webhook({
        event: "payment.failed",
        payload: {
          payment: {
            entity: {
              id: "pay_f",
              order_id: razorpayOrderId,
              error_code: "BAD_REQUEST_ERROR",
              error_description: "Payment declined by bank",
            },
          },
        },
      });
      const status = (
        await app.inject({ method: "GET", url: `/v1/payments/orders/${order.id}`, headers: alice })
      ).json();
      expect(status).toMatchObject({
        status: "failed",
        errorDescription: "Payment declined by bank",
      });
      // Retrying works and a later capture still confirms
      expect((await checkout(order.id)).json().razorpayOrderId).toBe(razorpayOrderId);
      await webhook(captured(razorpayOrderId));
      expect(orders.get(order.id)?.status).toBe("confirmed");
    });

    it("refunds straight away when the money arrives after the order expired", async () => {
      const order = newOrder();
      const { razorpayOrderId } = (await checkout(order.id)).json();
      order.status = "expired";
      await webhook(captured(razorpayOrderId, "pay_late"));
      const status = (
        await app.inject({ method: "GET", url: `/v1/payments/orders/${order.id}`, headers: alice })
      ).json();
      expect(status).toMatchObject({ status: "refunded", refundedPaise: 25_900 });
      expect(razorpay.refunds.some((r) => r.payment_id === "pay_late")).toBe(true);
    });

    it("answers 503 when no webhook secret is set", async () => {
      const res = await off.inject({
        method: "POST",
        url: "/webhooks/razorpay",
        headers: { "content-type": "application/json", "x-razorpay-signature": "x" },
        payload: "{}",
      });
      expect(res.statusCode).toBe(503);
    });
  });

  describe("refunds on cancel", () => {
    const paid = async () => {
      const order = newOrder();
      const { razorpayOrderId } = (await checkout(order.id)).json();
      await webhook(captured(razorpayOrderId, `pay_${order.id.slice(0, 6)}`));
      return order;
    };
    const refund = (orderId: string) =>
      app.inject({ method: "POST", url: `/internal/payments/orders/${orderId}/refund` });

    it("refunds a captured payment in full, once", async () => {
      const order = await paid();
      expect((await refund(order.id)).json()).toEqual({ refunded: true });
      expect((await refund(order.id)).json()).toEqual({ refunded: false });
      expect(
        razorpay.refunds.filter((r) => r.payment_id === `pay_${order.id.slice(0, 6)}`),
      ).toHaveLength(1);
      const rows = await db.selectFrom("payments.refunds").selectAll().execute();
      expect(rows.some((r) => r.amountPaise === 25_900)).toBe(true);
    });

    it("does nothing for an unpaid order, and can be retried after Razorpay fails", async () => {
      expect((await refund(newOrder().id)).json()).toEqual({ refunded: false });
      const order = await paid();
      razorpay.state.failRefunds = true;
      expect((await refund(order.id)).statusCode).toBe(502);
      razorpay.state.failRefunds = false;
      expect((await refund(order.id)).json()).toEqual({ refunded: true });
    });

    it("lets two refunds at once pay out only once", async () => {
      const order = await paid();
      const results = await Promise.all([refund(order.id), refund(order.id)]);
      expect(results.map((r) => r.json().refunded).sort()).toEqual([false, true]);
    });
  });
});
