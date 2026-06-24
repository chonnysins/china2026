/* Service worker for Trips by Ronnie and Josh
   Goal: the static trip (itinerary, bookings, day cards, maps, already-seen
   photos) works fully offline; live photo actions degrade gracefully with no
   signal. Bump CACHE_VERSION whenever you want to force a clean refresh. */
const CACHE_VERSION = "v1";
const SHELL = `trip-shell-${CACHE_VERSION}`;
const IMG   = `trip-img-${CACHE_VERSION}`;
const RT    = `trip-runtime-${CACHE_VERSION}`;
const KEEP  = [SHELL, IMG, RT];

const APP_SHELL = [
  "/", "/index.html", "/manifest.webmanifest",
  "/icons/icon-192.png", "/icons/icon-512.png"
];
const FN = "/.netlify/functions/photos";

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(SHELL).then((c) => c.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !KEEP.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function cacheable(res) {
  return res && (res.ok || res.type === "opaque");
}

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (cacheable(res)) cache.put(req, res.clone());
    return res;
  } catch (err) {
    return hit || Response.error();
  }
}

async function networkFirst(req, cacheName, fallbackUrl) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    if (cacheable(res)) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(req);
    if (hit) return hit;
    if (fallbackUrl) {
      const fb = await caches.match(fallbackUrl);
      if (fb) return fb;
    }
    return Response.error();
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  const net = fetch(req).then((res) => {
    if (cacheable(res)) cache.put(req, res.clone());
    return res;
  }).catch(() => null);
  return hit || (await net) || Response.error();
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return; // uploads/hearts/deletes always go to network

  const url = new URL(req.url);
  const isFn = url.origin === location.origin && url.pathname === FN;

  // Photo image bytes are immutable → cache hard so seen photos work offline.
  if (isFn && url.searchParams.has("id")) {
    e.respondWith(cacheFirst(req, IMG));
    return;
  }
  // Photo lists → prefer fresh; fall back to last-known list when offline.
  if (isFn && url.searchParams.has("list")) {
    e.respondWith(networkFirst(req, RT));
    return;
  }
  // Page navigations → fresh when online, cached shell when offline.
  if (req.mode === "navigate") {
    e.respondWith(networkFirst(req, SHELL, "/index.html"));
    return;
  }
  // Everything else (same-origin assets, Google Fonts, map tiles) → SWR.
  e.respondWith(staleWhileRevalidate(req, RT));
});
