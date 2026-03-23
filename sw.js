// ─────────────────────────────────────────────
// Apotheosis Database — Service Worker
// Hybrid caching: SWR for JSON, Cache-First for images, Network-First for shell
// ─────────────────────────────────────────────

const CACHE_VERSION = 'apotheosis-v1';
const SHELL_CACHE = `shell-${CACHE_VERSION}`;
const DATA_CACHE = `data-${CACHE_VERSION}`;
const IMG_CACHE = `img-${CACHE_VERSION}`;

const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/manifest.json'
];

const DATA_URLS = [
  'https://get.lunehub.com/apotheosis/source/cards.json',
  'https://get.lunehub.com/apotheosis/source/dev-cards.json'
];

// ── Install ──────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => {
      console.log('[SW] Caching shell assets');
      return cache.addAll(SHELL_ASSETS);
    })
  );
  self.skipWaiting();
});

// ── Activate ─────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== SHELL_CACHE && key !== DATA_CACHE && key !== IMG_CACHE)
          .map((key) => {
            console.log('[SW] Removing old cache:', key);
            return caches.delete(key);
          })
      )
    )
  );
  self.clients.claim();
});

// ── Fetch ────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Strategy: Stale-While-Revalidate for card JSON data
  if (DATA_URLS.some((dataUrl) => request.url.startsWith(dataUrl))) {
    event.respondWith(staleWhileRevalidate(request, DATA_CACHE));
    return;
  }

  // Strategy: Cache-First for card images (.avif)
  if (url.hostname === 'get.lunehub.com' && url.pathname.includes('/prints/')) {
    event.respondWith(cacheFirst(request, IMG_CACHE));
    return;
  }

  // Strategy: Network-First for app shell
  if (url.origin === location.origin) {
    event.respondWith(networkFirst(request, SHELL_CACHE));
    return;
  }

  // Default: network
  event.respondWith(fetch(request));
});

// ── Caching Strategies ───────────────────────

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const networkFetch = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  return cached || (await networkFetch);
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    return new Response('', { status: 408, statusText: 'Offline' });
  }
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);

  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    return cached || new Response('Offline', { status: 503 });
  }
}
