// Customers placing cash on delivery orders. setup() signs in a pool of new customers once (each
// phone gets one code, well inside its five an hour), then every iteration places an order with a
// fresh Idempotency-Key, retries it once to prove no duplicate is made, and cancels it so the
// stock goes back and the run can repeat on the same database.
import { check, fail, sleep } from "k6";
import { Counter } from "k6/metrics";
import {
  SIGN_IN_PAUSE_S,
  baseThresholds,
  get,
  json,
  post,
  runStem,
  signInWithOtp,
  stages,
} from "./lib.js";

const POOL = Number(__ENV.CUSTOMER_POOL || 8);
const WAREHOUSE = __ENV.WAREHOUSE_ID || "wh-noida-62";
// Inside the Noida Sector 62 service area from the seed data
const ADDRESS = {
  tag: "Home",
  line1: "Load test, Tower B",
  line2: "Sector 62",
  lat: 28.6208,
  lng: 77.3649,
};

const duplicates = new Counter("duplicate_orders");

export const options = {
  setupTimeout: `${Math.ceil(POOL * SIGN_IN_PAUSE_S + 60)}s`,
  scenarios: {
    buyers: { executor: "ramping-vus", stages: stages({ smoke: 2, load: 10, stress: 30 }) },
  },
  thresholds: {
    ...baseThresholds,
    "http_req_duration{name:place_order}": ["p(95)<800"],
    "http_req_duration{name:cancel_order}": ["p(95)<800"],
    duplicate_orders: ["count==0"],
  },
};

export function setup() {
  const stem = runStem();
  const sessions = [];
  for (let i = 0; i < POOL; i += 1) {
    // +9198 then 8 digits: a valid Indian mobile shape that the seed data never uses
    const phone = `+9198${stem}${String(i).padStart(2, "0")}`;
    sessions.push(signInWithOtp(phone).accessToken);
    sleep(SIGN_IN_PAUSE_S);
  }

  // Pick a few products that are in stock now, so orders are not refused for stock
  const list = json(get("/v1/catalog/products?limit=40"))?.items ?? [];
  const ids = list.map((p) => p.id).join(",");
  const stock = json(get(`/v1/inventory/availability?warehouseId=${WAREHOUSE}&productIds=${ids}`));
  const inStock = (stock?.items ?? [])
    .filter((s) => s.status === "in_stock")
    .map((s) => s.productId);
  if (inStock.length < 2) fail("Fewer than two products in stock. Reseed the database first.");
  return { sessions, products: inStock.slice(0, 6) };
}

export default function (data) {
  const token = data.sessions[(__VU - 1) % data.sessions.length];
  const pick = data.products[Math.floor(Math.random() * data.products.length)];
  const body = { items: [{ productId: pick, quantity: 1 }], address: ADDRESS, payment: "cod" };
  const key = `load-${__VU}-${__ITER}-${Date.now()}`;

  const placed = post(
    "/v1/orders",
    body,
    token,
    { "idempotency-key": key },
    { name: "place_order" },
  );
  const ok = check(placed, { "order placed": (r) => r.status === 201 });
  if (!ok) {
    sleep(2);
    return;
  }
  const order = json(placed);

  // The same request again must return the same order, not make a second one
  const again = post(
    "/v1/orders",
    body,
    token,
    { "idempotency-key": key },
    { name: "place_order_retry" },
  );
  check(again, { "retry returns the same order": (r) => r.status === 200 });
  if (json(again)?.id !== order.id) duplicates.add(1);

  sleep(1);
  const cancelled = post(
    `/v1/orders/${order.id}/cancel`,
    { reason: "Load test" },
    token,
    {},
    { name: "cancel_order" },
  );
  check(cancelled, { "order cancelled": (r) => r.status === 200 });
  sleep(2 + Math.random() * 2);
}
