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

// Runs only with a migrated test database (see scripts/db-migrate.mjs)
const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

const R1 = "11110000-0000-4000-8000-000000000001";
const R2 = "11110000-0000-4000-8000-000000000002";
const R3 = "11110000-0000-4000-8000-000000000003"; // another warehouse
const STAFF_ID = "22220000-0000-4000-8000-000000000001";
const ORDER_A = "33330000-0000-4000-8000-00000000000a";
const ORDER_B = "33330000-0000-4000-8000-00000000000b";
const IDS = [R1, R2, R3];

const RIDERS = [
  {
    id: R1,
    name: "Ravi Kumar",
    phone: "+919810000011",
    vehicle: "Bike",
    rating: 4.8,
    warehouseId: "wh-noida-62",
  },
  {
    id: R2,
    name: "Imran Ali",
    phone: "+919810000012",
    vehicle: "Scooter",
    rating: 4.6,
    warehouseId: "wh-noida-62",
  },
  {
    id: R3,
    name: "Far Away",
    phone: "+919810000013",
    vehicle: "Bike",
    rating: 4.1,
    warehouseId: "wh-indiranagar",
  },
];

const order = (orderId: string, number: string, warehouseId = "wh-noida-62") => ({
  orderId,
  orderNumber: number,
  warehouseId,
  store: { name: "Tokajo Noida 62", address: "Sector 62, Noida", lat: 28.61, lng: 77.35 },
  customer: {
    name: "Alice",
    phone: "+919999000001",
    address: "12 Park Road, Sector 62",
    lat: 28.62,
    lng: 77.36,
    instructions: "Ring twice",
  },
  items: [
    { id: "p1", name: "Milk", quantity: 2, emoji: "x" },
    { id: "p2", name: "Bread", quantity: 1, emoji: "y" },
  ],
  distanceKm: 1.5,
  etaMins: 11,
  tipPaise: 2000,
  codPaise: 9400,
  deliveryCode: "4321",
});

suite("delivery service", async () => {
  const db = createDb<DB>(url as string, 5);
  let clock = new Date("2026-11-13T10:00:00.000Z");
  const orderCalls: { path: string; body: Record<string, unknown> }[] = [];
  const failure = { order: null as InternalCallError | null };
  const orderClient: InternalClient = {
    get: async () => ({}) as never,
    post: async (path, body) => {
      if (failure.order) throw failure.order;
      orderCalls.push({ path, body: body as Record<string, unknown> });
      return {} as never;
    },
  };
  const identityClient: InternalClient = {
    get: async (path) => {
      const url = new URL(path, "http://x");
      const wanted = url.searchParams.get("ids")?.split(",");
      const warehouse = url.searchParams.get("warehouseId");
      return {
        items: RIDERS.filter((r) =>
          wanted ? wanted.includes(r.id) : warehouse ? r.warehouseId === warehouse : true,
        ),
      } as never;
    },
    post: async () => ({}) as never,
  };
  const app = await buildApp({
    db,
    clients: { order: orderClient, identity: identityClient },
    now: () => clock,
  });

  const as = (userId: string, role: string, warehouseId: string | null) =>
    signIdentityHeaders({ userId, role: role as never, warehouseId }, DEV_INTERNAL_KEY);
  const rider = (id: string) =>
    as(id, "rider", RIDERS.find((r) => r.id === id)?.warehouseId ?? null);
  const staff = as(STAFF_ID, "warehouse_staff", "wh-noida-62");
  const admin = as(STAFF_ID, "admin", null);

  const create = (body: object) =>
    app.inject({ method: "POST", url: "/internal/deliveries", payload: body });
  const state = async (id: string) =>
    (await app.inject({ method: "GET", url: "/v1/delivery/me", headers: rider(id) })).json();
  const online = (id: string, value = true) =>
    app.inject({
      method: "POST",
      url: "/v1/delivery/me/online",
      headers: rider(id),
      payload: { online: value },
    });
  const act = (id: string, deliveryId: string, action: object) =>
    app.inject({
      method: "POST",
      url: `/v1/delivery/${deliveryId}/actions`,
      headers: rider(id),
      payload: action,
    });
  const handovers = async (headers = staff) =>
    (await app.inject({ method: "GET", url: "/v1/delivery/handovers", headers })).json();

  /** Creates a delivery and returns its id and the handover code the warehouse would show. */
  const makeDelivery = async (orderId = ORDER_A, number = "QC-1") => {
    const res = await create(order(orderId, number));
    expect(res.statusCode).toBe(200);
    const row = await db
      .selectFrom("delivery.deliveries")
      .select(["id", "handoverCode"])
      .where("orderId", "=", orderId)
      .executeTakeFirstOrThrow();
    return { id: row.id, handoverCode: row.handoverCode };
  };
  const toAssigned = async (riderId = R1) => {
    const d = await makeDelivery();
    await online(riderId);
    await act(riderId, d.id, { type: "accept" });
    return d;
  };

  beforeEach(async () => {
    clock = new Date("2026-11-13T10:00:00.000Z");
    orderCalls.length = 0;
    failure.order = null;
    await db.deleteFrom("delivery.deliveries").where("orderId", "in", [ORDER_A, ORDER_B]).execute();
    await db.deleteFrom("delivery.riderState").where("riderId", "in", IDS).execute();
  });
  afterAll(async () => {
    await db.deleteFrom("delivery.deliveries").where("orderId", "in", [ORDER_A, ORDER_B]).execute();
    await db.deleteFrom("delivery.riderState").where("riderId", "in", IDS).execute();
    await app.close();
    await db.destroy();
  });

  describe("creating", () => {
    it("is idempotent on the order and works out the payout", async () => {
      const a = (await create(order(ORDER_A, "QC-1"))).json();
      const b = (await create(order(ORDER_A, "QC-1"))).json();
      expect(b.id).toBe(a.id);
      const row = await db
        .selectFrom("delivery.deliveries")
        .selectAll()
        .where("orderId", "=", ORDER_A)
        .executeTakeFirstOrThrow();
      expect(row.payoutPaise).toBe(4200); // 30 rupees plus 8 a km
      expect(row.handoverCode).toMatch(/^\d{4}$/);
      expect(row.status).toBe("unassigned");
    });

    it("rejects a malformed delivery code", async () => {
      expect((await create({ ...order(ORDER_A, "QC-1"), deliveryCode: "12" })).statusCode).toBe(
        400,
      );
    });
  });

  describe("dispatch", () => {
    it("offers nothing to an offline rider, and an offer to an online one", async () => {
      await makeDelivery();
      expect((await state(R1)).active).toBeNull();
      const s = (await online(R1)).json();
      expect(s.online).toBe(true);
      expect(s.active).toMatchObject({
        orderNumber: "QC-1",
        status: "offered",
        payoutPaise: 4200,
        tipPaise: 2000,
        codPaise: 9400,
      });
    });

    it("never sends the rider the delivery code or the handover code", async () => {
      await makeDelivery();
      const s = (await online(R1)).json();
      const text = JSON.stringify(s);
      expect(text).not.toContain("4321");
      expect(s.active).not.toHaveProperty("deliveryCode");
      expect(s.active).not.toHaveProperty("handoverCode");
    });

    it("offers a delivery to only one rider when two ask at once", async () => {
      await makeDelivery();
      await db
        .insertInto("delivery.riderState")
        .values([
          { riderId: R1, online: true },
          { riderId: R2, online: true },
        ])
        .execute();
      const [a, b] = await Promise.all([state(R1), state(R2)]);
      expect([a.active, b.active].filter(Boolean)).toHaveLength(1);
    });

    it("keeps riders of other warehouses out of it", async () => {
      await makeDelivery();
      expect((await online(R3)).json().active).toBeNull();
    });

    it("passes an unanswered offer on to the next rider", async () => {
      await makeDelivery();
      await online(R1);
      await online(R2);
      expect((await state(R1)).active).not.toBeNull();
      expect((await state(R2)).active).toBeNull();
      clock = new Date(clock.getTime() + 30_000);
      expect((await state(R2)).active).not.toBeNull();
      expect((await state(R1)).active).toBeNull();
    });

    it("refuses to accept an offer that ran out", async () => {
      const d = await makeDelivery();
      await online(R1);
      clock = new Date(clock.getTime() + 30_000);
      const res = await act(R1, d.id, { type: "accept" });
      expect(res.statusCode).toBe(409);
      expect(res.json().error.details.reason).toBe("OFFER_EXPIRED");
    });

    it("passes a declined offer on, and offers it back to the decliner only after a while", async () => {
      const d = await makeDelivery();
      await online(R1);
      await online(R2);
      expect((await act(R1, d.id, { type: "decline" })).json().active).toBeNull();
      expect((await state(R2)).active?.id).toBe(d.id);
      await act(R2, d.id, { type: "decline" });
      // Both declined: nobody gets it straight away
      expect((await state(R1)).active).toBeNull();
      clock = new Date(clock.getTime() + 61_000);
      expect((await state(R1)).active?.id).toBe(d.id);
    });

    it("gives an offer back to the pool when the rider goes offline", async () => {
      await makeDelivery();
      await online(R1);
      await online(R1, false);
      expect((await online(R2)).json().active).not.toBeNull();
    });
  });

  describe("the delivery flow", () => {
    it("moves step by step and tells the order service", async () => {
      const d = await toAssigned();
      expect((await act(R1, d.id, { type: "arrive_store" })).json().active.status).toBe("at_store");
      const picked = await act(R1, d.id, {
        type: "pick_up",
        checkedItemIds: ["p1", "p2"],
        handoverCode: d.handoverCode,
      });
      expect(picked.json().active.status).toBe("picked_up");
      expect(orderCalls.map((c) => [c.path, c.body.to])).toEqual([
        [`/internal/orders/${ORDER_A}/transition`, "picked_up"],
        [`/internal/orders/${ORDER_A}/transition`, "out_for_delivery"],
      ]);
      expect(orderCalls[0]?.body).toMatchObject({ riderId: R1, actorRole: "rider" });
      await act(R1, d.id, { type: "arrive_customer" });
      const done = await act(R1, d.id, { type: "deliver", code: "4321" });
      expect(done.json().active).toBeNull();
      expect(done.json().history).toHaveLength(1);
      expect(done.json().history[0]).toMatchObject({
        orderNumber: "QC-1",
        status: "delivered",
        payoutPaise: 4200,
        tipPaise: 2000,
      });
      expect(orderCalls.at(-1)?.body.to).toBe("delivered");
    });

    it("will not skip a step", async () => {
      const d = await toAssigned();
      const skip = await act(R1, d.id, { type: "arrive_customer" });
      expect(skip.statusCode).toBe(409);
      expect(skip.json().error.details.reason).toBe("INVALID_TRANSITION");
      expect((await act(R1, d.id, { type: "deliver", code: "4321" })).statusCode).toBe(409);
    });

    it("needs every item checked and the right handover code to leave the store", async () => {
      const d = await toAssigned();
      await act(R1, d.id, { type: "arrive_store" });
      const unchecked = await act(R1, d.id, {
        type: "pick_up",
        checkedItemIds: ["p1"],
        handoverCode: d.handoverCode,
      });
      expect(unchecked.json().error.details.reason).toBe("ITEMS_NOT_CHECKED");
      const wrong = await act(R1, d.id, {
        type: "pick_up",
        checkedItemIds: ["p1", "p2"],
        handoverCode: d.handoverCode === "0000" ? "1111" : "0000",
      });
      expect(wrong.json().error.details.reason).toBe("WRONG_CODE");
      expect(orderCalls).toHaveLength(0);
    });

    it("locks the handover after five wrong codes, even for the right one", async () => {
      const d = await toAssigned();
      await act(R1, d.id, { type: "arrive_store" });
      const bad = d.handoverCode === "0000" ? "1111" : "0000";
      for (let i = 0; i < 5; i += 1) {
        await act(R1, d.id, { type: "pick_up", checkedItemIds: ["p1", "p2"], handoverCode: bad });
      }
      const res = await act(R1, d.id, {
        type: "pick_up",
        checkedItemIds: ["p1", "p2"],
        handoverCode: d.handoverCode,
      });
      expect(res.statusCode).toBe(429);
      expect(res.json().error.details.reason).toBe("CODE_LOCKED");
    });

    it("checks the customer's code on the server, and locks after five wrong tries", async () => {
      const d = await toAssigned();
      await act(R1, d.id, { type: "arrive_store" });
      await act(R1, d.id, {
        type: "pick_up",
        checkedItemIds: ["p1", "p2"],
        handoverCode: d.handoverCode,
      });
      await act(R1, d.id, { type: "arrive_customer" });
      const wrong = await act(R1, d.id, { type: "deliver", code: "0000" });
      expect(wrong.statusCode).toBe(409);
      expect(wrong.json().error.details.reason).toBe("WRONG_CODE");
      expect(orderCalls.some((c) => c.body.to === "delivered")).toBe(false);
      for (let i = 0; i < 4; i += 1) await act(R1, d.id, { type: "deliver", code: "0000" });
      expect((await act(R1, d.id, { type: "deliver", code: "4321" })).statusCode).toBe(429);
    });

    it("does not advance when the order service cannot be updated", async () => {
      const d = await toAssigned();
      await act(R1, d.id, { type: "arrive_store" });
      failure.order = new InternalCallError("down", 0, "SERVICE_UNAVAILABLE");
      const res = await act(R1, d.id, {
        type: "pick_up",
        checkedItemIds: ["p1", "p2"],
        handoverCode: d.handoverCode,
      });
      expect(res.statusCode).toBe(503);
      failure.order = null;
      expect((await state(R1)).active.status).toBe("at_store");
      expect(
        (
          await act(R1, d.id, {
            type: "pick_up",
            checkedItemIds: ["p1", "p2"],
            handoverCode: d.handoverCode,
          })
        ).statusCode,
      ).toBe(200);
    });

    it("does not let a rider touch someone else's delivery", async () => {
      const d = await toAssigned(R1);
      expect((await act(R2, d.id, { type: "arrive_store" })).statusCode).toBe(404);
      expect((await act(R2, d.id, { type: "accept" })).statusCode).toBe(404);
    });

    it("will not go offline mid delivery", async () => {
      await toAssigned();
      const res = await online(R1, false);
      expect(res.statusCode).toBe(409);
    });

    it("stops a cancelled order's delivery", async () => {
      const d = await makeDelivery();
      await online(R1);
      await app.inject({ method: "POST", url: `/internal/deliveries/by-order/${ORDER_A}/cancel` });
      const row = await db
        .selectFrom("delivery.deliveries")
        .select("status")
        .where("id", "=", d.id)
        .executeTakeFirstOrThrow();
      expect(row.status).toBe("cancelled");
      expect((await state(R1)).active).toBeNull();
    });
  });

  describe("access", () => {
    it("keeps rider routes for riders", async () => {
      for (const headers of [staff, admin]) {
        expect(
          (await app.inject({ method: "GET", url: "/v1/delivery/me", headers })).statusCode,
        ).toBe(403);
      }
      expect((await app.inject({ method: "GET", url: "/v1/delivery/me" })).statusCode).toBe(401);
    });

    it("shows the warehouse its own handovers with the code and the rider", async () => {
      const d = await makeDelivery(ORDER_A, "QC-1");
      await create(order(ORDER_B, "QC-2", "wh-indiranagar"));
      let list = (await handovers()).items;
      expect(list).toHaveLength(1);
      expect(list[0]).toMatchObject({
        orderNumber: "QC-1",
        status: "unassigned",
        itemCount: 3,
        rider: null,
        handoverCode: d.handoverCode,
      });
      await online(R1);
      list = (await handovers()).items;
      expect(list[0]).toMatchObject({ status: "offered", rider: { name: "Ravi Kumar" } });
      expect(
        (await app.inject({ method: "GET", url: "/v1/delivery/handovers", headers: rider(R1) }))
          .statusCode,
      ).toBe(403);
      expect(
        (await app.inject({ method: "GET", url: "/v1/delivery/handovers", headers: admin }))
          .statusCode,
      ).toBe(400);
    });

    it("lists riders with live status for admins and managers only", async () => {
      await toAssigned(R1);
      await online(R2);
      const res = await app.inject({
        method: "GET",
        url: "/v1/delivery/admin/riders",
        headers: admin,
      });
      const byName = Object.fromEntries(
        res.json().items.map((r: { name: string; status: string }) => [r.name, r.status]),
      );
      expect(byName).toMatchObject({
        "Ravi Kumar": "on_delivery",
        "Imran Ali": "online",
        "Far Away": "offline",
      });
      expect(
        (await app.inject({ method: "GET", url: "/v1/delivery/admin/riders", headers: staff }))
          .statusCode,
      ).toBe(403);
    });
  });
});
