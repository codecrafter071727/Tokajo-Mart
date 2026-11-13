"use client";

import type { StockMovement, StockRow } from "@qc/contracts";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Modal } from "../../components/dialogs";
import { Alert, Badge, Button, EmptyState } from "../../components/kit";
import { errorMessage, gw, qs } from "../../lib/gw";

const TYPE: Record<
  StockMovement["type"],
  { label: string; tone: "green" | "amber" | "red" | "gray" | "blue" }
> = {
  grn: { label: "Received", tone: "green" },
  sale: { label: "Sold", tone: "gray" },
  return: { label: "Returned", tone: "blue" },
  adjustment: { label: "Recount", tone: "amber" },
  damage: { label: "Damaged", tone: "red" },
  expiry: { label: "Expired", tone: "red" },
};

/** Every change to one product's stock, newest first. */
export function LedgerDrawer({
  row,
  productLabel,
  onClose,
}: {
  row: StockRow;
  productLabel: string;
  onClose: () => void;
}) {
  const query = useInfiniteQuery({
    queryKey: ["movements", row.warehouseId, row.productId],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      gw<{ items: StockMovement[]; nextCursor: string | null }>(
        "GET",
        `/v1/inventory/stock/movements${qs({ warehouseId: row.warehouseId, productId: row.productId, limit: 30, cursor: pageParam })}`,
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <Modal title={`${productLabel}: stock history`} onClose={onClose} side>
      {query.isError ? <Alert>{errorMessage(query.error)}</Alert> : null}
      {query.isPending ? (
        <div className="space-y-3" aria-busy="true">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-surface-2" />
          ))}
        </div>
      ) : null}
      {!query.isPending && items.length === 0 ? (
        <EmptyState icon="inventory" title="No movements yet">
          Deliveries received, sales and adjustments for this product will show here.
        </EmptyState>
      ) : null}
      <ul className="divide-y divide-line">
        {items.map((m) => (
          <li key={m.id} className="flex items-start justify-between gap-4 py-3">
            <div className="min-w-0">
              <Badge tone={TYPE[m.type].tone}>{TYPE[m.type].label}</Badge>
              <p className="mt-1 text-sm">{m.reason ?? m.reference ?? ""}</p>
              <p className="text-xs text-muted">
                {new Date(m.createdAt).toLocaleString("en-IN", {
                  day: "numeric",
                  month: "short",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </p>
            </div>
            <span
              className={`text-lg font-extrabold tabular-nums ${m.quantityDelta > 0 ? "text-accent" : "text-bad"}`}
            >
              {m.quantityDelta > 0 ? `+${m.quantityDelta}` : m.quantityDelta}
            </span>
          </li>
        ))}
      </ul>
      {query.hasNextPage ? (
        <div className="mt-4">
          <Button disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>
            {query.isFetchingNextPage ? "Loading" : "Load older"}
          </Button>
        </div>
      ) : null}
    </Modal>
  );
}
