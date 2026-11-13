import { priceCart, type PriceBreakdown, type PriceLine } from "./pricing";

/**
 * Customer side order model. A DRAFT of the order contract (week plan A7): replace these types with
 * imports from @qc/contracts once the order service publishes them. Money is integer paise.
 */

export type OrderStatus =
  "placed" | "confirmed" | "picking" | "on_the_way" | "delivered" | "cancelled";

export type OrderItem = {
  productId: string;
  name: string;
  unit: string;
  quantity: number;
  unitPricePaise: number;
  mrpPaise: number;
  emoji: string;
  imageUrl?: string;
};

export type DeliveryAddress = { tag: string; line1: string; line2: string };

export type Order = PriceBreakdown & {
  id: string;
  placedAt: string;
  items: OrderItem[];
  /** Cash on delivery, or paid online through Razorpay before the store starts */
  payment: "cod" | "online";
  address: DeliveryAddress;
  /** The customer tells this to the rider at the door. Empty until an online order is paid. */
  deliveryCode: string;
  /** The delivery time promised at checkout, in minutes (from the serviceability check) */
  promisedMins: number;
  /** Set when the order was cancelled, so its status never advances */
  cancelledAt: string | null;
  /**
   * Present on orders that come from the order service. The service decides the status, so the
   * clock based demo timeline below is skipped for them.
   */
  server?: {
    number: string;
    /** The service's own status, for example "packing" or "out_for_delivery" */
    status: string;
    pickedUpAt: string | null;
    deliveredAt: string | null;
    rider: { name: string; phone: string | null; rating: number } | null;
  };
};

export type PlaceOrderInput = {
  /** Sent again on a retry so a double tap or a flaky network never creates two orders */
  idempotencyKey: string;
  items: OrderItem[];
  tipPaise: number;
  address: DeliveryAddress;
  payment: "cod" | "online";
  /** The ETA shown at checkout, kept on the order so tracking never contradicts it */
  promisedMins: number;
  /** Where to deliver, sent to the order service so it can pick the serving warehouse */
  location?: { lat: number; lng: number; instructions?: string | null };
};

export class OrderError extends Error {
  readonly reason: "EMPTY_CART" | "INVALID_ITEM" | "INVALID_TIP" | "MISSING_KEY";
  constructor(reason: OrderError["reason"], message: string) {
    super(message);
    this.name = "OrderError";
    this.reason = reason;
  }
}

export interface OrderRepository {
  place(input: PlaceOrderInput): Promise<Order>;
  get(id: string): Promise<Order | null>;
  /** Newest first */
  list(): Promise<Order[]>;
  /** Cancel an order that has not started packing. Rejects with the server's reason otherwise. */
  cancel?(id: string): Promise<Order>;
}

/** The app's coarse status for each status the order service reports. */
const FROM_SERVER: Record<string, OrderStatus> = {
  pending_payment: "placed",
  confirmed: "confirmed",
  packing: "picking",
  packed: "picking",
  picked_up: "on_the_way",
  out_for_delivery: "on_the_way",
  delivered: "delivered",
  cancelled: "cancelled",
  payment_failed: "cancelled",
  expired: "cancelled",
};

/** How far along the journey each server status is, for the progress bar. */
const SERVER_PROGRESS: Record<string, number> = {
  pending_payment: 0.05,
  confirmed: 0.15,
  packing: 0.35,
  packed: 0.5,
  picked_up: 0.6,
  out_for_delivery: 0.7,
  delivered: 1,
};

/**
 * Demo timeline in seconds since placing. The real service moves an order on as the warehouse and
 * rider act; here it advances with the clock so the whole journey can be watched in a minute or two.
 */
export const DEMO_TIMELINE = { confirmed: 5, picking: 20, on_the_way: 50, delivered: 110 } as const;

/** The status an order has at `now`. Pure, so it is easy to test and never gets out of sync. */
export function statusAt(
  order: Pick<Order, "placedAt" | "cancelledAt"> & { server?: Order["server"] },
  now: Date,
): OrderStatus {
  if (order.server) return FROM_SERVER[order.server.status] ?? "placed";
  if (order.cancelledAt) return "cancelled";
  const seconds = (now.getTime() - Date.parse(order.placedAt)) / 1000;
  if (seconds >= DEMO_TIMELINE.delivered) return "delivered";
  if (seconds >= DEMO_TIMELINE.on_the_way) return "on_the_way";
  if (seconds >= DEMO_TIMELINE.picking) return "picking";
  if (seconds >= DEMO_TIMELINE.confirmed) return "confirmed";
  return "placed";
}

/**
 * Minutes left, counted down from the time promised at checkout. The demo timeline is compressed
 * (about two minutes), so the promise is scaled by how far through it we are: an 8 minute promise
 * reads 8 at the start and 1 just before delivery. Never below 1 while the order is in flight.
 */
export function etaMinutes(
  order: Pick<Order, "placedAt" | "promisedMins"> & { server?: Order["server"] },
  now: Date,
): number {
  if (order.server) {
    // Real time: the promise minus what has already passed, never below 1 while in flight
    const passed = (now.getTime() - Date.parse(order.placedAt)) / 60_000;
    return Math.max(1, Math.ceil(order.promisedMins - passed));
  }
  const elapsed = (now.getTime() - Date.parse(order.placedAt)) / 1000;
  const fractionLeft = Math.max(0, 1 - elapsed / DEMO_TIMELINE.delivered);
  return Math.max(1, Math.ceil(order.promisedMins * fractionLeft));
}

/** How far through the journey, 0 at placing and 1 at the door, for drawing progress. */
export function journeyProgress(
  order: Pick<Order, "placedAt" | "cancelledAt"> & { server?: Order["server"] },
  now: Date,
): number {
  if (order.server) return SERVER_PROGRESS[order.server.status] ?? 0;
  const elapsed = (now.getTime() - Date.parse(order.placedAt)) / 1000;
  return Math.min(1, Math.max(0, elapsed / DEMO_TIMELINE.delivered));
}

/**
 * Where the rider is on the way to the customer: 0 at the store, 1 at the door. The rider stays
 * at the store until the order is out for delivery, then moves along the route.
 */
export function riderProgress(
  order: Pick<Order, "placedAt" | "cancelledAt"> & { server?: Order["server"] },
  now: Date,
): number {
  if (order.server) {
    const { status, pickedUpAt } = order.server;
    if (status === "delivered") return 1;
    if ((status === "picked_up" || status === "out_for_delivery") && pickedUpAt) {
      // Ride time is a guess (a few minutes): never reaches the door until it is delivered
      const minutes = (now.getTime() - Date.parse(pickedUpAt)) / 60_000;
      return Math.min(0.95, Math.max(0.05, minutes / 6));
    }
    return 0;
  }
  if (order.cancelledAt) return 0;
  const elapsed = (now.getTime() - Date.parse(order.placedAt)) / 1000;
  const start = DEMO_TIMELINE.on_the_way;
  const end = DEMO_TIMELINE.delivered;
  return Math.min(1, Math.max(0, (elapsed - start) / (end - start)));
}

const toLine = (i: OrderItem): PriceLine => ({
  unitPricePaise: i.unitPricePaise,
  mrpPaise: i.mrpPaise,
  quantity: i.quantity,
});

export function createInMemoryOrderRepository(
  options: { now?: () => Date; seed?: Order[] } = {},
): OrderRepository {
  const now = options.now ?? (() => new Date());
  const orders: Order[] = [...(options.seed ?? [])];
  const byKey = new Map<string, Order>();
  let counter = 25000;

  return {
    async place(input) {
      if (!input.idempotencyKey) throw new OrderError("MISSING_KEY", "Missing idempotency key.");
      // A retry of the same request returns the order that was already created
      const existing = byKey.get(input.idempotencyKey);
      if (existing) return existing;

      if (input.items.length === 0) throw new OrderError("EMPTY_CART", "Your cart is empty.");
      if (input.items.some((i) => !Number.isInteger(i.quantity) || i.quantity < 1)) {
        throw new OrderError("INVALID_ITEM", "Each item needs a quantity of at least 1.");
      }
      if (!Number.isInteger(input.promisedMins) || input.promisedMins < 1) {
        throw new OrderError("INVALID_ITEM", "A delivery time is needed to place an order.");
      }
      if (!Number.isInteger(input.tipPaise) || input.tipPaise < 0) {
        throw new OrderError("INVALID_TIP", "The tip must be zero or more.");
      }

      // Priced here from the items, not from any total the client computed
      const priced = priceCart(input.items.map(toLine), input.tipPaise);
      const order: Order = {
        ...priced,
        id: `QC${++counter}`,
        placedAt: now().toISOString(),
        items: input.items,
        payment: input.payment,
        address: input.address,
        deliveryCode: String(1000 + ((counter * 7919) % 9000)),
        promisedMins: input.promisedMins,
        cancelledAt: null,
      };
      orders.unshift(order);
      byKey.set(input.idempotencyKey, order);
      return order;
    },

    async get(id) {
      return orders.find((o) => o.id === id) ?? null;
    },

    async list() {
      return [...orders];
    },
  };
}
