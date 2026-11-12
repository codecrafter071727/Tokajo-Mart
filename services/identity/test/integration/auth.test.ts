import {
  createDb,
  readIdentityHeaders,
  signIdentityHeaders,
  createTokenVerifier,
  DEV_JWT_SECRET,
  DEV_INTERNAL_KEY,
} from "@qc/service-kit";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { DB } from "../../src/db/types.generated";
import { buildApp } from "../../src/app";
import type { OtpSender } from "../../src/modules/auth/otp";

// Runs only when a migrated and seeded test database is available (see scripts/db-migrate.mjs).
const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

const TEST_PHONE = "+919999000001";
const OTHER_PHONE = "+919999000002";
const RIDER_PHONE = "+919810000011"; // seeded: Ravi Kumar
const ADMIN = {
  userId: "00000000-0000-4000-8000-000000000001",
  role: "admin" as const,
  warehouseId: null,
};

suite("identity: sign in and sessions", async () => {
  const db = createDb<DB>(url as string, 5);
  let clock = new Date("2026-11-13T10:00:00.000Z");
  const sent: { phone: string; code: string }[] = [];
  const sender: OtpSender = {
    async send(phone, code) {
      sent.push({ phone, code });
    },
  };
  const app = await buildApp({ db, sender, now: () => clock });

  const call = (
    method: "GET" | "POST",
    path: string,
    body?: object,
    headers: Record<string, string> = {},
  ) => app.inject({ method, url: path, payload: body, headers });
  const asAdmin = signIdentityHeaders(ADMIN, DEV_INTERNAL_KEY);

  beforeEach(async () => {
    clock = new Date("2026-11-13T10:00:00.000Z");
    sent.length = 0;
    await db.deleteFrom("identity.otpChallenges").where("phone", "like", "+9199990000%").execute();
    await db.deleteFrom("identity.otpChallenges").where("phone", "=", RIDER_PHONE).execute();
    await db.deleteFrom("identity.refreshTokens").execute();
    await db
      .updateTable("identity.users")
      .set({ status: "active" })
      .where("phone", "=", RIDER_PHONE)
      .execute();
    await db
      .deleteFrom("identity.riderProfiles")
      .where("userId", "in", (eb) =>
        eb
          .selectFrom("identity.users")
          .select("id")
          .where((w) =>
            w.or([w("phone", "like", "+9199990000%"), w("email", "like", "test-%@example.com")]),
          ),
      )
      .execute();
    await db
      .deleteFrom("identity.users")
      .where((w) =>
        w.or([w("phone", "like", "+9199990000%"), w("email", "like", "test-%@example.com")]),
      )
      .execute();
  });
  afterAll(async () => {
    await app.close();
    await db.destroy();
  });

  const signInCustomer = async (phone = TEST_PHONE) => {
    await call("POST", "/v1/identity/auth/otp/request", { phone });
    return call("POST", "/v1/identity/auth/otp/verify", {
      phone,
      code: "1234",
      name: "Test Customer",
    });
  };

  describe("customer phone code", () => {
    it("tells the app how long the code is and that demo mode is on", async () => {
      const res = await call("POST", "/v1/identity/auth/otp/request", { phone: TEST_PHONE });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ codeLength: 4, demoMode: true, expiresInSeconds: 300 });
    });

    it("creates the customer on first sign in and returns a verifiable token", async () => {
      const res = await signInCustomer();
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.user).toMatchObject({
        role: "customer",
        phone: TEST_PHONE,
        name: "Test Customer",
      });
      const claims = await createTokenVerifier({ secret: DEV_JWT_SECRET })(body.accessToken);
      expect(claims).toMatchObject({ sub: body.user.id, app_role: "customer" });
    });

    it("signs the same customer in again rather than creating a second account", async () => {
      const first = (await signInCustomer()).json();
      const second = (await signInCustomer()).json();
      expect(second.user.id).toBe(first.user.id);
    });

    it("stores only a hash of the code", async () => {
      await call("POST", "/v1/identity/auth/otp/request", { phone: TEST_PHONE });
      const row = await db
        .selectFrom("identity.otpChallenges")
        .selectAll()
        .where("phone", "=", TEST_PHONE)
        .executeTakeFirstOrThrow();
      expect(row.codeHash).toMatch(/^[0-9a-f]{64}$/);
      expect(row.codeHash).not.toContain("1234");
    });

    it("rejects a wrong code", async () => {
      await call("POST", "/v1/identity/auth/otp/request", { phone: TEST_PHONE });
      const res = await call("POST", "/v1/identity/auth/otp/verify", {
        phone: TEST_PHONE,
        code: "9999",
      });
      expect(res.statusCode).toBe(401);
      expect(res.json().error.message).toMatch(/not right/);
    });

    it("locks the code after five wrong tries, even if the next one is right", async () => {
      await call("POST", "/v1/identity/auth/otp/request", { phone: TEST_PHONE });
      for (let i = 0; i < 5; i += 1) {
        expect(
          (await call("POST", "/v1/identity/auth/otp/verify", { phone: TEST_PHONE, code: "0000" }))
            .statusCode,
        ).toBe(401);
      }
      const locked = await call("POST", "/v1/identity/auth/otp/verify", {
        phone: TEST_PHONE,
        code: "1234",
      });
      expect(locked.statusCode).toBe(429);
      // and the code cannot be used afterwards
      expect(
        (await call("POST", "/v1/identity/auth/otp/verify", { phone: TEST_PHONE, code: "1234" }))
          .statusCode,
      ).toBe(401);
    });

    it("rejects an expired code", async () => {
      await call("POST", "/v1/identity/auth/otp/request", { phone: TEST_PHONE });
      clock = new Date(clock.getTime() + 6 * 60_000);
      const res = await call("POST", "/v1/identity/auth/otp/verify", {
        phone: TEST_PHONE,
        code: "1234",
      });
      expect(res.statusCode).toBe(401);
      expect(res.json().error.message).toMatch(/expired/);
    });

    it("does not let one code be used twice", async () => {
      await call("POST", "/v1/identity/auth/otp/request", { phone: TEST_PHONE });
      expect(
        (await call("POST", "/v1/identity/auth/otp/verify", { phone: TEST_PHONE, code: "1234" }))
          .statusCode,
      ).toBe(200);
      expect(
        (await call("POST", "/v1/identity/auth/otp/verify", { phone: TEST_PHONE, code: "1234" }))
          .statusCode,
      ).toBe(401);
    });

    it("limits how many codes one number can ask for in an hour", async () => {
      for (let i = 0; i < 5; i += 1) {
        expect(
          (await call("POST", "/v1/identity/auth/otp/request", { phone: OTHER_PHONE })).statusCode,
        ).toBe(200);
      }
      expect(
        (await call("POST", "/v1/identity/auth/otp/request", { phone: OTHER_PHONE })).statusCode,
      ).toBe(429);
      clock = new Date(clock.getTime() + 61 * 60_000);
      expect(
        (await call("POST", "/v1/identity/auth/otp/request", { phone: OTHER_PHONE })).statusCode,
      ).toBe(200);
    });

    it("rejects a malformed phone number", async () => {
      expect(
        (await call("POST", "/v1/identity/auth/otp/request", { phone: "98765" })).statusCode,
      ).toBe(400);
    });
  });

  describe("riders", () => {
    it("will not even send a code to a number that is not a registered rider", async () => {
      const res = await call("POST", "/v1/identity/auth/otp/request", {
        phone: TEST_PHONE,
        role: "rider",
      });
      expect(res.statusCode).toBe(403);
    });

    it("signs in a registered rider with a 6 digit code and a warehouse claim", async () => {
      const req = await call("POST", "/v1/identity/auth/otp/request", {
        phone: RIDER_PHONE,
        role: "rider",
      });
      expect(req.json().codeLength).toBe(6);
      const res = await call("POST", "/v1/identity/auth/otp/verify", {
        phone: RIDER_PHONE,
        role: "rider",
        code: "123456",
      });
      expect(res.statusCode).toBe(200);
      const claims = await createTokenVerifier({ secret: DEV_JWT_SECRET })(res.json().accessToken);
      expect(claims).toMatchObject({ app_role: "rider", warehouse_id: "wh-noida-62" });
    });

    it("keeps a customer number and a rider number from being swapped", async () => {
      await signInCustomer();
      // A customer phone cannot be turned into a rider session
      expect(
        (await call("POST", "/v1/identity/auth/otp/request", { phone: TEST_PHONE, role: "rider" }))
          .statusCode,
      ).toBe(403);
      // And a rider phone cannot sign in as a customer
      await call("POST", "/v1/identity/auth/otp/request", { phone: RIDER_PHONE });
      expect(
        (
          await call("POST", "/v1/identity/auth/otp/verify", {
            phone: RIDER_PHONE,
            role: "customer",
            code: "1234",
          })
        ).statusCode,
      ).toBe(409);
    });

    it("refuses a blocked rider", async () => {
      await db
        .updateTable("identity.users")
        .set({ status: "blocked" })
        .where("phone", "=", RIDER_PHONE)
        .execute();
      expect(
        (await call("POST", "/v1/identity/auth/otp/request", { phone: RIDER_PHONE, role: "rider" }))
          .statusCode,
      ).toBe(403);
    });
  });

  describe("staff email and password", () => {
    it("signs in the seeded manager with a warehouse claim", async () => {
      const res = await call("POST", "/v1/identity/auth/login", {
        email: "Manager@Tokajo.dev",
        password: "tokajo-dev",
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().user).toMatchObject({
        role: "warehouse_manager",
        warehouseId: "wh-noida-62",
      });
    });

    it("gives the same answer for a wrong password and an unknown email", async () => {
      const wrong = await call("POST", "/v1/identity/auth/login", {
        email: "manager@tokajo.dev",
        password: "not-the-password",
      });
      const unknown = await call("POST", "/v1/identity/auth/login", {
        email: "nobody@tokajo.dev",
        password: "not-the-password",
      });
      expect(wrong.statusCode).toBe(401);
      expect(unknown.statusCode).toBe(401);
      expect(wrong.json().error.message).toBe(unknown.json().error.message);
    });

    it("never signs a customer in through the password route", async () => {
      await signInCustomer();
      expect(
        (
          await call("POST", "/v1/identity/auth/login", {
            email: "x@example.com",
            password: "whatever-password",
          })
        ).statusCode,
      ).toBe(401);
    });
  });

  describe("sessions", () => {
    it("rotates the refresh token and rejects the old one", async () => {
      const first = (await signInCustomer()).json();
      const next = await call("POST", "/v1/identity/auth/refresh", {
        refreshToken: first.refreshToken,
      });
      expect(next.statusCode).toBe(200);
      expect(next.json().refreshToken).not.toBe(first.refreshToken);
      expect(
        (await call("POST", "/v1/identity/auth/refresh", { refreshToken: first.refreshToken }))
          .statusCode,
      ).toBe(401);
    });

    it("treats a reused refresh token as theft and ends every session", async () => {
      const first = (await signInCustomer()).json();
      const next = (
        await call("POST", "/v1/identity/auth/refresh", { refreshToken: first.refreshToken })
      ).json();
      // The old token is presented again (an attacker): the legitimate newer one must stop working too
      await call("POST", "/v1/identity/auth/refresh", { refreshToken: first.refreshToken });
      expect(
        (await call("POST", "/v1/identity/auth/refresh", { refreshToken: next.refreshToken }))
          .statusCode,
      ).toBe(401);
    });

    it("rejects an expired refresh token", async () => {
      const first = (await signInCustomer()).json();
      clock = new Date(clock.getTime() + 31 * 86_400_000);
      expect(
        (await call("POST", "/v1/identity/auth/refresh", { refreshToken: first.refreshToken }))
          .statusCode,
      ).toBe(401);
    });

    it("ends the session on logout", async () => {
      const first = (await signInCustomer()).json();
      expect(
        (await call("POST", "/v1/identity/auth/logout", { refreshToken: first.refreshToken }))
          .statusCode,
      ).toBe(200);
      expect(
        (await call("POST", "/v1/identity/auth/refresh", { refreshToken: first.refreshToken }))
          .statusCode,
      ).toBe(401);
    });

    it("answers who am I from the gateway's signed identity, and 401 without one", async () => {
      const user = (await signInCustomer()).json().user;
      const headers = signIdentityHeaders(
        { userId: user.id, role: "customer", warehouseId: null },
        DEV_INTERNAL_KEY,
      );
      const me = await call("GET", "/v1/identity/me", undefined, headers);
      expect(me.json()).toMatchObject({ id: user.id, role: "customer", phone: TEST_PHONE });
      expect((await call("GET", "/v1/identity/me")).statusCode).toBe(401);
      // a forged identity (wrong signature) is the same as none
      expect(
        (await call("GET", "/v1/identity/me", undefined, { ...headers, "x-user-role": "admin" }))
          .statusCode,
      ).toBe(401);
      expect(
        readIdentityHeaders({ ...headers, "x-user-role": "admin" }, DEV_INTERNAL_KEY),
      ).toBeNull();
    });
  });

  describe("admin", () => {
    const rider = {
      name: "Test Rider",
      phone: "+919999000003",
      vehicle: "Bike",
      warehouseId: "wh-noida-62",
    };

    it("is closed to everyone who is not an admin", async () => {
      expect((await call("POST", "/v1/identity/admin/riders", rider)).statusCode).toBe(401);
      const staff = signIdentityHeaders(
        { userId: ADMIN.userId, role: "warehouse_manager", warehouseId: "wh-noida-62" },
        DEV_INTERNAL_KEY,
      );
      expect((await call("POST", "/v1/identity/admin/riders", rider, staff)).statusCode).toBe(403);
    });

    it("registers a rider who can then sign in, and refuses a duplicate number", async () => {
      const created = await call("POST", "/v1/identity/admin/riders", rider, asAdmin);
      expect(created.statusCode).toBe(201);
      expect((await call("POST", "/v1/identity/admin/riders", rider, asAdmin)).statusCode).toBe(
        409,
      );
      expect(
        (await call("POST", "/v1/identity/auth/otp/request", { phone: rider.phone, role: "rider" }))
          .statusCode,
      ).toBe(200);
    });

    it("creates staff with a hashed password, and rejects a short one", async () => {
      const body = {
        name: "Test Staff",
        email: "test-staff@example.com",
        password: "a-long-enough-password",
        role: "warehouse_staff",
        warehouseId: "wh-noida-62",
      };
      expect(
        (await call("POST", "/v1/identity/admin/staff", { ...body, password: "short" }, asAdmin))
          .statusCode,
      ).toBe(400);
      expect((await call("POST", "/v1/identity/admin/staff", body, asAdmin)).statusCode).toBe(201);
      const row = await db
        .selectFrom("identity.users")
        .select("passwordHash")
        .where("email", "=", body.email)
        .executeTakeFirstOrThrow();
      expect(row.passwordHash).not.toContain(body.password);
      expect(
        (
          await call("POST", "/v1/identity/auth/login", {
            email: body.email,
            password: body.password,
          })
        ).statusCode,
      ).toBe(200);
    });

    it("blocks a user, ends their sessions at once, and unblocks them", async () => {
      const session = (await signInCustomer()).json();
      expect(
        (
          await call(
            "POST",
            `/v1/identity/admin/users/${session.user.id}/block`,
            undefined,
            asAdmin,
          )
        ).statusCode,
      ).toBe(200);
      expect(
        (await call("POST", "/v1/identity/auth/refresh", { refreshToken: session.refreshToken }))
          .statusCode,
      ).toBe(401);
      await call("POST", "/v1/identity/auth/otp/request", { phone: TEST_PHONE });
      expect(
        (await call("POST", "/v1/identity/auth/otp/verify", { phone: TEST_PHONE, code: "1234" }))
          .statusCode,
      ).toBe(403);
      await call("POST", `/v1/identity/admin/users/${session.user.id}/unblock`, undefined, asAdmin);
      expect((await signInCustomer()).statusCode).toBe(200);
    });
  });

  describe("internal routes", () => {
    it("returns rider details for other services, and lists a warehouse's riders", async () => {
      const list = await call("GET", "/internal/riders?warehouseId=wh-noida-62");
      expect(list.json().items.map((r: { name: string }) => r.name)).toEqual([
        "Imran Ali",
        "Ravi Kumar",
        "Sunil Yadav",
      ]);
      const ids = list
        .json()
        .items.map((r: { id: string }) => r.id)
        .slice(0, 2)
        .join(",");
      expect((await call("GET", `/internal/riders/batch?ids=${ids}`)).json().items).toHaveLength(2);
    });
  });
});
