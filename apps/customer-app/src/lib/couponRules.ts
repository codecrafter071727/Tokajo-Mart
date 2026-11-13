import type { CouponOffer, CouponTerms, PriceLine } from "@qc/contracts";
import { HttpError } from "./httpError";
import { priceCart } from "./pricing";
import type { AppliedCoupon } from "../store/coupon";

export const termsOf = (offer: CouponOffer): CouponTerms => ({
  code: offer.code,
  type: offer.type,
  value: offer.value,
  maxDiscountPaise: offer.maxDiscountPaise,
  minOrderPaise: offer.minOrderPaise,
});

export const toApplied = (offer: CouponOffer): AppliedCoupon => ({
  ...termsOf(offer),
  title: offer.title,
});

/** What an offer would save on this cart right now, in paise (0 when it does not apply yet). */
export function savingOn(lines: PriceLine[], tipPaise: number, offer: CouponOffer): number {
  return priceCart(lines, tipPaise, termsOf(offer)).couponSavingsPaise;
}

const rupees = (paise: number) => {
  const r = paise / 100;
  return `₹${Number.isInteger(r) ? r : r.toFixed(2)}`;
};

/** A short line under an offer: what it gives, and the minimum if there is one. */
export function offerLine(offer: CouponOffer): string {
  const off =
    offer.type === "percent"
      ? `${offer.value}% off${offer.maxDiscountPaise ? ` up to ${rupees(offer.maxDiscountPaise)}` : ""}`
      : offer.type === "flat"
        ? `${rupees(offer.value)} off`
        : "Free delivery";
  return offer.minOrderPaise > 0 ? `${off} on orders above ${rupees(offer.minOrderPaise)}` : off;
}

/** True when the order service turned an order down because of its coupon. */
export function isCouponError(error: unknown): boolean {
  return (
    error instanceof HttpError &&
    error.status === 409 &&
    typeof (error.details as { coupon?: unknown } | undefined)?.coupon === "string"
  );
}
