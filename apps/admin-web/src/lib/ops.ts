import type { AdminDelivery } from "@qc/contracts";
import type { Tone } from "../components/kit";

/** How a delivery's status reads on admin screens. Tones mean the same everywhere. */
export const DELIVERY_STATUS: Record<AdminDelivery["status"], { label: string; tone: Tone }> = {
  unassigned: { label: "Finding a rider", tone: "blue" },
  offered: { label: "Offered", tone: "blue" },
  assigned: { label: "Rider on the way", tone: "amber" },
  at_store: { label: "At the store", tone: "amber" },
  picked_up: { label: "Out for delivery", tone: "amber" },
  at_customer: { label: "At the door", tone: "amber" },
  delivered: { label: "Delivered", tone: "green" },
  cancelled: { label: "Cancelled", tone: "gray" },
};

/** 7 becomes "7 min", 75 becomes "1 h 15 min". */
export function minutesLabel(mins: number | null | undefined): string {
  if (mins === null || mins === undefined) return "No data";
  const whole = Math.round(mins);
  if (whole < 60) return `${whole} min`;
  return `${Math.floor(whole / 60)} h ${whole % 60} min`;
}

/** "13 Nov, 4:05 pm" in India time. */
export const dateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });

/** Stock at or under this is "low". Matches the inventory page. */
export const LOW_STOCK = 5;
