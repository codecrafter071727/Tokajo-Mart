import { afterAll, expect, it } from "vitest";
import { buildApp } from "../../src/app";

const app = await buildApp();

afterAll(async () => {
  await app.close();
});

it("GET /health/live", async () => {
  const response = await app.inject({ method: "GET", url: "/health/live" });
  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual({
    status: "ok",
    service: "order",
    checks: { process: "ok", database: "skipped" },
  });
});

it("GET /health/ready", async () => {
  const response = await app.inject({ method: "GET", url: "/health/ready" });
  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual({
    status: "ok",
    service: "order",
    checks: { process: "ok", database: "skipped" },
  });
});
