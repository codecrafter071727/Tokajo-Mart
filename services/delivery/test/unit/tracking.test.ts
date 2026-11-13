import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createLocalPodStorage, podKey } from "../../src/modules/delivery/pod-storage";
import { distanceMetres, etaMinutes } from "../../src/modules/delivery/tracking";

describe("distance and ETA", () => {
  it("measures straight line distance", () => {
    expect(distanceMetres(28.61, 77.35, 28.61, 77.35)).toBe(0);
    // One hundredth of a degree of latitude is about 1.11 km
    expect(distanceMetres(28.61, 77.35, 28.62, 77.35)).toBeCloseTo(1112, -1);
  });

  it("gives at least a minute, at a city riding speed", () => {
    expect(etaMinutes(0)).toBe(1);
    expect(etaMinutes(3)).toBe(10);
  });
});

describe("local photo storage", () => {
  it("writes and reads by delivery id, and refuses anything else", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "pod-"));
    try {
      const storage = createLocalPodStorage(dir);
      const key = podKey("88880000-0000-4000-8000-000000000001");
      await storage.put(key, Buffer.from([0xff, 0xd8, 0xff, 1]));
      expect((await storage.get(key))?.length).toBe(4);
      expect(await storage.get(podKey("88880000-0000-4000-8000-000000000002"))).toBeNull();
      await expect(storage.put("pod/../../etc/passwd", Buffer.from("x"))).rejects.toThrow(/Unsafe/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
