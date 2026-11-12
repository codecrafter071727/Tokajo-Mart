import { afterAll, describe, expect, it, vi } from "vitest";

// The internal key is read when the app is built, so set it before importing the app.
vi.stubEnv("INTERNAL_API_KEY", "test-internal-key");
const { buildApp } = await import("../../src/app");

const app = await buildApp();
afterAll(async () => {
  await app.close();
});

const KEY = { "x-internal-key": "test-internal-key" };
const post = (url: string, payload?: object, headers: Record<string, string> = KEY) =>
  app.inject({ method: "POST", url, payload, headers });

describe("internal key", () => {
  it("rejects an internal call with no key or the wrong key", async () => {
    const none = await post(
      "/internal/reservations",
      { warehouseId: "wh-noida-62", reference: "k1", items: [{ productId: "p1", quantity: 1 }] },
      {},
    );
    expect(none.statusCode).toBe(401);
    const wrong = await post(
      "/internal/reservations",
      { warehouseId: "wh-noida-62", reference: "k1", items: [{ productId: "p1", quantity: 1 }] },
      { "x-internal-key": "nope" },
    );
    expect(wrong.statusCode).toBe(401);
  });

  it("does not guard the public routes", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/inventory/serviceability?lat=28.628&lng=77.365",
    });
    expect(res.statusCode).toBe(200);
  });
});

describe("reservations over HTTP", () => {
  const body = (reference: string, items: { productId: string; quantity: number }[]) => ({
    warehouseId: "wh-noida-62",
    reference,
    items,
  });

  it("holds, commits and reports the state", async () => {
    const held = await post(
      "/internal/reservations",
      body("http-1", [{ productId: "p1", quantity: 2 }]),
    );
    expect(held.statusCode).toBe(200);
    expect(held.json()).toMatchObject({ reference: "http-1", status: "held" });
    const sold = await post("/internal/reservations/http-1/commit");
    expect(sold.json().status).toBe("committed");
  });

  it("answers 409 with the short products named when stock is not enough", async () => {
    const res = await post(
      "/internal/reservations",
      body("http-2", [{ productId: "p15", quantity: 1 }]),
    );
    expect(res.statusCode).toBe(409);
    expect(res.json().error.details).toEqual([{ productId: "p15", requested: 1, available: 0 }]);
  });

  it("answers 404 for an unknown reservation and 400 for a bad body", async () => {
    expect((await post("/internal/reservations/ghost/commit")).statusCode).toBe(404);
    expect(
      (
        await post("/internal/reservations", {
          warehouseId: "wh-noida-62",
          reference: "x",
          items: [],
        })
      ).statusCode,
    ).toBe(400);
  });

  it("resolves a basket", async () => {
    const res = await post("/internal/serviceability/resolve", {
      lat: 28.628,
      lng: 77.365,
      items: [{ productId: "p1", quantity: 1 }],
    });
    expect(res.json()).toMatchObject({ serviceable: true, warehouseId: "wh-noida-62" });
  });

  it("returns a warehouse for the order service to show on a delivery", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/internal/warehouses/wh-noida-62",
      headers: KEY,
    });
    expect(res.json()).toMatchObject({ id: "wh-noida-62", name: "Noida Sector 62", open: true });
    expect(
      (await app.inject({ method: "GET", url: "/internal/warehouses/nope", headers: KEY }))
        .statusCode,
    ).toBe(404);
  });
});
