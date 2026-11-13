/**
 * Places a customer can choose for an address. There is no map yet, so an address gets its
 * coordinates from the area it is in. Whether we deliver there is decided by the server at
 * checkout; `servedLocally` only mirrors the seeded warehouses so the picker can say it up front
 * and so the app still behaves sensibly with no backend.
 */
export type ServiceArea = {
  id: string;
  name: string;
  city: string;
  pincode: string;
  lat: number;
  lng: number;
};

/** Mirrors services/warehouse-inventory seed (centre and radius). */
export const WAREHOUSE_COVERAGE = [
  { id: "wh-noida-62", lat: 28.6279, lng: 77.3649, radiusKm: 5 },
  { id: "wh-indiranagar", lat: 12.9784, lng: 77.6408, radiusKm: 5 },
] as const;

export const SERVICE_AREAS: ServiceArea[] = [
  {
    id: "noida-62",
    name: "Sector 62",
    city: "Noida",
    pincode: "201309",
    lat: 28.6208,
    lng: 77.3649,
  },
  {
    id: "noida-63",
    name: "Sector 63",
    city: "Noida",
    pincode: "201301",
    lat: 28.6301,
    lng: 77.3801,
  },
  {
    id: "noida-18",
    name: "Sector 18",
    city: "Noida",
    pincode: "201301",
    lat: 28.5708,
    lng: 77.3261,
  },
  {
    id: "indiranagar",
    name: "Indiranagar",
    city: "Bengaluru",
    pincode: "560038",
    lat: 12.9784,
    lng: 77.6408,
  },
];

export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const h =
    Math.sin(rad(bLat - aLat) / 2) ** 2 +
    Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(rad(bLng - aLng) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** The warehouse that covers a point, if any. */
export function coveringWarehouse(lat: number, lng: number): string | null {
  const hit = WAREHOUSE_COVERAGE.find((w) => distanceKm(w.lat, w.lng, lat, lng) <= w.radiusKm);
  return hit?.id ?? null;
}

/**
 * Mirrors the seeded warehouse pincodes (services/warehouse-inventory seed). Once pincodes are set
 * up the server matches an address by its pincode first, so the hint here does the same.
 */
export const WAREHOUSE_PINCODES: Record<string, readonly string[]> = {
  "wh-noida-62": ["201301", "201307", "201309"],
  "wh-indiranagar": ["560008", "560038", "560075"],
};

export const findArea = (id: string) => SERVICE_AREAS.find((a) => a.id === id);

/** Whether we expect to deliver to a place: by its pincode when it has one, else by distance. */
export function servedLocally(place: {
  lat: number;
  lng: number;
  pincode?: string | null;
  areaId?: string;
}): boolean {
  const pincode = place.pincode ?? (place.areaId ? findArea(place.areaId)?.pincode : undefined);
  if (pincode) return Object.values(WAREHOUSE_PINCODES).some((list) => list.includes(pincode));
  return coveringWarehouse(place.lat, place.lng) !== null;
}
