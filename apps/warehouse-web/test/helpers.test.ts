import { describe, expect, it } from "vitest";
import {
  formatAge,
  formatElapsed,
  isLate,
  itemCount,
  orderAgeMins,
  plural,
  shortNumber,
  urgency,
} from "../src/lib/helpers";

const now = new Date("2026-11-13T10:00:00.000Z");
const ago = (mins: number) => new Date(now.getTime() - mins * 60_000).toISOString();

describe("order age", () => {
  it("counts whole minutes and never goes negative", () => {
    expect(orderAgeMins(ago(0), now)).toBe(0);
    expect(orderAgeMins(ago(7.9), now)).toBe(7);
    expect(orderAgeMins(ago(-5), now)).toBe(0); // a clock a little ahead of the server
  });

  it("is late once the promised time is reached", () => {
    expect(isLate(ago(9), 10, now)).toBe(false);
    expect(isLate(ago(10), 10, now)).toBe(true);
    expect(isLate(ago(25), 10, now)).toBe(true);
  });
});

describe("formatting", () => {
  it("reads naturally", () => {
    expect(formatAge(0)).toBe("just now");
    expect(formatAge(42)).toBe("42 min");
    expect(formatAge(60)).toBe("1 h 0 min");
    expect(formatAge(135)).toBe("2 h 15 min");
  });

  it("adds up item quantities", () => {
    expect(itemCount([])).toBe(0);
    expect(itemCount([{ quantity: 2 }, { quantity: 3 }])).toBe(5);
  });
});

describe("floor helpers", () => {
  it("warns at 70 percent of the promise and turns late when it is used up", () => {
    expect(urgency(ago(5), 10, now)).toBe("ok");
    expect(urgency(ago(7), 10, now)).toBe("soon");
    expect(urgency(ago(10), 10, now)).toBe("late");
  });

  it("shows a running clock", () => {
    expect(formatElapsed(ago(0), now)).toBe("0:00");
    expect(formatElapsed(ago(4 + 7 / 60), now)).toBe("4:07");
    expect(formatElapsed(ago(62), now)).toBe("1:02:00");
  });

  it("shortens order numbers to what people say out loud", () => {
    expect(shortNumber("QC-261113-00042")).toBe("#042");
    expect(shortNumber("QC-261113-01234")).toBe("#1234");
    expect(shortNumber("QC-261113-00000")).toBe("#000");
  });

  it("pluralises", () => {
    expect(plural(1, "item")).toBe("1 item");
    expect(plural(3, "item")).toBe("3 items");
    expect(plural(5, "min", "min")).toBe("5 min");
  });
});
