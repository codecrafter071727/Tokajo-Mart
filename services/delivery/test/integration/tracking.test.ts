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
import { createMemoryPodStorage } from "../../src/modules/delivery/pod-storage";

// Runs only with a migrated test database (see scripts/db-migrate.mjs)
const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

const RIDER = "44440000-0000-4000-8000-000000000001";
const OTHER_RIDER = "44440000-0000-4000-8000-000000000002";
const CUSTOMER = "55550000-0000-4000-8000-000000000001";
const STRANGER = "55550000-0000-4000-8000-000000000002";
const STAFF = "66660000-0000-4000-8000-000000000001";
const ORDER = "77770000-0000-4000-8000-00000000000a";
const ORDER_FAR = "77770000-0000-4000-8000-00000000000b";

const STORE = { lat: 28.61, lng: 77.35 };
const HOME = { lat: 28.62, lng: 77.36 };

/** A tiny valid JPEG header padded to a believable size */
const jpeg = (size = 2000) => {
  const bytes = Buffer.alloc(size, 0x11);
  bytes[0] = 0xff;
  bytes[1] = 0xd8;
  bytes[2] = 0xff;
  return bytes.toString("base64");
};

suite("live location, tracking and the door photo", async () => {
  const db = createDb<DB>(url as string, 5);
  let clock = new Date("2026-11-13T10:00:00.000Z");
  const orders = new Map<string, { id: string; userId: string; status: string }>();
  const orderClient: InternalClient = {
    get: async (path) => {
      const id = /\/internal\/orders\/([^/]+)\/payment-info/.exec(path)?.[1] ?? "";
      const info = orders.get(id);
      if (!info) throw new InternalCallError("Order not found.", 404, "NOT_FOUND");
      return info as never;
    },
    post: async () => ({}) as never,
  };
  const identityClient: InternalClient = {
    get: async () => ({ items: [] }) as never,
    post: async () => ({}) as never,
  };
  const storage = createMemoryPodStorage();
  const app = await buildApp({
    db,
    clients: { order: orderClient, identity: identityClient },
    now: () => clock,
    podStorage: storage,
  });

  const as = (userId: string, role: string, warehouseId: string | null = null) =>
    signIdentityHeaders({ userId, role: role as never, warehouseId }, DEV_INTERNAL_KEY);
  const rider = as(RIDER, "rider", "wh-noida-62");
  const customer = as(CUSTOMER, "customer");
  const stranger = as(STRANGER, "customer");
  const admin = as(STAFF, "admin");
  const manager = as(STAFF, "warehouse_manager", "wh-noida-62");
  const otherManager = as(STAFF, "warehouse_manager", "wh-indiranagar");

  const ago = (ms: number) => new Date(clock.getTime() - ms).toISOString();
  const later = (ms: number) => {
    clock = new Date(clock.getTime() + ms);
  };
  const report = (body: object, headers = rider) =>
    app.inject({ method: "POST", url: "/v1/delivery/me/location", headers, payload: body });
  const track = (headers = customer, orderId = ORDER) =>
    app.inject({ method: "GET", url: `/v1/delivery/orders/${orderId}/tracking`, headers });
  const upload = (deliveryId: string, imageBase64 = jpeg(), headers = rider) =>
    app.inject({
      method: "POST",
      url: `/v1/delivery/${deliveryId}/pod`,
      headers,
      payload: { contentType: "image/jpeg", imageBase64 },
    });

  /** A delivery assigned to RIDER and in the given status, with the order in orderStatus. */
  const setup = async (status: string, orderStatus: string, orderId = ORDER) => {
    await app.inject({
      method: "POST",
      url: "/internal/deliveries",
      payload: {
        orderId,
        orderNumber: "QC-TRACK",
        warehouseId: "wh-noida-62",
        store: { name: "Tokajo Noida 62", address: "Sector 62", ...STORE },
        customer: {
          name: "Alice",
          phone: "+919999000001",
          address: "12 Park Road",
          ...HOME,
          instructions: null,
        },
        items: [{ id: "p1", name: "Milk", quantity: 1, emoji: "x" }],
        distanceKm: 1.5,
        etaMins: 11,
        tipPaise: 0,
        codPaise: 5000,
        deliveryCode: "4321",
      },
    });
    const row = await db
      .updateTable("delivery.deliveries")
      .set({
        riderId: RIDER,
        status,
        deliveredAt: status === "delivered" ? clock : null,
      })
      .where("orderId", "=", orderId)
      .returning("id")
      .executeTakeFirstOrThrow();
    orders.set(orderId, { id: orderId, userId: CUSTOMER, status: orderStatus });
    return row.id;
  };

  beforeEach(async () => {
    clock = new Date("2026-11-13T10:00:00.000Z");
    orders.clear();
    storage.files.clear();
    await db.deleteFrom("delivery.deliveries").where("orderId", "in", [ORDER, ORDER_FAR]).execute();
    await db
      .deleteFrom("delivery.riderLocations")
      .where("riderId", "in", [RIDER, OTHER_RIDER])
      .execute();
    await db
      .deleteFrom("delivery.riderState")
      .where("riderId", "in", [RIDER, OTHER_RIDER])
      .execute();
    await db.insertInto("delivery.riderState").values({ riderId: RIDER, online: true }).execute();
  });
  afterAll(async () => {
    await db.deleteFrom("delivery.deliveries").where("orderId", "in", [ORDER, ORDER_FAR]).execute();
    await db
      .deleteFrom("delivery.riderLocations")
      .where("riderId", "in", [RIDER, OTHER_RIDER])
      .execute();
    await db
      .deleteFrom("delivery.riderState")
      .where("riderId", "in", [RIDER, OTHER_RIDER])
      .execute();
    await app.close();
    await db.destroy();
  });

  describe("rider location", () => {
    it("keeps only the latest reading", async () => {
      expect((await report({ ...STORE, recordedAt: ago(1000), accuracyM: 8 })).statusCode).toBe(
        200,
      );
      later(6000);
      expect((await report({ lat: 28.612, lng: 77.352, recordedAt: ago(500) })).statusCode).toBe(
        200,
      );
      const rows = await db
        .selectFrom("delivery.riderLocations")
        .selectAll()
        .where("riderId", "=", RIDER)
        .execute();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ lat: 28.612, lng: 77.352 });
    });

    it("refuses readings sent too often", async () => {
      await report({ ...STORE, recordedAt: ago(1000) });
      later(2000);
      const res = await report({ ...STORE, recordedAt: ago(100) });
      expect(res.statusCode).toBe(429);
    });

    it("refuses old, future and out of order readings", async () => {
      expect((await report({ ...STORE, recordedAt: ago(5 * 60_000) })).statusCode).toBe(422);
      expect((await report({ ...STORE, recordedAt: ago(-60_000) })).statusCode).toBe(422);
      await report({ ...STORE, recordedAt: ago(1000) });
      later(6000);
      expect((await report({ ...STORE, recordedAt: ago(10_000) })).statusCode).toBe(422);
    });

    it("refuses an impossible jump but accepts GPS jitter", async () => {
      await report({ ...STORE, recordedAt: ago(1000) });
      later(6000);
      // About 11 km in 6 seconds
      const jump = await report({ lat: 28.71, lng: 77.35, recordedAt: ago(0) });
      expect(jump.statusCode).toBe(422);
      expect(jump.json().error.message).toMatch(/too far/);
      // 100 m in a second is jitter, not a jump
      const jitter = await report({ lat: 28.6109, lng: 77.35, recordedAt: ago(0) });
      expect(jitter.statusCode).toBe(200);
    });

    it("needs the rider to be on duty, and a rider at all", async () => {
      await db
        .updateTable("delivery.riderState")
        .set({ online: false })
        .where("riderId", "=", RIDER)
        .execute();
      expect((await report({ ...STORE, recordedAt: ago(0) })).statusCode).toBe(409);
      expect((await report({ ...STORE, recordedAt: ago(0) }, customer)).statusCode).toBe(403);
      expect((await report({ lat: 200, lng: 0, recordedAt: ago(0) })).statusCode).toBe(400);
    });
  });

  describe("customer tracking", () => {
    it("shows the rider, distance and ETA while the order is on the way", async () => {
      await setup("picked_up", "out_for_delivery");
      await report({ ...STORE, recordedAt: ago(3000), heading: 90 });
      const res = await track();
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toMatchObject({
        active: true,
        status: "out_for_delivery",
        store: STORE,
        destination: HOME,
      });
      expect(body.rider).toMatchObject({
        lat: STORE.lat,
        lng: STORE.lng,
        heading: 90,
        ageSeconds: 3,
      });
      expect(body.distanceKm).toBeCloseTo(1.4, 0);
      expect(body.etaMins).toBeGreaterThanOrEqual(1);
      expect(JSON.stringify(body)).not.toContain("4321");
      expect(res.headers["cache-control"]).toBe("no-store");
    });

    it("updates as the rider moves", async () => {
      await setup("picked_up", "out_for_delivery");
      await report({ ...STORE, recordedAt: ago(0) });
      const first = (await track()).json();
      later(5 * 60_000);
      await report({ lat: 28.618, lng: 77.358, recordedAt: ago(0) });
      const second = (await track()).json();
      expect(second.distanceKm).toBeLessThan(first.distanceKm);
    });

    it("falls back to the store when the rider has not reported yet", async () => {
      await setup("picked_up", "picked_up");
      const body = (await track()).json();
      expect(body.active).toBe(true);
      expect(body.rider).toBeNull();
      expect(body.distanceKm).toBeGreaterThan(0);
    });

    it("shares nothing before pickup or after delivery", async () => {
      await setup("assigned", "packed");
      await report({ ...STORE, recordedAt: ago(0) });
      expect((await track()).json()).toMatchObject({
        active: false,
        rider: null,
        status: "packed",
      });
      orders.set(ORDER, { id: ORDER, userId: CUSTOMER, status: "delivered" });
      expect((await track()).json()).toMatchObject({
        active: false,
        rider: null,
        destination: null,
      });
    });

    it("is a plain 404 for anyone but the customer who ordered", async () => {
      await setup("picked_up", "out_for_delivery");
      for (const headers of [stranger, rider, admin, manager]) {
        expect((await track(headers)).statusCode).toBe(404);
      }
      expect((await track(customer, "77770000-0000-4000-8000-0000000000ff")).statusCode).toBe(404);
      expect(
        (await app.inject({ method: "GET", url: `/v1/delivery/orders/${ORDER}/tracking` }))
          .statusCode,
      ).toBe(401);
    });
  });

  describe("door photo", () => {
    it("lets the rider add a photo at the door, and the right people see it", async () => {
      const id = await setup("at_customer", "out_for_delivery");
      const res = await upload(id);
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ uploaded: true, bytes: 2000 });
      orders.set(ORDER, { id: ORDER, userId: CUSTOMER, status: "delivered" });
      expect((await track()).json().podAvailable).toBe(true);

      for (const headers of [admin, manager, customer, rider]) {
        const photo = await app.inject({
          method: "GET",
          url: `/v1/delivery/orders/${ORDER}/pod`,
          headers,
        });
        expect(photo.statusCode).toBe(200);
        expect(photo.headers["content-type"]).toBe("image/jpeg");
        expect(photo.rawPayload.subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]));
      }
      for (const headers of [stranger, otherManager, as(OTHER_RIDER, "rider", "wh-noida-62")]) {
        expect(
          (await app.inject({ method: "GET", url: `/v1/delivery/${id}/pod`, headers })).statusCode,
        ).toBe(404);
      }
    });

    it("accepts a late photo soon after delivery, not later", async () => {
      const id = await setup("delivered", "delivered");
      expect((await upload(id)).statusCode).toBe(200);
      later(31 * 60_000);
      expect((await upload(id)).statusCode).toBe(409);
    });

    it("refuses before the door, from another rider, non JPEGs and oversized photos", async () => {
      const id = await setup("picked_up", "out_for_delivery");
      expect((await upload(id)).statusCode).toBe(409);
      await db
        .updateTable("delivery.deliveries")
        .set({ status: "at_customer" })
        .where("id", "=", id)
        .execute();
      expect((await upload(id, jpeg(), as(OTHER_RIDER, "rider", "wh-noida-62"))).statusCode).toBe(
        404,
      );
      expect((await upload(id, Buffer.alloc(2000, 0x50).toString("base64"))).statusCode).toBe(415);
      expect((await upload(id, "not base64 at all!!".repeat(10))).statusCode).toBe(400);
      const big = await upload(id, jpeg(1_600_000));
      expect(big.statusCode, big.body.slice(0, 300)).toBe(413);
      expect(storage.files.size).toBe(0);
    });

    it("answers 503 when no storage is set up", async () => {
      const bare = await buildApp({
        db,
        clients: { order: orderClient, identity: identityClient },
        now: () => clock,
        podStorage: null,
      });
      const id = await setup("at_customer", "out_for_delivery");
      const res = await bare.inject({
        method: "POST",
        url: `/v1/delivery/${id}/pod`,
        headers: rider,
        payload: { contentType: "image/jpeg", imageBase64: jpeg() },
      });
      expect(res.statusCode).toBe(503);
      await bare.close();
    });
  });

  describe("admin order page", () => {
    it("shows the rider's last position and whether there is a photo", async () => {
      const id = await setup("at_customer", "out_for_delivery");
      await report({ ...HOME, recordedAt: ago(20_000) });
      await upload(id);
      const res = await app.inject({
        method: "GET",
        url: `/v1/delivery/admin/orders/${ORDER}`,
        headers: admin,
      });
      expect(res.json()).toMatchObject({
        deliveryId: id,
        status: "at_customer",
        podAvailable: true,
      });
      expect(res.json().riderLocation.ageSeconds).toBe(20);
      expect(
        (
          await app.inject({
            method: "GET",
            url: `/v1/delivery/admin/orders/${ORDER}`,
            headers: manager,
          })
        ).statusCode,
      ).toBe(200);
      expect(
        (
          await app.inject({
            method: "GET",
            url: `/v1/delivery/admin/orders/${ORDER}`,
            headers: otherManager,
          })
        ).statusCode,
      ).toBe(404);
      expect(
        (
          await app.inject({
            method: "GET",
            url: `/v1/delivery/admin/orders/${ORDER}`,
            headers: customer,
          })
        ).statusCode,
      ).toBe(403);
    });
  });
});
