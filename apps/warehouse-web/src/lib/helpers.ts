/** Whole minutes since an order was placed, never negative. */
export function orderAgeMins(placedAt: string, now: Date = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(placedAt).getTime()) / 60_000));
}

/** True once an order has waited longer than the time we promised the customer. */
export function isLate(placedAt: string, promisedMins: number, now: Date = new Date()): boolean {
  return orderAgeMins(placedAt, now) >= promisedMins;
}

export type Urgency = "ok" | "soon" | "late";

/**
 * How worried the floor should be about an order: late once the promise is used up, "soon" once
 * 70 percent of it has gone, so packers see trouble coming before it arrives.
 */
export function urgency(placedAt: string, promisedMins: number, now: Date = new Date()): Urgency {
  const elapsed = (now.getTime() - new Date(placedAt).getTime()) / 60_000;
  if (elapsed >= promisedMins) return "late";
  if (elapsed >= promisedMins * 0.7) return "soon";
  return "ok";
}

/** A running clock for a card: "4:07" under an hour, "1:02:07" above. */
export function formatElapsed(placedAt: string, now: Date = new Date()): string {
  const total = Math.max(0, Math.floor((now.getTime() - new Date(placedAt).getTime()) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

export function formatAge(mins: number): string {
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)} h ${mins % 60} min`;
}

/**
 * The part of an order number people actually say out loud: "QC-261113-00042" becomes "#042".
 * Numbers restart every day, so the date prefix adds nothing on the floor.
 */
export function shortNumber(number: string): string {
  const last = number.split("-").pop() ?? number;
  const digits = last.replace(/^0+/, "") || "0";
  return `#${digits.padStart(3, "0")}`;
}

export const itemCount = (items: { quantity: number }[]) =>
  items.reduce((sum, i) => sum + i.quantity, 0);

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export const WAREHOUSES = [
  { id: "wh-noida-62", name: "Noida Sector 62" },
  { id: "wh-indiranagar", name: "Indiranagar" },
] as const;
