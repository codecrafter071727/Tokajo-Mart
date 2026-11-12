import { describe, expect, it } from "vitest";
import {
  createInMemoryOrderRepository,
  DEMO_TIMELINE,
  etaMinutes,
  journeyProgress,
  riderProgress,
  statusAt,
  type OrderError,
  type PlaceOrderInput,
} from "../src/lib/orders";

const item = (productId: string, unitPricePaise: number, quantity = 1) => ({
  productId,
  name: `Item ${productId}`,
  unit: "1 pc",
  quantity,
  unitPricePaise,
  mrpPaise: unitPricePaise + 500,
  emoji: "🥛",
});

const input = (over: Partial<PlaceOrderInput> = {}): PlaceOrderInput => ({
  idempotencyKey: "key-1",
  items: [item("p1", 2900, 2)],
  tipPaise: 0,
  address: { tag: "Home", line1: "123, MG Road", line2: "Bengaluru" },
  payment: "cod",
  promisedMins: 8,
  ...over,
});

const failure = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return e as OrderError;
  }
  throw new Error("expected a rejection");
};

function setup() {
  let t = Date.parse("2026-11-12T10:00:00.000Z");
  return {
    repo: createInMemoryOrderRepository({ now: () => new Date(t) }),
    advance: (s: number) => (t += s * 1000),
    at: () => new Date(t),
  };
}

describe("placing an order", () => {
  it("prices the order from its items, including fees and the tip", async () => {
    const { repo } = setup();
    const order = await repo.place(input({ tipPaise: 2000 }));
    expect(order).toMatchObject({
      itemTotalPaise: 5800,
      deliveryFeePaise: 2900,
      handlingFeePaise: 500,
      tipPaise: 2000,
      totalPaise: 5800 + 2900 + 500 + 2000,
    });
    expect(order.deliveryCode).toMatch(/^\d{4}$/);
  });

  it("returns the same order for the same idempotency key, so a double tap creates one order", async () => {
    const { repo } = setup();
    const first = await repo.place(input());
    const second = await repo.place(input());
    expect(second.id).toBe(first.id);
    expect(await repo.list()).toHaveLength(1);
  });

  it("creates a new order for a new key, newest first", async () => {
    const { repo } = setup();
    const a = await repo.place(input({ idempotencyKey: "a" }));
    const b = await repo.place(input({ idempotencyKey: "b" }));
    expect(b.id).not.toBe(a.id);
    expect((await repo.list()).map((o) => o.id)).toEqual([b.id, a.id]);
  });

  it("rejects an empty cart, a bad quantity, a bad tip and a missing key", async () => {
    const { repo } = setup();
    expect((await failure(repo.place(input({ items: [] })))).reason).toBe("EMPTY_CART");
    expect(
      (await failure(repo.place(input({ idempotencyKey: "x", items: [item("p1", 100, 0)] }))))
        .reason,
    ).toBe("INVALID_ITEM");
    expect((await failure(repo.place(input({ idempotencyKey: "y", tipPaise: -5 })))).reason).toBe(
      "INVALID_TIP",
    );
    expect((await failure(repo.place(input({ idempotencyKey: "" })))).reason).toBe("MISSING_KEY");
  });

  it("does not store anything for a rejected order", async () => {
    const { repo } = setup();
    await failure(repo.place(input({ items: [] })));
    expect(await repo.list()).toHaveLength(0);
  });

  it("can be fetched by id, and an unknown id is null", async () => {
    const { repo } = setup();
    const order = await repo.place(input());
    expect((await repo.get(order.id))?.id).toBe(order.id);
    expect(await repo.get("nope")).toBeNull();
  });
});

describe("order status over time", () => {
  it("moves placed, confirmed, picking, on the way, delivered as the clock advances", async () => {
    const { repo, advance, at } = setup();
    const order = await repo.place(input());
    const seen: string[] = [];
    for (const step of [
      0,
      DEMO_TIMELINE.confirmed,
      DEMO_TIMELINE.picking,
      DEMO_TIMELINE.on_the_way,
      DEMO_TIMELINE.delivered,
    ]) {
      advance(
        step -
          (seen.length
            ? [0, DEMO_TIMELINE.confirmed, DEMO_TIMELINE.picking, DEMO_TIMELINE.on_the_way][
                seen.length - 1
              ]!
            : 0),
      );
      seen.push(statusAt(order, at()));
    }
    expect(seen).toEqual(["placed", "confirmed", "picking", "on_the_way", "delivered"]);
  });

  it("stays delivered, and never goes backwards", async () => {
    const { repo, advance, at } = setup();
    const order = await repo.place(input());
    advance(10_000);
    expect(statusAt(order, at())).toBe("delivered");
  });

  it("a cancelled order stays cancelled whatever the clock says", () => {
    const order = { placedAt: "2026-11-12T10:00:00.000Z", cancelledAt: "2026-11-12T10:00:01.000Z" };
    expect(statusAt(order, new Date("2026-11-12T12:00:00.000Z"))).toBe("cancelled");
  });

  it("starts at the promised time, counts down, and never shows less than 1 minute", async () => {
    const { repo, advance, at } = setup();
    const order = await repo.place(input({ promisedMins: 8 }));
    expect(etaMinutes(order, at())).toBe(8);
    advance(DEMO_TIMELINE.delivered / 2);
    expect(etaMinutes(order, at())).toBe(4);
    advance(DEMO_TIMELINE.delivered); // well past delivery
    expect(etaMinutes(order, at())).toBe(1);
  });

  it("reports journey progress from 0 to 1 and clamps outside that", async () => {
    const { repo, advance, at } = setup();
    const order = await repo.place(input());
    expect(journeyProgress(order, at())).toBe(0);
    advance(DEMO_TIMELINE.delivered / 2);
    expect(journeyProgress(order, at())).toBeCloseTo(0.5, 5);
    advance(10_000);
    expect(journeyProgress(order, at())).toBe(1);
  });

  it("refuses an order with no promised delivery time", async () => {
    const { repo } = setup();
    expect(
      (await failure(repo.place(input({ idempotencyKey: "np", promisedMins: 0 })))).reason,
    ).toBe("INVALID_ITEM");
  });
});

describe("rider progress", () => {
  const order = { placedAt: "2026-11-12T10:00:00.000Z", cancelledAt: null };
  const at = (seconds: number) => new Date(Date.parse(order.placedAt) + seconds * 1000);

  it("keeps the rider at the store until the order is out for delivery", () => {
    expect(riderProgress(order, at(0))).toBe(0);
    expect(riderProgress(order, at(DEMO_TIMELINE.on_the_way - 1))).toBe(0);
  });

  it("moves the rider along the route and stops at the door", () => {
    const mid = (DEMO_TIMELINE.on_the_way + DEMO_TIMELINE.delivered) / 2;
    expect(riderProgress(order, at(mid))).toBeCloseTo(0.5, 5);
    expect(riderProgress(order, at(DEMO_TIMELINE.delivered + 500))).toBe(1);
  });

  it("does not move a cancelled order's rider", () => {
    expect(riderProgress({ ...order, cancelledAt: "2026-11-12T10:00:05.000Z" }, at(100))).toBe(0);
  });
});
