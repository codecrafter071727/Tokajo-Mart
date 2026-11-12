/**
 * Where the app falls back to when no address is selected. The selected address
 * (src/store/addresses.ts) is what the app really uses.
 */
export const DEFAULT_LOCATION = {
  lat: 28.628,
  lng: 77.365,
  label: "Sector 62, Noida",
} as const;
