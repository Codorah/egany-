const CACHE_NAME = 'egayne-pwa-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/src/main.tsx',
  '/src/App.tsx',
  '/src/index.css',
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
          // Return cache if network fails (offline consultation mode)
          return cachedResponse;
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
