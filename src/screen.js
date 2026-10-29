// The low-resolution canvas and its scaling to the window: whole-number
// scales keep pixels square; below 2x there is no room for that, so it takes
// the exact fit.

export const VIEW_W = 320;
export const VIEW_H = 180;

export function setupScreen(canvas, { w = VIEW_W, h = VIEW_H } = {}) {
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const resize = () => {
    const fit = Math.min(window.innerWidth / w, window.innerHeight / h);
    const scale = fit >= 2 ? Math.floor(fit) : fit;
    canvas.style.width = `${Math.floor(w * scale)}px`;
    canvas.style.height = `${Math.floor(h * scale)}px`;
  };
  resize();
  window.addEventListener('resize', resize);
  return ctx;
}
