import { Platform } from "react-native";

/**
 * Where the app falls back to when no address is selected. The selected address
 * (src/store/addresses.ts) is what the app really uses.
 */
export const DEFAULT_LOCATION = {
  lat: 28.628,
  lng: 77.365,
  label: "Sector 62, Noida",
} as const;

export type DevicePosition = { lat: number; lng: number; accuracyM: number | null };

export class LocationError extends Error {
  readonly reason: "denied" | "unavailable" | "timeout";
  constructor(reason: LocationError["reason"], message: string) {
    super(message);
    this.name = "LocationError";
    this.reason = reason;
  }
}

const DENIED =
  "Location is turned off for this app. Allow it in settings, or pick your area below.";
const UNAVAILABLE = "We could not find your location. Pick your area below instead.";

/**
 * The phone's current position. Asks for permission only when the customer taps "Use my current
 * location". There is no reverse geocoding without a maps key, so the address lines are typed in.
 */
export async function getCurrentPosition(timeoutMs = 15_000): Promise<DevicePosition> {
  if (Platform.OS === "web") {
    const geo = globalThis.navigator?.geolocation;
    if (!geo) throw new LocationError("unavailable", UNAVAILABLE);
    return new Promise((resolve, reject) => {
      geo.getCurrentPosition(
        (p) =>
          resolve({
            lat: p.coords.latitude,
            lng: p.coords.longitude,
            accuracyM: p.coords.accuracy,
          }),
        (e) =>
          reject(
            e.code === 1
              ? new LocationError("denied", DENIED)
              : e.code === 3
                ? new LocationError("timeout", UNAVAILABLE)
                : new LocationError("unavailable", UNAVAILABLE),
          ),
        { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60_000 },
      );
    });
  }

  const Location = await import("expo-location");
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== "granted") throw new LocationError("denied", DENIED);
  try {
    const p = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new LocationError("timeout", UNAVAILABLE)), timeoutMs),
      ),
    ]);
    return {
      lat: p.coords.latitude,
      lng: p.coords.longitude,
      accuracyM: p.coords.accuracy ?? null,
    };
  } catch (e) {
    if (e instanceof LocationError) throw e;
    throw new LocationError("unavailable", UNAVAILABLE);
  }
}
