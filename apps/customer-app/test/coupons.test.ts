import { describe, expect, it } from "vitest";
import type { CouponOffer } from "@qc/contracts";
import { HttpError } from "../src/lib/httpError";
import { isCouponError, offerLine, savingOn, toApplied } from "../src/lib/couponRules";
import { priceCart } from "../src/lib/pricing";

const offer = (over: Partial<CouponOffer> = {}): CouponOffer => ({
  code: "WELCOME50",
  title: "₹50 off your first order",
  description: "",
  type: "flat",
  value: 5000,
  maxDiscountPaise: null,
  minOrderPaise: 19_900,
  endsAt: null,
  eligible: true,
  reason: null,
  ...over,
});
const lines = (paise: number) => [{ unitPricePaise: paise, mrpPaise: paise, quantity: 1 }];

describe("coupon offers", () => {
  it("describes what an offer gives, with its minimum", () => {
    expect(offerLine(offer())).toBe("₹50 off on orders above ₹199");
    expect(
      offerLine(offer({ type: "percent", value: 10, maxDiscountPaise: 7500, minOrderPaise: 0 })),
    ).toBe("10% off up to ₹75");
    expect(offerLine(offer({ type: "free_delivery", value: 0, minOrderPaise: 14_900 }))).toBe(
      "Free delivery on orders above ₹149",
    );
  });

  it("shows the saving only once the cart reaches the minimum", () => {
    expect(savingOn(lines(15_000), 0, offer())).toBe(0);
    expect(savingOn(lines(25_000), 0, offer())).toBe(5000);
    // Free delivery saves the delivery fee on a small cart, nothing on one that already ships free
    expect(
      savingOn(lines(5000), 0, offer({ type: "free_delivery", value: 0, minOrderPaise: 0 })),
    ).toBe(2900);
    expect(
      savingOn(lines(15_000), 0, offer({ type: "free_delivery", value: 0, minOrderPaise: 0 })),
    ).toBe(0);
  });

  it("prices the applied coupon the same way the server does", () => {
    const applied = toApplied(offer());
    const bill = priceCart(lines(25_000), 2000, applied);
    expect(bill).toMatchObject({ discountPaise: 5000, appliedCoupon: { code: "WELCOME50" } });
    expect(bill.totalPaise).toBe(25_000 + 500 + 2000 - 5000);
  });

  it("recognises a coupon refusal from the order service, and nothing else", () => {
    expect(
      isCouponError(
        new HttpError("You have already used this code.", 409, "CONFLICT", { coupon: "WELCOME50" }),
      ),
    ).toBe(true);
    expect(
      isCouponError(
        new HttpError("Some items are no longer sold.", 409, "CONFLICT", { unknown: ["p1"] }),
      ),
    ).toBe(false);
    expect(isCouponError(new Error("x"))).toBe(false);
  });
});
