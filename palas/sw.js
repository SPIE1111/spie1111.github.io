// ════════════════════════════════════════════
// Service Worker · Fotos de Palas SPIE (alcance /palas/)
// Misma estrategia que las apps Hazard y JSA:
//  - Documentos: NETWORK-FIRST (los cambios se ven al instante; caché solo sin conexión)
//  - Otros recursos (íconos, fuentes): CACHE-FIRST
// Sube la versión para forzar actualización total.
// ════════════════════════════════════════════
const CACHE = 'palas-spie-v5';
const CORE = [
  './',
  './index.html',
  './manifest.json',
  './spie-logo.png',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE).catch(() => {})));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE && k.startsWith('palas-spie-')).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Las llamadas a Supabase nunca se cachean.
  if (url.hostname.endsWith('supabase.co')) return;
  const esDocumento = req.mode === 'navigate' ||
    url.pathname.endsWith('/palas/') ||
    url.pathname.endsWith('/palas/index.html');

  if (esDocumento) {
    e.respondWith(
      fetch(req, { cache: 'no-store' })
        .then((resp) => {
          const copia = resp.clone();
          caches.open(CACHE).then((c) => c.put(req, copia)).catch(() => {});
          return resp;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
    );
    return;
  }

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
