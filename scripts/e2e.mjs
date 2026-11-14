// One real order, end to end, through the gateway: customer signs in and orders, the warehouse
// packs it, a rider delivers it. Run against the stack from scripts/dev-stack.sh.
//   node scripts/e2e.mjs            (GATEWAY_URL defaults to http://localhost:4000)
// The online payment part needs the payment service running with PAYMENTS_FAKE_PROVIDER=1 and
// the same RAZORPAY_WEBHOOK_SECRET in this script's environment. Otherwise it is skipped.
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";

const BASE = process.env.GATEWAY_URL ?? "http://localhost:4000";

async function call(method, path, { token, body, headers } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}
const ok = async (label, promise, status = 200) => {
  const res = await promise;
  assert.equal(
    res.status,
    status,
    `${label}: expected ${status}, got ${res.status} ${JSON.stringify(res.json)}`,
  );
  console.log(`ok  ${label}`);
  return res.json;
};

// A phone number that is new on every run, so the customer is created fresh
const phone = `+9199${String(Date.now()).slice(-8)}`;

// 1. Customer signs in with the demo code
await ok(
  "customer requests a code",
  call("POST", "/v1/identity/auth/otp/request", { body: { phone } }),
);
const customer = await ok(
  "customer signs in",
  call("POST", "/v1/identity/auth/otp/verify", {
    body: { phone, code: "1234", name: "E2E Customer" },
  }),
);

// 2. Real catalog, and a protected route refuses an anonymous caller
const catalog = await ok("catalog lists products", call("GET", "/v1/catalog/products?limit=5"));
assert.ok(catalog.items.length > 0);
await ok("orders need a sign in", call("GET", "/v1/orders"), 401);

// 3. Place an order (served from the seeded Noida warehouse)
const address = {
  tag: "Home",
  line1: "12 Park Road",
  line2: "Sector 62",
  lat: 28.6208,
  lng: 77.3649,
};
const items = [
  { productId: catalog.items[0].id, quantity: 2 },
  { productId: catalog.items[1].id, quantity: 1 },
];
const key = randomUUID();
const order = await ok(
  "customer places a COD order",
  call("POST", "/v1/orders", {
    token: customer.accessToken,
    headers: { "idempotency-key": key },
    body: { items, address, payment: "cod" },
  }),
  201,
);
assert.equal(order.status, "confirmed");
assert.match(order.deliveryCode, /^\d{4}$/);
const again = await ok(
  "the same request again returns the same order",
  call("POST", "/v1/orders", {
    token: customer.accessToken,
    headers: { "idempotency-key": key },
    body: { items, address, payment: "cod" },
  }),
);
assert.equal(again.id, order.id);

// 4. Warehouse staff packs it
const manager = await ok(
  "warehouse manager signs in",
  call("POST", "/v1/identity/auth/login", {
    body: { email: "manager@milcki.dev", password: "milcki-dev" },
  }),
);
const queue = await ok(
  "warehouse sees the queue",
  call("GET", "/v1/orders/queue", { token: manager.accessToken }),
);
assert.ok(
  queue.items.some((o) => o.id === order.id),
  "the order is in the queue",
);
assert.ok(
  queue.items.every((o) => !("deliveryCode" in o)),
  "the queue never shows the delivery code",
);
await ok(
  "start packing",
  call("POST", `/v1/orders/${order.id}/start-packing`, { token: manager.accessToken, body: {} }),
);
await ok(
  "packing before ticking is refused",
  call("POST", `/v1/orders/${order.id}/packed`, { token: manager.accessToken, body: {} }),
  409,
);
for (const line of items) {
  await ok(
    `tick ${line.productId}`,
    call("POST", `/v1/orders/${order.id}/items/${line.productId}/picked`, {
      token: manager.accessToken,
      body: { picked: true },
    }),
  );
}
await ok(
  "mark packed",
  call("POST", `/v1/orders/${order.id}/packed`, { token: manager.accessToken, body: {} }),
);
await ok(
  "customer cannot cancel any more",
  call("POST", `/v1/orders/${order.id}/cancel`, { token: customer.accessToken, body: {} }),
  409,
);

// 5. A rider goes online. The three seeded riders take turns, because a phone may only ask for
// five codes an hour and this script is run often on a development database.
const RIDER_PHONES = ["+919810000011", "+919810000012", "+919810000013"];
const riderPhone = RIDER_PHONES[Math.floor(Date.now() / 1000) % RIDER_PHONES.length];
await ok(
  "rider requests a code",
  call("POST", "/v1/identity/auth/otp/request", {
    body: { phone: riderPhone, role: "rider" },
  }),
);
const rider = await ok(
  "rider signs in",
  call("POST", "/v1/identity/auth/otp/verify", {
    body: { phone: riderPhone, role: "rider", code: "123456" },
  }),
);
let state = await ok(
  "rider goes online",
  call("POST", "/v1/delivery/me/online", { token: rider.accessToken, body: { online: true } }),
);
// Other seeded orders may be waiting too: keep taking offers until this order's turn comes
for (let i = 0; i < 20 && state.active?.orderNumber !== order.number; i += 1) {
  if (state.active) {
    state = await ok(
      "rider declines an unrelated offer",
      call("POST", `/v1/delivery/${state.active.id}/actions`, {
        token: rider.accessToken,
        body: { type: "decline" },
      }),
    );
  } else {
    state = await ok(
      "rider checks for offers",
      call("GET", "/v1/delivery/me", { token: rider.accessToken }),
    );
  }
}
assert.equal(state.active?.orderNumber, order.number, "the rider is offered this order");
assert.ok(!("deliveryCode" in state.active), "the rider never receives the delivery code");
const deliveryId = state.active.id;
const act = (body, status = 200) =>
  ok(
    `rider ${body.type}`,
    call("POST", `/v1/delivery/${deliveryId}/actions`, { token: rider.accessToken, body }),
    status,
  );

await act({ type: "accept" });
await act({ type: "arrive_store" });

// 6. The warehouse shows the handover code, and the rider types it in
const handovers = await ok(
  "warehouse sees the handover",
  call("GET", "/v1/delivery/handovers", { token: manager.accessToken }),
);
const handover = handovers.items.find((h) => h.orderNumber === order.number);
assert.ok(handover, "the handover is listed");
await act({
  type: "pick_up",
  checkedItemIds: order.items.map((i) => i.productId),
  handoverCode: handover.handoverCode,
});
await act({ type: "arrive_customer" });
await act({ type: "deliver", code: order.deliveryCode === "0000" ? "1111" : "0000" }, 409);
await act({ type: "deliver", code: order.deliveryCode });

// 7. The customer sees it delivered, with the rider on it
const done = await ok(
  "customer sees the order delivered",
  call("GET", `/v1/orders/${order.id}`, { token: customer.accessToken }),
);
assert.equal(done.status, "delivered");
assert.ok(done.rider?.name, "the customer sees who delivered it");
assert.ok(done.deliveredAt);

// The customer was told along the way (notifications are sent in the background, so allow a moment)
let inbox = { items: [] };
for (let i = 0; i < 10; i += 1) {
  inbox = await ok(
    "customer reads notifications",
    call("GET", "/v1/notifications/me?limit=50", { token: customer.accessToken }),
  );
  if (inbox.items.some((n) => n.type === "order.delivered")) break;
  await new Promise((resolve) => setTimeout(resolve, 300));
}
const told = new Set(inbox.items.filter((n) => n.data?.orderId === order.id).map((n) => n.type));
for (const type of [
  "order.confirmed",
  "order.packing",
  "delivery.rider_assigned",
  "order.out_for_delivery",
  "order.delivered",
]) {
  assert.ok(told.has(type), `the customer was told: ${type}`);
}
const unread = await ok(
  "customer sees an unread count",
  call("GET", "/v1/notifications/me/unread-count", { token: customer.accessToken }),
);
assert.ok(unread.unread >= 5);
await ok(
  "customer marks all read",
  call("POST", "/v1/notifications/me/read-all", { token: customer.accessToken, body: {} }),
);

// 8. Admin sees it in the all-orders view and the riders view
const admin = await ok(
  "admin signs in",
  call("POST", "/v1/identity/auth/login", {
    body: { email: "admin@milcki.dev", password: "milcki-dev" },
  }),
);
const all = await ok(
  "admin lists all orders",
  call("GET", "/v1/orders/admin?status=delivered", { token: admin.accessToken }),
);
assert.ok(all.items.some((o) => o.id === order.id && o.customerName === "E2E Customer"));
const riders = await ok(
  "admin lists riders",
  call("GET", "/v1/delivery/admin/riders", { token: admin.accessToken }),
);
assert.ok(riders.items.length >= 3);

// 9. Rules at the edges
await ok(
  "a customer cannot read the warehouse queue",
  call("GET", "/v1/orders/queue", { token: customer.accessToken }),
  403,
);
await ok(
  "a customer cannot edit the catalog",
  call("PATCH", "/v1/catalog/products/p1", {
    token: customer.accessToken,
    body: { pricePaise: 1 },
  }),
  403,
);
await ok("internal routes are not reachable", call("GET", "/internal/riders"), 404);

// 10. Online payment: the order waits for payment, a signed Razorpay webhook confirms it, and a
// cancel refunds it. Simulating the webhook needs the webhook secret, so it only runs with one.
const online = await ok(
  "customer places an online order",
  call("POST", "/v1/orders", {
    token: customer.accessToken,
    headers: { "idempotency-key": randomUUID() },
    body: { items: [{ productId: catalog.items[0].id, quantity: 1 }], address, payment: "online" },
  }),
  201,
);
assert.equal(online.status, "pending_payment");
assert.equal(online.deliveryCode, null, "no delivery code before payment");
const checkout = await call("POST", `/v1/payments/orders/${online.id}/checkout`, {
  token: customer.accessToken,
  body: {},
});
const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
if (checkout.status === 503) {
  console.log("--  online payment skipped: the payment service has no Razorpay keys");
} else if (!webhookSecret) {
  assert.equal(checkout.status, 200, JSON.stringify(checkout.json));
  console.log("ok  checkout created a Razorpay order");
  console.log(
    "--  payment confirmation skipped: set RAZORPAY_WEBHOOK_SECRET to simulate the webhook",
  );
} else {
  assert.equal(checkout.status, 200, JSON.stringify(checkout.json));
  assert.equal(checkout.json.amountPaise, online.totalPaise);
  console.log("ok  checkout created a Razorpay order");
  const raw = JSON.stringify({
    event: "payment.captured",
    payload: {
      payment: {
        entity: {
          id: `pay_e2e${Date.now()}`,
          order_id: checkout.json.razorpayOrderId,
          amount: online.totalPaise,
          method: "upi",
          status: "captured",
        },
      },
    },
  });
  const hook = await fetch(`${BASE}/webhooks/razorpay`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-razorpay-signature": createHmac("sha256", webhookSecret).update(raw).digest("hex"),
      "x-razorpay-event-id": `evt_e2e_${randomUUID()}`,
    },
    body: raw,
  });
  assert.equal(hook.status, 200, `webhook: ${hook.status} ${await hook.text()}`);
  console.log("ok  signed webhook accepted");
  const paid = await ok(
    "the paid order is confirmed",
    call("GET", `/v1/orders/${online.id}`, { token: customer.accessToken }),
  );
  assert.equal(paid.status, "confirmed");
  assert.match(paid.deliveryCode, /^\d{4}$/);
  if (process.env.PAYMENTS_FAKE_PROVIDER === "1") {
    await ok(
      "customer cancels the paid order",
      call("POST", `/v1/orders/${online.id}/cancel`, { token: customer.accessToken, body: {} }),
    );
    const refunded = await ok(
      "the payment is refunded",
      call("GET", `/v1/payments/orders/${online.id}`, { token: customer.accessToken }),
    );
    assert.equal(refunded.status, "refunded");
  }
}

console.log("\nEnd to end passed.");
