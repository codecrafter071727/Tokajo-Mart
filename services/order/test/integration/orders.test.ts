import {
  DEV_INTERNAL_KEY,
  InternalCallError,
  createDb,
  signIdentityHeaders,
} from "@qc/service-kit";
import type { InternalClient } from "@qc/service-kit";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app";
import type { DB } from "../../src/db/types.generated";
import type { Clients } from "../../src/modules/orders/clients";

// Runs only with a migrated test database (see scripts/db-migrate.mjs)
const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

const ALICE = "aaaaaaaa-0000-4000-8000-00000000000a";
const BOB = "bbbbbbbb-0000-4000-8000-00000000000b";
const RIDER = "cccccccc-0000-4000-8000-00000000000c";
const ADMIN = "dddddddd-0000-4000-8000-00000000000d";

const PRODUCTS: Record<string, { name: string; pricePaise: number; mrpPaise: number }> = {
  p1: { name: "Milk", pricePaise: 3000, mrpPaise: 3200 },
  p2: { name: "Bread", pricePaise: 4500, mrpPaise: 5000 },
  p3: { name: "Eggs", pricePaise: 8000, mrpPaise: 8000 },
};
const ADDRESS = { tag: "Home", line1: "12 Park Road", line2: "Sector 62", lat: 28.62, lng: 77.36 };

/** Stand ins for the other services, recording what the order service asked of them. */
function fakeServices() {
  const calls: { service: string; method: string; path: string; body?: unknown }[] = [];
  const state = {
    serviceable: true,
    reason: null as string | null,
    reserveError: null as InternalCallError | null,
    deliveryDown: false,
  };
  const make = (
    service: string,
    handler: (method: string, path: string, body: unknown) => unknown,
  ): InternalClient => ({
    get: async (path) => {
      calls.push({ service, method: "GET", path });
      return handler("GET", path, undefined) as never;
    },
    post: async (path, body) => {
      calls.push({ service, method: "POST", path, body });
      return handler("POST", path, body) as never;
    },
  });
  const clients: Clients = {
    catalog: make("catalog", (_m, path) => {
      const ids = new URL(path, "http://x").searchParams.get("ids")?.split(",") ?? [];
      return {
        items: ids
          .filter((id) => PRODUCTS[id])
          .map((id) => ({ id, unit: "1 pc", emoji: "x", imageUrl: null, ...PRODUCTS[id] })),
      };
    }),
    inventory: make("inventory", (_m, path) => {
      if (path === "/internal/serviceability/resolve") {
        return {
          serviceable: state.serviceable,
          warehouseId: state.serviceable ? "wh-noida-62" : null,
          etaMins: 11,
          distanceKm: 1.2,
          reason: state.reason,
          unavailable:
            state.reason === "ITEMS_UNAVAILABLE"
              ? [{ productId: "p1", requested: 9, available: 2 }]
              : [],
        };
      }
      if (path === "/internal/reservations" && state.reserveError) throw state.reserveError;
      if (path.startsWith("/internal/warehouses/")) {
        return { id: "wh-noida-62", name: "Tokajo Noida 62", lat: 28.61, lng: 77.35, open: true };
      }
      return { id: "r", status: "ok" };
    }),
    delivery: make("delivery", () => {
      if (state.deliveryDown) throw new InternalCallError("down", 0, "SERVICE_UNAVAILABLE");
      return { ok: true };
    }),
    identity: make("identity", (_m, path) => {
      if (path.startsWith("/internal/riders/batch")) {
        return { items: [{ id: RIDER, name: "Ravi Kumar", phone: "+919810000011", rating: 4.8 }] };
      }
      return { name: "Alice", phone: "+919999000001" };
    }),
  };
  return { clients, calls, state };
}

suite("order service", async () => {
  const db = createDb<DB>(url as string, 5);
  const fake = fakeServices();
  const app = await buildApp({ db, clients: fake.clients });

  const as = (userId: string, role: string, warehouseId: string | null = null) =>
    signIdentityHeaders({ userId, role: role as never, warehouseId }, DEV_INTERNAL_KEY);
  const alice = as(ALICE, "customer");
  const bob = as(BOB, "customer");
  const staff = as(ADMIN, "warehouse_staff", "wh-noida-62");
  const otherStaff = as(ADMIN, "warehouse_staff", "wh-indiranagar");
  const admin = as(ADMIN, "admin");

  let keyCounter = 0;
  const place = (
    headers = alice,
    items = [{ productId: "p1", quantity: 2 }],
    extra: object = {},
    key = `key-${++keyCounter}-${Date.now()}`,
  ) =>
    app.inject({
      method: "POST",
      url: "/v1/orders",
      headers: { ...headers, "idempotency-key": key },
      payload: { items, address: ADDRESS, payment: "cod", ...extra },
    });
  const post = (url: string, headers: Record<string, string>, body?: object) =>
    app.inject({ method: "POST", url, headers, payload: body ?? {} });
  const get = (url: string, headers: Record<string, string>) =>
    app.inject({ method: "GET", url, headers });

  beforeEach(async () => {
    fake.calls.length = 0;
    Object.assign(fake.state, {
      serviceable: true,
      reason: null,
      reserveError: null,
      deliveryDown: false,
    });
    await db.deleteFrom("orders.orders").where("userId", "in", [ALICE, BOB]).execute();
  });
  afterAll(async () => {
    await db.deleteFrom("orders.orders").where("userId", "in", [ALICE, BOB]).execute();
    await app.close();
    await db.destroy();
  });

  describe("placing an order", () => {
    it("prices the order from the catalog, not from the client", async () => {
      // The client tries to sneak in its own prices and total. The body schema ignores them.
      const res = await place(alice, [{ productId: "p1", quantity: 2 }], {
        totalPaise: 1,
        items: [{ productId: "p1", quantity: 2, unitPricePaise: 1 }],
      });
      expect(res.statusCode).toBe(201);
      const order = res.json();
      expect(order).toMatchObject({
        status: "confirmed",
        warehouseId: "wh-noida-62",
        itemTotalPaise: 6000,
        mrpTotalPaise: 6400,
        savingsPaise: 400,
        deliveryFeePaise: 2900,
        handlingFeePaise: 500,
        totalPaise: 9400,
        promisedMins: 11,
      });
      expect(order.number).toMatch(/^QC-\d{6}-\d{5}$/);
      expect(order.deliveryCode).toMatch(/^\d{4}$/);
      expect(order.items[0]).toMatchObject({
        productId: "p1",
        name: "Milk",
        quantity: 2,
        unitPricePaise: 3000,
        picked: false,
      });
    });

    it("gives free delivery from 99 rupees and adds the tip", async () => {
      const res = await place(alice, [{ productId: "p2", quantity: 3 }], { tipPaise: 2000 });
      expect(res.json()).toMatchObject({
        itemTotalPaise: 13500,
        deliveryFeePaise: 0,
        tipPaise: 2000,
        totalPaise: 16000,
      });
    });

    it("holds the stock under the order id, then sells it", async () => {
      const order = (await place()).json();
      const paths = fake.calls.filter((c) => c.service === "inventory").map((c) => c.path);
      expect(paths).toEqual([
        "/internal/serviceability/resolve",
        "/internal/reservations",
        `/internal/reservations/${order.id}/commit`,
      ]);
      expect(fake.calls.find((c) => c.path === "/internal/reservations")?.body).toMatchObject({
        reference: order.id,
        warehouseId: "wh-noida-62",
        items: [{ productId: "p1", quantity: 2 }],
      });
    });

    it("returns the same order for a repeated Idempotency-Key and holds stock once", async () => {
      const first = await place(alice, undefined, {}, "same-key-12345");
      const again = await place(alice, undefined, {}, "same-key-12345");
      expect(first.statusCode).toBe(201);
      expect(again.statusCode).toBe(200);
      expect(again.json().id).toBe(first.json().id);
      expect(fake.calls.filter((c) => c.path === "/internal/reservations")).toHaveLength(1);
      const count = await db
        .selectFrom("orders.orders")
        .select((eb) => eb.fn.countAll<string>().as("n"))
        .where("userId", "=", ALICE)
        .executeTakeFirstOrThrow();
      expect(Number(count.n)).toBe(1);
    });

    it("creates one order when the same request arrives twice at the same moment", async () => {
      const [a, b] = await Promise.all([
        place(alice, undefined, {}, "race-key-123456"),
        place(alice, undefined, {}, "race-key-123456"),
      ]);
      expect(a.json().id).toBe(b.json().id);
      const count = await db
        .selectFrom("orders.orders")
        .select((eb) => eb.fn.countAll<string>().as("n"))
        .where("userId", "=", ALICE)
        .executeTakeFirstOrThrow();
      expect(Number(count.n)).toBe(1);
    });

    it("does not share an Idempotency-Key between two customers", async () => {
      const a = await place(alice, undefined, {}, "shared-key-1234");
      const b = await place(bob, undefined, {}, "shared-key-1234");
      expect(a.json().id).not.toBe(b.json().id);
    });

    it("needs an Idempotency-Key and a signed in customer", async () => {
      const noKey = await app.inject({
        method: "POST",
        url: "/v1/orders",
        headers: alice,
        payload: { items: [{ productId: "p1", quantity: 1 }], address: ADDRESS, payment: "cod" },
      });
      expect(noKey.statusCode).toBe(400);
      const anon = await app.inject({
        method: "POST",
        url: "/v1/orders",
        headers: { "idempotency-key": "abcdefgh12" },
        payload: { items: [{ productId: "p1", quantity: 1 }], address: ADDRESS, payment: "cod" },
      });
      expect(anon.statusCode).toBe(401);
      expect((await place(staff)).statusCode).toBe(403);
    });

    it("adds up the same product sent twice as one line", async () => {
      const res = await place(alice, [
        { productId: "p1", quantity: 1 },
        { productId: "p1", quantity: 2 },
      ]);
      expect(res.json().items).toHaveLength(1);
      expect(res.json().items[0].quantity).toBe(3);
    });

    it("refuses unknown products without holding any stock", async () => {
      const res = await place(alice, [{ productId: "nope", quantity: 1 }]);
      expect(res.statusCode).toBe(409);
      expect(fake.calls.some((c) => c.path === "/internal/reservations")).toBe(false);
    });

    it("explains why an address cannot be served", async () => {
      Object.assign(fake.state, { serviceable: false, reason: "OUTSIDE_SERVICE_AREA" });
      const res = await place();
      expect(res.statusCode).toBe(409);
      expect(res.json().error.message).toMatch(/do not deliver/);
      Object.assign(fake.state, { reason: "ITEMS_UNAVAILABLE" });
      const items = await place();
      expect(items.json().error.details.unavailable).toEqual([
        { productId: "p1", requested: 9, available: 2 },
      ]);
    });

    it("passes on a stock shortage and saves nothing", async () => {
      fake.state.reserveError = new InternalCallError(
        "Some items are no longer available in the quantity requested.",
        409,
        "CONFLICT",
        [{ productId: "p1", requested: 2, available: 1 }],
      );
      const res = await place();
      expect(res.statusCode).toBe(409);
      expect(res.json().error.details).toEqual([{ productId: "p1", requested: 2, available: 1 }]);
      const count = await db
        .selectFrom("orders.orders")
        .select((eb) => eb.fn.countAll<string>().as("n"))
        .where("userId", "=", ALICE)
        .executeTakeFirstOrThrow();
      expect(Number(count.n)).toBe(0);
    });
  });

  describe("who can see an order", () => {
    it("lists only my own orders, and hides others as not found", async () => {
      const mine = (await place(alice)).json();
      await place(bob);
      const list = (await get("/v1/orders", alice)).json();
      expect(list.items.map((o: { id: string }) => o.id)).toEqual([mine.id]);
      expect((await get(`/v1/orders/${mine.id}`, bob)).statusCode).toBe(404);
      expect((await get(`/v1/orders/${mine.id}`, alice)).statusCode).toBe(200);
    });

    it("lets an admin see any order and filter by customer, but not hide the rule from others", async () => {
      const mine = (await place(alice)).json();
      await place(bob);
      expect((await get(`/v1/orders/${mine.id}`, admin)).statusCode).toBe(200);
      const filtered = (await get(`/v1/orders?userId=${BOB}`, admin)).json();
      expect(filtered.items).toHaveLength(1);
      // A customer asking for someone else's orders still gets only their own
      expect((await get(`/v1/orders?userId=${BOB}`, alice)).json().items).toHaveLength(1);
    });

    it("keeps the delivery code from staff, and staff of another warehouse out", async () => {
      const mine = (await place(alice)).json();
      const seen = (await get(`/v1/orders/${mine.id}`, staff)).json();
      expect(seen.deliveryCode).toBeNull();
      expect((await get(`/v1/orders/${mine.id}`, otherStaff)).statusCode).toBe(404);
      expect((await get("/v1/orders/queue", staff)).json().items[0]).not.toHaveProperty(
        "deliveryCode",
      );
    });
  });

  describe("admin overview", () => {
    const manager = as(ADMIN, "warehouse_manager", "wh-noida-62");

    it("lists every order for an admin, with filters, and never the delivery code", async () => {
      const a = (await place(alice)).json();
      await place(bob);
      await post(`/v1/orders/${a.id}/cancel`, alice);
      const all = (await get("/v1/orders/admin", admin)).json().items;
      expect(all.length).toBeGreaterThanOrEqual(2);
      expect(all[0]).not.toHaveProperty("deliveryCode");
      expect(all.find((o: { id: string }) => o.id === a.id).customerName).toBe("Alice");
      const cancelled = (await get("/v1/orders/admin?status=cancelled", admin)).json().items;
      expect(cancelled.every((o: { status: string }) => o.status === "cancelled")).toBe(true);
      expect(cancelled.some((o: { id: string }) => o.id === a.id)).toBe(true);
      expect(
        (await get("/v1/orders/admin?warehouseId=wh-indiranagar", admin)).json().items,
      ).toEqual([]);
    });

    it("limits a manager to their own warehouse and keeps everyone else out", async () => {
      await place(alice);
      expect((await get("/v1/orders/admin", manager)).json().items.length).toBeGreaterThanOrEqual(
        1,
      );
      const other = as(ADMIN, "warehouse_manager", "wh-indiranagar");
      expect((await get("/v1/orders/admin", other)).json().items).toEqual([]);
      expect((await get("/v1/orders/admin", staff)).statusCode).toBe(403);
      expect((await get("/v1/orders/admin", alice)).statusCode).toBe(403);
    });
  });

  describe("reports", () => {
    const WH_A = "wh-rpt-a";
    const WH_B = "wh-rpt-b";
    const summary = (qs: string, headers = admin) => get(`/v1/orders/admin/summary${qs}`, headers);
    const RANGE = "from=2026-11-10&to=2026-11-13";

    const seed = async (
      n: number,
      o: {
        status: string;
        placed: string;
        delivered?: string;
        total: number;
        promised?: number;
        wh?: string;
      },
      items: { id: string; qty: number; unit: number }[],
    ) => {
      const row = await db
        .insertInto("orders.orders")
        .values({
          number: `QC-RPT-${n}`,
          userId: ALICE,
          warehouseId: o.wh ?? WH_A,
          status: o.status,
          paymentMethod: "cod",
          itemTotalPaise: o.total,
          mrpTotalPaise: o.total,
          savingsPaise: 0,
          deliveryFeePaise: 0,
          handlingFeePaise: 0,
          tipPaise: 0,
          totalPaise: o.total,
          promisedMins: o.promised ?? 10,
          deliveryCode: "1234",
          addressTag: "Home",
          addressLine1: "x",
          idempotencyKey: `rpt-${n}-${Date.now()}`,
          placedAt: new Date(o.placed),
          deliveredAt: o.delivered ? new Date(o.delivered) : null,
        })
        .returning("id")
        .executeTakeFirstOrThrow();
      await db
        .insertInto("orders.orderItems")
        .values(
          items.map((i) => ({
            orderId: row.id,
            productId: i.id,
            name: `Product ${i.id}`,
            quantity: i.qty,
            unitPricePaise: i.unit,
            mrpPaise: i.unit,
          })),
        )
        .execute();
    };

    beforeEach(async () => {
      // 23:59 India time on 10 Nov is 18:29 UTC, and 00:01 on 11 Nov is 18:31 UTC
      await seed(
        1,
        {
          status: "delivered",
          placed: "2026-11-10T18:29:00Z",
          delivered: "2026-11-10T18:39:00Z",
          total: 10000,
        },
        [{ id: "pA", qty: 2, unit: 1000 }],
      );
      await seed(
        2,
        {
          status: "delivered",
          placed: "2026-11-10T18:31:00Z",
          delivered: "2026-11-10T18:51:00Z",
          total: 20000,
        },
        [
          { id: "pA", qty: 1, unit: 1000 },
          { id: "pB", qty: 3, unit: 2000 },
        ],
      );
      await seed(3, { status: "cancelled", placed: "2026-11-12T06:00:00Z", total: 5000 }, [
        { id: "pC", qty: 9, unit: 9999 },
      ]);
      await seed(4, { status: "confirmed", placed: "2026-11-12T07:00:00Z", total: 3000 }, [
        { id: "pB", qty: 1, unit: 2000 },
      ]);
      await seed(
        5,
        {
          status: "delivered",
          placed: "2026-11-12T07:00:00Z",
          delivered: "2026-11-12T07:05:00Z",
          total: 7000,
          wh: WH_B,
        },
        [{ id: "pA", qty: 1, unit: 1000 }],
      );
    });

    it("counts, totals and rates for a warehouse", async () => {
      const res = await summary(`?${RANGE}&warehouseId=${WH_A}`);
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toMatchObject({ from: "2026-11-10", to: "2026-11-13", warehouseId: WH_A });
      expect(body.totals).toEqual({
        orders: 4,
        delivered: 2,
        cancelled: 1,
        active: 1,
        gmvPaise: 30000,
        averageOrderPaise: 15000,
        cancelRatePercent: 25,
        averageDeliveryMins: 15,
        onTimePercent: 50, // 10 minutes is on time (exactly the promise), 20 minutes is late
      });
      expect(body.byStatus).toEqual({ delivered: 2, cancelled: 1, confirmed: 1 });
    });

    it("zero fills days and buckets by India local day", async () => {
      const { daily } = (await summary(`?${RANGE}&warehouseId=${WH_A}`)).json();
      expect(daily).toEqual([
        { date: "2026-11-10", orders: 1, gmvPaise: 10000 },
        { date: "2026-11-11", orders: 1, gmvPaise: 20000 },
        { date: "2026-11-12", orders: 2, gmvPaise: 0 },
        { date: "2026-11-13", orders: 0, gmvPaise: 0 },
      ]);
      // The same two orders are split by the India midnight, not the UTC one
      const first = (await summary(`?from=2026-11-10&to=2026-11-10&warehouseId=${WH_A}`)).json();
      const second = (await summary(`?from=2026-11-11&to=2026-11-11&warehouseId=${WH_A}`)).json();
      expect(first.totals.orders).toBe(1);
      expect(first.totals.gmvPaise).toBe(10000);
      expect(second.totals.orders).toBe(1);
      expect(second.totals.gmvPaise).toBe(20000);
    });

    it("ranks top products by revenue and leaves out cancelled orders", async () => {
      const { topProducts } = (await summary(`?${RANGE}&warehouseId=${WH_A}`)).json();
      expect(topProducts).toEqual([
        { productId: "pB", name: "Product pB", quantity: 4, revenuePaise: 8000 },
        { productId: "pA", name: "Product pA", quantity: 3, revenuePaise: 3000 },
      ]);
    });

    it("gives admins a per warehouse split and an empty result for an empty range", async () => {
      const all = (await summary(`?${RANGE}`)).json();
      expect(all.warehouseId).toBeNull();
      const split = Object.fromEntries(
        all.byWarehouse.map((w: { warehouseId: string }) => [w.warehouseId, w]),
      );
      expect(split[WH_A]).toMatchObject({ orders: 4, gmvPaise: 30000 });
      expect(split[WH_B]).toMatchObject({ orders: 1, gmvPaise: 7000 });
      const none = (await summary(`?from=2026-01-01&to=2026-01-03&warehouseId=${WH_A}`)).json();
      expect(none.totals).toMatchObject({
        orders: 0,
        gmvPaise: 0,
        averageOrderPaise: 0,
        cancelRatePercent: 0,
        averageDeliveryMins: null,
        onTimePercent: null,
      });
      expect(none.daily).toHaveLength(3);
      expect(none.topProducts).toEqual([]);
    });

    it("forces a manager to their own warehouse and hides the split", async () => {
      const managerA = as(ADMIN, "warehouse_manager", WH_A);
      const mine = (await summary(`?${RANGE}&warehouseId=${WH_B}`, managerA)).json(); // asks for B, gets A
      expect(mine.warehouseId).toBe(WH_A);
      expect(mine.totals.orders).toBe(4);
      expect(mine.byWarehouse).toEqual([]);
      const managerB = as(ADMIN, "warehouse_manager", WH_B);
      expect((await summary(`?${RANGE}`, managerB)).json().totals.orders).toBe(1);
    });

    it("is closed to customers and staff, and rejects bad ranges", async () => {
      expect((await summary("", alice)).statusCode).toBe(403);
      expect((await summary("", staff)).statusCode).toBe(403);
      expect(
        (await app.inject({ method: "GET", url: "/v1/orders/admin/summary" })).statusCode,
      ).toBe(401);
      expect((await summary("?from=yesterday")).statusCode).toBe(400);
      expect((await summary("?from=2026-11-13&to=2026-11-10")).statusCode).toBe(400);
      expect((await summary("?from=2024-01-01&to=2026-01-01")).statusCode).toBe(400);
      expect((await summary("?from=2026-13-45&to=2026-13-46")).statusCode).toBe(400);
    });

    it("defaults to the last seven days ending today", async () => {
      const { daily, from, to } = (await summary(`?warehouseId=${WH_A}`)).json();
      expect(daily).toHaveLength(7);
      expect(daily[0].date).toBe(from);
      expect(daily[6].date).toBe(to);
    });
  });

  describe("cancelling", () => {
    it("lets the customer cancel before packing, and puts the stock back", async () => {
      const order = (await place()).json();
      const res = await post(`/v1/orders/${order.id}/cancel`, alice, { reason: "Changed my mind" });
      expect(res.json()).toMatchObject({ status: "cancelled", cancelReason: "Changed my mind" });
      expect(fake.calls.some((c) => c.path === `/internal/reservations/${order.id}/restock`)).toBe(
        true,
      );
    });

    it("does not let the customer cancel once packing has started, but an admin can", async () => {
      const order = (await place()).json();
      await post(`/v1/orders/${order.id}/start-packing`, staff);
      const refused = await post(`/v1/orders/${order.id}/cancel`, alice);
      expect(refused.statusCode).toBe(409);
      expect((await post(`/v1/orders/${order.id}/cancel`, admin)).json().status).toBe("cancelled");
    });

    it("does not let another customer cancel it", async () => {
      const order = (await place()).json();
      expect((await post(`/v1/orders/${order.id}/cancel`, bob)).statusCode).toBe(404);
    });
  });

  describe("pick and pack", () => {
    it("shows the queue only for the staff member's own warehouse", async () => {
      await place();
      expect((await get("/v1/orders/queue", staff)).json().items).toHaveLength(1);
      expect((await get("/v1/orders/queue", otherStaff)).json().items).toHaveLength(0);
      expect((await get("/v1/orders/queue", alice)).statusCode).toBe(403);
      expect((await get("/v1/orders/queue", admin)).statusCode).toBe(400);
      expect(
        (await get("/v1/orders/queue?warehouseId=wh-noida-62", admin)).json().items,
      ).toHaveLength(1);
    });

    it("walks confirmed, packing, packed, and asks the delivery service for a rider", async () => {
      const order = (
        await place(alice, [
          { productId: "p1", quantity: 1 },
          { productId: "p2", quantity: 2 },
        ])
      ).json();
      expect((await post(`/v1/orders/${order.id}/start-packing`, staff)).json().status).toBe(
        "packing",
      );

      // Cannot finish with items unticked
      const early = await post(`/v1/orders/${order.id}/packed`, staff);
      expect(early.statusCode).toBe(409);
      expect(early.json().error.details.missing).toEqual(["p1", "p2"]);

      await post(`/v1/orders/${order.id}/items/p1/picked`, staff, { picked: true });
      await post(`/v1/orders/${order.id}/items/p2/picked`, staff, { picked: true });
      expect(
        (await post(`/v1/orders/${order.id}/items/p9/picked`, staff, { picked: true })).statusCode,
      ).toBe(404);

      const packed = await post(`/v1/orders/${order.id}/packed`, staff);
      expect(packed.json().status).toBe("packed");
      const created = fake.calls.find((c) => c.path === "/internal/deliveries")?.body as Record<
        string,
        unknown
      >;
      expect(created).toMatchObject({
        orderId: order.id,
        orderNumber: order.number,
        warehouseId: "wh-noida-62",
        codPaise: order.totalPaise,
        deliveryCode: order.deliveryCode,
        etaMins: 11,
        customer: { name: "Alice", phone: "+919999000001" },
      });
      expect(created.items).toHaveLength(2);
    });

    it("cannot pick before packing starts, or start another warehouse's order", async () => {
      const order = (await place()).json();
      expect(
        (await post(`/v1/orders/${order.id}/items/p1/picked`, staff, { picked: true })).statusCode,
      ).toBe(409);
      expect((await post(`/v1/orders/${order.id}/start-packing`, otherStaff)).statusCode).toBe(404);
      expect((await post(`/v1/orders/${order.id}/start-packing`, alice)).statusCode).toBe(403);
    });

    it("keeps an order packed if no rider could be requested, and retries safely", async () => {
      const order = (await place()).json();
      await post(`/v1/orders/${order.id}/start-packing`, staff);
      await post(`/v1/orders/${order.id}/items/p1/picked`, staff, { picked: true });
      fake.state.deliveryDown = true;
      expect((await post(`/v1/orders/${order.id}/packed`, staff)).statusCode).toBe(503);
      expect((await get(`/v1/orders/${order.id}`, alice)).json().status).toBe("packed");
      fake.state.deliveryDown = false;
      expect((await post(`/v1/orders/${order.id}/packed`, staff)).statusCode).toBe(200);
    });
  });

  describe("internal transitions from delivery", () => {
    const readyForPickup = async () => {
      const order = (await place()).json();
      await post(`/v1/orders/${order.id}/start-packing`, staff);
      await post(`/v1/orders/${order.id}/items/p1/picked`, staff, { picked: true });
      await post(`/v1/orders/${order.id}/packed`, staff);
      return order;
    };
    const move = (id: string, to: string, extra: object = {}) =>
      app.inject({
        method: "POST",
        url: `/internal/orders/${id}/transition`,
        payload: { to, actorId: RIDER, actorRole: "rider", ...extra },
      });

    it("follows the state machine to delivered, stamping each time and attaching the rider", async () => {
      const order = await readyForPickup();
      expect((await move(order.id, "picked_up", { riderId: RIDER })).statusCode).toBe(200);
      expect((await move(order.id, "out_for_delivery")).statusCode).toBe(200);
      const done = (await move(order.id, "delivered")).json();
      expect(done.status).toBe("delivered");
      expect(done.pickedUpAt).toBeTruthy();
      expect(done.deliveredAt).toBeTruthy();
      expect(done.rider).toEqual({ name: "Ravi Kumar", phone: "+919810000011", rating: 4.8 });
      const history = await db
        .selectFrom("orders.orderStatusHistory")
        .select(["fromStatus", "toStatus", "actorRole"])
        .where("orderId", "=", order.id)
        .orderBy("id")
        .execute();
      expect(history.map((h) => h.toStatus)).toEqual([
        "confirmed",
        "packing",
        "packed",
        "picked_up",
        "out_for_delivery",
        "delivered",
      ]);
    });

    it("refuses jumps, and repeating a step is harmless", async () => {
      const order = await readyForPickup();
      expect((await move(order.id, "delivered")).statusCode).toBe(409);
      expect((await move(order.id, "picked_up", { riderId: RIDER })).statusCode).toBe(200);
      expect((await move(order.id, "picked_up")).statusCode).toBe(200);
      const history = await db
        .selectFrom("orders.orderStatusHistory")
        .select("toStatus")
        .where("orderId", "=", order.id)
        .where("toStatus", "=", "picked_up")
        .execute();
      expect(history).toHaveLength(1);
    });

    it("does not allow anything after delivery or cancellation", async () => {
      const order = await readyForPickup();
      await move(order.id, "picked_up", { riderId: RIDER });
      await move(order.id, "out_for_delivery");
      await move(order.id, "delivered");
      expect((await move(order.id, "cancelled")).statusCode).toBe(409);
      expect((await move(order.id, "packing")).statusCode).toBe(409);
    });

    it("lets only one of two simultaneous different moves win", async () => {
      const order = (await place()).json();
      const [a, b] = await Promise.all([
        post(`/v1/orders/${order.id}/start-packing`, staff),
        post(`/v1/orders/${order.id}/cancel`, alice),
      ]);
      expect([a.statusCode, b.statusCode].sort()).toEqual([200, 409]);
      const final = (await get(`/v1/orders/${order.id}`, alice)).json();
      expect(["packing", "cancelled"]).toContain(final.status);
    });
  });
});
