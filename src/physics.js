// Platformer bodies whose gravity can point at any of the four sides. The
// body thinks in a local frame: `vt` runs along the floor (positive is
// "forward", the way an unflipped sprite faces) and `vn` along gravity
// (positive is falling). Collisions happen in world space on the
// axis-aligned box, one axis at a time, against a TileMap.
//
// The frame for each gravity is the sprite's turn (see sprites.js TURNS):
// rotate "down" (0,1) and "forward" (1,0) clockwise by quarter turns. So on
// the left wall forward is screen-down, on the ceiling it is screen-left.
//
// The feel is Vulcano's: coyote time, jump buffer, variable jump height with
// lighter gravity while the button is held. Units are pixels and updates;
// speeds stay under one tile per update, so a box never skips a wall.

import { TILE } from './tilemap.js';
import { TURNS } from './sprites.js';

export const GRAVITY = {
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  up: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
};

// Forward along the floor for each gravity.
export const FORWARD = {
  down: { x: 1, y: 0 },
  left: { x: 0, y: 1 },
  up: { x: -1, y: 0 },
  right: { x: 0, y: -1 },
};

export const OPPOSITE = { down: 'up', up: 'down', left: 'right', right: 'left' };

// Vulcano's tuning: a full jump of about 53 px, a tapped one of about 10.
export const DEFAULT_TUNING = {
  gravityUp: 0.32, // while rising with jump held
  gravityDown: 0.4,
  jumpSpeed: 6,
  jumpCut: 2, // rising speed kept when jump is released
  maxFall: 6.5,
  runSpeed: 1.9,
  groundAccel: 0.25,
  airAccel: 0.2,
  friction: 0.3,
  airDrag: 0.96,
  coyote: 6,
  jumpBuffer: 7,
};

const EPS = 0.01;
const MAX_STEP = TILE - 1;

export class Body {
  // (x, y) is the top-left of the box when standing on the floor; w and h
  // are the size in the local frame (width along the floor, height off it).
  constructor(x, y, w, h, tuning = {}) {
    this.tune = { ...DEFAULT_TUNING, ...tuning };
    this.w = w;
    this.h = h;
    this.gravity = 'down';
    this.x = x;
    this.y = y;
    this.vt = 0;
    this.vn = 0;
    this.facing = 1;
    this.ground = false;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.jumpHeld = false;
    this.dropThrough = 0;
    // Sides touched in the last move, in world terms and in local terms.
    this.touch = { left: false, right: false, up: false, down: false };
    this.hitCeiling = false;
    this.hitWall = 0; // +1 forward, -1 backward, 0 none
  }

  get vertical() { return this.gravity === 'down' || this.gravity === 'up'; }
  // World size of the box.
  get bw() { return this.vertical ? this.w : this.h; }
  get bh() { return this.vertical ? this.h : this.w; }
  get cx() { return this.x + this.bw / 2; }
  get cy() { return this.y + this.bh / 2; }
  get g() { return GRAVITY[this.gravity]; }
  get f() { return FORWARD[this.gravity]; }
  get turn() { return TURNS[this.gravity]; }

  // Where the feet touch the floor: the centre of the box side that faces
  // gravity. Sprites are drawn anchored here.
  get feet() {
    const g = this.g;
    return { x: this.cx + (g.x * this.bw) / 2, y: this.cy + (g.y * this.bh) / 2 };
  }

  get vx() { return this.vt * this.f.x + this.vn * this.g.x; }
  get vy() { return this.vt * this.f.y + this.vn * this.g.y; }

  setWorldVelocity(vx, vy) {
    this.vt = vx * this.f.x + vy * this.f.y;
    this.vn = vx * this.g.x + vy * this.g.y;
  }

  // Turns gravity to `dir`, keeping the world velocity, the box centre and
  // the facing on screen when it can (a quarter turn keeps the local facing,
  // so walking on carries you up or down the new floor). The box is then
  // nudged out of any wall it now overlaps and settled onto the floor if it
  // is within a few pixels.
  setGravity(dir, map) {
    if (dir === this.gravity) return;
    const vx = this.vx;
    const vy = this.vy;
    const fx = this.facing * this.f.x;
    const fy = this.facing * this.f.y;
    const cx = this.cx;
    const cy = this.cy;
    this.gravity = dir;
    this.setWorldVelocity(vx, vy);
    const dot = fx * this.f.x + fy * this.f.y;
    if (dot) this.facing = Math.sign(dot);
    this.x = cx - this.bw / 2;
    this.y = cy - this.bh / 2;
    if (map) {
      this.unstick(map);
      this.settle(map, 4);
    }
    this.coyote = 0;
    this.jumpBuffer = 0;
  }

  overlaps(map, x = this.x, y = this.y) {
    const x0 = Math.floor(x / TILE);
    const x1 = Math.floor((x + this.bw - EPS) / TILE);
    const y0 = Math.floor(y / TILE);
    const y1 = Math.floor((y + this.bh - EPS) / TILE);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) if (map.solid(tx, ty)) return true;
    }
    return false;
  }

  // Pushes the box out of solid tiles: away from the floor first, then
  // either way along it. Gives up after a tile's worth.
  unstick(map) {
    if (!this.overlaps(map)) return true;
    const g = this.g;
    const f = this.f;
    for (let d = 1; d <= TILE; d++) {
      for (const [ux, uy] of [[-g.x, -g.y], [f.x, f.y], [-f.x, -f.y], [g.x, g.y]]) {
        if (!this.overlaps(map, this.x + ux * d, this.y + uy * d)) {
          this.x += ux * d;
          this.y += uy * d;
          return true;
        }
      }
    }
    return false;
  }

  // Moves along gravity until the floor, at most `max` pixels.
  settle(map, max) {
    const g = this.g;
    for (let d = 0; d <= max; d++) {
      if (this.overlaps(map, this.x + g.x * (d + 1), this.y + g.y * (d + 1))) {
        this.x += g.x * d;
        this.y += g.y * d;
        this.ground = true;
        this.vn = Math.min(this.vn, 0);
        return true;
      }
    }
    return false;
  }

  // One update of control and motion. `ctl`:
  //   move       -1..1 along the floor (see screenMove)
  //   jump       jump pressed this update
  //   jumpHeld   jump held
  //   drop       ask to fall through a one-way floor
  // Returns the vn the body had when it landed, or 0 if it did not land.
  step(map, ctl = {}) {
    const t = this.tune;
    const move = ctl.move || 0;
    const accel = this.ground ? t.groundAccel : t.airAccel;
    if (move) {
      this.vt += move * accel;
      if (Math.abs(this.vt) > t.runSpeed) this.vt = Math.sign(this.vt) * t.runSpeed;
      this.facing = Math.sign(move);
    } else if (this.ground) {
      this.vt = Math.abs(this.vt) <= t.friction ? 0 : this.vt - Math.sign(this.vt) * t.friction;
    } else {
      this.vt *= t.airDrag;
    }

    if (this.ground) this.coyote = t.coyote;
    else if (this.coyote > 0) this.coyote--;
    if (ctl.jump) this.jumpBuffer = t.jumpBuffer;
    else if (this.jumpBuffer > 0) this.jumpBuffer--;

    if (this.jumpBuffer > 0 && this.coyote > 0) {
      if (ctl.drop && this.onOneWay(map)) {
        this.dropThrough = 10;
        this.x += this.g.x;
        this.y += this.g.y;
      } else {
        this.vn = -t.jumpSpeed;
        this.jumpHeld = true;
        this.jumped = true;
      }
      this.jumpBuffer = 0;
      this.coyote = 0;
      this.ground = false;
    } else {
      this.jumped = false;
    }
    if (this.jumpHeld && !ctl.jumpHeld) {
      if (this.vn < -t.jumpCut) this.vn = -t.jumpCut;
      this.jumpHeld = false;
    }
    if (this.dropThrough > 0) this.dropThrough--;

    this.vn += this.vn < 0 && ctl.jumpHeld ? t.gravityUp : t.gravityDown;
    if (this.vn > t.maxFall) this.vn = t.maxFall;

    const fall = this.vn;
    const wasGround = this.ground;
    this.move(map);
    return this.ground && !wasGround ? fall : 0;
  }

  // Moves by the current velocity, x then y, and records what was hit.
  move(map) {
    let vx = Math.max(-MAX_STEP, Math.min(MAX_STEP, this.vx));
    let vy = Math.max(-MAX_STEP, Math.min(MAX_STEP, this.vy));
    const touch = { left: false, right: false, up: false, down: false };
    if (this.moveAxis(map, 'x', vx)) {
      touch[vx > 0 ? 'right' : 'left'] = true;
      vx = 0;
    }
    if (this.moveAxis(map, 'y', vy)) {
      touch[vy > 0 ? 'down' : 'up'] = true;
      vy = 0;
    }
    this.setWorldVelocity(vx, vy);
    this.touch = touch;
    this.ground = touch[this.gravity];
    this.hitCeiling = touch[OPPOSITE[this.gravity]];
    const f = this.f;
    const ahead = f.x > 0 ? 'right' : f.x < 0 ? 'left' : f.y > 0 ? 'down' : 'up';
    this.hitWall = touch[ahead] ? 1 : touch[OPPOSITE[ahead]] ? -1 : 0;
    if (this.ground) this.vn = Math.min(this.vn, 0);
  }

  // Moves the box `d` pixels along one world axis; returns true if a tile
  // stopped it. One-way tiles stop it only along gravity, coming from
  // outside, and not while dropping through.
  moveAxis(map, axis, d) {
    if (!d) return false;
    const horiz = axis === 'x';
    const size = horiz ? this.bw : this.bh;
    const pos = horiz ? this.x : this.y;
    const other = horiz ? this.y : this.x;
    const otherSize = horiz ? this.bh : this.bw;
    const g = this.g;
    const alongGravity = (horiz ? g.x : g.y) === Math.sign(d);
    const next = pos + d;
    const lead = d > 0 ? next + size : next;
    const t = Math.floor(d > 0 ? lead / TILE : lead / TILE);
    const prevLead = d > 0 ? pos + size : pos;
    const o0 = Math.floor(other / TILE);
    const o1 = Math.floor((other + otherSize - EPS) / TILE);
    let hit = false;
    for (let o = o0; o <= o1 && !hit; o++) {
      const tx = horiz ? t : o;
      const ty = horiz ? o : t;
      if (map.solid(tx, ty)) hit = true;
      else if (alongGravity && this.dropThrough === 0 && map.oneWay(tx, ty)) {
        const edge = d > 0 ? t * TILE : (t + 1) * TILE;
        hit = d > 0 ? prevLead <= edge + EPS : prevLead >= edge - EPS;
      }
    }
    const placed = hit ? (d > 0 ? t * TILE - size : (t + 1) * TILE) : next;
    if (horiz) this.x = placed;
    else this.y = placed;
    return hit;
  }

  // Tile codes just past one side of the box ('up', 'down', 'left',
  // 'right', in world terms): what the body leans on there. Lets a game ask
  // what kind of surface it touched (magnetic or not, icy, electrified).
  touching(map, side) {
    const out = [];
    const horiz = side === 'left' || side === 'right';
    const edge = side === 'right' ? this.x + this.bw : side === 'down' ? this.y + this.bh : side === 'left' ? this.x - 1 : this.y - 1;
    const t = Math.floor(edge / TILE);
    const from = horiz ? this.y : this.x;
    const size = horiz ? this.bh : this.bw;
    for (let o = Math.floor(from / TILE); o <= Math.floor((from + size - EPS) / TILE); o++) {
      out.push(horiz ? map.get(t, o) : map.get(o, t));
    }
    return out;
  }

  // True if standing only on one-way tiles (and air), so down + jump drops.
  onOneWay(map) {
    const g = this.g;
    const f = this.f;
    const feet = this.feet;
    // The two tiles just past the feet, at either end of the sole.
    const half = this.w / 2 - EPS;
    const probe = (s) => {
      const px = feet.x + g.x + f.x * s;
      const py = feet.y + g.y + f.y * s;
      return [Math.floor(px / TILE), Math.floor(py / TILE)];
    };
    const [a, b] = [probe(-half), probe(half)];
    if (map.solid(...a) || map.solid(...b)) return false;
    return map.oneWay(...a) || map.oneWay(...b);
  }
}

// Turns screen directions into a move along the floor, so the arrows mean
// what they show: left/right on floors and ceilings, up/down on walls.
// `held(name)` tells whether a direction is held.
export function screenMove(body, held) {
  const dx = (held('right') ? 1 : 0) - (held('left') ? 1 : 0);
  const dy = (held('down') ? 1 : 0) - (held('up') ? 1 : 0);
  const f = body.f;
  return Math.sign(dx * f.x + dy * f.y);
}
