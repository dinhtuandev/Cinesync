/*
 * CineSync service worker — tối giản cho PWA installability.
 *
 * Chiến lược: network-first cho GET same-origin (HTML ISR luôn tươi),
 * cache chỉ làm fallback offline. KHÔNG cache:
 * - request cross-origin (nguồn phim, ảnh provider)
 * - POST/điều khiển khác
 */
const CACHE_NAME = "cinesync-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Dọn cache phiên bản cũ
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  if (!req.url.startsWith(self.location.origin)) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches
          .open(CACHE_NAME)
          .then((cache) => cache.put(req, copy))
          .catch(() => {});
        return res;
      })
      .catch(() =>
        caches.match(req).then(
          (cached) =>
            cached ??
            new Response("Offline", { status: 503, statusText: "Offline" }),
        ),
      ),
  );
});
