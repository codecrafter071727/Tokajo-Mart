import {
  DEV_INTERNAL_KEY,
  createDb,
  signIdentityHeaders,
  type InternalClient,
} from "@qc/service-kit";
import { PDFDocument } from "pdf-lib";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app";
import type { DB } from "../../src/db/types.generated";
import type { Clients } from "../../src/modules/orders/clients";
import {
  pdfSafe,
  readInvoiceToken,
  rupees,
  signInvoiceToken,
} from "../../src/modules/orders/invoice";

// Runs only with a migrated test database (see scripts/db-migrate.mjs)
const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

const OWNER = "eeee0000-0000-4000-8000-00000000000e";
const OTHER = "eeee0000-0000-4000-8000-00000000000f";
const STAFF = "eeee0000-0000-4000-8000-0000000000aa";
const DELIVERED = "eeee1111-0000-4000-8000-000000000001";
const PACKING = "eeee1111-0000-4000-8000-000000000002";

describe("invoice helpers", () => {
  it("writes rupees with Indian grouping and never the rupee sign the PDF font cannot draw", () => {
    expect(rupees(12345678)).toBe("Rs. 1,23,456.78");
    expect(rupees(9900)).toBe("Rs. 99.00");
    expect(pdfSafe("₹50 off — नमस्ते")).toBe("Rs.50 off - ??????");
  });

  it("signs links that expire and cannot be changed", () => {
    const now = new Date("2026-11-13T10:00:00Z");
    const { token } = signInvoiceToken("secret", DELIVERED, now);
    expect(readInvoiceToken("secret", token, now)).toBe(DELIVERED);
    expect(readInvoiceToken("other-secret", token, now)).toBeNull();
    expect(readInvoiceToken("secret", token.replace(DELIVERED, PACKING), now)).toBeNull();
    expect(readInvoiceToken("secret", token, new Date(now.getTime() + 11 * 60_000))).toBeNull();
    expect(readInvoiceToken("secret", "nonsense", now)).toBeNull();
  });
});

suite("invoices and account deletion support", async () => {
  const db = createDb<DB>(url as string, 5);
  const none: InternalClient = { get: async () => ({}) as never, post: async () => ({}) as never };
  const clients: Clients = {
    catalog: none,
    delivery: none,
    identity: none,
    inventory: {
      get: async () =>
        ({ id: "wh-noida-62", name: "Tokajo Noida 62", lat: 0, lng: 0, open: true }) as never,
      post: async () => ({}) as never,
    },
    payment: {
      get: async () => ({ razorpayPaymentId: "pay_TEST123" }) as never,
      post: async () => ({}) as never,
    },
  };
  const app = await buildApp({ db, clients });
  const as = (userId: string, role: string, warehouseId: string | null = null) =>
    signIdentityHeaders({ userId, role: role as never, warehouseId }, DEV_INTERNAL_KEY);
  const owner = as(OWNER, "customer");
  const get = (path: string, headers: Record<string, string> = {}) =>
    app.inject({ method: "GET", url: path, headers });

  const order = (id: string, number: string, status: string, method = "cod") => ({
    id,
    number,
    userId: OWNER,
    warehouseId: "wh-noida-62",
    status,
    paymentMethod: method,
    itemTotalPaise: 13000,
    mrpTotalPaise: 14000,
    savingsPaise: 1000,
    deliveryFeePaise: 0,
    handlingFeePaise: 500,
    tipPaise: 2000,
    discountPaise: 5000,
    couponCode: "WELCOME50",
    totalPaise: 10500,
    promisedMins: 10,
    deliveryCode: "1234",
    customerName: "Esha Rao",
    customerPhone: "+919999300001",
    addressTag: "Home",
    addressLine1: "B-12, Sector 62",
    addressLine2: "Noida",
    instructions: "Ring twice",
    idempotencyKey: `invoice-test-${id}`,
    deliveredAt: status === "delivered" ? new Date("2026-11-13T09:30:00Z") : null,
  });

  const clean = async () => {
    await db.deleteFrom("orders.orders").where("userId", "in", [OWNER, OTHER]).execute();
  };
  beforeEach(async () => {
    await clean();
    await db
      .insertInto("orders.orders")
      .values([
        order(DELIVERED, "QC-261113-90001", "delivered", "online"),
        order(PACKING, "QC-261113-90002", "packing"),
      ])
      .execute();
    await db
      .insertInto("orders.orderItems")
      .values([
        {
          orderId: DELIVERED,
          productId: "p1",
          name: "Amul Taaza Milk",
          unit: "500 ml",
          quantity: 2,
          unitPricePaise: 3000,
          mrpPaise: 3200,
        },
        {
          orderId: DELIVERED,
          productId: "p2",
          name: "Harvest Gold Bread",
          unit: "400 g",
          quantity: 1,
          unitPricePaise: 7000,
          mrpPaise: 7600,
        },
      ])
      .execute();
  });
  afterAll(async () => {
    await clean();
    await app.close();
    await db.destroy();
  });

  it("gives the customer a real PDF of a delivered order", async () => {
    const res = await get(`/v1/orders/${DELIVERED}/invoice.pdf`, owner);
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("application/pdf");
    expect(res.headers["content-disposition"]).toContain("tokajo-invoice-QC-261113-90001.pdf");
    expect(res.rawPayload.subarray(0, 5).toString()).toBe("%PDF-");
    // It opens as a valid PDF and its title carries the invoice number
    const doc = await PDFDocument.load(res.rawPayload);
    expect(doc.getTitle()).toContain("INV-261113-90001");
    expect(doc.getPageCount()).toBe(1);
  });

  it("only exists once the order is delivered", async () => {
    const res = await get(`/v1/orders/${PACKING}/invoice.pdf`, owner);
    expect(res.statusCode).toBe(409);
    expect(res.json().error.message).toMatch(/delivered/);
  });

  it("is for the customer, admins and the warehouse manager only", async () => {
    expect(
      (await get(`/v1/orders/${DELIVERED}/invoice.pdf`, as(OTHER, "customer"))).statusCode,
    ).toBe(404);
    expect(
      (
        await get(
          `/v1/orders/${DELIVERED}/invoice.pdf`,
          as(STAFF, "warehouse_staff", "wh-noida-62"),
        )
      ).statusCode,
    ).toBe(404);
    expect(
      (
        await get(
          `/v1/orders/${DELIVERED}/invoice.pdf`,
          as(STAFF, "warehouse_manager", "wh-indiranagar"),
        )
      ).statusCode,
    ).toBe(404);
    expect(
      (
        await get(
          `/v1/orders/${DELIVERED}/invoice.pdf`,
          as(STAFF, "warehouse_manager", "wh-noida-62"),
        )
      ).statusCode,
    ).toBe(200);
    expect((await get(`/v1/orders/${DELIVERED}/invoice.pdf`, as(STAFF, "admin"))).statusCode).toBe(
      200,
    );
    expect((await get(`/v1/orders/${DELIVERED}/invoice.pdf`)).statusCode).toBe(401);
  });

  it("opens from a short lived link without a sign in, and not for anyone else's order", async () => {
    const link = await app.inject({
      method: "POST",
      url: `/v1/orders/${DELIVERED}/invoice-link`,
      headers: owner,
      payload: {},
    });
    expect(link.statusCode).toBe(200);
    const { url: path } = link.json();
    expect(path).toMatch(/^\/v1\/invoices\//);
    const pdf = await get(path);
    expect(pdf.statusCode).toBe(200);
    expect(pdf.headers["content-disposition"]).toContain("inline");
    expect((await get(path.replace(/.$/, path.endsWith("A") ? "B" : "A"))).statusCode).toBe(404);
    const other = await app.inject({
      method: "POST",
      url: `/v1/orders/${DELIVERED}/invoice-link`,
      headers: as(OTHER, "customer"),
      payload: {},
    });
    expect(other.statusCode).toBe(404);
  });

  it("tells account deletion which orders are still in progress", async () => {
    const res = await get(`/internal/customers/${OWNER}/active-orders`);
    expect(res.json()).toEqual({ count: 1, numbers: ["QC-261113-90002"] });
    expect((await get(`/internal/customers/${OTHER}/active-orders`)).json()).toEqual({
      count: 0,
      numbers: [],
    });
  });

  it("scrubs a deleted customer's name, phone and notes but keeps the order for tax records", async () => {
    const res = await app.inject({ method: "POST", url: `/internal/customers/${OWNER}/scrub` });
    expect(res.json()).toEqual({ orders: 2 });
    const rows = await db
      .selectFrom("orders.orders")
      .select(["customerName", "customerPhone", "instructions", "totalPaise", "addressLine1"])
      .where("userId", "=", OWNER)
      .execute();
    for (const r of rows) {
      expect(r).toMatchObject({
        customerName: "Deleted user",
        customerPhone: "",
        instructions: null,
        totalPaise: 10500,
      });
    }
    // Repeating is harmless
    expect(
      (await app.inject({ method: "POST", url: `/internal/customers/${OWNER}/scrub` })).statusCode,
    ).toBe(200);
  });
});
