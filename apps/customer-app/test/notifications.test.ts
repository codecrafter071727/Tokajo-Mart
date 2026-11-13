import { describe, expect, it } from "vitest";
import {
  dayLabel,
  groupByDay,
  notificationIcon,
  notificationTarget,
} from "../src/lib/notificationRules";

const now = new Date("2026-11-13T10:00:00.000Z"); // 3:30 pm in India

describe("notification inbox rules", () => {
  it("opens the order first, then the product, else nothing", () => {
    expect(notificationTarget({ data: { orderId: "o1", productId: "p1" } })).toBe("/orders/o1");
    expect(notificationTarget({ data: { productId: "p1" } })).toBe("/product/p1");
    expect(notificationTarget({ data: {} })).toBeNull();
  });

  it("labels days in India time", () => {
    expect(dayLabel("2026-11-13T02:00:00.000Z", now)).toBe("Today");
    // 11 pm UTC on the 12th is already the 13th in India
    expect(dayLabel("2026-11-12T23:00:00.000Z", now)).toBe("Today");
    expect(dayLabel("2026-11-12T10:00:00.000Z", now)).toBe("Yesterday");
    expect(dayLabel("2026-11-01T10:00:00.000Z", now)).toMatch(/1 Nov/);
  });

  it("groups newest first items into days without reordering", () => {
    const groups = groupByDay(
      [
        { createdAt: "2026-11-13T09:00:00.000Z", id: "a" },
        { createdAt: "2026-11-13T01:00:00.000Z", id: "b" },
        { createdAt: "2026-11-12T08:00:00.000Z", id: "c" },
      ],
      now,
    );
    expect(groups.map((g) => [g.label, g.items.map((i) => i.id)])).toEqual([
      ["Today", ["a", "b"]],
      ["Yesterday", ["c"]],
    ]);
  });

  it("has an icon for every kind and a fallback", () => {
    expect(notificationIcon("stock.back_in_stock")).toBe("sparkles");
    expect(notificationIcon("delivery.rider_assigned")).toBe("bicycle");
    expect(notificationIcon("something.new")).toBe("receipt");
  });
});
