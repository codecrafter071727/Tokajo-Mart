import { describe, expect, it } from "vitest";
import {
  CUSTOMER_CANCELLABLE,
  ORDER_TRANSITIONS,
  orderStatusSchema,
  placeOrderBodySchema,
} from "../src";

describe("order state machine", () => {
  it("defines the transitions of every status", () => {
    for (const status of orderStatusSchema.options)
      expect(ORDER_TRANSITIONS).toHaveProperty(status);
  });

  it("only goes forward on the happy path, one step at a time", () => {
    const path = [
      "confirmed",
      "packing",
      "packed",
      "picked_up",
      "out_for_delivery",
      "delivered",
    ] as const;
    for (let i = 0; i < path.length - 1; i += 1) {
      expect(ORDER_TRANSITIONS[path[i]!]).toContain(path[i + 1]);
    }
    expect(ORDER_TRANSITIONS.confirmed).not.toContain("delivered");
    expect(ORDER_TRANSITIONS.packing).not.toContain("confirmed");
  });

  it("treats delivered and cancelled as final", () => {
    expect(ORDER_TRANSITIONS.delivered).toEqual([]);
    expect(ORDER_TRANSITIONS.cancelled).toEqual([]);
  });

  it("lets a customer cancel only before packing starts", () => {
    expect(CUSTOMER_CANCELLABLE).toEqual(["pending_payment", "confirmed"]);
  });
});

describe("placeOrderBodySchema", () => {
  const valid = {
    items: [{ productId: "p1", quantity: 2 }],
    address: { tag: "Home", line1: "123 MG Road", lat: 28.6, lng: 77.3 },
    payment: "cod" as const,
  };

  it("accepts a normal order and defaults the tip and second address line", () => {
    const parsed = placeOrderBodySchema.parse(valid);
    expect(parsed.tipPaise).toBe(0);
    expect(parsed.address.line2).toBe("");
  });

  it.each([
    ["no items", { ...valid, items: [] }],
    ["zero quantity", { ...valid, items: [{ productId: "p1", quantity: 0 }] }],
    ["fractional tip", { ...valid, tipPaise: 10.5 }],
    ["negative tip", { ...valid, tipPaise: -1 }],
    ["online payment", { ...valid, payment: "card" }],
    ["impossible latitude", { ...valid, address: { ...valid.address, lat: 123 } }],
  ])("rejects %s", (_name, body) => {
    expect(placeOrderBodySchema.safeParse(body).success).toBe(false);
  });

  it("ignores a total the client tries to send, because the schema has no such field", () => {
    const parsed = placeOrderBodySchema.parse({ ...valid, totalPaise: 1 });
    expect(parsed).not.toHaveProperty("totalPaise");
  });
});
