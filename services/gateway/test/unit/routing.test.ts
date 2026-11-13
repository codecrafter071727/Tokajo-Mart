import { describe, expect, it } from "vitest";
import { isAllowed, resolveRoute } from "../../src/routing";

describe("routing", () => {
  it("never serves internal routes, however the path is written", () => {
    for (const path of [
      "/internal/riders",
      "/v1/internal/riders",
      "/v1/catalog/../internal/x",
      "/v1/catalog//products",
      "/v1/identity/internal/users/1",
    ]) {
      expect(resolveRoute("GET", path)).toBeNull();
    }
  });

  it("does not serve unknown prefixes", () => {
    expect(resolveRoute("GET", "/v1/unknown/x")).toBeNull();
    expect(resolveRoute("GET", "/")).toBeNull();
  });

  it("lets anyone read the catalog and inventory but not write", () => {
    expect(resolveRoute("GET", "/v1/catalog/products?limit=5")?.access).toBe("public");
    expect(resolveRoute("PATCH", "/v1/catalog/products/p1")?.access).toEqual(["admin"]);
    expect(
      resolveRoute("GET", "/v1/inventory/availability?warehouseId=w&productIds=p1")?.access,
    ).toBe("public");
    expect(resolveRoute("GET", "/v1/inventory/serviceability?lat=1&lng=2")?.access).toBe("public");
    expect(resolveRoute("POST", "/v1/inventory/anything")?.access).not.toBe("public");
  });

  it("keeps stock levels, the ledger and warehouses for staff", () => {
    const staff = ["warehouse_staff", "warehouse_manager", "admin"];
    for (const path of [
      "/v1/inventory/stock",
      "/v1/inventory/stock?q=p1",
      "/v1/inventory/stock/movements",
      "/v1/inventory/warehouses",
      "/v1/inventory/warehouses/wh-noida-62",
      "/v1/inventory/availability-extra",
      "/v1/inventory/serviceability-extra",
    ]) {
      expect(resolveRoute("GET", path)?.access, path).toEqual(staff);
    }
    // Writes to the public read routes are not public either
    expect(resolveRoute("POST", "/v1/inventory/availability")?.access).toEqual(staff);
    expect(resolveRoute("POST", "/v1/inventory/stock/receive")?.access).toEqual(staff);
    expect(resolveRoute("PATCH", "/v1/inventory/warehouses/x")?.access).toEqual(staff);
  });

  it("keeps the catalog admin views admin only", () => {
    expect(resolveRoute("GET", "/v1/catalog/admin/products")?.access).toEqual(["admin"]);
    expect(resolveRoute("GET", "/v1/catalog/admin/banners")?.access).toEqual(["admin"]);
    expect(resolveRoute("GET", "/v1/catalog/banners")?.access).toBe("public");
  });

  it("keeps sign in public but strictly limited, and admin routes admin only", () => {
    const auth = resolveRoute("POST", "/v1/identity/auth/login");
    expect(auth?.access).toBe("public");
    expect(auth?.limit).toBeLessThanOrEqual(30);
    expect(resolveRoute("POST", "/v1/identity/admin/riders")?.access).toEqual(["admin"]);
    expect(resolveRoute("GET", "/v1/identity/me")?.access).toBe("authenticated");
  });

  it("requires a signed in user for orders and delivery", () => {
    expect(resolveRoute("POST", "/v1/orders")?.access).toBe("authenticated");
    expect(resolveRoute("POST", "/v1/orders")?.limit).toBeDefined();
    expect(resolveRoute("GET", "/v1/orders/abc")?.service).toBe("order");
    expect(resolveRoute("GET", "/v1/delivery/mine")?.service).toBe("delivery");
  });

  it("routes notifications to the notification service for signed in users", () => {
    expect(resolveRoute("GET", "/v1/notifications/me")).toMatchObject({
      service: "notification",
      access: "authenticated",
    });
    expect(resolveRoute("POST", "/v1/notifications/me/subscriptions")?.service).toBe(
      "notification",
    );
    expect(resolveRoute("POST", "/v1/notifications/internal/notify")).toBeNull();
  });

  it("routes payments to the payment service and keeps the webhook public and anonymous", () => {
    expect(resolveRoute("POST", "/v1/payments/verify")).toMatchObject({
      service: "payment",
      access: "authenticated",
    });
    const hook = resolveRoute("POST", "/webhooks/razorpay");
    expect(hook).toMatchObject({ service: "payment", access: "public", anonymous: true });
    expect(hook?.extraHeaders).toEqual(["x-razorpay-signature", "x-razorpay-event-id"]);
    expect(resolveRoute("GET", "/webhooks/razorpay")).toBeNull();
  });

  it("serves invoice links publicly for reading only, through the order service", () => {
    expect(resolveRoute("GET", "/v1/invoices/abc.123.sig")).toMatchObject({
      service: "order",
      access: "public",
    });
    expect(resolveRoute("POST", "/v1/invoices/abc")).toBeNull();
    expect(resolveRoute("GET", "/v1/orders/abc/invoice.pdf")?.access).toBe("authenticated");
  });

  it("checks roles", () => {
    expect(isAllowed("public", undefined)).toBe(true);
    expect(isAllowed("authenticated", undefined)).toBe(false);
    expect(isAllowed("authenticated", "customer")).toBe(true);
    expect(isAllowed(["admin"], "customer")).toBe(false);
    expect(isAllowed(["admin"], "admin")).toBe(true);
  });

  it("keeps reports for managers and admins", () => {
    const route = resolveRoute("GET", "/v1/analytics/sales?from=2026-11-01");
    expect(route?.service).toBe("analytics");
    expect(route?.access).toEqual(["warehouse_manager", "admin"]);
    expect(isAllowed(route!.access, "customer")).toBe(false);
    expect(isAllowed(route!.access, "warehouse_staff")).toBe(false);
    expect(isAllowed(route!.access, "warehouse_manager")).toBe(true);
  });
});
