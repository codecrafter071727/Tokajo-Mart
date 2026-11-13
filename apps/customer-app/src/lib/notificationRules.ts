import type { Notification } from "@qc/contracts";

/** Where tapping a notification goes, or null when it has nowhere to go. */
export function notificationTarget(n: Pick<Notification, "data">): string | null {
  const data = n.data ?? {};
  if (typeof data.orderId === "string" && data.orderId) return `/orders/${data.orderId}`;
  if (typeof data.productId === "string" && data.productId) return `/product/${data.productId}`;
  return null;
}

/** An Ionicons name for each kind, so the inbox reads at a glance. */
export function notificationIcon(type: string): string {
  if (type === "stock.back_in_stock") return "sparkles";
  if (type === "order.delivered") return "checkmark-circle";
  if (type === "order.cancelled") return "close-circle";
  if (type === "order.refunded") return "wallet";
  if (type === "order.out_for_delivery" || type === "delivery.rider_assigned") return "bicycle";
  if (type === "order.packing") return "basket";
  return "receipt";
}

/** "Today", "Yesterday" or a date, in India time, for grouping the inbox. */
export function dayLabel(iso: string, now: Date = new Date()): string {
  const ist = (d: Date) => new Date(d.getTime() + 5.5 * 3600_000).toISOString().slice(0, 10);
  const day = ist(new Date(iso));
  const today = ist(now);
  const yesterday = ist(new Date(now.getTime() - 86_400_000));
  if (day === today) return "Today";
  if (day === yesterday) return "Yesterday";
  return new Date(`${day}T00:00:00.000Z`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

/** Groups notifications, already newest first, into days. */
export function groupByDay<T extends Pick<Notification, "createdAt">>(
  items: T[],
  now: Date = new Date(),
): { label: string; items: T[] }[] {
  const groups: { label: string; items: T[] }[] = [];
  for (const item of items) {
    const label = dayLabel(item.createdAt, now);
    const last = groups.at(-1);
    if (last && last.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  }
  return groups;
}

/** "2:35 pm" in India time. */
export function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}
