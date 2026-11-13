import { describe, expect, it } from "vitest";
import { orderMessage } from "../../src/modules/orders/notify";

const order = { id: "o1", number: "QC-261113-00042", userId: "u1" };

describe("order messages", () => {
  it("covers each step the customer cares about, with the short order number", () => {
    for (const event of [
      "confirmed",
      "packing",
      "out_for_delivery",
      "delivered",
      "cancelled",
      "refunded",
    ] as const) {
      const message = orderMessage(event, order);
      expect(message?.title.length).toBeGreaterThan(0);
      expect(`${message?.title} ${message?.body}`).not.toMatch(/\\u2014/);
    }
    expect(orderMessage("confirmed", order)?.body).toContain("#00042");
    expect(orderMessage("delivered", order)?.type).toBe("order.delivered");
  });

  it("says nothing for internal steps", () => {
    expect(orderMessage("packed", order)).toBeNull();
    expect(orderMessage("picked_up", order)).toBeNull();
    expect(orderMessage("pending_payment", order)).toBeNull();
  });

  it("includes the cancel reason and a refund amount when known", () => {
    expect(orderMessage("cancelled", { ...order, cancelReason: "Store closed" })?.body).toContain(
      "Store closed",
    );
    expect(orderMessage("refunded", { ...order, refundPaise: 12_550 })?.body).toContain("₹125.50");
  });
});
