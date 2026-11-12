import type { StockStatus } from "@qc/contracts";

/** Real stock at or below this is shown to the customer as "Only N left". */
export const LOW_STOCK_THRESHOLD = 3;

/** Default per order limit for an item when the warehouse sets none. */
export const DEFAULT_MAX_PER_ORDER = 5;

export type Warehouse = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  /** Customers within this distance of the warehouse can order */
  radiusKm: number;
  open: boolean;
};

export type StockRecord = {
  productId: string;
  warehouseId: string;
  available: number;
  maxPerOrder: number | null;
};

const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great circle distance in kilometres. */
export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** Delivery promise: a fixed packing and pickup time plus riding time that grows with distance. */
export function etaMinutes(distance: number): number {
  return Math.max(8, Math.round(6 + distance * 2));
}

export function stockStatus(available: number): StockStatus {
  if (available <= 0) return "out";
  if (available <= LOW_STOCK_THRESHOLD) return "low";
  return "in_stock";
}
