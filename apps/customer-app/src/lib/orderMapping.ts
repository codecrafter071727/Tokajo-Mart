import {
  DELIVERY_FEE_PAISE,
  FREE_DELIVERY_MIN_PAISE,
  type Order as ServerOrder,
} from "@qc/contracts";
import type { Order, OrderItem } from "./orders";
import { HttpError } from "./httpError";

/** Turns the order service's order into the model the screens already use. */
export function fromServer(order: ServerOrder): Order {
  const items: OrderItem[] = order.items.map((i) => ({
    productId: i.productId,
    name: i.name,
    unit: i.unit,
    quantity: i.quantity,
    unitPricePaise: i.unitPricePaise,
    mrpPaise: i.mrpPaise,
    emoji: i.emoji,
    imageUrl: i.imageUrl ?? undefined,
  }));
  return {
    id: order.id,
    placedAt: order.placedAt,
    items,
    payment: order.paymentMethod,
    address: order.address,
    deliveryCode: order.deliveryCode ?? "",
    promisedMins: order.promisedMins,
    cancelledAt: order.cancelledAt,
    itemTotalPaise: order.itemTotalPaise,
    mrpTotalPaise: order.mrpTotalPaise,
    savingsPaise: order.savingsPaise,
    deliveryFeePaise: order.deliveryFeePaise,
    handlingFeePaise: order.handlingFeePaise,
    tipPaise: order.tipPaise,
    totalPaise: order.totalPaise,
    toFreeDeliveryPaise: 0,
    ...couponParts(order),
    server: {
      number: order.number,
      status: order.status,
      pickedUpAt: order.pickedUpAt,
      deliveredAt: order.deliveredAt,
      rider: order.rider,
    },
  };
}

/**
 * The server keeps the code and the amount taken off. A free delivery code shows as a zero delivery
 * fee on a cart that would otherwise pay it, so the waived fee is worked out from that.
 */
function couponParts(order: ServerOrder) {
  const discountPaise = order.discountPaise ?? 0;
  const code = order.couponCode ?? null;
  const waived =
    code &&
    discountPaise === 0 &&
    order.deliveryFeePaise === 0 &&
    order.itemTotalPaise < FREE_DELIVERY_MIN_PAISE
      ? DELIVERY_FEE_PAISE
      : 0;
  return {
    discountPaise,
    deliveryWaivedPaise: waived,
    couponSavingsPaise: discountPaise + waived,
    appliedCoupon: code
      ? { code, type: (waived > 0 ? "free_delivery" : "flat") as "free_delivery" | "flat" }
      : null,
    couponShortfallPaise: 0,
  };
}

/** A customer friendly line for a failed order, including which items ran short when known. */
export function describeOrderError(error: unknown, names: Record<string, string>): string {
  if (!(error instanceof HttpError)) return "We could not place your order. Try again.";
  const details = error.details as
    | { unavailable?: { productId: string }[]; unknown?: string[] }
    | { productId: string; requested: number; available: number }[]
    | undefined;
  const ids = Array.isArray(details)
    ? details.map((d) => d.productId)
    : [...(details?.unavailable?.map((d) => d.productId) ?? []), ...(details?.unknown ?? [])];
  const list = ids.map((id) => names[id]).filter(Boolean);
  return list.length > 0 ? `${error.message} Check: ${list.join(", ")}.` : error.message;
}
