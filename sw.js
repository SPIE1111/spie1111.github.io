// ════════════════════════════════════════════
// Service Worker · Hazard HSE SPIE
// Estrategia:
//  - index.html y archivos raíz: NETWORK-FIRST (siempre busca la versión nueva;
//    usa caché solo si no hay conexión). Esto evita que los cambios no se vean.
//  - Otros recursos (íconos, librerías): CACHE-FIRST (rápidos, offline).
//  - NUEVO: recibe notificaciones push del HSE (aprobado / rechazado) aunque
//    la app esté cerrada.
// Sube el número de versión cada vez que quieras forzar actualización total.
// ════════════════════════════════════════════
const CACHE = 'hazard-hse-v7';
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

// ════════════════════════════════════════════
// NOTIFICACIONES PUSH
// El servidor (push-send) manda: { titulo, cuerpo, code, url }
// ════════════════════════════════════════════
self.addEventListener('push', (e) => {
  let d = {};
  try {
    d = e.data ? e.data.json() : {};
  } catch (_err) {
    d = { titulo: 'Hazard HSE', cuerpo: e.data ? e.data.text() : '' };
  }

  const titulo = d.titulo || 'Hazard HSE';
  const opciones = {
    body: d.cuerpo || '',
    icon: './icon-192.png',
    badge: './icon-192.png',
    // Un aviso por reporte: si llega otro del mismo hazard, lo reemplaza
    tag: d.code || 'hazard-revision',
    renotify: true,
    vibrate: [120, 60, 120],
    data: { code: d.code || '', url: d.url || './' },
  };

  e.waitUntil(self.registration.showNotification(titulo, opciones));
});

// Al tocar la notificación: abrir la app (o enfocarla si ya está abierta)
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const scope = self.registration.scope;
  // En un rechazo, el servidor manda "?corregir=H-2026-XXXX":
  // así la app abre ese reporte listo para corregir, sin pasar por el registro.
  const destino = scope + (e.notification.data && e.notification.data.url ? e.notification.data.url : '');

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((lista) => {
      for (const c of lista) {
        if (c.url.startsWith(scope)) {
          // Si la app ya estaba abierta, se la lleva al reporte indicado
          if ('navigate' in c && destino !== c.url) { return c.navigate(destino).then((cl) => cl && cl.focus()); }
          if ('focus' in c) return c.focus();
        }
      }
      return clients.openWindow(destino);
    })
  );
});
