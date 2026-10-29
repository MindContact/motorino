// Full screen for the whole page, so the touch buttons come along. The
// browser allows it only during a key or a tap: call it from
// Input.onPress, not from an update.
export const canFullscreen = () => !!document.fullscreenEnabled;
export const isFullscreen = () => !!document.fullscreenElement;

export function toggleFullscreen(el = document.documentElement) {
  if (!canFullscreen()) return Promise.resolve(false);
  const p = isFullscreen() ? document.exitFullscreen() : el.requestFullscreen({ navigationUI: 'hide' });
  return p.then(isFullscreen, isFullscreen);
}
