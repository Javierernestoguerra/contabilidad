// SW robusto para /contabilidad/ (sin romper por 404) + Web Push
const CACHE_NAME = "pwa-cache-v6";
const BASE_PATH = "/contabilidad/";

// (Opcional) precache mínimo y tolerante
const CORE_ASSETS = [
  BASE_PATH,
  BASE_PATH + "manifest.webmanifest",
  // No metas iconos aquí para evitar fallas de addAll si aún no existen
];

// ===== INSTALL =====
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const url of CORE_ASSETS) {
        try { await cache.add(url); } catch (e) { /* ignora 404/errores */ }
      }
    })
  );
});

// ===== ACTIVATE =====
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => (k !== CACHE_NAME ? caches.delete(k) : Promise.resolve())))
    ).then(() => self.clients.claim())
  );
});

// No cachear Supabase (auth/realtime/rest)
function isSupabase(url) {
  return url.host.includes("supabase.co") || url.host.includes("supabase.in"); // por si cambia
}

// ===== FETCH =====
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Dejar pasar peticiones a Supabase sin interceptar (evita problemas de auth/realtime)
  if (isSupabase(url)) return;

  // Navegación de páginas: red primero, con fallback a caché/home
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
    return;
  }

  // Resto (cross-origin que no sea Supabase): network-first simple
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

// ===== Mensajes opcionales (para forzar activar nuevo SW) =====
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

/* ===========================================================
   ===============   WEB PUSH NOTIFICATIONS   ===============
   =========================================================== */

// Mostrar notificaciones entrantes
self.addEventListener("push", (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch(e){}

  const title = payload.title || "Nueva operación";
  const body  = payload.body  || "Se ha registrado una nueva operación";
  const options = {
    body,
    icon: "icon-192.png",
    badge: "icon-192.png",
    data: payload.data || {},   // ej: { op_id, currency }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Al hacer clic en la notificación: enfoca o abre la app
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const allClients = await clients.matchAll({ includeUncontrolled: true, type: "window" });
    if (allClients && allClients.length > 0) {
      return allClients[0].focus();
    }
    return clients.openWindow("./");
  })());
});
