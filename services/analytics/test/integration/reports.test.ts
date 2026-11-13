import { DEV_INTERNAL_KEY, createDb, signIdentityHeaders } from "@qc/service-kit";
import { sql } from "kysely";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app";
import { readOnly, type AnalyticsDb } from "../../src/modules/analytics/reports";

// Runs only with a migrated test database (see scripts/db-migrate.mjs). All rows live in March 2024
// and in two test warehouses, so other suites writing to the same database do not affect totals.
const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

const WA = "wh-analytics-a";
const WB = "wh-analytics-b";
const id = (n: number) => `aaaa0000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const C1 = id(1);
const C2 = id(2);
const C3 = id(3);
const R1 = id(11);
const R2 = id(12);
const O = (n: number) => id(100 + n);
const USERS = [C1, C2, C3, R1, R2];
const ORDERS = [0, 1, 2, 3, 4, 5, 6].map(O);
const RANGE = "from=2024-03-01&to=2024-03-07";

type OrderSeed = {
  n: number;
  user: string;
  wh: string;
  status: string;
  method?: "cod" | "online";
  placed: string;
  deliveredAfterMins?: number;
  promised?: number;
  item: number;
  discount?: number;
  handling?: number;
  reason?: string;
  items: [string, number, number][];
};

const ORDER_SEEDS: OrderSeed[] = [
  // Before the range: makes C1 a returning customer
  {
    n: 0,
    user: C1,
    wh: WA,
    status: "delivered",
    placed: "2024-02-20T06:00:00Z",
    deliveredAfterMins: 15,
    item: 8000,
    items: [["p1", 1, 8000]],
  },
  // 00:10 on 2 March in India, although the UTC date is 1 March
  {
    n: 1,
    user: C1,
    wh: WA,
    status: "delivered",
    placed: "2024-03-01T18:40:00Z",
    deliveredAfterMins: 12,
    promised: 15,
    item: 10000,
    items: [["p1", 2, 5000]],
  },
  // 23:50 on 1 March in India; C2's first order, late, with a coupon
  {
    n: 2,
    user: C2,
    wh: WA,
    status: "delivered",
    placed: "2024-03-01T18:20:00Z",
    deliveredAfterMins: 20,
    promised: 15,
    item: 20000,
    discount: 1000,
    handling: 1000,
    items: [["p2", 4, 5000]],
  },
  {
    n: 3,
    user: C2,
    wh: WA,
    status: "cancelled",
    placed: "2024-03-03T05:30:00Z",
    item: 5000,
    reason: "Changed my mind",
    items: [["p1", 1, 5000]],
  },
  {
    n: 4,
    user: C3,
    wh: WB,
    status: "delivered",
    method: "online",
    placed: "2024-03-05T06:30:00Z",
    deliveredAfterMins: 10,
    promised: 10,
    item: 30000,
    items: [["p3", 3, 10000]],
  },
  // Never paid: not an order for reporting
  {
    n: 5,
    user: C3,
    wh: WB,
    status: "pending_payment",
    method: "online",
    placed: "2024-03-05T07:00:00Z",
    item: 9900,
    items: [["p1", 1, 9900]],
  },
  // 00:01 on 8 March in India: just outside the range, but counts for retention
  {
    n: 6,
    user: C2,
    wh: WA,
    status: "delivered",
    placed: "2024-03-07T18:31:00Z",
    deliveredAfterMins: 9,
    item: 4000,
    items: [["p2", 1, 4000]],
  },
];

suite("analytics reports", async () => {
  const db = createDb<Record<string, never>>(url as string, 4) as AnalyticsDb;
  const now = () => new Date("2026-11-13T10:00:00.000Z");
  const app = await buildApp({ db, now });

  const as = (role: string, warehouseId: string | null = null) =>
    signIdentityHeaders({ userId: id(90), role: role as never, warehouseId }, DEV_INTERNAL_KEY);
  const admin = as("admin");
  const managerA = as("warehouse_manager", WA);
  const get = async (path: string, headers: Record<string, string> = admin) => {
    const res = await app.inject({ method: "GET", url: `/v1/analytics/${path}`, headers });
    return { status: res.statusCode, body: res.json() };
  };

  async function cleanup() {
    await sql`delete from delivery.deliveries where order_id = any(${ORDERS}::uuid[])`.execute(db);
    await sql`delete from orders.orders where id = any(${ORDERS}::uuid[])`.execute(db);
    await sql`delete from inventory.stock_movements where warehouse_id in (${WA}, ${WB})`.execute(
      db,
    );
    await sql`delete from inventory.stock_items where warehouse_id in (${WA}, ${WB})`.execute(db);
    await sql`delete from inventory.warehouses where id in (${WA}, ${WB})`.execute(db);
    await sql`delete from identity.users where id = any(${USERS}::uuid[])`.execute(db);
  }

  beforeAll(async () => {
    await cleanup();
    const users: [string, string, string, string][] = [
      [C1, "customer", "+919888000001", "2024-02-01T00:00:00Z"],
      [C2, "customer", "+919888000002", "2024-03-01T10:00:00Z"],
      [C3, "customer", "+919888000003", "2024-03-05T00:00:00Z"],
      [R1, "rider", "+919888000011", "2024-01-01T00:00:00Z"],
      [R2, "rider", "+919888000012", "2024-01-01T00:00:00Z"],
    ];
    for (const [uid, role, phone, created] of users) {
      await sql`insert into identity.users (id, role, name, phone, created_at)
                values (${uid}, ${role}, ${role === "rider" ? `Rider ${phone.slice(-2)}` : `Customer ${phone.slice(-1)}`}, ${phone}, ${created})`.execute(
        db,
      );
    }
    for (const w of [WA, WB]) {
      await sql`insert into inventory.warehouses (id, name, lat, lng, radius_km) values (${w}, ${w}, 28.6, 77.3, 5)`.execute(
        db,
      );
    }
    for (const s of ORDER_SEEDS) {
      const discount = s.discount ?? 0;
      const handling = s.handling ?? 0;
      const placed = new Date(s.placed);
      const delivered =
        s.deliveredAfterMins !== undefined
          ? new Date(placed.getTime() + s.deliveredAfterMins * 60_000)
          : null;
      await sql`insert into orders.orders (
          id, number, user_id, warehouse_id, status, payment_method, item_total_paise, mrp_total_paise,
          savings_paise, delivery_fee_paise, handling_fee_paise, tip_paise, total_paise, discount_paise,
          promised_mins, delivery_code, address_tag, address_line1, idempotency_key, placed_at,
          delivered_at, cancel_reason)
        values (${O(s.n)}, ${`AN-TEST-${s.n}`}, ${s.user}, ${s.wh}, ${s.status}, ${s.method ?? "cod"},
          ${s.item}, ${s.item}, 0, 0, ${handling}, 0, ${s.item + handling - discount}, ${discount},
          ${s.promised ?? 15}, '1234', 'Home', 'Test street', ${`an-test-${s.n}`}, ${placed},
          ${delivered}, ${s.reason ?? null})`.execute(db);
      for (const [productId, quantity, price] of s.items) {
        await sql`insert into orders.order_items (order_id, product_id, name, quantity, unit_price_paise, mrp_paise)
                  values (${O(s.n)}, ${productId}, ${productId.toUpperCase()}, ${quantity}, ${price}, ${price})`.execute(
          db,
        );
      }
    }
    for (const [n, rider, wh, payout, tip] of [
      [1, R1, WA, 3000, 500],
      [4, R2, WB, 4000, 0],
    ] as const) {
      const s = ORDER_SEEDS.find((x) => x.n === n)!;
      const delivered = new Date(new Date(s.placed).getTime() + s.deliveredAfterMins! * 60_000);
      await sql`insert into delivery.deliveries (
          order_id, order_number, warehouse_id, status, rider_id, store_name, store_address, store_lat,
          store_lng, customer_address, items, distance_km, payout_paise, tip_paise, handover_code,
          delivery_code, delivered_at)
        values (${O(n)}, ${`AN-TEST-${n}`}, ${wh}, 'delivered', ${rider}, 'Store', 'Store road', 28.6, 77.3,
          'Home', '[]'::jsonb, 1.5, ${payout}, ${tip}, '0000', '1234', ${delivered})`.execute(db);
    }
    // p1 at A: on hand 5 now, all of it received at 10:00 on 4 March, so it was empty 1 to 3 March
    await sql`insert into inventory.stock_items (warehouse_id, product_id, on_hand, created_at)
              values (${WA}, 'p1', 5, '2024-02-28T00:00:00Z')`.execute(db);
    await sql`insert into inventory.stock_movements (warehouse_id, product_id, type, quantity_delta, created_at)
              values (${WA}, 'p1', 'grn', 5, '2024-03-04T04:30:00Z')`.execute(db);
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
    await db.destroy();
  });

  describe("access", () => {
    it("is for admins and warehouse managers only", async () => {
      expect((await get(`sales?${RANGE}`, as("customer"))).status).toBe(403);
      expect((await get(`sales?${RANGE}`, as("warehouse_staff", WA))).status).toBe(403);
      expect((await get(`sales?${RANGE}`, as("rider", WA))).status).toBe(403);
      const anonymous = await app.inject({ method: "GET", url: `/v1/analytics/sales?${RANGE}` });
      expect(anonymous.statusCode).toBe(401);
    });

    it("keeps a manager to their own warehouse, whatever they ask for", async () => {
      const mine = await get(`sales?${RANGE}`, managerA);
      const asked = await get(`sales?${RANGE}&warehouseId=${WB}`, managerA);
      expect(mine.body.range.warehouseId).toBe(WA);
      expect(asked.body.range.warehouseId).toBe(WA);
      expect(asked.body.totals.orders).toBe(3);
    });

    it("rejects bad ranges with a clear message", async () => {
      const backwards = await get("sales?from=2024-03-07&to=2024-03-01");
      expect(backwards.status).toBe(400);
      expect(backwards.body.error.message).toMatch(/after/);
      expect((await get("sales?from=2022-01-01&to=2024-03-01")).status).toBe(400);
      expect((await get("sales?from=2024-03-1&to=2024-03-07")).status).toBe(400);
    });

    it("defaults to the last 30 India days and says when it was made", async () => {
      const { body } = await get("sales");
      expect(body.range).toMatchObject({
        from: "2026-10-15",
        to: "2026-11-13",
        days: 30,
        warehouseId: null,
      });
      expect(body.range.generatedAt).toBe("2026-11-13T10:00:00.000Z");
      expect(body.daily).toHaveLength(30);
    });
  });

  describe("sales", () => {
    it("adds up orders, GMV, discounts and new versus returning customers on India days", async () => {
      const { status, body } = await get(`sales?${RANGE}`);
      expect(status).toBe(200);
      expect(body.totals).toEqual({
        orders: 4,
        delivered: 3,
        cancelled: 1,
        gmvPaise: 60000,
        averageOrderPaise: 20000,
        discountPaise: 1000,
        newCustomers: 2,
        returningCustomers: 1,
      });
      expect(body.daily.map((d: { date: string }) => d.date)).toEqual([
        "2024-03-01",
        "2024-03-02",
        "2024-03-03",
        "2024-03-04",
        "2024-03-05",
        "2024-03-06",
        "2024-03-07",
      ]);
      const day = (date: string) => body.daily.find((d: { date: string }) => d.date === date);
      expect(day("2024-03-01")).toMatchObject({ orders: 1, gmvPaise: 20000, newCustomerOrders: 1 });
      expect(day("2024-03-02")).toMatchObject({
        orders: 1,
        gmvPaise: 10000,
        repeatCustomerOrders: 1,
      });
      expect(day("2024-03-03")).toMatchObject({ orders: 1, delivered: 0, gmvPaise: 0 });
      expect(day("2024-03-04")).toEqual({
        date: "2024-03-04",
        orders: 0,
        delivered: 0,
        gmvPaise: 0,
        discountPaise: 0,
        newCustomerOrders: 0,
        repeatCustomerOrders: 0,
      });
      expect(body.byPaymentMethod).toEqual([
        { method: "cod", orders: 3, delivered: 2, gmvPaise: 30000 },
        { method: "online", orders: 1, delivered: 1, gmvPaise: 30000 },
      ]);
    });

    it("scopes new customers to the manager's warehouse", async () => {
      const { body } = await get(`sales?${RANGE}`, managerA);
      expect(body.totals).toMatchObject({
        orders: 3,
        delivered: 2,
        gmvPaise: 30000,
        newCustomers: 1,
        returningCustomers: 1,
      });
    });

    it("returns zeros, not errors, for an empty range", async () => {
      const { body } = await get("sales?from=2023-01-01&to=2023-01-05");
      expect(body.totals).toMatchObject({ orders: 0, gmvPaise: 0, averageOrderPaise: null });
      expect(body.daily).toHaveLength(5);
      expect(body.byPaymentMethod).toEqual([]);
    });
  });

  describe("products", () => {
    it("ranks sellers by revenue, leaves out cancelled orders and shares by category", async () => {
      const { body } = await get(`products?${RANGE}`);
      expect(body.totals).toEqual({ productsSold: 3, units: 9, revenuePaise: 60000 });
      expect(body.top.map((p: { productId: string }) => p.productId)).toEqual(["p3", "p2", "p1"]);
      expect(body.top[2]).toMatchObject({ productId: "p1", units: 2, revenuePaise: 10000 });
      expect(body.bottom[0].productId).toBe("p1");
      const share = body.categories.reduce(
        (s: number, c: { sharePercent: number }) => s + c.sharePercent,
        0,
      );
      expect(share).toBeGreaterThan(99.5);
      expect(share).toBeLessThan(100.5);
    });

    it("rebuilds out of stock days from the stock ledger", async () => {
      const { body } = await get(`products?${RANGE}`, managerA);
      expect(body.outOfStockDays).toEqual([
        { productId: "p1", name: expect.any(String), warehouseId: WA, days: 3 },
      ]);
    });
  });

  describe("delivery", () => {
    it("measures speed, the 90th percentile, on time rate and cancellations", async () => {
      const { body } = await get(`delivery?${RANGE}`);
      expect(body.totals).toEqual({
        delivered: 3,
        averageMins: 14,
        onTimePercent: 66.7,
        p90Mins: 18.4,
        cancelled: 1,
      });
      expect(body.byHour).toHaveLength(24);
      expect(body.byHour[0]).toMatchObject({
        hour: 0,
        orders: 1,
        delivered: 1,
        averageMins: 12,
        onTimePercent: 100,
      });
      expect(body.byHour[11]).toMatchObject({ orders: 1, delivered: 0, averageMins: null });
      expect(body.byHour[5]).toMatchObject({
        orders: 0,
        delivered: 0,
        averageMins: null,
        onTimePercent: null,
      });
      const a = body.byWarehouse.find((w: { warehouseId: string }) => w.warehouseId === WA);
      expect(a).toMatchObject({
        orders: 3,
        cancelled: 1,
        delivered: 2,
        averageMins: 16,
        onTimePercent: 50,
      });
      expect(body.cancellations).toEqual([{ reason: "Changed my mind", count: 1 }]);
    });
  });

  describe("riders", () => {
    it("totals deliveries, pay with tips, distance and speed per rider", async () => {
      const { body } = await get(`riders?${RANGE}`);
      expect(body.riders).toEqual([
        {
          riderId: R2,
          name: "Rider 12",
          deliveries: 1,
          earningsPaise: 4000,
          tipsPaise: 0,
          distanceKm: 1.5,
          averageMins: 10,
        },
        {
          riderId: R1,
          name: "Rider 11",
          deliveries: 1,
          earningsPaise: 3500,
          tipsPaise: 500,
          distanceKm: 1.5,
          averageMins: 12,
        },
      ]);
      const mine = await get(`riders?${RANGE}`, managerA);
      expect(mine.body.riders.map((r: { riderId: string }) => r.riderId)).toEqual([R1]);
    });
  });

  describe("customers", () => {
    it("counts active, new and repeat customers, and sign ups per day", async () => {
      const { body } = await get(`customers?${RANGE}`);
      expect(body.totals).toEqual({ active: 3, newCustomers: 2, repeatRatePercent: 33.3 });
      const day = (date: string) => body.daily.find((d: { date: string }) => d.date === date);
      expect(day("2024-03-01")).toEqual({ date: "2024-03-01", newCustomers: 1, signups: 1 });
      expect(day("2024-03-05")).toEqual({ date: "2024-03-05", newCustomers: 1, signups: 1 });
      expect(day("2024-03-02")).toEqual({ date: "2024-03-02", newCustomers: 0, signups: 0 });
    });

    it("follows weekly cohorts by the week of the first order", async () => {
      const { body } = await get(`customers?${RANGE}`);
      expect(body.cohorts).toEqual([
        { week: "2024-02-26", size: 1, retention: [100, 100, 0, 0, 0, 0, 0, 0] },
        { week: "2024-03-04", size: 1, retention: [100, 0, 0, 0, 0, 0, 0, 0] },
      ]);
    });

    it("hides sign ups when a warehouse is chosen, since accounts have no warehouse", async () => {
      const { body } = await get(`customers?${RANGE}&warehouseId=${WA}`);
      expect(body.daily.every((d: { signups: number | null }) => d.signups === null)).toBe(true);
      expect(body.totals).toMatchObject({ active: 2, newCustomers: 1 });
    });
  });

  describe("heatmap", () => {
    it("fills every weekday and hour in India time", async () => {
      const { body } = await get(`hourly-heatmap?${RANGE}`);
      expect(body.cells).toHaveLength(168);
      expect(body.max).toBe(1);
      const cell = (weekday: number, hour: number) =>
        body.cells.find(
          (c: { weekday: number; hour: number }) => c.weekday === weekday && c.hour === hour,
        ).orders;
      expect(cell(6, 0)).toBe(1); // Saturday 00:10
      expect(cell(5, 23)).toBe(1); // Friday 23:50
      expect(cell(7, 11)).toBe(1); // Sunday 11:00, cancelled orders still show demand
      expect(cell(2, 12)).toBe(1); // Tuesday 12:00
      expect(cell(1, 9)).toBe(0);
    });
  });

  it("cannot write: reports run in read only transactions", async () => {
    await expect(
      readOnly(db, (trx) => sql`delete from orders.orders where id = ${O(0)}`.execute(trx)),
    ).rejects.toThrow(/read-only transaction/);
    const still = await sql`select 1 from orders.orders where id = ${O(0)}`.execute(db);
    expect(still.rows).toHaveLength(1);
  });
});
