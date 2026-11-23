// CrunchBox Service Worker — PWA offline support
const CACHE_NAME = 'crunchbox-v14';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/static/css/main.css?v=21',
  '/static/css/components.css?v=7',
  '/static/css/storefront-customization.css?v=7',
  '/static/css/brand-theme.css?v=21',
  '/static/js/api.js?v=5',
  '/static/js/cart.js?v=7',
  '/static/js/location.js?v=5',
  '/static/js/tracker.js?v=5',
  '/static/js/main.js?v=5',
  '/static/images/icons/crunchbox-logo.svg',
  '/static/images/icons/icon-192x192.png',
  '/static/images/icons/icon-512x512.png',
  '/static/images/spin-hub.png',
  '/static/images/icons/icon-main.png',
  '/static/images/icons/icon-drinks.png',
  '/static/images/icons/icon-dessert.png',
  '/static/images/icons/icon-appetizer.png',
  '/static/images/icons/icon-combo.png',
  '/static/images/icons/icon-vegan.png',
  '/static/images/icons/bestseller-ribbon.png',
];

// Install: cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS.filter((url) => url));
    }).then(() => self.skipWaiting())
  );
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: cache-first for static assets, network-first for API calls
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // API routes: network-first with cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const cloned = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
          }
          return response;
        })
        .catch(() => {
          return caches.match(event.request);
        })
    );
    return;
  }

  // Navigations: network-first so the HTML (with its cache-busted asset URLs)
  // is always fresh. Falls back to cache when offline.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const cloned = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then((r) => r || caches.match('/')))
    );
    return;
  }

  // Static assets: cache-first
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response.ok && url.origin === self.location.origin) {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
        }
        return response;
      });
    })
  );
});