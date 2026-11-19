const CACHE_NAME = 'personal-site-static-v1';
const OFFLINE_URL = '/offline';

const STATIC_PUBLIC_ASSETS = [
  OFFLINE_URL,
  '/fonts/Excalifont-Regular.woff2',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-192.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
];

function isPublicStaticAsset(pathname) {
  return (
    pathname === OFFLINE_URL ||
    pathname.startsWith('/fonts/') ||
    pathname.startsWith('/icons/')
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_PUBLIC_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Never intercept non-GET requests (e.g. POST Server Actions or API mutations)
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) {
    return;
  }

  // NEVER intercept or cache API routes
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Navigations: network-only (never cache authenticated HTML), fallback to /offline on failure
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cachedOffline = await caches.match(OFFLINE_URL);
        return (
          cachedOffline ||
          new Response('SEM CONEXÃO COM A INTERNET.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          })
        );
      }),
    );
    return;
  }

  // Static public assets only (fonts, icons, /offline): cache-first
  if (isPublicStaticAsset(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) {
          return cached;
        }
        return fetch(request).then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      }),
    );
  }
});
