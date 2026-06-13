// Service worker for offline-resilient /demo (JKPS Summer Fair).
//
// Strategy:
//   - On install, precache the demo shell + L6 (Cactus Dart Toss) static assets
//     and every clan card / character form 6 referenced by the demo.
//   - Runtime cache (stale-while-revalidate) for hashed Vite output under
//     /assets/*, and any other /art/* or /music/* that wasn't precached.
//   - Navigation requests: network-first, falling back to the cached SPA shell.
//
// Bump CACHE_VERSION whenever the precache list or any precached file changes
// so old caches are purged on activate.

const CACHE_VERSION = 'v1';
const STATIC_CACHE = `cactus-clans-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `cactus-clans-runtime-${CACHE_VERSION}`;

const PRECACHE_URLS = [
  '/',
  '/demo',
  '/manifest-demo.webmanifest',
  '/logo.png',

  // Cactus Dart Toss (L6) — the only level the demo plays.
  '/music/bowandarrows.mp3',
  '/art/game6-background.png',
  '/art/game6-cactus-dart.png',
  '/art/game6-dartboard.png',

  // Clan picker landing cards (form 1) for the 11 selectable demo clans.
  '/art/menu/card-prickling-clan-form1.png',
  '/art/menu/card-metal-clan-form1.png',
  '/art/menu/card-tropica-clan-form1.png',
  '/art/menu/card-hotdog-clan-form1.png',
  '/art/menu/card-camo-clan-form1.png',
  '/art/menu/card-duskerns-clan-form1.png',
  '/art/menu/card-tumbleweed-clan-form1.png',
  '/art/menu/card-oasis-clan-form1.png',
  '/art/menu/card-crystalline-clan-form1.png',
  '/art/menu/card-earth-clan-form1.png',
  '/art/menu/card-wildfire-clan-form1.png',

  // Character form-6 sprites (level 6 maps formNumber=6) for each clan.
  '/art/prickshot-prickling-clan-form6.png',
  '/art/iridium-champion-metal-clan-form6.png',
  '/art/kiwini-tropica-clan-form6.png',
  '/art/mustard-mauler-hotdog-clan-form6.png',
  '/art/shadow-strike-camo-clan-form6.png',
  '/art/twilight-seed-duskern-clan-form6.png',
  '/art/dunehunter-tumbleweed-clan-form6.png',
  '/art/tidestrider-oasis-clan-form6.png',
  '/art/prism-forge-crystalline-clan-form6.png',
  '/art/mountainborn-earth-clan-form6.png',
  '/art/ashstalker-wildfire-clan-form6.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      // addAll is atomic — if any URL 404s the whole install fails. Use
      // individual adds so a missing file doesn't sink the whole worker.
      await Promise.all(
        PRECACHE_URLS.map(async (url) => {
          try {
            await cache.add(new Request(url, { cache: 'reload' }));
          } catch (err) {
            console.warn('[sw] precache failed for', url, err);
          }
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== RUNTIME_CACHE)
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

function isRuntimeCacheable(url) {
  if (url.origin !== self.location.origin) return false;
  return (
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/art/') ||
    url.pathname.startsWith('/music/') ||
    url.pathname === '/logo.png' ||
    url.pathname.endsWith('.webmanifest')
  );
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Never intercept API calls — they need the network or controlled fallbacks
  // in the app code (leaderboard etc.).
  if (url.pathname.startsWith('/api/')) return;

  // Navigation: network-first with cached SPA shell fallback. This keeps
  // /demo working even if the network is dead — the SPA shell renders, the
  // router hits /demo, and the precached JS chunk takes over.
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          // Cache successful navigations into the runtime cache so even
          // unfamiliar routes survive a refresh offline.
          if (fresh.ok) {
            const runtime = await caches.open(RUNTIME_CACHE);
            runtime.put(req, fresh.clone()).catch(() => {});
          }
          return fresh;
        } catch {
          const cache = await caches.open(STATIC_CACHE);
          const cached =
            (await cache.match(req)) ||
            (await cache.match('/demo')) ||
            (await cache.match('/'));
          if (cached) return cached;
          throw new Error('offline and no cached shell available');
        }
      })(),
    );
    return;
  }

  if (!isRuntimeCacheable(url)) return;

  // Stale-while-revalidate: hit the cache fast, refresh in the background.
  event.respondWith(
    (async () => {
      const cache = await caches.open(RUNTIME_CACHE);
      const cached = await cache.match(req);
      const staticHit = cached ?? (await caches.match(req, { cacheName: STATIC_CACHE }));
      const networkPromise = fetch(req)
        .then((res) => {
          if (res.ok) cache.put(req, res.clone()).catch(() => {});
          return res;
        })
        .catch(() => null);
      if (staticHit) {
        // Don't await the refresh — return cache immediately.
        event.waitUntil(networkPromise.then(() => undefined));
        return staticHit;
      }
      const fresh = await networkPromise;
      if (fresh) return fresh;
      // Cache miss + offline. Let the request fail; the asset loader can
      // fall back to its procedural placeholder where it has one.
      return Response.error();
    })(),
  );
});
