import type { Reservation } from "@qc/contracts";
import { sql, type Kysely, type Transaction } from "kysely";
import type { DB } from "../../db/types.generated";
import { type StockRecord, type Warehouse } from "./domain";
import { ReservationStateError, WarehouseClosedError } from "./errors";
import { checkLines, mergeLines, type InventoryRepository } from "./repository";

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
  };
  return repo;
}
