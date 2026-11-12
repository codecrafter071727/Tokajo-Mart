import { DEV_INTERNAL_KEY, signIdentityHeaders } from "@qc/service-kit";
import { afterAll, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app";
import {
  createInMemoryInventoryRepository,
  seedStock,
  seedWarehouses,
} from "../../src/modules/inventory";

const repository = createInMemoryInventoryRepository(
  seedWarehouses.map((w) => ({ ...w })),
  seedStock.map((s) => ({ ...s })),
);
const app = await buildApp({ repository });
afterAll(async () => {
  await app.close();
});

const USER = "55555555-0000-4000-8000-000000000005";
const as = (role: string, warehouseId: string | null) =>
  signIdentityHeaders({ userId: USER, role: role as never, warehouseId }, DEV_INTERNAL_KEY);
const staff = as("warehouse_staff", "wh-noida-62");
const manager = as("warehouse_manager", "wh-noida-62");
const otherManager = as("warehouse_manager", "wh-indiranagar");
const admin = as("admin", null);
const customer = as("customer", null);

const call = (
  method: "GET" | "POST" | "PATCH",
  url: string,
  headers?: Record<string, string>,
  body?: object,
) => app.inject({ method, url, headers, payload: body });

describe("who may use the stock tools", () => {
  it("turns away anonymous callers and customers", async () => {
    for (const url of [
      "/v1/inventory/stock",
      "/v1/inventory/stock/movements",
      "/v1/inventory/warehouses",
    ]) {
      expect((await call("GET", url)).statusCode).toBe(401);
      expect((await call("GET", url, customer)).statusCode).toBe(403);
    }
    expect(
      (
        await call("POST", "/v1/inventory/stock/receive", customer, {
          items: [{ productId: "p1", quantity: 1 }],
        })
      ).statusCode,
    ).toBe(403);
  });

  it("shows staff their own warehouse and refuses another one by name", async () => {
    const own = await call("GET", "/v1/inventory/stock?limit=3", staff);
    expect(own.statusCode).toBe(200);
    expect(
      own.json().items.every((r: { warehouseId: string }) => r.warehouseId === "wh-noida-62"),
    ).toBe(true);
    expect(own.json().nextCursor).toBeTruthy();
    expect(
      (await call("GET", "/v1/inventory/stock?warehouseId=wh-noida-62", staff)).statusCode,
    ).toBe(200);
    expect(
      (await call("GET", "/v1/inventory/stock?warehouseId=wh-indiranagar", staff)).statusCode,
    ).toBe(403);
    expect(
      (
        await call("POST", "/v1/inventory/stock/receive", staff, {
          warehouseId: "wh-indiranagar",
          items: [{ productId: "p1", quantity: 1 }],
        })
      ).statusCode,
    ).toBe(403);
  });

  it("makes admins say which warehouse", async () => {
    expect((await call("GET", "/v1/inventory/stock", admin)).statusCode).toBe(403);
    const res = await call("GET", "/v1/inventory/stock?warehouseId=wh-indiranagar&limit=2", admin);
    expect(res.statusCode).toBe(200);
    expect(res.json().items[0].warehouseId).toBe("wh-indiranagar");
    expect(
      (
        await call("POST", "/v1/inventory/stock/receive", admin, {
          warehouseId: "wh-nowhere",
          items: [{ productId: "p1", quantity: 1 }],
        })
      ).statusCode,
    ).toBe(404);
  });

  it("pages with the cursor and rejects a bad one", async () => {
    const first = (await call("GET", "/v1/inventory/stock?limit=2", staff)).json();
    const second = (
      await call("GET", `/v1/inventory/stock?limit=2&cursor=${first.nextCursor}`, staff)
    ).json();
    expect(second.items[0].productId).not.toBe(first.items[0].productId);
    expect((await call("GET", "/v1/inventory/stock?cursor=%21%21", staff)).statusCode).toBe(400);
  });
});

describe("receiving and adjusting over HTTP", () => {
  it("receives stock and records who did it", async () => {
    const res = await call("POST", "/v1/inventory/stock/receive", staff, {
      reference: "GRN-1",
      items: [{ productId: "p2", quantity: 12 }],
    });
    expect(res.statusCode).toBe(200);
    const log = (await call("GET", "/v1/inventory/stock/movements?productId=p2", staff)).json()
      .items;
    expect(log[0]).toMatchObject({
      type: "grn",
      quantityDelta: 12,
      reference: "GRN-1",
      actorId: USER,
    });
  });

  it("validates the body", async () => {
    expect(
      (await call("POST", "/v1/inventory/stock/receive", staff, { items: [] })).statusCode,
    ).toBe(400);
    expect(
      (
        await call("POST", "/v1/inventory/stock/receive", staff, {
          items: [{ productId: "p1", quantity: 0 }],
        })
      ).statusCode,
    ).toBe(400);
    const bad = { productId: "p1", type: "damage", reason: "Broken box" };
    expect(
      (await call("POST", "/v1/inventory/stock/adjust", staff, { ...bad, quantityDelta: 0 }))
        .statusCode,
    ).toBe(400);
    expect(
      (await call("POST", "/v1/inventory/stock/adjust", staff, { ...bad, quantityDelta: 3 }))
        .statusCode,
    ).toBe(400); // damage must remove
    expect(
      (
        await call("POST", "/v1/inventory/stock/adjust", staff, {
          ...bad,
          quantityDelta: -1,
          reason: "x",
        })
      ).statusCode,
    ).toBe(400);
  });

  it("adjusts with a reason and says why when it cannot", async () => {
    const ok = await call("POST", "/v1/inventory/stock/adjust", staff, {
      productId: "p1",
      type: "damage",
      quantityDelta: -1,
      reason: "Leaking pack",
    });
    expect(ok.statusCode).toBe(200);
    const tooMany = await call("POST", "/v1/inventory/stock/adjust", staff, {
      productId: "p1",
      type: "damage",
      quantityDelta: -100000,
      reason: "Fire",
    });
    expect(tooMany.statusCode).toBe(409);
    expect(tooMany.json().error.message).toMatch(/Cannot remove/);
    expect(
      (
        await call("POST", "/v1/inventory/stock/adjust", staff, {
          productId: "nope",
          type: "damage",
          quantityDelta: -1,
          reason: "Gone",
        })
      ).statusCode,
    ).toBe(404);
  });

  it("edits the limit and rack, and 404s for an unknown product", async () => {
    const res = await call("PATCH", "/v1/inventory/stock/p1", staff, {
      maxPerOrder: 4,
      rackLocation: "B-3",
    });
    expect(res.json()).toMatchObject({ maxPerOrder: 4, rackLocation: "B-3" });
    expect((await call("PATCH", "/v1/inventory/stock/p1", staff, {})).statusCode).toBe(400);
    expect(
      (await call("PATCH", "/v1/inventory/stock/ghost", staff, { maxPerOrder: 4 })).statusCode,
    ).toBe(404);
  });
});

describe("warehouses", () => {
  it("lists all for admins and only their own for staff", async () => {
    expect(
      (await call("GET", "/v1/inventory/warehouses", admin)).json().items.length,
    ).toBeGreaterThanOrEqual(2);
    const own = (await call("GET", "/v1/inventory/warehouses", staff)).json().items;
    expect(own.map((w: { id: string }) => w.id)).toEqual(["wh-noida-62"]);
    expect(own[0]).toHaveProperty("radiusKm");
  });

  it("lets only admins add one, and refuses a duplicate or a bad id", async () => {
    const body = { id: "wh-mumbai-1", name: "Mumbai Andheri", lat: 19.11, lng: 72.84, radiusKm: 4 };
    expect((await call("POST", "/v1/inventory/warehouses", manager, body)).statusCode).toBe(403);
    const created = await call("POST", "/v1/inventory/warehouses", admin, body);
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ id: "wh-mumbai-1", open: true });
    expect((await call("POST", "/v1/inventory/warehouses", admin, body)).statusCode).toBe(409);
    expect(
      (await call("POST", "/v1/inventory/warehouses", admin, { ...body, id: "Bad Id" })).statusCode,
    ).toBe(400);
  });

  it("lets a manager only open or close their own, and admins change anything", async () => {
    expect(
      (await call("PATCH", "/v1/inventory/warehouses/wh-noida-62", manager, { open: false })).json()
        .open,
    ).toBe(false);
    expect(
      (await call("PATCH", "/v1/inventory/warehouses/wh-noida-62", manager, { radiusKm: 9 }))
        .statusCode,
    ).toBe(403);
    expect(
      (await call("PATCH", "/v1/inventory/warehouses/wh-noida-62", otherManager, { open: true }))
        .statusCode,
    ).toBe(403);
    expect(
      (await call("PATCH", "/v1/inventory/warehouses/wh-noida-62", staff, { open: true }))
        .statusCode,
    ).toBe(403);
    const edited = await call("PATCH", "/v1/inventory/warehouses/wh-noida-62", admin, {
      open: true,
      radiusKm: 6,
    });
    expect(edited.json()).toMatchObject({ open: true, radiusKm: 6 });
    expect(
      (await call("PATCH", "/v1/inventory/warehouses/ghost", admin, { open: true })).statusCode,
    ).toBe(404);
    expect(
      (await call("PATCH", "/v1/inventory/warehouses/wh-noida-62", admin, {})).statusCode,
    ).toBe(400);
  });
});
