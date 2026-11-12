/**
 * Rider side delivery model and state machine.
 *
 * These types are a DRAFT of the delivery contract. When `packages/contracts/src/delivery.ts` is
 * published (week plan A7) they should be replaced by imports from it. Money is integer paise.
 */

export type DeliveryStatus =
  | "offered" // shown to the rider, not yet accepted
  | "assigned" // accepted, heading to the store
  | "at_store" // reached the store, collecting items
  | "picked_up" // has the order, heading to the customer
  | "at_customer" // reached the customer
  | "delivered";

export type Place = {
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
};

export type DeliveryItem = {
  id: string;
  name: string;
  quantity: number;
  emoji: string;
};

export type Delivery = {
  id: string;
  orderNumber: string;
  status: DeliveryStatus;
  store: Place;
  customer: Place & { phone: string; instructions: string | null };
  items: DeliveryItem[];
  distanceKm: number;
  etaMins: number;
  payoutPaise: number;
  tipPaise: number;
  /** Cash the rider must collect, or null when the order is already paid */
  codPaise: number | null;
  /**
   * Fixture mode only. The delivery service never sends this to the rider app: the customer reads
   * the code out at the door and the server checks what the rider types.
   */
  deliveryCode?: string;
  /** ISO time the delivery was completed, set when status becomes "delivered" */
  deliveredAt: string | null;
};

export type Action =
  | { type: "accept" }
  | { type: "arrive_store" }
  | { type: "pick_up"; checkedItemIds: string[]; handoverCode?: string }
  | { type: "arrive_customer" }
  | { type: "deliver"; code: string };

export class DeliveryError extends Error {
  readonly reason:
    | "INVALID_TRANSITION"
    | "ITEMS_NOT_CHECKED"
    | "WRONG_CODE"
    | "CODE_FORMAT"
    | "CODE_LOCKED"
    | "OFFER_EXPIRED"
    | "NETWORK"
    | "UNAUTHORIZED";

  constructor(reason: DeliveryError["reason"], message: string) {
    super(message);
    this.name = "DeliveryError";
    this.reason = reason;
  }
}

/** Which action moves a delivery out of each status. `delivered` is terminal. */
export const NEXT_ACTION: Record<DeliveryStatus, Action["type"] | null> = {
  offered: "accept",
  assigned: "arrive_store",
  at_store: "pick_up",
  picked_up: "arrive_customer",
  at_customer: "deliver",
  delivered: null,
};

const NEXT_STATUS: Record<Action["type"], DeliveryStatus> = {
  accept: "assigned",
  arrive_store: "at_store",
  pick_up: "picked_up",
  arrive_customer: "at_customer",
  deliver: "delivered",
};

export const DELIVERY_CODE_LENGTH = 4;

/**
 * Apply one action. Pure: returns a new delivery or throws a DeliveryError, never mutates.
 * `now` is injected so tests do not depend on the clock.
 */
export function applyAction(delivery: Delivery, action: Action, now: Date = new Date()): Delivery {
  if (NEXT_ACTION[delivery.status] !== action.type) {
    throw new DeliveryError(
      "INVALID_TRANSITION",
      `Cannot ${action.type} while the delivery is ${delivery.status}.`,
    );
  }

  if (action.type === "pick_up") {
    const checked = new Set(action.checkedItemIds);
    if (!delivery.items.every((item) => checked.has(item.id))) {
      throw new DeliveryError("ITEMS_NOT_CHECKED", "Check every item before leaving the store.");
    }
  }

  if (action.type === "deliver") {
    if (!new RegExp(`^\\d{${DELIVERY_CODE_LENGTH}}$`).test(action.code)) {
      throw new DeliveryError("CODE_FORMAT", `Enter the ${DELIVERY_CODE_LENGTH} digit code.`);
    }
    if (action.code !== delivery.deliveryCode) {
      throw new DeliveryError("WRONG_CODE", "That code does not match. Ask the customer again.");
    }
  }

  return {
    ...delivery,
    status: NEXT_STATUS[action.type],
    deliveredAt: action.type === "deliver" ? now.toISOString() : delivery.deliveredAt,
  };
}

/** What the rider earns for a delivery, in paise. */
export const earningsPaise = (d: Pick<Delivery, "payoutPaise" | "tipPaise">) =>
  d.payoutPaise + d.tipPaise;

/** Whole rupees when exact, otherwise two decimals: 4500 -> "₹45", 4550 -> "₹45.50". */
export function formatPaise(paise: number): string {
  const rupees = paise / 100;
  return Number.isInteger(rupees) ? `₹${rupees}` : `₹${rupees.toFixed(2)}`;
}
