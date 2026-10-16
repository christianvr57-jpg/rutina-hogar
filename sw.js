// Service worker: la app funciona sin conexión.
// Estrategia: se precarga todo al instalar y después se sirve desde la caché
// mientras se actualiza en segundo plano (la nueva versión llega en la siguiente apertura).
const VERSION = 'v2';
const CACHE = `rutina-hogar-${VERSION}`;
const ARCHIVOS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'js/app.js',
  'js/store.js',
  'js/schedule.js',
  'js/planner.js',
  'js/running-calc.js',
  'js/running-store.js',
  'js/ui.js',
  'js/icons.js',
  'js/vistas/hoy.js',
  'js/vistas/semana.js',
  'js/vistas/tareas.js',
  'js/vistas/ajustes.js',
  'js/vistas/running.js',
  'data/rutina.json',
  'data/running.json',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.all(ARCHIVOS.map((a) => c.add(new Request(a, { cache: 'reload' })).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((k) => k.startsWith('rutina-hogar-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const enCache = await cache.match(req, { ignoreSearch: true });
    const red = fetch(req).then((r) => {
      if (r && r.ok) cache.put(req, r.clone());
      return r;
    }).catch(() => null);
    if (enCache) {
      e.waitUntil(red);
      return enCache;
    }
    const r = await red;
    if (r) return r;
    if (req.mode === 'navigate') return (await cache.match('index.html')) || (await cache.match('./'));
    return new Response('', { status: 504, statusText: 'Sin conexión' });
  })());
});
