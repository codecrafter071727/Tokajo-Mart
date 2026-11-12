import { describe, expect, it } from "vitest";
import {
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
  });
}
