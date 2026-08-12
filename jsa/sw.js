// ════════════════════════════════════════════
// Service Worker · JSA SPIE (alcance /jsa/)
// Misma estrategia que la app Hazard:
//  - Documentos: NETWORK-FIRST (los cambios se ven al instante; caché solo sin conexión)
//  - Otros recursos (íconos, fuentes): CACHE-FIRST
// Sube la versión para forzar actualización total.
// ════════════════════════════════════════════
const CACHE = 'jsa-spie-v8';
const CORE = [
  './',
  './index.html',
  './manifest.json',
  './jspdf.umd.min.js?v=6',
  './pdf-assets.js?v=6',
  './pdf.js?v=6',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  '../spie-logo.png',
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE).catch(() => {})));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE && k.startsWith('jsa-spie-')).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const esDocumento = req.mode === 'navigate' ||
    url.pathname.endsWith('/jsa/') ||
    url.pathname.endsWith('/jsa/index.html');

  if (esDocumento) {
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

// ── PUSH: mostrar la notificación que envía la Edge Function ──
self.addEventListener('push', (e) => {
  let data = { title: 'JSA SPIE', body: 'Tienes una novedad.' };
  try { if (e.data) data = { ...data, ...e.data.json() }; } catch (_e) {}
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: './icon-192.png',
      badge: './icon-192.png',
      data: { url: './' },
      vibrate: [80, 40, 80],
    })
  );
});

// Al tocar la notificación, abrir/enfocar la app
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
      for (const c of cs) { if (c.url.includes('/jsa/') && 'focus' in c) return c.focus(); }
      return self.clients.openWindow(url);
    })
  );
});
