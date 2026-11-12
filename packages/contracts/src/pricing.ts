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
};

export function priceCart(lines: PriceLine[], tipPaise = 0): PriceBreakdown {
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
  const deliveryFeePaise =
    empty || itemTotalPaise >= FREE_DELIVERY_MIN_PAISE ? 0 : DELIVERY_FEE_PAISE;
  const handlingFeePaise = empty ? 0 : HANDLING_FEE_PAISE;
  const tip = empty ? 0 : tipPaise;

  return {
    itemTotalPaise,
    mrpTotalPaise,
    savingsPaise: mrpTotalPaise - itemTotalPaise,
    deliveryFeePaise,
    handlingFeePaise,
    tipPaise: tip,
    totalPaise: itemTotalPaise + deliveryFeePaise + handlingFeePaise + tip,
    toFreeDeliveryPaise: empty ? 0 : Math.max(0, FREE_DELIVERY_MIN_PAISE - itemTotalPaise),
  };
}
