"use client";

import type { AdminWarehouse, StockRow } from "@qc/contracts";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Button,
  Alert,
  Badge,
  EmptyRow,
  LoadingRows,
  TableShell,
  th,
  td,
  Toolbar,
} from "../../components/ui";
import { errorMessage, gw } from "../../lib/gw";
import { useProductNames } from "../../lib/products";
import { AdjustDialog, EditStockDialog, ReceiveDialog } from "./dialogs";
import { LedgerDrawer } from "./ledger";

const LOW_STOCK = 5;

export function Inventory() {
  const warehouses = useQuery({
    queryKey: ["warehouses"],
    queryFn: () => gw<{ items: AdminWarehouse[] }>("GET", "/v1/inventory/warehouses"),
  });
  const [chosen, setChosen] = useState("");
  const warehouseId = chosen || warehouses.data?.items[0]?.id || "";

  const names = useProductNames();
  const stock = useQuery({
    queryKey: ["stock", warehouseId],
    enabled: warehouseId !== "",
    queryFn: async () => {
      const rows: StockRow[] = [];
      let cursor: string | null = null;
      for (let page = 0; page < 30; page += 1) {
        const res: { items: StockRow[]; nextCursor: string | null } = await gw(
          "GET",
          `/v1/inventory/stock?warehouseId=${encodeURIComponent(warehouseId)}&limit=200${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
        );
        rows.push(...res.items);
        cursor = res.nextCursor;
        if (!cursor) break;
      }
      return rows;
    },
  });

  const [search, setSearch] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [dialog, setDialog] = useState<
    | { kind: "receive" }
    | { kind: "adjust"; row: StockRow }
    | { kind: "edit"; row: StockRow }
    | { kind: "ledger"; row: StockRow }
    | null
  >(null);
  const [notice, setNotice] = useState<string | null>(null);

  const label = (id: string) => names.data?.get(id);
  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (stock.data ?? [])
      .filter((row) => {
        if (lowOnly && row.available > LOW_STOCK) return false;
        if (!needle) return true;
        const product = names.data?.get(row.productId);
        return (
          row.productId.toLowerCase().includes(needle) ||
          (product?.name.toLowerCase().includes(needle) ?? false)
        );
      })
      .sort((a, b) =>
        (label(a.productId)?.name ?? a.productId).localeCompare(
          label(b.productId)?.name ?? b.productId,
        ),
      );
    // label reads names.data, which is already a dependency
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stock.data, names.data, search, lowOnly]);

  const lowCount = (stock.data ?? []).filter((r) => r.available <= LOW_STOCK).length;
  const warehouse = warehouses.data?.items.find((w) => w.id === warehouseId);

  const done = (message: string) => {
    setDialog(null);
    setNotice(message);
    void stock.refetch();
  };

  return (
    <>
      <Toolbar>
        <select
          aria-label="Warehouse"
          value={warehouseId}
          onChange={(event) => setChosen(event.target.value)}
          className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold"
        >
          {warehouses.data?.items.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
        <input
          type="search"
          aria-label="Search products"
          placeholder="Search by name or id"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-64 rounded-lg border border-line bg-white px-3 py-2 text-sm"
        />
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            checked={lowOnly}
            onChange={(event) => setLowOnly(event.target.checked)}
          />
          Low stock only ({lowCount})
        </label>
        <div className="ml-auto">
          <Button
            variant="primary"
            disabled={!warehouseId}
            onClick={() => setDialog({ kind: "receive" })}
          >
            Receive stock
          </Button>
        </div>
      </Toolbar>

      {notice ? (
        <div className="mb-4">
          <Alert tone="success">{notice}</Alert>
        </div>
      ) : null}
      {warehouses.isError ? <Alert>{errorMessage(warehouses.error)}</Alert> : null}
      {stock.isError ? <Alert>{errorMessage(stock.error)}</Alert> : null}
      {names.isError ? (
        <div className="mb-4">
          <Alert tone="info">Product names could not be loaded, so ids are shown instead.</Alert>
        </div>
      ) : null}

      <TableShell>
        <table className="w-full">
          <thead className="border-b border-line">
            <tr>
              {["Product", "On hand", "Held", "Free", "Order limit", ""].map((h, i) => (
                <th key={h || i} className={`${th} ${i >= 1 && i <= 3 ? "text-right" : ""}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {stock.isPending && warehouseId ? (
              <LoadingRows colSpan={6} />
            ) : rows.length === 0 ? (
              <EmptyRow colSpan={6}>
                {(stock.data ?? []).length === 0
                  ? `No stock at ${warehouse?.name ?? "this warehouse"} yet. Use Receive stock to add some.`
                  : "No products match."}
              </EmptyRow>
            ) : (
              rows.map((row) => {
                const product = label(row.productId);
                const low = row.available <= LOW_STOCK;
                return (
                  <tr
                    key={row.productId}
                    className="border-b border-line last:border-0 hover:bg-brand-50/40"
                  >
                    <td className={`${td} min-w-56`}>
                      <div className="font-bold">
                        {product ? `${product.emoji} ${product.name}` : row.productId}
                      </div>
                      <div className="text-xs text-ink-500">
                        {product ? `${product.unit} · ` : ""}
                        {row.productId}
                        {row.rackLocation ? ` · Rack ${row.rackLocation}` : ""}
                      </div>
                    </td>
                    <td className={`${td} text-right tabular-nums`}>{row.onHand}</td>
                    <td className={`${td} text-right tabular-nums text-ink-500`}>{row.reserved}</td>
                    <td className={`${td} text-right tabular-nums`}>
                      <span className="font-bold">{row.available}</span>{" "}
                      {row.available === 0 ? (
                        <Badge tone="red">Out</Badge>
                      ) : low ? (
                        <Badge tone="amber">Low</Badge>
                      ) : null}
                    </td>
                    <td className={`${td} whitespace-nowrap tabular-nums`}>
                      {row.maxPerOrder ?? "None"}
                    </td>
                    <td className={`${td} whitespace-nowrap text-right`}>
                      <Button
                        small
                        variant="ghost"
                        onClick={() => setDialog({ kind: "adjust", row })}
                      >
                        Adjust
                      </Button>
                      <Button
                        small
                        variant="ghost"
                        onClick={() => setDialog({ kind: "edit", row })}
                      >
                        Edit
                      </Button>
                      <Button
                        small
                        variant="ghost"
                        onClick={() => setDialog({ kind: "ledger", row })}
                      >
                        History
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </TableShell>

      {dialog?.kind === "receive" ? (
        <ReceiveDialog
          warehouseId={warehouseId}
          warehouseName={warehouse?.name ?? warehouseId}
          products={names.data ? [...names.data.values()] : []}
          onClose={() => setDialog(null)}
          onDone={done}
        />
      ) : null}
      {dialog?.kind === "adjust" ? (
        <AdjustDialog
          row={dialog.row}
          productLabel={label(dialog.row.productId)?.name ?? dialog.row.productId}
          onClose={() => setDialog(null)}
          onDone={done}
        />
      ) : null}
      {dialog?.kind === "edit" ? (
        <EditStockDialog
          row={dialog.row}
          productLabel={label(dialog.row.productId)?.name ?? dialog.row.productId}
          onClose={() => setDialog(null)}
          onDone={done}
        />
      ) : null}
      {dialog?.kind === "ledger" ? (
        <LedgerDrawer
          row={dialog.row}
          productLabel={label(dialog.row.productId)?.name ?? dialog.row.productId}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </>
  );
}
