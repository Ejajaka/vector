"use strict";

/**
 * Vector icon generator.
 *
 * Draws a rounded-square gradient tile with a white "V" and writes PNG files
 * at 16/32/48/128 px. Pure Node (zlib only), so no image libraries needed.
 *
 * Run:  node tools/make-icons.js
 */

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const OUT_DIR = path.join(__dirname, "..", "media");
const SIZES = [16, 32, 48, 128];

const C1 = [99, 102, 241]; // #6366f1
const C2 = [14, 165, 233]; // #0ea5e9

function crcTable() {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
}
const CRC = crcTable();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy || 1;
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

function lerp(a, b, t) {
  return Math.round(a + (b - a) * t);
}

function renderPixels(size) {
  const px = Buffer.alloc(size * size * 4);
  const radius = size * 0.22;
  const stroke = size * 0.085;
  const ax = size * 0.30, ay = size * 0.30;
  const bx = size * 0.50, by = size * 0.72;
  const cx = size * 0.70, cy = size * 0.30;

  function insideRounded(x, y) {
    const left = radius, right = size - 1 - radius;
    const cxr = Math.min(Math.max(x, left), right);
    const cyr = Math.min(Math.max(y, left), right);
    if (x >= left && x <= right) return y >= 0 && y <= size - 1;
    if (y >= left && y <= right) return x >= 0 && x <= size - 1;
    return Math.hypot(x - cxr, y - cyr) <= radius;
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const inside = insideRounded(x + 0.5, y + 0.5);
      if (!inside) {
        px[i] = px[i + 1] = px[i + 2] = px[i + 3] = 0;
        continue;
      }
      const t = (x + y) / (2 * size);
      let r = lerp(C1[0], C2[0], t);
      let g = lerp(C1[1], C2[1], t);
      let b = lerp(C1[2], C2[2], t);

      const d1 = distToSegment(x + 0.5, y + 0.5, ax, ay, bx, by);
      const d2 = distToSegment(x + 0.5, y + 0.5, cx, cy, bx, by);
      const onV = Math.min(d1, d2) <= stroke;
      if (onV) {
        r = g = b = 255;
      }
      px[i] = r;
      px[i + 1] = g;
      px[i + 2] = b;
      px[i + 3] = 255;
    }
  }
  return px;
}

function encodePng(size, pixels) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

for (const size of SIZES) {
  const png = encodePng(size, renderPixels(size));
  const file = path.join(OUT_DIR, "icon" + size + ".png");
  fs.writeFileSync(file, png);
  console.log("wrote " + path.relative(path.join(__dirname, ".."), file) + " (" + png.length + " bytes)");
}

// 300x300 store-listing logo (Edge recommends 300, minimum 128).
const storeLogo = encodePng(300, renderPixels(300));
const storeFile = path.join(OUT_DIR, "store-logo-300.png");
fs.writeFileSync(storeFile, storeLogo);
console.log("wrote " + path.relative(path.join(__dirname, ".."), storeFile) + " (" + storeLogo.length + " bytes)");
