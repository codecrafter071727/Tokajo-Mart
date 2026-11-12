/** Whole minutes since an order was placed, never negative. */
export function orderAgeMins(placedAt: string, now: Date = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(placedAt).getTime()) / 60_000));
}

/** True once an order has waited longer than the time we promised the customer. */
export function isLate(placedAt: string, promisedMins: number, now: Date = new Date()): boolean {
  return orderAgeMins(placedAt, now) >= promisedMins;
}

export function formatAge(mins: number): string {
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)} h ${mins % 60} min`;
}

export const itemCount = (items: { quantity: number }[]) =>
  items.reduce((sum, i) => sum + i.quantity, 0);

export const WAREHOUSES = [
  { id: "wh-noida-62", name: "Noida Sector 62" },
  { id: "wh-indiranagar", name: "Indiranagar" },
] as const;
