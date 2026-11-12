import { describe, expect, it } from "vitest";
import {
  applyAction,
  earningsPaise,
  formatPaise,
  type Action,
  type Delivery,
  type DeliveryError,
} from "../src/lib/delivery";

const base: Delivery = {
  id: "d1",
  orderNumber: "QC1001",
  status: "offered",
  store: { name: "Noida Sector 62", address: "Store", lat: 28.6279, lng: 77.3649 },
  customer: {
    name: "Asha",
    address: "B-12, Sector 63",
    lat: 28.63,
    lng: 77.37,
    phone: "+919999999999",
    instructions: null,
  },
  items: [
    { id: "i1", name: "Milk", quantity: 2, emoji: "🥛" },
    { id: "i2", name: "Bread", quantity: 1, emoji: "🍞" },
  ],
  distanceKm: 2.1,
  etaMins: 12,
  payoutPaise: 4500,
  tipPaise: 1000,
  codPaise: null,
  deliveryCode: "4821",
  deliveredAt: null,
};

const run = (d: Delivery, ...actions: Action[]) =>
  actions.reduce((acc, a) => applyAction(acc, a), d);
const failure = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return e as DeliveryError;
  }
  throw new Error("expected a DeliveryError but nothing was thrown");
};

describe("delivery state machine", () => {
  it("walks the happy path from offer to delivered", () => {
    const done = run(
      base,
      { type: "accept" },
      { type: "arrive_store" },
      { type: "pick_up", checkedItemIds: ["i1", "i2"] },
      { type: "arrive_customer" },
      { type: "deliver", code: "4821" },
    );
    expect(done.status).toBe("delivered");
  });

  it("does not mutate the delivery it was given", () => {
    const before = JSON.stringify(base);
    applyAction(base, { type: "accept" });
    expect(JSON.stringify(base)).toBe(before);
  });

  it("rejects an action out of order, including skipping steps", () => {
    expect(failure(() => applyAction(base, { type: "arrive_store" })).reason).toBe(
      "INVALID_TRANSITION",
    );
    const assigned = applyAction(base, { type: "accept" });
    expect(failure(() => applyAction(assigned, { type: "arrive_customer" })).reason).toBe(
      "INVALID_TRANSITION",
    );
    expect(failure(() => applyAction(assigned, { type: "deliver", code: "4821" })).reason).toBe(
      "INVALID_TRANSITION",
    );
  });

  it("does not allow any action once delivered", () => {
    const done = run(
      base,
      { type: "accept" },
      { type: "arrive_store" },
      { type: "pick_up", checkedItemIds: ["i1", "i2"] },
      { type: "arrive_customer" },
      { type: "deliver", code: "4821" },
    );
    expect(failure(() => applyAction(done, { type: "deliver", code: "4821" })).reason).toBe(
      "INVALID_TRANSITION",
    );
  });

  describe("pick up", () => {
    const atStore = run(base, { type: "accept" }, { type: "arrive_store" });

    it("requires every item to be checked", () => {
      expect(
        failure(() => applyAction(atStore, { type: "pick_up", checkedItemIds: ["i1"] })).reason,
      ).toBe("ITEMS_NOT_CHECKED");
      expect(
        failure(() => applyAction(atStore, { type: "pick_up", checkedItemIds: [] })).reason,
      ).toBe("ITEMS_NOT_CHECKED");
    });

    it("ignores unknown ids but still needs all real items", () => {
      expect(
        failure(() => applyAction(atStore, { type: "pick_up", checkedItemIds: ["i1", "ghost"] }))
          .reason,
      ).toBe("ITEMS_NOT_CHECKED");
      expect(
        applyAction(atStore, { type: "pick_up", checkedItemIds: ["i1", "i2", "ghost"] }).status,
      ).toBe("picked_up");
    });
  });

  describe("handover code", () => {
    const atCustomer = run(
      base,
      { type: "accept" },
      { type: "arrive_store" },
      { type: "pick_up", checkedItemIds: ["i1", "i2"] },
      { type: "arrive_customer" },
    );

    it("refuses the wrong code and leaves the delivery at the customer", () => {
      const error = failure(() => applyAction(atCustomer, { type: "deliver", code: "0000" }));
      expect(error.reason).toBe("WRONG_CODE");
      expect(atCustomer.status).toBe("at_customer");
    });

    it.each(["", "482", "48210", "48a1", " 4821", "4821 "])(
      "rejects a badly formed code %j",
      (code) => {
        expect(failure(() => applyAction(atCustomer, { type: "deliver", code })).reason).toBe(
          "CODE_FORMAT",
        );
      },
    );

    it("stamps the completion time from the injected clock", () => {
      const at = new Date("2026-11-12T10:00:00.000Z");
      const done = applyAction(atCustomer, { type: "deliver", code: "4821" }, at);
      expect(done.deliveredAt).toBe("2026-11-12T10:00:00.000Z");
    });
  });
});

describe("money helpers", () => {
  it("adds payout and tip in paise", () => {
    expect(earningsPaise(base)).toBe(5500);
  });

  it("formats whole rupees without decimals and others with two", () => {
    expect(formatPaise(4500)).toBe("₹45");
    expect(formatPaise(4550)).toBe("₹45.50");
    expect(formatPaise(0)).toBe("₹0");
  });
});
