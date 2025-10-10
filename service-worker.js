// SW robusto para /contabilidad/ (sin romper por 404)
const CACHE_NAME = "pwa-cache-v5";
const BASE_PATH = "/contabilidad/";

// (Opcional) precache mínimo y tolerante
const CORE_ASSETS = [
  BASE_PATH,
  BASE_PATH + "manifest.webmanifest"
  // No metas iconos aquí para evitar fallas de addAll si aún no existen
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const url of CORE_ASSETS) {
        try { await cache.add(url); } catch (e) { /* ignora 404 */ }
      }
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => (k !== CACHE_NAME ? caches.delete(k) : Promise.resolve())))
    ).then(() => self.clients.claim())
  );
});

// No cachear Supabase (auth/tiempo real)
function isSupabase(url) {
  return url.host.includes("supabase.co");
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (isSupabase(url)) return; // pasa directo a red

  // Navegación: red primero, fallback a cache de la home
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).then((resp) => {
        const copy = resp.clone();
        caches.open(CACHE_NAME).then((c) => c.put(event.request, copy));
        return resp;
      }).catch(() =>
        caches.match(event.request).then((r) => r || caches.match(BASE_PATH))
      )
    );
    return;
  }

  // Recursos same-origin: cache-first con write-through
  if (url.origin === location.origin) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((resp) => {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then((c) => c.put(event.request, copy));
          return resp;
        });
      })
    );
  }
});

