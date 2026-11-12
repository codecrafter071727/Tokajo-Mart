/**
 * Demo data for the orders and riders pages. These types are a DRAFT of the order and delivery
 * contracts (week plan A7); replace them with imports from @qc/contracts when those exist.
 * Money is integer paise.
 */

export type OrderStatus =
  "placed" | "confirmed" | "packing" | "out_for_delivery" | "delivered" | "cancelled";

export type DemoOrder = {
  id: string;
  number: string;
  customer: string;
  items: number;
  totalPaise: number;
  payment: "COD" | "Paid online";
  status: OrderStatus;
  placedAt: string;
  rider: string | null;
  warehouse: string;
};

export type RiderStatus = "online" | "on_delivery" | "offline";

export type DemoRider = {
  id: string;
  name: string;
  phone: string;
  vehicle: string;
  status: RiderStatus;
  deliveriesToday: number;
  rating: number;
  warehouse: string;
};

const WAREHOUSE = "Noida Sector 62";

const names = [
  "Asha Verma",
  "Rohit Mehra",
  "Meera Kapoor",
  "Vikram Singh",
  "Neha Gupta",
  "Arjun Rao",
  "Sana Khan",
  "Ishaan Joshi",
];
const statuses: OrderStatus[] = [
  "placed",
  "confirmed",
  "packing",
  "packing",
  "out_for_delivery",
  "out_for_delivery",
  "delivered",
  "delivered",
  "delivered",
  "delivered",
  "cancelled",
  "delivered",
  "out_for_delivery",
  "placed",
];

/** Orders spread over the last few hours, newest first. */
export function makeOrders(now: Date): DemoOrder[] {
  return statuses.map((status, i) => ({
    id: `o${i + 1}`,
    number: `QC${24850 - i * 3}`,
    customer: names[i % names.length]!,
    items: 2 + (i % 5),
    totalPaise: 14900 + ((i * 7919) % 42000),
    payment: i % 3 === 0 ? "COD" : "Paid online",
    status,
    placedAt: new Date(now.getTime() - (i * 11 + 3) * 60_000).toISOString(),
    rider:
      status === "out_for_delivery" || status === "delivered"
        ? ["Ravi Kumar", "Sunil Yadav", "Imran Ali"][i % 3]!
        : null,
    warehouse: WAREHOUSE,
  }));
}

export const riders: DemoRider[] = [
  {
    id: "r1",
    name: "Ravi Kumar",
    phone: "+91 98100 00011",
    vehicle: "Bike, DL 8S 4521",
    status: "on_delivery",
    deliveriesToday: 9,
    rating: 4.8,
    warehouse: WAREHOUSE,
  },
  {
    id: "r2",
    name: "Sunil Yadav",
    phone: "+91 98100 00012",
    vehicle: "Bike, UP 16 AB 7710",
    status: "on_delivery",
    deliveriesToday: 7,
    rating: 4.6,
    warehouse: WAREHOUSE,
  },
  {
    id: "r3",
    name: "Imran Ali",
    phone: "+91 98100 00013",
    vehicle: "Scooter, UP 14 CD 2231",
    status: "online",
    deliveriesToday: 11,
    rating: 4.9,
    warehouse: WAREHOUSE,
  },
  {
    id: "r4",
    name: "Deepak Sharma",
    phone: "+91 98100 00014",
    vehicle: "Bike, DL 3C 9084",
    status: "online",
    deliveriesToday: 5,
    rating: 4.4,
    warehouse: WAREHOUSE,
  },
  {
    id: "r5",
    name: "Manoj Tiwari",
    phone: "+91 98100 00015",
    vehicle: "Bike, UP 16 EF 5502",
    status: "offline",
    deliveriesToday: 0,
    rating: 4.7,
    warehouse: WAREHOUSE,
  },
  {
    id: "r6",
    name: "Pawan Singh",
    phone: "+91 98100 00016",
    vehicle: "Scooter, DL 1S 3367",
    status: "offline",
    deliveriesToday: 3,
    rating: 4.3,
    warehouse: WAREHOUSE,
  },
];
