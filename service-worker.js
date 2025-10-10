const CACHE_NAME = "pwa-cache-v3";
const BASE_PATH = "/contabilidad/";

const CORE_ASSETS = [
  BASE_PATH,
  BASE_PATH + "index.html",
  BASE_PATH + "manifest.webmanifest",
  BASE_PATH + "icons/icon-192.png",
  BASE_PATH + "icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(CORE_ASSETS)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => (k !== CACHE_NAME ? caches.delete(k) : null)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // No cachear Supabase (auth/tiempo real)
  if (url.host.includes("supabase.co")) return;

  // Navegación: red primero, fallback caché
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).then(resp => {
        caches.open(CACHE_NAME).then(c => c.put(event.request, resp.clone()));
        return resp;
      }).catch(() =>
        caches.match(event.request).then(r => r || caches.match(BASE_PATH + "index.html"))
      )
    );
    return;
  }

  // Estáticos same-origin: caché primero
  event.respondWith(
    caches.match(event.request).then(cached =>
      cached || fetch(event.request).then(resp => {
        if (url.origin === location.origin) {
          caches.open(CACHE_NAME).then(c => c.put(event.request, resp.clone()));
        }
        return resp;
      })
    )
  );
});
