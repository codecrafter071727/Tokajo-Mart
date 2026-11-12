import { describe, expect, it } from "vitest";
import {
  DELIVERY_FEE_PAISE,
  formatPaise,
  HANDLING_FEE_PAISE,
  priceCart,
  toPriceLines,
} from "../src/lib/pricing";

const line = (unitPricePaise: number, quantity = 1, mrpPaise = unitPricePaise) => ({
  unitPricePaise,
  mrpPaise,
  quantity,
});

describe("priceCart", () => {
  it("charges delivery and handling below the free delivery minimum", () => {
    const p = priceCart([line(2900, 2)]); // 58 rupees
    expect(p).toMatchObject({
      itemTotalPaise: 5800,
      deliveryFeePaise: DELIVERY_FEE_PAISE,
      handlingFeePaise: HANDLING_FEE_PAISE,
      totalPaise: 5800 + DELIVERY_FEE_PAISE + HANDLING_FEE_PAISE,
      toFreeDeliveryPaise: 9900 - 5800,
    });
  });

  it("makes delivery free at exactly the minimum, and not a paisa below it", () => {
    expect(priceCart([line(9900)]).deliveryFeePaise).toBe(0);
    expect(priceCart([line(9899)]).deliveryFeePaise).toBe(DELIVERY_FEE_PAISE);
    expect(priceCart([line(9900)]).toFreeDeliveryPaise).toBe(0);
  });

  it("adds the tip to the total and reports savings against MRP", () => {
    const p = priceCart([line(2500, 2, 3500)], 2000);
    expect(p.tipPaise).toBe(2000);
    expect(p.savingsPaise).toBe(2000); // (35 - 25) * 2
    expect(p.totalPaise).toBe(5000 + DELIVERY_FEE_PAISE + HANDLING_FEE_PAISE + 2000);
  });

  it("never reports negative savings when MRP is below the price", () => {
    expect(priceCart([line(3000, 1, 2000)]).savingsPaise).toBe(0);
  });

  it("charges nothing at all for an empty cart, even with a tip", () => {
    expect(priceCart([], 2000)).toMatchObject({
      totalPaise: 0,
      deliveryFeePaise: 0,
      handlingFeePaise: 0,
      tipPaise: 0,
    });
  });

  it.each([-1, 1.5, Number.NaN])("rejects a bad tip %s", (tip) => {
    expect(() => priceCart([line(1000)], tip)).toThrow(RangeError);
  });

  it.each([0, -2, 1.5])("rejects a bad quantity %s", (quantity) => {
    expect(() => priceCart([line(1000, quantity)])).toThrow(RangeError);
  });

  it("is exact: no floating point drift across many items", () => {
    // 0.1 + 0.2 style trouble if this were done in rupees
    const p = priceCart(Array.from({ length: 30 }, () => line(10, 3)));
    expect(p.itemTotalPaise).toBe(900);
  });
});

describe("toPriceLines", () => {
  it("converts rupee cart items to paise, rounding away float noise", () => {
    expect(toPriceLines([{ price: 29.1, mrp: 31, quantity: 2 }])).toEqual([
      { unitPricePaise: 2910, mrpPaise: 3100, quantity: 2 },
    ]);
    expect(
      toPriceLines([{ price: (0.07 * 100) / 100, mrp: 0.07, quantity: 1 }])[0]!.unitPricePaise,
    ).toBe(7);
  });
});

describe("formatPaise", () => {
  it("shows whole rupees plainly and others with two decimals", () => {
    expect(formatPaise(2900)).toBe("₹29");
    expect(formatPaise(2950)).toBe("₹29.50");
    expect(formatPaise(0)).toBe("₹0");
  });
});
