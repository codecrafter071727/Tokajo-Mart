import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import { fixtures, toHomeBanner, type HomeBanner } from "./bannerMapping";

export type { BannerLink, HomeBanner } from "./bannerMapping";

/**
 * Live banners from the catalog service when the app talks to a backend, the bundled ones when it
 * does not. A failed or empty read just means no strip: the home screen never shows an error for it.
 */
export function useBanners(): HomeBanner[] {
  const query = useQuery({
    queryKey: ["catalog", "banners"],
    enabled: api !== null,
    staleTime: 5 * 60_000,
    queryFn: async ({ signal }): Promise<HomeBanner[]> => {
      if (!api) return [];
      const { items } = await api.catalog.listBanners({ signal });
      return items.map(toHomeBanner);
    },
  });
  if (!api) return fixtures;
  return query.data ?? [];
}
