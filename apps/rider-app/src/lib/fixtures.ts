import type { Delivery } from "./delivery";

/** Demo data until the delivery service exists. Noida Sector 62 area, matching the customer app. */

const STORE = {
  name: "Noida Sector 62 store",
  address: "Plot 14, Sector 62, Noida",
  lat: 28.6279,
  lng: 77.3649,
};

type Seed = Pick<Delivery, "orderNumber" | "customer" | "items" | "distanceKm" | "etaMins"> & {
  tipPaise: number;
  codPaise: number | null;
  deliveryCode: string;
};

const SEEDS: Seed[] = [
  {
    orderNumber: "QC24817",
    customer: {
      name: "Asha Verma",
      address: "B-204, Supertech Capetown, Sector 74",
      lat: 28.5976,
      lng: 77.3862,
      phone: "+919810000001",
      instructions: "Ring the bell twice",
    },
    items: [
      { id: "a1", name: "Amul Taaza Toned Fresh Milk", quantity: 2, emoji: "🥛" },
      { id: "a2", name: "Modern Atta Bread", quantity: 1, emoji: "🍞" },
      { id: "a3", name: "Fresho Banana", quantity: 1, emoji: "🍌" },
    ],
    distanceKm: 2.4,
    etaMins: 13,
    tipPaise: 2000,
    codPaise: null,
    deliveryCode: "4821",
  },
  {
    orderNumber: "QC24822",
    customer: {
      name: "Rohit Mehra",
      address: "Flat 9C, Jaypee Greens, Sector 128",
      lat: 28.5421,
      lng: 77.3407,
      phone: "+919810000002",
      instructions: null,
    },
    items: [
      { id: "b1", name: "Lay's Classic Salted", quantity: 3, emoji: "🥔" },
      { id: "b2", name: "Coca-Cola Soft Drink", quantity: 2, emoji: "🥤" },
    ],
    distanceKm: 3.1,
    etaMins: 16,
    tipPaise: 0,
    codPaise: 28900,
    deliveryCode: "7305",
  },
  {
    orderNumber: "QC24829",
    customer: {
      name: "Meera Kapoor",
      address: "House 22, Sector 51",
      lat: 28.5772,
      lng: 77.3561,
      phone: "+919810000003",
      instructions: "Leave with the guard if no answer",
    },
    items: [
      { id: "c1", name: "Amul Butter", quantity: 1, emoji: "🧈" },
      { id: "c2", name: "Amul Malai Paneer Fresh", quantity: 1, emoji: "🧀" },
      { id: "c3", name: "Mother Dairy Curd", quantity: 2, emoji: "🍶" },
    ],
    distanceKm: 1.8,
    etaMins: 11,
    tipPaise: 1000,
    codPaise: null,
    deliveryCode: "1196",
  },
];

/** Builds the nth offer, cycling through the demo orders with fresh ids. */
export function makeOffer(n: number): Delivery {
  const seed = SEEDS[n % SEEDS.length]!;
  return {
    id: `d${n + 1}`,
    orderNumber: seed.orderNumber,
    status: "offered",
    store: STORE,
    customer: seed.customer,
    items: seed.items,
    distanceKm: seed.distanceKm,
    etaMins: seed.etaMins,
    payoutPaise: 3500 + Math.round(seed.distanceKm * 600),
    tipPaise: seed.tipPaise,
    codPaise: seed.codPaise,
    deliveryCode: seed.deliveryCode,
    deliveredAt: null,
  };
}

/** A few deliveries already completed earlier today, so the earnings tab is not empty. */
export function makeTodayHistory(now: Date): Delivery[] {
  return [
    { hoursAgo: 4.5, n: 7 },
    { hoursAgo: 3, n: 8 },
    { hoursAgo: 1.5, n: 9 },
  ].map(({ hoursAgo, n }) => ({
    ...makeOffer(n),
    status: "delivered" as const,
    deliveredAt: new Date(now.getTime() - hoursAgo * 3_600_000).toISOString(),
  }));
}
