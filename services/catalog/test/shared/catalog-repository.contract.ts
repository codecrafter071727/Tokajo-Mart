import { describe, expect, it } from "vitest";
import type { CatalogRepository } from "../../src/modules/catalog";

/**
 * Behaviour every CatalogRepository must have. It runs against the in-memory repository and
 * against Postgres, so the two can never quietly drift apart.
 */
export function catalogRepositoryContract(
  name: string,
  make: () => Promise<CatalogRepository> | CatalogRepository,
) {
  describe(`CatalogRepository contract: ${name}`, () => {
    it("lists categories in display order", async () => {
      const repo = await make();
      const categories = await repo.listCategories();
      expect(categories).toHaveLength(8);
      const order = categories.map((c) => c.sortOrder);
      expect(order).toEqual([...order].sort((a, b) => a - b));
    });

    it("filters products by category", async () => {
      const repo = await make();
      const { items } = await repo.listProducts({ categoryId: "dairy", limit: 40, offset: 0 });
      expect(items.length).toBeGreaterThan(0);
      expect(items.every((p) => p.categoryId === "dairy")).toBe(true);
    });

    it("ranks a name prefix above a looser match", async () => {
      const repo = await make();
      const { items } = await repo.listProducts({ q: "amul", limit: 40, offset: 0 });
      expect(items.length).toBeGreaterThanOrEqual(3);
      expect(items.every((p) => p.name.toLowerCase().includes("amul"))).toBe(true);
    });

    it("finds a word in the middle of a name, case insensitively", async () => {
      const repo = await make();
      const { items } = await repo.listProducts({ q: "FRESH", limit: 40, offset: 0 });
      expect(items.some((p) => p.name.toLowerCase().includes("fresh"))).toBe(true);
    });

    it("returns nothing, not an error, when nothing matches", async () => {
      const repo = await make();
      expect((await repo.listProducts({ q: "zzzznotathing", limit: 40, offset: 0 })).items).toEqual(
        [],
      );
    });

    it("pages without repeating or skipping items and reports the end", async () => {
      const repo = await make();
      const all = await repo.listProducts({ limit: 100, offset: 0 });
      const first = await repo.listProducts({ limit: 8, offset: 0 });
      expect(first.items).toHaveLength(8);
      expect(first.nextOffset).toBe(8);
      const second = await repo.listProducts({ limit: 8, offset: first.nextOffset! });
      const third = await repo.listProducts({ limit: 8, offset: second.nextOffset! });
      expect(third.nextOffset).toBeNull();
      const paged = [...first.items, ...second.items, ...third.items].map((p) => p.id);
      expect(new Set(paged).size).toBe(paged.length);
      expect(paged).toHaveLength(all.items.length);
    });

    it("gets one product, and null for an unknown id", async () => {
      const repo = await make();
      expect((await repo.getProduct("p5"))?.id).toBe("p5");
      expect(await repo.getProduct("nope")).toBeNull();
    });

    it("updates only the fields sent and recomputes the discount", async () => {
      const repo = await make();
      const before = (await repo.getProduct("p20"))!;
      try {
        const after = (await repo.updateProduct("p20", { pricePaise: 500, mrpPaise: 1000 }))!;
        expect(after).toMatchObject({ pricePaise: 500, mrpPaise: 1000, discountPercent: 50 });
        expect(after.name).toBe(before.name);
        expect((await repo.getProduct("p20"))!.pricePaise).toBe(500);
      } finally {
        await repo.updateProduct("p20", {
          pricePaise: before.pricePaise,
          mrpPaise: before.mrpPaise,
        });
      }
    });

    it("can clear a description and trims nothing it was not asked to", async () => {
      const repo = await make();
      const before = (await repo.getProduct("p19"))!;
      try {
        const after = (await repo.updateProduct("p19", { description: null }))!;
        expect(after.description).toBeNull();
        expect(after.unit).toBe(before.unit);
      } finally {
        await repo.updateProduct("p19", { description: before.description });
      }
    });

    it("returns null when updating a product that does not exist", async () => {
      const repo = await make();
      expect(await repo.updateProduct("nope", { name: "x" })).toBeNull();
    });
  });
}
