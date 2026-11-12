/**
 * Pricing is defined once in @qc/contracts and shared with the order service, so the cart, checkout
 * and the server can never disagree. Everything is integer paise.
 */
export {
  DELIVERY_FEE_PAISE,
  FREE_DELIVERY_MIN_PAISE,
  HANDLING_FEE_PAISE,
  priceCart,
  type PriceBreakdown,
  type PriceLine,
} from "@qc/contracts";
import type { PriceLine } from "@qc/contracts";

/** Cart items hold rupees (the UI works in rupees); the pricing code works in paise. */
export function toPriceLines(
  items: { price: number; mrp: number; quantity: number }[],
): PriceLine[] {
  return items.map((i) => ({
    unitPricePaise: Math.round(i.price * 100),
    mrpPaise: Math.round(i.mrp * 100),
    quantity: i.quantity,
  }));
}

/** Whole rupees when exact, otherwise two decimals: 2900 -> "₹29", 2950 -> "₹29.50". */
export function formatPaise(paise: number): string {
  const rupees = paise / 100;
  return Number.isInteger(rupees) ? `₹${rupees}` : `₹${rupees.toFixed(2)}`;
}
