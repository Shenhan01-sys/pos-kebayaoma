// Kebaya Oma POS — PWA service worker
// Strategi cache:
// - Navigasi (/): network-first, fallback ke shell yang di-cache.
// - Aset Next.js yang di-hash (/_next/static/...): cache-first karena URL-nya
//   immutable — hash berubah saat konten berubah, jadi tidak ada risiko stale chunk.
// - Aset statis lainnya: network-first, fallback ke cache.
// Tujuannya: mencegah error "Cannot read properties of undefined (reading 'M_ID')"
// yang muncul ketika cache lama menyervis chunk dari build berbeda.
const CACHE = "kebaya-oma-v2";
const OFFLINE_FALLBACK = "/";

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((c) => c.add(OFFLINE_FALLBACK).catch(() => {}))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) {
    return;
  }

  // Navigasi: network-first, fallback ke shell offline.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(OFFLINE_FALLBACK, copy));
          return res;
        })
        .catch(() => caches.match(OFFLINE_FALLBACK).then((r) => r || caches.match(req)))
    );
    return;
  }

  // Aset Next.js yang di-hash: cache-first (immutable URLs).
  if (req.url.includes("/_next/static/")) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        });
      })
    );
    return;
  }

  // Aset statis lainnya: network-first, fallback ke cache.
  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req))
  );
});
