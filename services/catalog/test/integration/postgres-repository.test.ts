import { afterAll, describe, expect, it } from "vitest";
import { createDb } from "@qc/service-kit";
import type { DB } from "../../src/db/types.generated";
import { createPostgresCatalogRepository, escapeLike } from "../../src/modules/catalog";
import { catalogRepositoryContract } from "../shared/catalog-repository.contract";

// Runs only when a migrated and seeded test database is available (see scripts/db-migrate.mjs).
const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

suite("Postgres catalog repository", () => {
  const db = createDb<DB>(url as string, 2);
  afterAll(async () => {
    // The contract tests archive what they create. Remove it for good so runs stay repeatable.
    await db.deleteFrom("catalog.products").where("id", "like", "p-%").execute();
    await db
      .deleteFrom("catalog.productGroups")
      .where("id", "not in", ["g-amul-taaza", "g-coca-cola"])
      .execute();
    // Sub categories first, then their parents
    await db.deleteFrom("catalog.categories").where("parentId", "like", "test-cat-%").execute();
    await db.deleteFrom("catalog.categories").where("id", "like", "test-cat-%").execute();
    await db.deleteFrom("catalog.categories").where("id", "like", "edit-cat-%").execute();
    await db.deleteFrom("catalog.categories").where("id", "like", "full-cat-%").execute();
    await db.deleteFrom("catalog.banners").where("sortOrder", ">=", 900).execute();
    await db.destroy();
  });

  catalogRepositoryContract("postgres", () => createPostgresCatalogRepository(db));

  it("treats % and _ in a search literally, never as wildcards", async () => {
    const repo = createPostgresCatalogRepository(db);
    expect((await repo.listProducts({ q: "%", limit: 40, offset: 0 })).items).toEqual([]);
    expect((await repo.listProducts({ q: "a_b", limit: 40, offset: 0 })).items).toEqual([]);
    expect(escapeLike("100%_\\")).toBe("100\\%\\_\\\\");
  });

  it("is refused by the database itself when a price would exceed the MRP", async () => {
    const repo = createPostgresCatalogRepository(db);
    await expect(repo.updateProduct("p18", { pricePaise: 99_999_999 })).rejects.toThrow(
      /products_price_not_above_mrp/,
    );
  });

  it("never returns a product that was soft deleted", async () => {
    await db
      .updateTable("catalog.products")
      .set({ deletedAt: new Date() })
      .where("id", "=", "p17")
      .execute();
    try {
      const repo = createPostgresCatalogRepository(db);
      expect(await repo.getProduct("p17")).toBeNull();
      const { items } = await repo.listProducts({ limit: 100, offset: 0 });
      expect(items.some((p) => p.id === "p17")).toBe(false);
    } finally {
      await db
        .updateTable("catalog.products")
        .set({ deletedAt: null })
        .where("id", "=", "p17")
        .execute();
    }
  });
});
