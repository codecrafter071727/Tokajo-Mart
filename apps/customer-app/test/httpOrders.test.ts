import type { Order as ServerOrder } from "@qc/contracts";
import { describe, expect, it } from "vitest";
import { describeOrderError, fromServer } from "../src/lib/orderMapping";
import { etaMinutes, journeyProgress, riderProgress, statusAt } from "../src/lib/orders";
import { HttpError } from "../src/lib/httpError";

const server = (over: Partial<ServerOrder> = {}): ServerOrder => ({
  id: "11111111-1111-4111-8111-111111111111",
  number: "QC-261113-00001",
  status: "confirmed",
  warehouseId: "wh-noida-62",
  items: [
    {
      productId: "p1",
      name: "Milk",
      unit: "500 ml",
      quantity: 2,
      unitPricePaise: 3000,
      mrpPaise: 3200,
      emoji: "x",
      imageUrl: null,
      picked: false,
    },
  ],
  itemTotalPaise: 6000,
  mrpTotalPaise: 6400,
  savingsPaise: 400,
  deliveryFeePaise: 2900,
  handlingFeePaise: 500,
  tipPaise: 0,
  totalPaise: 9400,
  paymentMethod: "cod",
  promisedMins: 10,
  address: { tag: "Home", line1: "B-12", line2: "Noida" },
  deliveryCode: "4321",
  rider: null,
  placedAt: "2026-11-13T10:00:00.000Z",
  confirmedAt: "2026-11-13T10:00:00.000Z",
  packedAt: null,
  pickedUpAt: null,
  deliveredAt: null,
  cancelledAt: null,
  cancelReason: null,
  ...over,
});

const at = (iso: string) => new Date(iso);

describe("orders from the order service", () => {
  it("keeps the order number, code and money as sent", () => {
    const order = fromServer(server());
    expect(order).toMatchObject({
      id: "11111111-1111-4111-8111-111111111111",
      deliveryCode: "4321",
      totalPaise: 9400,
      server: { number: "QC-261113-00001", status: "confirmed" },
    });
    expect(order.items[0]?.imageUrl).toBeUndefined();
  });

  it("takes the status from the service, not from the clock", () => {
    const now = at("2026-11-13T12:00:00.000Z"); // two hours later: the demo clock would say delivered
    const cases: [string, string][] = [
      ["confirmed", "confirmed"],
      ["packing", "picking"],
      ["packed", "picking"],
      ["picked_up", "on_the_way"],
      ["out_for_delivery", "on_the_way"],
      ["delivered", "delivered"],
      ["cancelled", "cancelled"],
    ];
    for (const [from, to] of cases) {
      expect(statusAt(fromServer(server({ status: from as never })), now)).toBe(to);
    }
  });

  it("counts the promise down in real time and never shows less than 1 minute", () => {
    const order = fromServer(server());
    expect(etaMinutes(order, at("2026-11-13T10:03:00.000Z"))).toBe(7);
    expect(etaMinutes(order, at("2026-11-13T10:30:00.000Z"))).toBe(1);
  });

  it("moves progress forward as the order does", () => {
    const now = at("2026-11-13T10:05:00.000Z");
    const steps = ["confirmed", "packing", "packed", "out_for_delivery", "delivered"].map(
      (status) => journeyProgress(fromServer(server({ status: status as never })), now),
    );
    expect([...steps].sort((a, b) => a - b)).toEqual(steps);
    expect(steps.at(-1)).toBe(1);
  });

  it("keeps the rider at the store until pickup, then moves them, and never to the door early", () => {
    const waiting = fromServer(server({ status: "packed" }));
    expect(riderProgress(waiting, at("2026-11-13T10:05:00.000Z"))).toBe(0);
    const riding = fromServer(
      server({ status: "out_for_delivery", pickedUpAt: "2026-11-13T10:06:00.000Z" }),
    );
    expect(riderProgress(riding, at("2026-11-13T10:08:00.000Z"))).toBeGreaterThan(0);
    expect(riderProgress(riding, at("2026-11-13T11:00:00.000Z"))).toBeLessThan(1);
    expect(
      riderProgress(fromServer(server({ status: "delivered" })), at("2026-11-13T11:00:00.000Z")),
    ).toBe(1);
  });
});

describe("order errors", () => {
  const names = { p1: "Milk", p2: "Bread" };

  it("names the items that ran short", () => {
    const error = new HttpError("Some items are no longer available.", 409, "CONFLICT", [
      { productId: "p1", requested: 2, available: 1 },
    ]);
    expect(describeOrderError(error, names)).toBe(
      "Some items are no longer available. Check: Milk.",
    );
  });

  it("names unavailable and unknown items from a serviceability answer", () => {
    const error = new HttpError("Some items are not available right now.", 409, "CONFLICT", {
      reason: "ITEMS_UNAVAILABLE",
      unavailable: [{ productId: "p2" }],
    });
    expect(describeOrderError(error, names)).toContain("Bread");
  });

  it("passes on the server's words for an address it cannot serve, and falls back for the rest", () => {
    const area = new HttpError("We do not deliver to this address yet.", 409, "CONFLICT", {
      reason: "OUTSIDE_SERVICE_AREA",
      unavailable: [],
    });
    expect(describeOrderError(area, names)).toBe("We do not deliver to this address yet.");
    expect(describeOrderError(new Error("boom"), names)).toMatch(/could not place/);
  });
});
