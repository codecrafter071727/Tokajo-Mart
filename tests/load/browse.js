// What a shopper does most: open the app, look at categories, scroll and search products, open
// one, and check stock at their warehouse. All public, no sign in.
import { check, group, sleep } from "k6";
import { baseThresholds, get, json, stages } from "./lib.js";

const WAREHOUSE = __ENV.WAREHOUSE_ID || "wh-noida-62";
const SEARCHES = ["milk", "bread", "chips", "eggs", "atta", "paneer", "cola", "rice"];

export const options = {
  scenarios: {
    shoppers: { executor: "ramping-vus", stages: stages({ smoke: 3, load: 40, stress: 120 }) },
  },
  thresholds: {
    ...baseThresholds,
    "http_req_duration{name:categories}": ["p(95)<200"],
    "http_req_duration{name:products}": ["p(95)<300"],
    "http_req_duration{name:search}": ["p(95)<400"],
    "http_req_duration{name:product}": ["p(95)<200"],
    "http_req_duration{name:availability}": ["p(95)<250"],
  },
};

export default function () {
  let productIds = [];

  group("home", () => {
    const cats = get("/v1/catalog/categories", null, { name: "categories" });
    check(cats, { "categories 200": (r) => r.status === 200 });
    const list = get("/v1/catalog/products?limit=40", null, { name: "products" });
    check(list, { "products 200": (r) => r.status === 200 });
    productIds = (json(list)?.items ?? []).map((p) => p.id);
  });
  sleep(1);

  group("search", () => {
    const q = SEARCHES[Math.floor(Math.random() * SEARCHES.length)];
    const res = get(`/v1/catalog/products?q=${q}&limit=20`, null, { name: "search" });
    check(res, { "search 200": (r) => r.status === 200 });
  });
  sleep(1);

  if (productIds.length > 0) {
    group("product", () => {
      const id = productIds[Math.floor(Math.random() * productIds.length)];
      const res = get(`/v1/catalog/products/${encodeURIComponent(id)}`, null, { name: "product" });
      check(res, { "product 200": (r) => r.status === 200 });
      const ids = productIds.slice(0, 20).join(",");
      const stock = get(
        `/v1/inventory/availability?warehouseId=${WAREHOUSE}&productIds=${ids}`,
        null,
        { name: "availability" },
      );
      check(stock, { "availability 200": (r) => r.status === 200 });
    });
  }
  sleep(1 + Math.random() * 2);
}
