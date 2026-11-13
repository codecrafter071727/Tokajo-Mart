import {
  DEV_INTERNAL_KEY,
  InternalCallError,
  createDb,
  signIdentityHeaders,
  type InternalClient,
} from "@qc/service-kit";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app";
import type { DB } from "../../src/db/types.generated";
import type { DeletionClients } from "../../src/modules/account/deletion";

// Runs only with a migrated test database (see scripts/db-migrate.mjs)
const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

const DANA = { id: "abcd0000-0000-4000-8000-0000000000d1", phone: "+919999200001" };
const RIDER = "abcd0000-0000-4000-8000-0000000000d2";

/** Stand ins for the order, payment and notification services, recording what they were asked. */
function fakeServices() {
  const calls: string[] = [];
  const state = { active: [] as string[], down: false };
  const client = (name: string): InternalClient => ({
    get: async (path) => {
      calls.push(`${name} GET ${path}`);
      if (state.down) throw new InternalCallError("down", 0, "SERVICE_UNAVAILABLE");
      return { count: state.active.length, numbers: state.active } as never;
    },
    post: async (path) => {
      calls.push(`${name} POST ${path}`);
      if (state.down) throw new InternalCallError("down", 0, "SERVICE_UNAVAILABLE");
      return {} as never;
    },
  });
  const clients: DeletionClients = {
    order: client("order"),
    payment: client("payment"),
    notification: client("notification"),
  };
  return { clients, calls, state };
}

suite("account deletion", async () => {
  const db = createDb<DB>(url as string, 5);
  const fake = fakeServices();
  let clock = new Date("2026-11-13T10:00:00.000Z");
  const app = await buildApp({ db, clients: fake.clients, now: () => clock });
  const dana = signIdentityHeaders(
    { userId: DANA.id, role: "customer", warehouseId: null },
    DEV_INTERNAL_KEY,
  );

  const signIn = async () => {
    await app.inject({
      method: "POST",
      url: "/v1/identity/auth/otp/request",
      payload: { phone: DANA.phone },
    });
    return app.inject({
      method: "POST",
      url: "/v1/identity/auth/otp/verify",
      payload: { phone: DANA.phone, code: "1234" },
    });
  };
  const remove = (headers: Record<string, string> = dana, body: object = {}) =>
    app.inject({ method: "POST", url: "/v1/identity/me/delete", headers, payload: body });

  const cleanup = async () => {
    const users = await db
      .selectFrom("identity.users")
      .select("id")
      .where((eb) =>
        eb.or([
          eb("id", "=", DANA.id),
          eb("phone", "=", DANA.phone),
          eb.and([eb("name", "=", "Deleted user"), eb("createdAt", ">", new Date("2026-01-01"))]),
        ]),
      )
      .execute();
    const ids = [...users.map((u) => u.id), DANA.id];
    await db.deleteFrom("identity.refreshTokens").where("userId", "in", ids).execute();
    await db.deleteFrom("identity.addresses").where("userId", "in", ids).execute();
    await db.deleteFrom("identity.otpChallenges").where("phone", "=", DANA.phone).execute();
    await db.deleteFrom("identity.users").where("id", "in", ids).execute();
  };

  beforeEach(async () => {
    clock = new Date("2026-11-13T10:00:00.000Z");
    fake.calls.length = 0;
    fake.state.active = [];
    fake.state.down = false;
    await cleanup();
    await db
      .insertInto("identity.users")
      .values({ id: DANA.id, role: "customer", name: "Dana", phone: DANA.phone })
      .execute();
    await db
      .insertInto("identity.addresses")
      .values({ userId: DANA.id, kind: "home", line1: "B-12, Sector 62", lat: 28.62, lng: 77.36 })
      .execute();
  });
  afterAll(async () => {
    await cleanup();
    await app.close();
    await db.destroy();
  });

  it("refuses while an order is still in progress, and changes nothing", async () => {
    fake.state.active = ["QC-261113-00042"];
    const res = await remove();
    expect(res.statusCode).toBe(409);
    expect(res.json().error.message).toContain("QC-261113-00042");
    const user = await db
      .selectFrom("identity.users")
      .selectAll()
      .where("id", "=", DANA.id)
      .executeTakeFirstOrThrow();
    expect(user).toMatchObject({ status: "active", phone: DANA.phone, name: "Dana" });
    expect(fake.calls.some((c) => c.includes("purge") || c.includes("scrub"))).toBe(false);
  });

  it("clears other services, ends sessions, removes addresses and anonymises the account", async () => {
    const session = (await signIn()).json();
    expect(session.user.id).toBe(DANA.id);

    const res = await remove(dana, { reason: "Moving city" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ deleted: true, deletedAt: clock.toISOString() });
    expect(fake.calls).toEqual([
      `order GET /internal/customers/${DANA.id}/active-orders`,
      `notification POST /internal/users/${DANA.id}/purge`,
      `order POST /internal/customers/${DANA.id}/scrub`,
      `payment POST /internal/payments/customers/${DANA.id}/scrub`,
    ]);

    const user = await db
      .selectFrom("identity.users")
      .selectAll()
      .where("id", "=", DANA.id)
      .executeTakeFirstOrThrow();
    expect(user).toMatchObject({
      name: "Deleted user",
      phone: null,
      email: null,
      passwordHash: null,
      status: "deleted",
      deletionReason: "Moving city",
    });
    expect(user.deletedAt?.toISOString()).toBe(clock.toISOString());
    const addresses = await db
      .selectFrom("identity.addresses")
      .select("id")
      .where("userId", "=", DANA.id)
      .execute();
    expect(addresses).toHaveLength(0);

    // The old session cannot be renewed, and "who am I" no longer answers
    const refresh = await app.inject({
      method: "POST",
      url: "/v1/identity/auth/refresh",
      payload: { refreshToken: session.refreshToken },
    });
    expect(refresh.statusCode).toBe(401);
    expect(
      (await app.inject({ method: "GET", url: "/v1/identity/me", headers: dana })).statusCode,
    ).toBe(403);
  });

  it("lets the same phone number sign up again as a brand new account", async () => {
    await remove();
    const again = (await signIn()).json();
    expect(again.user.id).not.toBe(DANA.id);
    expect(again.user).toMatchObject({ role: "customer", phone: DANA.phone });
  });

  it("is safe to repeat and keeps the first deletion time", async () => {
    const first = (await remove()).json();
    clock = new Date(clock.getTime() + 60_000);
    const second = await remove();
    expect(second.statusCode).toBe(200);
    expect(second.json().deletedAt).toBe(first.deletedAt);
  });

  it("changes nothing here if another service cannot be reached, so a retry works", async () => {
    fake.state.down = true;
    expect((await remove()).statusCode).toBe(503);
    const user = await db
      .selectFrom("identity.users")
      .select(["status", "phone"])
      .where("id", "=", DANA.id)
      .executeTakeFirstOrThrow();
    expect(user).toEqual({ status: "active", phone: DANA.phone });
    fake.state.down = false;
    expect((await remove()).statusCode).toBe(200);
  });

  it("is only for customers: riders and staff are closed by someone else", async () => {
    const rider = signIdentityHeaders(
      { userId: RIDER, role: "rider", warehouseId: "wh-noida-62" },
      DEV_INTERNAL_KEY,
    );
    const res = await remove(rider);
    expect(res.statusCode).toBe(403);
    expect(res.json().error.message).toMatch(/warehouse manager/);
    expect(
      (await app.inject({ method: "POST", url: "/v1/identity/me/delete", payload: {} })).statusCode,
    ).toBe(401);
  });

  it("shows admins the account as deleted and will not block or unblock it", async () => {
    await remove();
    const admin = signIdentityHeaders(
      { userId: "abcd0000-0000-4000-8000-0000000000ad", role: "admin", warehouseId: null },
      DEV_INTERNAL_KEY,
    );
    const list = await app.inject({
      method: "GET",
      url: "/v1/identity/admin/users?role=customer&status=deleted&limit=50",
      headers: admin,
    });
    const row = list.json().items.find((u: { id: string }) => u.id === DANA.id);
    expect(row).toMatchObject({ status: "deleted", name: "Deleted user", phone: null });
    expect(row.deletedAt).toBe(clock.toISOString());
    expect(
      (
        await app.inject({
          method: "POST",
          url: `/v1/identity/admin/users/${DANA.id}/unblock`,
          headers: admin,
        })
      ).statusCode,
    ).toBe(409);
  });
});
