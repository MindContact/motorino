// A camera that eases toward a target point, clamped to a rectangle (the
// map, or an arena) so the void past the edges never shows, with a decaying
// shake. Positions are the top-left of the view, in world pixels.

import { VIEW_W, VIEW_H } from './screen.js';

export class Camera {
  constructor({ w = VIEW_W, h = VIEW_H, ease = 0.1, easeY = 0.12 } = {}) {
    this.w = w;
    this.h = h;
    this.ease = ease;
    this.easeY = easeY;
    this.x = 0;
    this.y = 0;
    this.shake = 0;
    this.bounds = null; // { x, y, w, h } in world pixels
  }

  // The view position that centres (cx, cy), clamped to the bounds.
  aim(cx, cy) {
    let x = cx - this.w / 2;
    let y = cy - this.h / 2;
    const b = this.bounds;
    if (b) {
      x = b.w <= this.w ? b.x + (b.w - this.w) / 2 : Math.max(b.x, Math.min(b.x + b.w - this.w, x));
      y = b.h <= this.h ? b.y + (b.h - this.h) / 2 : Math.max(b.y, Math.min(b.y + b.h - this.h, y));
    }
    return { x, y };
  }

  snap(cx, cy) {
    const t = this.aim(cx, cy);
    this.x = t.x;
    this.y = t.y;
  }

  follow(cx, cy) {
    const t = this.aim(cx, cy);
    this.x += (t.x - this.x) * this.ease;
    this.y += (t.y - this.y) * this.easeY;
    if (this.shake > 0) this.shake *= 0.85;
    if (this.shake < 0.3) this.shake = 0;
  }

  // The integer offset to draw with, shake included. `rand` is passed in so
  // the simulation can stay free of Math.random if it wants.
  view(rand = Math.random) {
    const s = this.shake;
    return {
      x: Math.round(this.x + (s ? (rand() - 0.5) * s : 0)),
      y: Math.round(this.y + (s ? (rand() - 0.5) * s : 0)),
    };
  }

  visible(x, y, margin = 32) {
    return x > this.x - margin && x < this.x + this.w + margin && y > this.y - margin && y < this.y + this.h + margin;
  }
}
