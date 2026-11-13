import { DEV_INTERNAL_KEY, createDb, signIdentityHeaders } from "@qc/service-kit";
import type { InternalClient } from "@qc/service-kit";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app";
import type { DB } from "../../src/db/types.generated";
import type { Clients } from "../../src/modules/orders/clients";

// Runs only with a migrated test database (see scripts/db-migrate.mjs)
const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

// Own users and a ZZ code prefix, so this file never collides with the other order tests
const CARA = "eeeeeeee-0000-4000-8000-00000000000e";
const DEV = "ffffffff-0000-4000-8000-00000000000f";
const ADMIN = "dddddddd-0000-4000-8000-00000000000d";
const PRODUCTS: Record<string, number> = { p1: 3000, p2: 4500, p3: 25_000 };
const ADDRESS = { tag: "Home", line1: "12 Park Road", lat: 28.62, lng: 77.36 };

function fakeClients(): { clients: Clients; restocked: string[] } {
  const restocked: string[] = [];
  const make = (handler: (path: string) => unknown): InternalClient => ({
    get: async (path) => handler(path) as never,
    post: async (path) => {
      if (path.endsWith("/restock")) restocked.push(path);
      return handler(path) as never;
    },
  });
  return {
    restocked,
    clients: {
      catalog: make((path) => {
        const ids = new URL(path, "http://x").searchParams.get("ids")?.split(",") ?? [];
        return {
          items: ids
            .filter((id) => PRODUCTS[id])
            .map((id) => ({
              id,
              name: id,
              unit: "1 pc",
              emoji: "x",
              imageUrl: null,
              pricePaise: PRODUCTS[id],
              mrpPaise: PRODUCTS[id],
            })),
        };
      }),
      inventory: make((path) =>
        path === "/internal/serviceability/resolve"
          ? {
              serviceable: true,
              warehouseId: "wh-noida-62",
              etaMins: 11,
              distanceKm: 1,
              reason: null,
              unavailable: [],
            }
          : { id: "r", status: "ok" },
      ),
      payment: make(() => ({ items: [] })),
      delivery: make(() => ({ ok: true })),
      identity: make(() => ({ name: "Cara", phone: "+919999000009" })),
    },
  };
}

suite("coupons", async () => {
  const db = createDb<DB>(url as string, 8);
  const fake = fakeClients();
  const app = await buildApp({ db, clients: fake.clients });
  const as = (userId: string, role: string) =>
    signIdentityHeaders({ userId, role: role as never, warehouseId: null }, DEV_INTERNAL_KEY);
  const cara = as(CARA, "customer");
  const dev = as(DEV, "customer");
  const admin = as(ADMIN, "admin");

  let n = 0;
  const place = (
    headers: Record<string, string>,
    extra: object = {},
    items = [{ productId: "p3", quantity: 1 }],
  ) =>
    app.inject({
      method: "POST",
      url: "/v1/orders",
      headers: { ...headers, "idempotency-key": `coupon-${++n}-${Date.now()}` },
      payload: { items, address: ADDRESS, payment: "cod", ...extra },
    });
  const validate = (
    headers: Record<string, string>,
    code: string,
    items = [{ productId: "p3", quantity: 1 }],
  ) =>
    app.inject({
      method: "POST",
      url: "/v1/orders/coupons/validate",
      headers,
      payload: { code, items },
    });
  const create = (body: object) =>
    app.inject({ method: "POST", url: "/v1/orders/admin/coupons", headers: admin, payload: body });

  beforeEach(async () => {
    await db.deleteFrom("orders.orders").where("userId", "in", [CARA, DEV]).execute();
    await db.deleteFrom("orders.coupons").where("code", "like", "ZZ%").execute();
  });
  afterAll(async () => {
    await db.deleteFrom("orders.orders").where("userId", "in", [CARA, DEV]).execute();
    await db.deleteFrom("orders.coupons").where("code", "like", "ZZ%").execute();
    await app.close();
    await db.destroy();
  });

  describe("admin", () => {
    it("creates, lists with usage, edits and deactivates a coupon", async () => {
      const res = await create({
        code: "zzflat50",
        title: "₹50 off",
        type: "flat",
        value: 5000,
        minOrderPaise: 19_900,
      });
      expect(res.statusCode).toBe(201);
      const coupon = res.json();
      expect(coupon).toMatchObject({
        code: "ZZFLAT50",
        state: "live",
        redemptions: 0,
        usageLimitPerUser: 1,
      });
      await place(cara, { couponCode: "ZZFLAT50" });
      const listed = (
        await app.inject({ method: "GET", url: "/v1/orders/admin/coupons", headers: admin })
      ).json();
      expect(listed.items.find((c: { id: string }) => c.id === coupon.id)).toMatchObject({
        redemptions: 1,
        discountGivenPaise: 5000,
      });
      const edited = await app.inject({
        method: "PATCH",
        url: `/v1/orders/admin/coupons/${coupon.id}`,
        headers: admin,
        payload: { title: "Fifty off" },
      });
      expect(edited.json().title).toBe("Fifty off");
      const off = await app.inject({
        method: "POST",
        url: `/v1/orders/admin/coupons/${coupon.id}/deactivate`,
        headers: admin,
      });
      expect(off.json()).toMatchObject({ active: false, state: "inactive" });
    });

    it("refuses a duplicate code (ignoring case) and bad values with clear messages", async () => {
      await create({ code: "ZZDUP", title: "x", type: "flat", value: 100 });
      const dup = await create({ code: "zzdup", title: "y", type: "flat", value: 100 });
      expect(dup.statusCode).toBe(409);
      expect(dup.json().error.message).toMatch(/already exists/);
      expect(
        (await create({ code: "ZZPCT", title: "x", type: "percent", value: 150 })).statusCode,
      ).toBe(400);
      const pct = (await create({ code: "ZZPCT2", title: "x", type: "percent", value: 10 })).json();
      const toFlat = await app.inject({
        method: "PATCH",
        url: `/v1/orders/admin/coupons/${pct.id}`,
        headers: admin,
        payload: { type: "percent", value: 0 },
      });
      expect(toFlat.statusCode).toBe(400);
    });

    it("is closed to everyone but admins", async () => {
      expect(
        (await app.inject({ method: "GET", url: "/v1/orders/admin/coupons", headers: cara }))
          .statusCode,
      ).toBe(403);
      expect(
        (
          await app.inject({
            method: "POST",
            url: "/v1/orders/admin/coupons",
            headers: cara,
            payload: { code: "ZZX", title: "x", type: "flat", value: 1 },
          })
        ).statusCode,
      ).toBe(403);
    });
  });

  describe("checking a code", () => {
    it("prices the cart with the discount", async () => {
      await create({
        code: "ZZTEN",
        title: "10% off",
        type: "percent",
        value: 10,
        maxDiscountPaise: 2000,
      });
      const res = (await validate(cara, "zzten")).json();
      expect(res).toMatchObject({
        valid: true,
        reason: null,
        price: { discountPaise: 2000, itemTotalPaise: 25_000 },
      });
      expect(res.price.totalPaise).toBe(25_000 + 500 - 2000);
    });

    it("explains every reason it does not apply", async () => {
      const day = 86_400_000;
      await create({
        code: "ZZOLD",
        title: "x",
        type: "flat",
        value: 100,
        startsAt: new Date(Date.now() - 3 * day).toISOString(),
        endsAt: new Date(Date.now() - day).toISOString(),
      });
      await create({
        code: "ZZSOON",
        title: "x",
        type: "flat",
        value: 100,
        startsAt: new Date(Date.now() + day).toISOString(),
      });
      await create({ code: "ZZMIN", title: "x", type: "flat", value: 100, minOrderPaise: 50_000 });
      await create({ code: "ZZOFF", title: "x", type: "flat", value: 100, active: false });
      await create({ code: "ZZFREE", title: "x", type: "free_delivery", value: 0 });
      const reason = async (code: string) => (await validate(cara, code)).json().reason as string;
      expect(await reason("ZZNOPE")).toMatch(/does not exist/);
      expect(await reason("ZZOLD")).toMatch(/expired/);
      expect(await reason("ZZSOON")).toMatch(/starts on/);
      expect(await reason("ZZMIN")).toMatch(/Add ₹250 more/);
      expect(await reason("ZZOFF")).toMatch(/not active/);
      // ₹250 of items already ships free
      expect(await reason("ZZFREE")).toMatch(/already free/);
      const invalid = (await validate(cara, "ZZMIN")).json();
      expect(invalid).toMatchObject({ valid: false, price: { discountPaise: 0 } });
    });

    it("lists the offers a customer can see, usable ones first", async () => {
      await create({
        code: "ZZFIRST",
        title: "First order",
        type: "flat",
        value: 100,
        firstOrderOnly: true,
      });
      await create({ code: "ZZANY", title: "Anyone", type: "flat", value: 100 });
      await place(cara);
      const offers = (
        await app.inject({ method: "GET", url: "/v1/orders/coupons/available", headers: cara })
      ).json().items;
      const mine = offers.filter((o: { code: string }) => o.code.startsWith("ZZ"));
      expect(mine[0]).toMatchObject({ code: "ZZANY", eligible: true });
      expect(mine.find((o: { code: string }) => o.code === "ZZFIRST")).toMatchObject({
        eligible: false,
        reason: expect.stringMatching(/first order/),
      });
    });
  });

  describe("placing an order with a code", () => {
    it("charges the discounted total and records the use", async () => {
      await create({ code: "ZZFLAT", title: "x", type: "flat", value: 5000 });
      const order = (await place(cara, { couponCode: "zzflat" })).json();
      expect(order).toMatchObject({
        couponCode: "ZZFLAT",
        discountPaise: 5000,
        totalPaise: 25_000 + 500 - 5000,
      });
      const used = await db
        .selectFrom("orders.couponRedemptions")
        .selectAll()
        .where("orderId", "=", order.id)
        .executeTakeFirstOrThrow();
      expect(used).toMatchObject({ userId: CARA, discountPaise: 5000 });
    });

    it("waives delivery with a free delivery code", async () => {
      await create({ code: "ZZSHIP", title: "x", type: "free_delivery", value: 0 });
      const order = (
        await place(cara, { couponCode: "ZZSHIP" }, [{ productId: "p1", quantity: 1 }])
      ).json();
      expect(order).toMatchObject({
        deliveryFeePaise: 0,
        discountPaise: 0,
        totalPaise: 3000 + 500,
      });
    });

    it("never takes a discount from the client", async () => {
      const res = await place(cara, { discountPaise: 20_000, totalPaise: 1 });
      expect(res.json()).toMatchObject({ discountPaise: 0, totalPaise: 25_500, couponCode: null });
    });

    it("refuses a used, first order or unknown code without holding stock or saving an order", async () => {
      await create({ code: "ZZONCE", title: "x", type: "flat", value: 100 });
      await create({ code: "ZZNEW", title: "x", type: "flat", value: 100, firstOrderOnly: true });
      expect((await place(cara, { couponCode: "ZZONCE" })).statusCode).toBe(201);
      const again = await place(cara, { couponCode: "ZZONCE" });
      expect(again.statusCode).toBe(409);
      expect(again.json().error.message).toMatch(/already used/);
      expect((await place(cara, { couponCode: "ZZNEW" })).json().error.message).toMatch(
        /first order/,
      );
      expect((await place(cara, { couponCode: "ZZGHOST" })).statusCode).toBe(409);
      const orders = await db
        .selectFrom("orders.orders")
        .select("id")
        .where("userId", "=", CARA)
        .execute();
      expect(orders).toHaveLength(1);
    });

    it("gives the use back when the order is cancelled", async () => {
      await create({ code: "ZZBACK", title: "x", type: "flat", value: 100 });
      const order = (await place(cara, { couponCode: "ZZBACK" })).json();
      const cancel = await app.inject({
        method: "POST",
        url: `/v1/orders/${order.id}/cancel`,
        headers: cara,
        payload: {},
      });
      expect(cancel.statusCode).toBe(200);
      expect((await place(cara, { couponCode: "ZZBACK" })).statusCode).toBe(201);
    });

    it("lets only one of two customers racing for the last use win", async () => {
      await create({ code: "ZZLAST", title: "x", type: "flat", value: 100, usageLimitTotal: 1 });
      const [a, b] = await Promise.all([
        place(cara, { couponCode: "ZZLAST" }),
        place(dev, { couponCode: "ZZLAST" }),
      ]);
      expect([a.statusCode, b.statusCode].sort()).toEqual([201, 409]);
      const loser = a.statusCode === 409 ? a : b;
      expect(loser.json().error.message).toMatch(/fully used/);
      const uses = await db
        .selectFrom("orders.couponRedemptions as r")
        .innerJoin("orders.coupons as c", "c.id", "r.couponId")
        .select("r.id")
        .where("c.code", "=", "ZZLAST")
        .execute();
      expect(uses).toHaveLength(1);
    });

    it("lets one customer use a code only as often as allowed, even all at once", async () => {
      await create({ code: "ZZTWICE", title: "x", type: "flat", value: 100, usageLimitPerUser: 2 });
      const results = await Promise.all(
        [1, 2, 3].map(() => place(cara, { couponCode: "ZZTWICE" })),
      );
      expect(results.filter((r) => r.statusCode === 201)).toHaveLength(2);
    });
  });
});
