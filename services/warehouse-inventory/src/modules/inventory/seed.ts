import type { StockRecord, Warehouse } from "./domain";

export const seedWarehouses: Warehouse[] = [
  {
    id: "wh-noida-62",
    name: "Noida Sector 62",
    lat: 28.6279,
    lng: 77.3649,
    radiusKm: 5,
    open: true,
  },
  {
    id: "wh-indiranagar",
    name: "Bengaluru Indiranagar",
    lat: 12.9784,
    lng: 77.6408,
    radiusKm: 5,
    open: true,
  },
];

const PRODUCT_IDS = Array.from({ length: 20 }, (_, i) => `p${i + 1}`);

/** Everything is well stocked except a few items, so low and out of stock states are visible. */
const OVERRIDES: Record<string, { available: number; maxPerOrder?: number }> = {
  p3: { available: 2 }, // Onion, low
  p15: { available: 0 }, // Red Bull, out
  p9: { available: 3 }, // Lay's, low
  p6: { available: 40, maxPerOrder: 2 }, // Butter, limited per order
};

export const seedStock: StockRecord[] = seedWarehouses.flatMap((warehouse) =>
  PRODUCT_IDS.map((productId) => {
    const override = OVERRIDES[productId];
    return {
      productId,
      warehouseId: warehouse.id,
      // The second warehouse has no overrides so the data differs per warehouse
      available: warehouse.id === "wh-noida-62" ? (override?.available ?? 25) : 25,
      maxPerOrder: warehouse.id === "wh-noida-62" ? (override?.maxPerOrder ?? null) : null,
    };
  }),
);

/** Pincodes each seeded warehouse delivers to. Requests with a pincode are matched by these. */
export const seedPincodes: Record<string, string[]> = {
  "wh-noida-62": ["201301", "201307", "201309"],
  "wh-indiranagar": ["560008", "560038", "560075"],
};

/**
 * Opening hours, India time. Indiranagar keeps typical dark store hours (6 AM to 1 AM). Noida is
 * left without hours, which means open all day: local demos and the end to end test place real
 * orders there at any hour, including in CI at night.
 */
export const seedHours: Record<string, { weekday: number; opensAt: string; closesAt: string }[]> = {
  "wh-indiranagar": [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
    weekday,
    opensAt: "06:00",
    closesAt: "01:00",
  })),
};
