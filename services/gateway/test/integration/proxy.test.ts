import {
  DEV_INTERNAL_KEY,
  DEV_JWT_SECRET,
  readIdentityHeaders,
  signAccessToken,
} from "@qc/service-kit";
import Fastify from "fastify";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app";

// A stand in for every service: it echoes what it was sent
const upstream = Fastify();
upstream.removeAllContentTypeParsers();
upstream.addContentTypeParser("*", { parseAs: "string" }, (_r, body, done) => done(null, body));
upstream.all("/*", async (request, reply) => {
  if (request.url.includes("boom")) return reply.status(409).send({ error: { code: "CONFLICT" } });
  return {
    method: request.method,
    url: request.url,
    body: request.body,
    headers: request.headers,
    identity: readIdentityHeaders(request.headers, DEV_INTERNAL_KEY),
  };
});

let url = "";
let app: Awaited<ReturnType<typeof buildApp>>;
const token = (role: "customer" | "admin" | "rider", warehouseId?: string) =>
  signAccessToken(
    { userId: "11111111-1111-4111-8111-111111111111", role, warehouseId },
    { secret: DEV_JWT_SECRET, ttlSeconds: 600 },
  );

beforeAll(async () => {
  await upstream.listen({ port: 0, host: "127.0.0.1" });
  url = `http://127.0.0.1:${(upstream.server.address() as AddressInfo).port}`;
  app = await buildApp({
    targets: { identity: url, catalog: url, inventory: url, order: url, delivery: url },
  });
});
afterAll(async () => {
  await app.close();
  await upstream.close();
});

const call = (
  method: "GET" | "POST" | "PATCH",
  path: string,
  init: { token?: string; body?: object; headers?: Record<string, string> } = {},
) =>
  app.inject({
    method,
    url: path,
    payload: init.body ? JSON.stringify(init.body) : undefined,
    headers: {
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(init.token ? { authorization: `Bearer ${init.token}` } : {}),
      ...init.headers,
    },
  });

describe("gateway", () => {
  it("passes public reads through without an identity", async () => {
    const res = await call("GET", "/v1/catalog/products?limit=2");
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      method: "GET",
      url: "/v1/catalog/products?limit=2",
      identity: null,
    });
  });

  it("rejects a missing, malformed or forged token on a protected route", async () => {
    expect((await call("GET", "/v1/orders")).statusCode).toBe(401);
    expect((await call("GET", "/v1/orders", { token: "nonsense" })).statusCode).toBe(401);
    expect(
      (await call("GET", "/v1/orders", { token: `${await token("customer")}x` })).statusCode,
    ).toBe(401);
  });

  it("forwards a verified identity as signed headers and drops forged ones", async () => {
    const res = await call("GET", "/v1/orders", {
      token: await token("customer"),
      headers: { "x-user-role": "admin", "x-user-id": "attacker", "x-internal-key": "guess" },
    });
    const echoed = res.json();
    expect(echoed.identity).toEqual({
      userId: "11111111-1111-4111-8111-111111111111",
      role: "customer",
      warehouseId: null,
    });
    expect(echoed.headers["x-internal-key"]).toBeUndefined();
    expect(echoed.headers["x-request-id"]).toBeTruthy();
  });

  it("carries the warehouse claim for staff and rider tokens", async () => {
    const res = await call("GET", "/v1/delivery/mine", {
      token: await token("rider", "wh-noida-62"),
    });
    expect(res.json().identity).toMatchObject({ role: "rider", warehouseId: "wh-noida-62" });
  });

  it("enforces roles before the service is called", async () => {
    expect(
      (await call("PATCH", "/v1/catalog/products/p1", { token: await token("customer"), body: {} }))
        .statusCode,
    ).toBe(403);
    expect((await call("PATCH", "/v1/catalog/products/p1", { body: {} })).statusCode).toBe(401);
    expect(
      (
        await call("PATCH", "/v1/catalog/products/p1", {
          token: await token("admin"),
          body: { name: "x" },
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (await call("POST", "/v1/identity/admin/riders", { token: await token("rider"), body: {} }))
        .statusCode,
    ).toBe(403);
  });

  it("keeps stock tools for staff but leaves availability public", async () => {
    expect(
      (await call("GET", "/v1/inventory/availability?warehouseId=w&productIds=p1")).statusCode,
    ).toBe(200);
    expect((await call("GET", "/v1/inventory/stock")).statusCode).toBe(401);
    expect(
      (await call("GET", "/v1/inventory/stock", { token: await token("customer") })).statusCode,
    ).toBe(403);
    expect(
      (await call("GET", "/v1/inventory/warehouses", { token: await token("rider") })).statusCode,
    ).toBe(403);
    expect(
      (await call("GET", "/v1/inventory/stock", { token: await token("admin") })).statusCode,
    ).toBe(200);
  });

  it("forwards bodies and idempotency keys untouched", async () => {
    const res = await call("POST", "/v1/orders", {
      token: await token("customer"),
      body: { a: 1 },
      headers: { "idempotency-key": "abc-123" },
    });
    expect(JSON.parse(res.json().body)).toEqual({ a: 1 });
    expect(res.json().headers["idempotency-key"]).toBe("abc-123");
  });

  it("passes service errors through with their status", async () => {
    const res = await call("GET", "/v1/catalog/boom");
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe("CONFLICT");
  });

  it("never reaches internal routes or unknown paths", async () => {
    expect(
      (await call("GET", "/v1/identity/internal/riders", { token: await token("admin") }))
        .statusCode,
    ).toBe(404);
    expect((await call("GET", "/internal/riders")).statusCode).toBe(404);
    expect((await call("GET", "/v1/nothing")).statusCode).toBe(404);
  });

  it("answers 502 when a service is down", async () => {
    const down = await buildApp({ targets: { catalog: "http://127.0.0.1:9" } });
    const res = await down.inject({ method: "GET", url: "/v1/catalog/products" });
    expect(res.statusCode).toBe(502);
    await down.close();
  });

  it("limits sign in attempts per client", async () => {
    let last = 200;
    for (let i = 0; i < 25; i += 1)
      last = (await call("POST", "/v1/identity/auth/login", { body: {} })).statusCode;
    expect(last).toBe(429);
  });
});
