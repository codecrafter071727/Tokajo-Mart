import type { OrderStatus } from "@qc/contracts";
import type { Tone } from "../components/ui/core";

/** How each order status reads and looks everywhere in the console. */
export const ORDER_STATUS: Record<OrderStatus, { label: string; tone: Tone }> = {
  pending_payment: { label: "Awaiting payment", tone: "neutral" },
  confirmed: { label: "New", tone: "info" },
  packing: { label: "Packing", tone: "warn" },
  packed: { label: "Packed", tone: "warn" },
  picked_up: { label: "Picked up", tone: "warn" },
  out_for_delivery: { label: "On the way", tone: "warn" },
  delivered: { label: "Delivered", tone: "ok" },
  cancelled: { label: "Cancelled", tone: "bad" },
  payment_failed: { label: "Payment failed", tone: "bad" },
  expired: { label: "Expired", tone: "neutral" },
};
