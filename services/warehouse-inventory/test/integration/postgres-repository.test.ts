import { afterAll, describe, expect, it } from "vitest";
import { createDb } from "@qc/service-kit";
import { sql } from "kysely";
import type { DB } from "../../src/db/types.generated";
import {
  createPostgresInventoryRepository,
  InsufficientStockError,
  seedStock,
} from "../../src/modules/inventory";
import { inventoryRepositoryContract } from "../shared/inventory-repository.contract";

// Runs only when a migrated and seeded test database is available (see scripts/db-migrate.mjs).
const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

suite("Postgres inventory repository", () => {
  const db = createDb<DB>(url as string, 10);
  afterAll(async () => {
    await db.destroy();
  });

  /** Put stock back to the seeded numbers so every test starts from the same place. */
  async function fresh() {
    await db.deleteFrom("inventory.reservations").execute(); // lines go with them
    await db.deleteFrom("inventory.stockMovements").execute();
    await db.deleteFrom("inventory.stockItems").where("productId", "=", "brand-new").execute();
    await db.deleteFrom("inventory.warehouses").where("id", "like", "wh-test-%").execute();
    for (const s of seedStock) {
      await db
        .updateTable("inventory.stockItems")
        .set({ onHand: s.available, reserved: 0, maxPerOrder: s.maxPerOrder, rackLocation: null })
        .where("warehouseId", "=", s.warehouseId)
        .where("productId", "=", s.productId)
        .execute();
    }
    return createPostgresInventoryRepository(db);
  }

  inventoryRepositoryContract("postgres", fresh);

  it("lets exactly as many buyers win as there is stock when they all race", async () => {
    const repo = await fresh();
    // p3 has 2 in stock. Five customers try to take 1 each at the same moment.
    const results = await Promise.allSettled(
      [1, 2, 3, 4, 5].map((n) =>
        repo.reserve({
          warehouseId: "wh-noida-62",
          reference: `race-${n}`,
          items: [{ productId: "p3", quantity: 1 }],
          ttlSeconds: 600,
          now: new Date(),
        }),
      ),
    );
    const won = results.filter((r) => r.status === "fulfilled");
    const lost = results.filter((r) => r.status === "rejected");
    expect(won).toHaveLength(2);
    expect(lost).toHaveLength(3);
    expect(
      lost.every((r) => (r as PromiseRejectedResult).reason instanceof InsufficientStockError),
    ).toBe(true);

    const row = await db
      .selectFrom("inventory.stockItems")
      .select(["onHand", "reserved"])
      .where("productId", "=", "p3")
      .where("warehouseId", "=", "wh-noida-62")
      .executeTakeFirstOrThrow();
    expect(row).toEqual({ onHand: 2, reserved: 2 });
  });

  it("writes one ledger row per sold line, with the order reference", async () => {
    const repo = await fresh();
    await repo.reserve({
      warehouseId: "wh-noida-62",
      reference: "ledger-1",
      items: [
        { productId: "p1", quantity: 2 },
        { productId: "p2", quantity: 1 },
      ],
      ttlSeconds: 600,
      now: new Date(),
    });
    await repo.commit("ledger-1");
    const rows = await db
      .selectFrom("inventory.stockMovements")
      .select(["productId", "type", "quantityDelta", "reference"])
      .orderBy("productId")
      .execute();
    expect(rows).toEqual([
      { productId: "p1", type: "sale", quantityDelta: -2, reference: "ledger-1" },
      { productId: "p2", type: "sale", quantityDelta: -1, reference: "ledger-1" },
    ]);
  });

  it("is protected by the database itself: reserved can never exceed on hand", async () => {
    await fresh();
    await expect(
      db
        .updateTable("inventory.stockItems")
        .set({ reserved: sql`on_hand + 1` })
        .where("productId", "=", "p1")
        .where("warehouseId", "=", "wh-noida-62")
        .execute(),
    ).rejects.toThrow(/stock_reserved_within_on_hand/);
  });
});
