/* ************************************************************************

   Copyright: 2025 DeskWeb Team

   License: MIT license

   Authors: DeskWeb Team

************************************************************************ */

/**
 * Service Worker for cache management
 * This ensures that the application always uses the latest version
 */

const CACHE_VERSION = 'deskweb-v' + Date.now();
const CACHE_NAME = CACHE_VERSION;

// Install event - clean up old caches
self.addEventListener('install', function(event) {
  console.log('[ServiceWorker] Installing version:', CACHE_VERSION);

  // Force the waiting service worker to become the active service worker
  self.skipWaiting();

  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (cacheName !== CACHE_NAME) {
            console.log('[ServiceWorker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Activate event - take control immediately
self.addEventListener('activate', function(event) {
  console.log('[ServiceWorker] Activating version:', CACHE_VERSION);

  event.waitUntil(
    clients.claim().then(function() {
      console.log('[ServiceWorker] Claimed all clients');
    })
  );
});

// Fetch event - network first, then cache
self.addEventListener('fetch', function(event) {
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(function(response) {
        // Don't cache non-successful responses
        if (!response || response.status !== 200) {
          return response;
        }

        // Clone the response
        const responseToCache = response.clone();

        // Cache the fetched response
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, responseToCache);
        });

        return response;
      })
      .catch(function() {
        // If network fails, try to get from cache
        return caches.match(event.request);
      })
  );
});

// Message event - for manual cache clearing
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then(function(cacheNames) {
        return Promise.all(
          cacheNames.map(function(cacheName) {
            console.log('[ServiceWorker] Clearing cache:', cacheName);
            return caches.delete(cacheName);
          })
        );
      })
    );
  }
});
