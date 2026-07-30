// ════════════════════════════════════════════
// Service Worker · Hazard HSE SPIE
// Estrategia:
//  - index.html y archivos raíz: NETWORK-FIRST (siempre busca la versión nueva;
//    usa caché solo si no hay conexión). Esto evita que los cambios no se vean.
//  - Otros recursos (íconos, librerías): CACHE-FIRST (rápidos, offline).
// Sube el número de versión cada vez que quieras forzar actualización total.
// ════════════════════════════════════════════
const CACHE = 'hazard-hse-v5';
const CORE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

// Instalar: precachear lo esencial
self.addEventListener('install', (e) => {
  self.skipWaiting(); // activar de inmediato la nueva versión
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE).catch(() => {})));
});

// Activar: borrar cachés viejos
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const esDocumento = req.mode === 'navigate' ||
    url.pathname.endsWith('/') ||
    url.pathname.endsWith('index.html') ||
    url.pathname.endsWith('panel.html');

  if (esDocumento) {
    // NETWORK-FIRST: intenta red; si falla, usa caché. Así los cambios se ven al instante.
    e.respondWith(
      fetch(req)
        .then((resp) => {
          const copia = resp.clone();
          caches.open(CACHE).then((c) => c.put(req, copia)).catch(() => {});
          return resp;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
    );
    return;
  }

  // CACHE-FIRST para el resto (íconos, librerías): rápido y offline.
  e.respondWith(
    caches.match(req).then((cached) =>
      cached ||
      fetch(req).then((resp) => {
        const copia = resp.clone();
        caches.open(CACHE).then((c) => c.put(req, copia)).catch(() => {});
        return resp;
      }).catch(() => cached)
    )
  );
});
