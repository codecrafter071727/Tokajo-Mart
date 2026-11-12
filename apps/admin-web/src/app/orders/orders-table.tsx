"use client";

import { useMemo, useState } from "react";
import { Badge, DemoNotice, TableShell, td, th } from "../../components/ui";
import { makeOrders, type OrderStatus } from "../../lib/demo";
import { rupees } from "../../lib/api";

const STATUS: Record<
  OrderStatus,
  { label: string; tone: "green" | "amber" | "red" | "gray" | "blue" }
> = {
  placed: { label: "Placed", tone: "blue" },
  confirmed: { label: "Confirmed", tone: "blue" },
  packing: { label: "Packing", tone: "amber" },
  out_for_delivery: { label: "Out for delivery", tone: "amber" },
  delivered: { label: "Delivered", tone: "green" },
  cancelled: { label: "Cancelled", tone: "red" },
};

const FILTERS: { value: "all" | OrderStatus; label: string }[] = [
  { value: "all", label: "All" },
  { value: "placed", label: "Placed" },
  { value: "packing", label: "Packing" },
  { value: "out_for_delivery", label: "Out for delivery" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });

export function OrdersTable() {
  // Built once so the list does not shuffle on every render
  const [orders] = useState(() => makeOrders(new Date()));
  const [filter, setFilter] = useState<"all" | OrderStatus>("all");

  const shown = useMemo(
    () => orders.filter((o) => filter === "all" || o.status === filter),
    [orders, filter],
  );

  return (
    <>
      <DemoNotice>Demo data. This page connects to the order service once it exists.</DemoNotice>

      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filter by status">
        {FILTERS.map((f) => {
          const count =
            f.value === "all" ? orders.length : orders.filter((o) => o.status === f.value).length;
          const active = filter === f.value;
          return (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              aria-pressed={active}
              className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${
                active
                  ? "border-brand-600 bg-brand-100 text-brand-900"
                  : "border-line bg-white text-ink-700"
              }`}
            >
              {f.label} <span className="text-ink-500">{count}</span>
            </button>
          );
        })}
      </div>

      <TableShell>
        <table className="w-full">
          <thead className="border-b border-line">
            <tr>
              {["Order", "Customer", "Items", "Total", "Payment", "Status", "Rider", "Placed"].map(
                (h) => (
                  <th key={h} className={th}>
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {shown.map((o) => (
              <tr key={o.id} className="border-b border-line last:border-0 hover:bg-brand-50/40">
                <td className={`${td} font-bold`}>{o.number}</td>
                <td className={td}>{o.customer}</td>
                <td className={`${td} tabular-nums`}>{o.items}</td>
                <td className={`${td} font-bold tabular-nums`}>{rupees(o.totalPaise)}</td>
                <td className={td}>
                  <Badge tone={o.payment === "COD" ? "amber" : "gray"}>{o.payment}</Badge>
                </td>
                <td className={td}>
                  <Badge tone={STATUS[o.status].tone}>{STATUS[o.status].label}</Badge>
                </td>
                <td className={`${td} ${o.rider ? "" : "text-ink-500"}`}>
                  {o.rider ?? "Not assigned"}
                </td>
                <td className={`${td} tabular-nums text-ink-500`}>{time(o.placedAt)}</td>
              </tr>
            ))}
            {shown.length === 0 ? (
              <tr>
                <td className={`${td} py-10 text-center text-ink-500`} colSpan={8}>
                  No orders with this status.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </TableShell>
    </>
  );
}
