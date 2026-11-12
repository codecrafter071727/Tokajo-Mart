import { distanceKm, type StockRecord, type Warehouse } from "./domain";

export type ServingWarehouse = { warehouse: Warehouse; distanceKm: number };

/**
 * Data access for the inventory module. The in-memory implementation serves seed data; a Postgres
 * (Kysely) implementation replaces it once the inventory schema exists, with no route changes.
 */
export interface InventoryRepository {
  /** Nearest open warehouse whose service area contains the point, or null */
  findServingWarehouse(lat: number, lng: number): Promise<ServingWarehouse | null>;
  /** Whether any warehouse covers the point, even a closed one (to tell "closed" from "too far") */
  findCoveringWarehouse(lat: number, lng: number): Promise<ServingWarehouse | null>;
  warehouseExists(warehouseId: string): Promise<boolean>;
  getStock(warehouseId: string, productIds: string[]): Promise<StockRecord[]>;
}

export function createInMemoryInventoryRepository(
  warehouses: Warehouse[],
  stock: StockRecord[],
): InventoryRepository {
  const covering = (lat: number, lng: number): ServingWarehouse[] =>
    warehouses
      .map((warehouse) => ({
        warehouse,
        distanceKm: distanceKm(lat, lng, warehouse.lat, warehouse.lng),
      }))
      .filter((entry) => entry.distanceKm <= entry.warehouse.radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm);

  return {
    async findServingWarehouse(lat, lng) {
      return covering(lat, lng).find((entry) => entry.warehouse.open) ?? null;
    },
    async findCoveringWarehouse(lat, lng) {
      return covering(lat, lng)[0] ?? null;
    },
    async warehouseExists(warehouseId) {
      return warehouses.some((w) => w.id === warehouseId);
    },
    async getStock(warehouseId, productIds) {
      const wanted = new Set(productIds);
      return stock.filter((s) => s.warehouseId === warehouseId && wanted.has(s.productId));
    },
  };
}
