import { test } from 'node:test';
import assert from 'node:assert/strict';
import { textWidth, wrapText } from '../src/font.js';

test('wrapText breaks at spaces within the width', () => {
  const lines = wrapText('UNO DUE TRE QUATTRO', textWidth('UNO DUE'));
  assert.deepEqual(lines, ['UNO DUE', 'TRE', 'QUATTRO']);
  assert.deepEqual(wrapText('A\nB', 100), ['A', 'B']);
});

test('Italian accented letters keep one cell each', () => {
  assert.equal(textWidth('GRAVITÀ GIÙ'), textWidth('GRAVITA GIU'));
});
