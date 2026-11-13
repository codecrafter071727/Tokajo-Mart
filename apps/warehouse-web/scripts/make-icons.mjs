// Draws the installable app icons as PNG files with no image libraries: a brand green tile with a
// dark "T" for Tokajo. Run from apps/warehouse-web: node scripts/make-icons.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { deflateSync } from "node:zlib";

const OUT = path.join(import.meta.dirname, "..", "public", "icons");
const GREEN = [0x42, 0xc8, 0x6e];
const INK = [0x14, 0x20, 0x1e];

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function png(size, pixel) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y += 1) {
    raw[y * (size * 4 + 1)] = 0; // no filter
    for (let x = 0; x < size; x += 1) {
      const [r, g, b, a] = pixel(x + 0.5, y + 0.5);
      const i = y * (size * 4 + 1) + 1 + x * 4;
      raw[i] = r;
      raw[i + 1] = g;
      raw[i + 2] = b;
      raw[i + 3] = a;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// Signed distance to a rounded rectangle centred at (cx, cy), negative inside
function roundedRect(x, y, cx, cy, w, h, r) {
  const dx = Math.abs(x - cx) - (w / 2 - r);
  const dy = Math.abs(y - cy) - (h / 2 - r);
  const outside = Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
  return outside + Math.min(Math.max(dx, dy), 0) - r;
}
const cover = (d) => Math.min(1, Math.max(0, 0.5 - d)); // one pixel of anti aliasing
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

/** `inset` shrinks the letter so it stays inside the safe zone of a maskable icon. */
function icon(size, { tile, inset }) {
  const s = size / 512;
  const k = s * inset;
  const c = size / 2;
  return png(size, (x, y) => {
    const tileCover = tile ? cover(roundedRect(x, y, c, c, size, size, 112 * s)) : 1;
    // The T: a cross bar and a stem with soft corners
    const bar = roundedRect(x, y, c, c - 92 * k, 300 * k, 88 * k, 30 * k);
    const stem = roundedRect(x, y, c, c + 40 * k, 92 * k, 300 * k, 30 * k);
    const t = cover(Math.min(bar, stem));
    const [r, g, b] = mix(GREEN, INK, t);
    return [r, g, b, Math.round(255 * tileCover)];
  });
}

mkdirSync(OUT, { recursive: true });
const files = {
  "icon-192.png": icon(192, { tile: true, inset: 1 }),
  "icon-512.png": icon(512, { tile: true, inset: 1 }),
  // Full bleed with the letter inside the central 80%, so launchers can crop it to any shape
  "maskable-512.png": icon(512, { tile: false, inset: 0.78 }),
  "apple-touch-icon.png": icon(180, { tile: false, inset: 0.86 }),
};
for (const [name, data] of Object.entries(files)) {
  writeFileSync(path.join(OUT, name), data);
  console.log(`wrote public/icons/${name} (${data.length} bytes)`);
}
