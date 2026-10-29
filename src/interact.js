// Finding the thing the player can use: the nearest interactable whose box
// lies within reach of a point (usually the player's centre). Things are any
// objects with x, y, w, h in world pixels; `can(thing)` filters them (a door
// already open, a terminal already read and not re-readable...).

export function nearest(px, py, things, reach = 12, can = () => true) {
  let best = null;
  let bestD = Infinity;
  for (const t of things) {
    if (!can(t)) continue;
    // Distance from the point to the box, 0 inside.
    const dx = Math.max(t.x - px, 0, px - (t.x + t.w));
    const dy = Math.max(t.y - py, 0, py - (t.y + t.h));
    const d = Math.hypot(dx, dy);
    if (d <= reach && d < bestD) {
      best = t;
      bestD = d;
    }
  }
  return best;
}
