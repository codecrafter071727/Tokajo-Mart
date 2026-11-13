"use client";

import type {
  AdminProductDetail,
  AdminWarehouse,
  OrderSummary,
  ProductStockResponse,
  StockMovement,
  StockRow,
} from "@qc/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ConfirmModal, Thumb } from "../../../../components/catalog-ui";
import { PageActions } from "../../../../components/page-actions";
import {
  Alert,
  Badge,
  Button,
  EmptyRow,
  LoadingRows,
  PageHeader,
  Panel,
  rowAction,
  td,
  tdActions,
  tdNum,
  th,
  thNum,
} from "../../../../components/kit";
import { KeyValue, Stat } from "../../../../components/ui/core";
import { Boxes, IndianRupee, Percent, ShoppingBag } from "../../../../components/ui/icons";
import { rupees } from "../../../../lib/api";
import { catalogAdmin } from "../../../../lib/catalog-admin";
import { rangeFor } from "../../../../lib/dates";
import { errorMessage, gw, GwError } from "../../../../lib/gw";
import { dateTime, LOW_STOCK } from "../../../../lib/ops";
import { AdjustDialog, ReceiveDialog } from "../../../inventory/dialogs";
import { ProductDialog } from "../../product-dialog";
import { ImageManager } from "./image-manager";
import { VariantsPanel } from "./variants-panel";

const MOVEMENT: Record<StockMovement["type"], string> = {
  grn: "Received",
  sale: "Sold",
  adjustment: "Adjusted",
  damage: "Damaged",
  expiry: "Expired",
  return: "Returned",
};

/** The reason someone typed, or for orders a short order reference instead of a long id. */
function whyLabel(m: StockMovement): string {
  if (m.reason) return m.reason;
  if (!m.reference) return "";
  const looksLikeId = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(m.reference);
  if (m.type === "sale" || m.type === "return") {
    return looksLikeId ? `Order ${m.reference.slice(0, 8)}` : `Order ${m.reference}`;
  }
  return `Ref ${m.reference}`;
}

export function ProductDetail({ id }: { id: string }) {
  const client = useQueryClient();
  const q = encodeURIComponent(id);
  const product = useQuery({
    queryKey: ["admin-product", id],
    queryFn: () => gw<AdminProductDetail>("GET", `/v1/catalog/admin/products/${q}`),
  });
  const categories = useQuery({ queryKey: ["categories"], queryFn: catalogAdmin.categories });
  const warehouses = useQuery({
    queryKey: ["warehouses"],
    queryFn: () => gw<{ items: AdminWarehouse[] }>("GET", "/v1/inventory/warehouses"),
  });
  const stock = useQuery({
    queryKey: ["product-stock", id],
    queryFn: () => gw<ProductStockResponse>("GET", `/v1/inventory/stock/by-product/${q}`),
  });
  const movements = useQuery({
    queryKey: ["product-movements", id, warehouses.data?.items.map((w) => w.id).join(",")],
    enabled: Boolean(warehouses.data),
    queryFn: async () => {
      const lists = await Promise.all(
        (warehouses.data?.items ?? []).map((w) =>
          gw<{ items: StockMovement[] }>(
            "GET",
            `/v1/inventory/stock/movements?warehouseId=${encodeURIComponent(w.id)}&productId=${q}&limit=15`,
          ).then((r) => r.items),
        ),
      );
      return lists
        .flat()
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 20);
    },
  });
  const range = rangeFor("30d");
  const sales = useQuery({
    queryKey: ["summary", "30d", "all"],
    queryFn: () =>
      gw<OrderSummary>("GET", `/v1/orders/admin/summary?from=${range.from}&to=${range.to}`),
  });

  const [dialog, setDialog] = useState<
    | { kind: "edit" }
    | { kind: "archive" }
    | { kind: "receive"; warehouse: AdminWarehouse }
    | { kind: "adjust"; row: StockRow }
    | null
  >(null);
  const [notice, setNotice] = useState<string | null>(null);

  const archive = useMutation({
    mutationFn: (restore: boolean) =>
      restore ? catalogAdmin.restoreProduct(id) : catalogAdmin.archiveProduct(id),
    onSuccess: async (_data, restore) => {
      setDialog(null);
      setNotice(restore ? "Back on sale." : "Archived. Customers no longer see it.");
      await client.invalidateQueries({ queryKey: ["admin-product", id] });
      await client.invalidateQueries({ queryKey: ["admin-products"] });
    },
  });

  if (product.isError) {
    const missing = product.error instanceof GwError && product.error.status === 404;
    return (
      <>
        <PageHeader title="Product" crumbs={[{ label: "Catalog", href: "/catalog" }]} />
        <Alert title={missing ? "Product not found" : "Could not load this product"}>
          {missing ? "The link may be wrong." : errorMessage(product.error)}
        </Alert>
      </>
    );
  }

  const p = product.data;
  const category = categories.data?.find((c) => c.id === p?.categoryId);
  const byWarehouse = new Map((stock.data?.items ?? []).map((r) => [r.warehouseId, r]));
  const sold = sales.data?.topProducts.find((t) => t.productId === id);
  const warehouseName = (wid: string) =>
    warehouses.data?.items.find((w) => w.id === wid)?.name ?? wid;

  const done = (message: string) => {
    setDialog(null);
    setNotice(message);
    void client.invalidateQueries({ queryKey: ["product-stock", id] });
    void client.invalidateQueries({ queryKey: ["product-movements", id] });
    void client.invalidateQueries({ queryKey: ["admin-product", id] });
  };

  return (
    <>
      <PageHeader
        title={p?.name ?? "Product"}
        crumbs={[
          { label: "Catalog", href: "/catalog" },
          ...(category ? [{ label: category.name, href: "/catalog" }] : []),
          { label: p?.name ?? id },
        ]}
        badge={
          p ? (
            p.archived ? (
              <Badge tone="gray">Archived</Badge>
            ) : (
              <Badge tone="green">On sale</Badge>
            )
          ) : null
        }
        description={p ? `${p.unit} · ${id}` : undefined}
      />
      <PageActions>
        <Button disabled={!p || !categories.data} onClick={() => setDialog({ kind: "edit" })}>
          Edit
        </Button>
        <Button
          variant={p?.archived ? "primary" : "danger"}
          disabled={!p}
          onClick={() => setDialog({ kind: "archive" })}
        >
          {p?.archived ? "Restore" : "Archive"}
        </Button>
      </PageActions>

      {notice ? (
        <div className="mb-4">
          <Alert tone="success">{notice}</Alert>
        </div>
      ) : null}
      {p?.archived ? (
        <div className="mb-4">
          <Alert tone="warning" title="Not on sale">
            Customers cannot find or order this product. Restore it to sell it again.
          </Alert>
        </div>
      ) : null}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          delay={0}
          icon={IndianRupee}
          label="Selling price"
          value={p ? rupees(p.pricePaise) : "-"}
          hint={p && p.mrpPaise > p.pricePaise ? `MRP ${rupees(p.mrpPaise)}` : "Sold at MRP"}
        />
        <Stat
          delay={1}
          icon={Percent}
          label="Discount"
          value={p ? `${p.discountPercent}%` : "-"}
          hint={
            p && p.mrpPaise > p.pricePaise
              ? `Saves the customer ${rupees(p.mrpPaise - p.pricePaise)}`
              : "No discount"
          }
        />
        <Stat
          delay={2}
          icon={Boxes}
          label="Free to sell"
          value={stock.data ? stock.data.totals.available : "-"}
          hint={
            stock.data
              ? `${stock.data.totals.onHand} on hand · ${stock.data.totals.reserved} held for orders`
              : " "
          }
          tone={
            stock.data
              ? stock.data.totals.available === 0
                ? "bad"
                : stock.data.totals.available <= LOW_STOCK
                  ? "warn"
                  : "ok"
              : undefined
          }
        />
        <Stat
          delay={3}
          icon={ShoppingBag}
          label="Sold, 30 days"
          value={sales.data ? (sold?.quantity ?? "Not in top 10") : "-"}
          hint={
            sold ? `${rupees(sold.revenuePaise)} in sales` : "Only the 10 best sellers are counted"
          }
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Panel title="Stock by warehouse" flush>
            <div className="data-table overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className={th}>Warehouse</th>
                    <th className={thNum}>On hand</th>
                    <th className={thNum}>Held</th>
                    <th className={thNum}>Free</th>
                    <th className={`${th} hidden xl:table-cell`}>Rack</th>
                    <th className={th}>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {warehouses.isPending || stock.isPending ? (
                    <LoadingRows colSpan={6} rows={2} />
                  ) : stock.isError ? (
                    <EmptyRow colSpan={6}>{errorMessage(stock.error)}</EmptyRow>
                  ) : (
                    (warehouses.data?.items ?? []).map((w) => {
                      const row = byWarehouse.get(w.id);
                      return (
                        <tr key={w.id}>
                          <td className={`${td} font-medium`}>
                            {w.name}
                            {!w.open ? (
                              <span className="ml-2">
                                <Badge tone="gray">Closed</Badge>
                              </span>
                            ) : null}
                          </td>
                          <td className={tdNum}>{row?.onHand ?? 0}</td>
                          <td className={`${tdNum} text-muted`}>{row?.reserved ?? 0}</td>
                          <td
                            className={`${tdNum} font-semibold ${
                              !row || row.available === 0
                                ? "text-bad"
                                : row.available <= LOW_STOCK
                                  ? "text-warn"
                                  : ""
                            }`}
                          >
                            {row?.available ?? 0}
                          </td>
                          <td className={`${td} hidden text-muted xl:table-cell`}>
                            {row?.rackLocation ?? "Not set"}
                          </td>
                          <td className={tdActions}>
                            <button
                              type="button"
                              className={rowAction}
                              onClick={() => setDialog({ kind: "receive", warehouse: w })}
                            >
                              Receive
                            </button>
                            {row ? (
                              <button
                                type="button"
                                className={rowAction}
                                onClick={() => setDialog({ kind: "adjust", row })}
                              >
                                Adjust
                              </button>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel
            title="Recent stock changes"
            description="Across every warehouse, newest first"
            flush
          >
            <div className="data-table overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className={th}>What</th>
                    <th className={thNum}>Change</th>
                    <th className={th}>Warehouse</th>
                    <th className={`${th} hidden xl:table-cell`}>Why</th>
                    <th className={th}>When</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.isPending ? (
                    <LoadingRows colSpan={5} rows={4} />
                  ) : movements.isError ? (
                    <EmptyRow colSpan={5}>{errorMessage(movements.error)}</EmptyRow>
                  ) : movements.data.length === 0 ? (
                    <EmptyRow colSpan={5}>No stock changes recorded yet.</EmptyRow>
                  ) : (
                    movements.data.map((m) => (
                      <tr key={`${m.warehouseId}-${m.id}`}>
                        <td className={td}>{MOVEMENT[m.type]}</td>
                        <td
                          className={`${tdNum} font-semibold ${m.quantityDelta > 0 ? "text-ok" : "text-bad"}`}
                        >
                          {m.quantityDelta > 0 ? `+${m.quantityDelta}` : m.quantityDelta}
                        </td>
                        <td className={td}>{warehouseName(m.warehouseId)}</td>
                        <td className={`${td} hidden max-w-60 truncate text-muted xl:table-cell`}>
                          {whyLabel(m)}
                        </td>
                        <td className={`${td} whitespace-nowrap text-muted`}>
                          {dateTime(m.createdAt)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Product">
            {p ? (
              <div className="space-y-4">
                <div className="flex justify-center rounded-lg bg-surface-2 p-4">
                  <Thumb
                    imageUrl={p.imageUrl}
                    emoji={p.emoji}
                    fit={p.imageFit}
                    size="size-40 text-6xl"
                  />
                </div>
                <KeyValue
                  items={[
                    { label: "Category", value: category?.name ?? p.categoryId },
                    { label: "Brand", value: p.brand ?? "Not set" },
                    {
                      label: "Tags",
                      value: p.tags?.length ? (
                        <span className="flex flex-wrap gap-1">
                          {p.tags.map((t) => (
                            <Badge key={t} tone="gray">
                              {t}
                            </Badge>
                          ))}
                        </span>
                      ) : (
                        "None"
                      ),
                    },
                    { label: "Pack size", value: p.unit },
                    { label: "Price", value: rupees(p.pricePaise) },
                    { label: "MRP", value: rupees(p.mrpPaise) },
                    { label: "Delivery promise", value: `${p.deliveryMins} min` },
                    {
                      label: "Variant",
                      value: p.group ? `${p.variantLabel ?? p.unit} of ${p.group.name}` : "None",
                    },
                  ]}
                />
                {p.description ? (
                  <p className="border-t border-line pt-3 text-[13px] leading-5 text-ink-2">
                    {p.description}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="text-[13px] text-muted">Loading</p>
            )}
          </Panel>
          {p ? <VariantsPanel product={p} onEdit={() => setDialog({ kind: "edit" })} /> : null}
          {p ? <ImageManager product={p} /> : null}
        </div>
      </div>

      {dialog?.kind === "edit" && p && categories.data ? (
        <ProductDialog
          product={p}
          categories={categories.data}
          onClose={() => setDialog(null)}
          onSaved={done}
        />
      ) : null}
      {dialog?.kind === "archive" && p ? (
        <ConfirmModal
          title={p.archived ? `Restore ${p.name}?` : `Archive ${p.name}?`}
          confirmLabel={p.archived ? "Restore" : "Archive"}
          danger={!p.archived}
          pending={archive.isPending}
          error={archive.isError ? archive.error : null}
          onConfirm={() => archive.mutate(p.archived)}
          onClose={() => setDialog(null)}
          body={
            p.archived
              ? "It goes back on sale and customers can find and order it again."
              : "It is taken off sale. Customers will not see it, and stock stays as it is."
          }
        />
      ) : null}
      {dialog?.kind === "receive" && p ? (
        <ReceiveDialog
          warehouseId={dialog.warehouse.id}
          warehouseName={dialog.warehouse.name}
          products={[{ id: p.id, name: p.name, unit: p.unit, emoji: p.emoji }]}
          initialProductId={p.id}
          onClose={() => setDialog(null)}
          onDone={done}
        />
      ) : null}
      {dialog?.kind === "adjust" && p ? (
        <AdjustDialog
          row={dialog.row}
          productLabel={`${p.name} at ${warehouseName(dialog.row.warehouseId)}`}
          onClose={() => setDialog(null)}
          onDone={done}
        />
      ) : null}
    </>
  );
}
