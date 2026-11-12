import { createApiClient } from "@qc/api-client";

/**
 * Gateway origin, for example http://192.168.1.5:4000. Per service URLs override it for local
 * development while the gateway does not route to the services yet. When none is set the app runs
 * on the bundled fixtures, so Expo Go keeps working with no backend running.
 */
const gateway = process.env.EXPO_PUBLIC_API_URL;
const catalog = process.env.EXPO_PUBLIC_CATALOG_URL;
const inventory = process.env.EXPO_PUBLIC_INVENTORY_URL;

const baseUrl = gateway ?? catalog ?? inventory;

export const apiEnabled = Boolean(baseUrl);

export const api = baseUrl
  ? createApiClient({ baseUrl, serviceUrls: { catalog, inventory } })
  : null;
