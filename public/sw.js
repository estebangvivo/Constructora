/* SimpleObra PWA — cache mínima de shell estático */
const CACHE = "simpleobra-shell-v2";
const PRECACHE = [
  "/",
  "/campo",
  "/manifest.webmanifest",
  "/brand/pwa/icon-192.png",
  "/brand/pwa/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Network-first para HTML/API; cache-first para estáticos
  if (req.mode === "navigate" || url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(req).catch(() => caches.match("/campo").then((r) => r || caches.match("/"))),
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(
      (cached) =>
        cached ||
        fetch(req).then((res) => {
          const copy = res.clone();
          if (res.ok && (url.pathname.startsWith("/brand/") || url.pathname.endsWith(".png"))) {
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
