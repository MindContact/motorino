import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMap, TileMap, TILE } from '../src/tilemap.js';
import { Body, screenMove } from '../src/physics.js';

const LEGEND = { ' ': {}, '#': { tile: 1 }, '=': { tile: 2 }, P: { spawn: 'start' } };

function room(rows) {
  const parsed = parseMap(rows, LEGEND);
  const map = new TileMap(parsed, { solid: [1], oneWay: [2], edges: { left: 1, right: 1, top: 1, bottom: 1 } });
  const s = parsed.spawns.find((e) => e.kind === 'start');
  const body = new Body(s.x * TILE + 3, s.y * TILE + 2, 10, 14);
  return { map, body };
}

function run(map, body, n, ctl = {}) {
  let landed = 0;
  for (let i = 0; i < n; i++) landed = body.step(map, typeof ctl === 'function' ? ctl(i) : ctl) || landed;
  return landed;
}

const BOX = [
  '##########',
  '#        #',
  '#        #',
  '#        #',
  '#   P    #',
  '##########',
];

test('parseMap rejects ragged rows and unknown characters', () => {
  assert.throws(() => parseMap(['##', '#'], LEGEND), /row 1 is 1 wide/);
  assert.throws(() => parseMap(['#x'], LEGEND), /unknown character "x"/);
});

test('a body falls and lands on the floor', () => {
  const { map, body } = room(BOX);
  run(map, body, 30);
  assert.equal(body.ground, true);
  assert.equal(body.y + body.bh, 5 * TILE);
});

test('a full jump rises about 53 px, as in Vulcano', () => {
  const { map, body } = room([
    '##########',
    ...Array(8).fill('#        #'),
    '#   P    #',
    '##########',
  ]);
  run(map, body, 10);
  const floor = body.y;
  let top = floor;
  run(map, body, 60, (i) => { top = Math.min(top, body.y); return { jump: i === 0, jumpHeld: true }; });
  assert.ok(floor - top > 50 && floor - top < 56, `rose ${floor - top}`);
});

test('gravity up: the body falls to the ceiling and stands there', () => {
  const { map, body } = room(BOX);
  run(map, body, 30);
  body.setGravity('up', map);
  run(map, body, 40);
  assert.equal(body.ground, true);
  assert.equal(body.y, TILE);
  assert.equal(body.turn, 2);
});

test('gravity left: the box turns sideways and lands on the wall', () => {
  const { map, body } = room(BOX);
  run(map, body, 30);
  body.setGravity('left', map);
  assert.equal(body.bw, 14);
  assert.equal(body.bh, 10);
  run(map, body, 60);
  assert.equal(body.ground, true);
  assert.equal(body.x, TILE);
  assert.ok(!body.overlaps(map));
});

test('on a wall, walking runs along it and jumping leaves it', () => {
  const { map, body } = room(BOX);
  run(map, body, 30);
  body.setGravity('left', map);
  run(map, body, 60);
  const y0 = body.y;
  run(map, body, 20, { move: screenMove(body, (d) => d === 'up') });
  assert.ok(body.y < y0 - 10, 'moved up the wall');
  body.step(map, { jump: true, jumpHeld: true });
  run(map, body, 5, { jumpHeld: true });
  assert.ok(body.x > TILE + 10, 'jumped off the wall to the right');
});

test('changing gravity keeps the world velocity', () => {
  const { map, body } = room(BOX);
  body.setWorldVelocity(1.5, -2);
  body.setGravity('right', map);
  assert.ok(Math.abs(body.vx - 1.5) < 1e-9);
  assert.ok(Math.abs(body.vy + 2) < 1e-9);
});

test('one-way floor: jump up through, land on it, drop with down + jump', () => {
  const { map, body } = room([
    '##########',
    '#        #',
    '#        #',
    '#  ====  #',
    '#   P    #',
    '##########',
  ]);
  run(map, body, 20);
  body.step(map, { jump: true, jumpHeld: true });
  run(map, body, 60, { jumpHeld: true });
  assert.equal(body.ground, true);
  assert.equal(body.y + body.bh, 3 * TILE, 'stands on the one-way floor');
  body.step(map, { jump: true, jumpHeld: true, drop: true });
  run(map, body, 40);
  assert.equal(body.y + body.bh, 5 * TILE, 'dropped back to the floor');
});

test('hitting the ceiling is reported, so magnetic boots can flip', () => {
  const { map, body } = room(['##########', '#        #', '#   P    #', '##########']);
  run(map, body, 20);
  let hit = false;
  run(map, body, 30, (i) => { hit = hit || body.hitCeiling; return { jump: i === 0, jumpHeld: true }; });
  assert.ok(hit);
});

test('touching lists the tiles against one side', () => {
  const { map, body } = room(['##########', '#        #', '#P       #', '##########']);
  run(map, body, 20, { move: -1 });
  assert.deepEqual(body.touching(map, 'down'), [1]);
  assert.deepEqual(body.touching(map, 'left'), [1]);
  assert.deepEqual(body.touching(map, 'right'), [0]);
});
