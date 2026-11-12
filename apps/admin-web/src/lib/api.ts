import { createApiClient } from "@qc/api-client";

/** Browser side client. Requests go to this site's /api proxy (see next.config.mjs). */
export const api = createApiClient({
  baseUrl: "/api",
  serviceUrls: { inventory: "/api-inventory" },
});

/** Warehouse whose stock the catalog table shows, until the admin can pick one. */
export const DEFAULT_WAREHOUSE_ID = "wh-noida-62";

export const rupees = (paise: number) => {
  const value = paise / 100;
  return `₹${Number.isInteger(value) ? value : value.toFixed(2)}`;
};
