const CACHE_VERSION = "qin-thread-pwa-v20260607-01";
const CORE_ASSETS = [
  "/",
  "/index.html",
  "/styles.css?v=20260607-01",
  "/app.js?v=20260607-01",
  "/manifest.webmanifest",
  "/assets/qinxian-logo.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_VERSION);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    return await cache.match(request);
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(request);
  const next = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached || next;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin === self.location.origin && url.pathname === "/api/state") {
    event.respondWith(
      fetch(request).catch(() => new Response("{}", {
        headers: { "content-type": "application/json; charset=utf-8" },
      }))
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request).then((response) => response || caches.match("/index.html")));
    return;
  }

  if (url.origin === self.location.origin || ["cdn.jsdelivr.net", "unpkg.com"].includes(url.hostname)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
