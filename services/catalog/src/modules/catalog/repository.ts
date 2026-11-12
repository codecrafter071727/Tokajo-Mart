import type { Category, Product, UpdateProductBody } from "@qc/contracts";

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
  categories: Category[],
  seed: Product[],
): CatalogRepository {
  // Copy so edits never mutate the seed arrays, which tests and other repositories share
  const products = seed.map((p) => ({ ...p }));
  const sortedCategories = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);
  const categoryNames = new Map(categories.map((c) => [c.id, c.name]));

  return {
    async listCategories() {
      return sortedCategories;
    },

    async listProducts({ categoryId, q, limit, offset }) {
      let matches = products.filter((p) => categoryId === undefined || p.categoryId === categoryId);

      if (q !== undefined) {
        const needle = q.toLowerCase();
        matches = matches
          .map((product) => ({
            product,
            score: rank(product, categoryNames.get(product.categoryId) ?? "", needle),
          }))
          .filter((entry) => entry.score >= 0)
          .sort((a, b) => a.score - b.score)
          .map((entry) => entry.product);
      }

      const items = matches.slice(offset, offset + limit);
      const next = offset + limit;
      return { items, nextOffset: next < matches.length ? next : null };
    },

    async getProduct(id) {
      return products.find((p) => p.id === id) ?? null;
    },

    async updateProduct(id, patch) {
      const index = products.findIndex((p) => p.id === id);
      const current = products[index];
      if (!current) return null;
      const next: Product = { ...current };
      if (patch.name !== undefined) next.name = patch.name;
      if (patch.unit !== undefined) next.unit = patch.unit;
      if (patch.description !== undefined) next.description = patch.description;
      if (patch.pricePaise !== undefined) next.pricePaise = patch.pricePaise;
      if (patch.mrpPaise !== undefined) next.mrpPaise = patch.mrpPaise;
      next.discountPercent = discountPercentFor(next.pricePaise, next.mrpPaise);
      products[index] = next;
      return next;
    },
  };
}
