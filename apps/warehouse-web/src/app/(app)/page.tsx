"use client";

import Link from "next/link";
import type { QueueOrder } from "@qc/contracts";
import {
  Badge,
  Empty,
  ErrorBanner,
  Icon,
  Skeleton,
  Thumb,
  toneDot,
  type IconName,
  type Tone,
} from "../../components/ui";
import {
  formatElapsed,
  itemCount,
  orderAgeMins,
  plural,
  shortNumber,
  urgency,
  type Urgency,
} from "../../lib/helpers";
import { useNow, useQueue } from "../../lib/live";

const COLUMNS: {
  status: QueueOrder["status"];
  title: string;
  tone: Tone;
  empty: string;
  icon: IconName;
}[] = [
  { status: "confirmed", title: "New", tone: "blue", empty: "No new orders", icon: "box" },
  {
    status: "packing",
    title: "Packing",
    tone: "amber",
    empty: "Nothing on the bench",
    icon: "list",
  },
  {
    status: "packed",
    title: "Ready for rider",
    tone: "green",
    empty: "No packed orders waiting",
    icon: "bike",
  },
];

const TIMER: Record<Urgency, string> = {
  ok: "bg-surface text-ink-900",
  soon: "bg-amber-100 text-amber-900",
  late: "bg-red-600 text-white animate-pulse-ring",
};

function OrderCard({ order, now }: { order: QueueOrder; now: Date }) {
  const packed = order.status === "packed";
  // Once packed the clock is the rider's problem, so the card stops shouting
  const level = packed ? "ok" : urgency(order.placedAt, order.promisedMins, now);
  const late = level === "late";
  const picked = order.items.filter((i) => i.picked).length;
  const lateBy = orderAgeMins(order.placedAt, now) - order.promisedMins;
  const href = packed ? "/handover" : `/orders/${order.id}/pick`;
  const shown = order.items.slice(0, 4);
  const more = order.items.length - shown.length;

  return (
    <Link
      href={href}
      aria-label={`Order ${shortNumber(order.number)}, ${plural(itemCount(order.items), "item")}${
        late ? `, late by ${lateBy} minutes` : ""
      }`}
      className={`group relative block overflow-hidden rounded-xl border bg-white p-4 pl-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-dialog active:translate-y-0 ${
        late ? "border-red-300 bg-red-50/60" : "border-line"
      }`}
    >
      <span
        className={`absolute inset-y-0 left-0 w-1.5 ${
          late ? "bg-red-600" : level === "soon" ? "bg-amber-500" : "bg-transparent"
        }`}
        aria-hidden="true"
      />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-2xl font-extrabold leading-7 tabular-nums">
            {shortNumber(order.number)}
          </p>
          <p className="mt-0.5 truncate text-xs font-semibold text-ink-500">{order.number}</p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-base font-extrabold tabular-nums ${TIMER[level]}`}
        >
          <Icon name="clock" size={16} />
          {formatElapsed(order.placedAt, now)}
        </span>
      </div>

      {late ? (
        <p className="mt-2 text-sm font-extrabold uppercase tracking-wide text-red-700">
          Late by {plural(Math.max(1, lateBy), "min", "min")}
        </p>
      ) : level === "soon" ? (
        <p className="mt-2 text-sm font-bold text-amber-800">
          Due in{" "}
          {plural(
            Math.max(1, order.promisedMins - orderAgeMins(order.placedAt, now)),
            "min",
            "min",
          )}
        </p>
      ) : null}

      <div className="mt-3 flex items-center gap-2">
        {shown.map((item) => (
          <span key={item.productId} className="relative">
            <Thumb imageUrl={item.imageUrl} emoji={item.emoji} size={44} />
            {item.quantity > 1 ? (
              <span className="absolute -right-1.5 -top-1.5 min-w-5 rounded-full bg-ink-900 px-1 text-center text-[11px] font-extrabold leading-5 text-white">
                {item.quantity}
              </span>
            ) : null}
          </span>
        ))}
        {more > 0 ? (
          <span className="grid size-11 place-items-center rounded-lg bg-surface text-sm font-extrabold text-ink-700">
            +{more}
          </span>
        ) : null}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 text-sm">
        <span className="font-semibold text-ink-700">
          {plural(itemCount(order.items), "item")}
          <span className="text-ink-500">, {order.address.tag}</span>
        </span>
        <span
          className={`inline-flex h-8 items-center gap-1 rounded-lg px-3 font-bold transition ${
            packed
              ? "bg-brand-50 text-brand-900"
              : order.status === "confirmed"
                ? "bg-brand-600 text-ink-900 group-hover:bg-brand-500"
                : "bg-amber-100 text-amber-900"
          }`}
        >
          {packed ? <Icon name="bike" size={16} /> : null}
          {packed ? "Hand over" : order.status === "confirmed" ? "Start" : "Continue"}
        </span>
      </div>

      {order.status === "packing" ? (
        <div className="mt-3">
          <div className="h-2 overflow-hidden rounded-full bg-surface">
            <div
              className="h-full rounded-full bg-amber-500 transition-all"
              style={{ width: `${(picked / Math.max(1, order.items.length)) * 100}%` }}
            />
          </div>
          <p className="mt-1 text-xs font-bold text-ink-500">
            {picked} of {order.items.length} picked
          </p>
        </div>
      ) : null}
    </Link>
  );
}

function Stat({
  label,
  value,
  tone,
  loading,
}: {
  label: string;
  value: number;
  tone: "neutral" | "red";
  loading: boolean;
}) {
  const alarm = tone === "red" && value > 0;
  return (
    <div
      className={`rounded-xl border px-4 py-3 shadow-card ${
        alarm ? "border-red-300 bg-red-600 text-white" : "border-line bg-white"
      }`}
    >
      <p
        className={`text-xs font-bold uppercase tracking-wide ${
          alarm ? "text-red-100" : "text-ink-500"
        }`}
      >
        {label}
      </p>
      <p className="mt-1 text-[30px] font-extrabold leading-9 tabular-nums">
        {loading ? "-" : value}
      </p>
    </div>
  );
}

export default function QueuePage() {
  const { data, error, isLoading } = useQueue();
  const now = useNow(1000);
  const orders = data?.items ?? [];
  const lateCount = orders.filter(
    (o) => o.status !== "packed" && urgency(o.placedAt, o.promisedMins, now) === "late",
  ).length;
  const count = (status: QueueOrder["status"]) => orders.filter((o) => o.status === status).length;

  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="New" value={count("confirmed")} tone="neutral" loading={isLoading} />
        <Stat label="Packing" value={count("packing")} tone="neutral" loading={isLoading} />
        <Stat label="Ready for rider" value={count("packed")} tone="neutral" loading={isLoading} />
        <Stat label="Late" value={lateCount} tone="red" loading={isLoading} />
      </div>

      {error ? (
        <ErrorBanner>{error.message} Showing the last known queue, retrying.</ErrorBanner>
      ) : null}

      <div className="grid gap-5 md:grid-cols-3">
        {COLUMNS.map((col) => {
          // Oldest first, which puts late orders on top: the next order to pack is always first
          const list = orders
            .filter((o) => o.status === col.status)
            .sort((a, b) => Date.parse(a.placedAt) - Date.parse(b.placedAt));
          return (
            <section key={col.status} aria-labelledby={`col-${col.status}`} className="min-w-0">
              <div className="mb-3 flex items-center gap-2">
                <span className={`size-2.5 rounded-full ${toneDot(col.tone)}`} />
                <h2 id={`col-${col.status}`} className="text-xl font-extrabold">
                  {col.title}
                </h2>
                <Badge tone={col.tone}>{isLoading ? "-" : list.length}</Badge>
              </div>
              <div className="space-y-3">
                {isLoading ? (
                  <>
                    <Skeleton className="h-44" />
                    <Skeleton className="h-44" />
                  </>
                ) : list.length === 0 ? (
                  <Empty icon={col.icon} title={col.empty} />
                ) : (
                  list.map((o) => <OrderCard key={o.id} order={o} now={now} />)
                )}
              </div>
            </section>
          );
        })}
      </div>
      <p className="sr-only" aria-live="polite">
        {lateCount > 0 ? `${plural(lateCount, "order")} late` : ""}
      </p>
    </>
  );
}
