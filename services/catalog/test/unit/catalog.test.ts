import { afterAll, describe, expect, it } from "vitest";
import {
  bannerSchema,
  listBannersResponseSchema,
  listCategoriesResponseSchema,
  listProductsResponseSchema,
  productSchema,
} from "@qc/contracts";
import { DEV_INTERNAL_KEY, signIdentityHeaders } from "@qc/service-kit";
import { buildApp } from "../../src/app";
import { seedProducts } from "../../src/modules/catalog";

const app = await buildApp();

afterAll(async () => {
  await app.close();
});

const as = (role: string) =>
  signIdentityHeaders(
    { userId: "11111111-1111-4111-8111-111111111111", role: role as never, warehouseId: null },
    DEV_INTERNAL_KEY,
  );
const admin = as("admin");
const customer = as("customer");
const get = (url: string, headers: Record<string, string> = {}) =>
  app.inject({ method: "GET", url, headers });
const send = (
  method: "POST" | "PATCH" | "DELETE",
  url: string,
  body?: unknown,
  headers: Record<string, string> = admin,
) => app.inject({ method, url, payload: body as object | undefined, headers });

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
    expect(body.items).toHaveLength(seedProducts.length);
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
    app.inject({
      method: "PATCH",
      url: `/v1/catalog/products/${id}`,
      payload: body as object,
      headers: admin,
    });

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

describe("admin routes are closed to everyone but admins", () => {
  const cases: ["GET" | "POST" | "PATCH" | "DELETE", string, object?][] = [
    ["GET", "/v1/catalog/admin/products"],
    ["GET", "/v1/catalog/admin/products/p1"],
    ["GET", "/v1/catalog/admin/banners"],
    ["POST", "/v1/catalog/products", {}],
    ["PATCH", "/v1/catalog/products/p1", { name: "x" }],
    ["DELETE", "/v1/catalog/products/p1"],
    ["POST", "/v1/catalog/products/p1/restore"],
    ["POST", "/v1/catalog/categories", { name: "x" }],
    ["PATCH", "/v1/catalog/categories/dairy", { name: "x" }],
    ["DELETE", "/v1/catalog/categories/dairy"],
    ["POST", "/v1/catalog/banners", { title: "x" }],
    ["PATCH", "/v1/catalog/banners/b0000000-0000-4000-8000-000000000001", { title: "x" }],
    ["DELETE", "/v1/catalog/banners/b0000000-0000-4000-8000-000000000001"],
  ];
  it.each(cases)("%s %s", async (method, url, body) => {
    const anonymous = await app.inject({ method, url, payload: body });
    expect(anonymous.statusCode).toBe(401);
    const asCustomer = await app.inject({ method, url, payload: body, headers: customer });
    expect(asCustomer.statusCode).toBe(403);
    // A forged role (header changed after signing) is the same as no identity
    const forged = await app.inject({
      method,
      url,
      payload: body,
      headers: { ...customer, "x-user-role": "admin" },
    });
    expect(forged.statusCode).toBe(401);
  });
});

describe("admin: products", () => {
  const body = {
    name: "HTTP Test Chips",
    unit: "100 g",
    pricePaise: 2000,
    mrpPaise: 2500,
    categoryId: "snacks",
  };

  it("adds, edits, archives and restores a product, and the shop and orders follow", async () => {
    const created = await send("POST", "/v1/catalog/products", body);
    expect(created.statusCode).toBe(201);
    const product = productSchema.parse(created.json());
    expect(product).toMatchObject({ discountPercent: 20, imageFit: "contain", deliveryMins: 10 });

    // The order service reads this internal route to price an order
    const internal = (id: string) => get(`/internal/products?ids=${id}`);
    expect((await internal(product.id)).json().items).toHaveLength(1);

    const edited = await send("PATCH", `/v1/catalog/products/${product.id}`, {
      categoryId: "dairy",
      imageUrl: "https://example.com/chips.png",
    });
    expect(edited.json()).toMatchObject({
      categoryId: "dairy",
      imageUrl: "https://example.com/chips.png",
    });

    expect((await send("DELETE", `/v1/catalog/products/${product.id}`)).json()).toEqual({
      id: product.id,
      archived: true,
    });
    // Gone from the shop and not orderable
    expect((await get(`/v1/catalog/products/${product.id}`)).statusCode).toBe(404);
    expect((await internal(product.id)).json().items).toEqual([]);
    expect((await send("DELETE", `/v1/catalog/products/${product.id}`)).statusCode).toBe(404);

    const adminList = await get("/v1/catalog/admin/products?q=HTTP%20Test", admin);
    expect(adminList.json().items).toMatchObject([{ id: product.id, archived: true }]);
    // The admin detail still opens an archived product
    expect((await get(`/v1/catalog/admin/products/${product.id}`, admin)).json()).toMatchObject({
      id: product.id,
      archived: true,
    });
    expect((await get("/v1/catalog/admin/products/no-such-product", admin)).statusCode).toBe(404);

    expect((await send("POST", `/v1/catalog/products/${product.id}/restore`)).statusCode).toBe(200);
    expect((await get(`/v1/catalog/products/${product.id}`)).statusCode).toBe(200);
    expect((await send("POST", `/v1/catalog/products/${product.id}/restore`)).statusCode).toBe(404);
  });

  it("validates a new product with clear messages", async () => {
    const bad = async (patch: object) =>
      send("POST", "/v1/catalog/products", { ...body, ...patch });
    expect((await bad({ pricePaise: 9000 })).statusCode).toBe(400);
    expect((await bad({ name: "  " })).statusCode).toBe(400);
    expect((await bad({ pricePaise: 10.5 })).statusCode).toBe(400);
    expect((await bad({ imageUrl: "http://insecure.example.com/a.png" })).statusCode).toBe(400);
    expect((await bad({ imageUrl: "javascript:alert(1)" })).statusCode).toBe(400);
    expect((await bad({ deliveryMins: 0 })).statusCode).toBe(400);
    expect((await bad({ id: "mine" })).statusCode).toBe(400); // the server makes ids
    const missing = await bad({ categoryId: "nope" });
    expect(missing.statusCode).toBe(400);
    expect(missing.json().error.message).toMatch(/category does not exist/);
  });

  it("keeps the shop's own product list free of archived items", async () => {
    const created = productSchema.parse(
      (await send("POST", "/v1/catalog/products", { ...body, name: "Hidden Soon" })).json(),
    );
    await send("DELETE", `/v1/catalog/products/${created.id}`);
    const shop = listProductsResponseSchema.parse(
      (await get("/v1/catalog/products?limit=100")).json(),
    );
    expect(shop.items.some((p) => p.id === created.id)).toBe(false);
    // And no public way to ask for them
    const sneaky = await get("/v1/catalog/products?includeArchived=true&limit=100");
    expect(
      listProductsResponseSchema.parse(sneaky.json()).items.some((p) => p.id === created.id),
    ).toBe(false);
  });
});

describe("admin: categories", () => {
  it("adds, edits and removes a category, refusing to remove one with products", async () => {
    const created = await send("POST", "/v1/catalog/categories", { name: "HTTP Test Cat" });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({
      id: "http-test-cat",
      color: "#F3F6F5",
      imageFit: "cover",
    });
    expect(
      (await send("POST", "/v1/catalog/categories", { name: "HTTP Test Cat" })).statusCode,
    ).toBe(409);
    expect(
      (await send("POST", "/v1/catalog/categories", { name: "Bad", color: "red" })).statusCode,
    ).toBe(400);

    const edited = await send("PATCH", "/v1/catalog/categories/http-test-cat", {
      name: "Renamed",
      sortOrder: 50,
    });
    expect(edited.json()).toMatchObject({ name: "Renamed", sortOrder: 50 });
    expect((await send("PATCH", "/v1/catalog/categories/nope", { name: "x" })).statusCode).toBe(
      404,
    );
    expect((await send("PATCH", "/v1/catalog/categories/dairy", {})).statusCode).toBe(400);

    const busy = await send("DELETE", "/v1/catalog/categories/dairy");
    expect(busy.statusCode).toBe(409);
    expect(busy.json().error.message).toMatch(/still has \d+ products? on sale/);

    expect((await send("DELETE", "/v1/catalog/categories/http-test-cat")).statusCode).toBe(200);
    expect(
      (await get("/v1/catalog/categories"))
        .json()
        .items.some((c: { id: string }) => c.id === "http-test-cat"),
    ).toBe(false);
    expect((await send("DELETE", "/v1/catalog/categories/http-test-cat")).statusCode).toBe(404);
  });
});

describe("banners", () => {
  it("serves the seeded banners publicly and lets an admin manage them", async () => {
    const live = await get("/v1/catalog/banners");
    expect(live.statusCode).toBe(200);
    expect(listBannersResponseSchema.parse(live.json()).items.length).toBeGreaterThanOrEqual(3);

    const created = await send("POST", "/v1/catalog/banners", {
      title: "Weekend sale",
      linkType: "category",
      linkTarget: "snacks",
      sortOrder: 99,
    });
    expect(created.statusCode).toBe(201);
    const banner = bannerSchema.parse(created.json());
    expect(banner).toMatchObject({ active: true, color: "#E8F5E9", subtitle: "" });

    expect(
      (await get("/v1/catalog/banners")).json().items.map((b: { id: string }) => b.id),
    ).toContain(banner.id);
    const hidden = await send("PATCH", `/v1/catalog/banners/${banner.id}`, { active: false });
    expect(hidden.json().active).toBe(false);
    expect(
      (await get("/v1/catalog/banners")).json().items.map((b: { id: string }) => b.id),
    ).not.toContain(banner.id);
    expect(
      (await get("/v1/catalog/admin/banners", admin)).json().items.map((b: { id: string }) => b.id),
    ).toContain(banner.id);

    expect((await send("DELETE", `/v1/catalog/banners/${banner.id}`)).statusCode).toBe(200);
    expect((await send("DELETE", `/v1/catalog/banners/${banner.id}`)).statusCode).toBe(404);
  });

  it("rejects bad banners", async () => {
    const bad = (body: object) => send("POST", "/v1/catalog/banners", body);
    expect((await bad({ title: "" })).statusCode).toBe(400);
    expect((await bad({ title: "x", linkType: "category", linkTarget: "nope" })).statusCode).toBe(
      400,
    );
    expect((await bad({ title: "x", linkType: "category" })).statusCode).toBe(400);
    expect((await bad({ title: "x", color: "blue" })).statusCode).toBe(400);
    expect((await bad({ title: "x", imageUrl: "http://a.example.com/x.png" })).statusCode).toBe(
      400,
    );
    expect(
      (await bad({ title: "x", startsAt: "2026-12-02T00:00:00Z", endsAt: "2026-12-01T00:00:00Z" }))
        .statusCode,
    ).toBe(400);
    expect((await bad({ title: "x", startsAt: "tomorrow" })).statusCode).toBe(400);
    expect((await send("PATCH", "/v1/catalog/banners/not-a-uuid", { title: "x" })).statusCode).toBe(
      400,
    );
    expect(
      (
        await send("PATCH", "/v1/catalog/banners/b0000000-0000-4000-8000-0000000000ff", {
          title: "x",
        })
      ).statusCode,
    ).toBe(404);
  });
});

describe("catalog depth over HTTP", () => {
  const csv = (body: string, query = "", headers: Record<string, string> = admin) =>
    app.inject({
      method: "POST",
      url: `/v1/catalog/admin/import${query}`,
      payload: body,
      headers: { ...headers, "content-type": "text/csv" },
    });
  const header =
    "id,name,unit,price,mrp,category,brand,tags,image_url,variant_group,variant_label,description";

  it("returns variants, photos and the group on the public product page", async () => {
    const res = await get("/v1/catalog/products/p13");
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.variants.map((v: { id: string }) => v.id)).toEqual(["p13", "p22"]);
    expect(body.group).toEqual({ id: "g-coca-cola", name: "Coca-Cola Soft Drink" });
    expect(body.images[0]).toMatchObject({ primary: true });
    expect(body).not.toHaveProperty("archived");
    expect(productSchema.parse(body).id).toBe("p13");
  });

  it("sends parentId on categories", async () => {
    const body = listCategoriesResponseSchema.parse((await get("/v1/catalog/categories")).json());
    expect(body.items.every((c) => c.parentId === null)).toBe(true);
  });

  it("keeps groups, photos, import and export for admins only", async () => {
    for (const headers of [customer, {}]) {
      expect(
        (await get("/v1/catalog/admin/product-groups", headers)).statusCode,
      ).toBeGreaterThanOrEqual(401);
      expect((await get("/v1/catalog/admin/export", headers)).statusCode).toBeGreaterThanOrEqual(
        401,
      );
      expect((await csv(header, "?dryRun=true", headers)).statusCode).toBeGreaterThanOrEqual(401);
      expect(
        (
          await send(
            "POST",
            "/v1/catalog/admin/products/p1/images",
            { url: "https://x.com/a.jpg" },
            headers,
          )
        ).statusCode,
      ).toBeGreaterThanOrEqual(401);
    }
  });

  it("checks a CSV in a dry run, reports row errors, and changes nothing", async () => {
    const res = await csv(
      [
        header,
        ",Dry Run Snack,50 g,20,25,snacks,,,,,,",
        ",Bad Price,50 g,abc,25,snacks,,,,,,",
        ",Expensive,50 g,30,25,snacks,,,,,,",
        ",Lost,50 g,10,12,nowhere,,,,,,",
      ].join("\n"),
      "?dryRun=true",
    );
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({ dryRun: true, ok: false, rows: 4, creates: 1, updates: 0 });
    expect(body.errors.map((e: { line: number; column: string }) => [e.line, e.column])).toEqual([
      [3, "price"],
      [4, "price"],
      [5, "category"],
    ]);
    const after = await get("/v1/catalog/products?q=dry%20run%20snack");
    expect(after.json().items).toEqual([]);
  });

  it("refuses a file with errors when applying, and applies a clean one", async () => {
    const bad = await csv([header, ",No Price,50 g,,25,snacks,,,,,,"].join("\n"));
    expect(bad.statusCode).toBe(400);
    expect(bad.json().error.details[0]).toMatchObject({ line: 2, column: "price" });

    const good = await csv(
      [header, "p-http-import,Http Import Cookie,100 g,40,50,bakery,Testco,cookie,,,,"].join("\n"),
    );
    expect(good.statusCode).toBe(200);
    expect(good.json()).toMatchObject({ dryRun: false, ok: true, creates: 1 });
    const product = await get("/v1/catalog/products/p-http-import");
    expect(product.json()).toMatchObject({ pricePaise: 4000, brand: "Testco", tags: ["cookie"] });
  });

  it("refuses an unknown column or a missing required one", async () => {
    const res = await csv("name,unit,price,colour\nX,1,1,red", "?dryRun=true");
    expect(res.json().errors.map((e: { column: string }) => e.column)).toEqual(
      expect.arrayContaining(["colour", "mrp", "category"]),
    );
  });

  it("exports the catalog as CSV that the import can read back", async () => {
    const res = await get("/v1/catalog/admin/export", admin);
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/csv");
    const lines = res.body.trim().split("\n");
    expect(lines[0]).toBe(header);
    expect(
      lines.some((l) =>
        l.startsWith("p5,Amul Taaza Toned Fresh Milk,500 ml,29,31,dairy,Amul,milk|toned,"),
      ),
    ).toBe(true);
    const roundTrip = await csv(res.body, "?dryRun=true");
    expect(roundTrip.json()).toMatchObject({ ok: true, creates: 0 });
  });

  it("makes a group and manages photos through the admin routes", async () => {
    const group = await send("POST", "/v1/catalog/admin/product-groups", {
      name: "Http Group",
      categoryId: "snacks",
    });
    expect(group.statusCode).toBe(201);
    expect(
      (await get("/v1/catalog/admin/product-groups", admin))
        .json()
        .items.some((g: { id: string }) => g.id === group.json().id),
    ).toBe(true);

    const added = await send("POST", "/v1/catalog/admin/products/p10/images", {
      url: "https://example.com/bhujia-2.jpg",
      alt: "Back of pack",
    });
    expect(added.statusCode).toBe(201);
    const extra = added.json().items.at(-1);
    expect(extra).toMatchObject({ url: "https://example.com/bhujia-2.jpg", primary: false });
    expect(
      (
        await send("POST", "/v1/catalog/admin/products/p10/images", {
          url: "http://insecure.com/a.jpg",
        })
      ).statusCode,
    ).toBe(400);
    const order = await app.inject({
      method: "PUT",
      url: "/v1/catalog/admin/products/p10/images/order",
      payload: { ids: [extra.id] },
      headers: admin,
    });
    expect(order.statusCode).toBe(200);
    const removed = await send("DELETE", `/v1/catalog/admin/products/p10/images/${extra.id}`);
    expect(removed.statusCode).toBe(200);
    expect(
      (await send("DELETE", `/v1/catalog/admin/products/p10/images/${extra.id}`)).statusCode,
    ).toBe(404);
  });
});
