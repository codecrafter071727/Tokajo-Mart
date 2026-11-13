import type {
  Reservation,
  ResolveResponse,
  StockLine,
  StockMovement,
  StockRow,
} from "@qc/contracts";
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
  NotFoundError,
  ReservationStateError,
  StockChangeError,
  WarehouseClosedError,
  WarehouseExistsError,
} from "./errors";

export type ServingWarehouse = { warehouse: Warehouse; distanceKm: number };

export type ReserveInput = {
  warehouseId: string;
  reference: string;
  items: StockLine[];
  ttlSeconds: number;
  now: Date;
};

export type StockListFilter = { warehouseId: string; q?: string; limit: number; offset: number };
export type StockPage = { items: StockRow[]; nextOffset: number | null };
export type MovementFilter = {
  warehouseId: string;
  productId?: string;
  limit: number;
  /** Only rows with an id below this, for paging newest first */
  beforeId?: number;
};
export type MovementPage = { items: StockMovement[]; nextBeforeId: number | null };

/** A received line. With an expiry date it is also recorded as a batch. */
export type ReceiveLine = StockLine & { expiresOn?: string; batchCode?: string };

export type ReceiveInput = {
  warehouseId: string;
  reference?: string;
  items: ReceiveLine[];
  actorId: string | null;
};

/** A received batch with what is on hand for its product now (selling does not touch batches). */
export type BatchRecord = {
  id: string;
  warehouseId: string;
  productId: string;
  batchCode: string | null;
  quantity: number;
  /** YYYY-MM-DD */
  expiresOn: string;
  receivedAt: string;
  onHand: number;
};
export type AdjustInput = {
  warehouseId: string;
  productId: string;
  type: "adjustment" | "damage" | "expiry";
  quantityDelta: number;
  reason: string;
  actorId: string | null;
};
export type WarehousePatch = Partial<Omit<Warehouse, "id">>;

/** The message for a removal that would take stock below what is held for orders. */
export const removalMessage = (remove: number, onHand: number, reserved: number) =>
  `Cannot remove ${remove}: ${onHand - reserved} free (${onHand} on hand, ${reserved} held for orders).`;

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
  /** Stock rows of one warehouse, by product id. */
  listStock(filter: StockListFilter): Promise<StockPage>;
  /** One product's stock row in every warehouse that holds it, by warehouse id */
  stockByProduct(productId: string): Promise<StockRow[]>;
  /** Add received stock for every line or none. Creates a stock row for a new product. */
  receiveStock(input: ReceiveInput): Promise<StockRow[]>;
  /** Correct, write off or expire stock. Never goes below zero or below what is held. */
  adjustStock(input: AdjustInput): Promise<StockRow>;
  /** Change the per order limit or rack location. Null when the product has no stock row. */
  updateStockSettings(
    warehouseId: string,
    productId: string,
    patch: { maxPerOrder?: number | null; rackLocation?: string | null },
  ): Promise<StockRow | null>;
  /** The stock ledger, newest first. */
  listMovements(filter: MovementFilter): Promise<MovementPage>;
  createWarehouse(warehouse: Warehouse): Promise<Warehouse>;
  updateWarehouse(id: string, patch: WarehousePatch): Promise<Warehouse | null>;
  /** Release every hold whose time is up. Returns how many were released. */
  expireDue(now: Date): Promise<number>;
  /** Every stock row of one warehouse, or of all of them (for alerts) */
  allStock(warehouseId?: string): Promise<StockRow[]>;
  /** Batches expiring on or before a date (YYYY-MM-DD), soonest first */
  listBatches(filter: { warehouseId?: string; expiresOnOrBefore: string }): Promise<BatchRecord[]>;
  /** Which products a reservation covers, to tell who was waiting when its stock comes back */
  reservationLines(reference: string): Promise<{ warehouseId: string; lines: StockLine[] } | null>;
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

type MemoryStock = {
  onHand: number;
  reserved: number;
  maxPerOrder: number | null;
  rackLocation: string | null;
  updatedAt: string;
};
type MemoryReservation = Reservation & { lines: StockLine[] };

export function createInMemoryInventoryRepository(
  warehouses: Warehouse[],
  stock: StockRecord[],
): InventoryRepository {
  const items = new Map<string, MemoryStock>(
    stock.map((s) => [
      `${s.warehouseId}/${s.productId}`,
      {
        onHand: s.available,
        reserved: 0,
        maxPerOrder: s.maxPerOrder,
        rackLocation: null,
        updatedAt: new Date(0).toISOString(),
      },
    ]),
  );
  const ledger: StockMovement[] = [];
  const record = (
    warehouseId: string,
    productId: string,
    type: StockMovement["type"],
    quantityDelta: number,
    extra: { reason?: string | null; reference?: string | null; actorId?: string | null } = {},
  ) => {
    ledger.push({
      id: String(ledger.length + 1),
      warehouseId,
      productId,
      type,
      quantityDelta,
      reason: extra.reason ?? null,
      reference: extra.reference ?? null,
      actorId: extra.actorId ?? null,
      createdAt: new Date().toISOString(),
    });
  };
  const row = (warehouseId: string, productId: string, s: MemoryStock): StockRow => ({
    productId,
    warehouseId,
    onHand: s.onHand,
    reserved: s.reserved,
    available: s.onHand - s.reserved,
    maxPerOrder: s.maxPerOrder,
    rackLocation: s.rackLocation,
    updatedAt: s.updatedAt,
  });
  const reservations = new Map<string, MemoryReservation>();
  const key = (warehouseId: string, productId: string) => `${warehouseId}/${productId}`;
  const batches: Omit<BatchRecord, "onHand">[] = [];

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
        record(r.warehouseId, line.productId, "sale", -line.quantity, { reference });
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

    async listStock({ warehouseId, q, limit, offset }) {
      const needle = q?.toLowerCase();
      const all = [...items]
        .filter(([k]) => k.startsWith(`${warehouseId}/`))
        .map(([k, s]) => row(warehouseId, k.slice(warehouseId.length + 1), s))
        .filter((r) => !needle || r.productId.toLowerCase().includes(needle))
        .sort((a, b) => a.productId.localeCompare(b.productId, "en", { numeric: true }));
      const page = all.slice(offset, offset + limit);
      return { items: page, nextOffset: offset + limit < all.length ? offset + limit : null };
    },

    async stockByProduct(productId) {
      return [...items]
        .filter(([k]) => k.split("/")[1] === productId)
        .map(([k, s]) => row(k.split("/")[0]!, productId, s))
        .sort((a, b) => a.warehouseId.localeCompare(b.warehouseId));
    },

    async receiveStock({ warehouseId, reference, items: lines, actorId }) {
      for (const line of lines) {
        if (!line.expiresOn) continue;
        batches.push({
          id: `batch-${batches.length + 1}`,
          warehouseId,
          productId: line.productId,
          batchCode: line.batchCode ?? null,
          quantity: line.quantity,
          expiresOn: line.expiresOn,
          receivedAt: new Date().toISOString(),
        });
      }
      const merged = mergeLines(lines);
      const now = new Date().toISOString();
      for (const line of merged) {
        const k = key(warehouseId, line.productId);
        const s = items.get(k) ?? {
          onHand: 0,
          reserved: 0,
          maxPerOrder: null,
          rackLocation: null,
          updatedAt: now,
        };
        s.onHand += line.quantity;
        s.updatedAt = now;
        items.set(k, s);
        record(warehouseId, line.productId, "grn", line.quantity, { reference, actorId });
      }
      return merged.map((l) =>
        row(warehouseId, l.productId, items.get(key(warehouseId, l.productId))!),
      );
    },

    async adjustStock({ warehouseId, productId, type, quantityDelta, reason, actorId }) {
      const s = items.get(key(warehouseId, productId));
      if (!s) throw new NotFoundError("That product has no stock record in this warehouse.");
      if (s.onHand + quantityDelta < s.reserved) {
        throw new StockChangeError(removalMessage(-quantityDelta, s.onHand, s.reserved));
      }
      s.onHand += quantityDelta;
      s.updatedAt = new Date().toISOString();
      record(warehouseId, productId, type, quantityDelta, { reason, actorId });
      return row(warehouseId, productId, s);
    },

    async updateStockSettings(warehouseId, productId, patch) {
      const s = items.get(key(warehouseId, productId));
      if (!s) return null;
      if (patch.maxPerOrder !== undefined) s.maxPerOrder = patch.maxPerOrder;
      if (patch.rackLocation !== undefined) s.rackLocation = patch.rackLocation || null;
      s.updatedAt = new Date().toISOString();
      return row(warehouseId, productId, s);
    },

    async listMovements({ warehouseId, productId, limit, beforeId }) {
      const rows = ledger
        .filter((m) => m.warehouseId === warehouseId)
        .filter((m) => !productId || m.productId === productId)
        .filter((m) => beforeId === undefined || Number(m.id) < beforeId)
        .sort((a, b) => Number(b.id) - Number(a.id));
      const page = rows.slice(0, limit);
      return {
        items: page,
        nextBeforeId: rows.length > limit ? Number(page[page.length - 1]!.id) : null,
      };
    },

    async createWarehouse(warehouse) {
      if (warehouses.some((w) => w.id === warehouse.id))
        throw new WarehouseExistsError(warehouse.id);
      warehouses.push({ ...warehouse });
      return { ...warehouse };
    },

    async updateWarehouse(id, patch) {
      const w = warehouses.find((x) => x.id === id);
      if (!w) return null;
      Object.assign(w, patch);
      return { ...w };
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
        record(r.warehouseId, line.productId, "return", line.quantity, { reference });
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

    async allStock(warehouseId) {
      return [...items]
        .map(([k, s]) => ({ w: k.split("/")[0]!, p: k.split("/")[1]!, s }))
        .filter(({ w }) => !warehouseId || w === warehouseId)
        .map(({ w, p, s }) => row(w, p, s))
        .sort(
          (a, b) =>
            a.warehouseId.localeCompare(b.warehouseId) || a.productId.localeCompare(b.productId),
        );
    },

    async listBatches({ warehouseId, expiresOnOrBefore }) {
      return batches
        .filter(
          (b) =>
            (!warehouseId || b.warehouseId === warehouseId) && b.expiresOn <= expiresOnOrBefore,
        )
        .map((b) => ({ ...b, onHand: items.get(key(b.warehouseId, b.productId))?.onHand ?? 0 }))
        .sort(
          (a, b) =>
            a.expiresOn.localeCompare(b.expiresOn) || a.productId.localeCompare(b.productId),
        );
    },

    async reservationLines(reference) {
      const r = reservations.get(reference);
      return r ? { warehouseId: r.warehouseId, lines: r.lines } : null;
    },
  };
  return repo;
}
