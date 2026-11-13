import { describe, expect, it } from "vitest";
import type { ProductDetail as ProductDetailDto } from "@qc/contracts";
import { asDetail, categoryTree, toCategory, toProductDetail } from "../src/lib/catalog";

const cat = (id: string, parentId: string | null = null) =>
  toCategory({
    id,
    name: id,
    emoji: "",
    color: "#FFFFFF",
    imageUrl: null,
    imageFit: "cover",
    sortOrder: 0,
    parentId,
  });

describe("category tree", () => {
  it("nests sub categories under their parent in the order the server sent", () => {
    const tree = categoryTree([
      cat("dairy"),
      cat("milk", "dairy"),
      cat("snacks"),
      cat("curd", "dairy"),
    ]);
    expect(tree.map((c) => c.id)).toEqual(["dairy", "snacks"]);
    expect(tree[0]?.children.map((c) => c.id)).toEqual(["milk", "curd"]);
    expect(tree[1]?.children).toEqual([]);
  });

  it("keeps a sub category whose parent is missing at the top level", () => {
    expect(categoryTree([cat("milk", "gone")]).map((c) => c.id)).toEqual(["milk"]);
  });
});

describe("product detail", () => {
  const dto: ProductDetailDto = {
    id: "p21",
    name: "Amul Taaza Milk",
    unit: "1 L",
    pricePaise: 6800,
    mrpPaise: 7000,
    discountPercent: 3,
    categoryId: "dairy",
    emoji: "x",
    imageUrl: "https://example.com/a.jpg",
    imageFit: "contain",
    deliveryMins: 9,
    optionsCount: 2,
    description: null,
    brand: "Amul",
    tags: ["milk"],
    groupId: "g-milk",
    variantLabel: "1 L",
    variants: [
      {
        id: "p1",
        label: "500 ml",
        unit: "500 ml",
        pricePaise: 3450,
        mrpPaise: 3500,
        imageUrl: null,
      },
      { id: "p21", label: "1 L", unit: "1 L", pricePaise: 6800, mrpPaise: 7000, imageUrl: null },
    ],
    images: [
      { id: null, url: "https://example.com/a.jpg", alt: "", primary: true },
      {
        id: "11111111-1111-4111-8111-111111111111",
        url: "https://example.com/b.jpg",
        alt: "Back",
        primary: false,
      },
    ],
    group: { id: "g-milk", name: "Amul Taaza Milk" },
  };

  it("turns paise into rupees for the variants and keeps photo order", () => {
    const detail = toProductDetail(dto);
    expect(detail.variants.map((v) => [v.label, v.price, v.mrp])).toEqual([
      ["500 ml", 34.5, 35],
      ["1 L", 68, 70],
    ]);
    expect(detail.images.map((i) => i.url)).toEqual([
      "https://example.com/a.jpg",
      "https://example.com/b.jpg",
    ]);
    expect(detail).toMatchObject({
      brand: "Amul",
      tags: ["milk"],
      groupId: "g-milk",
      groupName: "Amul Taaza Milk",
    });
  });

  it("gives a product without extras an empty variant list and its own photo", () => {
    const plain = asDetail({
      id: "p2",
      name: "Bread",
      unit: "400 g",
      price: 45,
      mrp: 50,
      image: "x",
      categoryId: "bakery",
      imageUrl: "https://example.com/c.jpg",
    });
    expect(plain.variants).toEqual([]);
    expect(plain.images).toEqual([{ url: "https://example.com/c.jpg", alt: "Bread" }]);
  });
});
