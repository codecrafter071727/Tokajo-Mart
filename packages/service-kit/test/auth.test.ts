import { describe, expect, it } from "vitest";
import {
  assertWarehouseScope,
  AuthError,
  createTokenVerifier,
  readIdentityHeaders,
  signAccessToken,
  signIdentityHeaders,
  TokenError,
} from "../src";

const SECRET = "a-test-secret-that-is-long-enough-for-hs256-use";
const ID = "6f1f0a8e-9d0c-4b6e-8f7a-0b6c3b2d1a11";

describe("access tokens", () => {
  it("signs a token whose claims verify", async () => {
    const token = await signAccessToken(
      { userId: ID, role: "warehouse_staff", warehouseId: "wh-1" },
      { secret: SECRET, ttlSeconds: 3600 },
    );
    const claims = await createTokenVerifier({ secret: SECRET })(token);
    expect(claims).toMatchObject({ sub: ID, app_role: "warehouse_staff", warehouse_id: "wh-1" });
  });

  it("omits the warehouse claim for people who have none", async () => {
    const token = await signAccessToken(
      { userId: ID, role: "customer" },
      { secret: SECRET, ttlSeconds: 60 },
    );
    expect(await createTokenVerifier({ secret: SECRET })(token)).not.toHaveProperty("warehouse_id");
  });

  it("rejects a token signed with another secret", async () => {
    const token = await signAccessToken(
      { userId: ID, role: "admin" },
      { secret: "another-secret-another-secret-another-secret", ttlSeconds: 60 },
    );
    await expect(createTokenVerifier({ secret: SECRET })(token)).rejects.toBeInstanceOf(TokenError);
  });

  it("rejects an expired token", async () => {
    const past = new Date(Date.now() - 2 * 3600 * 1000);
    const token = await signAccessToken(
      { userId: ID, role: "customer" },
      { secret: SECRET, ttlSeconds: 60, now: past },
    );
    await expect(createTokenVerifier({ secret: SECRET })(token)).rejects.toBeInstanceOf(TokenError);
  });

  it("rejects garbage and a token with an unknown role", async () => {
    const verify = createTokenVerifier({ secret: SECRET });
    await expect(verify("not-a-token")).rejects.toBeInstanceOf(TokenError);
    const bad = await signAccessToken(
      { userId: ID, role: "superuser" as never },
      { secret: SECRET, ttlSeconds: 60 },
    );
    await expect(verify(bad)).rejects.toBeInstanceOf(TokenError);
  });

  it("needs a secret or a JWKS url", () => {
    expect(() => createTokenVerifier({})).toThrow();
  });
});

describe("identity headers from the gateway", () => {
  const key = "internal-key";
  const identity = { userId: ID, role: "warehouse_staff" as const, warehouseId: "wh-1" };

  it("round trips a signed identity", () => {
    expect(readIdentityHeaders(signIdentityHeaders(identity, key), key)).toEqual(identity);
  });

  it("rejects headers signed with a different key", () => {
    expect(readIdentityHeaders(signIdentityHeaders(identity, "other"), key)).toBeNull();
  });

  it("rejects headers whose role was changed after signing (privilege escalation)", () => {
    const headers = signIdentityHeaders({ ...identity, role: "customer" }, key);
    headers["x-user-role"] = "admin";
    expect(readIdentityHeaders(headers, key)).toBeNull();
  });

  it("rejects a missing signature or missing parts", () => {
    expect(readIdentityHeaders({ "x-user-id": ID, "x-user-role": "admin" }, key)).toBeNull();
    expect(readIdentityHeaders({}, key)).toBeNull();
  });
});

describe("warehouse scope", () => {
  it("lets staff touch their own warehouse and no other", () => {
    const staff = { userId: ID, role: "warehouse_staff" as const, warehouseId: "wh-1" };
    expect(() => assertWarehouseScope(staff, "wh-1")).not.toThrow();
    expect(() => assertWarehouseScope(staff, "wh-2")).toThrow(AuthError);
  });

  it("lets an admin touch any warehouse", () => {
    expect(() =>
      assertWarehouseScope({ userId: ID, role: "admin", warehouseId: null }, "wh-2"),
    ).not.toThrow();
  });
});
