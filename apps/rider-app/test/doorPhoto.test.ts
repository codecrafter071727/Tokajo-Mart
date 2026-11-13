import { describe, expect, it } from "vitest";
import { base64Bytes, checkPhoto, isJpegBase64, stripDataUrl } from "../src/lib/photoChecks";
import { SEND_EVERY_MS, shouldSend, toReading } from "../src/lib/locationMath";

const jpeg = (bytes: number) => {
  const b = Buffer.alloc(bytes, 7);
  b[0] = 0xff;
  b[1] = 0xd8;
  b[2] = 0xff;
  return b.toString("base64");
};

describe("door photo checks", () => {
  it("knows the decoded size without decoding", () => {
    for (const n of [1, 2, 3, 100, 1001])
      expect(base64Bytes(Buffer.alloc(n).toString("base64"))).toBe(n);
  });

  it("accepts a JPEG under the limit and explains anything else", () => {
    expect(isJpegBase64(jpeg(500))).toBe(true);
    expect(checkPhoto(jpeg(500))).toBeNull();
    expect(checkPhoto(Buffer.from("PNG....").toString("base64"))).toMatch(/JPEG/);
    expect(checkPhoto(jpeg(1_600_000))).toMatch(/too large/);
  });

  it("strips a data URL prefix", () => {
    expect(stripDataUrl("data:image/jpeg;base64,/9j/abc")).toBe("/9j/abc");
    expect(stripDataUrl("/9j/abc")).toBe("/9j/abc");
  });
});

describe("location sharing", () => {
  it("sends at most every few seconds", () => {
    expect(shouldSend(null, 1000)).toBe(true);
    expect(shouldSend(1000, 1000 + SEND_EVERY_MS - 1)).toBe(false);
    expect(shouldSend(1000, 1000 + SEND_EVERY_MS)).toBe(true);
  });

  it("turns a phone reading into what the server accepts", () => {
    const reading = toReading({
      coords: {
        latitude: 28.6,
        longitude: 77.3,
        accuracy: 9,
        heading: -1,
        speed: 250,
        altitude: null,
        altitudeAccuracy: null,
      },
      timestamp: Date.parse("2026-11-13T10:00:00Z"),
    });
    expect(reading).toEqual({
      lat: 28.6,
      lng: 77.3,
      accuracyM: 9,
      heading: null,
      speed: 100,
      recordedAt: "2026-11-13T10:00:00.000Z",
    });
  });
});
