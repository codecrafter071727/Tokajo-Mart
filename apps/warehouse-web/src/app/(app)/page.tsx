"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import type { QueueOrder } from "@qc/contracts";
import { Badge, Empty, ErrorBanner, PageHeader } from "../../components/ui";
import { api } from "../../lib/api";
import { formatAge, isLate, itemCount, orderAgeMins } from "../../lib/helpers";
import { useWarehouse } from "../../lib/providers";

const COLUMNS = [
  { status: "confirmed", title: "New", hint: "Waiting to be packed" },
  { status: "packing", title: "Packing", hint: "Being picked now" },
  { status: "packed", title: "Packed", hint: "Waiting for a rider" },
] as const;

function OrderCard({ order, now }: { order: QueueOrder; now: Date }) {
  const late = isLate(order.placedAt, order.promisedMins, now);
  const href = order.status === "packed" ? "/handover" : `/orders/${order.id}/pick`;
  return (
    <Link
      href={href}
      className={`block rounded-xl border bg-white p-4 shadow-sm transition hover:shadow-md ${
        late && order.status !== "packed" ? "border-red-300" : "border-line"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-extrabold">{order.number}</span>
        {late && order.status !== "packed" ? <Badge tone="red">Late</Badge> : null}
      </div>
      <p className="mt-2 text-sm text-ink-700">
        {itemCount(order.items)} items, {order.address.tag}
      </p>
      <p className={`mt-1 text-xs font-semibold ${late ? "text-red-700" : "text-ink-500"}`}>
        Waiting {formatAge(orderAgeMins(order.placedAt, now))} of {order.promisedMins} min promised
      </p>
    </Link>
  );
}

export default function QueuePage() {
  const { scope, warehouseId } = useWarehouse();
  const { data, error, dataUpdatedAt } = useQuery({
    queryKey: ["queue", warehouseId],
    queryFn: () => api<{ items: QueueOrder[] }>(`/v1/orders/queue${scope ? `?${scope}` : ""}`),
    refetchInterval: 4000,
  });
  const now = new Date(dataUpdatedAt || Date.now());

  return (
    <>
      <PageHeader
        title="Live queue"
        subtitle="Updates every few seconds. Open an order to pack it."
      />
      {error ? <ErrorBanner>{error.message}</ErrorBanner> : null}
      <div className="grid gap-5 lg:grid-cols-3">
        {COLUMNS.map((col) => {
          const orders = (data?.items ?? []).filter((o) => o.status === col.status);
          return (
            <section key={col.status} aria-label={col.title}>
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="text-base font-extrabold">{col.title}</h2>
                <span className="text-sm font-bold text-ink-500">{orders.length}</span>
              </div>
              <div className="space-y-3">
                {orders.length === 0 ? <Empty>{data ? col.hint : "Loading..."}</Empty> : null}
                {orders.map((o) => (
                  <OrderCard key={o.id} order={o} now={now} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
