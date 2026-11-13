import { describe, expect, it } from "vitest";
import { CatalogError, parseImportCsv, type CatalogRepository } from "../../src/modules/catalog";

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
    // ---------------------------------------------------------------------------------------
    // Admin tools
    // ---------------------------------------------------------------------------------------
    const unique = () => Math.random().toString(36).slice(2, 8);
    const newProduct = (categoryId: string, extra: object = {}) => ({
      name: "Test Biscuits",
      unit: "200 g",
      pricePaise: 4000,
      mrpPaise: 5000,
      categoryId,
      emoji: "x",
      imageUrl: null,
      imageFit: "contain" as const,
      deliveryMins: 10,
      optionsCount: null,
      description: null,
      ...extra,
    });
    const categoryBase = {
      name: "",
      emoji: "",
      color: "#F3F6F5",
      imageUrl: null,
      imageFit: "cover" as const,
    };
    const rejectsWith = async (promise: Promise<unknown>, status: number, pattern: RegExp) => {
      const error = await promise.then(
        () => null,
        (e) => e,
      );
      expect(error).toBeInstanceOf(CatalogError);
      expect((error as CatalogError).statusCode).toBe(status);
      expect((error as CatalogError).message).toMatch(pattern);
    };

    describe("admin: products", () => {
      it("creates a product with a generated id, and it is on sale straight away", async () => {
        const repo = await make();
        const created = await repo.createProduct(newProduct("dairy", { name: `Zed ${unique()}` }));
        try {
          expect(created.id).toMatch(/^p-[0-9a-f]{8}$/);
          expect(created).toMatchObject({ pricePaise: 4000, mrpPaise: 5000, discountPercent: 20 });
          expect((await repo.getProduct(created.id))?.name).toBe(created.name);
          const found = await repo.listProducts({ q: created.name, limit: 10, offset: 0 });
          expect(found.items.map((p) => p.id)).toContain(created.id);
        } finally {
          await repo.archiveProduct(created.id);
        }
      });

      it("refuses a product in a category that does not exist", async () => {
        const repo = await make();
        await rejectsWith(repo.createProduct(newProduct("no-such-category")), 400, /category/);
      });

      it("edits the new fields: category, emoji, image, delivery time and options", async () => {
        const repo = await make();
        const created = await repo.createProduct(newProduct("dairy", { name: `Edit ${unique()}` }));
        try {
          const edited = (await repo.updateProduct(created.id, {
            categoryId: "snacks",
            emoji: "y",
            imageUrl: "https://example.com/a.png",
            imageFit: "cover",
            deliveryMins: 15,
            optionsCount: 3,
          }))!;
          expect(edited).toMatchObject({
            categoryId: "snacks",
            emoji: "y",
            imageUrl: "https://example.com/a.png",
            imageFit: "cover",
            deliveryMins: 15,
            optionsCount: 3,
          });
          await rejectsWith(
            repo.updateProduct(created.id, { categoryId: "nope" }),
            400,
            /category/,
          );
          expect((await repo.getProduct(created.id))?.categoryId).toBe("snacks");
        } finally {
          await repo.archiveProduct(created.id);
        }
      });

      it("archives a product: gone from the shop, still in the admin list, then restorable", async () => {
        const repo = await make();
        const created = await repo.createProduct(newProduct("dairy", { name: `Arch ${unique()}` }));
        expect(await repo.archiveProduct(created.id)).toBe(true);
        expect(await repo.archiveProduct(created.id)).toBe(false); // already archived
        expect(await repo.getProduct(created.id)).toBeNull();
        expect(await repo.updateProduct(created.id, { name: "x" })).toBeNull();
        const shop = await repo.listProducts({ q: created.name, limit: 10, offset: 0 });
        expect(shop.items).toEqual([]);
        const admin = await repo.listAdminProducts({ q: created.name, limit: 10, offset: 0 });
        expect(admin.items).toHaveLength(1);
        expect(admin.items[0]).toMatchObject({ id: created.id, archived: true });
        expect(await repo.getAdminProduct(created.id)).toMatchObject({
          id: created.id,
          archived: true,
        });
        expect(await repo.getAdminProduct("no-such-product")).toBeNull();

        expect((await repo.restoreProduct(created.id))?.id).toBe(created.id);
        expect(await repo.restoreProduct(created.id)).toBeNull(); // not archived any more
        expect((await repo.getProduct(created.id))?.id).toBe(created.id);
        expect((await repo.getAdminProduct(created.id))?.archived).toBe(false);
        expect(
          (await repo.listAdminProducts({ q: created.name, limit: 10, offset: 0 })).items[0]
            ?.archived,
        ).toBe(false);
        await repo.archiveProduct(created.id);
      });

      it("returns false or null for an unknown product", async () => {
        const repo = await make();
        expect(await repo.archiveProduct("nope")).toBe(false);
        expect(await repo.restoreProduct("nope")).toBeNull();
      });
    });

    describe("admin: categories", () => {
      const newCategory = (name: string, extra: object = {}) => ({
        name,
        emoji: "x",
        color: "#E8F5E9",
        imageUrl: null,
        imageFit: "cover" as const,
        ...extra,
      });

      it("creates a category with a readable id, placed last, and rejects a duplicate name", async () => {
        const repo = await make();
        const name = `Test Cat ${unique()}`;
        const created = await repo.createCategory(newCategory(name));
        try {
          expect(created.id).toMatch(/^test-cat-[a-z0-9]+$/);
          const all = await repo.listCategories();
          expect(all.at(-1)?.id).toBe(created.id);
          await rejectsWith(repo.createCategory(newCategory(name)), 409, /already exists/);
          await rejectsWith(repo.createCategory(newCategory("!!!")), 400, /letters or numbers/);
        } finally {
          await repo.deleteCategory(created.id);
        }
      });

      it("edits a category and returns null for an unknown one", async () => {
        const repo = await make();
        const created = await repo.createCategory(newCategory(`Edit Cat ${unique()}`));
        try {
          const edited = (await repo.updateCategory(created.id, {
            name: "Renamed",
            sortOrder: 77,
            color: "#FFF8E1",
          }))!;
          expect(edited).toMatchObject({
            id: created.id,
            name: "Renamed",
            sortOrder: 77,
            color: "#FFF8E1",
          });
          expect(await repo.updateCategory("nope", { name: "x" })).toBeNull();
        } finally {
          await repo.deleteCategory(created.id);
        }
      });

      it("will not delete a category that still has products on sale", async () => {
        const repo = await make();
        const category = await repo.createCategory(newCategory(`Full Cat ${unique()}`));
        const product = await repo.createProduct(
          newProduct(category.id, { name: `Inside ${unique()}` }),
        );
        await rejectsWith(repo.deleteCategory(category.id), 409, /still has 1 product on sale/);
        expect((await repo.listCategories()).some((c) => c.id === category.id)).toBe(true);
        // Archived products do not count, so once it is empty it can go
        await repo.archiveProduct(product.id);
        expect(await repo.deleteCategory(category.id)).toBe(true);
        expect((await repo.listCategories()).some((c) => c.id === category.id)).toBe(false);
        expect(await repo.deleteCategory(category.id)).toBe(false);
        await rejectsWith(repo.createProduct(newProduct(category.id)), 400, /category/);
      });
    });

    describe("banners", () => {
      const now = new Date("2026-11-13T10:00:00.000Z");
      const hours = (n: number) => new Date(now.getTime() + n * 3_600_000).toISOString();
      const newBanner = (title: string, extra: object = {}) => ({
        title,
        subtitle: "",
        imageUrl: null,
        linkType: "none" as const,
        linkTarget: null,
        color: "#E8F5E9",
        sortOrder: 900,
        active: true,
        startsAt: null,
        endsAt: null,
        ...extra,
      });

      it("shows only active banners inside their window, in display order", async () => {
        const repo = await make();
        const tag = unique();
        const made = [
          await repo.createBanner(newBanner(`B late ${tag}`, { sortOrder: 902 })),
          await repo.createBanner(newBanner(`B first ${tag}`, { sortOrder: 901 })),
          await repo.createBanner(newBanner(`B off ${tag}`, { active: false })),
          await repo.createBanner(newBanner(`B future ${tag}`, { startsAt: hours(2) })),
          await repo.createBanner(newBanner(`B expired ${tag}`, { endsAt: hours(-1) })),
          await repo.createBanner(
            newBanner(`B now ${tag}`, { startsAt: hours(-1), endsAt: hours(1), sortOrder: 903 }),
          ),
        ];
        try {
          const mine = (await repo.listLiveBanners(now)).filter((b) => b.title.endsWith(tag));
          expect(mine.map((b) => b.title)).toEqual([
            `B first ${tag}`,
            `B late ${tag}`,
            `B now ${tag}`,
          ]);
          const later = (await repo.listLiveBanners(new Date(hours(3)))).filter((b) =>
            b.title.endsWith(tag),
          );
          expect(later.map((b) => b.title)).toContain(`B future ${tag}`);
          expect(later.map((b) => b.title)).not.toContain(`B now ${tag}`);
          expect((await repo.listAllBanners()).filter((b) => b.title.endsWith(tag))).toHaveLength(
            6,
          );
        } finally {
          for (const b of made) await repo.deleteBanner(b.id);
        }
      });

      it("checks what a banner opens and when it runs", async () => {
        const repo = await make();
        await rejectsWith(
          repo.createBanner(newBanner("x", { linkType: "category", linkTarget: "nope" })),
          400,
          /category/,
        );
        await rejectsWith(
          repo.createBanner(newBanner("x", { linkType: "product", linkTarget: "nope" })),
          400,
          /product/,
        );
        await rejectsWith(
          repo.createBanner(newBanner("x", { linkType: "category", linkTarget: null })),
          400,
          /Say which/,
        );
        await rejectsWith(
          repo.createBanner(newBanner("x", { linkTarget: "dairy" })),
          400,
          /no link/,
        );
        await rejectsWith(
          repo.createBanner(newBanner("x", { startsAt: hours(2), endsAt: hours(1) })),
          400,
          /start before/,
        );
        const ok = await repo.createBanner(
          newBanner(`Link ${unique()}`, { linkType: "category", linkTarget: "dairy" }),
        );
        try {
          expect(ok).toMatchObject({ linkType: "category", linkTarget: "dairy" });
        } finally {
          await repo.deleteBanner(ok.id);
        }
      });

      it("edits, re-checks on edit, and deletes", async () => {
        const repo = await make();
        const banner = await repo.createBanner(newBanner(`Edit ${unique()}`));
        try {
          const edited = (await repo.updateBanner(banner.id, {
            title: "New title",
            active: false,
            linkType: "category",
            linkTarget: "snacks",
          }))!;
          expect(edited).toMatchObject({ title: "New title", active: false, linkTarget: "snacks" });
          await rejectsWith(repo.updateBanner(banner.id, { linkTarget: "nope" }), 400, /category/);
          await rejectsWith(repo.updateBanner(banner.id, { linkType: "none" }), 400, /no link/);
          expect(
            await repo.updateBanner("b0000000-0000-4000-8000-0000000000ff", { title: "x" }),
          ).toBeNull();
        } finally {
          expect(await repo.deleteBanner(banner.id)).toBe(true);
        }
        expect(await repo.deleteBanner(banner.id)).toBe(false);
      });
    });

    // ---------------------------------------------------------------------------------------
    // Catalog depth: sub categories, variants, photos, brand and tags search, CSV import
    // ---------------------------------------------------------------------------------------
    describe("sub categories", () => {
      it("nests one level, lists the child after its parent, and filters a parent with its children", async () => {
        const repo = await make();
        const parent = await repo.createCategory({
          ...categoryBase,
          name: `Test Cat Parent ${unique()}`,
        });
        const child = await repo.createCategory({
          ...categoryBase,
          name: `Test Cat Child ${unique()}`,
          parentId: parent.id,
        });
        const product = await repo.createProduct(
          newProduct(child.id, { name: `Subcat Item ${unique()}` }),
        );
        try {
          expect(child.parentId).toBe(parent.id);
          const list = await repo.listCategories();
          const at = list.findIndex((c) => c.id === parent.id);
          expect(list[at + 1]).toMatchObject({ id: child.id, parentId: parent.id });
          expect(list.find((c) => c.id === "dairy")?.parentId ?? null).toBeNull();

          const byParent = await repo.listProducts({ categoryId: parent.id, limit: 40, offset: 0 });
          expect(byParent.items.map((p) => p.id)).toContain(product.id);

          await rejectsWith(
            repo.createCategory({
              ...categoryBase,
              name: `Test Cat Deep ${unique()}`,
              parentId: child.id,
            }),
            400,
            /one level deep/,
          );
          await rejectsWith(
            repo.updateCategory(parent.id, { parentId: "dairy" }),
            400,
            /has sub categories/,
          );
          await rejectsWith(
            repo.updateCategory(child.id, { parentId: child.id }),
            400,
            /own parent/,
          );
          await rejectsWith(
            repo.createCategory({
              ...categoryBase,
              name: `Test Cat Orphan ${unique()}`,
              parentId: "nope",
            }),
            400,
            /parent category does not exist/,
          );
          await rejectsWith(repo.deleteCategory(parent.id), 409, /sub categor/);
        } finally {
          await repo.archiveProduct(product.id);
          expect(await repo.deleteCategory(child.id)).toBe(true);
          expect(await repo.deleteCategory(parent.id)).toBe(true);
        }
      });
    });

    describe("variants", () => {
      it("returns every variant of a group on the product page, cheapest first, and counts options", async () => {
        const repo = await make();
        const detail = (await repo.getProductDetail("p5"))!;
        expect(detail.group).toEqual({ id: "g-amul-taaza", name: "Amul Taaza Toned Fresh Milk" });
        expect(detail.variants.map((v) => [v.id, v.label])).toEqual([
          ["p5", "500 ml"],
          ["p21", "1 L"],
        ]);
        expect(detail.optionsCount).toBe(2);
        expect((await repo.getProduct("p21"))?.optionsCount).toBe(2);
        // A product outside any group keeps its own optionsCount and has no variants
        const plain = (await repo.getProductDetail("p9"))!;
        expect(plain.variants).toEqual([]);
        expect(plain.group).toBeNull();
        expect(plain.optionsCount).toBe(3);
      });

      it("makes a group, adds variants to it, and drops archived ones from the list", async () => {
        const repo = await make();
        const group = await repo.createProductGroup({
          name: `Test Group ${unique()}`,
          categoryId: "snacks",
          brand: "Testco",
        });
        expect(group).toMatchObject({ categoryId: "snacks", brand: "Testco", variantCount: 0 });
        await rejectsWith(
          repo.createProductGroup({
            name: group.name.toUpperCase(),
            categoryId: "snacks",
            brand: null,
          }),
          409,
          /already exists/,
        );
        const small = await repo.createProduct(
          newProduct("snacks", {
            groupId: group.id,
            variantLabel: "Small",
            pricePaise: 1000,
            mrpPaise: 1200,
          }),
        );
        const big = await repo.createProduct(
          newProduct("snacks", {
            groupId: group.id,
            variantLabel: "Big",
            pricePaise: 3000,
            mrpPaise: 3200,
          }),
        );
        try {
          const detail = (await repo.getProductDetail(big.id))!;
          expect(detail.variants.map((v) => v.label)).toEqual(["Small", "Big"]);
          expect(detail.optionsCount).toBe(2);
          expect(
            (await repo.listProductGroups()).find((g) => g.id === group.id)?.variantCount,
          ).toBe(2);

          await repo.archiveProduct(small.id);
          const after = (await repo.getProductDetail(big.id))!;
          expect(after.variants.map((v) => v.id)).toEqual([big.id]);
          expect(after.optionsCount).toBe(1);

          await rejectsWith(
            repo.createProduct(newProduct("snacks", { variantLabel: "Lonely" })),
            400,
            /needs a product group/,
          );
          await rejectsWith(
            repo.createProduct(newProduct("snacks", { groupId: "g-nope" })),
            400,
            /group does not exist/,
          );
          await rejectsWith(
            repo.updateProduct(big.id, { groupId: "g-nope" }),
            400,
            /group does not exist/,
          );
          const moved = (await repo.updateProduct(big.id, { groupId: null, variantLabel: null }))!;
          expect(moved.groupId).toBeNull();
        } finally {
          await repo.archiveProduct(small.id);
          await repo.archiveProduct(big.id);
        }
      });
    });

    describe("photos", () => {
      it("puts the main photo first and the extras after, in their order", async () => {
        const repo = await make();
        const images = (await repo.getProductDetail("p7"))!.images;
        expect(images[0]).toMatchObject({ id: null, primary: true });
        expect(images.length).toBeGreaterThanOrEqual(2);
        expect(images.slice(1).every((i) => i.primary === false && i.id !== null)).toBe(true);
      });

      it("adds, reorders, promotes and removes photos, with a limit", async () => {
        const repo = await make();
        const product = await repo.createProduct(
          newProduct("snacks", { imageUrl: "https://example.com/main.jpg" }),
        );
        try {
          const a = (await repo.addProductImage(product.id, {
            url: "https://example.com/a.jpg",
            alt: "A",
          }))!;
          const b = (await repo.addProductImage(product.id, {
            url: "https://example.com/b.jpg",
            alt: "B",
          }))!;
          expect(a.map((i) => i.url)).toEqual([
            "https://example.com/main.jpg",
            "https://example.com/a.jpg",
          ]);
          const [idA, idB] = [b[1]!.id!, b[2]!.id!];

          const reordered = (await repo.reorderProductImages(product.id, [idB, idA]))!;
          expect(reordered.slice(1).map((i) => i.url)).toEqual([
            "https://example.com/b.jpg",
            "https://example.com/a.jpg",
          ]);
          await rejectsWith(repo.reorderProductImages(product.id, [idA]), 400, /exactly once/);

          const promoted = (await repo.makePrimaryImage(product.id, idA))!;
          expect(promoted[0]).toMatchObject({ url: "https://example.com/a.jpg", primary: true });
          expect(promoted.slice(1).map((i) => i.url)).toContain("https://example.com/main.jpg");
          expect((await repo.getProduct(product.id))?.imageUrl).toBe("https://example.com/a.jpg");

          expect(await repo.removeProductImage(product.id, idB)).toBe(true);
          expect(await repo.removeProductImage(product.id, idB)).toBe(false);
          expect(
            await repo.addProductImage("nope", { url: "https://example.com/x.jpg", alt: "" }),
          ).toBeNull();

          for (let i = 0; i < 7; i += 1) {
            await repo.addProductImage(product.id, {
              url: `https://example.com/${i}.jpg`,
              alt: "",
            });
          }
          await rejectsWith(
            repo.addProductImage(product.id, { url: "https://example.com/over.jpg", alt: "" }),
            409,
            /extra photos/,
          );
        } finally {
          await repo.archiveProduct(product.id);
        }
      });
    });

    describe("search by brand, tags and typos", () => {
      const ids = async (repo: CatalogRepository, q: string) =>
        (await repo.listProducts({ q, limit: 40, offset: 0 })).items.map((p) => p.id);

      it("finds a product by a tag that is not in its name", async () => {
        const repo = await make();
        expect(await ids(repo, "dahi")).toContain("p8");
        expect(await ids(repo, "nariyal")).toContain("p14");
        expect(await ids(repo, "cottage cheese")).toContain("p7");
      });

      it("tolerates a typo in the name, and still finds amul first by name", async () => {
        const repo = await make();
        expect((await ids(repo, "panir"))[0]).toBe("p7");
        expect(await ids(repo, "bred")).toContain("p18");
        const amul = await repo.listProducts({ q: "amul", limit: 40, offset: 0 });
        expect(amul.items.every((p) => p.name.toLowerCase().includes("amul"))).toBe(true);
      });

      it("returns brand and tags on products", async () => {
        const repo = await make();
        expect(await repo.getProduct("p7")).toMatchObject({
          brand: "Amul",
          tags: expect.arrayContaining(["paneer"]),
        });
      });
    });

    describe("CSV import", () => {
      const header =
        "id,name,unit,price,mrp,category,brand,tags,image_url,variant_group,variant_label,description";

      it("plans an import without changing anything", async () => {
        const repo = await make();
        const name = `Importtest ${unique()}`;
        const csv = [
          header,
          `,${name},50 g,20,25,snacks,Crunchy,chips|salted,,,,`,
          "p8,Mother Dairy Curd,400 g,45,50,Dairy & Breakfast,Mother Dairy,curd|dahi,,,,",
        ].join("\n");
        const { rows, errors } = parseImportCsv(csv);
        expect(errors).toEqual([]);
        const plan = await repo.planImport(rows);
        expect(plan).toMatchObject({ creates: 1, updates: 1, errors: [] });
        const before = await repo.listProducts({ q: name, limit: 40, offset: 0 });
        expect(before.items.filter((p) => p.name === name)).toEqual([]);
      });

      it("applies all rows, makes new groups by name, and is all or nothing", async () => {
        const repo = await make();
        const tag = unique();
        const groupName = `Test Import Group ${tag}`;
        const csv = [
          header,
          `p-imp-${tag}-a,Import Juice ${tag},200 ml,30,35,beverages,Juicy,juice,,${groupName},Small,`,
          `p-imp-${tag}-b,Import Juice ${tag},1 L,90,99,beverages,Juicy,juice,,${groupName},Large,"Big, family size"`,
        ].join("\n");
        const parsed = parseImportCsv(csv);
        expect(parsed.errors).toEqual([]);
        const plan = await repo.applyImport(parsed.rows);
        try {
          expect(plan).toMatchObject({ creates: 2, updates: 0 });
          expect(plan.groupsCreated).toHaveLength(1);
          const detail = (await repo.getProductDetail(`p-imp-${tag}-b`))!;
          expect(detail).toMatchObject({
            pricePaise: 9000,
            mrpPaise: 9900,
            brand: "Juicy",
            description: "Big, family size",
          });
          expect(detail.variants.map((v) => v.label)).toEqual(["Small", "Large"]);

          // Updating one row works; a bad row anywhere stops the whole file
          const again = [
            header,
            `p-imp-${tag}-a,Import Juice ${tag},200 ml,28,35,beverages,Juicy,juice,,${groupName},Small,`,
            `,Import Ghost ${tag},1 pc,10,12,no-such-category,,,,,,`,
          ].join("\n");
          const second = parseImportCsv(again);
          expect(second.errors).toEqual([]);
          const failed = await repo.applyImport(second.rows).then(
            () => null,
            (e) => e,
          );
          expect(failed).toBeInstanceOf(CatalogError);
          expect((failed as CatalogError).details).toEqual([
            { line: 3, column: "category", message: 'No category "no-such-category".' },
          ]);
          expect((await repo.getProduct(`p-imp-${tag}-a`))?.pricePaise).toBe(3000);
        } finally {
          await repo.archiveProduct(`p-imp-${tag}-a`);
          await repo.archiveProduct(`p-imp-${tag}-b`);
        }
      });

      it("exports every product on sale with its depth fields", async () => {
        const repo = await make();
        const all = await repo.exportProducts();
        expect(all.find((p) => p.id === "p5")).toMatchObject({
          groupId: "g-amul-taaza",
          brand: "Amul",
        });
        expect(all.length).toBeGreaterThanOrEqual(22);
      });
    });
  });
}
