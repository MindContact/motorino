// Cosmetic particles: position, velocity, a gravity vector, life, colour,
// size and a `glow` flag for additive drawing. Never part of the simulated
// state, so a solver can swap `add` for a no-op.

export class Particles {
  constructor(max = 400) {
    this.max = max;
    this.list = [];
  }

  add(x, y, vx, vy, life, color, size = 1, gx = 0, gy = 0, glow = false) {
    if (this.list.length >= this.max) return;
    this.list.push({ x, y, vx, vy, life, max: life, color, size, gx, gy, glow });
  }

  update() {
    const ps = this.list;
    let n = 0;
    for (let i = 0; i < ps.length; i++) {
      const q = ps[i];
      q.vx += q.gx;
      q.vy += q.gy;
      q.x += q.vx;
      q.y += q.vy;
      if (--q.life > 0) ps[n++] = q;
    }
    ps.length = n;
  }

  // Draws in world coordinates offset by the camera. Glowing ones go on in
  // a second, additive pass.
  draw(ctx, cam) {
    for (const glow of [false, true]) {
      if (glow) ctx.globalCompositeOperation = 'lighter';
      for (const q of this.list) {
        if (q.glow !== glow) continue;
        ctx.globalAlpha = Math.min(1, (q.life / q.max) * 2);
        ctx.fillStyle = q.color;
        ctx.fillRect(Math.round(q.x - cam.x - q.size / 2), Math.round(q.y - cam.y - q.size / 2), q.size, q.size);
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}
