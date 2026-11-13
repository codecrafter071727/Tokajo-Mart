import {
  MAX_EXTRA_PRODUCT_IMAGES,
  type Banner,
  type Category,
  type Product,
  type ProductImage,
  type UpdateProductBody,
} from "@qc/contracts";
import { sql, type Kysely, type Selectable, type Transaction } from "kysely";
import type { CatalogBanners, DB } from "../../db/types.generated";
import {
  MIN_TYPO_LENGTH,
  planImportRows,
  prefixTsQuery,
  searchTokens,
  TYPO_THRESHOLD,
  variantLabelOf,
  type ImportRow,
} from "./depth";
import { CatalogError, newGroupId, newProductId, slugify } from "./errors";
import {
  discountPercentFor,
  flattenCategoryTree,
  type CatalogRepository,
  type ProductFilter,
} from "./repository";

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
  brand: string | null;
  tags: string[];
  groupId: string | null;
  variantLabel: string | null;
  groupCount: number | null;
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
  // A product in a group has as many options as its group has variants on sale
  optionsCount: row.groupId ? row.groupCount || null : row.optionsCount,
  description: row.description,
  brand: row.brand,
  tags: row.tags ?? [],
  groupId: row.groupId,
  variantLabel: row.variantLabel,
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

const toCategory = (r: {
  id: string;
  name: string;
  emoji: string;
  color: string;
  imageUrl: string | null;
  imageFit: string;
  sortOrder: number;
  parentId: string | null;
}): Category => ({ ...r, imageFit: r.imageFit === "contain" ? "contain" : "cover" });

const categoryColumns = [
  "id",
  "name",
  "emoji",
  "color",
  "imageUrl",
  "imageFit",
  "sortOrder",
  "parentId",
] as const;

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
    "p.brand",
    "p.tags",
    "p.groupId",
    "p.variantLabel",
    sql<number | null>`(select count(*)::int from catalog.products g
      where g.group_id = p.group_id and g.deleted_at is null)`.as("groupCount"),
  ] as const;

  async function requireCategory(id: string, conn: Kysely<DB> = db) {
    const row = await conn
      .selectFrom("catalog.categories")
      .select("id")
      .where("id", "=", id)
      .where("deletedAt", "is", null)
      .executeTakeFirst();
    if (!row) throw new CatalogError(400, "That category does not exist.");
  }

  async function requireGroup(id: string) {
    const row = await db
      .selectFrom("catalog.productGroups")
      .select("id")
      .where("id", "=", id)
      .executeTakeFirst();
    if (!row) throw new CatalogError(400, "That product group does not exist.");
  }

  async function checkParent(selfId: string | null, parentId: string | null | undefined) {
    if (parentId === null || parentId === undefined) return;
    if (parentId === selfId) throw new CatalogError(400, "A category cannot be its own parent.");
    const parent = await db
      .selectFrom("catalog.categories")
      .select(["id", "parentId"])
      .where("id", "=", parentId)
      .where("deletedAt", "is", null)
      .executeTakeFirst();
    if (!parent) throw new CatalogError(400, "That parent category does not exist.");
    if (parent.parentId) {
      throw new CatalogError(400, "Sub categories go one level deep. Pick a top level category.");
    }
    if (selfId) {
      const child = await db
        .selectFrom("catalog.categories")
        .select("id")
        .where("parentId", "=", selfId)
        .where("deletedAt", "is", null)
        .executeTakeFirst();
      if (child) {
        throw new CatalogError(400, "This category has sub categories, so it cannot become one.");
      }
    }
  }

  /** One product with its group size, archived or not as asked. */
  async function readProduct(id: string, includeArchived: boolean) {
    let query = db
      .selectFrom("catalog.products as p")
      .select([...productColumns, sql<boolean>`p.deleted_at is not null`.as("archived")])
      .where("p.id", "=", id);
    if (!includeArchived) query = query.where("p.deletedAt", "is", null);
    const row = await query.executeTakeFirst();
    return row ? { ...toProduct(row as ProductRow), archived: row.archived } : null;
  }

  async function imagesOf(productId: string, mainUrl: string | null, name: string) {
    const extras = await db
      .selectFrom("catalog.productImages")
      .select(["id", "url", "alt"])
      .where("productId", "=", productId)
      .orderBy("sortOrder")
      .orderBy("createdAt")
      .execute();
    const images: ProductImage[] = [
      ...(mainUrl ? [{ id: null, url: mainUrl, alt: name, primary: true }] : []),
      ...extras.map((e) => ({ id: e.id, url: e.url, alt: e.alt, primary: false })),
    ];
    return images;
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

    if (categoryId !== undefined) {
      // A parent category includes the products of its sub categories
      query = query.where((eb) =>
        eb.or([
          eb("p.categoryId", "=", categoryId),
          eb(
            "p.categoryId",
            "in",
            eb
              .selectFrom("catalog.categories as sub")
              .select("sub.id")
              .where("sub.parentId", "=", categoryId)
              .where("sub.deletedAt", "is", null),
          ),
        ]),
      );
    }

    if (q !== undefined) {
      const lower = q.toLowerCase();
      const needle = escapeLike(lower);
      const tokens = searchTokens(q);
      const tsQuery = tokens.length > 0 ? prefixTsQuery(tokens) : null;
      const fullText = tsQuery
        ? sql<boolean>`p.search_vector @@ to_tsquery('simple', ${tsQuery})`
        : sql<boolean>`false`;
      const typo =
        lower.length >= MIN_TYPO_LENGTH
          ? sql<boolean>`word_similarity(${lower}, lower(p.name)) >= ${TYPO_THRESHOLD}`
          : sql<boolean>`false`;
      // 0 name starts with it, 1 a word in the name starts with it, 2 name contains it,
      // 3 pack size or category name contains it, 4 full text match on name, brand, tags or
      // category, 5 a typo match on the name. Rows that match none are dropped.
      const score = sql<number>`case
        when lower(p.name) like ${needle + "%"} then 0
        when lower(p.name) like ${"% " + needle + "%"} or lower(p.name) like ${"%-" + needle + "%"} then 1
        when lower(p.name) like ${"%" + needle + "%"} then 2
        when lower(p.unit) like ${"%" + needle + "%"} or lower(c.name) like ${"%" + needle + "%"} then 3
        when ${fullText} then 4
        when ${typo} then 5
      end`;
      const similarity = sql<number>`word_similarity(${lower}, lower(p.name))`;
      const closeness = tsQuery
        ? sql<number>`case
            when ${score} = 4 then ts_rank(p.search_vector, to_tsquery('simple', ${tsQuery}))
            when ${score} = 5 then ${similarity}
            else 0
          end`
        : sql<number>`case when ${score} = 5 then ${similarity} else 0 end`;
      query = query
        .where(sql<boolean>`${score} is not null`)
        .orderBy(score)
        .orderBy(closeness, "desc")
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

  async function importCatalog(trx: Kysely<DB> = db) {
    const [categories, groups, ids] = await Promise.all([
      trx
        .selectFrom("catalog.categories")
        .select(["id", "name"])
        .where("deletedAt", "is", null)
        .execute(),
      trx.selectFrom("catalog.productGroups").select(["id", "name"]).execute(),
      trx.selectFrom("catalog.products").select("id").execute(),
    ]);
    return { categories, groups, existingIds: new Set(ids.map((r) => r.id)) };
  }

  const repo: CatalogRepository = {
    async listCategories(): Promise<Category[]> {
      const rows = await db
        .selectFrom("catalog.categories")
        .select(categoryColumns)
        .where("deletedAt", "is", null)
        .execute();
      return flattenCategoryTree(rows.map(toCategory));
    },

    async listProducts(filter) {
      const page = await search(filter, false);
      return { items: page.items.map(({ archived: _a, ...p }) => p), nextOffset: page.nextOffset };
    },

    async listAdminProducts(filter) {
      return search(filter, true);
    },

    async getAdminProduct(id) {
      return readProduct(id, true);
    },

    async getProduct(id) {
      const product = await readProduct(id, false);
      if (!product) return null;
      const { archived: _a, ...rest } = product;
      return rest;
    },

    async getProductDetail(id, includeArchived = false) {
      const product = await readProduct(id, includeArchived);
      if (!product) return null;
      const group = product.groupId
        ? await db
            .selectFrom("catalog.productGroups")
            .select(["id", "name"])
            .where("id", "=", product.groupId)
            .executeTakeFirst()
        : undefined;
      const variants = group
        ? (
            await db
              .selectFrom("catalog.products")
              .select(["id", "unit", "variantLabel", "pricePaise", "mrpPaise", "imageUrl"])
              .where("groupId", "=", group.id)
              .where((eb) => eb.or([eb("deletedAt", "is", null), eb("id", "=", id)]))
              .orderBy("pricePaise")
              .orderBy("id")
              .execute()
          ).map((v) => ({
            id: v.id,
            label: variantLabelOf(v),
            unit: v.unit,
            pricePaise: v.pricePaise,
            mrpPaise: v.mrpPaise,
            imageUrl: v.imageUrl,
          }))
        : [];
      return {
        ...product,
        variants,
        images: await imagesOf(product.id, product.imageUrl, product.name),
        group: group ? { id: group.id, name: group.name } : null,
      };
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
        "brand",
        "tags",
        "groupId",
        "variantLabel",
      ] as const) {
        if (patch[key] !== undefined) changes[key] = patch[key];
      }
      if (Object.keys(changes).length === 0) return this.getProduct(id);
      if (patch.categoryId !== undefined) await requireCategory(patch.categoryId);
      if (patch.groupId) await requireGroup(patch.groupId);
      if (patch.variantLabel || patch.groupId === null) {
        const current = await readProduct(id, false);
        const groupId = patch.groupId !== undefined ? patch.groupId : current?.groupId;
        const label = patch.variantLabel !== undefined ? patch.variantLabel : current?.variantLabel;
        if (current && label && !groupId) {
          throw new CatalogError(400, "A variant label needs a product group.");
        }
      }

      const row = await db
        .updateTable("catalog.products as p")
        .set(changes)
        .where("p.id", "=", id)
        .where("p.deletedAt", "is", null)
        .returning("p.id")
        .executeTakeFirst();
      return row ? this.getProduct(id) : null;
    },

    async createProduct(body) {
      await requireCategory(body.categoryId);
      if (body.groupId) await requireGroup(body.groupId);
      if (body.variantLabel && !body.groupId) {
        throw new CatalogError(400, "A variant label needs a product group.");
      }
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const id = newProductId();
        try {
          await db
            .insertInto("catalog.products")
            .values({
              id,
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
              brand: body.brand ?? null,
              tags: body.tags ?? [],
              groupId: body.groupId ?? null,
              variantLabel: body.variantLabel ?? null,
            })
            .execute();
          return (await this.getProduct(id)) as Product;
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
        .returning("id")
        .executeTakeFirst();
      return row ? this.getProduct(id) : null;
    },

    async listProductGroups() {
      const rows = await db
        .selectFrom("catalog.productGroups as g")
        .select([
          "g.id",
          "g.name",
          "g.categoryId",
          "g.brand",
          sql<number>`(select count(*)::int from catalog.products p
            where p.group_id = g.id and p.deleted_at is null)`.as("variantCount"),
        ])
        .orderBy("g.name")
        .execute();
      return rows;
    },

    async createProductGroup(body) {
      await requireCategory(body.categoryId);
      const clash = await db
        .selectFrom("catalog.productGroups")
        .select("id")
        .where(sql<boolean>`lower(name) = ${body.name.toLowerCase()}`)
        .executeTakeFirst();
      if (clash) throw new CatalogError(409, "A product group with this name already exists.");
      const row = await db
        .insertInto("catalog.productGroups")
        .values({
          id: newGroupId(),
          name: body.name,
          categoryId: body.categoryId,
          brand: body.brand,
        })
        .returning(["id", "name", "categoryId", "brand"])
        .executeTakeFirstOrThrow();
      return { ...row, variantCount: 0 };
    },

    async addProductImage(productId, image) {
      const product = await readProduct(productId, true);
      if (!product) return null;
      await db.transaction().execute(async (trx) => {
        // Lock the product row so two uploads cannot both slip under the limit
        await trx
          .selectFrom("catalog.products")
          .select("id")
          .where("id", "=", productId)
          .forUpdate()
          .executeTakeFirst();
        const count = await trx
          .selectFrom("catalog.productImages")
          .select([
            (eb) => eb.fn.countAll<string>().as("n"),
            sql<number>`coalesce(max(sort_order), -1)`.as("last"),
          ])
          .where("productId", "=", productId)
          .executeTakeFirstOrThrow();
        if (Number(count.n) >= MAX_EXTRA_PRODUCT_IMAGES) {
          throw new CatalogError(
            409,
            `A product can have ${MAX_EXTRA_PRODUCT_IMAGES} extra photos.`,
          );
        }
        await trx
          .insertInto("catalog.productImages")
          .values({ productId, url: image.url, alt: image.alt, sortOrder: Number(count.last) + 1 })
          .execute();
      });
      return imagesOf(productId, product.imageUrl, product.name);
    },

    async reorderProductImages(productId, ids) {
      const product = await readProduct(productId, true);
      if (!product) return null;
      await db.transaction().execute(async (trx) => {
        const current = await trx
          .selectFrom("catalog.productImages")
          .select("id")
          .where("productId", "=", productId)
          .forUpdate()
          .execute();
        const known = new Set(current.map((r) => r.id));
        if (
          ids.length !== known.size ||
          new Set(ids).size !== ids.length ||
          !ids.every((id) => known.has(id))
        ) {
          throw new CatalogError(400, "List every extra photo of this product exactly once.");
        }
        for (const [index, id] of ids.entries()) {
          await trx
            .updateTable("catalog.productImages")
            .set({ sortOrder: index })
            .where("id", "=", id)
            .execute();
        }
      });
      return imagesOf(productId, product.imageUrl, product.name);
    },

    async removeProductImage(productId, imageId) {
      const row = await db
        .deleteFrom("catalog.productImages")
        .where("id", "=", imageId)
        .where("productId", "=", productId)
        .returning("id")
        .executeTakeFirst();
      return row !== undefined;
    },

    async makePrimaryImage(productId, imageId) {
      const done = await db.transaction().execute(async (trx) => {
        const product = await trx
          .selectFrom("catalog.products")
          .select(["id", "imageUrl", "name"])
          .where("id", "=", productId)
          .forUpdate()
          .executeTakeFirst();
        const image = await trx
          .selectFrom("catalog.productImages")
          .select(["id", "url"])
          .where("id", "=", imageId)
          .where("productId", "=", productId)
          .executeTakeFirst();
        if (!product || !image) return false;
        await trx
          .updateTable("catalog.products")
          .set({ imageUrl: image.url })
          .where("id", "=", productId)
          .execute();
        if (product.imageUrl) {
          // The old main photo takes the chosen photo's place, at the front of the extras
          const first = await trx
            .selectFrom("catalog.productImages")
            .select(sql<number>`coalesce(min(sort_order), 0)`.as("min"))
            .where("productId", "=", productId)
            .executeTakeFirstOrThrow();
          await trx
            .updateTable("catalog.productImages")
            .set({ url: product.imageUrl, alt: product.name, sortOrder: Number(first.min) - 1 })
            .where("id", "=", imageId)
            .execute();
        } else {
          await trx.deleteFrom("catalog.productImages").where("id", "=", imageId).execute();
        }
        return true;
      });
      if (!done) return null;
      const product = await readProduct(productId, true);
      return product ? imagesOf(productId, product.imageUrl, product.name) : null;
    },

    async planImport(rows: ImportRow[]) {
      return planImportRows(rows, await importCatalog()).plan;
    },

    async applyImport(rows: ImportRow[]) {
      return db.transaction().execute(async (trx: Transaction<DB>) => {
        // Serialise imports so two files cannot both create the same group or id
        await sql`select pg_advisory_xact_lock(hashtext('catalog.import'))`.execute(trx);
        const { resolved, groupsCreated, plan } = planImportRows(rows, await importCatalog(trx));
        if (plan.errors.length > 0) {
          throw new CatalogError(400, "The file has problems. Nothing was imported.", plan.errors);
        }
        for (const group of groupsCreated) {
          await trx.insertInto("catalog.productGroups").values(group).execute();
        }
        for (const row of resolved) {
          const fields = {
            name: row.name,
            unit: row.unit,
            pricePaise: row.pricePaise,
            mrpPaise: row.mrpPaise,
            categoryId: row.categoryId,
            brand: row.brand,
            tags: row.tags,
            groupId: row.groupId,
            variantLabel: row.variantLabel,
            description: row.description,
            ...(row.imageUrl !== null ? { imageUrl: row.imageUrl } : {}),
          };
          if (row.exists) {
            await trx
              .updateTable("catalog.products")
              .set(fields)
              .where("id", "=", row.id as string)
              .execute();
          } else {
            await trx
              .insertInto("catalog.products")
              .values({ id: row.id ?? newProductId(), ...fields })
              .execute();
          }
        }
        return plan;
      });
    },

    async exportProducts() {
      const rows = await db
        .selectFrom("catalog.products as p")
        .select(productColumns)
        .where("p.deletedAt", "is", null)
        .orderBy("p.id")
        .execute();
      return rows.map((r) => toProduct(r as ProductRow));
    },

    async createCategory(body) {
      const id = slugify(body.name);
      if (id === "") throw new CatalogError(400, "The name needs letters or numbers.");
      await checkParent(null, body.parentId);
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
            parentId: body.parentId ?? null,
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
        parentId: body.parentId ?? null,
      };
    },

    async updateCategory(id, patch) {
      if (patch.parentId !== undefined) await checkParent(id, patch.parentId);
      const row = await db
        .updateTable("catalog.categories")
        .set(patch)
        .where("id", "=", id)
        .where("deletedAt", "is", null)
        .returning(categoryColumns)
        .executeTakeFirst();
      return row ? toCategory(row) : null;
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
        const subs = await trx
          .selectFrom("catalog.categories")
          .select((eb) => eb.fn.countAll<string>().as("n"))
          .where("parentId", "=", id)
          .where("deletedAt", "is", null)
          .executeTakeFirstOrThrow();
        const children = Number(subs.n);
        if (children > 0) {
          throw new CatalogError(
            409,
            `This category has ${children} sub categor${children === 1 ? "y" : "ies"}. Move or remove them first.`,
          );
        }
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
