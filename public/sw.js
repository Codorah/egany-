const CACHE_NAME = 'egayne-pwa-cache-v4';
// Only /manifest.json here: the HTML document is handled separately below
// (network-first, never cached — see the fetch handler) because it names the
// hashed JS/CSS bundles for the CURRENT deploy, and those hashes change on
// every build. The built JS/CSS bundles themselves (e.g. /assets/index-abc123.js)
// are unknown ahead of time, so they're picked up organically by the fetch
// handler on first load instead of being precached here. The old list
// included '/' and '/index.html', which caused this exact production outage:
// a visitor's browser kept serving a cached index.html from a previous
// deploy, whose <script>/<link> tags pointed at asset hashes that no longer
// exist post-deploy — Vercel's SPA catch-all rewrite then served index.html
// (text/html) for those JS/CSS requests instead, breaking the app with MIME
// type errors. It also previously included dev-only source paths
// (/src/main.tsx, /src/App.tsx) that 404 in production, which made
// cache.addAll() reject and the install event fail outright.
const ASSETS_TO_CACHE = [
  '/manifest.json'
];

// Install event: cache core shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching critical app shell resources');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

// Activate event: clean up outdated caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Clearing legacy cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Fetch event: Stale-While-Revalidate caching strategy
self.addEventListener('fetch', (event) => {
  // Only handle standard GET requests (skip Firestore websockets or POST requests)
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Skip chrome extension requests or other non-http resources
  if (!url.protocol.startsWith('http')) return;

  // Navigation requests (the HTML document) must always come from the
  // network first: it's what names the hashed JS/CSS files for the current
  // deploy, so serving a stale cached copy after a new deploy points the
  // browser at bundles that no longer exist (see CACHE_NAME comment above —
  // this is exactly what broke production). Only fall back to the cached
  // shell when genuinely offline.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
          return networkResponse;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match('/index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Return cached response instantly if available, while fetching the latest in the background
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch((err) => {
          console.warn('[Service Worker] Network fetch failed, falling back to cache.', err);
          // If there's no cached response either, resolving to undefined here
          // makes event.respondWith() throw "Failed to convert value to
          // 'Response'" — always hand back a real Response.
          return cachedResponse || new Response('', { status: 503, statusText: 'Offline' });
        });

      // Without waitUntil, the SW can be torn down before this background
      // revalidation (cache.put) finishes once the cached response has
      // already been returned below — keep it alive until it settles.
      if (cachedResponse) {
        event.waitUntil(fetchPromise.catch(() => {}));
      }

      return cachedResponse || fetchPromise;
    })
  );
});
