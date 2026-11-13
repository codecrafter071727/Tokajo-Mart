import { describe, expect, it } from "vitest";
import {
  NotFoundError,
  StockChangeError,
  WarehouseExistsError,
  InsufficientStockError,
  LimitExceededError,
  ReservationStateError,
  resolveBasket,
  type InventoryRepository,
} from "../../src/modules/inventory";

const WH = "wh-noida-62";
const NOW = new Date("2026-11-13T10:00:00.000Z");
const reserve = (
  repo: InventoryRepository,
  reference: string,
  items: { productId: string; quantity: number }[],
  ttlSeconds = 600,
) => repo.reserve({ warehouseId: WH, reference, items, ttlSeconds, now: NOW });
const available = async (repo: InventoryRepository, productId: string) =>
  (await repo.getStock(WH, [productId]))[0]!.available;

/**
 * Behaviour every InventoryRepository must have. `make` must return a repository in the seeded
 * starting state every time it is called.
 */
export function inventoryRepositoryContract(
  name: string,
  make: () => Promise<InventoryRepository> | InventoryRepository,
) {
  describe(`InventoryRepository contract: ${name}`, () => {
    it("holds stock for an order", async () => {
      const repo = await make();
      const before = await available(repo, "p1");
      const hold = await reserve(repo, "order-1", [{ productId: "p1", quantity: 2 }]);
      expect(hold).toMatchObject({ warehouseId: WH, reference: "order-1", status: "held" });
      expect(await available(repo, "p1")).toBe(before - 2);
    });

    it("returns the same hold for the same reference and holds the stock only once", async () => {
      const repo = await make();
      const before = await available(repo, "p1");
      const first = await reserve(repo, "order-2", [{ productId: "p1", quantity: 2 }]);
      const second = await reserve(repo, "order-2", [{ productId: "p1", quantity: 2 }]);
      expect(second.id).toBe(first.id);
      expect(await available(repo, "p1")).toBe(before - 2);
    });

    it("adds up repeated lines for one product", async () => {
      const repo = await make();
      const before = await available(repo, "p1");
      await reserve(repo, "order-3", [
        { productId: "p1", quantity: 1 },
        { productId: "p1", quantity: 2 },
      ]);
      expect(await available(repo, "p1")).toBe(before - 3);
    });

    it("is all or nothing: one short line holds nothing and names the product", async () => {
      const repo = await make();
      const before = await available(repo, "p1");
      const error = await reserve(repo, "order-4", [
        { productId: "p1", quantity: 1 },
        { productId: "p15", quantity: 1 },
      ]).catch((e) => e);
      expect(error).toBeInstanceOf(InsufficientStockError);
      expect(error.details).toEqual([{ productId: "p15", requested: 1, available: 0 }]);
      expect(await available(repo, "p1")).toBe(before);
    });

    it("refuses more than the per order limit, naming the limit", async () => {
      const repo = await make();
      const error = await reserve(repo, "order-5", [{ productId: "p6", quantity: 3 }]).catch(
        (e) => e,
      );
      expect(error).toBeInstanceOf(LimitExceededError);
      expect(error.details).toEqual([{ productId: "p6", requested: 3, maxPerOrder: 2 }]);
    });

    it("turns a hold into a sale on commit, and committing twice is harmless", async () => {
      const repo = await make();
      const before = await available(repo, "p1");
      await reserve(repo, "order-6", [{ productId: "p1", quantity: 2 }]);
      expect((await repo.commit("order-6"))?.status).toBe("committed");
      expect((await repo.commit("order-6"))?.status).toBe("committed");
      // The two items are gone for good, not merely held
      expect(await available(repo, "p1")).toBe(before - 2);
    });

    it("gives stock back on release, and releasing twice is harmless", async () => {
      const repo = await make();
      const before = await available(repo, "p1");
      await reserve(repo, "order-7", [{ productId: "p1", quantity: 2 }]);
      expect((await repo.release("order-7"))?.status).toBe("released");
      expect((await repo.release("order-7"))?.status).toBe("released");
      expect(await available(repo, "p1")).toBe(before);
    });

    it("will not release a sold hold or commit a released one", async () => {
      const repo = await make();
      await reserve(repo, "order-8", [{ productId: "p1", quantity: 1 }]);
      await repo.commit("order-8");
      await expect(repo.release("order-8")).rejects.toBeInstanceOf(ReservationStateError);

      await reserve(repo, "order-9", [{ productId: "p1", quantity: 1 }]);
      await repo.release("order-9");
      await expect(repo.commit("order-9")).rejects.toBeInstanceOf(ReservationStateError);
    });

    it("puts a sold order's stock back on restock, and restocking twice is harmless", async () => {
      const repo = await make();
      const before = await available(repo, "p1");
      await reserve(repo, "order-10", [{ productId: "p1", quantity: 2 }]);
      await repo.commit("order-10");
      expect((await repo.restock("order-10"))?.status).toBe("released");
      expect((await repo.restock("order-10"))?.status).toBe("released");
      expect(await available(repo, "p1")).toBe(before);
      // A hold that was never sold is simply released
      await reserve(repo, "order-11", [{ productId: "p1", quantity: 1 }]);
      expect((await repo.restock("order-11"))?.status).toBe("released");
      expect(await available(repo, "p1")).toBe(before);
      expect(await repo.restock("ghost")).toBeNull();
    });

    it("returns null for a reference it has never seen", async () => {
      const repo = await make();
      expect(await repo.commit("ghost")).toBeNull();
      expect(await repo.release("ghost")).toBeNull();
    });

    it("gives back only the holds whose time is up", async () => {
      const repo = await make();
      const before = await available(repo, "p1");
      await reserve(repo, "short", [{ productId: "p1", quantity: 1 }], 30);
      await reserve(repo, "long", [{ productId: "p1", quantity: 2 }], 600);
      const count = await repo.expireDue(new Date(NOW.getTime() + 60_000));
      expect(count).toBe(1);
      expect(await available(repo, "p1")).toBe(before - 2); // only the long hold remains
      expect(await repo.expireDue(new Date(NOW.getTime() + 60_000))).toBe(0);
    });

    it("resolves a basket to the serving warehouse with an ETA", async () => {
      const repo = await make();
      const result = await resolveBasket(repo, 28.628, 77.365, [{ productId: "p1", quantity: 1 }]);
      expect(result).toMatchObject({
        serviceable: true,
        warehouseId: WH,
        reason: null,
        unavailable: [],
      });
      expect(result.etaMins).toBeGreaterThanOrEqual(8);
    });

    it("says why a basket cannot be served: out of stock, or outside the area", async () => {
      const repo = await make();
      const short = await resolveBasket(repo, 28.628, 77.365, [
        { productId: "p1", quantity: 1 },
        { productId: "p15", quantity: 1 },
      ]);
      expect(short).toMatchObject({ serviceable: false, reason: "ITEMS_UNAVAILABLE" });
      expect(short.unavailable.map((u) => u.productId)).toEqual(["p15"]);

      const far = await resolveBasket(repo, 19.076, 72.8777, [{ productId: "p1", quantity: 1 }]);
      expect(far).toMatchObject({
        serviceable: false,
        reason: "OUTSIDE_SERVICE_AREA",
        warehouseId: null,
      });
    });

    describe("stock tools", () => {
      const ACTOR = "99999999-0000-4000-8000-000000000009";

      it("records a batch for lines received with an expiry date, soonest first", async () => {
        const repo = await make();
        await repo.receiveStock({
          warehouseId: WH,
          reference: "GRN-EXP",
          items: [
            { productId: "p2", quantity: 6, expiresOn: "2026-11-20", batchCode: "LOT-A" },
            { productId: "p1", quantity: 4, expiresOn: "2026-11-15" },
            { productId: "p3", quantity: 1 },
          ],
          actorId: ACTOR,
        });
        const soon = await repo.listBatches({ warehouseId: WH, expiresOnOrBefore: "2026-11-16" });
        expect(soon.map((b) => [b.productId, b.expiresOn, b.quantity])).toEqual([
          ["p1", "2026-11-15", 4],
        ]);
        const all = await repo.listBatches({ expiresOnOrBefore: "2026-12-31" });
        expect(all.map((b) => b.productId)).toEqual(["p1", "p2"]);
        expect(all[1]).toMatchObject({ batchCode: "LOT-A", warehouseId: WH });
        expect(all[1]!.onHand).toBeGreaterThanOrEqual(6);
        expect(
          await repo.listBatches({
            warehouseId: "wh-indiranagar",
            expiresOnOrBefore: "2026-12-31",
          }),
        ).toEqual([]);
      });

      it("lists every stock row for alerts and tells which products a reservation covers", async () => {
        const repo = await make();
        const rows = await repo.allStock(WH);
        expect(rows.length).toBeGreaterThan(5);
        expect(rows.every((r) => r.warehouseId === WH)).toBe(true);
        expect((await repo.allStock()).length).toBeGreaterThanOrEqual(rows.length);
        await reserve(repo, "lines-1", [
          { productId: "p1", quantity: 1 },
          { productId: "p2", quantity: 2 },
        ]);
        const lines = await repo.reservationLines("lines-1");
        expect(lines?.warehouseId).toBe(WH);
        expect(lines?.lines.map((l) => l.productId).sort()).toEqual(["p1", "p2"]);
        expect(await repo.reservationLines("ghost")).toBeNull();
      });

      it("lists a warehouse's stock with available worked out, paged and searchable", async () => {
        const repo = await make();
        await reserve(repo, "list-1", [{ productId: "p1", quantity: 2 }]);
        const page = await repo.listStock({ warehouseId: WH, limit: 5, offset: 0 });
        expect(page.items).toHaveLength(5);
        expect(page.nextOffset).toBe(5);
        const p1 = page.items.find((r) => r.productId === "p1")!;
        expect(p1.reserved).toBe(2);
        expect(p1.available).toBe(p1.onHand - 2);
        // Natural order: p2 comes before p10
        const ids = (await repo.listStock({ warehouseId: WH, limit: 20, offset: 0 })).items.map(
          (r) => r.productId,
        );
        expect(ids.indexOf("p2")).toBeLessThan(ids.indexOf("p10"));
        const found = await repo.listStock({ warehouseId: WH, q: "P1", limit: 50, offset: 0 });
        expect(found.items.map((r) => r.productId)).toContain("p10");
        expect(found.items.every((r) => r.productId.toLowerCase().includes("p1"))).toBe(true);
        expect(
          (
            await repo.listStock({ warehouseId: "wh-indiranagar", limit: 50, offset: 0 })
          ).items.every((r) => r.warehouseId === "wh-indiranagar"),
        ).toBe(true);
      });

      it("shows one product in every warehouse that stocks it, and nothing else", async () => {
        const repo = await make();
        await reserve(repo, "by-product-1", [{ productId: "p1", quantity: 1 }]);
        const rows = await repo.stockByProduct("p1");
        expect(rows.length).toBeGreaterThanOrEqual(1);
        expect(rows.every((r) => r.productId === "p1")).toBe(true);
        expect(new Set(rows.map((r) => r.warehouseId)).size).toBe(rows.length);
        const here = rows.find((r) => r.warehouseId === WH)!;
        expect(here.reserved).toBeGreaterThanOrEqual(1);
        expect(here.available).toBe(here.onHand - here.reserved);
        // p1 must not match p10 or p11
        expect(await repo.stockByProduct("p")).toEqual([]);
        expect(await repo.stockByProduct("unknown")).toEqual([]);
      });

      it("receives stock for several lines, creating a row for a new product, and logs each line", async () => {
        const repo = await make();
        const before = await available(repo, "p1");
        const rows = await repo.receiveStock({
          warehouseId: WH,
          reference: "INV-77",
          actorId: ACTOR,
          items: [
            { productId: "p1", quantity: 10 },
            { productId: "p1", quantity: 5 },
            { productId: "brand-new", quantity: 7 },
          ],
        });
        expect(rows.map((r) => [r.productId, r.onHand])).toEqual([
          ["p1", before + 15],
          ["brand-new", 7],
        ]);
        expect(await available(repo, "p1")).toBe(before + 15);
        const log = await repo.listMovements({ warehouseId: WH, limit: 10 });
        expect(
          log.items
            .filter((m) => m.type === "grn")
            .map((m) => [m.productId, m.quantityDelta, m.reference, m.actorId]),
        ).toEqual([
          ["brand-new", 7, "INV-77", ACTOR],
          ["p1", 15, "INV-77", ACTOR],
        ]);
      });

      it("adjusts stock with a reason, and never below what is held or below zero", async () => {
        const repo = await make();
        const start = (
          await repo.listStock({ warehouseId: WH, q: "p1", limit: 50, offset: 0 })
        ).items.find((r) => r.productId === "p1")!;
        await reserve(repo, "adj-1", [{ productId: "p1", quantity: 3 }]);
        const row = await repo.adjustStock({
          warehouseId: WH,
          productId: "p1",
          type: "damage",
          quantityDelta: -2,
          reason: "Crushed in rack",
          actorId: ACTOR,
        });
        expect(row.onHand).toBe(start.onHand - 2);
        expect(row.available).toBe(start.onHand - 2 - 3);

        // Removing everything that is free is fine, one more is not
        const free = row.available;
        const tooMany = await repo
          .adjustStock({
            warehouseId: WH,
            productId: "p1",
            type: "adjustment",
            quantityDelta: -(free + 1),
            reason: "Recount",
            actorId: ACTOR,
          })
          .catch((e) => e);
        expect(tooMany).toBeInstanceOf(StockChangeError);
        expect(tooMany.message).toMatch(/held for orders/);
        const all = await repo.adjustStock({
          warehouseId: WH,
          productId: "p1",
          type: "expiry",
          quantityDelta: -free,
          reason: "Expired",
          actorId: ACTOR,
        });
        expect(all.available).toBe(0);
        expect(all.onHand).toBe(3);

        const up = await repo.adjustStock({
          warehouseId: WH,
          productId: "p1",
          type: "adjustment",
          quantityDelta: 4,
          reason: "Found a box",
          actorId: ACTOR,
        });
        expect(up.onHand).toBe(7);
        await expect(
          repo.adjustStock({
            warehouseId: WH,
            productId: "nope",
            type: "damage",
            quantityDelta: -1,
            reason: "Missing",
            actorId: ACTOR,
          }),
        ).rejects.toBeInstanceOf(NotFoundError);

        const log = (await repo.listMovements({ warehouseId: WH, productId: "p1", limit: 10 }))
          .items;
        expect(log.map((m) => [m.type, m.quantityDelta, m.reason])).toEqual([
          ["adjustment", 4, "Found a box"],
          ["expiry", -free, "Expired"],
          ["damage", -2, "Crushed in rack"],
        ]);
      });

      it("pages the ledger newest first", async () => {
        const repo = await make();
        for (let i = 1; i <= 5; i += 1) {
          await repo.receiveStock({
            warehouseId: WH,
            actorId: ACTOR,
            reference: `r${i}`,
            items: [{ productId: "p2", quantity: i }],
          });
        }
        const first = await repo.listMovements({ warehouseId: WH, productId: "p2", limit: 2 });
        expect(first.items.map((m) => m.reference)).toEqual(["r5", "r4"]);
        expect(first.nextBeforeId).not.toBeNull();
        const second = await repo.listMovements({
          warehouseId: WH,
          productId: "p2",
          limit: 2,
          beforeId: first.nextBeforeId!,
        });
        expect(second.items.map((m) => m.reference)).toEqual(["r3", "r2"]);
        const last = await repo.listMovements({
          warehouseId: WH,
          productId: "p2",
          limit: 5,
          beforeId: second.nextBeforeId!,
        });
        expect(last.items.map((m) => m.reference)).toEqual(["r1"]);
        expect(last.nextBeforeId).toBeNull();
      });

      it("changes the per order limit and rack location, and clears them with null", async () => {
        const repo = await make();
        const row = await repo.updateStockSettings(WH, "p1", {
          maxPerOrder: 3,
          rackLocation: "A-12",
        });
        expect(row).toMatchObject({ maxPerOrder: 3, rackLocation: "A-12" });
        const cleared = await repo.updateStockSettings(WH, "p1", {
          maxPerOrder: null,
          rackLocation: null,
        });
        expect(cleared).toMatchObject({ maxPerOrder: null, rackLocation: null });
        expect(await repo.updateStockSettings(WH, "ghost", { maxPerOrder: 1 })).toBeNull();
      });

      it("adds a warehouse once, edits it, and reports unknown ids", async () => {
        const repo = await make();
        const w = {
          id: "wh-test-1",
          name: "Test Hub",
          lat: 19.07,
          lng: 72.87,
          radiusKm: 4,
          open: true,
        };
        expect(await repo.createWarehouse(w)).toEqual(w);
        await expect(repo.createWarehouse(w)).rejects.toBeInstanceOf(WarehouseExistsError);
        expect(await repo.updateWarehouse("wh-test-1", { open: false, radiusKm: 6 })).toEqual({
          ...w,
          open: false,
          radiusKm: 6,
        });
        expect((await repo.getWarehouse("wh-test-1"))?.open).toBe(false);
        expect(await repo.updateWarehouse("nope", { open: false })).toBeNull();
        // A closed warehouse refuses new holds
        await expect(
          repo.reserve({
            warehouseId: "wh-test-1",
            reference: "x",
            items: [{ productId: "p1", quantity: 1 }],
            ttlSeconds: 60,
            now: NOW,
          }),
        ).rejects.toBeDefined();
      });
    });

    it("stores pincodes, hours and closures per warehouse and replaces them whole", async () => {
      const repo = await make();
      const id = "wh-test-schedule";
      await repo.createWarehouse({
        id,
        name: "Schedule test",
        lat: 28.6,
        lng: 77.3,
        radiusKm: 3,
        open: true,
      });

      expect(await repo.setPincodes(id, ["201309", "201301", "201301"])).toEqual([
        "201301",
        "201309",
      ]);
      expect(await repo.setPincodes(id, ["201307"])).toEqual(["201307"]);
      await repo.setHours(id, [
        { weekday: 5, opensAt: "06:00", closesAt: "01:00" },
        { weekday: 0, opensAt: "08:00", closesAt: "22:00" },
      ]);
      const closure = await repo.addClosure({
        warehouseId: id,
        startsOn: "2026-12-25",
        endsOn: "2026-12-26",
        reason: "Christmas",
      });
      expect(closure).toMatchObject({
        warehouseId: id,
        startsOn: "2026-12-25",
        endsOn: "2026-12-26",
      });

      const setup = await repo.getServiceSetup();
      expect([...(setup.pincodes.get(id) ?? [])]).toEqual(["201307"]);
      expect(setup.hours.get(id)).toEqual([
        { weekday: 0, opensAt: "08:00", closesAt: "22:00" },
        { weekday: 5, opensAt: "06:00", closesAt: "01:00" },
      ]);
      expect(setup.closures.get(id)?.map((c) => [c.startsOn, c.endsOn, c.reason])).toEqual([
        ["2026-12-25", "2026-12-26", "Christmas"],
      ]);

      await repo.setHours(id, []);
      expect((await repo.getServiceSetup()).hours.get(id) ?? []).toEqual([]);
      expect(await repo.removeClosure(id, closure.id)).toBe(true);
      expect(await repo.removeClosure(id, closure.id)).toBe(false);
      await expect(repo.setPincodes("wh-missing", [])).rejects.toBeInstanceOf(NotFoundError);
      await expect(repo.setHours("wh-missing", [])).rejects.toBeInstanceOf(NotFoundError);
    });

    it("refuses a basket at a warehouse that is shut for the day", async () => {
      const repo = await make();
      const id = "wh-test-holiday";
      await repo.createWarehouse({
        id,
        name: "Holiday",
        lat: 19.076,
        lng: 72.8777,
        radiusKm: 3,
        open: true,
      });
      const day = new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
      await repo.addClosure({ warehouseId: id, startsOn: day, endsOn: day, reason: "Holiday" });
      const result = await resolveBasket(repo, 19.076, 72.8777, [{ productId: "p1", quantity: 1 }]);
      expect(result).toMatchObject({ serviceable: false, reason: "WAREHOUSE_CLOSED" });
    });
  });
}
