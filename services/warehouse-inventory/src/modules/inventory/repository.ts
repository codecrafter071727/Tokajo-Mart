import type { Reservation, ResolveResponse, StockLine } from "@qc/contracts";
import {
  DEFAULT_MAX_PER_ORDER,
  distanceKm,
  etaMinutes,
  type StockRecord,
  type Warehouse,
} from "./domain";
import {
  InsufficientStockError,
  LimitExceededError,
  ReservationStateError,
  WarehouseClosedError,
} from "./errors";

export type ServingWarehouse = { warehouse: Warehouse; distanceKm: number };

export type ReserveInput = {
  warehouseId: string;
  reference: string;
  items: StockLine[];
  ttlSeconds: number;
  now: Date;
};

/**
 * Data access for the inventory module. The in-memory implementation serves seed data for tests;
 * the Postgres one is used when a database is configured. They share one behaviour contract.
 */
export interface InventoryRepository {
  listWarehouses(): Promise<Warehouse[]>;
  getWarehouse(id: string): Promise<Warehouse | null>;
  /** Available stock (on hand minus reserved) for the given products at one warehouse */
  getStock(warehouseId: string, productIds: string[]): Promise<StockRecord[]>;
  /**
   * Hold stock for an order. Atomic: either every line is held or none is. Sending the same
   * reference again returns the existing hold instead of holding twice.
   */
  reserve(input: ReserveInput): Promise<Reservation>;
  /** Turn a hold into a sale. Safe to repeat. Null when the reference is unknown. */
  commit(reference: string): Promise<Reservation | null>;
  /** Give a hold back (order cancelled, or the hold expired). Safe to repeat. Null when unknown. */
  release(reference: string, as?: "released" | "expired"): Promise<Reservation | null>;
  /** Take a sold order's stock back after a cancellation. Safe to repeat. Null when unknown. */
  restock(reference: string): Promise<Reservation | null>;
  /** Release every hold whose time is up. Returns how many were released. */
  expireDue(now: Date): Promise<number>;
}

// -------------------------------------------------------------------------------------------
// Behaviour that does not depend on where the data lives
// -------------------------------------------------------------------------------------------

/** Merge repeated lines for one product into one, and reject nonsense. */
export function mergeLines(items: StockLine[]): StockLine[] {
  const merged = new Map<string, number>();
  for (const { productId, quantity } of items) {
    merged.set(productId, (merged.get(productId) ?? 0) + quantity);
  }
  return [...merged].map(([productId, quantity]) => ({ productId, quantity }));
}

/** Warehouses whose service area contains the point, nearest first. */
export function coveringWarehouses(
  warehouses: Warehouse[],
  lat: number,
  lng: number,
): ServingWarehouse[] {
  return warehouses
    .map((warehouse) => ({
      warehouse,
      distanceKm: distanceKm(lat, lng, warehouse.lat, warehouse.lng),
    }))
    .filter((entry) => entry.distanceKm <= entry.warehouse.radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

/**
 * Which warehouse should serve this basket? The nearest open warehouse covering the point that
 * has every line available (no split shipments in v1). When none qualifies the answer says why,
 * so the app can show the right message.
 */
export async function resolveBasket(
  repo: InventoryRepository,
  lat: number,
  lng: number,
  items: StockLine[],
): Promise<ResolveResponse> {
  const lines = mergeLines(items);
  const covering = coveringWarehouses(await repo.listWarehouses(), lat, lng);
  const none = {
    serviceable: false,
    warehouseId: null,
    etaMins: null,
    distanceKm: null,
    unavailable: [],
  };

  if (covering.length === 0) return { ...none, reason: "OUTSIDE_SERVICE_AREA" };
  const open = covering.filter((entry) => entry.warehouse.open);
  if (open.length === 0) return { ...none, reason: "WAREHOUSE_CLOSED" };

  let firstShortfall: ResolveResponse["unavailable"] = [];
  for (const entry of open) {
    const stock = new Map(
      (
        await repo.getStock(
          entry.warehouse.id,
          lines.map((l) => l.productId),
        )
      ).map((s) => [s.productId, s]),
    );
    const short = lines.flatMap((line) => {
      const record = stock.get(line.productId);
      const available = record?.available ?? 0;
      const limit = record?.maxPerOrder ?? DEFAULT_MAX_PER_ORDER;
      return available >= line.quantity && line.quantity <= limit
        ? []
        : [
            {
              productId: line.productId,
              requested: line.quantity,
              available: Math.min(available, limit),
            },
          ];
    });
    if (short.length === 0) {
      return {
        serviceable: true,
        warehouseId: entry.warehouse.id,
        etaMins: etaMinutes(entry.distanceKm),
        distanceKm: Math.round(entry.distanceKm * 100) / 100,
        reason: null,
        unavailable: [],
      };
    }
    if (firstShortfall.length === 0) firstShortfall = short;
  }
  return { ...none, reason: "ITEMS_UNAVAILABLE", unavailable: firstShortfall };
}

/** Checks done before touching stock, so the errors can name the exact products. */
export function checkLines(
  lines: StockLine[],
  stock: Map<string, StockRecord>,
): { short: InsufficientStockError | null; overLimit: LimitExceededError | null } {
  const short: { productId: string; requested: number; available: number }[] = [];
  const over: { productId: string; requested: number; maxPerOrder: number }[] = [];
  for (const line of lines) {
    const record = stock.get(line.productId);
    const available = record?.available ?? 0;
    const limit = record?.maxPerOrder ?? DEFAULT_MAX_PER_ORDER;
    if (line.quantity > limit)
      over.push({ productId: line.productId, requested: line.quantity, maxPerOrder: limit });
    else if (available < line.quantity)
      short.push({ productId: line.productId, requested: line.quantity, available });
  }
  return {
    short: short.length > 0 ? new InsufficientStockError(short) : null,
    overLimit: over.length > 0 ? new LimitExceededError(over) : null,
  };
}

// -------------------------------------------------------------------------------------------
// In memory implementation
// -------------------------------------------------------------------------------------------

type MemoryStock = { onHand: number; reserved: number; maxPerOrder: number | null };
type MemoryReservation = Reservation & { lines: StockLine[] };

export function createInMemoryInventoryRepository(
  warehouses: Warehouse[],
  stock: StockRecord[],
): InventoryRepository {
  const items = new Map<string, MemoryStock>(
    stock.map((s) => [
      `${s.warehouseId}/${s.productId}`,
      { onHand: s.available, reserved: 0, maxPerOrder: s.maxPerOrder },
    ]),
  );
  const reservations = new Map<string, MemoryReservation>();
  const key = (warehouseId: string, productId: string) => `${warehouseId}/${productId}`;

  const view = (r: MemoryReservation): Reservation => ({
    id: r.id,
    warehouseId: r.warehouseId,
    reference: r.reference,
    status: r.status,
    expiresAt: r.expiresAt,
  });

  const give = (r: MemoryReservation, as: "released" | "expired") => {
    for (const line of r.lines) {
      const s = items.get(key(r.warehouseId, line.productId));
      if (s) s.reserved -= line.quantity;
    }
    r.status = as;
  };

  const repo: InventoryRepository = {
    async listWarehouses() {
      return warehouses;
    },
    async getWarehouse(id) {
      return warehouses.find((w) => w.id === id) ?? null;
    },
    async getStock(warehouseId, productIds) {
      return productIds.flatMap((productId) => {
        const s = items.get(key(warehouseId, productId));
        return s
          ? [
              {
                productId,
                warehouseId,
                available: s.onHand - s.reserved,
                maxPerOrder: s.maxPerOrder,
              },
            ]
          : [];
      });
    },

    async reserve({ warehouseId, reference, items: requested, ttlSeconds, now }) {
      const existing = reservations.get(reference);
      if (existing) return view(existing);

      const warehouse = warehouses.find((w) => w.id === warehouseId);
      if (!warehouse?.open) throw new WarehouseClosedError();

      const lines = mergeLines(requested);
      const current = new Map(
        (
          await repo.getStock(
            warehouseId,
            lines.map((l) => l.productId),
          )
        ).map((s) => [s.productId, s]),
      );
      const { short, overLimit } = checkLines(lines, current);
      if (overLimit) throw overLimit;
      if (short) throw short;

      for (const line of lines)
        items.get(key(warehouseId, line.productId))!.reserved += line.quantity;
      const reservation: MemoryReservation = {
        id: `r-${reservations.size + 1}`,
        warehouseId,
        reference,
        status: "held",
        expiresAt: new Date(now.getTime() + ttlSeconds * 1000).toISOString(),
        lines,
      };
      reservations.set(reference, reservation);
      return view(reservation);
    },

    async commit(reference) {
      const r = reservations.get(reference);
      if (!r) return null;
      if (r.status === "committed") return view(r);
      if (r.status !== "held")
        throw new ReservationStateError(`A ${r.status} reservation cannot be committed.`);
      for (const line of r.lines) {
        const s = items.get(key(r.warehouseId, line.productId))!;
        s.onHand -= line.quantity;
        s.reserved -= line.quantity;
      }
      r.status = "committed";
      return view(r);
    },

    async release(reference, as = "released") {
      const r = reservations.get(reference);
      if (!r) return null;
      if (r.status === "released" || r.status === "expired") return view(r);
      if (r.status === "committed")
        throw new ReservationStateError("A committed reservation cannot be released.");
      give(r, as);
      return view(r);
    },

    async restock(reference) {
      const r = reservations.get(reference);
      if (!r) return null;
      if (r.status === "released" || r.status === "expired") return view(r);
      if (r.status === "held") {
        give(r, "released");
        return view(r);
      }
      for (const line of r.lines) {
        items.get(key(r.warehouseId, line.productId))!.onHand += line.quantity;
      }
      r.status = "released";
      return view(r);
    },

    async expireDue(now) {
      let count = 0;
      for (const r of reservations.values()) {
        if (r.status === "held" && Date.parse(r.expiresAt) <= now.getTime()) {
          give(r, "expired");
          count += 1;
        }
      }
      return count;
    },
  };
  return repo;
}
