import type { Reservation, StockMovement, StockRow } from "@qc/contracts";
import { sql, type Kysely, type Transaction } from "kysely";
import type { DB } from "../../db/types.generated";
import { type StockRecord, type Warehouse } from "./domain";
import {
  NotFoundError,
  ReservationStateError,
  StockChangeError,
  WarehouseClosedError,
  WarehouseExistsError,
} from "./errors";
import { checkLines, mergeLines, removalMessage, type InventoryRepository } from "./repository";
import { emptySetup, normalisePincodes, type ClosureRange } from "./schedule";

type Reader = Kysely<DB> | Transaction<DB>;

const toReservation = (row: {
  id: string;
  warehouseId: string;
  reference: string;
  status: string;
  expiresAt: Date | string;
}): Reservation => ({
  id: row.id,
  warehouseId: row.warehouseId,
  reference: row.reference,
  status: row.status as Reservation["status"],
  expiresAt: new Date(row.expiresAt).toISOString(),
});

async function readStock(
  db: Reader,
  warehouseId: string,
  productIds: string[],
): Promise<StockRecord[]> {
  if (productIds.length === 0) return [];
  const rows = await db
    .selectFrom("inventory.stockItems")
    .select([
      "productId",
      "warehouseId",
      "maxPerOrder",
      sql<number>`on_hand - reserved`.as("available"),
    ])
    .where("warehouseId", "=", warehouseId)
    .where("productId", "in", productIds)
    .execute();
  return rows.map((r) => ({
    productId: r.productId,
    warehouseId: r.warehouseId,
    available: Number(r.available),
    maxPerOrder: r.maxPerOrder,
  }));
}

const escapeLike = (value: string) => value.replace(/[\\%_]/g, (c) => `\\${c}`);

const STOCK_COLUMNS = [
  "productId",
  "warehouseId",
  "onHand",
  "reserved",
  "maxPerOrder",
  "rackLocation",
  "updatedAt",
] as const;

const toStockRow = (r: {
  productId: string;
  warehouseId: string;
  onHand: number;
  reserved: number;
  maxPerOrder: number | null;
  rackLocation: string | null;
  updatedAt: Date | string;
}): StockRow => ({
  productId: r.productId,
  warehouseId: r.warehouseId,
  onHand: r.onHand,
  reserved: r.reserved,
  available: r.onHand - r.reserved,
  maxPerOrder: r.maxPerOrder,
  rackLocation: r.rackLocation,
  updatedAt: new Date(r.updatedAt).toISOString(),
});

const toWarehouse = (r: {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radiusKm: string | number;
  open: boolean;
}): Warehouse => ({
  id: r.id,
  name: r.name,
  lat: r.lat,
  lng: r.lng,
  radiusKm: Number(r.radiusKm),
  open: r.open,
});

async function linesOf(db: Reader, reservationId: string) {
  return db
    .selectFrom("inventory.reservationLines")
    .select(["productId", "quantity"])
    .where("reservationId", "=", reservationId)
    .orderBy("productId")
    .execute();
}

/**
 * Inventory in Postgres. Every stock change is one conditional UPDATE, so two buyers racing for the
 * last item cannot both win, and a failed reservation rolls back completely.
 */
export function createPostgresInventoryRepository(db: Kysely<DB>): InventoryRepository {
  const repo: InventoryRepository = {
    async listWarehouses() {
      const rows = await db
        .selectFrom("inventory.warehouses")
        .select(["id", "name", "lat", "lng", "radiusKm", "open"])
        .orderBy("id")
        .execute();
      return rows.map((r): Warehouse => ({
        id: r.id,
        name: r.name,
        lat: r.lat,
        lng: r.lng,
        radiusKm: Number(r.radiusKm),
        open: r.open,
      }));
    },

    async getWarehouse(id) {
      return (await repo.listWarehouses()).find((w) => w.id === id) ?? null;
    },

    getStock: (warehouseId, productIds) => readStock(db, warehouseId, productIds),

    async reserve({ warehouseId, reference, items, ttlSeconds, now }) {
      return db.transaction().execute(async (trx) => {
        const lines = mergeLines(items);

        // A repeat of the same request returns the same hold
        const inserted = await trx
          .insertInto("inventory.reservations")
          .values({
            warehouseId,
            reference,
            expiresAt: new Date(now.getTime() + ttlSeconds * 1000),
          })
          .onConflict((oc) => oc.column("reference").doNothing())
          .returning(["id", "warehouseId", "reference", "status", "expiresAt"])
          .executeTakeFirst();

        if (!inserted) {
          const existing = await trx
            .selectFrom("inventory.reservations")
            .select(["id", "warehouseId", "reference", "status", "expiresAt"])
            .where("reference", "=", reference)
            .executeTakeFirstOrThrow();
          return toReservation(existing);
        }

        const warehouse = await trx
          .selectFrom("inventory.warehouses")
          .select("open")
          .where("id", "=", warehouseId)
          .executeTakeFirst();
        if (!warehouse?.open) throw new WarehouseClosedError();

        // Friendly errors that name the exact products. The UPDATEs below stay the real guard.
        const current = new Map(
          (
            await readStock(
              trx,
              warehouseId,
              lines.map((l) => l.productId),
            )
          ).map((s) => [s.productId, s]),
        );
        const { short, overLimit } = checkLines(lines, current);
        if (overLimit) throw overLimit;
        if (short) throw short;

        // Sorted, so two orders touching the same products always lock rows in the same order
        for (const line of [...lines].sort((a, b) => a.productId.localeCompare(b.productId))) {
          const held = await trx
            .updateTable("inventory.stockItems")
            .set({ reserved: sql`reserved + ${line.quantity}` })
            .where("warehouseId", "=", warehouseId)
            .where("productId", "=", line.productId)
            .where(sql<boolean>`on_hand - reserved >= ${line.quantity}`)
            .returning("productId")
            .executeTakeFirst();
          if (!held) {
            // Someone else took the stock between the check and the update: report the truth now
            const now2 = new Map(
              (await readStock(trx, warehouseId, [line.productId])).map((s) => [s.productId, s]),
            );
            const { short: lost } = checkLines([line], now2);
            throw lost ?? new Error("Reservation failed.");
          }
        }

        await trx
          .insertInto("inventory.reservationLines")
          .values(
            lines.map((l) => ({
              reservationId: inserted.id,
              productId: l.productId,
              quantity: l.quantity,
            })),
          )
          .execute();
        return toReservation(inserted);
      });
    },

    async commit(reference) {
      return db.transaction().execute(async (trx) => {
        const row = await trx
          .updateTable("inventory.reservations")
          .set({ status: "committed" })
          .where("reference", "=", reference)
          .where("status", "=", "held")
          .returning(["id", "warehouseId", "reference", "status", "expiresAt"])
          .executeTakeFirst();

        if (!row) {
          const existing = await trx
            .selectFrom("inventory.reservations")
            .select(["id", "warehouseId", "reference", "status", "expiresAt"])
            .where("reference", "=", reference)
            .executeTakeFirst();
          if (!existing) return null;
          if (existing.status === "committed") return toReservation(existing);
          throw new ReservationStateError(`A ${existing.status} reservation cannot be committed.`);
        }

        for (const line of await linesOf(trx, row.id)) {
          await trx
            .updateTable("inventory.stockItems")
            .set({
              onHand: sql`on_hand - ${line.quantity}`,
              reserved: sql`reserved - ${line.quantity}`,
            })
            .where("warehouseId", "=", row.warehouseId)
            .where("productId", "=", line.productId)
            .execute();
          await trx
            .insertInto("inventory.stockMovements")
            .values({
              warehouseId: row.warehouseId,
              productId: line.productId,
              type: "sale",
              quantityDelta: -line.quantity,
              reference,
            })
            .execute();
        }
        return toReservation(row);
      });
    },

    async release(reference, as = "released") {
      return db.transaction().execute(async (trx) => {
        const row = await trx
          .updateTable("inventory.reservations")
          .set({ status: as })
          .where("reference", "=", reference)
          .where("status", "=", "held")
          .returning(["id", "warehouseId", "reference", "status", "expiresAt"])
          .executeTakeFirst();

        if (!row) {
          const existing = await trx
            .selectFrom("inventory.reservations")
            .select(["id", "warehouseId", "reference", "status", "expiresAt"])
            .where("reference", "=", reference)
            .executeTakeFirst();
          if (!existing) return null;
          if (existing.status === "released" || existing.status === "expired")
            return toReservation(existing);
          throw new ReservationStateError("A committed reservation cannot be released.");
        }

        for (const line of await linesOf(trx, row.id)) {
          await trx
            .updateTable("inventory.stockItems")
            .set({ reserved: sql`reserved - ${line.quantity}` })
            .where("warehouseId", "=", row.warehouseId)
            .where("productId", "=", line.productId)
            .execute();
        }
        return toReservation(row);
      });
    },

    async listStock({ warehouseId, q, limit, offset }) {
      let query = db
        .selectFrom("inventory.stockItems")
        .select([...STOCK_COLUMNS])
        .where("warehouseId", "=", warehouseId);
      if (q) query = query.where("productId", "ilike", `%${escapeLike(q)}%`);
      const rows = await query
        // Numeric aware: p2 before p10
        .orderBy(sql`regexp_replace(product_id, '[0-9]+', '', 'g')`)
        .orderBy(sql`nullif(regexp_replace(product_id, '[^0-9]', '', 'g'), '')::numeric`)
        .orderBy("productId")
        .limit(limit + 1)
        .offset(offset)
        .execute();
      return {
        items: rows.slice(0, limit).map(toStockRow),
        nextOffset: rows.length > limit ? offset + limit : null,
      };
    },

    async stockByProduct(productId) {
      const rows = await db
        .selectFrom("inventory.stockItems")
        .select([...STOCK_COLUMNS])
        .where("productId", "=", productId)
        .orderBy("warehouseId")
        .execute();
      return rows.map(toStockRow);
    },

    async receiveStock({ warehouseId, reference, items, actorId }) {
      const lines = mergeLines(items);
      return db.transaction().execute(async (trx) => {
        const dated = items.filter((line) => line.expiresOn);
        if (dated.length > 0) {
          await trx
            .insertInto("inventory.batches")
            .values(
              dated.map((line) => ({
                warehouseId,
                productId: line.productId,
                batchCode: line.batchCode ?? null,
                quantity: line.quantity,
                expiresOn: line.expiresOn as string,
                actorId,
              })),
            )
            .execute();
        }
        const out: StockRow[] = [];
        for (const line of lines) {
          const row = await trx
            .insertInto("inventory.stockItems")
            .values({ warehouseId, productId: line.productId, onHand: line.quantity })
            .onConflict((oc) =>
              oc.columns(["warehouseId", "productId"]).doUpdateSet({
                onHand: sql`inventory.stock_items.on_hand + ${line.quantity}`,
              }),
            )
            .returning([...STOCK_COLUMNS])
            .executeTakeFirstOrThrow();
          await trx
            .insertInto("inventory.stockMovements")
            .values({
              warehouseId,
              productId: line.productId,
              type: "grn",
              quantityDelta: line.quantity,
              reference: reference ?? null,
              actorId,
            })
            .execute();
          out.push(toStockRow(row));
        }
        return out;
      });
    },

    async adjustStock({ warehouseId, productId, type, quantityDelta, reason, actorId }) {
      return db.transaction().execute(async (trx) => {
        // One conditional UPDATE: the new on hand must stay at or above what is held for orders
        const updated = await trx
          .updateTable("inventory.stockItems")
          .set({ onHand: sql`on_hand + ${quantityDelta}` })
          .where("warehouseId", "=", warehouseId)
          .where("productId", "=", productId)
          .where(sql<boolean>`on_hand + ${quantityDelta} >= reserved`)
          .where(sql<boolean>`on_hand + ${quantityDelta} >= 0`)
          .returning([...STOCK_COLUMNS])
          .executeTakeFirst();
        if (!updated) {
          const current = await trx
            .selectFrom("inventory.stockItems")
            .select(["onHand", "reserved"])
            .where("warehouseId", "=", warehouseId)
            .where("productId", "=", productId)
            .executeTakeFirst();
          if (!current)
            throw new NotFoundError("That product has no stock record in this warehouse.");
          throw new StockChangeError(
            removalMessage(-quantityDelta, current.onHand, current.reserved),
          );
        }
        await trx
          .insertInto("inventory.stockMovements")
          .values({ warehouseId, productId, type, quantityDelta, reason, actorId })
          .execute();
        return toStockRow(updated);
      });
    },

    async updateStockSettings(warehouseId, productId, patch) {
      const set: { maxPerOrder?: number | null; rackLocation?: string | null } = {};
      if (patch.maxPerOrder !== undefined) set.maxPerOrder = patch.maxPerOrder;
      if (patch.rackLocation !== undefined) set.rackLocation = patch.rackLocation || null;
      const row = await db
        .updateTable("inventory.stockItems")
        .set(set)
        .where("warehouseId", "=", warehouseId)
        .where("productId", "=", productId)
        .returning([...STOCK_COLUMNS])
        .executeTakeFirst();
      return row ? toStockRow(row) : null;
    },

    async listMovements({ warehouseId, productId, limit, beforeId }) {
      let query = db
        .selectFrom("inventory.stockMovements")
        .selectAll()
        .where("warehouseId", "=", warehouseId);
      if (productId) query = query.where("productId", "=", productId);
      if (beforeId !== undefined) query = query.where("id", "<", String(beforeId));
      const rows = await query
        .orderBy("id", "desc")
        .limit(limit + 1)
        .execute();
      const page = rows.slice(0, limit).map((m): StockMovement => ({
        id: String(m.id),
        warehouseId: m.warehouseId,
        productId: m.productId,
        type: m.type as StockMovement["type"],
        quantityDelta: m.quantityDelta,
        reason: m.reason,
        reference: m.reference,
        actorId: m.actorId,
        createdAt: new Date(m.createdAt).toISOString(),
      }));
      return {
        items: page,
        nextBeforeId: rows.length > limit ? Number(page[page.length - 1]!.id) : null,
      };
    },

    async createWarehouse(warehouse) {
      try {
        const row = await db
          .insertInto("inventory.warehouses")
          .values({
            id: warehouse.id,
            name: warehouse.name,
            lat: warehouse.lat,
            lng: warehouse.lng,
            radiusKm: warehouse.radiusKm,
            open: warehouse.open,
          })
          .returning(["id", "name", "lat", "lng", "radiusKm", "open"])
          .executeTakeFirstOrThrow();
        return toWarehouse(row);
      } catch (error) {
        if ((error as { code?: string }).code === "23505")
          throw new WarehouseExistsError(warehouse.id);
        throw error;
      }
    },

    async updateWarehouse(id, patch) {
      if (Object.keys(patch).length === 0) return repo.getWarehouse(id);
      const row = await db
        .updateTable("inventory.warehouses")
        .set(patch)
        .where("id", "=", id)
        .returning(["id", "name", "lat", "lng", "radiusKm", "open"])
        .executeTakeFirst();
      return row ? toWarehouse(row) : null;
    },

    async restock(reference) {
      return db.transaction().execute(async (trx) => {
        const row = await trx
          .updateTable("inventory.reservations")
          .set({ status: "released" })
          .where("reference", "=", reference)
          .where("status", "=", "committed")
          .returning(["id", "warehouseId", "reference", "status", "expiresAt"])
          .executeTakeFirst();
        if (!row) {
          // Not sold: still only held, already given back, or unknown. release() covers all three
          return repo.release(reference);
        }
        for (const line of await linesOf(trx, row.id)) {
          await trx
            .updateTable("inventory.stockItems")
            .set({ onHand: sql`on_hand + ${line.quantity}` })
            .where("warehouseId", "=", row.warehouseId)
            .where("productId", "=", line.productId)
            .execute();
          await trx
            .insertInto("inventory.stockMovements")
            .values({
              warehouseId: row.warehouseId,
              productId: line.productId,
              type: "return",
              quantityDelta: line.quantity,
              reference,
            })
            .execute();
        }
        return toReservation(row);
      });
    },

    async allStock(warehouseId) {
      let query = db.selectFrom("inventory.stockItems").select([...STOCK_COLUMNS]);
      if (warehouseId) query = query.where("warehouseId", "=", warehouseId);
      const rows = await query.orderBy("warehouseId").orderBy("productId").execute();
      return rows.map(toStockRow);
    },

    async listBatches({ warehouseId, expiresOnOrBefore }) {
      let query = db
        .selectFrom("inventory.batches as b")
        .leftJoin("inventory.stockItems as s", (join) =>
          join
            .onRef("s.warehouseId", "=", "b.warehouseId")
            .onRef("s.productId", "=", "b.productId"),
        )
        .select([
          "b.id",
          "b.warehouseId",
          "b.productId",
          "b.batchCode",
          "b.quantity",
          "b.receivedAt",
          // As text, so a date never shifts with the server's time zone
          sql<string>`to_char(b.expires_on, 'YYYY-MM-DD')`.as("expiresOn"),
          sql<number>`coalesce(s.on_hand, 0)`.as("onHand"),
        ])
        .where(sql<boolean>`b.expires_on <= ${expiresOnOrBefore}::date`);
      if (warehouseId) query = query.where("b.warehouseId", "=", warehouseId);
      const rows = await query.orderBy("b.expiresOn").orderBy("b.productId").execute();
      return rows.map((r) => ({
        ...r,
        onHand: Number(r.onHand),
        receivedAt: new Date(r.receivedAt).toISOString(),
      }));
    },

    async reservationLines(reference) {
      const reservation = await db
        .selectFrom("inventory.reservations")
        .select(["id", "warehouseId"])
        .where("reference", "=", reference)
        .executeTakeFirst();
      if (!reservation) return null;
      const lines = await linesOf(db, reservation.id);
      return { warehouseId: reservation.warehouseId, lines };
    },

    async expireDue(now) {
      const due = await db
        .selectFrom("inventory.reservations")
        .select("reference")
        .where("status", "=", "held")
        .where("expiresAt", "<=", now)
        .execute();
      let count = 0;
      for (const { reference } of due) {
        const result = await repo.release(reference, "expired");
        if (result?.status === "expired") count += 1;
      }
      return count;
    },

    async getServiceSetup() {
      const [areas, hours, closures] = await Promise.all([
        db
          .selectFrom("inventory.serviceAreas")
          .select(["warehouseId", "pincode"])
          .where("active", "=", true)
          .execute(),
        db
          .selectFrom("inventory.warehouseHours")
          .select([
            "warehouseId",
            "weekday",
            sql<string>`to_char(opens_at, 'HH24:MI')`.as("opensAt"),
            sql<string>`to_char(closes_at, 'HH24:MI')`.as("closesAt"),
          ])
          .orderBy("weekday")
          .execute(),
        // Closures that ended long ago do not matter for the next opening
        db
          .selectFrom("inventory.warehouseClosures")
          .select([
            "id",
            "warehouseId",
            "reason",
            "createdAt",
            sql<string>`to_char(starts_on, 'YYYY-MM-DD')`.as("startsOn"),
            sql<string>`to_char(ends_on, 'YYYY-MM-DD')`.as("endsOn"),
          ])
          .where(sql<boolean>`ends_on >= current_date - 2`)
          .orderBy("startsOn")
          .execute(),
      ]);
      const setup = emptySetup();
      for (const a of areas) {
        const set = setup.pincodes.get(a.warehouseId) ?? new Set<string>();
        set.add(a.pincode);
        setup.pincodes.set(a.warehouseId, set);
      }
      for (const h of hours) {
        setup.hours.set(h.warehouseId, [
          ...(setup.hours.get(h.warehouseId) ?? []),
          { weekday: h.weekday, opensAt: h.opensAt, closesAt: h.closesAt },
        ]);
      }
      for (const c of closures) {
        const range: ClosureRange = {
          id: c.id,
          startsOn: c.startsOn,
          endsOn: c.endsOn,
          reason: c.reason,
          createdAt: new Date(c.createdAt).toISOString(),
        };
        setup.closures.set(c.warehouseId, [...(setup.closures.get(c.warehouseId) ?? []), range]);
      }
      return setup;
    },

    async setPincodes(warehouseId, pincodes) {
      const list = normalisePincodes(pincodes);
      return db.transaction().execute(async (trx) => {
        await assertWarehouse(trx, warehouseId);
        await trx
          .deleteFrom("inventory.serviceAreas")
          .where("warehouseId", "=", warehouseId)
          .execute();
        if (list.length > 0) {
          await trx
            .insertInto("inventory.serviceAreas")
            .values(list.map((pincode) => ({ warehouseId, pincode })))
            .execute();
        }
        return list;
      });
    },

    async setHours(warehouseId, hours) {
      const sorted = [...hours].sort((a, b) => a.weekday - b.weekday);
      return db.transaction().execute(async (trx) => {
        await assertWarehouse(trx, warehouseId);
        await trx
          .deleteFrom("inventory.warehouseHours")
          .where("warehouseId", "=", warehouseId)
          .execute();
        if (sorted.length > 0) {
          await trx
            .insertInto("inventory.warehouseHours")
            .values(
              sorted.map((h) => ({
                warehouseId,
                weekday: h.weekday,
                opensAt: h.opensAt,
                closesAt: h.closesAt,
              })),
            )
            .execute();
        }
        return sorted;
      });
    },

    async addClosure({ warehouseId, startsOn, endsOn, reason }) {
      await assertWarehouse(db, warehouseId);
      const row = await db
        .insertInto("inventory.warehouseClosures")
        .values({ warehouseId, startsOn, endsOn, reason })
        .returning(["id", "createdAt"])
        .executeTakeFirstOrThrow();
      return {
        id: row.id,
        warehouseId,
        startsOn,
        endsOn,
        reason,
        createdAt: new Date(row.createdAt).toISOString(),
      };
    },

    async removeClosure(warehouseId, closureId) {
      const result = await db
        .deleteFrom("inventory.warehouseClosures")
        .where("id", "=", closureId)
        .where("warehouseId", "=", warehouseId)
        .executeTakeFirst();
      return Number(result.numDeletedRows) > 0;
    },
  };
  return repo;
}

async function assertWarehouse(db: Reader, warehouseId: string): Promise<void> {
  const found = await db
    .selectFrom("inventory.warehouses")
    .select("id")
    .where("id", "=", warehouseId)
    .executeTakeFirst();
  if (!found) throw new NotFoundError("Warehouse not found.");
}
