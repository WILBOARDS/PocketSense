// Offline support: serve the app shell from cache, refresh it in the background.
// All user data lives in localStorage, so nothing here touches it.
const CACHE = 'pocket-sense-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  const isPage = req.mode === 'navigate';
  e.respondWith(
    caches.open(CACHE).then(async cache => {
      const cached = await cache.match(isPage ? '/' : req);
      const fresh = fetch(req)
        .then(res => {
          if (res.ok) cache.put(isPage ? '/' : req, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || fresh;
    }),
  );
});
