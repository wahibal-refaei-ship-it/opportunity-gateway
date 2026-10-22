/**
 * Opportunity Gateway 2 — Service Worker (Agent C)
 * Caches project-local production assets for offline reliability.
 * Strictly limits caching to local project origins, preserving user shortlist in LocalStorage.
 */

const SCOPE_URL = new URL(self.registration.scope);
const CACHE_PREFIX = `og2-${SCOPE_URL.pathname}-`;
const CACHE_NAME = `${CACHE_PREFIX}v2`;

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './detail.html',
  './favorites.html',
  './about.html',
  './manifest.webmanifest',
  './assets/css/styles.css',
  './assets/js/common.js',
  './assets/js/data.js',
  './assets/js/i18n.js',
  './assets/js/list.js',
  './assets/js/detail.js',
  './assets/js/favorites.js',
  './assets/js/about.js',
  './assets/fonts/cairo-arabic.woff2',
  './assets/fonts/cairo-latin.woff2',
  './assets/fonts/cairo-OFL.txt',
  './assets/icons/favicon.svg',
  './assets/icons/gateway.svg',
  './assets/icons/icon-192.svg',
  './assets/icons/icon-512.svg',
  './data/opportunities.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          // Remove only outdated caches strictly belonging to this project
          if (key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME) {
            return caches.delete(key);
          }
          return Promise.resolve();
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Handle only GET requests
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Strictly avoid caching external websites (provider application portals, external course sites)
  if (url.origin !== SCOPE_URL.origin || !url.pathname.startsWith(SCOPE_URL.pathname)) {
    return;
  }

  // Cache First with Network Fallback strategy for local assets
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Query parameters select a record in the same pre-cached HTML page.
      // Keep them in the browser URL so detail.js can still read the requested id.
      const cachedResponse = await cache.match(request, {
        ignoreSearch: request.mode === 'navigate'
      });
      if (cachedResponse) {
        // Return cached asset immediately
        return cachedResponse;
      }

      // If not in cache, fetch from network and cache valid responses
      return fetch(request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        event.waitUntil(cache.put(request, responseToCache).catch(() => {}));

        return networkResponse;
      }).catch(async () => {
        // Fallback for HTML page navigation when fully offline
        if (request.headers.get('accept')?.includes('text/html')) {
          return (await cache.match('./index.html')) || Response.error();
        }
        return Response.error();
      });
    })
  );
});
