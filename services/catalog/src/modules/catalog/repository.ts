import type {
  AdminProduct,
  Banner,
  Category,
  NewBanner,
  NewCategory,
  NewProduct,
  Product,
  UpdateBannerBody,
  UpdateCategoryBody,
  UpdateProductBody,
} from "@qc/contracts";
import { bannerIsLive, CatalogError, newProductId, slugify } from "./errors";

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
 * a Postgres (Kysely) implementation replaces it once the catalog schema exists, with no change
 * to the routes.
 */
export interface CatalogRepository {
  listCategories(): Promise<Category[]>;
  listProducts(filter: ProductFilter): Promise<ProductPage>;
  getProduct(id: string): Promise<Product | null>;
  /** Apply an admin edit. Returns the updated product, or null when the id does not exist. */
  updateProduct(id: string, patch: UpdateProductBody): Promise<Product | null>;

  // --- Admin: products ---
  /** Every product including archived ones, for the admin table. */
  listAdminProducts(
    filter: ProductFilter,
  ): Promise<{ items: AdminProduct[]; nextOffset: number | null }>;
  createProduct(body: NewProduct): Promise<Product>;
  /** Takes a product off sale. False when it does not exist or is already archived. */
  archiveProduct(id: string): Promise<boolean>;
  /** Puts an archived product back on sale. Null when it does not exist or is not archived. */
  restoreProduct(id: string): Promise<Product | null>;

  // --- Admin: categories ---
  createCategory(body: NewCategory): Promise<Category>;
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

function rank(product: Product, categoryName: string, q: string): number {
  const name = product.name.toLowerCase();
  if (name.startsWith(q)) return 0;
  if (name.split(/[\s-]+/).some((word) => word.startsWith(q))) return 1;
  if (name.includes(q)) return 2;
  if (product.unit.toLowerCase().includes(q) || categoryName.toLowerCase().includes(q)) return 3;
  return -1;
}

export function discountPercentFor(pricePaise: number, mrpPaise: number): number {
  return mrpPaise > pricePaise ? Math.round(((mrpPaise - pricePaise) / mrpPaise) * 100) : 0;
}

export function createInMemoryCatalogRepository(
  categorySeed: Category[],
  seed: Product[],
  bannerSeed: Banner[] = [],
): CatalogRepository {
  // Copy so edits never mutate the seed arrays, which tests and other repositories share
  const products = seed.map((p) => ({ ...p }));
  const archived = new Set<string>();
  const categories = categorySeed.map((c) => ({ ...c }));
  const removedCategories = new Set<string>();
  const banners = bannerSeed.map((b) => ({ ...b }));

  const liveCategories = () =>
    categories
      .filter((c) => !removedCategories.has(c.id))
      .sort((a, b) => a.sortOrder - b.sortOrder);
  const categoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? "";
  const requireCategory = (id: string) => {
    if (!liveCategories().some((c) => c.id === id)) {
      throw new CatalogError(400, "That category does not exist.");
    }
  };
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

  const search = (includeArchived: boolean, filter: ProductFilter) => {
    let matches = products.filter(
      (p) =>
        (includeArchived || !archived.has(p.id)) &&
        (filter.categoryId === undefined || p.categoryId === filter.categoryId),
    );
    if (filter.q !== undefined) {
      const needle = filter.q.toLowerCase();
      matches = matches
        .map((product) => ({
          product,
          score: rank(product, categoryName(product.categoryId), needle),
        }))
        .filter((entry) => entry.score >= 0)
        .sort((a, b) => a.score - b.score)
        .map((entry) => entry.product);
    }
    const items = matches.slice(filter.offset, filter.offset + filter.limit);
    const next = filter.offset + filter.limit;
    return { items, nextOffset: next < matches.length ? next : null };
  };

  const repo: CatalogRepository = {
    async listCategories() {
      return liveCategories();
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

    async getProduct(id) {
      return archived.has(id) ? null : (products.find((p) => p.id === id) ?? null);
    },

    async updateProduct(id, patch) {
      const index = products.findIndex((p) => p.id === id);
      const current = products[index];
      if (!current || archived.has(id)) return null;
      if (patch.categoryId !== undefined) requireCategory(patch.categoryId);
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
      next.discountPercent = discountPercentFor(next.pricePaise, next.mrpPaise);
      products[index] = next;
      return next;
    },

    async createProduct(body) {
      requireCategory(body.categoryId);
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
      };
      products.push(product);
      return product;
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
      return product;
    },

    async createCategory(body) {
      const id = slugify(body.name);
      if (id === "") throw new CatalogError(400, "The name needs letters or numbers.");
      if (categories.some((c) => c.id === id)) {
        throw new CatalogError(409, "A category with this name already exists.");
      }
      const category: Category = {
        id,
        name: body.name,
        emoji: body.emoji,
        color: body.color,
        imageUrl: body.imageUrl,
        imageFit: body.imageFit,
        sortOrder: body.sortOrder ?? Math.max(-1, ...categories.map((c) => c.sortOrder)) + 1,
      };
      categories.push(category);
      return category;
    },

    async updateCategory(id, patch) {
      const index = categories.findIndex((c) => c.id === id);
      const current = categories[index];
      if (!current || removedCategories.has(id)) return null;
      const next: Category = { ...current, ...patch } as Category;
      categories[index] = next;
      return next;
    },

    async deleteCategory(id) {
      if (!liveCategories().some((c) => c.id === id)) return false;
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
