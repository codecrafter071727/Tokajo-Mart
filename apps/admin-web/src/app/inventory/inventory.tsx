"use client";

import type { AdminWarehouse, StockRow } from "@qc/contracts";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Thumb } from "../../components/catalog-ui";
import { PageActions } from "../../components/page-actions";
import {
  Button,
  Alert,
  Badge,
  EmptyRow,
  LoadingRows,
  rowAction,
  SearchInput,
  selectCls,
  TableShell,
  th,
  td,
  tdActions,
  tdNum,
  thNum,
  Toggle,
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
      <PageActions>
        <Button
          variant="primary"
          icon="plus"
          disabled={!warehouseId}
          onClick={() => setDialog({ kind: "receive" })}
        >
          Receive stock
        </Button>
      </PageActions>
      <Toolbar>
        <select
          aria-label="Warehouse"
          value={warehouseId}
          onChange={(event) => setChosen(event.target.value)}
          className={selectCls}
        >
          {warehouses.data?.items.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
        <SearchInput
          aria-label="Search products"
          placeholder="Search by name or id"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Toggle
          label={
            <>
              Low stock only{" "}
              <span className="rounded-full bg-amber-100 px-1.5 text-xs font-semibold text-amber-900 tabular-nums">
                {lowCount}
              </span>
            </>
          }
          checked={lowOnly}
          onChange={setLowOnly}
        />
        <span className="ml-auto text-sm text-ink-500 tabular-nums">
          {stock.data ? `${rows.length} of ${stock.data.length} products` : ""}
        </span>
      </Toolbar>

      {notice ? (
        <div className="mb-4">
          <Alert tone="success">{notice}</Alert>
        </div>
      ) : null}
      {warehouses.isError ? (
        <div className="mb-4">
          <Alert>{errorMessage(warehouses.error)}</Alert>
        </div>
      ) : null}
      {stock.isError ? (
        <div className="mb-4">
          <Alert>{errorMessage(stock.error)}</Alert>
        </div>
      ) : null}
      {names.isError ? (
        <div className="mb-4">
          <Alert tone="info">Product names could not be loaded, so ids are shown instead.</Alert>
        </div>
      ) : null}

      <TableShell>
        <table>
          <thead>
            <tr>
              <th className={th}>Product</th>
              <th className={thNum}>On hand</th>
              <th className={thNum}>Held</th>
              <th className={thNum}>Free</th>
              <th className={`${th} hidden xl:table-cell`}>Status</th>
              <th className={`${thNum} hidden xl:table-cell`}>Order limit</th>
              <th className={th}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {warehouses.isPending || (stock.isPending && warehouseId) ? (
              <LoadingRows colSpan={7} rows={8} />
            ) : rows.length === 0 ? (
              <EmptyRow colSpan={7}>
                {(stock.data ?? []).length === 0
                  ? `No stock at ${warehouse?.name ?? "this warehouse"} yet. Use Receive stock to add some.`
                  : "No products match."}
              </EmptyRow>
            ) : (
              rows.map((row) => {
                const product = label(row.productId);
                const low = row.available <= LOW_STOCK;
                return (
                  <tr key={row.productId}>
                    <td className={`${td} min-w-56`}>
                      <div className="flex items-center gap-3">
                        <Thumb
                          imageUrl={product?.imageUrl ?? null}
                          emoji={product?.emoji ?? ""}
                          fit={product?.imageFit ?? "contain"}
                        />
                        <div className="min-w-0">
                          <div className="truncate font-medium">
                            {product?.name ?? row.productId}
                          </div>
                          <div className="text-xs text-ink-500">
                            {product ? `${product.unit} · ` : ""}
                            {row.productId}
                            {row.rackLocation ? ` · Rack ${row.rackLocation}` : ""}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className={tdNum}>{row.onHand}</td>
                    <td className={`${tdNum} text-ink-500`}>{row.reserved}</td>
                    <td
                      className={`${tdNum} font-semibold ${
                        row.available === 0 ? "text-red-700" : low ? "text-amber-700" : ""
                      }`}
                    >
                      {row.available}
                    </td>
                    <td className={`${td} hidden xl:table-cell`}>
                      {row.available === 0 ? (
                        <Badge tone="red">Out of stock</Badge>
                      ) : low ? (
                        <Badge tone="amber">Low</Badge>
                      ) : (
                        <Badge tone="green">In stock</Badge>
                      )}
                    </td>
                    <td
                      className={`${tdNum} hidden xl:table-cell ${row.maxPerOrder ? "" : "text-ink-300"}`}
                    >
                      {row.maxPerOrder ?? "None"}
                    </td>
                    <td className={tdActions}>
                      <button
                        type="button"
                        className={rowAction}
                        onClick={() => setDialog({ kind: "adjust", row })}
                      >
                        Adjust
                      </button>
                      <button
                        type="button"
                        className={rowAction}
                        onClick={() => setDialog({ kind: "edit", row })}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className={rowAction}
                        onClick={() => setDialog({ kind: "ledger", row })}
                      >
                        History
                      </button>
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
