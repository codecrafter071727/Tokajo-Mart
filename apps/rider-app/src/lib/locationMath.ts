import type { LocationObject } from "expo-location";

/** The server accepts one reading every few seconds, so the phone sends at most this often. */
export const SEND_EVERY_MS = 6000;

export type Reading = {
  lat: number;
  lng: number;
  accuracyM: number | null;
  heading: number | null;
  speed: number | null;
  recordedAt: string;
};

export function toReading(position: LocationObject): Reading {
  const { latitude, longitude, accuracy, heading, speed } = position.coords;
  const okHeading = heading !== null && heading >= 0 && heading < 360 ? heading : null;
  return {
    lat: latitude,
    lng: longitude,
    accuracyM: accuracy ?? null,
    heading: okHeading,
    speed: speed !== null && speed >= 0 ? Math.min(speed, 100) : null,
    recordedAt: new Date(position.timestamp).toISOString(),
  };
}

/**
 * True when a reading should go to the server now: never closer together than SEND_EVERY_MS.
 * Pure, so it can be tested without a phone.
 */
export function shouldSend(lastSentAt: number | null, now: number): boolean {
  return lastSentAt === null || now - lastSentAt >= SEND_EVERY_MS;
}
