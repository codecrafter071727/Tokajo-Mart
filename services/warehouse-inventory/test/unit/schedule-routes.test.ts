import { DEV_INTERNAL_KEY, signIdentityHeaders } from "@qc/service-kit";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app";
import {
  createInMemoryInventoryRepository,
  seedStock,
  seedWarehouses,
} from "../../src/modules/inventory";
import { indiaDay } from "../../src/modules/inventory/schedule";

const repository = createInMemoryInventoryRepository(
  seedWarehouses.map((w) => ({ ...w })),
  seedStock.map((s) => ({ ...s })),
);
const app = await buildApp({ repository });
afterAll(async () => {
  await app.close();
});

const USER = "66666666-0000-4000-8000-000000000006";
const as = (role: string, warehouseId: string | null) =>
  signIdentityHeaders({ userId: USER, role: role as never, warehouseId }, DEV_INTERNAL_KEY);
const admin = as("admin", null);
const manager = as("warehouse_manager", "wh-noida-62");
const otherManager = as("warehouse_manager", "wh-indiranagar");
const staff = as("warehouse_staff", "wh-noida-62");
const customer = as("customer", null);

const call = (
  method: "GET" | "POST" | "PUT" | "DELETE",
  url: string,
  headers?: Record<string, string>,
  body?: object,
) => app.inject({ method, url, headers, payload: body });

const NOIDA = "lat=28.6208&lng=77.3649";
const today = () => indiaDay(new Date()).day;
const shift = (day: string, n: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

beforeEach(async () => {
  for (const w of seedWarehouses) {
    await repository.setPincodes(w.id, []);
    await repository.setHours(w.id, []);
    const setup = await repository.getServiceSetup();
    for (const c of setup.closures.get(w.id) ?? []) await repository.removeClosure(w.id, c.id);
  }
});

describe("serviceability with pincodes and hours", () => {
  it("keeps the old answer and adds open now and how it matched", async () => {
    const res = (await call("GET", `/v1/inventory/serviceability?${NOIDA}`)).json();
    expect(res).toMatchObject({
      serviceable: true,
      warehouseId: "wh-noida-62",
      reason: null,
      openNow: true,
      matchedBy: "radius",
      coveringWarehouseId: "wh-noida-62",
    });
    expect(res.etaMins).toBeGreaterThan(0);
  });

  it("serves by pincode once pincodes are set, and refuses an unlisted pincode", async () => {
    await call("PUT", "/v1/inventory/warehouses/wh-noida-62/pincodes", admin, {
      pincodes: ["201301", "201309"],
    });
    const listed = (
      await call("GET", `/v1/inventory/serviceability?${NOIDA}&pincode=201309`)
    ).json();
    expect(listed).toMatchObject({ serviceable: true, matchedBy: "pincode" });
    const unlisted = (
      await call("GET", `/v1/inventory/serviceability?${NOIDA}&pincode=110001`)
    ).json();
    expect(unlisted).toMatchObject({
      serviceable: false,
      reason: "OUTSIDE_SERVICE_AREA",
      matchedBy: "pincode",
      coveringWarehouseId: null,
    });
    // Without a pincode the radius still works
    expect((await call("GET", `/v1/inventory/serviceability?${NOIDA}`)).json().serviceable).toBe(
      true,
    );
    // A malformed pincode is a bad request, not a silent fallback
    expect((await call("GET", `/v1/inventory/serviceability?${NOIDA}&pincode=12`)).statusCode).toBe(
      400,
    );
  });

  it("says closed with the next opening during a holiday, and resolve refuses it", async () => {
    await call("PUT", "/v1/inventory/warehouses/wh-noida-62/hours", admin, {
      hours: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
        weekday,
        opensAt: "06:00",
        closesAt: "01:00",
      })),
    });
    await call("POST", "/v1/inventory/warehouses/wh-noida-62/closures", admin, {
      startsOn: shift(today(), -1),
      endsOn: today(),
      reason: "Festival",
    });
    const res = (await call("GET", `/v1/inventory/serviceability?${NOIDA}`)).json();
    expect(res).toMatchObject({
      serviceable: false,
      reason: "WAREHOUSE_CLOSED",
      openNow: false,
      coveringWarehouseId: "wh-noida-62",
    });
    expect(res.opensAt).toBe(new Date(`${shift(today(), 1)}T06:00:00+05:30`).toISOString());

    const resolved = (
      await call("POST", "/internal/serviceability/resolve", undefined, {
        lat: 28.6208,
        lng: 77.3649,
        items: [{ productId: "p1", quantity: 1 }],
      })
    ).json();
    expect(resolved).toMatchObject({ serviceable: false, reason: "WAREHOUSE_CLOSED" });
  });

  it("resolve uses the pincode too", async () => {
    await call("PUT", "/v1/inventory/warehouses/wh-noida-62/pincodes", admin, {
      pincodes: ["201301"],
    });
    const body = { lat: 28.6208, lng: 77.3649, items: [{ productId: "p1", quantity: 1 }] };
    const ok = await call("POST", "/internal/serviceability/resolve", undefined, {
      ...body,
      pincode: "201301",
    });
    expect(ok.json()).toMatchObject({ serviceable: true, warehouseId: "wh-noida-62" });
    const no = await call("POST", "/internal/serviceability/resolve", undefined, {
      ...body,
      pincode: "110001",
    });
    expect(no.json()).toMatchObject({ serviceable: false, reason: "OUTSIDE_SERVICE_AREA" });
  });
});

describe("schedule admin", () => {
  it("lets staff read their own warehouse's schedule only", async () => {
    const own = await call("GET", "/v1/inventory/warehouses/wh-noida-62/schedule", staff);
    expect(own.statusCode).toBe(200);
    expect(own.json()).toMatchObject({ warehouseId: "wh-noida-62", hours: [], pincodes: [] });
    expect(own.json().status.openNow).toBe(true);
    expect(
      (await call("GET", "/v1/inventory/warehouses/wh-noida-62/schedule", otherManager)).statusCode,
    ).toBe(403);
    expect(
      (await call("GET", "/v1/inventory/warehouses/wh-noida-62/schedule", customer)).statusCode,
    ).toBe(403);
    expect((await call("GET", "/v1/inventory/warehouses/wh-noida-62/schedule")).statusCode).toBe(
      401,
    );
    expect((await call("GET", "/v1/inventory/warehouses/nope/schedule", admin)).statusCode).toBe(
      404,
    );
  });

  it("keeps pincode, hours and closure changes for admins", async () => {
    const attempts = [
      call("PUT", "/v1/inventory/warehouses/wh-noida-62/pincodes", manager, {
        pincodes: ["201301"],
      }),
      call("PUT", "/v1/inventory/warehouses/wh-noida-62/hours", manager, { hours: [] }),
      call("POST", "/v1/inventory/warehouses/wh-noida-62/closures", manager, {
        startsOn: today(),
        endsOn: today(),
        reason: "Stock take",
      }),
    ];
    for (const res of await Promise.all(attempts)) expect(res.statusCode).toBe(403);
  });

  it("stores pincodes cleanly and validates them", async () => {
    const res = await call("PUT", "/v1/inventory/warehouses/wh-noida-62/pincodes", admin, {
      pincodes: ["201309", "201301", "201301"],
    });
    expect(res.json()).toEqual({ pincodes: ["201301", "201309"] });
    expect(
      (
        await call("PUT", "/v1/inventory/warehouses/wh-noida-62/pincodes", admin, {
          pincodes: ["2013"],
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (await call("PUT", "/v1/inventory/warehouses/nope/pincodes", admin, { pincodes: [] }))
        .statusCode,
    ).toBe(404);
  });

  it("validates hours: same open and close, two windows a day, bad times", async () => {
    const put = (hours: object[]) =>
      call("PUT", "/v1/inventory/warehouses/wh-noida-62/hours", admin, { hours });
    expect((await put([{ weekday: 1, opensAt: "06:00", closesAt: "06:00" }])).statusCode).toBe(400);
    expect(
      (
        await put([
          { weekday: 1, opensAt: "06:00", closesAt: "12:00" },
          { weekday: 1, opensAt: "13:00", closesAt: "20:00" },
        ])
      ).statusCode,
    ).toBe(400);
    expect((await put([{ weekday: 1, opensAt: "25:00", closesAt: "06:00" }])).statusCode).toBe(400);
    const ok = await put([
      { weekday: 3, opensAt: "06:00", closesAt: "01:00" },
      { weekday: 1, opensAt: "06:00", closesAt: "23:00" },
    ]);
    expect(ok.statusCode).toBe(200);
    expect(ok.json().hours.map((h: { weekday: number }) => h.weekday)).toEqual([1, 3]);
  });

  it("adds and removes closures, and checks the dates", async () => {
    const bad = await call("POST", "/v1/inventory/warehouses/wh-noida-62/closures", admin, {
      startsOn: "2026-12-26",
      endsOn: "2026-12-25",
      reason: "Christmas",
    });
    expect(bad.statusCode).toBe(400);
    const created = await call("POST", "/v1/inventory/warehouses/wh-noida-62/closures", admin, {
      startsOn: "2026-12-25",
      endsOn: "2026-12-25",
      reason: "Christmas",
    });
    expect(created.statusCode).toBe(201);
    const id = created.json().id as string;
    const schedule = (
      await call("GET", "/v1/inventory/warehouses/wh-noida-62/schedule", admin)
    ).json();
    expect(schedule.closures.map((c: { id: string }) => c.id)).toContain(id);
    const url = `/v1/inventory/warehouses/wh-noida-62/closures/${id}`;
    expect((await call("DELETE", url, admin)).statusCode).toBe(200);
    expect((await call("DELETE", url, admin)).statusCode).toBe(404);
  });
});
