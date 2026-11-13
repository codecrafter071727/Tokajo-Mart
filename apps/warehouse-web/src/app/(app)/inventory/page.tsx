"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { Product, StockRow } from "@qc/contracts";
import {
  Badge,
  Button,
  Dialog,
  Empty,
  ErrorBanner,
  Icon,
  PageHeader,
  Skeleton,
  Thumb,
  inputClass,
  td,
  th,
} from "../../../components/ui";
import { api } from "../../../lib/api";
import { useWarehouse } from "../../../lib/providers";

/** Five or fewer left to sell counts as low: the shelf needs a refill before the evening rush. */
const LOW_STOCK = 5;

type Row = { stock: StockRow; product: Product | undefined };
type Filter = "all" | "low" | "out";

const level = (s: StockRow): "out" | "low" | "ok" =>
  s.available === 0 ? "out" : s.available <= LOW_STOCK ? "low" : "ok";

function useStock() {
  const { scope, warehouseId } = useWarehouse();
  return useQuery({
    queryKey: ["stock", warehouseId],
    queryFn: async () => {
      const [stock, catalog] = await Promise.all([
        api<{ items: StockRow[] }>(`/v1/inventory/stock?limit=200${scope ? `&${scope}` : ""}`),
        api<{ items: Product[] }>("/v1/catalog/products?limit=100"),
      ]);
      const byId = new Map(catalog.items.map((p) => [p.id, p]));
      return stock.items.map((s): Row => ({ stock: s, product: byId.get(s.productId) }));
    },
    refetchInterval: 20_000,
  });
}

// ---------------------------------------------------------------------------------------------
// Dialogs
// ---------------------------------------------------------------------------------------------

function ReceiveDialog({
  open,
  onClose,
  rows,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  rows: Row[];
  onSaved: (message: string) => void;
}) {
  const { warehouseId, me } = useWarehouse();
  const queryClient = useQueryClient();
  const [lines, setLines] = useState([{ productId: "", quantity: "" }]);
  const [reference, setReference] = useState("");
  const receive = useMutation({
    mutationFn: () =>
      api("/v1/inventory/stock/receive", {
        method: "POST",
        body: {
          ...(me.role === "admin" ? { warehouseId } : {}),
          reference: reference.trim() || undefined,
          items: lines
            .filter((l) => l.productId && Number(l.quantity) > 0)
            .map((l) => ({ productId: l.productId, quantity: Number(l.quantity) })),
        },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["stock"] });
      const n = lines.filter((l) => l.productId && Number(l.quantity) > 0).length;
      onSaved(`Stock received for ${n === 1 ? "1 product" : `${n} products`}.`);
      setLines([{ productId: "", quantity: "" }]);
      setReference("");
      onClose();
    },
  });
  const valid = lines.some((l) => l.productId && Number(l.quantity) > 0);
  const sorted = [...rows].sort((a, b) =>
    (a.product?.name ?? a.stock.productId).localeCompare(b.product?.name ?? b.stock.productId),
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Receive stock"
      wide
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => receive.mutate()} disabled={!valid || receive.isPending}>
            {receive.isPending ? "Saving..." : "Add to stock"}
          </Button>
        </>
      }
    >
      {receive.error ? <ErrorBanner>{receive.error.message}</ErrorBanner> : null}
      <label className="mb-4 block text-sm font-bold text-ink-700">
        Supplier invoice or GRN number (optional)
        <input
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          className={`${inputClass} mt-1`}
          placeholder="INV-2041"
        />
      </label>
      <div className="space-y-3">
        {lines.map((line, i) => (
          <div key={i} className="flex items-end gap-3">
            <label className="min-w-0 flex-1 text-sm font-bold text-ink-700">
              Product
              <select
                value={line.productId}
                onChange={(e) =>
                  setLines(lines.map((l, j) => (j === i ? { ...l, productId: e.target.value } : l)))
                }
                className={`${inputClass} mt-1`}
              >
                <option value="">Choose a product</option>
                {sorted.map((r) => (
                  <option key={r.stock.productId} value={r.stock.productId}>
                    {r.product ? `${r.product.name}, ${r.product.unit}` : r.stock.productId}
                  </option>
                ))}
              </select>
            </label>
            <label className="w-28 text-sm font-bold text-ink-700">
              Quantity
              <input
                inputMode="numeric"
                value={line.quantity}
                onChange={(e) =>
                  setLines(
                    lines.map((l, j) =>
                      j === i ? { ...l, quantity: e.target.value.replace(/\D/g, "") } : l,
                    ),
                  )
                }
                className={`${inputClass} mt-1 text-right tabular-nums`}
                placeholder="0"
              />
            </label>
            <Button
              variant="ghost"
              aria-label="Remove line"
              disabled={lines.length === 1}
              onClick={() => setLines(lines.filter((_, j) => j !== i))}
            >
              <Icon name="close" />
            </Button>
          </div>
        ))}
      </div>
      <Button
        variant="secondary"
        size="sm"
        className="mt-4"
        onClick={() => setLines([...lines, { productId: "", quantity: "" }])}
      >
        <Icon name="plus" size={16} />
        Add another product
      </Button>
    </Dialog>
  );
}

const ADJUST_TYPES = [
  { value: "adjustment", label: "Recount", hint: "Counted more or less than the system shows" },
  { value: "damage", label: "Damaged", hint: "Broken or spoilt, removed from the shelf" },
  { value: "expiry", label: "Expired", hint: "Past its date, removed from the shelf" },
] as const;

function AdjustDialog({
  row,
  onClose,
  onSaved,
}: {
  row: Row | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const { warehouseId, me } = useWarehouse();
  const queryClient = useQueryClient();
  const [type, setType] = useState<(typeof ADJUST_TYPES)[number]["value"]>("adjustment");
  const [direction, setDirection] = useState<"add" | "remove">("remove");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [rack, setRack] = useState<string | null>(null);
  const [limit, setLimit] = useState<string | null>(null);

  const removing = type !== "adjustment" || direction === "remove";
  const delta = (removing ? -1 : 1) * Number(quantity || 0);
  const scope = me.role === "admin" ? { warehouseId } : {};

  const done = (message: string) => {
    onSaved(message);
    void queryClient.invalidateQueries({ queryKey: ["stock"] });
    void queryClient.invalidateQueries({ queryKey: ["racks"] });
    setQuantity("");
    setReason("");
    setRack(null);
    setLimit(null);
    onClose();
  };
  const adjust = useMutation({
    mutationFn: () =>
      api("/v1/inventory/stock/adjust", {
        method: "POST",
        body: { ...scope, productId: row?.stock.productId, type, quantityDelta: delta, reason },
      }),
    onSuccess: () => done(`${row?.product?.name ?? "Stock"} updated.`),
  });
  const update = useMutation({
    mutationFn: () =>
      api(`/v1/inventory/stock/${encodeURIComponent(row?.stock.productId ?? "")}`, {
        method: "PATCH",
        body: {
          ...scope,
          ...(rack !== null ? { rackLocation: rack.trim() || null } : {}),
          ...(limit !== null ? { maxPerOrder: limit === "" ? null : Number(limit) } : {}),
        },
      }),
    onSuccess: () => done("Shelf and limit saved."),
  });

  if (!row) return null;
  const s = row.stock;
  const name = row.product?.name ?? s.productId;
  const after = s.onHand + delta;
  const canAdjust = Number(quantity) > 0 && reason.trim().length >= 3;
  const settingsChanged = rack !== null || limit !== null;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (canAdjust) adjust.mutate();
  }

  return (
    <Dialog open onClose={onClose} title={name} wide>
      <div className="mb-5 grid grid-cols-3 gap-3 text-center">
        {[
          ["On hand", s.onHand],
          ["Held for orders", s.reserved],
          ["Free to sell", s.available],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg bg-surface px-3 py-2">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-500">{label}</p>
            <p className="text-2xl font-extrabold tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      <form onSubmit={submit} className="rounded-xl border border-line p-4">
        <h3 className="mb-3 text-base font-extrabold">Change the count</h3>
        {adjust.error ? <ErrorBanner>{adjust.error.message}</ErrorBanner> : null}
        <div role="radiogroup" aria-label="Why" className="mb-3 grid grid-cols-3 gap-2">
          {ADJUST_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              role="radio"
              aria-checked={type === t.value}
              onClick={() => setType(t.value)}
              className={`rounded-lg border-2 px-3 py-2 text-left transition ${
                type === t.value ? "border-brand-600 bg-brand-50" : "border-line bg-white"
              }`}
            >
              <span className="block text-base font-bold">{t.label}</span>
              <span className="block text-xs text-ink-500">{t.hint}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          {type === "adjustment" ? (
            <div
              className="flex rounded-lg border border-line p-1"
              role="group"
              aria-label="Direction"
            >
              {(["remove", "add"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={direction === d}
                  onClick={() => setDirection(d)}
                  className={`flex h-9 items-center gap-1 rounded-md px-3 text-sm font-bold ${
                    direction === d ? "bg-ink-900 text-white" : "text-ink-700"
                  }`}
                >
                  <Icon name={d === "add" ? "plus" : "minus"} size={16} />
                  {d === "add" ? "Add" : "Remove"}
                </button>
              ))}
            </div>
          ) : null}
          <label className="w-28 text-sm font-bold text-ink-700">
            Quantity
            <input
              inputMode="numeric"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value.replace(/\D/g, ""))}
              className={`${inputClass} mt-1 text-right tabular-nums`}
              placeholder="0"
            />
          </label>
          <label className="min-w-48 flex-1 text-sm font-bold text-ink-700">
            Reason
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className={`${inputClass} mt-1`}
              placeholder="Two packs torn at the seal"
              maxLength={200}
            />
          </label>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-sm text-ink-700">
            {Number(quantity) > 0 ? (
              <>
                On hand becomes{" "}
                <strong className={after < s.reserved ? "text-red-700" : ""}>{after}</strong>
                {after < s.reserved ? ", below what is held for orders" : ""}
              </>
            ) : (
              "A reason is kept in the stock history."
            )}
          </p>
          <Button type="submit" disabled={!canAdjust || adjust.isPending}>
            {adjust.isPending ? "Saving..." : "Save change"}
          </Button>
        </div>
      </form>

      <div className="mt-4 rounded-xl border border-line p-4">
        <h3 className="mb-3 text-base font-extrabold">Shelf and limit</h3>
        {update.error ? <ErrorBanner>{update.error.message}</ErrorBanner> : null}
        <div className="flex flex-wrap items-end gap-3">
          <label className="w-40 text-sm font-bold text-ink-700">
            Rack
            <input
              value={rack ?? s.rackLocation ?? ""}
              onChange={(e) => setRack(e.target.value)}
              className={`${inputClass} mt-1`}
              placeholder="A3"
              maxLength={40}
            />
          </label>
          <label className="w-40 text-sm font-bold text-ink-700">
            Max per order
            <input
              inputMode="numeric"
              value={limit ?? (s.maxPerOrder === null ? "" : String(s.maxPerOrder))}
              onChange={(e) => setLimit(e.target.value.replace(/\D/g, ""))}
              className={`${inputClass} mt-1 tabular-nums`}
              placeholder="No limit"
            />
          </label>
          <Button
            variant="secondary"
            className="ml-auto"
            disabled={!settingsChanged || update.isPending}
            onClick={() => update.mutate()}
          >
            {update.isPending ? "Saving..." : "Save shelf and limit"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------------------------

export default function InventoryPage() {
  const { data, error, isLoading } = useStock();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [receiving, setReceiving] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(id);
  }, [toast]);
  const rows = useMemo(() => data ?? [], [data]);

  const counts = {
    all: rows.length,
    low: rows.filter((r) => level(r.stock) === "low").length,
    out: rows.filter((r) => level(r.stock) === "out").length,
  };
  const needle = q.trim().toLowerCase();
  const order = { out: 0, low: 1, ok: 2 } as const;
  const shown = rows
    .filter((r) => filter === "all" || level(r.stock) === filter)
    .filter(
      (r) =>
        !needle ||
        r.stock.productId.toLowerCase().includes(needle) ||
        r.product?.name.toLowerCase().includes(needle),
    )
    .sort(
      (a, b) =>
        order[level(a.stock)] - order[level(b.stock)] ||
        (a.product?.name ?? "").localeCompare(b.product?.name ?? ""),
    );

  const FILTERS: { value: Filter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "low", label: "Low" },
    { value: "out", label: "Out" },
  ];

  return (
    <>
      <PageHeader
        title="Inventory"
        subtitle="Stock at this warehouse. Free to sell is on hand minus what is held for orders."
        action={
          <Button size="md" onClick={() => setReceiving(true)} disabled={rows.length === 0}>
            <Icon name="plus" />
            Receive stock
          </Button>
        }
      />
      {error ? <ErrorBanner>{error.message}</ErrorBanner> : null}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="relative min-w-64 flex-1">
          <span className="sr-only">Search products</span>
          <Icon
            name="search"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-500"
          />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by product name"
            className={`${inputClass} pl-10`}
          />
        </label>
        <div className="flex gap-2" role="group" aria-label="Filter by stock level">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              aria-pressed={filter === f.value}
              onClick={() => setFilter(f.value)}
              className={`inline-flex h-11 items-center gap-2 rounded-full border px-4 text-base font-bold transition ${
                filter === f.value
                  ? "border-ink-900 bg-ink-900 text-white"
                  : "border-line bg-white text-ink-700 hover:bg-surface"
              }`}
            >
              {f.label}
              <span
                className={`rounded-full px-2 text-xs tabular-nums ${
                  filter === f.value
                    ? "bg-white/20"
                    : f.value === "out" && counts.out > 0
                      ? "bg-red-100 text-red-800"
                      : f.value === "low" && counts.low > 0
                        ? "bg-amber-100 text-amber-900"
                        : "bg-surface"
                }`}
              >
                {counts[f.value]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-96" />
      ) : shown.length === 0 ? (
        <Empty icon="search" title="No products match">
          Try another name or clear the filter.
        </Empty>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-white shadow-card">
          <table className="w-full">
            <thead className="border-b border-line bg-surface/60">
              <tr>
                <th className={th}>Product</th>
                <th className={th}>Rack</th>
                <th className={`${th} text-right`}>On hand</th>
                <th className={`${th} text-right`}>Held</th>
                <th className={`${th} text-right`}>Free to sell</th>
                <th className={th}>Status</th>
                <th className={th}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {shown.map((r) => {
                const l = level(r.stock);
                return (
                  <tr key={r.stock.productId} className="hover:bg-brand-50/40">
                    <td className={td}>
                      <span className="flex items-center gap-3">
                        <Thumb
                          imageUrl={r.product?.imageUrl}
                          emoji={r.product?.emoji ?? "?"}
                          size={44}
                        />
                        <span className="min-w-0">
                          <span className="block font-bold leading-5">
                            {r.product?.name ?? r.stock.productId}
                          </span>
                          <span className="text-sm text-ink-500">{r.product?.unit ?? ""}</span>
                        </span>
                      </span>
                    </td>
                    <td className={`${td} font-semibold text-ink-700`}>
                      {r.stock.rackLocation ?? <span className="text-ink-500">Not set</span>}
                    </td>
                    <td className={`${td} text-right tabular-nums`}>{r.stock.onHand}</td>
                    <td className={`${td} text-right tabular-nums text-ink-500`}>
                      {r.stock.reserved}
                    </td>
                    <td className={`${td} text-right text-lg font-extrabold tabular-nums`}>
                      {r.stock.available}
                    </td>
                    <td className={td}>
                      {l === "out" ? (
                        <Badge tone="red" dot>
                          Out
                        </Badge>
                      ) : l === "low" ? (
                        <Badge tone="amber" dot>
                          Low
                        </Badge>
                      ) : (
                        <Badge tone="green" dot>
                          In stock
                        </Badge>
                      )}
                    </td>
                    <td className={`${td} text-right`}>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setEditing(r)}
                        aria-label={`Manage ${r.product?.name ?? r.stock.productId}`}
                      >
                        Manage
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ReceiveDialog
        open={receiving}
        onClose={() => setReceiving(false)}
        rows={rows}
        onSaved={setToast}
      />
      <AdjustDialog
        key={editing?.stock.productId ?? "none"}
        row={editing}
        onClose={() => setEditing(null)}
        onSaved={setToast}
      />
      <div
        role="status"
        aria-live="polite"
        className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 transition ${
          toast ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"
        }`}
      >
        {toast ? (
          <span className="inline-flex items-center gap-2 rounded-full bg-ink-900 px-5 py-3 text-base font-bold text-white shadow-dialog">
            <Icon name="check" className="text-brand-500" strokeWidth={3} />
            {toast}
          </span>
        ) : null}
      </div>
    </>
  );
}
