import { createApiClient } from "@qc/api-client";

/**
 * Gateway origin, for example http://192.168.1.5:4000 (or the catalog service on :4002 while the
 * gateway does not route yet). When it is not set the app runs on the bundled fixtures, so Expo Go
 * keeps working with no backend running.
 */
const baseUrl = process.env.EXPO_PUBLIC_API_URL;

export const apiEnabled = Boolean(baseUrl);

export const api = baseUrl ? createApiClient({ baseUrl }) : null;
