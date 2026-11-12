import type { Order as ServerOrder } from "@qc/contracts";
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
    payment: "cod",
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
    server: {
      number: order.number,
      status: order.status,
      pickedUpAt: order.pickedUpAt,
      deliveredAt: order.deliveredAt,
      rider: order.rider,
    },
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
