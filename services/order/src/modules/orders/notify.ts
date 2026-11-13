import type { OrderStatus } from "@qc/contracts";
import type { InternalClient } from "@qc/service-kit";

export type OrderEvent = OrderStatus | "refunded";

type OrderFacts = {
  id: string;
  number: string;
  userId: string;
  cancelReason?: string | null;
  refundPaise?: number;
};

const rupees = (paise: number) => {
  const value = paise / 100;
  return `₹${Number.isInteger(value) ? value : value.toFixed(2)}`;
};

/** What the customer reads for each step. Short and warm; null means we say nothing. */
export function orderMessage(
  event: OrderEvent,
  order: OrderFacts,
): { type: string; title: string; body: string } | null {
  const short = `#${order.number.split("-").at(-1) ?? order.number}`;
  switch (event) {
    case "confirmed":
      return {
        type: "order.confirmed",
        title: "Order confirmed",
        body: `We have your order ${short}. Packing starts in a moment.`,
      };
    case "packing":
      return {
        type: "order.packing",
        title: "Packing your order",
        body: "Your items are being picked fresh right now.",
      };
    case "out_for_delivery":
      return {
        type: "order.out_for_delivery",
        title: "On the way!",
        body: "Your order is out for delivery. Keep your 4 digit code handy.",
      };
    case "delivered":
      return {
        type: "order.delivered",
        title: "Delivered. Enjoy!",
        body: `Order ${short} has reached you. Thanks for shopping with us.`,
      };
    case "cancelled":
      return {
        type: "order.cancelled",
        title: "Order cancelled",
        body: order.cancelReason
          ? `Order ${short} was cancelled: ${order.cancelReason}`
          : `Order ${short} was cancelled.`,
      };
    case "refunded":
      return {
        type: "order.refunded",
        title: "Refund started",
        body: order.refundPaise
          ? `${rupees(order.refundPaise)} is on its way back to you. It usually takes 5 to 7 working days.`
          : "Your money is on its way back. It usually takes 5 to 7 working days.",
      };
    default:
      return null;
  }
}

/**
 * Tells the customer, without ever slowing down or failing the order: the call is not awaited and
 * any error is swallowed. The dedupe key makes a retried step harmless.
 */
export function notifyCustomer(
  client: InternalClient | undefined,
  event: OrderEvent,
  order: OrderFacts,
  log?: (error: unknown) => void,
): void {
  if (!client) return;
  const message = orderMessage(event, order);
  if (!message) return;
  void client
    .post("/internal/notify", {
      userId: order.userId,
      ...message,
      data: { orderId: order.id, orderNumber: order.number },
      dedupeKey: `order:${order.id}:${event}`,
    })
    .catch((error: unknown) => log?.(error));
}
