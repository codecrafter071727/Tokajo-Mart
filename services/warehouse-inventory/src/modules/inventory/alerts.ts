import type { ExpiringBatch, StockAlert, StockAlertsResponse } from "@qc/contracts";
import type { BatchRecord, InventoryRepository } from "./repository";

/** Today's date in India as YYYY-MM-DD: the warehouse thinks of "today" in local time. */
export function indiaToday(now: Date = new Date()): string {
  return new Date(now.getTime() + 5.5 * 3600_000).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) / 86_400_000,
  );
}

const toExpiring = (b: BatchRecord, today: string): ExpiringBatch => ({
  id: b.id,
  warehouseId: b.warehouseId,
  productId: b.productId,
  batchCode: b.batchCode,
  // Never claim more of a batch than is still on the shelf
  quantity: Math.min(b.quantity, b.onHand),
  onHand: b.onHand,
  expiresOn: b.expiresOn,
  daysLeft: daysBetween(today, b.expiresOn),
  receivedAt: b.receivedAt,
});

/** Batches expiring within `days` (and any already past their date) that still have stock. */
export async function expiringBatches(
  repository: InventoryRepository,
  warehouseId: string | undefined,
  days: number,
  now: Date = new Date(),
): Promise<ExpiringBatch[]> {
  const today = indiaToday(now);
  const batches = await repository.listBatches({
    warehouseId,
    expiresOnOrBefore: addDays(today, days),
  });
  return batches.filter((b) => b.onHand > 0).map((b) => toExpiring(b, today));
}

/** Out of stock, low stock, expiring and expired, worked out on read (no sweep needed). */
export async function stockAlerts(
  repository: InventoryRepository,
  options: { warehouseId?: string; lowThreshold: number; expiryDays: number; now?: Date },
): Promise<StockAlertsResponse> {
  const [stock, batches] = await Promise.all([
    repository.allStock(options.warehouseId),
    expiringBatches(repository, options.warehouseId, options.expiryDays, options.now),
  ]);
  const available = new Map(stock.map((s) => [`${s.warehouseId}/${s.productId}`, s.available]));

  const items: StockAlert[] = [];
  for (const s of stock) {
    if (s.available <= 0) {
      items.push({
        kind: "out_of_stock",
        warehouseId: s.warehouseId,
        productId: s.productId,
        available: 0,
        expiresOn: null,
        daysLeft: null,
        quantity: null,
      });
    } else if (s.available <= options.lowThreshold) {
      items.push({
        kind: "low_stock",
        warehouseId: s.warehouseId,
        productId: s.productId,
        available: s.available,
        expiresOn: null,
        daysLeft: null,
        quantity: null,
      });
    }
  }
  for (const b of batches) {
    items.push({
      kind: b.daysLeft < 0 ? "expired" : "expiring",
      warehouseId: b.warehouseId,
      productId: b.productId,
      available: available.get(`${b.warehouseId}/${b.productId}`) ?? 0,
      expiresOn: b.expiresOn,
      daysLeft: b.daysLeft,
      quantity: b.quantity,
    });
  }
  const order = { expired: 0, out_of_stock: 1, expiring: 2, low_stock: 3 } as const;
  items.sort(
    (a, b) =>
      order[a.kind] - order[b.kind] ||
      (a.daysLeft ?? 0) - (b.daysLeft ?? 0) ||
      a.available - b.available,
  );
  const count = (kind: StockAlert["kind"]) => items.filter((i) => i.kind === kind).length;
  return {
    items,
    counts: {
      outOfStock: count("out_of_stock"),
      lowStock: count("low_stock"),
      expiring: count("expiring"),
      expired: count("expired"),
    },
  };
}

/** Told when products at a warehouse go from none available to some. Must never throw. */
export type RestockNotifier = (warehouseId: string, productIds: string[]) => void;

/**
 * Runs a stock change and reports the products that came back (0 available before, more after),
 * so customers who asked to be told can be. The report is fire and forget.
 */
export async function withRestockCheck<T>(
  repository: InventoryRepository,
  notifier: RestockNotifier | undefined,
  warehouseId: string,
  productIds: string[],
  change: () => Promise<T>,
): Promise<T> {
  if (!notifier || productIds.length === 0) return change();
  const unique = [...new Set(productIds)];
  const before = await repository.getStock(warehouseId, unique);
  const wasEmpty = new Set(
    unique.filter((id) => (before.find((s) => s.productId === id)?.available ?? 0) <= 0),
  );
  const result = await change();
  if (wasEmpty.size === 0) return result;
  const after = await repository.getStock(warehouseId, [...wasEmpty]);
  const back = after.filter((s) => s.available > 0).map((s) => s.productId);
  if (back.length > 0) notifier(warehouseId, back);
  return result;
}
