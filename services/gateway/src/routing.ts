import type { Role } from "@qc/contracts";

export type ServiceName =
  | "identity"
  | "catalog"
  | "inventory"
  | "order"
  | "delivery"
  | "payment"
  | "notification"
  | "analytics";

/** Who may call a route: anyone, any signed in user, or only these roles. */
export type Access = "public" | "authenticated" | Role[];

export type Route = {
  service: ServiceName;
  access: Access;
  /** Stricter rate limit (requests per minute per client) for abuse prone routes */
  limit?: number;
  /** Extra request headers this route needs passed through (beyond the usual safe list) */
  extraHeaders?: readonly string[];
  /** Never attach a caller identity, even when a token is sent (third party webhooks) */
  anonymous?: boolean;
};

const STAFF: Role[] = ["warehouse_staff", "warehouse_manager", "admin"];

type Rule = { prefix: string; methods?: readonly string[]; route: Route };
const READ = ["GET", "HEAD"];

/** First match wins, so more specific prefixes come first. */
const RULES: Rule[] = [
  { prefix: "/v1/identity/auth/", route: { service: "identity", access: "public", limit: 20 } },
  { prefix: "/v1/identity/admin/", route: { service: "identity", access: ["admin"] } },
  { prefix: "/v1/identity/", route: { service: "identity", access: "authenticated" } },

  { prefix: "/v1/catalog/admin/", route: { service: "catalog", access: ["admin"] } },
  { prefix: "/v1/catalog/", methods: READ, route: { service: "catalog", access: "public" } },
  { prefix: "/v1/catalog/", route: { service: "catalog", access: ["admin"] } },

  // Customers may ask whether they are served and whether items are in stock. Everything else under
  // inventory (stock levels, receiving, adjustments, the ledger, warehouses) is for staff only.
  {
    prefix: "/v1/inventory/serviceability/",
    methods: READ,
    route: { service: "inventory", access: "public" },
  },
  {
    prefix: "/v1/inventory/availability/",
    methods: READ,
    route: { service: "inventory", access: "public" },
  },
  { prefix: "/v1/inventory/", route: { service: "inventory", access: STAFF } },

  // The order service decides what each role may see or do. The gateway only needs a signed in user
  {
    prefix: "/v1/orders",
    methods: ["POST"],
    route: { service: "order", access: "authenticated", limit: 30 },
  },
  { prefix: "/v1/orders", route: { service: "order", access: "authenticated" } },
  // An invoice opened from a short lived signed link (a phone's browser has no token). The order
  // service checks the signature and expiry; this is read only and rate limited.
  {
    prefix: "/v1/invoices/",
    methods: READ,
    route: { service: "order", access: "public", limit: 60 },
  },
  { prefix: "/v1/delivery/", route: { service: "delivery", access: "authenticated" } },

  // Online payments. The payment service checks the caller owns the order
  {
    prefix: "/v1/payments/",
    methods: ["POST"],
    route: { service: "payment", access: "authenticated", limit: 30 },
  },
  { prefix: "/v1/payments/", route: { service: "payment", access: "authenticated" } },

  // In-app notifications. The service checks roles (Notify me is for customers, admin views for
  // admins); the gateway only needs a signed in user.
  { prefix: "/v1/notifications/", route: { service: "notification", access: "authenticated" } },

  // Reports: admins see all warehouses, managers only their own (the service enforces the scope)
  {
    prefix: "/v1/analytics/",
    route: { service: "analytics", access: ["warehouse_manager", "admin"] },
  },

  // Razorpay calls this. It is public, and the payment service verifies the signature over the
  // raw body, so the body and the two signature headers are passed through untouched.
  {
    prefix: "/webhooks/razorpay",
    methods: ["POST"],
    route: {
      service: "payment",
      access: "public",
      anonymous: true,
      extraHeaders: ["x-razorpay-signature", "x-razorpay-event-id"],
    },
  },
];

/** Finds the service and access rule for a request, or null when the gateway does not serve it. */
export function resolveRoute(method: string, rawUrl: string): Route | null {
  const path = rawUrl.split("?")[0] ?? "";
  // Internal routes are never reachable from outside, however a path is dressed up
  if (path.includes("/internal") || path.includes("..") || path.includes("//")) return null;
  for (const rule of RULES) {
    const inPrefix = path === rule.prefix.replace(/\/$/, "") || path.startsWith(rule.prefix);
    if (!inPrefix) continue;
    if (rule.methods && !rule.methods.includes(method.toUpperCase())) continue;
    return rule.route;
  }
  return null;
}

export function isAllowed(access: Access, role: Role | undefined): boolean {
  if (access === "public") return true;
  if (!role) return false;
  return access === "authenticated" || access.includes(role);
}
