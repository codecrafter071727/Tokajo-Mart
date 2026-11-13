import { DEV_INTERNAL_KEY, signIdentityHeaders, type InternalClient } from "@qc/service-kit";
import { afterAll, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app";
import {
  addDays,
  createInMemoryInventoryRepository,
  daysBetween,
  indiaToday,
  seedStock,
  seedWarehouses,
} from "../../src/modules/inventory";

const repository = createInMemoryInventoryRepository(
  seedWarehouses.map((w) => ({ ...w })),
  seedStock.map((s) => ({ ...s })),
);
const restocked: { warehouseId: string; productId: string; productName?: string }[] = [];
const notifyState = { mode: "up" as "up" | "down" | "hang" };
const notification: InternalClient = {
  get: async () => ({}) as never,
  post: async (_path, body) => {
    if (notifyState.mode === "down") throw new Error("down");
    if (notifyState.mode === "hang") return new Promise(() => undefined) as never;
    restocked.push(body as (typeof restocked)[number]);
    return { notified: 1 } as never;
  },
};
const catalog: InternalClient = {
  get: async () => ({ items: [{ id: "p15", name: "Red Bull" }] }) as never,
  post: async () => ({}) as never,
};
const app = await buildApp({ repository, notify: { notification, catalog } });
afterAll(async () => {
  await app.close();
});

const USER = "55555555-0000-4000-8000-000000000005";
const as = (role: string, warehouseId: string | null) =>
  signIdentityHeaders({ userId: USER, role: role as never, warehouseId }, DEV_INTERNAL_KEY);
const staff = as("warehouse_staff", "wh-noida-62");
const otherStaff = as("warehouse_staff", "wh-indiranagar");
const admin = as("admin", null);
const customer = as("customer", null);
const call = (
  method: "GET" | "POST",
  url: string,
  headers?: Record<string, string>,
  body?: object,
) => app.inject({ method, url, headers, payload: body });
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

describe("dates", () => {
  it("uses the India calendar day", () => {
    expect(indiaToday(new Date("2026-11-12T19:00:00Z"))).toBe("2026-11-13");
    expect(indiaToday(new Date("2026-11-13T10:00:00Z"))).toBe("2026-11-13");
    expect(addDays("2026-11-30", 2)).toBe("2026-12-02");
    expect(daysBetween("2026-11-13", "2026-11-10")).toBe(-3);
  });
});

describe("expiry and alerts", () => {
  const today = indiaToday();

  it("records expiry dates on receive and lists what is expiring, for staff only", async () => {
    const res = await call("POST", "/v1/inventory/stock/receive", staff, {
      items: [
        { productId: "p2", quantity: 3, expiresOn: addDays(today, 2), batchCode: "MILK-7" },
        { productId: "p4", quantity: 2, expiresOn: addDays(today, 30) },
        { productId: "p5", quantity: 1, expiresOn: addDays(today, -1) },
      ],
    });
    expect(res.statusCode).toBe(200);
    const soon = (await call("GET", "/v1/inventory/expiring?days=7", staff)).json().items;
    expect(soon.map((b: { productId: string }) => b.productId)).toEqual(["p5", "p2"]);
    expect(soon[1]).toMatchObject({ batchCode: "MILK-7", daysLeft: 2, quantity: 3 });
    expect(soon[0].daysLeft).toBe(-1);
    expect((await call("GET", "/v1/inventory/expiring", customer)).statusCode).toBe(403);
    expect((await call("GET", "/v1/inventory/expiring", otherStaff)).json().items).toEqual([]);
  });

  it("rejects a malformed expiry date", async () => {
    const res = await call("POST", "/v1/inventory/stock/receive", staff, {
      items: [{ productId: "p2", quantity: 1, expiresOn: "13/11/2026" }],
    });
    expect(res.statusCode).toBe(400);
  });

  it("works out out of stock, low, expiring and expired on read, worst first", async () => {
    const res = (
      await call("GET", "/v1/inventory/alerts?lowThreshold=5&expiryDays=7", staff)
    ).json();
    const kinds = res.items.map((a: { kind: string }) => a.kind);
    expect(kinds[0]).toBe("expired");
    expect(
      res.items.some(
        (a: { kind: string; productId: string }) =>
          a.kind === "out_of_stock" && a.productId === "p15",
      ),
    ).toBe(true);
    expect(
      res.items.some(
        (a: { kind: string; productId: string }) => a.kind === "expiring" && a.productId === "p2",
      ),
    ).toBe(true);
    expect(res.counts.outOfStock).toBeGreaterThanOrEqual(1);
    expect(res.counts.expired).toBe(1);
    expect(res.items.every((a: { warehouseId: string }) => a.warehouseId === "wh-noida-62")).toBe(
      true,
    );
  });

  it("lets an admin see every warehouse or one, and turns customers away", async () => {
    const all = (await call("GET", "/v1/inventory/alerts", admin)).json();
    const warehouses = new Set(all.items.map((a: { warehouseId: string }) => a.warehouseId));
    expect(warehouses.size).toBeGreaterThanOrEqual(1);
    const one = (
      await call("GET", "/v1/inventory/alerts?warehouseId=wh-indiranagar", admin)
    ).json();
    expect(
      one.items.every((a: { warehouseId: string }) => a.warehouseId === "wh-indiranagar"),
    ).toBe(true);
    expect((await call("GET", "/v1/inventory/alerts")).statusCode).toBe(401);
    expect((await call("GET", "/v1/inventory/alerts", customer)).statusCode).toBe(403);
  });
});

describe("back in stock notices", () => {
  it("tells the notification service when an out of stock item is received, with its name", async () => {
    restocked.length = 0;
    await call("POST", "/v1/inventory/stock/receive", staff, {
      items: [{ productId: "p15", quantity: 6 }],
    });
    await settle();
    expect(restocked).toEqual([
      { warehouseId: "wh-noida-62", productId: "p15", productName: "Red Bull" },
    ]);
  });

  it("says nothing when the item was already in stock", async () => {
    restocked.length = 0;
    await call("POST", "/v1/inventory/stock/receive", staff, {
      items: [{ productId: "p1", quantity: 1 }],
    });
    await settle();
    expect(restocked).toEqual([]);
  });

  it("notices a positive recount that brings an item back, but not a write off", async () => {
    await call("POST", "/v1/inventory/stock/adjust", staff, {
      productId: "p15",
      type: "damage",
      quantityDelta: -6,
      reason: "Crushed cans",
    });
    restocked.length = 0;
    await settle();
    await call("POST", "/v1/inventory/stock/adjust", staff, {
      productId: "p15",
      type: "adjustment",
      quantityDelta: 2,
      reason: "Found in the back",
    });
    await settle();
    expect(restocked.map((r) => r.productId)).toEqual(["p15"]);
  });

  it("notices stock coming back from a cancelled order", async () => {
    // Sell the last 2, then cancel: the shelf goes from 0 back to 2
    await call("POST", "/internal/reservations", undefined, {
      warehouseId: "wh-noida-62",
      reference: "cancel-me",
      items: [{ productId: "p15", quantity: 2 }],
    });
    await call("POST", "/internal/reservations/cancel-me/commit");
    restocked.length = 0;
    await call("POST", "/internal/reservations/cancel-me/restock");
    await settle();
    expect(restocked.map((r) => r.productId)).toEqual(["p15"]);
  });

  it("never fails or slows a stock change when notifications are down or hanging", async () => {
    for (const mode of ["down", "hang"] as const) {
      notifyState.mode = mode;
      await call("POST", "/v1/inventory/stock/adjust", staff, {
        productId: "p15",
        type: "damage",
        quantityDelta: -2,
        reason: "Test write off",
      });
      const started = Date.now();
      const res = await call("POST", "/v1/inventory/stock/receive", staff, {
        items: [{ productId: "p15", quantity: 1 }],
      });
      expect(res.statusCode).toBe(200);
      expect(Date.now() - started).toBeLessThan(1000);
    }
    notifyState.mode = "up";
  });
});
