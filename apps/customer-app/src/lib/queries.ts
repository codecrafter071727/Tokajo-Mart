import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ApiClientError } from "@qc/api-client";
import { api } from "./api";
import { toCategory, toProduct } from "./catalog";
import {
  categories as fixtureCategories,
  products as fixtureProducts,
  type Category,
  type Product,
} from "./mockData";

export type ProductFilter = { categoryId?: string; q?: string; limit?: number };

export const queryKeys = {
  categories: ["catalog", "categories"] as const,
  products: (filter: ProductFilter) => ["catalog", "products", filter] as const,
  product: (id: string) => ["catalog", "product", id] as const,
};

/** True when the failure means "this product does not exist", as opposed to "we could not ask". */
export function isNotFound(error: unknown): boolean {
  return error instanceof ApiClientError && error.code === "NOT_FOUND";
}

function fixtureProductsFor({ categoryId, q, limit = 40 }: ProductFilter): Product[] {
  const needle = q?.trim().toLowerCase();
  return fixtureProducts
    .filter((p) => categoryId === undefined || p.categoryId === categoryId)
    .filter(
      (p) =>
        !needle || p.name.toLowerCase().includes(needle) || p.unit.toLowerCase().includes(needle),
    )
    .slice(0, limit);
}

export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories,
    queryFn: async ({ signal }): Promise<Category[]> => {
      if (!api) return fixtureCategories;
      const { items } = await api.catalog.listCategories({ signal });
      return items.map(toCategory);
    },
    staleTime: 10 * 60_000,
  });
}

/**
 * Products for a category and/or a search term. Reads one page (up to `limit`, default 40);
 * the catalog is small enough that paging is not needed yet.
 */
export function useProducts(
  filter: ProductFilter = {},
  options: { enabled?: boolean; keepPrevious?: boolean } = {},
) {
  return useQuery({
    queryKey: queryKeys.products(filter),
    enabled: options.enabled ?? true,
    placeholderData: options.keepPrevious ? keepPreviousData : undefined,
    queryFn: async ({ signal }): Promise<Product[]> => {
      if (!api) return fixtureProductsFor(filter);
      const { items } = await api.catalog.listProducts(filter, { signal });
      return items.map(toProduct);
    },
  });
}

export function useProduct(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.product(id ?? ""),
    enabled: Boolean(id),
    queryFn: async ({ signal }): Promise<Product> => {
      if (!id) throw new Error("missing id");
      if (!api) {
        const found = fixtureProducts.find((p) => p.id === id);
        if (!found) throw new ApiClientError("Product not found.", "NOT_FOUND", { status: 404 });
        return found;
      }
      return toProduct(await api.catalog.getProduct(id, { signal }));
    },
  });
}
