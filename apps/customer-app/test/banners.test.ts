import type { Banner } from "@qc/contracts";
import { describe, expect, it } from "vitest";
import { isLight, shade, toHomeBanner } from "../src/lib/bannerMapping";

const base: Banner = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "Fresh veggies",
  subtitle: "Picked this morning",
  imageUrl: "https://example.com/veg.jpg",
  linkType: "category",
  linkTarget: "fruits",
  color: "#E8F5E9",
  sortOrder: 10,
  active: true,
  startsAt: null,
  endsAt: null,
};

describe("banner colours", () => {
  it("uses dark text on light colours and white text on dark ones", () => {
    expect(isLight("#FFFFFF")).toBe(true);
    expect(isLight("#E8F5E9")).toBe(true);
    expect(isLight("#1B6B3A")).toBe(false);
    expect(isLight("#000000")).toBe(false);
  });

  it("does not break on a malformed colour", () => {
    expect(isLight("green")).toBe(true);
  });
});

describe("shade", () => {
  it("darkens and lightens a colour, and leaves a malformed one alone", () => {
    expect(shade("#ffffff", -0.5)).toBe("#808080");
    expect(shade("#000000", 0.5)).toBe("#808080");
    expect(shade("green", -0.2)).toBe("green");
  });
});

describe("server banners", () => {
  it("keeps the text, a soft gradient of its colour and the picture", () => {
    const banner = toHomeBanner(base);
    expect(banner).toMatchObject({
      title: "Fresh veggies",
      subtitle: "Picked this morning",
      colors: ["#E8F5E9", "#d5e1d6"],
      darkText: true,
      photos: ["https://example.com/veg.jpg"],
    });
  });

  it("leads to a category or a product, and offers a button only when it leads somewhere", () => {
    expect(toHomeBanner(base).link).toEqual({ type: "category", target: "fruits" });
    expect(toHomeBanner(base).cta).toBe("Shop now");
    const product = toHomeBanner({ ...base, linkType: "product", linkTarget: "p4" });
    expect(product.link).toEqual({ type: "product", target: "p4" });
    const none = toHomeBanner({ ...base, linkType: "none", linkTarget: null });
    expect(none.link).toBeNull();
    expect(none.cta).toBeNull();
  });

  it("has no photo when the banner has no image", () => {
    expect(toHomeBanner({ ...base, imageUrl: null }).photos).toEqual([]);
  });
});
