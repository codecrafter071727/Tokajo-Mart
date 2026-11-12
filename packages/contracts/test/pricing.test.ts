import { describe, expect, it } from "vitest";
import { DELIVERY_FEE_PAISE, HANDLING_FEE_PAISE, priceCart } from "../src";

const line = (unitPricePaise: number, quantity = 1, mrpPaise = unitPricePaise) => ({
  unitPricePaise,
  mrpPaise,
  quantity,
});

describe("priceCart", () => {
  it("charges delivery and handling below the free delivery minimum", () => {
    expect(priceCart([line(2900, 2)])).toMatchObject({
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
  });

  it("adds the tip and reports savings against MRP, never negative", () => {
    const p = priceCart([line(2500, 2, 3500)], 2000);
    expect(p).toMatchObject({ tipPaise: 2000, savingsPaise: 2000 });
    expect(priceCart([line(3000, 1, 2000)]).savingsPaise).toBe(0);
  });

  it("charges nothing at all for an empty cart", () => {
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
});
