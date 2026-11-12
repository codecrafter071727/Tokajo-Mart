import { afterAll, describe, expect, it } from "vitest";
import { availabilityResponseSchema, serviceabilityResponseSchema } from "@qc/contracts";
import { buildApp } from "../../src/app";
import { distanceKm, etaMinutes, stockStatus } from "../../src/modules/inventory/domain";

const app = await buildApp();

afterAll(async () => {
  await app.close();
});

const get = (url: string) => app.inject({ method: "GET", url });

describe("domain helpers", () => {
  it("computes great circle distance", () => {
    // Delhi to Noida Sector 62 is roughly 15 to 20 km
    const km = distanceKm(28.6139, 77.209, 28.6279, 77.3649);
    expect(km).toBeGreaterThan(12);
    expect(km).toBeLessThan(18);
    expect(distanceKm(1, 1, 1, 1)).toBe(0);
  });

  it("never promises faster than 8 minutes and grows with distance", () => {
    expect(etaMinutes(0)).toBe(8);
    expect(etaMinutes(4)).toBeGreaterThan(etaMinutes(1));
  });

  it("maps stock to status with 3 as the low stock edge", () => {
    expect(stockStatus(0)).toBe("out");
    expect(stockStatus(-2)).toBe("out");
    expect(stockStatus(1)).toBe("low");
    expect(stockStatus(3)).toBe("low");
    expect(stockStatus(4)).toBe("in_stock");
  });
});

describe("GET /v1/inventory/serviceability", () => {
  it("serves a point inside a warehouse area with an ETA", async () => {
    const res = await get("/v1/inventory/serviceability?lat=28.628&lng=77.365");
    expect(res.statusCode).toBe(200);
    const body = serviceabilityResponseSchema.parse(res.json());
    expect(body).toMatchObject({ serviceable: true, warehouseId: "wh-noida-62", reason: null });
    expect(body.etaMins).toBeGreaterThanOrEqual(8);
  });

  it("picks the nearest warehouse", async () => {
    const res = await get("/v1/inventory/serviceability?lat=12.978&lng=77.64");
    expect(serviceabilityResponseSchema.parse(res.json()).warehouseId).toBe("wh-indiranagar");
  });

  it("reports outside the service area, not an error", async () => {
    const res = await get("/v1/inventory/serviceability?lat=19.076&lng=72.8777");
    expect(res.statusCode).toBe(200);
    expect(serviceabilityResponseSchema.parse(res.json())).toEqual({
      serviceable: false,
      warehouseId: null,
      etaMins: null,
      reason: "OUTSIDE_SERVICE_AREA",
    });
  });

  it("rejects impossible coordinates", async () => {
    const res = await get("/v1/inventory/serviceability?lat=123&lng=77");
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("VALIDATION_ERROR");
  });
});

describe("GET /v1/inventory/availability", () => {
  const ask = async (ids: string) =>
    availabilityResponseSchema.parse(
      (await get(`/v1/inventory/availability?warehouseId=wh-noida-62&productIds=${ids}`)).json(),
    ).items;

  it("reports in stock, low (with the real count), and out", async () => {
    const items = await ask("p1,p3,p15");
    const byId = Object.fromEntries(items.map((i) => [i.productId, i]));
    expect(byId.p1).toMatchObject({ status: "in_stock", remaining: null, maxPerOrder: 5 });
    expect(byId.p3).toMatchObject({ status: "low", remaining: 2 });
    expect(byId.p15).toMatchObject({ status: "out", remaining: null, maxPerOrder: null });
  });

  it("honours a per order limit set on the item", async () => {
    expect((await ask("p6"))[0]).toMatchObject({ status: "in_stock", maxPerOrder: 2 });
  });

  it("keeps the order of the request and treats unknown products as out of stock", async () => {
    const items = await ask("p2,ghost,p1");
    expect(items.map((i) => i.productId)).toEqual(["p2", "ghost", "p1"]);
    expect(items[1]!.status).toBe("out");
  });

  it("returns NOT_FOUND for an unknown warehouse", async () => {
    const res = await get("/v1/inventory/availability?warehouseId=nope&productIds=p1");
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe("NOT_FOUND");
  });

  it("rejects an empty product list", async () => {
    const res = await get("/v1/inventory/availability?warehouseId=wh-noida-62&productIds=");
    expect(res.statusCode).toBe(400);
  });
});
