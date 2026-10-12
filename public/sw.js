/* ──────────────────────────────────────────────────────────────
 *  AralSync PWA Service Worker (v1.0.0)
 * ──────────────────────────────────────────────────────────────
 *  Provides offline shell caching, background queue sync,
 *  and cache-first asset loading for low/no-connectivity classrooms.
 * ────────────────────────────────────────────────────────────── */

const CACHE_NAME = 'aralsync-pwa-v1';

const STATIC_PRECACHE = [
  '/',
  '/login',
  '/forgot-password',
  '/offline.html',
  '/manifest.json',
  '/aral-logo.png',
  '/login_background_page.png',
];

// Install Event — precache core offline assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(STATIC_PRECACHE);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate Event — cleanup old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => {
        return Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch Event — smart caching strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Skip non-GET requests (handled by Offline Queue in client)
  if (request.method !== 'GET') {
    return;
  }

  // 2. Ignore non-http requests (chrome-extension, etc.)
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // 3. Static Assets (_next/static, images, fonts, styles) — Cache-first strategy
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.match(/\.(png|jpg|jpeg|svg|webp|ico|woff2?|css|js)$/i)
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // 4. API Requests — Network-first with graceful offline JSON response
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(
          JSON.stringify({
            offline: true,
            error: 'You are currently offline. Changes are saved locally and will auto-sync upon reconnection.',
          }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      })
    );
    return;
  }

  // 5. HTML Page Navigation — Network-first with cache & offline.html fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const offlineFallback = await caches.match('/offline.html');
          return offlineFallback || new Response('Offline', { status: 503 });
        })
    );
  }
});
