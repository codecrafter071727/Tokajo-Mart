/**
 * The one place that decides what an order costs. The order service prices every order with it, and
 * the apps use the same function for the cart preview, so what the customer sees is what they are
 * charged. Everything is integer paise.
 */

export const FREE_DELIVERY_MIN_PAISE = 9900;
export const DELIVERY_FEE_PAISE = 2900;
export const HANDLING_FEE_PAISE = 500;

export type PriceLine = {
  unitPricePaise: number;
  mrpPaise: number;
  quantity: number;
};

/** A coupon's terms, as far as the price is concerned. Who may use it is checked by the server. */
export type CouponTerms = {
  code: string;
  type: "percent" | "flat" | "free_delivery";
  /** percent: whole percent; flat: paise; free_delivery: ignored */
  value: number;
  /** Cap for a percent coupon, null for none */
  maxDiscountPaise: number | null;
  /** The item total must reach this before the coupon applies */
  minOrderPaise: number;
};

export type PriceBreakdown = {
  itemTotalPaise: number;
  mrpTotalPaise: number;
  /** What the customer saves against MRP */
  savingsPaise: number;
  deliveryFeePaise: number;
  handlingFeePaise: number;
  tipPaise: number;
  totalPaise: number;
  /** How much more to add for free delivery, 0 once reached or when the cart is empty */
  toFreeDeliveryPaise: number;
  /** Taken off the total by a percent or flat coupon */
  discountPaise: number;
  /** Delivery fee waived by a free delivery coupon (the fee above is then 0) */
  deliveryWaivedPaise: number;
  /** What the coupon saves in all: discount plus waived delivery */
  couponSavingsPaise: number;
  /** The coupon that was applied, or null when none was given or it did not apply */
  appliedCoupon: { code: string; type: CouponTerms["type"] } | null;
  /** How much more the item total needs for the coupon to apply, 0 when it applies or none given */
  couponShortfallPaise: number;
};

/**
 * The saving a coupon gives on an item total. A percent coupon rounds down to whole paise and stops at
 * its cap; a flat coupon never exceeds the item total, so the customer always pays at least the fees.
 */
export function couponDiscount(itemTotalPaise: number, coupon: CouponTerms): number {
  if (coupon.type === "percent") {
    const raw = Math.floor((itemTotalPaise * coupon.value) / 100);
    return Math.min(raw, coupon.maxDiscountPaise ?? raw, itemTotalPaise);
  }
  if (coupon.type === "flat") return Math.min(coupon.value, itemTotalPaise);
  return 0;
}

export function priceCart(
  lines: PriceLine[],
  tipPaise = 0,
  coupon: CouponTerms | null = null,
): PriceBreakdown {
  if (!Number.isInteger(tipPaise) || tipPaise < 0) {
    throw new RangeError("The tip must be a whole number of paise, zero or more.");
  }
  for (const line of lines) {
    if (!Number.isInteger(line.quantity) || line.quantity < 1) {
      throw new RangeError("Each quantity must be a whole number of at least 1.");
    }
    if (!Number.isInteger(line.unitPricePaise) || line.unitPricePaise < 0) {
      throw new RangeError("Prices must be whole paise.");
    }
  }

  const itemTotalPaise = lines.reduce((sum, l) => sum + l.unitPricePaise * l.quantity, 0);
  const mrpTotalPaise = lines.reduce(
    (sum, l) => sum + Math.max(l.mrpPaise, l.unitPricePaise) * l.quantity,
    0,
  );

  // Nothing to deliver means nothing to charge, not even fees
  const empty = lines.length === 0;
  const normalDeliveryPaise =
    empty || itemTotalPaise >= FREE_DELIVERY_MIN_PAISE ? 0 : DELIVERY_FEE_PAISE;
  const handlingFeePaise = empty ? 0 : HANDLING_FEE_PAISE;
  const tip = empty ? 0 : tipPaise;

  // A coupon applies only to a cart that reaches its minimum
  const shortfall = coupon && !empty ? Math.max(0, coupon.minOrderPaise - itemTotalPaise) : 0;
  const applies = coupon !== null && !empty && shortfall === 0;
  const discountPaise = applies ? couponDiscount(itemTotalPaise, coupon) : 0;
  const deliveryWaivedPaise = applies && coupon.type === "free_delivery" ? normalDeliveryPaise : 0;
  const deliveryFeePaise = normalDeliveryPaise - deliveryWaivedPaise;

  return {
    itemTotalPaise,
    mrpTotalPaise,
    savingsPaise: mrpTotalPaise - itemTotalPaise,
    deliveryFeePaise,
    handlingFeePaise,
    tipPaise: tip,
    totalPaise: itemTotalPaise + deliveryFeePaise + handlingFeePaise + tip - discountPaise,
    toFreeDeliveryPaise: empty ? 0 : Math.max(0, FREE_DELIVERY_MIN_PAISE - itemTotalPaise),
    discountPaise,
    deliveryWaivedPaise,
    couponSavingsPaise: discountPaise + deliveryWaivedPaise,
    appliedCoupon: applies ? { code: coupon.code, type: coupon.type } : null,
    couponShortfallPaise: shortfall,
  };
}
