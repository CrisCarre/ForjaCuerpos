// Forja-Kuerpo — Service Worker
const CACHE_NAME = 'forja-kuerpo-v1';

// Archivos que se guardan en caché para funcionar offline
const CACHE_STATIC = [
  '',
  'index.php',
  'login.php',
  'entreno_activo.php',
  'assets/css/style.css',
  'assets/js/app.js',
  'manifest.json',
];

// Instalación: guarda los estáticos en caché
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(CACHE_STATIC))
  );
  self.skipWaiting();
});

// Activación: limpia cachés antiguas
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: network first, caché como fallback
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Las llamadas a la API siempre van a red (nunca caché)
  if (url.pathname.includes('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Para el resto: intenta red, si falla usa caché
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Guarda en caché la respuesta fresca
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
