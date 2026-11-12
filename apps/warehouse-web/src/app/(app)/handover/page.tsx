"use client";

import { useQuery } from "@tanstack/react-query";
import type { Handover } from "@qc/contracts";
import { Badge, Empty, ErrorBanner, PageHeader } from "../../../components/ui";
import { api } from "../../../lib/api";
import { useWarehouse } from "../../../lib/providers";

const STATUS: Record<
  Handover["status"],
  { label: string; tone: "gray" | "amber" | "blue" | "green" | "red" }
> = {
  unassigned: { label: "Finding a rider", tone: "amber" },
  offered: { label: "Offered to a rider", tone: "amber" },
  assigned: { label: "Rider on the way", tone: "blue" },
  at_store: { label: "Rider is here", tone: "green" },
  picked_up: { label: "Picked up", tone: "gray" },
  at_customer: { label: "At customer", tone: "gray" },
  delivered: { label: "Delivered", tone: "gray" },
  cancelled: { label: "Cancelled", tone: "red" },
};

export default function HandoverPage() {
  const { scope, warehouseId } = useWarehouse();
  const { data, error } = useQuery({
    queryKey: ["handover", warehouseId],
    queryFn: () => api<{ items: Handover[] }>(`/v1/delivery/handovers${scope ? `?${scope}` : ""}`),
    refetchInterval: 4000,
  });

  return (
    <>
      <PageHeader
        title="Handover"
        subtitle="Read the code to the rider. They type it in their app to leave with the order."
      />
      {error ? <ErrorBanner>{error.message}</ErrorBanner> : null}
      {data && data.items.length === 0 ? (
        <Empty>No packed orders are waiting for a rider.</Empty>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(data?.items ?? []).map((h) => (
          <article
            key={h.deliveryId}
            className="rounded-2xl border border-line bg-white p-5 shadow-sm"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-extrabold">{h.orderNumber}</h2>
              <Badge tone={STATUS[h.status].tone}>{STATUS[h.status].label}</Badge>
            </div>
            <p className="mt-1 text-sm text-ink-700">
              {h.itemCount} items. {h.rider ? `Rider: ${h.rider.name}` : "No rider yet"}
            </p>
            <p className="mt-4 text-xs font-bold uppercase tracking-wide text-ink-500">
              Handover code
            </p>
            <p className="mt-1 rounded-xl bg-brand-50 py-3 text-center text-5xl font-extrabold tracking-[0.3em] tabular-nums text-brand-900">
              {h.handoverCode}
            </p>
          </article>
        ))}
      </div>
    </>
  );
}
