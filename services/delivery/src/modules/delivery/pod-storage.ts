import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Where door photos live. Local disk in development; an S3 compatible bucket can implement the
 * same two calls later without touching the routes.
 */
export interface PodStorage {
  put(key: string, bytes: Buffer): Promise<void>;
  /** Null when there is no such file */
  get(key: string): Promise<Buffer | null>;
}

/** Keys are made by the service from a delivery id, never from user input, and still checked. */
const SAFE_KEY = /^pod\/[0-9a-f-]{36}\.jpg$/;

export function podKey(deliveryId: string): string {
  return `pod/${deliveryId}.jpg`;
}

export function createLocalPodStorage(dir: string): PodStorage {
  const root = path.resolve(dir);
  const fileOf = (key: string) => {
    if (!SAFE_KEY.test(key)) throw new Error("Unsafe storage key.");
    const file = path.resolve(root, key.replace(/^pod\//, ""));
    if (!file.startsWith(`${root}${path.sep}`)) throw new Error("Unsafe storage key.");
    return file;
  };
  return {
    async put(key, bytes) {
      const file = fileOf(key);
      await mkdir(path.dirname(file), { recursive: true });
      // Write then rename, so a reader never sees half a photo
      const tmp = `${file}.${process.pid}.tmp`;
      await writeFile(tmp, bytes);
      await rename(tmp, file);
    },
    async get(key) {
      try {
        return await readFile(fileOf(key));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
      }
    },
  };
}

/** In memory, for tests */
export function createMemoryPodStorage(): PodStorage & { files: Map<string, Buffer> } {
  const files = new Map<string, Buffer>();
  return {
    files,
    async put(key, bytes) {
      files.set(key, Buffer.from(bytes));
    },
    async get(key) {
      return files.get(key) ?? null;
    },
  };
}
