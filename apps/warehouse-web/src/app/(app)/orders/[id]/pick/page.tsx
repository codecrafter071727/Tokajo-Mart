"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import type { QueueOrder } from "@qc/contracts";
import { Badge, ErrorBanner, PageHeader } from "../../../../../components/ui";
import { api, ApiError } from "../../../../../lib/api";
import { itemCount } from "../../../../../lib/helpers";

export default function PickPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const key = ["order", id];
  const [packFailure, setPackFailure] = useState<string | null>(null);

  const { data: order, error } = useQuery({
    queryKey: key,
    queryFn: () => api<QueueOrder>(`/v1/orders/${id}`),
  });
  const put = (next: QueueOrder) => queryClient.setQueryData(key, next);

  const start = useMutation({
    mutationFn: () =>
      api<QueueOrder>(`/v1/orders/${id}/start-packing`, { method: "POST", body: {} }),
    onSuccess: put,
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

  if (error) {
    return (
      <>
        <ErrorBanner>{error.message}</ErrorBanner>
        <Link href="/" className="text-sm font-semibold text-brand-700">
          Back to the queue
        </Link>
      </>
    );
  }
  if (!order) return <p className="text-sm text-ink-500">Loading...</p>;

  const picked = order.items.filter((i) => i.picked).length;
  const allPicked = picked === order.items.length;
  const packRetryable = pack.error instanceof ApiError && pack.error.status === 503;
  const actionError = start.error ?? tick.error ?? (packRetryable ? null : pack.error);

  return (
    <>
      <PageHeader
        title={`Order ${order.number}`}
        subtitle={`${itemCount(order.items)} items for ${order.address.tag}, promised in ${order.promisedMins} min`}
        action={
          <Link href="/" className="text-sm font-semibold text-brand-700">
            Back to queue
          </Link>
        }
      />
      {actionError ? <ErrorBanner>{actionError.message}</ErrorBanner> : null}
      {packFailure || (order.status === "packed" && pack.isError) ? (
        <ErrorBanner>
          {packFailure ?? "The order is packed."} Press the button again to request a rider.
        </ErrorBanner>
      ) : null}

      {order.status === "confirmed" ? (
        <div className="rounded-2xl border border-line bg-white p-10 text-center">
          <p className="mb-4 text-lg font-bold">This order is waiting to be packed.</p>
          <button
            type="button"
            onClick={() => start.mutate()}
            disabled={start.isPending}
            className="rounded-xl bg-brand-600 px-8 py-4 text-lg font-extrabold text-ink-900 hover:bg-brand-500 disabled:opacity-60"
          >
            {start.isPending ? "Starting..." : "Start packing"}
          </button>
        </div>
      ) : order.status === "packing" || order.status === "packed" ? (
        <>
          <div className="mb-4 flex items-center gap-3">
            <Badge tone={allPicked ? "green" : "amber"}>
              {picked} of {order.items.length} picked
            </Badge>
            {order.status === "packed" ? <Badge tone="blue">Packed</Badge> : null}
          </div>
          <ul className="space-y-3">
            {order.items.map((item) => (
              <li key={item.productId}>
                <button
                  type="button"
                  disabled={order.status !== "packing"}
                  aria-pressed={item.picked}
                  onClick={() => tick.mutate({ productId: item.productId, picked: !item.picked })}
                  className={`flex w-full items-center gap-4 rounded-2xl border-2 p-4 text-left transition ${
                    item.picked
                      ? "border-brand-600 bg-brand-50"
                      : "border-line bg-white hover:border-brand-200"
                  }`}
                >
                  <span
                    className={`grid size-12 shrink-0 place-items-center rounded-xl text-2xl font-extrabold ${
                      item.picked
                        ? "bg-brand-600 text-ink-900"
                        : "border-2 border-line text-transparent"
                    }`}
                  >
                    ✓
                  </span>
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt=""
                      className="size-14 rounded-lg bg-surface object-contain"
                    />
                  ) : (
                    <span className="grid size-14 place-items-center rounded-lg bg-surface text-3xl">
                      {item.emoji}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-lg font-bold">{item.name}</span>
                    <span className="text-sm text-ink-500">{item.unit}</span>
                  </span>
                  <span className="rounded-xl bg-surface px-4 py-2 text-2xl font-extrabold tabular-nums">
                    x{item.quantity}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {order.status === "packing" || packFailure ? (
            <button
              type="button"
              onClick={() => pack.mutate()}
              disabled={!allPicked || pack.isPending}
              className="mt-6 w-full rounded-2xl bg-brand-600 py-4 text-lg font-extrabold text-ink-900 transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {pack.isPending
                ? "Packing..."
                : packFailure
                  ? "Retry rider request"
                  : allPicked
                    ? "Mark packed"
                    : "Tick every item to finish"}
            </button>
          ) : (
            <Link
              href="/handover"
              className="mt-6 block text-center text-sm font-semibold text-brand-700"
            >
              Go to handover
            </Link>
          )}
        </>
      ) : (
        <div className="rounded-2xl border border-line bg-white p-10 text-center text-lg font-bold">
          This order is {order.status.replaceAll("_", " ")}.
        </div>
      )}
    </>
  );
}
