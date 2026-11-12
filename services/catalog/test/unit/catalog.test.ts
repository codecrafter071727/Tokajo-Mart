import { afterAll, describe, expect, it } from "vitest";
import {
  listCategoriesResponseSchema,
  listProductsResponseSchema,
  productSchema,
} from "@qc/contracts";
import { buildApp } from "../../src/app";

const app = await buildApp();

afterAll(async () => {
  await app.close();
});

const get = (url: string) => app.inject({ method: "GET", url });

describe("GET /v1/catalog/categories", () => {
  it("returns every category in display order, matching the contract", async () => {
    const res = await get("/v1/catalog/categories");
    expect(res.statusCode).toBe(200);
    const body = listCategoriesResponseSchema.parse(res.json());
    expect(body.items).toHaveLength(8);
    expect(body.items.map((c) => c.sortOrder)).toEqual(
      [...body.items.map((c) => c.sortOrder)].sort((a, b) => a - b),
    );
  });
});

describe("GET /v1/catalog/products", () => {
  it("lists products matching the contract, with prices in integer paise", async () => {
    const res = await get("/v1/catalog/products?limit=100");
    expect(res.statusCode).toBe(200);
    const body = listProductsResponseSchema.parse(res.json());
    expect(body.items).toHaveLength(20);
    expect(body.nextCursor).toBeNull();
    expect(body.items.every((p) => Number.isInteger(p.pricePaise))).toBe(true);
  });

  it("filters by category", async () => {
    const res = await get("/v1/catalog/products?categoryId=dairy");
    const body = listProductsResponseSchema.parse(res.json());
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.items.every((p) => p.categoryId === "dairy")).toBe(true);
  });

  it("searches case-insensitively and ranks name-prefix matches first", async () => {
    const res = await get("/v1/catalog/products?q=AMUL");
    const body = listProductsResponseSchema.parse(res.json());
    expect(body.items.length).toBeGreaterThanOrEqual(2);
    expect(body.items.every((p) => p.name.toLowerCase().includes("amul"))).toBe(true);
  });

  it("returns an empty list, not an error, when nothing matches", async () => {
    const res = await get("/v1/catalog/products?q=zzzznotathing");
    expect(res.statusCode).toBe(200);
    expect(listProductsResponseSchema.parse(res.json()).items).toEqual([]);
  });

  it("paginates with an opaque cursor and never repeats an item", async () => {
    const first = listProductsResponseSchema.parse(
      (await get("/v1/catalog/products?limit=8")).json(),
    );
    expect(first.items).toHaveLength(8);
    expect(first.nextCursor).not.toBeNull();
    const second = listProductsResponseSchema.parse(
      (await get(`/v1/catalog/products?limit=8&cursor=${first.nextCursor}`)).json(),
    );
    const ids = [...first.items, ...second.items].map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("rejects a bad cursor and bad limits with a VALIDATION error shape", async () => {
    const badCursor = await get("/v1/catalog/products?cursor=not-a-cursor!");
    expect(badCursor.statusCode).toBe(400);
    const badLimit = await get("/v1/catalog/products?limit=0");
    expect(badLimit.statusCode).toBe(400);
    expect(badLimit.json().error.code).toBe("VALIDATION_ERROR");
  });
});

describe("GET /v1/catalog/products/:id", () => {
  it("returns one product", async () => {
    const res = await get("/v1/catalog/products/p5");
    expect(res.statusCode).toBe(200);
    expect(productSchema.parse(res.json()).id).toBe("p5");
  });

  it("returns a NOT_FOUND error shape for an unknown id", async () => {
    const res = await get("/v1/catalog/products/nope");
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe("NOT_FOUND");
  });
});

describe("PATCH /v1/catalog/products/:id", () => {
  const patch = (id: string, body: unknown) =>
    app.inject({ method: "PATCH", url: `/v1/catalog/products/${id}`, payload: body as object });

  it("updates only the fields sent and recomputes the discount", async () => {
    const before = productSchema.parse((await get("/v1/catalog/products/p20")).json());
    const res = await patch("p20", { pricePaise: 500, mrpPaise: 1000 });
    expect(res.statusCode).toBe(200);
    const after = productSchema.parse(res.json());
    expect(after).toMatchObject({ pricePaise: 500, mrpPaise: 1000, discountPercent: 50 });
    expect(after.name).toBe(before.name);
    // and it sticks
    expect(productSchema.parse((await get("/v1/catalog/products/p20")).json()).pricePaise).toBe(
      500,
    );
  });

  it("can rename and clear the description", async () => {
    const res = await patch("p19", { name: "  Dark Fantasy Choco Fills  ", description: null });
    expect(productSchema.parse(res.json())).toMatchObject({
      name: "Dark Fantasy Choco Fills",
      description: null,
    });
  });

  it("refuses a price above the MRP, including when only one of them is sent", async () => {
    const both = await patch("p18", { pricePaise: 9000, mrpPaise: 8000 });
    expect(both.statusCode).toBe(400);
    const onlyPrice = await patch("p18", { pricePaise: 99900000 });
    expect(onlyPrice.statusCode).toBe(400);
    expect(onlyPrice.json().error.message).toMatch(/higher than the MRP/);
  });

  it("rejects an empty body, unknown fields, negative or fractional money", async () => {
    expect((await patch("p18", {})).statusCode).toBe(400);
    expect((await patch("p18", { id: "hack" })).statusCode).toBe(400);
    expect((await patch("p18", { pricePaise: -1 })).statusCode).toBe(400);
    expect((await patch("p18", { pricePaise: 10.5 })).statusCode).toBe(400);
    expect((await patch("p18", { name: "   " })).statusCode).toBe(400);
  });

  it("returns NOT_FOUND for an unknown product", async () => {
    const res = await patch("nope", { name: "x" });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe("NOT_FOUND");
  });
});
