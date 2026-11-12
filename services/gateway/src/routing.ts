import type { Role } from "@qc/contracts";

export type ServiceName = "identity" | "catalog" | "inventory" | "order" | "delivery";

/** Who may call a route: anyone, any signed in user, or only these roles. */
export type Access = "public" | "authenticated" | Role[];

export type Route = {
  service: ServiceName;
  access: Access;
  /** Stricter rate limit (requests per minute per client) for abuse prone routes */
  limit?: number;
};

const STAFF: Role[] = ["warehouse_staff", "warehouse_manager", "admin"];

type Rule = { prefix: string; methods?: readonly string[]; route: Route };
const READ = ["GET", "HEAD"];

/** First match wins, so more specific prefixes come first. */
const RULES: Rule[] = [
  { prefix: "/v1/identity/auth/", route: { service: "identity", access: "public", limit: 20 } },
  { prefix: "/v1/identity/admin/", route: { service: "identity", access: ["admin"] } },
  { prefix: "/v1/identity/", route: { service: "identity", access: "authenticated" } },

  { prefix: "/v1/catalog/", methods: READ, route: { service: "catalog", access: "public" } },
  { prefix: "/v1/catalog/", route: { service: "catalog", access: ["admin"] } },

  { prefix: "/v1/inventory/", methods: READ, route: { service: "inventory", access: "public" } },
  { prefix: "/v1/inventory/", route: { service: "inventory", access: STAFF } },

  // The order service decides what each role may see or do. The gateway only needs a signed in user
  {
    prefix: "/v1/orders",
    methods: ["POST"],
    route: { service: "order", access: "authenticated", limit: 30 },
  },
  { prefix: "/v1/orders", route: { service: "order", access: "authenticated" } },
  { prefix: "/v1/delivery/", route: { service: "delivery", access: "authenticated" } },
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
