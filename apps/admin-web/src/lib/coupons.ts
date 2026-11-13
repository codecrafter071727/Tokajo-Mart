import type { AdminCoupon } from "@qc/contracts";
import { rupees } from "./api";

/** "₹50 off", "10% off up to ₹75", "Free delivery" */
export function couponValue(c: Pick<AdminCoupon, "type" | "value" | "maxDiscountPaise">): string {
  if (c.type === "percent") {
    return `${c.value}% off${c.maxDiscountPaise ? ` up to ${rupees(c.maxDiscountPaise)}` : ""}`;
  }
  if (c.type === "flat") return `${rupees(c.value)} off`;
  return "Free delivery";
}
