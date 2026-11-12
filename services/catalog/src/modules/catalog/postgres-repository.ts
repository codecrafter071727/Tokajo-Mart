import type { Category, Product, UpdateProductBody } from "@qc/contracts";
import { sql, type Kysely } from "kysely";
import type { DB } from "../../db/types.generated";
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

/** Escape LIKE wildcards so a search for "100%" or "a_b" matches those characters literally. */
export const escapeLike = (value: string) => value.replace(/[\\%_]/g, (c) => `\\${c}`);

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

  return {
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

    async listProducts({ categoryId, q, limit, offset }: ProductFilter) {
      let query = db
        .selectFrom("catalog.products as p")
        .innerJoin("catalog.categories as c", "c.id", "p.categoryId")
        .select(productColumns)
        .where("p.deletedAt", "is", null);

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
        items: rows.slice(0, limit).map(toProduct),
        nextOffset: hasMore ? offset + limit : null,
      };
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
      if (patch.name !== undefined) changes.name = patch.name;
      if (patch.unit !== undefined) changes.unit = patch.unit;
      if (patch.description !== undefined) changes.description = patch.description;
      if (patch.pricePaise !== undefined) changes.pricePaise = patch.pricePaise;
      if (patch.mrpPaise !== undefined) changes.mrpPaise = patch.mrpPaise;
      if (Object.keys(changes).length === 0) return this.getProduct(id);

      const row = await db
        .updateTable("catalog.products as p")
        .set(changes)
        .where("p.id", "=", id)
        .where("p.deletedAt", "is", null)
        .returning(productColumns.map((c) => c.replace("p.", "") as never))
        .executeTakeFirst();
      return row ? toProduct(row as unknown as ProductRow) : null;
    },
  };
}
