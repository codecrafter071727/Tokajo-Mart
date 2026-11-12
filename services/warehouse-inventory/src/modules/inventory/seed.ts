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
