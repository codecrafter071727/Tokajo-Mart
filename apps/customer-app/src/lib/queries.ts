import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ApiClientError } from "@qc/api-client";
import { api } from "./api";
import type { AvailabilityItem, ServiceabilityResponse } from "@qc/contracts";
import { toCategory, toProduct } from "./catalog";
import { useAddressStore } from "../store/addresses";
import { selectedOf } from "./addresses";
import { coveringWarehouse } from "./serviceAreas";
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
  serviceability: (lat: number, lng: number) => ["inventory", "serviceability", lat, lng] as const,
  availability: (warehouseId: string, ids: string[]) =>
    ["inventory", "availability", warehouseId, ids.join(",")] as const,
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

// ---------------------------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------------------------

/** Mirrors the inventory service seed so the app looks the same with and without a backend. */
function fixtureServiceability(lat: number, lng: number): ServiceabilityResponse {
  const warehouseId = coveringWarehouse(lat, lng);
  return warehouseId
    ? { serviceable: true, warehouseId, etaMins: 9, reason: null }
    : { serviceable: false, warehouseId: null, etaMins: null, reason: "OUTSIDE_SERVICE_AREA" };
}

const fixtureStock: Record<string, Partial<AvailabilityItem>> = {
  p3: { status: "low", remaining: 2 },
  p9: { status: "low", remaining: 3 },
  p15: { status: "out", remaining: null, maxPerOrder: null },
  p6: { maxPerOrder: 2 },
};

function fixtureAvailabilityFor(ids: string[]): AvailabilityItem[] {
  return ids.map((productId) => ({
    productId,
    status: "in_stock",
    remaining: null,
    maxPerOrder: 5,
    ...fixtureStock[productId],
  }));
}

/** Can we deliver to the selected address, and how fast. */
export function useServiceability() {
  const { lat, lng } = useAddressStore((st) => selectedOf(st));
  return useQuery({
    queryKey: queryKeys.serviceability(lat, lng),
    queryFn: async ({ signal }): Promise<ServiceabilityResponse> => {
      if (!api) return fixtureServiceability(lat, lng);
      return api.inventory.serviceability({ lat, lng }, { signal });
    },
    staleTime: 2 * 60_000,
  });
}

/**
 * Stock for every product in the catalog at the serving warehouse, fetched once and shared by all
 * cards on screen. `select` picks one product so a card only re-renders when its own stock changes.
 */
function useAvailabilityQuery<T>(select: (items: AvailabilityItem[]) => T) {
  const warehouseId = useServiceability().data?.warehouseId ?? null;
  const ids = (useProducts({ limit: 100 }).data ?? []).map((p) => p.id);

  return useQuery({
    queryKey: queryKeys.availability(warehouseId ?? "none", ids),
    enabled: warehouseId !== null && ids.length > 0,
    staleTime: 30_000,
    queryFn: async ({ signal }): Promise<AvailabilityItem[]> => {
      if (!api) return fixtureAvailabilityFor(ids);
      return (await api.inventory.availability(warehouseId as string, ids, { signal })).items;
    },
    select,
  });
}

/** Stock for one product. `undefined` while unknown, which callers treat as available. */
export function useStock(productId: string): AvailabilityItem | undefined {
  return useAvailabilityQuery((items) => items.find((i) => i.productId === productId)).data;
}
