// Cache only the public, non-sensitive offline notice. Never cache API responses,
// authenticated pages, credentials, or analytics in the browser service worker.
self.addEventListener("install", (event) =>
  event.waitUntil(
    caches.open("ci-offline-v1").then((cache) => cache.add("/offline.html")),
  ),
);
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim()),
);
self.addEventListener("fetch", (event) => {
  if (event.request.mode === "navigate")
    event.respondWith(
      fetch(event.request).catch(() => caches.match("/offline.html")),
    );
});
