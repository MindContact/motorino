// Installable and playable offline: registers the game's service worker,
// a sw.js at the game's root (so that its scope covers the whole game)
// that imports motorino's pwa/sw.js. Not from file://, where there are no
// service workers.
export function registerServiceWorker(url = 'sw.js') {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  const register = () => navigator.serviceWorker.register(url).catch(() => {});
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register);
}
