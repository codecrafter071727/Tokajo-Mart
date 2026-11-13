import type { CouponOffer, ValidateCouponResponse } from "@qc/contracts";
import { useQuery } from "@tanstack/react-query";
import { apiFetch, backendEnabled } from "./session";

export { isCouponError, offerLine, savingOn, termsOf, toApplied } from "./couponRules";

export const couponsApi = {
  available: () =>
    apiFetch<{ items: CouponOffer[] }>("GET", "/v1/orders/coupons/available").then((r) => r.items),
  validate: (code: string, items: { productId: string; quantity: number }[], tipPaise: number) =>
    apiFetch<ValidateCouponResponse>("POST", "/v1/orders/coupons/validate", {
      body: { code, items, tipPaise },
    }),
};

/** Offers the customer can see. Coupons need the order service, so demo mode has none. */
export function useCouponOffers(enabled = true) {
  return useQuery({
    queryKey: ["coupons", "available"],
    queryFn: couponsApi.available,
    enabled: backendEnabled && enabled,
    staleTime: 60_000,
  });
}
