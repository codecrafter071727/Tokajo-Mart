import { describe, expect, it } from "vitest";
import { findNewOrders } from "../src/lib/chime";

const order = (id: string, status = "confirmed") => ({ id, status });

describe("new order detection", () => {
  it("stays quiet on the first look, so the existing backlog never chimes", () => {
    const first = findNewOrders(null, [order("a"), order("b")]);
    expect(first.fresh).toEqual([]);
    expect([...first.known]).toEqual(["a", "b"]);
  });

  it("finds confirmed orders that were not there last time", () => {
    const { known } = findNewOrders(null, [order("a")]);
    const next = findNewOrders(known, [order("a"), order("b"), order("c")]);
    expect(next.fresh).toEqual(["b", "c"]);
  });

  it("ignores new orders that are already being packed or packed", () => {
    const { known } = findNewOrders(null, [order("a")]);
    expect(findNewOrders(known, [order("a"), order("b", "packing")]).fresh).toEqual([]);
  });

  it("does not chime again for an order it has already seen", () => {
    let known = findNewOrders(null, []).known;
    const first = findNewOrders(known, [order("a")]);
    expect(first.fresh).toEqual(["a"]);
    known = first.known;
    expect(findNewOrders(known, [order("a")]).fresh).toEqual([]);
  });

  it("chimes again for an order that left the queue and came back", () => {
    let known = findNewOrders(null, [order("a")]).known;
    known = findNewOrders(known, []).known;
    expect(findNewOrders(known, [order("a")]).fresh).toEqual(["a"]);
  });
});
