// motorino's service worker, network first: online, the game always gets
// its latest files (development is never fooled by a stale copy); every
// answer is kept, and offline the last good copy is served. There is no
// list of files to keep up to date: an ES module game fetches all of them
// as it starts, so one visit online is enough to play offline.
//
// A game's sw.js, at its root:
//
//   importScripts('lib/motorino/pwa/sw.js');

const CACHE = `motorino:${self.registration.scope}`;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    } catch (err) {
      // A page asked with ?new or ?room=... is the same page offline.
      const hit = await cache.match(req, { ignoreSearch: req.mode === 'navigate' });
      if (hit) return hit;
      throw err;
    }
  })());
});
