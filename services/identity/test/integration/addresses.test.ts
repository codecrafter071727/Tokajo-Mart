import { DEV_INTERNAL_KEY, createDb, signIdentityHeaders } from "@qc/service-kit";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app";
import type { DB } from "../../src/db/types.generated";

// Runs only with a migrated test database (see scripts/db-migrate.mjs)
const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

const ANNA = { id: "abcd0000-0000-4000-8000-0000000000a1", phone: "+919999100001" };
const BEN = { id: "abcd0000-0000-4000-8000-0000000000b2", phone: "+919999100002" };

const HOME = {
  kind: "home",
  line1: "B-12, Sector 62",
  lat: 28.6208,
  lng: 77.3649,
  areaId: "noida-62",
};
const WORK = { kind: "work", line1: "Tower 3, Logix Cyber Park", lat: 28.6262, lng: 77.3722 };

suite("customer addresses", async () => {
  const db = createDb<DB>(url as string, 5);
  const app = await buildApp({ db });
  const as = (userId: string, role = "customer") =>
    signIdentityHeaders({ userId, role: role as never, warehouseId: null }, DEV_INTERNAL_KEY);
  const anna = as(ANNA.id);
  const ben = as(BEN.id);

  const call = (
    method: "GET" | "POST" | "PATCH" | "DELETE",
    path: string,
    headers: Record<string, string>,
    body?: object,
  ) => app.inject({ method, url: path, headers, payload: body });
  const list = async (headers = anna) =>
    (await call("GET", "/v1/identity/me/addresses", headers)).json().items;
  const add = (body: object, headers = anna) =>
    call("POST", "/v1/identity/me/addresses", headers, body);

  beforeEach(async () => {
    const ids = [ANNA.id, BEN.id];
    await db.deleteFrom("identity.addresses").where("userId", "in", ids).execute();
    await db.deleteFrom("identity.users").where("id", "in", ids).execute();
    await db
      .insertInto("identity.users")
      .values([
        { id: ANNA.id, role: "customer", name: "Anna", phone: ANNA.phone },
        { id: BEN.id, role: "customer", name: "Ben", phone: BEN.phone },
      ])
      .execute();
  });
  afterAll(async () => {
    await db.deleteFrom("identity.addresses").where("userId", "in", [ANNA.id, BEN.id]).execute();
    await db.deleteFrom("identity.users").where("id", "in", [ANNA.id, BEN.id]).execute();
    await app.close();
    await db.destroy();
  });

  it("starts empty, saves an address and makes the first one the default", async () => {
    expect(await list()).toEqual([]);
    const res = await add(HOME);
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      kind: "home",
      label: "",
      line1: "B-12, Sector 62",
      areaId: "noida-62",
      isDefault: true,
      pincode: null,
    });
    const second = (await add(WORK)).json();
    expect(second.isDefault).toBe(false);
    expect((await list()).map((a: { kind: string }) => a.kind)).toEqual(["home", "work"]);
  });

  it("validates what it saves", async () => {
    expect((await add({ ...HOME, line1: "x" })).statusCode).toBe(400);
    expect((await add({ ...HOME, lat: 120 })).statusCode).toBe(400);
    expect((await add({ ...HOME, pincode: "12345" })).statusCode).toBe(400);
    expect((await add({ ...HOME, kind: "other" })).statusCode).toBe(400); // other needs a name
    expect((await add({ ...HOME, kind: "other", label: "Parents" })).statusCode).toBe(201);
    expect((await add({ ...HOME, extra: true })).statusCode).toBe(400);
  });

  it("never keeps a label on home or work", async () => {
    const res = await add({ ...HOME, label: "Ignored" });
    expect(res.json().label).toBe("");
  });

  it("moves the default when another one is saved as default or chosen", async () => {
    const home = (await add(HOME)).json();
    const work = (await add({ ...WORK, isDefault: true })).json();
    expect(work.isDefault).toBe(true);
    let items = await list();
    expect(items.filter((a: { isDefault: boolean }) => a.isDefault)).toHaveLength(1);
    expect(items[0].id).toBe(work.id);
    items = (await call("POST", `/v1/identity/me/addresses/${home.id}/default`, anna)).json().items;
    expect(items[0]).toMatchObject({ id: home.id, isDefault: true });
    expect(items.filter((a: { isDefault: boolean }) => a.isDefault)).toHaveLength(1);
  });

  it("edits only what is sent, and keeps latitude and longitude together", async () => {
    const home = (await add(HOME)).json();
    const res = await call("PATCH", `/v1/identity/me/addresses/${home.id}`, anna, {
      instructions: "Ring twice",
    });
    expect(res.json()).toMatchObject({ line1: "B-12, Sector 62", instructions: "Ring twice" });
    expect(
      (await call("PATCH", `/v1/identity/me/addresses/${home.id}`, anna, { lat: 28.6 })).statusCode,
    ).toBe(400);
    expect((await call("PATCH", `/v1/identity/me/addresses/${home.id}`, anna, {})).statusCode).toBe(
      400,
    );
    expect(
      (await call("PATCH", `/v1/identity/me/addresses/${home.id}`, anna, { kind: "other" }))
        .statusCode,
    ).toBe(400);
    const moved = await call("PATCH", `/v1/identity/me/addresses/${home.id}`, anna, {
      kind: "other",
      label: "Gym",
      lat: 28.63,
      lng: 77.38,
    });
    expect(moved.json()).toMatchObject({ kind: "other", label: "Gym", lat: 28.63, lng: 77.38 });
  });

  it("deletes softly and hands the default to the next address", async () => {
    const home = (await add(HOME)).json();
    const work = (await add(WORK)).json();
    const items = (await call("DELETE", `/v1/identity/me/addresses/${home.id}`, anna)).json().items;
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id: work.id, isDefault: true });
    const row = await db
      .selectFrom("identity.addresses")
      .select("deletedAt")
      .where("id", "=", home.id)
      .executeTakeFirstOrThrow();
    expect(row.deletedAt).not.toBeNull();
    expect((await call("DELETE", `/v1/identity/me/addresses/${home.id}`, anna)).statusCode).toBe(
      404,
    );
  });

  it("keeps each customer's addresses private: another one looks like not found", async () => {
    const home = (await add(HOME)).json();
    expect(await list(ben)).toEqual([]);
    expect(
      (await call("PATCH", `/v1/identity/me/addresses/${home.id}`, ben, { line1: "Hijacked road" }))
        .statusCode,
    ).toBe(404);
    expect((await call("DELETE", `/v1/identity/me/addresses/${home.id}`, ben)).statusCode).toBe(
      404,
    );
    expect(
      (await call("POST", `/v1/identity/me/addresses/${home.id}/default`, ben)).statusCode,
    ).toBe(404);
    expect((await list())[0].line1).toBe("B-12, Sector 62");
  });

  it("is for signed in customers only", async () => {
    expect((await call("GET", "/v1/identity/me/addresses", {})).statusCode).toBe(401);
    expect((await call("GET", "/v1/identity/me/addresses", as(ANNA.id, "rider"))).statusCode).toBe(
      403,
    );
  });

  it("caps a customer at 20 addresses, even when saving many at once", async () => {
    const results = await Promise.all(
      Array.from({ length: 24 }, (_, i) => add({ ...HOME, line1: `House ${i + 1}, Sector 62` })),
    );
    expect(results.filter((r) => r.statusCode === 201)).toHaveLength(20);
    expect(results.filter((r) => r.statusCode === 409)).toHaveLength(4);
    expect(results.find((r) => r.statusCode === 409)?.json().error.message).toMatch(/up to 20/);
    const items = await list();
    expect(items).toHaveLength(20);
    expect(items.filter((a: { isDefault: boolean }) => a.isDefault)).toHaveLength(1);
  });
});
