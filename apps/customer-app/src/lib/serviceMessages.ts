import type { ServiceabilityResponse } from "@qc/contracts";

const IST_OFFSET_MIN = 330;

/** The India calendar day of a moment, as YYYY-MM-DD. */
const indiaDay = (at: Date) =>
  new Date(at.getTime() + IST_OFFSET_MIN * 60_000).toISOString().slice(0, 10);

/** "6:00 AM" in India time, whatever the phone's own time zone is. */
export function indiaClock(at: Date): string {
  const local = new Date(at.getTime() + IST_OFFSET_MIN * 60_000);
  const h24 = local.getUTCHours();
  const minutes = String(local.getUTCMinutes()).padStart(2, "0");
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${minutes} ${h24 < 12 ? "AM" : "PM"}`;
}

/** "6:00 AM", "6:00 AM tomorrow" or "6:00 AM on Mon 16 Nov". */
export function formatOpening(opensAtIso: string, now: Date = new Date()): string {
  const at = new Date(opensAtIso);
  const clock = indiaClock(at);
  const today = indiaDay(now);
  const day = indiaDay(at);
  if (day === today) return clock;
  const tomorrow = indiaDay(new Date(now.getTime() + 86_400_000));
  if (day === tomorrow) return `${clock} tomorrow`;
  const label = new Date(`${day}T00:00:00Z`).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  return `${clock} on ${label}`;
}

export type ServiceState =
  | { kind: "loading" }
  | { kind: "open"; etaMins: number }
  | { kind: "closed"; title: string; detail: string }
  | { kind: "not_served"; title: string; detail: string }
  | { kind: "unknown" };

/**
 * What to tell the customer about delivering to their address right now. Closed and not served
 * both block checkout, with words that say why and what to do.
 */
export function serviceState(
  res: ServiceabilityResponse | undefined,
  pincode: string | null,
  now: Date = new Date(),
): ServiceState {
  if (!res) return { kind: "unknown" };
  if (res.serviceable && res.etaMins) return { kind: "open", etaMins: res.etaMins };
  if (res.reason === "WAREHOUSE_CLOSED") {
    return {
      kind: "closed",
      title: "Closed now",
      detail: res.opensAt
        ? `Closed now, opens at ${formatOpening(res.opensAt, now)}`
        : "Closed now. We will be back soon.",
    };
  }
  const byPincode = res.matchedBy === "pincode" && pincode;
  return {
    kind: "not_served",
    title: "Not available",
    detail: byPincode
      ? `We do not deliver to ${pincode} yet`
      : "We do not deliver to this area yet",
  };
}
