import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
import { renderIcon } from '../tools/icon.mjs';

test('renderIcon writes a square PNG with the art centred on the background', () => {
  const png = renderIcon({ rows: ['a.', '.a'], palette: { a: '#ff0000' }, background: '#000010' }, 8);
  assert.deepEqual([...png.subarray(1, 4)], [0x50, 0x4e, 0x47]);
  assert.equal(png.readUInt32BE(16), 8);
  assert.equal(png.readUInt32BE(20), 8);
  const idat = png.indexOf('IDAT');
  const raw = inflateSync(png.subarray(idat + 4, idat + 4 + png.readUInt32BE(idat - 4)));
  const at = (x, y) => [...raw.subarray(y * 33 + 1 + x * 4, y * 33 + 1 + x * 4 + 4)];
  // Scale 3 (3/4 of 8 over 2 pixels), offset 1: the first red block at 1..3.
  assert.deepEqual(at(0, 0), [0, 0, 16, 255]);
  assert.deepEqual(at(1, 1), [255, 0, 0, 255]);
  assert.deepEqual(at(4, 1), [0, 0, 16, 255]);
  assert.deepEqual(at(4, 4), [255, 0, 0, 255]);
});
