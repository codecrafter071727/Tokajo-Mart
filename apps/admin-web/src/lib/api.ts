import { createApiClient } from "@qc/api-client";

/** Browser side client. Requests go to this site's /api route, which adds the admin's token. */
export const api = createApiClient({ baseUrl: "/api" });

/** Warehouse whose stock the catalog table shows, until the admin can pick one. */
export const DEFAULT_WAREHOUSE_ID = "wh-noida-62";

/** Paise as rupees with Indian digit grouping: 102800 is "₹1,028", 4550 is "₹45.50". */
export const rupees = (paise: number) => {
  const value = paise / 100;
  return `₹${value.toLocaleString("en-IN", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
};
