import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FakeInput } from '../src/input.js';
import { ConfirmBox } from '../src/ui.js';

test('ConfirmBox starts on no, moves, answers and closes', () => {
  const box = new ConfirmBox();
  const input = new FakeInput();
  box.open('SURE?');
  input.set(['start']);
  assert.equal(box.update(input), 'no');
  assert.equal(box.active, false);
  box.open('SURE?');
  input.set([]);
  box.update(input);
  input.set(['left']);
  assert.equal(box.update(input), null);
  input.set(['jump']);
  assert.equal(box.update(input), 'yes');
  box.open('SURE?');
  input.set(['pause']);
  assert.equal(box.update(input), 'no');
});
