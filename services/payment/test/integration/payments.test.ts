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

  describe("config", () => {
    it("tells a signed in app whether online payment is on, and nothing else", async () => {
      const res = await app.inject({ method: "GET", url: "/v1/payments/config", headers: alice });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ onlineEnabled: true });
      expect((await app.inject({ method: "GET", url: "/v1/payments/config" })).statusCode).toBe(
        401,
      );
    });
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

  describe("admin", () => {
    const ADMIN = "dddd0000-0000-4000-8000-0000000000d1";
    const admin = signIdentityHeaders(
      { userId: ADMIN, role: "admin", warehouseId: null },
      DEV_INTERNAL_KEY,
    );
    const manager = signIdentityHeaders(
      { userId: ADMIN, role: "warehouse_manager", warehouseId: "wh-noida-62" },
      DEV_INTERNAL_KEY,
    );
    const paid = async (overrides: Partial<FakeOrder> = {}) => {
      const order = newOrder(overrides);
      const { razorpayOrderId } = (await checkout(order.id)).json();
      await webhook(captured(razorpayOrderId, `pay_${order.id.slice(0, 8)}`));
      return order;
    };
    let keyN = 0;
    const refund = (
      orderId: string,
      body: object,
      opts: { headers?: object; key?: string | null } = {},
    ) =>
      app.inject({
        method: "POST",
        url: `/v1/payments/admin/orders/${orderId}/refund`,
        headers: {
          ...(opts.headers ?? admin),
          ...(opts.key === null
            ? {}
            : { "idempotency-key": opts.key ?? `refund-key-${++keyN}-${Date.now()}` }),
        },
        payload: body,
      });

    it("lists payments for admins only, with totals, search and paging", async () => {
      const a = await paid();
      await paid();
      newOrder(); // never paid, no payment row
      const pending = newOrder();
      await checkout(pending.id);

      const res = await app.inject({
        method: "GET",
        url: "/v1/payments/admin?limit=2",
        headers: admin,
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.items).toHaveLength(2);
      expect(body.nextCursor).toBeTruthy();
      expect(body.items[0]).toMatchObject({ customerName: "Alice", amountPaise: 25_900 });
      expect(body.items[0].orderNumber).toMatch(/^QC-T-/);
      expect(body.stats).toMatchObject({
        capturedCount: 2,
        capturedPaise: 51_800,
        pendingCount: 1,
      });

      const next = await app.inject({
        method: "GET",
        url: `/v1/payments/admin?limit=2&cursor=${body.nextCursor}`,
        headers: admin,
      });
      const ids = [...body.items, ...next.json().items].map((p: { orderId: string }) => p.orderId);
      expect(new Set(ids).size).toBe(3);

      const search = await app.inject({
        method: "GET",
        url: `/v1/payments/admin?q=${encodeURIComponent(a.number)}`,
        headers: admin,
      });
      expect(search.json().items.map((p: { orderId: string }) => p.orderId)).toEqual([a.id]);
      const onlyPending = await app.inject({
        method: "GET",
        url: "/v1/payments/admin?status=created",
        headers: admin,
      });
      expect(onlyPending.json().items.map((p: { orderId: string }) => p.orderId)).toEqual([
        pending.id,
      ]);

      for (const headers of [alice, manager]) {
        expect(
          (await app.inject({ method: "GET", url: "/v1/payments/admin", headers })).statusCode,
        ).toBe(403);
      }
      expect((await app.inject({ method: "GET", url: "/v1/payments/admin" })).statusCode).toBe(401);
    });

    it("shows one payment with its refunds and what is left to refund", async () => {
      const order = await paid();
      const res = await app.inject({
        method: "GET",
        url: `/v1/payments/admin/${order.id}`,
        headers: admin,
      });
      expect(res.json()).toMatchObject({
        status: "captured",
        refundablePaise: 25_900,
        refunds: [],
      });
      expect(
        (
          await app.inject({
            method: "GET",
            url: `/v1/payments/admin/${randomUUID()}`,
            headers: admin,
          })
        ).statusCode,
      ).toBe(404);
      expect(
        (await app.inject({ method: "GET", url: `/v1/payments/admin/${order.id}`, headers: alice }))
          .statusCode,
      ).toBe(403);
    });

    it("refunds part, then the rest, never more than was paid, with the reason and who", async () => {
      const order = await paid();
      const part = await refund(order.id, { amountPaise: 5_000, reason: "Milk was missing" });
      expect(part.statusCode).toBe(200);
      expect(part.json()).toMatchObject({
        status: "partially_refunded",
        refundedPaise: 5_000,
        refundablePaise: 20_900,
      });
      expect(part.json().refunds[0]).toMatchObject({
        amountPaise: 5_000,
        reason: "Milk was missing",
        actorId: ADMIN,
        status: "processed",
      });

      const tooMuch = await refund(order.id, { amountPaise: 20_901, reason: "Too much" });
      expect(tooMuch.statusCode).toBe(409);
      expect(tooMuch.json().error.message).toMatch(/209/);

      const rest = await refund(order.id, { reason: "Customer unhappy" });
      expect(rest.json()).toMatchObject({
        status: "refunded",
        refundedPaise: 25_900,
        refundablePaise: 0,
      });
      expect((await refund(order.id, { reason: "Again" })).statusCode).toBe(409);
      // A cancellation afterwards has nothing left to refund
      expect(
        (
          await app.inject({ method: "POST", url: `/internal/payments/orders/${order.id}/refund` })
        ).json(),
      ).toEqual({ refunded: false });
    });

    it("returns the same refund for a repeated Idempotency-Key, even when sent at once", async () => {
      const order = await paid();
      const first = await refund(
        order.id,
        { amountPaise: 1_000, reason: "Late delivery" },
        { key: "same-key-123456" },
      );
      const again = await refund(
        order.id,
        { amountPaise: 1_000, reason: "Late delivery" },
        { key: "same-key-123456" },
      );
      expect(again.json().refundedPaise).toBe(1_000);
      expect(first.json().refunds).toHaveLength(1);

      const other = await paid();
      const both = await Promise.all([
        refund(
          other.id,
          { amountPaise: 2_000, reason: "Damaged item" },
          { key: "race-key-123456" },
        ),
        refund(
          other.id,
          { amountPaise: 2_000, reason: "Damaged item" },
          { key: "race-key-123456" },
        ),
      ]);
      expect(both.every((r) => r.statusCode === 200)).toBe(true);
      const detail = await app.inject({
        method: "GET",
        url: `/v1/payments/admin/${other.id}`,
        headers: admin,
      });
      expect(detail.json().refundedPaise).toBe(2_000);
      expect(
        razorpay.refunds.filter((r) => r.payment_id === `pay_${other.id.slice(0, 8)}`),
      ).toHaveLength(1);
    });

    it("gives the amount back when Razorpay fails, and a retry with the same key tries again", async () => {
      const order = await paid();
      razorpay.state.failRefunds = true;
      const failed = await refund(
        order.id,
        { amountPaise: 3_000, reason: "Wrong item" },
        { key: "retry-key-12345" },
      );
      expect(failed.statusCode).toBe(502);
      const after = await app.inject({
        method: "GET",
        url: `/v1/payments/admin/${order.id}`,
        headers: admin,
      });
      expect(after.json()).toMatchObject({ status: "captured", refundedPaise: 0 });
      expect(after.json().refunds[0].status).toBe("failed");
      razorpay.state.failRefunds = false;
      const retry = await refund(
        order.id,
        { amountPaise: 3_000, reason: "Wrong item" },
        { key: "retry-key-12345" },
      );
      expect(retry.json().refundedPaise).toBe(3_000);
    });

    it("needs an admin, an Idempotency-Key, a reason and a taken payment", async () => {
      const order = await paid();
      expect((await refund(order.id, { reason: "Nope" }, { headers: alice })).statusCode).toBe(403);
      expect((await refund(order.id, { reason: "Nope" }, { headers: manager })).statusCode).toBe(
        403,
      );
      expect((await refund(order.id, {}, { headers: alice })).statusCode).toBe(403);
      expect((await refund(order.id, { reason: "No key here" }, { key: null })).statusCode).toBe(
        400,
      );
      expect((await refund(order.id, { reason: "" })).statusCode).toBe(400);
      const unpaid = newOrder();
      await checkout(unpaid.id);
      expect((await refund(unpaid.id, { reason: "Not paid yet" })).statusCode).toBe(409);
      expect((await refund(randomUUID(), { reason: "No such order" })).statusCode).toBe(404);
    });

    it("gives the order service payment status for several orders", async () => {
      const a = await paid();
      const b = newOrder();
      await checkout(b.id);
      const res = await app.inject({
        method: "GET",
        url: `/internal/payments/batch?orderIds=${a.id},${b.id},${randomUUID()}`,
      });
      const byId = Object.fromEntries(
        res.json().items.map((p: { orderId: string; status: string }) => [p.orderId, p.status]),
      );
      expect(byId).toEqual({ [a.id]: "captured", [b.id]: "created" });
    });
  });
});
