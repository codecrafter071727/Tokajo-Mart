"use client";

import { useQuery } from "@tanstack/react-query";
import { gw } from "./gw";

export type ProductName = {
  id: string;
  name: string;
  unit: string;
  emoji: string;
  imageUrl?: string | null;
  imageFit?: "cover" | "contain";
};

/** Every product (archived too, so old stock still has a name), paged through the admin list. */
export function useProductNames() {
  return useQuery({
    queryKey: ["product-names"],
    staleTime: 60_000,
    queryFn: async () => {
      const all = new Map<string, ProductName>();
      let cursor: string | null = null;
      for (let page = 0; page < 30; page += 1) {
        const res: { items: ProductName[]; nextCursor: string | null } = await gw(
          "GET",
          `/v1/catalog/admin/products?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
        );
        for (const p of res.items) all.set(p.id, p);
        cursor = res.nextCursor;
        if (!cursor) break;
      }
      return all;
    },
  });
}
