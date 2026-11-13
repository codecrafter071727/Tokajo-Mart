import {
  MAX_EXTRA_PRODUCT_IMAGES,
  type AdminProduct,
  type AdminProductDetail,
  type Banner,
  type Category,
  type NewBanner,
  type NewCategory,
  type NewProduct,
  type NewProductGroup,
  type Product,
  type ProductGroup,
  type ProductImage,
  type UpdateBannerBody,
  type UpdateCategoryBody,
  type UpdateProductBody,
} from "@qc/contracts";
import {
  MIN_TYPO_LENGTH,
  planImportRows,
  searchTokens,
  tokensMatch,
  TYPO_THRESHOLD,
  variantLabelOf,
  wordSimilarity,
  type ImportPlan,
  type ImportRow,
} from "./depth";
import { bannerIsLive, CatalogError, newGroupId, newProductId, slugify } from "./errors";

type DepthFields = "brand" | "tags" | "groupId" | "variantLabel";
/** A new product. The catalog depth fields are optional so older callers keep working. */
export type ProductInput = Omit<NewProduct, DepthFields> & Partial<Pick<NewProduct, DepthFields>>;
/** A new category. parentId is optional so older callers keep working. */
export type CategoryInput = Omit<NewCategory, "parentId"> & { parentId?: string | null };

export type ProductFilter = {
  categoryId?: string;
  q?: string;
  limit: number;
  /** Offset into the filtered, ranked list. Encoded as an opaque cursor at the HTTP edge. */
  offset: number;
};

export type ProductPage = {
  items: Product[];
  /** Offset of the next page, null when there are no more results */
  nextOffset: number | null;
};

/**
 * Data access for the catalog module. The in-memory implementation below serves the seed data;
 * the Postgres (Kysely) implementation has the same behaviour, checked by the shared contract tests.
 */
export interface CatalogRepository {
  /** Every live category, sub categories right after their parent, with parentId set. */
  listCategories(): Promise<Category[]>;
  listProducts(filter: ProductFilter): Promise<ProductPage>;
  getProduct(id: string): Promise<Product | null>;
  /** One product with its variants and photos. Archived ones only when includeArchived. */
  getProductDetail(id: string, includeArchived?: boolean): Promise<AdminProductDetail | null>;
  /** Apply an admin edit. Returns the updated product, or null when the id does not exist. */
  updateProduct(id: string, patch: UpdateProductBody): Promise<Product | null>;

  // --- Admin: products ---
  /** Every product including archived ones, for the admin table. */
  listAdminProducts(
    filter: ProductFilter,
  ): Promise<{ items: AdminProduct[]; nextOffset: number | null }>;
  /** One product including an archived one, flagged, for the admin detail page. */
  getAdminProduct(id: string): Promise<AdminProduct | null>;
  createProduct(body: ProductInput): Promise<Product>;
  /** Takes a product off sale. False when it does not exist or is already archived. */
  archiveProduct(id: string): Promise<boolean>;
  /** Puts an archived product back on sale. Null when it does not exist or is not archived. */
  restoreProduct(id: string): Promise<Product | null>;

  // --- Admin: variants and photos ---
  listProductGroups(): Promise<ProductGroup[]>;
  createProductGroup(body: NewProductGroup): Promise<ProductGroup>;
  /** Adds an extra photo after the others. Null when the product does not exist. */
  addProductImage(
    productId: string,
    image: { url: string; alt: string },
  ): Promise<ProductImage[] | null>;
  /** Sets the order of the extra photos. Every extra photo must be listed exactly once. */
  reorderProductImages(productId: string, ids: string[]): Promise<ProductImage[] | null>;
  removeProductImage(productId: string, imageId: string): Promise<boolean>;
  /** Makes an extra photo the main one; the old main photo becomes the first extra photo. */
  makePrimaryImage(productId: string, imageId: string): Promise<ProductImage[] | null>;

  // --- Admin: CSV ---
  /** What an import would do, and why it cannot, without changing anything. */
  planImport(rows: ImportRow[]): Promise<ImportPlan>;
  /** Applies an import all or nothing. Throws CatalogError 400 with the row errors if any. */
  applyImport(rows: ImportRow[]): Promise<ImportPlan>;
  /** Every product on sale, for the CSV export. */
  exportProducts(): Promise<Product[]>;

  // --- Admin: categories ---
  createCategory(body: CategoryInput): Promise<Category>;
  updateCategory(id: string, patch: UpdateCategoryBody): Promise<Category | null>;
  /** Throws CatalogError 409 while the category still has products on sale. False when unknown. */
  deleteCategory(id: string): Promise<boolean>;

  // --- Banners ---
  /** Banners on show now (active, inside their window), in display order. */
  listLiveBanners(now: Date): Promise<Banner[]>;
  listAllBanners(): Promise<Banner[]>;
  createBanner(body: NewBanner): Promise<Banner>;
  updateBanner(id: string, patch: UpdateBannerBody): Promise<Banner | null>;
  deleteBanner(id: string): Promise<boolean>;
}

/**
 * Search score, lower is better. 0 to 3 are the original name and pack size rules; 4 is a full
 * text match on name, brand, tags or category words; 5 is a typo match on the name. -1 means no
 * match. The Postgres repository computes the same scores in SQL.
 */
function rank(
  product: Product,
  categoryName: string,
  q: string,
): { score: number; similarity: number } {
  const name = product.name.toLowerCase();
  const none = { score: -1, similarity: 0 };
  if (name.startsWith(q)) return { score: 0, similarity: 1 };
  if (name.split(/[\s-]+/).some((word) => word.startsWith(q))) return { score: 1, similarity: 1 };
  if (name.includes(q)) return { score: 2, similarity: 1 };
  if (product.unit.toLowerCase().includes(q) || categoryName.toLowerCase().includes(q)) {
    return { score: 3, similarity: 1 };
  }
  const tokens = searchTokens(q);
  if (
    tokensMatch(tokens, [
      product.name,
      product.brand,
      (product.tags ?? []).join(" "),
      categoryName,
      product.unit,
    ])
  ) {
    return { score: 4, similarity: 1 };
  }
  if (q.length >= MIN_TYPO_LENGTH) {
    const similarity = wordSimilarity(q, name);
    if (similarity >= TYPO_THRESHOLD) return { score: 5, similarity };
  }
  return none;
}

export function discountPercentFor(pricePaise: number, mrpPaise: number): number {
  return mrpPaise > pricePaise ? Math.round(((mrpPaise - pricePaise) / mrpPaise) * 100) : 0;
}

/** Parents in display order, each followed by its sub categories in display order. */
export function flattenCategoryTree(categories: Category[]): Category[] {
  const byOrder = (a: Category, b: Category) =>
    a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);
  const ids = new Set(categories.map((c) => c.id));
  const top = categories.filter((c) => !c.parentId || !ids.has(c.parentId)).sort(byOrder);
  return top.flatMap((parent) => [
    parent,
    ...categories.filter((c) => c.parentId === parent.id).sort(byOrder),
  ]);
}

type ExtraImage = { id: string; url: string; alt: string; sortOrder: number };
type Group = { id: string; name: string; categoryId: string; brand: string | null };

export function createInMemoryCatalogRepository(
  categorySeed: Category[],
  seed: Product[],
  bannerSeed: Banner[] = [],
  groupSeed: Group[] = [],
  imageSeed: { productId: string; url: string; alt: string }[] = [],
): CatalogRepository {
  // Copy so edits never mutate the seed arrays, which tests and other repositories share
  const products: Product[] = seed.map((p) => ({
    ...p,
    brand: p.brand ?? null,
    tags: [...(p.tags ?? [])],
    groupId: p.groupId ?? null,
    variantLabel: p.variantLabel ?? null,
  }));
  const archived = new Set<string>();
  const categories: Category[] = categorySeed.map((c) => ({ ...c, parentId: c.parentId ?? null }));
  const removedCategories = new Set<string>();
  const banners = bannerSeed.map((b) => ({ ...b }));
  const groups: Group[] = groupSeed.map((g) => ({ ...g }));
  const images = new Map<string, ExtraImage[]>();
  for (const [i, img] of imageSeed.entries()) {
    const list = images.get(img.productId) ?? [];
    list.push({ id: crypto.randomUUID(), url: img.url, alt: img.alt, sortOrder: i });
    images.set(img.productId, list);
  }

  const liveCategories = () => categories.filter((c) => !removedCategories.has(c.id));
  const categoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? "";
  const requireCategory = (id: string) => {
    if (!liveCategories().some((c) => c.id === id)) {
      throw new CatalogError(400, "That category does not exist.");
    }
  };
  const requireGroup = (id: string) => {
    if (!groups.some((g) => g.id === id)) {
      throw new CatalogError(400, "That product group does not exist.");
    }
  };
  /** A category and its live sub categories, for filtering by a parent */
  const categoryFamily = (id: string) =>
    new Set([
      id,
      ...liveCategories()
        .filter((c) => c.parentId === id)
        .map((c) => c.id),
    ]);
  const checkParent = (selfId: string | null, parentId: string | null | undefined) => {
    if (parentId === null || parentId === undefined) return;
    if (parentId === selfId) throw new CatalogError(400, "A category cannot be its own parent.");
    const parent = liveCategories().find((c) => c.id === parentId);
    if (!parent) throw new CatalogError(400, "That parent category does not exist.");
    if (parent.parentId) {
      throw new CatalogError(400, "Sub categories go one level deep. Pick a top level category.");
    }
    if (selfId && liveCategories().some((c) => c.parentId === selfId)) {
      throw new CatalogError(400, "This category has sub categories, so it cannot become one.");
    }
  };
  const groupCount = (groupId: string) =>
    products.filter((p) => p.groupId === groupId && !archived.has(p.id)).length;
  /** What a reader sees: optionsCount is the size of the product's group when it has one. */
  const present = (p: Product): Product => ({
    ...p,
    tags: [...(p.tags ?? [])],
    optionsCount: p.groupId ? groupCount(p.groupId) || null : p.optionsCount,
  });
  const bannerLinkOk = (type: string, target: string | null) => {
    if (type === "none" && target !== null) {
      throw new CatalogError(400, "A banner with no link cannot have a link target.");
    }
    if (type !== "none" && target === null) {
      throw new CatalogError(400, "Say which category or product the banner opens.");
    }
    if (type === "category" && target !== null) requireCategory(target);
    if (type === "product" && target !== null) {
      if (!products.some((p) => p.id === target && !archived.has(p.id))) {
        throw new CatalogError(400, "That product does not exist.");
      }
    }
  };
  const imagesOf = (product: Product): ProductImage[] => [
    ...(product.imageUrl
      ? [{ id: null, url: product.imageUrl, alt: product.name, primary: true }]
      : []),
    ...[...(images.get(product.id) ?? [])]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((i) => ({ id: i.id, url: i.url, alt: i.alt, primary: false })),
  ];

  const search = (includeArchived: boolean, filter: ProductFilter) => {
    const family = filter.categoryId === undefined ? null : categoryFamily(filter.categoryId);
    let matches = products.filter(
      (p) =>
        (includeArchived || !archived.has(p.id)) && (family === null || family.has(p.categoryId)),
    );
    if (filter.q !== undefined) {
      const needle = filter.q.toLowerCase();
      matches = matches
        .map((product) => ({ product, ...rank(product, categoryName(product.categoryId), needle) }))
        .filter((entry) => entry.score >= 0)
        .sort(
          (a, b) =>
            a.score - b.score ||
            b.similarity - a.similarity ||
            a.product.name.localeCompare(b.product.name),
        )
        .map((entry) => entry.product);
    }
    const items = matches.slice(filter.offset, filter.offset + filter.limit).map(present);
    const next = filter.offset + filter.limit;
    return { items, nextOffset: next < matches.length ? next : null };
  };

  const plan = (rows: ImportRow[]) =>
    planImportRows(rows, {
      categories: liveCategories(),
      groups,
      existingIds: new Set(products.map((p) => p.id)),
    });

  const repo: CatalogRepository = {
    async listCategories() {
      return flattenCategoryTree(liveCategories());
    },

    async listProducts(filter) {
      return search(false, filter);
    },

    async listAdminProducts(filter) {
      const page = search(true, filter);
      return {
        items: page.items.map((p) => ({ ...p, archived: archived.has(p.id) })),
        nextOffset: page.nextOffset,
      };
    },

    async getAdminProduct(id) {
      const product = products.find((p) => p.id === id);
      return product ? { ...present(product), archived: archived.has(id) } : null;
    },

    async getProduct(id) {
      if (archived.has(id)) return null;
      const product = products.find((p) => p.id === id);
      return product ? present(product) : null;
    },

    async getProductDetail(id, includeArchived = false) {
      const product = products.find((p) => p.id === id);
      if (!product || (!includeArchived && archived.has(id))) return null;
      const group = product.groupId ? groups.find((g) => g.id === product.groupId) : undefined;
      const variants = group
        ? products
            .filter((p) => p.groupId === group.id && (!archived.has(p.id) || p.id === id))
            .sort((a, b) => a.pricePaise - b.pricePaise || a.id.localeCompare(b.id))
            .map((p) => ({
              id: p.id,
              label: variantLabelOf(p),
              unit: p.unit,
              pricePaise: p.pricePaise,
              mrpPaise: p.mrpPaise,
              imageUrl: p.imageUrl,
            }))
        : [];
      return {
        ...present(product),
        archived: archived.has(id),
        variants,
        images: imagesOf(product),
        group: group ? { id: group.id, name: group.name } : null,
      };
    },

    async updateProduct(id, patch) {
      const index = products.findIndex((p) => p.id === id);
      const current = products[index];
      if (!current || archived.has(id)) return null;
      if (patch.categoryId !== undefined) requireCategory(patch.categoryId);
      if (patch.groupId) requireGroup(patch.groupId);
      const next: Product = { ...current };
      if (patch.name !== undefined) next.name = patch.name;
      if (patch.unit !== undefined) next.unit = patch.unit;
      if (patch.description !== undefined) next.description = patch.description;
      if (patch.pricePaise !== undefined) next.pricePaise = patch.pricePaise;
      if (patch.mrpPaise !== undefined) next.mrpPaise = patch.mrpPaise;
      if (patch.categoryId !== undefined) next.categoryId = patch.categoryId;
      if (patch.emoji !== undefined) next.emoji = patch.emoji;
      if (patch.imageUrl !== undefined) next.imageUrl = patch.imageUrl;
      if (patch.imageFit !== undefined) next.imageFit = patch.imageFit;
      if (patch.deliveryMins !== undefined) next.deliveryMins = patch.deliveryMins;
      if (patch.optionsCount !== undefined) next.optionsCount = patch.optionsCount;
      if (patch.brand !== undefined) next.brand = patch.brand;
      if (patch.tags !== undefined) next.tags = [...patch.tags];
      if (patch.groupId !== undefined) next.groupId = patch.groupId;
      if (patch.variantLabel !== undefined) next.variantLabel = patch.variantLabel;
      if (next.variantLabel && !next.groupId) {
        throw new CatalogError(400, "A variant label needs a product group.");
      }
      next.discountPercent = discountPercentFor(next.pricePaise, next.mrpPaise);
      products[index] = next;
      return present(next);
    },

    async createProduct(body) {
      requireCategory(body.categoryId);
      if (body.groupId) requireGroup(body.groupId);
      if (body.variantLabel && !body.groupId) {
        throw new CatalogError(400, "A variant label needs a product group.");
      }
      const product: Product = {
        id: newProductId(),
        name: body.name,
        unit: body.unit,
        pricePaise: body.pricePaise,
        mrpPaise: body.mrpPaise,
        discountPercent: discountPercentFor(body.pricePaise, body.mrpPaise),
        categoryId: body.categoryId,
        emoji: body.emoji,
        imageUrl: body.imageUrl,
        imageFit: body.imageFit,
        deliveryMins: body.deliveryMins,
        optionsCount: body.optionsCount,
        description: body.description,
        brand: body.brand ?? null,
        tags: [...(body.tags ?? [])],
        groupId: body.groupId ?? null,
        variantLabel: body.variantLabel ?? null,
      };
      products.push(product);
      return present(product);
    },

    async archiveProduct(id) {
      if (!products.some((p) => p.id === id) || archived.has(id)) return false;
      archived.add(id);
      return true;
    },

    async restoreProduct(id) {
      const product = products.find((p) => p.id === id);
      if (!product || !archived.has(id)) return null;
      archived.delete(id);
      return present(product);
    },

    async listProductGroups() {
      return [...groups]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((g) => ({ ...g, variantCount: groupCount(g.id) }));
    },

    async createProductGroup(body) {
      requireCategory(body.categoryId);
      if (groups.some((g) => g.name.toLowerCase() === body.name.toLowerCase())) {
        throw new CatalogError(409, "A product group with this name already exists.");
      }
      const group = {
        id: newGroupId(),
        name: body.name,
        categoryId: body.categoryId,
        brand: body.brand,
      };
      groups.push(group);
      return { ...group, variantCount: 0 };
    },

    async addProductImage(productId, image) {
      const product = products.find((p) => p.id === productId);
      if (!product) return null;
      const list = images.get(productId) ?? [];
      if (list.length >= MAX_EXTRA_PRODUCT_IMAGES) {
        throw new CatalogError(409, `A product can have ${MAX_EXTRA_PRODUCT_IMAGES} extra photos.`);
      }
      list.push({
        id: crypto.randomUUID(),
        url: image.url,
        alt: image.alt,
        sortOrder: Math.max(-1, ...list.map((i) => i.sortOrder)) + 1,
      });
      images.set(productId, list);
      return imagesOf(product);
    },

    async reorderProductImages(productId, ids) {
      const product = products.find((p) => p.id === productId);
      if (!product) return null;
      const list = images.get(productId) ?? [];
      const current = new Set(list.map((i) => i.id));
      if (
        ids.length !== current.size ||
        new Set(ids).size !== ids.length ||
        !ids.every((id) => current.has(id))
      ) {
        throw new CatalogError(400, "List every extra photo of this product exactly once.");
      }
      for (const image of list) image.sortOrder = ids.indexOf(image.id);
      return imagesOf(product);
    },

    async removeProductImage(productId, imageId) {
      const list = images.get(productId) ?? [];
      const index = list.findIndex((i) => i.id === imageId);
      if (index < 0) return false;
      list.splice(index, 1);
      return true;
    },

    async makePrimaryImage(productId, imageId) {
      const product = products.find((p) => p.id === productId);
      const list = images.get(productId) ?? [];
      const image = list.find((i) => i.id === imageId);
      if (!product || !image) return null;
      const oldPrimary = product.imageUrl;
      product.imageUrl = image.url;
      if (oldPrimary) {
        // The old main photo takes the chosen photo's place at the front of the extras
        image.url = oldPrimary;
        image.alt = product.name;
        for (const other of list) if (other !== image) other.sortOrder += 1;
        image.sortOrder = Math.min(...list.map((i) => i.sortOrder)) - 1;
      } else {
        list.splice(list.indexOf(image), 1);
      }
      return imagesOf(product);
    },

    async planImport(rows) {
      return plan(rows).plan;
    },

    async applyImport(rows) {
      const { resolved, groupsCreated, plan: summary } = plan(rows);
      if (summary.errors.length > 0) {
        throw new CatalogError(400, "The file has problems. Nothing was imported.", summary.errors);
      }
      // Everything is checked above, so nothing below can fail half way
      groups.push(...groupsCreated);
      for (const row of resolved) {
        const fields = {
          name: row.name,
          unit: row.unit,
          pricePaise: row.pricePaise,
          mrpPaise: row.mrpPaise,
          discountPercent: discountPercentFor(row.pricePaise, row.mrpPaise),
          categoryId: row.categoryId,
          brand: row.brand,
          tags: row.tags,
          groupId: row.groupId,
          variantLabel: row.variantLabel,
          description: row.description,
          ...(row.imageUrl !== null ? { imageUrl: row.imageUrl } : {}),
        };
        const index = products.findIndex((p) => p.id === row.id);
        if (index >= 0) {
          products[index] = { ...(products[index] as Product), ...fields };
        } else {
          products.push({
            id: row.id ?? newProductId(),
            emoji: "",
            imageUrl: null,
            imageFit: "contain",
            deliveryMins: 10,
            optionsCount: null,
            ...fields,
          });
        }
      }
      return summary;
    },

    async exportProducts() {
      return products
        .filter((p) => !archived.has(p.id))
        .sort((a, b) => a.id.localeCompare(b.id))
        .map(present);
    },

    async createCategory(body) {
      const id = slugify(body.name);
      if (id === "") throw new CatalogError(400, "The name needs letters or numbers.");
      if (categories.some((c) => c.id === id)) {
        throw new CatalogError(409, "A category with this name already exists.");
      }
      checkParent(null, body.parentId);
      const category: Category = {
        id,
        name: body.name,
        emoji: body.emoji,
        color: body.color,
        imageUrl: body.imageUrl,
        imageFit: body.imageFit,
        sortOrder: body.sortOrder ?? Math.max(-1, ...categories.map((c) => c.sortOrder)) + 1,
        parentId: body.parentId ?? null,
      };
      categories.push(category);
      return category;
    },

    async updateCategory(id, patch) {
      const index = categories.findIndex((c) => c.id === id);
      const current = categories[index];
      if (!current || removedCategories.has(id)) return null;
      if (patch.parentId !== undefined) checkParent(id, patch.parentId);
      const next: Category = { ...current, ...patch } as Category;
      categories[index] = next;
      return next;
    },

    async deleteCategory(id) {
      if (!liveCategories().some((c) => c.id === id)) return false;
      const children = liveCategories().filter((c) => c.parentId === id).length;
      if (children > 0) {
        throw new CatalogError(
          409,
          `This category has ${children} sub categor${children === 1 ? "y" : "ies"}. Move or remove them first.`,
        );
      }
      const stillSold = products.filter((p) => p.categoryId === id && !archived.has(p.id)).length;
      if (stillSold > 0) {
        throw new CatalogError(
          409,
          `This category still has ${stillSold} product${stillSold === 1 ? "" : "s"} on sale. Move or archive them first.`,
        );
      }
      removedCategories.add(id);
      return true;
    },

    async listLiveBanners(now) {
      return banners.filter((b) => bannerIsLive(b, now)).sort((a, b) => a.sortOrder - b.sortOrder);
    },

    async listAllBanners() {
      return [...banners].sort((a, b) => a.sortOrder - b.sortOrder);
    },

    async createBanner(body) {
      bannerLinkOk(body.linkType, body.linkTarget);
      if (body.startsAt && body.endsAt && Date.parse(body.startsAt) >= Date.parse(body.endsAt)) {
        throw new CatalogError(400, "The banner must start before it ends.");
      }
      const banner: Banner = { id: crypto.randomUUID(), ...body };
      banners.push(banner);
      return banner;
    },

    async updateBanner(id, patch) {
      const index = banners.findIndex((b) => b.id === id);
      const current = banners[index];
      if (!current) return null;
      const next: Banner = { ...current, ...patch };
      bannerLinkOk(next.linkType, next.linkTarget);
      if (next.startsAt && next.endsAt && Date.parse(next.startsAt) >= Date.parse(next.endsAt)) {
        throw new CatalogError(400, "The banner must start before it ends.");
      }
      banners[index] = next;
      return next;
    },

    async deleteBanner(id) {
      const index = banners.findIndex((b) => b.id === id);
      if (index < 0) return false;
      banners.splice(index, 1);
      return true;
    },
  };
  return repo;
}
