// Tile maps drawn as text, one character per tile. The game hands over a
// legend: each character names a tile code, a spawn, or both (a fire bubble
// is lava *and* a thing living in it). Codes are the game's own numbers;
// 0 is empty. Unknown characters and ragged rows are errors, reported with
// the row number: the usual slip in a hand-drawn map is one stray space.
//
//   legend = { ' ': {}, '#': { tile: 1 }, o: { spawn: 'gem' }, f: { tile: 4, spawn: 'bubble' } }

export const TILE = 16;

export function parseMap(rows, legend) {
  const h = rows.length;
  if (!h) throw new Error('empty map');
  const w = rows[0].length;
  const tiles = new Uint8Array(w * h);
  const spawns = [];
  rows.forEach((row, y) => {
    if (row.length !== w) throw new Error(`map row ${y} is ${row.length} wide, not ${w}: "${row}"`);
    for (let x = 0; x < w; x++) {
      const entry = legend[row[x]];
      if (!entry) throw new Error(`map row ${y} col ${x}: unknown character "${row[x]}"`);
      if (entry.tile) tiles[y * w + x] = entry.tile;
      if (entry.spawn) spawns.push({ kind: entry.spawn, x, y });
    }
  });
  return { w, h, tiles, spawns };
}

// A live map: a copy of the parsed tiles that the game may edit (crumbling
// floors, opened doors). `solid` is the set of codes that block movement;
// `edges` says what lies past each border.
export class TileMap {
  constructor({ w, h, tiles }, { solid = [], oneWay = [], edges = {} } = {}) {
    this.w = w;
    this.h = h;
    this.tiles = tiles.slice();
    this.solidCodes = new Set(solid);
    this.oneWayCodes = new Set(oneWay);
    this.edges = { left: 0, right: 0, top: 0, bottom: 0, ...edges };
  }

  get(tx, ty) {
    if (tx < 0) return this.edges.left;
    if (tx >= this.w) return this.edges.right;
    if (ty < 0) return this.edges.top;
    if (ty >= this.h) return this.edges.bottom;
    return this.tiles[ty * this.w + tx];
  }

  set(tx, ty, code) {
    if (tx >= 0 && tx < this.w && ty >= 0 && ty < this.h) this.tiles[ty * this.w + tx] = code;
  }

  solid(tx, ty) {
    return this.solidCodes.has(this.get(tx, ty));
  }

  // One-way tiles block only a body that comes at them along its gravity,
  // from outside (a floor you jump up through and land on).
  oneWay(tx, ty) {
    return this.oneWayCodes.has(this.get(tx, ty));
  }

  get pixelW() { return this.w * TILE; }
  get pixelH() { return this.h * TILE; }

  // Every tile with one of `codes`, as { x, y, code } in tile units.
  find(...codes) {
    const out = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const c = this.tiles[y * this.w + x];
        if (codes.includes(c)) out.push({ x, y, code: c });
      }
    }
    return out;
  }
}
