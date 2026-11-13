import { describe, expect, it } from "vitest";
import {
  couponDiscount,
  createCouponBodySchema,
  DELIVERY_FEE_PAISE,
  HANDLING_FEE_PAISE,
  placeOrderBodySchema,
  priceCart,
  type CouponTerms,
} from "../src";

const line = (unitPricePaise: number, quantity = 1) => ({
  unitPricePaise,
  mrpPaise: unitPricePaise,
  quantity,
});
const flat = (value: number, minOrderPaise = 0): CouponTerms => ({
  code: "FLAT",
  type: "flat",
  value,
  maxDiscountPaise: null,
  minOrderPaise,
});
const percent = (value: number, maxDiscountPaise: number | null = null): CouponTerms => ({
  code: "PCT",
  type: "percent",
  value,
  maxDiscountPaise,
  minOrderPaise: 0,
});
const freeDelivery: CouponTerms = {
  code: "FREEDEL",
  type: "free_delivery",
  value: 0,
  maxDiscountPaise: null,
  minOrderPaise: 0,
};

describe("coupons in the price", () => {
  it("prices exactly as before when no coupon is given", () => {
    const p = priceCart([line(5000)]);
    expect(p).toMatchObject({ discountPaise: 0, couponSavingsPaise: 0, appliedCoupon: null });
    expect(p.totalPaise).toBe(5000 + DELIVERY_FEE_PAISE + HANDLING_FEE_PAISE);
  });

  it("takes a flat amount off the total", () => {
    const p = priceCart([line(25_000)], 0, flat(5000, 19_900));
    expect(p).toMatchObject({ discountPaise: 5000, appliedCoupon: { code: "FLAT", type: "flat" } });
    expect(p.totalPaise).toBe(25_000 + HANDLING_FEE_PAISE - 5000);
  });

  it("does not apply below the minimum, and says how much is missing", () => {
    const p = priceCart([line(15_000)], 0, flat(5000, 19_900));
    expect(p).toMatchObject({ discountPaise: 0, appliedCoupon: null, couponShortfallPaise: 4900 });
    expect(priceCart([line(19_900)], 0, flat(5000, 19_900)).discountPaise).toBe(5000);
  });

  it("never discounts more than the items, so fees and tip are always paid", () => {
    const p = priceCart([line(3000)], 1000, flat(10_000));
    expect(p.discountPaise).toBe(3000);
    expect(p.totalPaise).toBe(DELIVERY_FEE_PAISE + HANDLING_FEE_PAISE + 1000);
  });

  it("rounds a percent down to whole paise and respects the cap", () => {
    expect(couponDiscount(9999, percent(10))).toBe(999);
    expect(couponDiscount(100_000, percent(20, 7500))).toBe(7500);
    expect(couponDiscount(100_000, percent(20))).toBe(20_000);
  });

  it("waives the delivery fee for a free delivery coupon", () => {
    const p = priceCart([line(5000)], 0, freeDelivery);
    expect(p).toMatchObject({
      deliveryFeePaise: 0,
      deliveryWaivedPaise: DELIVERY_FEE_PAISE,
      discountPaise: 0,
      couponSavingsPaise: DELIVERY_FEE_PAISE,
    });
    expect(p.totalPaise).toBe(5000 + HANDLING_FEE_PAISE);
    // Already free: it applies, but saves nothing
    expect(priceCart([line(20_000)], 0, freeDelivery).couponSavingsPaise).toBe(0);
  });

  it("does nothing to an empty cart", () => {
    expect(priceCart([], 0, flat(5000))).toMatchObject({
      totalPaise: 0,
      appliedCoupon: null,
      couponShortfallPaise: 0,
    });
  });

  it("always adds up: total = items + fees + tip - discount", () => {
    for (const coupon of [flat(5000), percent(15, 3000), freeDelivery, null]) {
      for (const items of [[line(1000)], [line(4500, 3)], [line(30_000)]]) {
        const p = priceCart(items, 2000, coupon);
        expect(p.totalPaise).toBe(
          p.itemTotalPaise + p.deliveryFeePaise + p.handlingFeePaise + p.tipPaise - p.discountPaise,
        );
        expect(p.totalPaise).toBeGreaterThanOrEqual(p.deliveryFeePaise + p.handlingFeePaise);
      }
    }
  });
});

describe("coupon request shapes", () => {
  it("upper cases the code the customer types, and ignores any discount they send", () => {
    const body = placeOrderBodySchema.parse({
      items: [{ productId: "p1", quantity: 1 }],
      address: { tag: "Home", line1: "x", lat: 28.6, lng: 77.3 },
      payment: "cod",
      couponCode: " welcome50 ",
      discountPaise: 99_999,
    });
    expect(body.couponCode).toBe("WELCOME50");
    expect(body).not.toHaveProperty("discountPaise");
  });

  it("checks coupon definitions", () => {
    const base = { code: "save10", title: "Save", type: "percent" as const, value: 10 };
    expect(createCouponBodySchema.parse(base).code).toBe("SAVE10");
    expect(createCouponBodySchema.safeParse({ ...base, value: 120 }).success).toBe(false);
    expect(createCouponBodySchema.safeParse({ ...base, type: "flat", value: 0 }).success).toBe(
      false,
    );
    expect(createCouponBodySchema.safeParse({ ...base, code: "a b" }).success).toBe(false);
    expect(
      createCouponBodySchema.safeParse({
        ...base,
        startsAt: "2026-12-02T00:00:00Z",
        endsAt: "2026-12-01T00:00:00Z",
      }).success,
    ).toBe(false);
  });
});
