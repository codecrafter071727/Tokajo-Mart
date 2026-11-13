import * as Location from "expo-location";
import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { create } from "zustand";
import { ApiError, authed, REAL_BACKEND } from "./api";
import { shouldSend, toReading } from "./locationMath";

export { SEND_EVERY_MS, shouldSend, toReading, type Reading } from "./locationMath";

export type SharingStatus = "off" | "asking" | "sharing" | "denied" | "unavailable";

type LocationState = {
  status: SharingStatus;
  /** When the server last accepted a reading */
  lastSentAt: number | null;
  set: (patch: Partial<Pick<LocationState, "status" | "lastSentAt">>) => void;
};

/** What the screens show about location sharing. Only the sharer below writes to it. */
export const useLocationStatus = create<LocationState>((set) => ({
  status: "off",
  lastSentAt: null,
  set: (patch) => set(patch),
}));

/**
 * Shares the rider's position while `enabled` (on duty with a delivery in progress), in the
 * foreground only. Asks for permission once with the system prompt; the screens explain why.
 */
export function useLocationSharing(enabled: boolean) {
  const set = useLocationStatus((s) => s.set);
  const lastSent = useRef<number | null>(null);
  const sending = useRef(false);

  useEffect(() => {
    if (!enabled || !REAL_BACKEND) {
      set({ status: "off" });
      return;
    }
    let cancelled = false;
    let subscription: Location.LocationSubscription | null = null;

    const send = async (position: Location.LocationObject) => {
      const now = Date.now();
      if (sending.current || !shouldSend(lastSent.current, now)) return;
      sending.current = true;
      try {
        await authed("/v1/delivery/me/location", { method: "POST", body: toReading(position) });
        lastSent.current = now;
        set({ status: "sharing", lastSentAt: now });
      } catch (error) {
        // Too soon or a glitchy reading: just wait for the next one
        if (error instanceof ApiError && (error.status === 429 || error.status === 422)) return;
        if (error instanceof ApiError && error.status === 409) set({ status: "off" });
      } finally {
        sending.current = false;
      }
    };

    (async () => {
      set({ status: "asking" });
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;
        if (permission.status !== "granted") {
          set({ status: "denied" });
          return;
        }
        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 5000,
            distanceInterval: Platform.OS === "web" ? 0 : 10,
          },
          (position) => void send(position),
        );
        if (cancelled) subscription.remove();
      } catch {
        if (!cancelled) set({ status: "unavailable" });
      }
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [enabled, set]);
}
