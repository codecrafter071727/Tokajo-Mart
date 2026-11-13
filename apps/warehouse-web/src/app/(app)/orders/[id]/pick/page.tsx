"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import type { QueueOrder, StockRow } from "@qc/contracts";
import { Badge, Button, ErrorBanner, Icon, Skeleton, Thumb } from "../../../../../components/ui";
import { api, ApiError } from "../../../../../lib/api";
import {
  formatElapsed,
  itemCount,
  orderAgeMins,
  plural,
  shortNumber,
  urgency,
} from "../../../../../lib/helpers";
import { useNow } from "../../../../../lib/live";
import { useWarehouse } from "../../../../../lib/providers";

type Item = QueueOrder["items"][number];

function ItemRow({
  item,
  rack,
  interactive,
  onToggle,
}: {
  item: Item;
  rack: string | null;
  interactive: boolean;
  onToggle: () => void;
}) {
  const multi = item.quantity > 1;
  return (
    <li>
      <button
        type="button"
        disabled={!interactive}
        aria-pressed={interactive ? item.picked : undefined}
        aria-label={`${item.name}, ${item.unit}, quantity ${item.quantity}${
          item.picked ? ", picked" : ""
        }`}
        onClick={onToggle}
        className={`flex min-h-24 w-full items-center gap-4 rounded-xl border-2 p-3 pr-4 text-left transition ${
          item.picked
            ? "border-brand-600 bg-brand-50"
            : interactive
              ? "border-line bg-white shadow-card hover:border-brand-200 active:scale-[0.99]"
              : "border-line bg-white"
        }`}
      >
        {interactive ? (
          <span
            className={`grid size-12 shrink-0 place-items-center rounded-full border-2 transition ${
              item.picked
                ? "border-brand-600 bg-brand-600 text-ink-900"
                : "border-line bg-white text-transparent"
            }`}
          >
            <Icon name="check" size={28} strokeWidth={3} />
          </span>
        ) : null}
        <Thumb
          imageUrl={item.imageUrl}
          emoji={item.emoji}
          size={72}
          className={item.picked ? "opacity-60" : ""}
        />
        <span className="min-w-0 flex-1">
          <span
            className={`block text-xl font-bold leading-6 ${
              item.picked ? "text-ink-500" : "text-ink-900"
            }`}
          >
            {item.name}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-2 text-base text-ink-500">
            {item.unit}
            {rack ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-ink-900 px-2 py-0.5 text-sm font-extrabold text-white">
                <Icon name="shelf" size={14} />
                {rack}
              </span>
            ) : null}
          </span>
        </span>
        <span
          className={`grid min-w-16 place-items-center rounded-xl px-3 py-2 text-[30px] font-extrabold leading-9 tabular-nums ${
            item.picked
              ? "bg-brand-100 text-brand-900"
              : multi
                ? "bg-amber-400 text-ink-900 ring-4 ring-amber-200"
                : "bg-surface text-ink-900"
          }`}
          aria-hidden="true"
        >
          x{item.quantity}
        </span>
      </button>
    </li>
  );
}

export default function PickPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { scope, warehouseId } = useWarehouse();
  const now = useNow(1000);
  const key = ["order", id];
  const [packFailure, setPackFailure] = useState<string | null>(null);

  const { data: order, error } = useQuery({
    queryKey: key,
    queryFn: () => api<QueueOrder>(`/v1/orders/${id}`),
  });
  // Rack locations help the picker walk straight to the shelf. Missing racks are fine.
  const { data: racks } = useQuery({
    queryKey: ["racks", warehouseId],
    queryFn: async () => {
      const { items } = await api<{ items: StockRow[] }>(
        `/v1/inventory/stock?limit=200${scope ? `&${scope}` : ""}`,
      );
      return new Map(items.map((s) => [s.productId, s.rackLocation]));
    },
    staleTime: 60_000,
    retry: false,
  });
  const put = (next: QueueOrder) => queryClient.setQueryData(key, next);

  const start = useMutation({
    mutationFn: () =>
      api<QueueOrder>(`/v1/orders/${id}/start-packing`, { method: "POST", body: {} }),
    onSuccess: (next) => {
      put(next);
      void queryClient.invalidateQueries({ queryKey: ["queue"] });
    },
  });
  const tick = useMutation({
    mutationFn: (v: { productId: string; picked: boolean }) =>
      api<QueueOrder>(`/v1/orders/${id}/items/${encodeURIComponent(v.productId)}/picked`, {
        method: "POST",
        body: { picked: v.picked },
      }),
    onMutate: async (v) => {
      await queryClient.cancelQueries({ queryKey: key });
      const before = queryClient.getQueryData<QueueOrder>(key);
      if (before) {
        put({
          ...before,
          items: before.items.map((i) =>
            i.productId === v.productId ? { ...i, picked: v.picked } : i,
          ),
        });
      }
      return { before };
    },
    onError: (_e, _v, ctx) => ctx?.before && put(ctx.before),
    onSuccess: put,
  });
  const pack = useMutation({
    mutationFn: () => api<QueueOrder>(`/v1/orders/${id}/packed`, { method: "POST", body: {} }),
    onSuccess: (next) => {
      put(next);
      setPackFailure(null);
      void queryClient.invalidateQueries({ queryKey: ["queue"] });
      void queryClient.invalidateQueries({ queryKey: ["handover"] });
      router.push("/handover");
    },
    onError: (e) => {
      // 503 means the order is packed but the rider could not be requested: pressing again retries
      if (e instanceof ApiError && e.status === 503) {
        setPackFailure(e.message);
        void queryClient.invalidateQueries({ queryKey: key });
      }
    },
  });

  const back = (
    <Link
      href="/"
      className="inline-flex h-11 items-center gap-1 rounded-lg pr-3 text-base font-bold text-ink-700 hover:text-ink-900"
    >
      <Icon name="back" size={24} />
      Queue
    </Link>
  );

  if (error) {
    return (
      <>
        {back}
        <div className="mt-4">
          <ErrorBanner>{error.message}</ErrorBanner>
        </div>
      </>
    );
  }
  if (!order) {
    return (
      <div className="space-y-3" aria-busy="true">
        <Skeleton className="h-20" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
    );
  }

  const picked = order.items.filter((i) => i.picked).length;
  const total = order.items.length;
  const allPicked = picked === total;
  const packing = order.status === "packing";
  const level = order.status === "packed" ? "ok" : urgency(order.placedAt, order.promisedMins, now);
  const lateBy = orderAgeMins(order.placedAt, now) - order.promisedMins;
  const packRetryable = pack.error instanceof ApiError && pack.error.status === 503;
  const actionError = start.error ?? tick.error ?? (packRetryable ? null : pack.error);
  const showPackBar = packing || packFailure !== null;

  return (
    <div className="mx-auto max-w-3xl pb-32">
      {back}

      <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[30px] font-extrabold leading-9 tabular-nums">
            {shortNumber(order.number)}
          </h1>
          <p className="mt-1 text-base text-ink-700">
            {plural(itemCount(order.items), "item")} for {order.address.tag}
            <span className="text-ink-500"> · {order.number}</span>
          </p>
        </div>
        <div
          className={`flex items-center gap-2 rounded-xl px-4 py-2 ${
            level === "late"
              ? "bg-red-600 text-white"
              : level === "soon"
                ? "bg-amber-100 text-amber-900"
                : "bg-white text-ink-900 shadow-card"
          }`}
        >
          <Icon name="clock" size={22} />
          <span className="text-2xl font-extrabold tabular-nums">
            {formatElapsed(order.placedAt, now)}
          </span>
          <span className="text-sm font-bold opacity-80">
            {level === "late"
              ? `late by ${plural(Math.max(1, lateBy), "min", "min")}`
              : `of ${order.promisedMins} min`}
          </span>
        </div>
      </div>

      <div className="mt-5" aria-live="polite">
        {actionError ? <ErrorBanner>{actionError.message}</ErrorBanner> : null}
        {packFailure ? (
          <div
            role="alert"
            className="mb-4 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900"
          >
            <Icon name="alert" className="mt-0.5 shrink-0" />
            <div>
              <p className="text-base font-extrabold">Packed, but no rider requested yet</p>
              <p className="text-sm font-semibold">
                {packFailure} Keep the bag on the counter and press Retry rider request.
              </p>
            </div>
          </div>
        ) : null}
      </div>

      {order.status === "confirmed" ? (
        <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-base font-semibold text-blue-900">
          Check the list, then start packing. The customer is told their order is being packed.
        </div>
      ) : null}

      {packing ? (
        <div className="sticky top-16 z-10 -mx-4 mb-3 bg-surface/95 px-4 py-3 backdrop-blur">
          <div className="flex items-center justify-between text-base font-bold">
            <span>
              {picked} of {total} picked
            </span>
            {allPicked ? <Badge tone="green">All items picked</Badge> : null}
          </div>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-white">
            <div
              className={`h-full rounded-full transition-all ${
                allPicked ? "bg-brand-600" : "bg-amber-500"
              }`}
              style={{ width: `${(picked / Math.max(1, total)) * 100}%` }}
            />
          </div>
        </div>
      ) : null}

      {order.status === "confirmed" || packing || order.status === "packed" ? (
        <ul className="space-y-3">
          {order.items.map((item) => (
            <ItemRow
              key={item.productId}
              item={item}
              rack={racks?.get(item.productId) ?? null}
              interactive={packing}
              onToggle={() => tick.mutate({ productId: item.productId, picked: !item.picked })}
            />
          ))}
        </ul>
      ) : (
        <div className="rounded-xl border border-line bg-white p-10 text-center text-xl font-bold shadow-card">
          This order is {order.status.replaceAll("_", " ")}.
        </div>
      )}

      {order.status === "packed" && !packFailure ? (
        <div className="mt-6 flex flex-col items-center gap-3 rounded-xl border border-brand-200 bg-brand-50 p-6 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-brand-600 text-ink-900">
            <Icon name="check" size={32} strokeWidth={3} />
          </span>
          <p className="text-xl font-extrabold">Packed. Waiting for a rider.</p>
          <Link
            href="/handover"
            className="inline-flex h-11 items-center gap-2 rounded-lg border border-line bg-white px-4 text-base font-bold hover:bg-surface"
          >
            <Icon name="bike" />
            Open handover
          </Link>
        </div>
      ) : null}

      {order.status === "confirmed" || showPackBar ? (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white/95 px-4 py-4 shadow-dialog backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center gap-4">
            {order.status === "confirmed" ? (
              <Button
                size="lg"
                className="w-full"
                onClick={() => start.mutate()}
                disabled={start.isPending}
              >
                {start.isPending ? "Starting..." : "Start packing"}
              </Button>
            ) : (
              <>
                <p className="hidden shrink-0 text-base font-bold text-ink-700 sm:block">
                  {packFailure
                    ? "Waiting for a rider"
                    : allPicked
                      ? "Ready to pack"
                      : `${total - picked} left to pick`}
                </p>
                <Button
                  size="lg"
                  className="min-w-0 flex-1"
                  onClick={() => pack.mutate()}
                  disabled={!allPicked || pack.isPending}
                >
                  {pack.isPending ? (
                    "Packing..."
                  ) : packFailure ? (
                    <>
                      <Icon name="refresh" />
                      Retry rider request
                    </>
                  ) : allPicked ? (
                    <>
                      <Icon name="check" strokeWidth={3} />
                      Mark packed
                    </>
                  ) : (
                    "Tick every item to finish"
                  )}
                </Button>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
