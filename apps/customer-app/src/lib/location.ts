/**
 * The delivery location the app uses. Fixed to the demo area until address capture and
 * expo-location land (week plan V5), then this comes from the selected address.
 */
export const DEFAULT_LOCATION = {
  lat: 28.628,
  lng: 77.365,
  label: "Sector 62, Noida",
} as const;
