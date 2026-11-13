"use client";

import type { Handover } from "@qc/contracts";
import {
  Badge,
  Empty,
  ErrorBanner,
  Icon,
  PageHeader,
  Skeleton,
  type Tone,
} from "../../../components/ui";
import { plural, shortNumber } from "../../../lib/helpers";
import { useHandovers } from "../../../lib/live";

const STATUS: Record<Handover["status"], { label: string; tone: Tone; rank: number }> = {
  at_store: { label: "Rider is here", tone: "green", rank: 0 },
  assigned: { label: "Rider on the way", tone: "blue", rank: 1 },
  offered: { label: "Offered to a rider", tone: "amber", rank: 2 },
  unassigned: { label: "Finding a rider", tone: "amber", rank: 3 },
  picked_up: { label: "Picked up", tone: "gray", rank: 4 },
  at_customer: { label: "At customer", tone: "gray", rank: 5 },
  delivered: { label: "Delivered", tone: "gray", rank: 6 },
  cancelled: { label: "Cancelled", tone: "red", rank: 7 },
};

function HandoverCard({ h }: { h: Handover }) {
  const here = h.status === "at_store";
  const s = STATUS[h.status];
  return (
    <article
      aria-label={`Order ${shortNumber(h.orderNumber)}, ${s.label}`}
      className={`flex flex-col rounded-xl border-2 bg-white p-5 shadow-card ${
        here ? "border-brand-600 ring-4 ring-brand-100" : "border-line"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[30px] font-extrabold leading-9 tabular-nums">
            {shortNumber(h.orderNumber)}
          </p>
          <p className="mt-0.5 text-sm font-semibold text-ink-500">
            {plural(h.itemCount, "item")} · {h.orderNumber}
          </p>
        </div>
        <Badge tone={s.tone} dot size="md">
          {s.label}
        </Badge>
      </div>

      <div className="mt-4 flex items-center gap-3 rounded-lg bg-surface px-3 py-2">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-ink-700">
          <Icon name="bike" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-lg font-bold">{h.rider?.name ?? "No rider yet"}</p>
          {h.rider?.phone ? (
            <a href={`tel:${h.rider.phone}`} className="text-sm font-semibold text-brand-700">
              {h.rider.phone}
            </a>
          ) : (
            <p className="text-sm text-ink-500">We are finding the nearest rider</p>
          )}
        </div>
      </div>

      <p className="mt-5 text-center text-sm font-bold uppercase tracking-wide text-ink-500">
        Handover code
      </p>
      <p
        className={`mt-1 rounded-xl py-4 text-center font-mono text-7xl font-extrabold tracking-[0.25em] tabular-nums ${
          here ? "bg-brand-600 text-ink-900" : "bg-brand-50 text-brand-900"
        }`}
        aria-label={`Handover code ${h.handoverCode.split("").join(" ")}`}
      >
        {h.handoverCode}
      </p>
      <p className="mt-2 text-center text-sm text-ink-500">
        {here ? "Read this to the rider now." : "The rider types this in their app at pickup."}
      </p>
    </article>
  );
}

export default function HandoverPage() {
  const { data, error, isLoading } = useHandovers();
  const items = [...(data?.items ?? [])].sort(
    (a, b) => STATUS[a.status].rank - STATUS[b.status].rank,
  );
  const here = items.filter((h) => h.status === "at_store").length;

  return (
    <>
      <PageHeader
        title="Handover"
        subtitle="Packed orders waiting for a rider. Riders at the counter are shown first."
        action={
          here > 0 ? (
            <Badge tone="green" dot size="md">
              {plural(here, "rider")} at the counter
            </Badge>
          ) : null
        }
      />
      {error ? <ErrorBanner>{error.message}</ErrorBanner> : null}
      {isLoading ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      ) : items.length === 0 ? (
        <Empty icon="bike" title="No orders waiting for a rider">
          Packed orders appear here with the code the rider needs.
        </Empty>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {items.map((h) => (
            <HandoverCard key={h.deliveryId} h={h} />
          ))}
        </div>
      )}
    </>
  );
}
