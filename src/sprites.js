// Pixel-art sprites drawn as text, one character per pixel, and baked once
// into small canvases. '.' (or any character missing from the palette) is
// transparent. Sprites face right and stand on their bottom edge; the draw
// call mirrors them and turns them to stand on any of the four sides.

function newCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function bake(rows, palette) {
  const w = rows[0].length;
  const h = rows.length;
  const c = newCanvas(w, h);
  const g = c.getContext('2d');
  rows.forEach((row, y) => {
    if (row.length !== w) throw new Error(`sprite row ${y} is ${row.length} wide, not ${w}: ${row}`);
    for (let x = 0; x < w; x++) {
      const col = palette[row[x]];
      if (!col) continue;
      g.fillStyle = col;
      g.fillRect(x, y, 1, 1);
    }
  });
  return c;
}

// Same rows with some palette characters swapped: a recolour.
export const recolor = (rows, map) => rows.map((r) => r.replace(/./g, (c) => map[c] || c));

// Quarter turns that make a sprite stand on the surface its gravity points
// at: feet down, on a ceiling, on a left or right wall.
export const TURNS = { down: 0, left: 1, up: 2, right: 3 };

// Draws `img` with its bottom-centre at (x, y), the point where its feet
// touch the ground. `flip` mirrors it, `turn` rotates it clockwise by
// quarter turns about that point.
export function drawSprite(ctx, img, x, y, { flip = false, turn = 0 } = {}) {
  const t = ((turn % 4) + 4) % 4;
  if (!flip && t === 0) {
    ctx.drawImage(img, Math.round(x - img.width / 2), Math.round(y - img.height));
    return;
  }
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  if (t) ctx.rotate((t * Math.PI) / 2);
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(img, -Math.round(img.width / 2), -img.height);
  ctx.restore();
}
