"use client";

import type { AdminOrder, OrderStatus } from "@qc/contracts";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { PaymentBadge } from "../../components/orders/order-ui";
import { useWarehouse } from "../../components/shell/warehouse-context";
import { Badge, Callout, Card, EmptyState, Stat, cn } from "../../components/ui/core";
import {
  AlertTriangle,
  IndianRupee,
  RefreshCw,
  Search,
  ShoppingBag,
  Timer,
  X,
} from "../../components/ui/icons";
import { PageHeader } from "../../components/ui/layout";
import { TableSkeleton } from "../../components/ui/skeleton";
import { Table, TBody, Td, Th, THead } from "../../components/ui/table";
import { isActive, useAdminOrders, type OrderFilter } from "../../lib/admin-orders";
import { rupees } from "../../lib/api";
import { indiaDay } from "../../lib/dates";
import { dateTime, minutesBetween, timeAgo } from "../../lib/format";
import { errorMessage } from "../../lib/gw";
import { ORDER_STATUS } from "../../lib/order-status";

const STATUSES: { id: string; label: string; match?: OrderStatus[] }[] = [
  { id: "all", label: "All" },
  {
    id: "active",
    label: "In progress",
    match: ["confirmed", "packing", "packed", "picked_up", "out_for_delivery"],
  },
  { id: "confirmed", label: "New" },
  { id: "packing", label: "Packing" },
  { id: "packed", label: "Packed" },
  { id: "out_for_delivery", label: "On the way" },
  { id: "pending_payment", label: "Awaiting payment" },
  { id: "delivered", label: "Delivered" },
  { id: "cancelled", label: "Cancelled" },
];

const RANGES = [
  { id: "today", label: "Today", days: 1 },
  { id: "7d", label: "7 days", days: 7 },
  { id: "30d", label: "30 days", days: 30 },
  { id: "all", label: "All time", days: 0 },
] as const;

const selectCls =
  "h-9 rounded-lg border border-line-strong bg-surface px-3 pr-8 text-sm text-ink shadow-card focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none";

export function OrdersView() {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const { warehouseId, nameOf } = useWarehouse();

  const status = params.get("status") ?? "all";
  const method = params.get("method") ?? "";
  const range = (params.get("range") ?? "7d") as (typeof RANGES)[number]["id"];
  const q = params.get("q") ?? "";
  const [text, setText] = useState(q);
  useEffect(() => setText(q), [q]);

  const set = (key: string, value: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    const s = next.toString();
    router.replace(s ? `${path}?${s}` : path, { scroll: false });
  };
  useEffect(() => {
    if (text.trim() === q) return;
    const timer = setTimeout(() => set("q", text.trim() || null), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const days = RANGES.find((r) => r.id === range)?.days ?? 7;
  const filter: OrderFilter = {
    warehouseId: warehouseId || undefined,
    paymentMethod: method || undefined,
    q: q || undefined,
    from: days ? indiaDay(-(days - 1)) : undefined,
    to: days ? indiaDay(0) : undefined,
    status: status !== "all" && status !== "active" ? status : undefined,
  };
  const orders = useAdminOrders(filter, { live: true });

  const all = useMemo(() => orders.data?.items ?? [], [orders.data]);
  const shown = useMemo(() => {
    const match = STATUSES.find((s) => s.id === status)?.match;
    return match ? all.filter((o) => match.includes(o.status)) : all;
  }, [all, status]);

  const now = Date.now();
  const late = (o: AdminOrder) => isActive(o.status) && minutesBetween(o.placedAt) > o.promisedMins;
  const inProgress = all.filter((o) => isActive(o.status)).length;
  const lateCount = all.filter(late).length;
  const delivered = all.filter((o) => o.status === "delivered");
  const revenue = delivered.reduce((n, o) => n + o.totalPaise, 0);
  const avgMins = delivered.length
    ? Math.round(
        delivered.reduce((n, o) => n + minutesBetween(o.placedAt, o.deliveredAt), 0) /
          delivered.length,
      )
    : null;
  const rangeLabel = RANGES.find((r) => r.id === range)?.label.toLowerCase() ?? "";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Live orders"
        description={`Every order${warehouseId ? ` at ${nameOf(warehouseId)}` : " across the network"}, newest first. Refreshes every 15 seconds.`}
        badge={lateCount ? <Badge tone="bad">{lateCount} late</Badge> : undefined}
        actions={
          <span className="flex items-center gap-1.5 text-xs text-muted" aria-live="polite">
            <RefreshCw className={cn("size-3.5", orders.isFetching && "animate-spin")} />
            {orders.isFetching
              ? "Updating"
              : orders.dataUpdatedAt
                ? `Updated ${timeAgo(new Date(orders.dataUpdatedAt).toISOString())}`
                : ""}
          </span>
        }
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Stat
          delay={0}
          icon={ShoppingBag}
          label={`Orders, ${rangeLabel}`}
          value={all.length.toLocaleString("en-IN")}
          hint={`${inProgress} in progress right now`}
        />
        <Stat
          delay={1}
          icon={AlertTriangle}
          label="Late"
          value={lateCount}
          tone={lateCount ? "bad" : "ok"}
          hint={lateCount ? "Past the time promised" : "Everything on time"}
        />
        <Stat
          delay={2}
          icon={IndianRupee}
          label="Delivered sales"
          value={rupees(revenue)}
          hint={`${delivered.length} delivered`}
        />
        <Stat
          delay={3}
          icon={Timer}
          label="Average delivery"
          value={avgMins === null ? "None yet" : `${avgMins} min`}
          hint="From placing to the door"
        />
      </div>

      <Card className="rise" flush>
        <div className="space-y-3 border-b border-line px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
              <input
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="Search order number"
                aria-label="Search by order number"
                className="h-9 w-full rounded-lg border border-line-strong bg-surface pr-8 pl-9 text-sm text-ink shadow-card placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none"
              />
              {text ? (
                <button
                  type="button"
                  aria-label="Clear the search"
                  onClick={() => setText("")}
                  className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-muted hover:text-ink"
                >
                  <X className="size-4" />
                </button>
              ) : null}
            </div>
            <select
              aria-label="Payment"
              value={method}
              onChange={(e) => set("method", e.target.value || null)}
              className={selectCls}
            >
              <option value="">All payments</option>
              <option value="cod">Cash on delivery</option>
              <option value="online">Paid online</option>
            </select>
            <div
              className="ml-auto inline-flex rounded-lg border border-line bg-surface-2 p-0.5 text-[13px]"
              role="group"
              aria-label="Date range"
            >
              {RANGES.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  aria-pressed={range === r.id}
                  onClick={() => set("range", r.id === "7d" ? null : r.id)}
                  className={cn(
                    "rounded-md px-3 py-1.5 font-medium transition-colors",
                    range === r.id
                      ? "bg-surface text-ink shadow-card ring-1 ring-line"
                      : "text-muted hover:text-ink",
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <div className="-mx-1 flex gap-1 overflow-x-auto px-1" role="group" aria-label="Status">
            {STATUSES.map((s) => {
              const on = status === s.id;
              const count =
                s.id === "all"
                  ? all.length
                  : s.match
                    ? all.filter((o) => s.match!.includes(o.status)).length
                    : null;
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => set("status", s.id === "all" ? null : s.id)}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-[13px] font-medium transition-colors",
                    on
                      ? "border-accent-line bg-accent-soft text-accent"
                      : "border-line bg-surface text-ink-2 hover:bg-surface-2",
                  )}
                >
                  {s.label}
                  {count !== null && status === "all" ? (
                    <span className="tnum text-xs text-faint">{count}</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        {orders.isError ? (
          <div className="p-4">
            <Callout tone="bad" title="Could not load orders">
              {errorMessage(orders.error)}
            </Callout>
          </div>
        ) : orders.isPending ? (
          <TableSkeleton cols={8} rows={8} />
        ) : shown.length === 0 ? (
          <EmptyState icon={<ShoppingBag className="size-5" />} title="No orders here">
            {q
              ? `No order number matches "${q}".`
              : "Orders that match these filters show here as they come in."}
          </EmptyState>
        ) : (
          <Table maxHeight="calc(100vh - 21rem)">
            <THead>
              <tr>
                <Th>Order</Th>
                <Th>Customer</Th>
                {warehouseId ? null : <Th className="hidden lg:table-cell">Warehouse</Th>}
                <Th align="right" className="hidden xl:table-cell">
                  Items
                </Th>
                <Th align="right">Total</Th>
                <Th className="hidden lg:table-cell">Payment</Th>
                <Th>Status</Th>
                <Th className="hidden xl:table-cell">Rider</Th>
                <Th align="right">Placed</Th>
              </tr>
            </THead>
            <TBody>
              {shown.map((o) => {
                const s = ORDER_STATUS[o.status];
                const isLate = late(o);
                const open = () => router.push(`/orders/${o.id}`);
                return (
                  <tr
                    key={o.id}
                    onClick={open}
                    className="group cursor-pointer transition-colors hover:bg-surface-2"
                  >
                    <Td className="font-semibold whitespace-nowrap tnum">
                      <Link
                        href={`/orders/${o.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="hover:text-accent hover:underline"
                      >
                        {o.number}
                      </Link>
                    </Td>
                    <Td className="whitespace-nowrap">
                      <div className="leading-tight">
                        <div>{o.customerName || "Customer"}</div>
                        <div className="text-xs text-muted tnum">{o.customerPhone}</div>
                      </div>
                    </Td>
                    {warehouseId ? null : (
                      <Td muted className="hidden whitespace-nowrap lg:table-cell">
                        {nameOf(o.warehouseId)}
                      </Td>
                    )}
                    <Td align="right" className="hidden xl:table-cell">
                      {o.items.reduce((n, i) => n + i.quantity, 0)}
                    </Td>
                    <Td align="right" className="font-semibold">
                      {rupees(o.totalPaise)}
                    </Td>
                    <Td className="hidden lg:table-cell">
                      <PaymentBadge
                        method={o.paymentMethod}
                        status={o.paymentStatus}
                        orderStatus={o.status}
                      />
                    </Td>
                    <Td>
                      <span className="flex items-center gap-1.5">
                        <Badge tone={s.tone}>{s.label}</Badge>
                        {isLate ? (
                          <Badge tone="bad">
                            Late {minutesBetween(o.placedAt) - o.promisedMins} min
                          </Badge>
                        ) : null}
                      </span>
                    </Td>
                    <Td muted={!o.rider} className="hidden whitespace-nowrap xl:table-cell">
                      {o.rider?.name ?? (isActive(o.status) ? "Not assigned" : "")}
                    </Td>
                    <Td align="right" muted className="whitespace-nowrap">
                      <span title={dateTime(o.placedAt)}>
                        {days === 1 ? timeAgo(o.placedAt, now) : dateTime(o.placedAt)}
                      </span>
                    </Td>
                  </tr>
                );
              })}
            </TBody>
          </Table>
        )}
        {shown.length >= 200 ? (
          <p className="border-t border-line px-4 py-2.5 text-xs text-muted">
            Showing the newest 200. Narrow the dates or search to find older orders.
          </p>
        ) : null}
      </Card>
    </div>
  );
}
