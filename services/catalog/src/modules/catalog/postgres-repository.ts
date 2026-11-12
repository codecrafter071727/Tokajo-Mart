import type { Banner, Category, Product, UpdateProductBody } from "@qc/contracts";
import { sql, type Kysely, type Selectable } from "kysely";
import type { CatalogBanners, DB } from "../../db/types.generated";
import { CatalogError, newProductId, slugify } from "./errors";
import { discountPercentFor, type CatalogRepository, type ProductFilter } from "./repository";

type ProductRow = {
  id: string;
  name: string;
  unit: string;
  pricePaise: number;
  mrpPaise: number;
  categoryId: string;
  emoji: string;
  imageUrl: string | null;
  imageFit: string;
  deliveryMins: number;
  optionsCount: number | null;
  description: string | null;
};

const toProduct = (row: ProductRow): Product => ({
  id: row.id,
  name: row.name,
  unit: row.unit,
  pricePaise: row.pricePaise,
  mrpPaise: row.mrpPaise,
  discountPercent: discountPercentFor(row.pricePaise, row.mrpPaise),
  categoryId: row.categoryId,
  emoji: row.emoji,
  imageUrl: row.imageUrl,
  imageFit: row.imageFit === "cover" ? "cover" : "contain",
  deliveryMins: row.deliveryMins,
  optionsCount: row.optionsCount,
  description: row.description,
});

const toBanner = (row: Selectable<CatalogBanners>): Banner => ({
  id: row.id,
  title: row.title,
  subtitle: row.subtitle,
  imageUrl: row.imageUrl,
  linkType: row.linkType === "category" || row.linkType === "product" ? row.linkType : "none",
  linkTarget: row.linkTarget,
  color: row.color,
  sortOrder: row.sortOrder,
  active: row.active,
  startsAt: row.startsAt ? row.startsAt.toISOString() : null,
  endsAt: row.endsAt ? row.endsAt.toISOString() : null,
});

/** Escape LIKE wildcards so a search for "100%" or "a_b" matches those characters literally. */
export const escapeLike = (value: string) => value.replace(/[\\%_]/g, (c) => `\\${c}`);

const isUniqueViolation = (error: unknown) => (error as { code?: string }).code === "23505";

/** Catalog data in Postgres. Same behaviour as the in-memory repository, including search ranking. */
export function createPostgresCatalogRepository(db: Kysely<DB>): CatalogRepository {
  const productColumns = [
    "p.id",
    "p.name",
    "p.unit",
    "p.pricePaise",
    "p.mrpPaise",
    "p.categoryId",
    "p.emoji",
    "p.imageUrl",
    "p.imageFit",
    "p.deliveryMins",
    "p.optionsCount",
    "p.description",
  ] as const;
  const plainColumns = productColumns.map((c) => c.replace("p.", "")) as never[];

  async function requireCategory(id: string) {
    const row = await db
      .selectFrom("catalog.categories")
      .select("id")
      .where("id", "=", id)
      .where("deletedAt", "is", null)
      .executeTakeFirst();
    if (!row) throw new CatalogError(400, "That category does not exist.");
  }

  /** The one product search. Admins also see archived products, flagged. */
  async function search(
    { categoryId, q, limit, offset }: ProductFilter,
    includeArchived: boolean,
  ): Promise<{ items: (Product & { archived: boolean })[]; nextOffset: number | null }> {
    let query = db
      .selectFrom("catalog.products as p")
      .innerJoin("catalog.categories as c", "c.id", "p.categoryId")
      .select([...productColumns, sql<boolean>`p.deleted_at is not null`.as("archived")]);
    if (!includeArchived) query = query.where("p.deletedAt", "is", null);

    if (categoryId !== undefined) query = query.where("p.categoryId", "=", categoryId);

    if (q !== undefined) {
      const needle = escapeLike(q.toLowerCase());
      // 0 name starts with it, 1 a word in the name starts with it, 2 name contains it,
      // 3 pack size or category name contains it. Rows that match none are dropped.
      const score = sql<number>`case
        when lower(p.name) like ${needle + "%"} then 0
        when lower(p.name) like ${"% " + needle + "%"} or lower(p.name) like ${"%-" + needle + "%"} then 1
        when lower(p.name) like ${"%" + needle + "%"} then 2
        when lower(p.unit) like ${"%" + needle + "%"} or lower(c.name) like ${"%" + needle + "%"} then 3
      end`;
      query = query
        .where(sql<boolean>`${score} is not null`)
        .orderBy(score)
        .orderBy("p.name");
    } else {
      query = query.orderBy("c.sortOrder").orderBy("p.id");
    }

    // One extra row tells us whether there is a next page without a second count query
    const rows = await query
      .limit(limit + 1)
      .offset(offset)
      .execute();
    const hasMore = rows.length > limit;
    return {
      items: rows
        .slice(0, limit)
        .map((row) => ({ ...toProduct(row as ProductRow), archived: row.archived })),
      nextOffset: hasMore ? offset + limit : null,
    };
  }

  /** Checks what a banner opens and when it shows, so a bad link never reaches the home screen. */
  async function checkBanner(b: {
    linkType: string;
    linkTarget: string | null;
    startsAt: string | null;
    endsAt: string | null;
  }) {
    if (b.linkType === "none" && b.linkTarget !== null) {
      throw new CatalogError(400, "A banner with no link cannot have a link target.");
    }
    if (b.linkType !== "none" && b.linkTarget === null) {
      throw new CatalogError(400, "Say which category or product the banner opens.");
    }
    if (b.linkType === "category" && b.linkTarget !== null) await requireCategory(b.linkTarget);
    if (b.linkType === "product" && b.linkTarget !== null) {
      const product = await db
        .selectFrom("catalog.products")
        .select("id")
        .where("id", "=", b.linkTarget)
        .where("deletedAt", "is", null)
        .executeTakeFirst();
      if (!product) throw new CatalogError(400, "That product does not exist.");
    }
    if (b.startsAt && b.endsAt && Date.parse(b.startsAt) >= Date.parse(b.endsAt)) {
      throw new CatalogError(400, "The banner must start before it ends.");
    }
  }

  const repo: CatalogRepository = {
    async listCategories(): Promise<Category[]> {
      const rows = await db
        .selectFrom("catalog.categories")
        .select(["id", "name", "emoji", "color", "imageUrl", "imageFit", "sortOrder"])
        .where("deletedAt", "is", null)
        .orderBy("sortOrder")
        .orderBy("name")
        .execute();
      return rows.map((r) => ({ ...r, imageFit: r.imageFit === "contain" ? "contain" : "cover" }));
    },

    async listProducts(filter) {
      const page = await search(filter, false);
      return { items: page.items.map(({ archived: _a, ...p }) => p), nextOffset: page.nextOffset };
    },

    async listAdminProducts(filter) {
      return search(filter, true);
    },

    async getProduct(id) {
      const row = await db
        .selectFrom("catalog.products as p")
        .select(productColumns)
        .where("p.id", "=", id)
        .where("p.deletedAt", "is", null)
        .executeTakeFirst();
      return row ? toProduct(row) : null;
    },

    async updateProduct(id, patch: UpdateProductBody) {
      // Only the fields that were sent change; everything else keeps its value
      const changes: Record<string, unknown> = {};
      for (const key of [
        "name",
        "unit",
        "description",
        "pricePaise",
        "mrpPaise",
        "categoryId",
        "emoji",
        "imageUrl",
        "imageFit",
        "deliveryMins",
        "optionsCount",
      ] as const) {
        if (patch[key] !== undefined) changes[key] = patch[key];
      }
      if (Object.keys(changes).length === 0) return this.getProduct(id);
      if (patch.categoryId !== undefined) await requireCategory(patch.categoryId);

      const row = await db
        .updateTable("catalog.products as p")
        .set(changes)
        .where("p.id", "=", id)
        .where("p.deletedAt", "is", null)
        .returning(plainColumns)
        .executeTakeFirst();
      return row ? toProduct(row as unknown as ProductRow) : null;
    },

    async createProduct(body) {
      await requireCategory(body.categoryId);
      for (let attempt = 0; attempt < 5; attempt += 1) {
        try {
          const row = await db
            .insertInto("catalog.products")
            .values({
              id: newProductId(),
              categoryId: body.categoryId,
              name: body.name,
              unit: body.unit,
              pricePaise: body.pricePaise,
              mrpPaise: body.mrpPaise,
              emoji: body.emoji,
              imageUrl: body.imageUrl,
              imageFit: body.imageFit,
              deliveryMins: body.deliveryMins,
              optionsCount: body.optionsCount,
              description: body.description,
            })
            .returning(plainColumns)
            .executeTakeFirstOrThrow();
          return toProduct(row as unknown as ProductRow);
        } catch (error) {
          // A clash on the random id is astronomically unlikely; try a fresh one
          if (!isUniqueViolation(error)) throw error;
        }
      }
      throw new CatalogError(409, "Could not make a unique product id. Try again.");
    },

    async archiveProduct(id) {
      const row = await db
        .updateTable("catalog.products")
        .set({ deletedAt: new Date() })
        .where("id", "=", id)
        .where("deletedAt", "is", null)
        .returning("id")
        .executeTakeFirst();
      return row !== undefined;
    },

    async restoreProduct(id) {
      const row = await db
        .updateTable("catalog.products")
        .set({ deletedAt: null })
        .where("id", "=", id)
        .where("deletedAt", "is not", null)
        .returning(plainColumns)
        .executeTakeFirst();
      return row ? toProduct(row as unknown as ProductRow) : null;
    },

    async createCategory(body) {
      const id = slugify(body.name);
      if (id === "") throw new CatalogError(400, "The name needs letters or numbers.");
      const sortOrder =
        body.sortOrder ??
        Number(
          (
            await db
              .selectFrom("catalog.categories")
              .select(sql<string>`coalesce(max(sort_order), -1) + 1`.as("next"))
              .executeTakeFirstOrThrow()
          ).next,
        );
      try {
        await db
          .insertInto("catalog.categories")
          .values({
            id,
            name: body.name,
            emoji: body.emoji,
            color: body.color,
            imageUrl: body.imageUrl,
            imageFit: body.imageFit,
            sortOrder,
          })
          .execute();
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new CatalogError(409, "A category with this name already exists.");
        }
        throw error;
      }
      return {
        id,
        name: body.name,
        emoji: body.emoji,
        color: body.color,
        imageUrl: body.imageUrl,
        imageFit: body.imageFit,
        sortOrder,
      };
    },

    async updateCategory(id, patch) {
      const row = await db
        .updateTable("catalog.categories")
        .set(patch)
        .where("id", "=", id)
        .where("deletedAt", "is", null)
        .returning(["id", "name", "emoji", "color", "imageUrl", "imageFit", "sortOrder"])
        .executeTakeFirst();
      return row ? { ...row, imageFit: row.imageFit === "contain" ? "contain" : "cover" } : null;
    },

    async deleteCategory(id) {
      return db.transaction().execute(async (trx) => {
        const category = await trx
          .selectFrom("catalog.categories")
          .select("id")
          .where("id", "=", id)
          .where("deletedAt", "is", null)
          .forUpdate()
          .executeTakeFirst();
        if (!category) return false;
        const sold = await trx
          .selectFrom("catalog.products")
          .select((eb) => eb.fn.countAll<string>().as("n"))
          .where("categoryId", "=", id)
          .where("deletedAt", "is", null)
          .executeTakeFirstOrThrow();
        const count = Number(sold.n);
        if (count > 0) {
          throw new CatalogError(
            409,
            `This category still has ${count} product${count === 1 ? "" : "s"} on sale. Move or archive them first.`,
          );
        }
        await trx
          .updateTable("catalog.categories")
          .set({ deletedAt: new Date() })
          .where("id", "=", id)
          .execute();
        return true;
      });
    },

    async listLiveBanners(now) {
      const rows = await db
        .selectFrom("catalog.banners")
        .selectAll()
        .where("active", "=", true)
        .where((eb) => eb.or([eb("startsAt", "is", null), eb("startsAt", "<=", now)]))
        .where((eb) => eb.or([eb("endsAt", "is", null), eb("endsAt", ">", now)]))
        .orderBy("sortOrder")
        .orderBy("createdAt")
        .execute();
      return rows.map(toBanner);
    },

    async listAllBanners() {
      const rows = await db
        .selectFrom("catalog.banners")
        .selectAll()
        .orderBy("sortOrder")
        .orderBy("createdAt")
        .execute();
      return rows.map(toBanner);
    },

    async createBanner(body) {
      await checkBanner(body);
      const row = await db
        .insertInto("catalog.banners")
        .values({
          title: body.title,
          subtitle: body.subtitle,
          imageUrl: body.imageUrl,
          linkType: body.linkType,
          linkTarget: body.linkTarget,
          color: body.color,
          sortOrder: body.sortOrder,
          active: body.active,
          startsAt: body.startsAt,
          endsAt: body.endsAt,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      return toBanner(row);
    },

    async updateBanner(id, patch) {
      const current = await db
        .selectFrom("catalog.banners")
        .selectAll()
        .where("id", "=", id)
        .executeTakeFirst();
      if (!current) return null;
      const next = { ...toBanner(current), ...patch };
      await checkBanner(next);
      const row = await db
        .updateTable("catalog.banners")
        .set({
          title: next.title,
          subtitle: next.subtitle,
          imageUrl: next.imageUrl,
          linkType: next.linkType,
          linkTarget: next.linkTarget,
          color: next.color,
          sortOrder: next.sortOrder,
          active: next.active,
          startsAt: next.startsAt,
          endsAt: next.endsAt,
        })
        .where("id", "=", id)
        .returningAll()
        .executeTakeFirst();
      return row ? toBanner(row) : null;
    },

    async deleteBanner(id) {
      const row = await db
        .deleteFrom("catalog.banners")
        .where("id", "=", id)
        .returning("id")
        .executeTakeFirst();
      return row !== undefined;
    },
  };
  return repo;
}
