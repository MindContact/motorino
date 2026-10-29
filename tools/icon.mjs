#!/usr/bin/env node
// Makes a game's app icons (PWA, home screen, favicon) from pixel art drawn
// as text, the same way as the sprites: a module exporting
//
//   export const ICON = { rows: ['..ab..', ...], palette: { a: '#fff' }, background: '#000' };
//
// The art is scaled by whole numbers and centred in the middle 3/4 of a
// square filled with the background, so the same image works as a plain
// and as a "maskable" icon (Android crops it to a circle or a squircle).
//
//   node lib/motorino/tools/icon.mjs src/icon.js icons/
//
// Writes icon-32.png, icon-180.png, icon-192.png and icon-512.png.

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { deflateSync } from 'node:zlib';

const SIZES = [32, 180, 192, 512];

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

// RGBA pixels (w*h*4) to a PNG file.
export function encodePNG(w, h, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(w, 0);
  header.writeUInt32BE(h, 4);
  header.set([8, 6, 0, 0, 0], 8); // 8 bits, RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // no filter
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

export function renderIcon({ rows, palette, background }, size) {
  const artW = Math.max(...rows.map((r) => r.length));
  const artH = rows.length;
  const scale = Math.max(1, Math.floor((size * 0.75) / Math.max(artW, artH)));
  const ox = Math.floor((size - artW * scale) / 2);
  const oy = Math.floor((size - artH * scale) / 2);
  const px = Buffer.alloc(size * size * 4);
  const bg = rgb(background);
  for (let i = 0; i < size * size; i++) px.set([...bg, 255], i * 4);
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (!palette[ch]) return;
    const c = [...rgb(palette[ch]), 255];
    for (let dy = 0; dy < scale; dy++) {
      for (let dx = 0; dx < scale; dx++) px.set(c, ((oy + y * scale + dy) * size + ox + x * scale + dx) * 4);
    }
  }));
  return encodePNG(size, size, px);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [src, out = 'icons'] = process.argv.slice(2);
  if (!src) {
    console.error('Uso: node tools/icon.mjs <icona.js> [cartella]');
    process.exit(2);
  }
  const { ICON } = await import(pathToFileURL(resolve(src)).href);
  mkdirSync(out, { recursive: true });
  for (const size of SIZES) writeFileSync(`${out}/icon-${size}.png`, renderIcon(ICON, size));
  console.log(`${SIZES.map((s) => `icon-${s}.png`).join(' ')} → ${out}/`);
}
