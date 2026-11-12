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
  payment: "cod";
  address: DeliveryAddress;
  /** The customer tells this to the rider at the door */
  deliveryCode: string;
  /** Set when the order was cancelled, so its status never advances */
  cancelledAt: string | null;
};

export type PlaceOrderInput = {
  /** Sent again on a retry so a double tap or a flaky network never creates two orders */
  idempotencyKey: string;
  items: OrderItem[];
  tipPaise: number;
  address: DeliveryAddress;
  payment: "cod";
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
}

/**
 * Demo timeline in seconds since placing. The real service moves an order on as the warehouse and
 * rider act; here it advances with the clock so the whole journey can be watched in a minute or two.
 */
export const DEMO_TIMELINE = { confirmed: 5, picking: 20, on_the_way: 50, delivered: 110 } as const;

/** The status an order has at `now`. Pure, so it is easy to test and never gets out of sync. */
export function statusAt(order: Pick<Order, "placedAt" | "cancelledAt">, now: Date): OrderStatus {
  if (order.cancelledAt) return "cancelled";
  const seconds = (now.getTime() - Date.parse(order.placedAt)) / 1000;
  if (seconds >= DEMO_TIMELINE.delivered) return "delivered";
  if (seconds >= DEMO_TIMELINE.on_the_way) return "on_the_way";
  if (seconds >= DEMO_TIMELINE.picking) return "picking";
  if (seconds >= DEMO_TIMELINE.confirmed) return "confirmed";
  return "placed";
}

/** Whole minutes left until the demo delivery time, never below 1 while the order is in flight. */
export function etaMinutes(order: Pick<Order, "placedAt">, now: Date): number {
  const remaining = DEMO_TIMELINE.delivered - (now.getTime() - Date.parse(order.placedAt)) / 1000;
  return Math.max(1, Math.ceil(remaining / 60));
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
