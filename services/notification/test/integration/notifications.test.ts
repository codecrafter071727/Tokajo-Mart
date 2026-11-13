import { DEV_INTERNAL_KEY, createDb, signIdentityHeaders } from "@qc/service-kit";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app";
import type { DB } from "../../src/db/types.generated";
import { decodeCursor, encodeCursor } from "../../src/modules/notifications/service";

// Runs only with a migrated test database (see scripts/db-migrate.mjs)
const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

const ALICE = "aaaaaaaa-1111-4000-8000-00000000000a";
const BOB = "bbbbbbbb-1111-4000-8000-00000000000b";
const ADMIN = "dddddddd-1111-4000-8000-00000000000d";
const USERS = [ALICE, BOB];

suite("notification service", async () => {
  const db = createDb<DB>(url as string, 5);
  let clock = new Date("2026-11-13T10:00:00.000Z");
  const app = await buildApp({ db, now: () => clock });

  const as = (userId: string, role: string) =>
    signIdentityHeaders({ userId, role: role as never, warehouseId: null }, DEV_INTERNAL_KEY);
  const alice = as(ALICE, "customer");
  const bob = as(BOB, "customer");
  const admin = as(ADMIN, "admin");
  const rider = as(BOB, "rider");

  const notify = (body: object) =>
    app.inject({ method: "POST", url: "/internal/notify", payload: body });
  const get = (path: string, headers: Record<string, string>) =>
    app.inject({ method: "GET", url: path, headers });
  const post = (path: string, headers: Record<string, string>, body?: object) =>
    app.inject({ method: "POST", url: path, headers, payload: body ?? {} });
  const del = (path: string, headers: Record<string, string>, body: object) =>
    app.inject({ method: "DELETE", url: path, headers, payload: body });

  const tick = (ms = 1000) => {
    clock = new Date(clock.getTime() + ms);
  };

  beforeEach(async () => {
    clock = new Date("2026-11-13T10:00:00.000Z");
    await db.deleteFrom("notifications.notifications").where("userId", "in", USERS).execute();
    await db.deleteFrom("notifications.subscriptions").where("userId", "in", USERS).execute();
    await db.deleteFrom("notifications.deviceTokens").where("userId", "in", USERS).execute();
  });
  afterAll(async () => {
    await db.deleteFrom("notifications.notifications").where("userId", "in", USERS).execute();
    await db.deleteFrom("notifications.subscriptions").where("userId", "in", USERS).execute();
    await db.deleteFrom("notifications.deviceTokens").where("userId", "in", USERS).execute();
    await app.close();
    await db.destroy();
  });

  describe("account deletion", () => {
    it("erases one person's inbox, Notify me and devices, leaves others alone, and can repeat", async () => {
      await notify({
        userId: ALICE,
        type: "order_confirmed",
        title: "Order confirmed",
        body: "On its way soon",
      });
      await notify({
        userId: BOB,
        type: "order_confirmed",
        title: "Order confirmed",
        body: "Hi Bob",
      });
      await post("/v1/notifications/me/subscriptions", alice, {
        productId: "p1",
        warehouseId: "wh-noida-62",
      });
      await post("/v1/notifications/me/devices", alice, {
        platform: "android",
        token: "alice-device-token-123",
      });

      const first = await app.inject({ method: "POST", url: `/internal/users/${ALICE}/purge` });
      expect(first.statusCode).toBe(200);
      expect(first.json()).toEqual({ notifications: 1, subscriptions: 1, devices: 1 });

      expect((await get("/v1/notifications/me", alice)).json().items).toEqual([]);
      expect((await get("/v1/notifications/me", bob)).json().items).toHaveLength(1);

      const again = await app.inject({ method: "POST", url: `/internal/users/${ALICE}/purge` });
      expect(again.json()).toEqual({ notifications: 0, subscriptions: 0, devices: 0 });
    });
  });

  describe("inbox", () => {
    it("shows only my own notifications, newest first, and counts unread", async () => {
      await notify({
        userId: ALICE,
        type: "order.confirmed",
        title: "Order confirmed",
        data: { orderId: "o1" },
      });
      tick();
      await notify({ userId: ALICE, type: "order.delivered", title: "Delivered", body: "Enjoy!" });
      await notify({ userId: BOB, type: "order.confirmed", title: "Bob's order" });

      const mine = (await get("/v1/notifications/me", alice)).json();
      expect(mine.items.map((n: { title: string }) => n.title)).toEqual([
        "Delivered",
        "Order confirmed",
      ]);
      expect(mine.items[1].data).toEqual({ orderId: "o1" });
      expect((await get("/v1/notifications/me/unread-count", alice)).json()).toEqual({ unread: 2 });
      expect((await get("/v1/notifications/me", {})).statusCode).toBe(401);
    });

    it("pages with a stable cursor", async () => {
      for (let i = 0; i < 5; i += 1) {
        await notify({ userId: ALICE, type: "t", title: `n${i}` });
        tick();
      }
      const first = (await get("/v1/notifications/me?limit=2", alice)).json();
      expect(first.items.map((n: { title: string }) => n.title)).toEqual(["n4", "n3"]);
      const second = (
        await get(`/v1/notifications/me?limit=2&cursor=${first.nextCursor}`, alice)
      ).json();
      expect(second.items.map((n: { title: string }) => n.title)).toEqual(["n2", "n1"]);
      const third = (
        await get(`/v1/notifications/me?limit=2&cursor=${second.nextCursor}`, alice)
      ).json();
      expect(third.items.map((n: { title: string }) => n.title)).toEqual(["n0"]);
      expect(third.nextCursor).toBeNull();
      expect((await get("/v1/notifications/me?cursor=junk", alice)).statusCode).toBe(400);
    });

    it("marks one read, and someone else's looks like it does not exist", async () => {
      const { id } = (await notify({ userId: ALICE, type: "t", title: "Hi" })).json();
      expect((await post(`/v1/notifications/me/${id}/read`, bob)).statusCode).toBe(404);
      const read = (await post(`/v1/notifications/me/${id}/read`, alice)).json();
      expect(read.readAt).toBe(clock.toISOString());
      // Reading again keeps the first time
      tick(60_000);
      expect((await post(`/v1/notifications/me/${id}/read`, alice)).json().readAt).toBe(
        read.readAt,
      );
      expect((await get("/v1/notifications/me/unread-count", alice)).json().unread).toBe(0);
    });

    it("marks everything read for me only", async () => {
      await notify({ userId: ALICE, type: "t", title: "a" });
      await notify({ userId: ALICE, type: "t", title: "b" });
      await notify({ userId: BOB, type: "t", title: "c" });
      expect((await post("/v1/notifications/me/read-all", alice)).json()).toEqual({ updated: 2 });
      expect((await get("/v1/notifications/me/unread-count", bob)).json().unread).toBe(1);
    });
  });

  describe("sending", () => {
    it("creates one notification for a repeated dedupe key", async () => {
      const a = (
        await notify({
          userId: ALICE,
          type: "order.confirmed",
          title: "x",
          dedupeKey: "order:1:confirmed",
        })
      ).json();
      const b = (
        await notify({
          userId: ALICE,
          type: "order.confirmed",
          title: "x",
          dedupeKey: "order:1:confirmed",
        })
      ).json();
      expect(a.created).toBe(true);
      expect(b).toEqual({ id: a.id, created: false });
      expect((await get("/v1/notifications/me", alice)).json().items).toHaveLength(1);
    });

    it("rejects bad input", async () => {
      expect((await notify({ userId: "not-a-uuid", type: "t", title: "x" })).statusCode).toBe(400);
      expect((await notify({ userId: ALICE, type: "t", title: "" })).statusCode).toBe(400);
    });
  });

  describe("notify me", () => {
    const item = { productId: "p15", warehouseId: "wh-noida-62" };

    it("subscribes once, lists, and cancels", async () => {
      const a = (await post("/v1/notifications/me/subscriptions", alice, item)).json();
      const b = (await post("/v1/notifications/me/subscriptions", alice, item)).json();
      expect(b.id).toBe(a.id);
      expect((await get("/v1/notifications/me/subscriptions", alice)).json().items).toHaveLength(1);
      expect((await get("/v1/notifications/me/subscriptions", bob)).json().items).toHaveLength(0);
      await del("/v1/notifications/me/subscriptions", alice, item);
      expect((await get("/v1/notifications/me/subscriptions", alice)).json().items).toHaveLength(0);
      // And can subscribe again after cancelling
      expect((await post("/v1/notifications/me/subscriptions", alice, item)).statusCode).toBe(200);
    });

    it("is for customers only", async () => {
      expect((await post("/v1/notifications/me/subscriptions", rider, item)).statusCode).toBe(403);
    });

    it("tells everyone waiting exactly once when the item is back, and closes their subscriptions", async () => {
      await post("/v1/notifications/me/subscriptions", alice, item);
      await post("/v1/notifications/me/subscriptions", bob, item);
      await post("/v1/notifications/me/subscriptions", bob, {
        productId: "p15",
        warehouseId: "wh-indiranagar",
      });
      const restock = { ...item, productName: "Amul Butter" };
      const first = await app.inject({
        method: "POST",
        url: "/internal/stock-restocked",
        payload: restock,
      });
      expect(first.json()).toEqual({ notified: 2 });
      const again = await app.inject({
        method: "POST",
        url: "/internal/stock-restocked",
        payload: restock,
      });
      expect(again.json()).toEqual({ notified: 0 });

      const inbox = (await get("/v1/notifications/me", alice)).json().items;
      expect(inbox).toHaveLength(1);
      expect(inbox[0]).toMatchObject({
        type: "stock.back_in_stock",
        title: "Amul Butter is back in stock",
        data: item,
      });
      expect((await get("/v1/notifications/me/subscriptions", alice)).json().items).toHaveLength(0);
      // Bob's wait at the other warehouse is untouched
      expect((await get("/v1/notifications/me/subscriptions", bob)).json().items).toHaveLength(1);
    });
  });

  describe("devices and admin", () => {
    it("remembers a device token and moves it to whoever signed in last", async () => {
      const token = "fcm-token-1234567890";
      await post("/v1/notifications/me/devices", alice, { platform: "android", token });
      await post("/v1/notifications/me/devices", bob, { platform: "android", token });
      const rows = await db
        .selectFrom("notifications.deviceTokens")
        .select("userId")
        .where("token", "=", token)
        .execute();
      expect(rows).toEqual([{ userId: BOB }]);
      expect(
        (await post("/v1/notifications/me/devices", alice, { platform: "fax", token })).statusCode,
      ).toBe(400);
    });

    it("lists sent notifications for admins only, with counts", async () => {
      await notify({ userId: ALICE, type: "order.confirmed", title: "a" });
      await notify({ userId: BOB, type: "order.delivered", title: "b" });
      const res = (await get("/v1/notifications/admin?type=order.delivered", admin)).json();
      expect(res.items.every((n: { type: string }) => n.type === "order.delivered")).toBe(true);
      expect(res.items.some((n: { userId: string }) => n.userId === BOB)).toBe(true);
      expect(res.counts.last24h).toBeGreaterThanOrEqual(2);
      expect((await get("/v1/notifications/admin", alice)).statusCode).toBe(403);
    });
  });

  it("round trips the paging cursor", () => {
    const row = { createdAt: new Date("2026-11-13T10:00:00.000Z"), id: ALICE };
    expect(decodeCursor(encodeCursor(row))).toEqual(row);
    expect(decodeCursor("bm9wZQ")).toBeNull();
  });
});
