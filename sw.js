/* ================================================================
   SINERGIA REA — sw.js v1.0
   Service Worker de CACHÉ y AUTO-ACTUALIZACIÓN.

   Estrategia: Network First con fallback a caché.
   - Siempre intenta traer la versión más nueva de la red.
   - Si la red falla (offline), usa la caché local.

   Auto-update:
   - Al detectar una nueva versión, notifica al cliente con
     { type: 'SW_UPDATED' } → la app muestra el banner.
   - El cliente puede llamar __swUpdate() para recargar
     inmediatamente con la nueva versión.

   ⚠️ Este SW es INDEPENDIENTE de firebase-messaging-sw.js.
      FCM usa su propio registro; este controla el caché de assets.
   ================================================================ */

const CACHE_VERSION = 'sinergia-v1.3';

// Archivos críticos que siempre deben estar cacheados
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/manifest.json',
  '/SD_ALERT_33.mp3',
  '/src/styles/declaraciones.css'
];

/* ── Instalación: pre-cachear assets críticos ── */
self.addEventListener('install', event => {
  console.log('[SW Cache] 📦 Instalando versión:', CACHE_VERSION);
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(PRECACHE_ASSETS))
      .then(() => {
        console.log('[SW Cache] ✓ Assets pre-cacheados');
        // skipWaiting es seguro aquí: este SW no maneja Push (eso lo hace firebase-messaging-sw.js)
        return self.skipWaiting();
      })
      .catch(err => console.warn('[SW Cache] ⚠️ Pre-caché parcial:', err.message))
  );
});

/* ── Activación: limpiar caches obsoletos ── */
self.addEventListener('activate', event => {
  console.log('[SW Cache] ⚡ Activando versión:', CACHE_VERSION);
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_VERSION && key.startsWith('sinergia-'))
          .map(key => {
            console.log('[SW Cache] 🗑️ Eliminando cache obsoleto:', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())
      .then(() => {
        // Notificar a todos los clientes que hay una nueva versión activa
        return self.clients.matchAll({ type: 'window' }).then(clients => {
          clients.forEach(client => client.postMessage({ type: 'SW_UPDATED', version: CACHE_VERSION }));
        });
      })
  );
});

/* ── Fetch: Network First con fallback a caché ── */
self.addEventListener('fetch', event => {
  // Solo interceptar GET del mismo origen
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // No interceptar el SW de Firebase ni sus scripts
  if (url.pathname.includes('firebase-messaging-sw.js')) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Si la respuesta es válida, actualizamos el caché en background
        if (response && response.status === 200) {
          const cloned = response.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(event.request, cloned));
        }
        return response;
      })
      .catch(() => {
        // Sin red → intentar desde caché
        return caches.match(event.request).then(cached => {
          if (cached) {
            console.log('[SW Cache] 📦 Sirviendo desde caché (offline):', url.pathname);
            return cached;
          }
          // Último recurso: index.html para rutas SPA
          if (url.pathname.endsWith('.html') || !url.pathname.includes('.')) {
            return caches.match('/index.html');
          }
        });
      })
  );
});

/* ── Mensaje desde la app ── */
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

console.log('[SW Cache] ✅ Service Worker de caché inicializado —', CACHE_VERSION);
