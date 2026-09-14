/**
 * Generate the PWA icons (opaque gold "coin" tiles) with no image dependency —
 * writes public/icon-192.png, icon-512.png and apple-touch-icon.png.
 *   npm run gen:icons
 */
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

// CRC32 (PNG chunks).
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(type);
  const body = new Uint8Array(typeBytes.length + data.length);
  body.set(typeBytes, 0);
  body.set(data, typeBytes.length);
  const out = new Uint8Array(8 + body.length + 4);
  new DataView(out.buffer).setUint32(0, data.length, false);
  out.set(body, 4);
  new DataView(out.buffer).setUint32(4 + body.length, crc32(body), false);
  return out;
}

function coinRGBA(size: number): Uint8Array {
  // filter-byte-prefixed scanlines of RGBA.
  const row = size * 4 + 1;
  const raw = new Uint8Array(row * size);
  const cx = (size - 1) / 2;
  const cy = (size - 1) / 2;
  const rOuter = size * 0.4;
  const rRing = size * 0.34;
  const rInner = size * 0.28;
  for (let y = 0; y < size; y++) {
    raw[y * row] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - cx, y - cy);
      let r = 0xe6,
        g = 0xb4,
        b = 0x22; // base gold
      if (d < rInner) {
        r = 0xf3;
        g = 0xc8;
        b = 0x46; // lighter face
      } else if (d < rRing) {
        r = 0x9c;
        g = 0x6f;
        b = 0x12; // ring
      } else if (d > rOuter) {
        r = 0xc8;
        g = 0x90;
        b = 0x1a; // darker rim beyond the coin
      }
      const o = y * row + 1 + x * 4;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
      raw[o + 3] = 0xff; // opaque (iOS tiles must be opaque)
    }
  }
  return raw;
}

function png(size: number): Uint8Array {
  const sig = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, size, false);
  dv.setUint32(4, size, false);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const idat = deflateSync(coinRGBA(size));
  const parts = [sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", new Uint8Array(0))];
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

writeFileSync("public/icon-192.png", png(192));
writeFileSync("public/icon-512.png", png(512));
writeFileSync("public/apple-touch-icon.png", png(180));
console.log("Wrote public/icon-192.png, icon-512.png, apple-touch-icon.png");
