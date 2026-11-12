import { priceCart } from "./pricing";
import type { Order, OrderItem } from "./orders";

/** A few finished orders so the history is not empty on first launch. */

const item = (
  productId: string,
  name: string,
  unit: string,
  price: number,
  mrp: number,
  emoji: string,
  quantity = 1,
): OrderItem => ({
  productId,
  name,
  unit,
  quantity,
  unitPricePaise: price * 100,
  mrpPaise: mrp * 100,
  emoji,
});

const HOME = { tag: "Home", line1: "123, MG Road, Indiranagar", line2: "Bengaluru - 560038" };

function order(id: string, daysAgo: number, items: OrderItem[], cancelled = false): Order {
  const placedAt = new Date(Date.now() - daysAgo * 86_400_000 - 3_600_000);
  const priced = priceCart(
    items.map((i) => ({
      unitPricePaise: i.unitPricePaise,
      mrpPaise: i.mrpPaise,
      quantity: i.quantity,
    })),
    0,
  );
  return {
    ...priced,
    id,
    placedAt: placedAt.toISOString(),
    items,
    payment: "cod",
    address: HOME,
    deliveryCode: "0000",
    cancelledAt: cancelled ? new Date(placedAt.getTime() + 60_000).toISOString() : null,
  };
}

export function makeSeedOrders(): Order[] {
  return [
    order("QC24988", 1, [
      item("p1", "Fresho Banana - Robusta", "6 pcs (approx 500 g)", 25, 35, "🍌", 2),
      item("p5", "Amul Taaza Toned Fresh Milk", "500 ml", 29, 31, "🥛", 2),
      item("p18", "Modern Atta Bread", "400 g", 45, 50, "🍞"),
    ]),
    order("QC24931", 3, [
      item("p13", "Coca-Cola Soft Drink", "750 ml", 40, 45, "🥤", 2),
      item("p9", "Lay's Potato Chips Classic Salted", "52 g", 20, 20, "🥔", 3),
    ]),
    order("QC24870", 6, [item("p2", "Tomato - Hybrid", "500 g", 18, 24, "🍅", 2)], true),
  ];
}
