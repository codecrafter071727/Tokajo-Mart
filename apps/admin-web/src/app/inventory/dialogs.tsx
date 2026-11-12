"use client";

import {
  adjustStockBodySchema,
  receiveStockBodySchema,
  updateStockBodySchema,
  type StockRow,
} from "@qc/contracts";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Modal } from "../../components/dialogs";
import { Alert, Button, Field, inputCls } from "../../components/ui";
import { errorMessage, gw } from "../../lib/gw";
import type { ProductName } from "../../lib/products";

type DialogProps<T = unknown> = { onClose: () => void; onDone: (message: string) => void } & T;

function Actions({ busy, onClose, label }: { busy: boolean; onClose: () => void; label: string }) {
  return (
    <div className="flex justify-end gap-3 pt-2">
      <Button onClick={onClose}>Cancel</Button>
      <Button type="submit" variant="primary" disabled={busy}>
        {busy ? "Saving" : label}
      </Button>
    </div>
  );
}

/** First zod message, so a form shows one clear problem at a time. */
const firstIssue = (error: { issues: { message: string }[] }) =>
  error.issues[0]?.message ?? "Check the form.";

// ---------------------------------------------------------------------------------------------
// Receive stock (a goods received note with several lines)
// ---------------------------------------------------------------------------------------------

type Line = { productId: string; quantity: string };

export function ReceiveDialog({
  warehouseId,
  warehouseName,
  products,
  onClose,
  onDone,
}: DialogProps<{ warehouseId: string; warehouseName: string; products: ProductName[] }>) {
  const [reference, setReference] = useState("");
  const [lines, setLines] = useState<Line[]>([{ productId: "", quantity: "" }]);
  const [problem, setProblem] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: (body: unknown) => gw("POST", "/v1/inventory/stock/receive", body),
    onSuccess: () => onDone(`Stock received at ${warehouseName}.`),
  });

  const setLine = (index: number, patch: Partial<Line>) =>
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));

  const submit = () => {
    setProblem(null);
    // Accept "p1" or the datalist's "p1 - Milk" form
    const items = lines.map((line) => ({
      productId: line.productId.split(" - ")[0]?.trim() ?? "",
      quantity: Number(line.quantity),
    }));
    const unknown = items.find(
      (item) => products.length > 0 && !products.some((p) => p.id === item.productId),
    );
    if (unknown)
      return setProblem(`"${unknown.productId}" is not a product. Pick one from the list.`);
    const merged = new Map<string, number>();
    for (const item of items)
      merged.set(item.productId, (merged.get(item.productId) ?? 0) + item.quantity);
    const parsed = receiveStockBodySchema.safeParse({
      warehouseId,
      reference: reference.trim() || undefined,
      items: [...merged].map(([productId, quantity]) => ({ productId, quantity })),
    });
    if (!parsed.success) return setProblem(firstIssue(parsed.error));
    save.mutate(parsed.data);
  };

  return (
    <Modal title={`Receive stock at ${warehouseName}`} onClose={onClose} wide>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className="space-y-4"
      >
        <Field label="Reference (optional)" hint="A supplier invoice or goods received number">
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            maxLength={100}
            className={inputCls}
          />
        </Field>

        <datalist id="receive-products">
          {products
            .filter((p) => !lines.some((l) => l.productId.split(" - ")[0] === p.id))
            .map((p) => (
              <option key={p.id} value={`${p.id} - ${p.name}`} />
            ))}
        </datalist>

        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">Items</legend>
          {lines.map((line, index) => (
            <div key={index} className="flex gap-2">
              <input
                aria-label={`Product ${index + 1}`}
                list="receive-products"
                placeholder="Search a product"
                value={line.productId}
                onChange={(e) => setLine(index, { productId: e.target.value })}
                className={`${inputCls} mt-0 min-w-0 flex-1`}
              />
              <input
                aria-label={`Quantity ${index + 1}`}
                inputMode="numeric"
                placeholder="Qty"
                value={line.quantity}
                onChange={(e) => setLine(index, { quantity: e.target.value.replace(/\D/g, "") })}
                className={`${inputCls.replace("w-full", "")} mt-0 w-24 shrink-0`}
              />
              <Button
                small
                aria-label={`Remove line ${index + 1}`}
                disabled={lines.length === 1}
                onClick={() => setLines((current) => current.filter((_, i) => i !== index))}
              >
                Remove
              </Button>
            </div>
          ))}
          <Button
            small
            variant="ghost"
            onClick={() => setLines((current) => [...current, { productId: "", quantity: "" }])}
          >
            Add another item
          </Button>
        </fieldset>

        {problem ? <Alert>{problem}</Alert> : null}
        {save.isError ? <Alert>{errorMessage(save.error)}</Alert> : null}
        <Actions busy={save.isPending} onClose={onClose} label="Receive stock" />
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------------------------
// Adjust (recount, damage, expiry)
// ---------------------------------------------------------------------------------------------

const TYPES = [
  { value: "adjustment", label: "Recount correction" },
  { value: "damage", label: "Damaged" },
  { value: "expiry", label: "Expired" },
] as const;

export function AdjustDialog({
  row,
  productLabel,
  onClose,
  onDone,
}: DialogProps<{ row: StockRow; productLabel: string }>) {
  const [type, setType] = useState<(typeof TYPES)[number]["value"]>("adjustment");
  const [direction, setDirection] = useState<"add" | "remove">("remove");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: (body: unknown) => gw("POST", "/v1/inventory/stock/adjust", body),
    onSuccess: () => onDone(`Stock updated for ${productLabel}.`),
  });

  // Damage and expiry always remove stock. Only a recount can add.
  const removes = type !== "adjustment" || direction === "remove";
  const free = row.available;

  const submit = () => {
    setProblem(null);
    const n = Number(amount);
    const parsed = adjustStockBodySchema.safeParse({
      warehouseId: row.warehouseId,
      productId: row.productId,
      type,
      quantityDelta: removes ? -n : n,
      reason,
    });
    if (!Number.isInteger(n) || n < 1) return setProblem("Enter how many, as a whole number.");
    if (reason.trim().length < 3)
      return setProblem("Add a short reason. It is kept in the stock history.");
    if (removes && n > free) {
      return setProblem(`Only ${free} can be removed. The rest is held for orders.`);
    }
    if (!parsed.success) return setProblem(firstIssue(parsed.error));
    save.mutate(parsed.data);
  };

  return (
    <Modal title={`Adjust ${productLabel}`} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className="space-y-4"
      >
        <p className="text-sm text-ink-700">
          {row.onHand} on hand, {row.reserved} held for orders, {row.available} free.
        </p>
        <Field label="What happened">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as typeof type)}
            className={inputCls}
          >
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-4">
          {type === "adjustment" ? (
            <Field label="Change">
              <select
                value={direction}
                onChange={(e) => setDirection(e.target.value as typeof direction)}
                className={inputCls}
              >
                <option value="remove">Remove stock</option>
                <option value="add">Add stock</option>
              </select>
            </Field>
          ) : null}
          <Field label="How many">
            <input
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
              className={inputCls}
            />
          </Field>
        </div>
        <Field label="Reason" hint="Required. This is kept in the stock history.">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={200}
            className={inputCls}
          />
        </Field>
        {problem ? <Alert>{problem}</Alert> : null}
        {save.isError ? <Alert>{errorMessage(save.error)}</Alert> : null}
        <Actions busy={save.isPending} onClose={onClose} label="Save adjustment" />
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------------------------
// Per order limit and rack location
// ---------------------------------------------------------------------------------------------

export function EditStockDialog({
  row,
  productLabel,
  onClose,
  onDone,
}: DialogProps<{ row: StockRow; productLabel: string }>) {
  const [limit, setLimit] = useState(row.maxPerOrder === null ? "" : String(row.maxPerOrder));
  const [rack, setRack] = useState(row.rackLocation ?? "");
  const [problem, setProblem] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: (body: unknown) =>
      gw("PATCH", `/v1/inventory/stock/${encodeURIComponent(row.productId)}`, body),
    onSuccess: () => onDone(`Saved ${productLabel}.`),
  });

  const submit = () => {
    setProblem(null);
    const parsed = updateStockBodySchema.safeParse({
      warehouseId: row.warehouseId,
      maxPerOrder: limit.trim() === "" ? null : Number(limit),
      rackLocation: rack.trim() === "" ? null : rack.trim(),
    });
    if (!parsed.success) return setProblem(firstIssue(parsed.error));
    save.mutate(parsed.data);
  };

  return (
    <Modal title={`${productLabel}: limit and rack`} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className="space-y-4"
      >
        <Field label="Most one customer can order" hint="Leave empty for no limit">
          <input
            inputMode="numeric"
            value={limit}
            onChange={(e) => setLimit(e.target.value.replace(/\D/g, ""))}
            className={inputCls}
          />
        </Field>
        <Field label="Rack location" hint="For example A-12, shown to pickers">
          <input
            value={rack}
            onChange={(e) => setRack(e.target.value)}
            maxLength={40}
            className={inputCls}
          />
        </Field>
        {problem ? <Alert>{problem}</Alert> : null}
        {save.isError ? <Alert>{errorMessage(save.error)}</Alert> : null}
        <Actions busy={save.isPending} onClose={onClose} label="Save" />
      </form>
    </Modal>
  );
}
