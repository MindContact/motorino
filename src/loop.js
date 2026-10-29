// The fixed-step loop. Physics is tuned per update, so it must run at 60 Hz
// whatever the display refresh: a 144 Hz screen draws some updates twice, a
// 30 Hz one runs two updates per frame. After a long stall (background tab,
// breakpoint) it drops the lost time instead of racing to catch up.

export const STEP = 1 / 60;
const MAX_ELAPSED = 0.25;
const MAX_STEPS = 5;

// `update()` runs once per fixed step, `draw()` once per frame. Returns a
// handle whose `stop()` ends the loop.
export function startLoop({ update, draw }) {
  let last = performance.now();
  let acc = 0;
  let running = true;
  const frame = (t) => {
    if (!running) return;
    acc += Math.min(MAX_ELAPSED, (t - last) / 1000);
    last = t;
    let steps = 0;
    while (acc >= STEP && steps < MAX_STEPS) {
      update();
      acc -= STEP;
      steps++;
    }
    if (steps === MAX_STEPS) acc = 0;
    draw();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  return { stop() { running = false; } };
}
