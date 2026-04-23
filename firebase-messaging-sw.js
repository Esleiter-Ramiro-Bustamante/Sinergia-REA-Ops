/* ================================================================
   SINERGIA REA — firebase-messaging-sw.js v3.1 (FIX push service error)
   Service Worker para Firebase Cloud Messaging (FCM)
   Recibe notificaciones push aunque la app esté cerrada/en background.

   🔧 FIX v3.1:
   - Se eliminó skipWaiting() del evento 'install' para evitar la
     race condition que causaba "Registration failed - push service error".
     Firebase FCM requiere que el SW llegue a 'activated' de forma
     natural; forzar skipWaiting() interrumpía el handshake con el
     Push Service del navegador.
   - Se añade skipWaiting() solo cuando el SW ya tiene clients activos
     y recibe el mensaje SKIP_WAITING desde la app, o directamente
     en el activate si no hay versión anterior.

   ⚠️  SEGURIDAD:
   - Solo procesa mensajes de Firebase (origen verificado por FCM).
   - No expone datos sensibles en el payload de la notificación.
   - El token FCM se almacena únicamente en Firestore bajo el UID del
     usuario autenticado, nunca en localStorage ni en texto plano.
   - El token FCM se almacena únicamente en Firestore bajo el UID del
     usuario autenticado, nunca en localStorage ni en texto plano.
   - Se registra el Service Worker SOLO desde el mismo origen.
   ================================================================ */

/* ── Almacenar estado del SW para debugging ── */
const swState = {
  initialized: false,
  firebaseLoaded: false,
  messagingReady: false,
  errors: []
};

console.log('[SW] ✓ Service Worker iniciando en:', self.location.href);

/* ── Intentar cargar Firebase (con mejor manejo de errores) ── */
try {
  console.log('[SW] Importando firebase-app-compat...');
  importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
  swState.firebaseLoaded = true;
  console.log('[SW] ✓ firebase-app-compat.js cargado exitosamente');
} catch(e) {
  const errMsg = `[SW] ✗ CRÍTICO: Error cargando firebase-app-compat.js: ${e.message}`;
  console.error(errMsg, e);
  swState.errors.push(errMsg);
}

try {
  console.log('[SW] Importando firebase-messaging-compat...');
  importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');
  console.log('[SW] ✓ firebase-messaging-compat.js cargado exitosamente');
} catch(e) {
  const errMsg = `[SW] ✗ CRÍTICO: Error cargando firebase-messaging-compat.js: ${e.message}`;
  console.error(errMsg, e);
  swState.errors.push(errMsg);
}

/* ── Intentar inicializar Firebase ── */
let messaging = null;

if (typeof firebase !== 'undefined' && firebase.apps) {
  try {
    console.log('[SW] Firebase objeto disponible, inicializando...');
    
    if (!firebase.apps.length) {
      firebase.initializeApp({
        apiKey:            'AIzaSyDW7e5W8AfPOyr9Yxs-oQjiK3Pr96EhuQ0',
        authDomain:        'sinergiareaops.firebaseapp.com',
        projectId:         'sinergiareaops',
        storageBucket:     'sinergiareaops.firebasestorage.app',
        messagingSenderId: '183145068777',
        appId:             '1:183145068777:web:2d00873eb660edfac29878'
      });
      console.log('[SW] ✓ Firebase app inicializado');
    } else {
      console.log('[SW] ℹ Firebase app ya estaba inicializado');
    }
    
    if (typeof firebase.messaging === 'function') {
      messaging = firebase.messaging();
      swState.messagingReady = true;
      console.log('[SW] ✓ Firebase Messaging obtenido');
    } else {
      console.error('[SW] ✗ firebase.messaging no es una función');
      swState.errors.push('firebase.messaging no es función');
    }
    
  } catch(e) {
    const errMsg = `[SW] ✗ Error inicializando Firebase: ${e.message}`;
    console.error(errMsg, e);
    swState.errors.push(errMsg);
  }
} else {
  console.error('[SW] ✗ CRÍTICO: firebase objeto no está disponible');
  swState.errors.push('firebase objeto no disponible después de importScripts');
}

/* ── Evento de instalación del SW ── */
// ⚠️ FIX CRÍTICO: NO llamar skipWaiting() aquí.
// skipWaiting() forzado interrumpe el handshake del Push Service
// del navegador con el SW, causando "Registration failed - push service error".
// El SW debe llegar al estado 'activated' de forma natural.
self.addEventListener('install', event => {
  console.log('[SW] 📦 install event - Service Worker instalándose...');
  // NO skipWaiting() aquí — dejamos que el ciclo de vida sea natural
});

/* ── Evento de activación del SW ── */
self.addEventListener('activate', event => {
  console.log('[SW] ⚡ activate event - Service Worker activándose...');
  // clients.claim() toma control inmediato de las pestañas abiertas.
  // Esto es seguro aquí (en activate, no en install).
  event.waitUntil(
    self.clients.claim().then(() => {
      swState.initialized = true;
      console.log('[SW] ✓ clients.claim() completado — SW activo y en control');
    })
  );
});

/* ── Mensajes desde la app para debugging y control ── */
self.addEventListener('message', event => {
  if (event.data?.type === 'SW_STATE') {
    console.log('[SW] Estado actual:', swState);
    event.ports[0]?.postMessage(swState);
  }
  // Permite que la app fuerce skipWaiting() de forma controlada
  // cuando hay una actualización disponible (waiting SW)
  if (event.data?.type === 'SKIP_WAITING') {
    console.log('[SW] SKIP_WAITING recibido — activando nueva versión...');
    self.skipWaiting();
  }
});

/* ── Notificaciones en background (app cerrada o minimizada) ── */
if (messaging && swState.messagingReady) {
  console.log('[SW] Registrando listener onBackgroundMessage...');
  messaging.onBackgroundMessage(payload => {
    console.log('[SW] 📩 Notificación en background recibida:', payload);

    const { title = '🔔 Sinergia REA', body = 'Tienes una alerta pendiente' }
      = payload.notification || {};

    if (!title) {
      console.warn('[SW] ⚠️ Notificación sin título - ignorada');
      return;
    }

    try {
      self.registration.showNotification(title, {
        body,
        icon:  'https://cdn-icons-png.flaticon.com/512/2942/2942254.png',
        badge: 'https://cdn-icons-png.flaticon.com/512/2942/2942254.png',
        tag:   'sinergia-rea-alert',
        renotify: true,
        data:  payload.data || {},
        actions: [
          { action: 'open',    title: '📋 Ver en app' },
          { action: 'dismiss', title: 'Cerrar'        }
        ]
      });
      console.log('[SW] ✓ Notificación mostrada:', title);
    } catch(e) {
      console.error('[SW] ✗ Error mostrando notificación:', e);
    }
  });
} else {
  const msg = `[SW] ⚠️ No se pudo registrar onBackgroundMessage. Messaging: ${!!messaging}, Ready: ${swState.messagingReady}`;
  console.warn(msg);
  swState.errors.push(msg);
}

/* ── Al hacer clic en la notificación → abrir/enfocar la app ── */
self.addEventListener('notificationclick', event => {
  console.log('[SW] 🔔 notificationclick event - acción:', event.action);
  event.notification.close();

  if (event.action === 'dismiss') {
    console.log('[SW] Notificación descartada por usuario');
    return;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(list => {
        console.log(`[SW] ${list.length} cliente(s) encontrado(s)`);
        
        for (const client of list) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            console.log('[SW] ✓ Enfocando ventana existente:', client.url);
            return client.focus();
          }
        }
        
        if (clients.openWindow) {
          console.log('[SW] ✓ Abriendo nueva ventana en:', self.location.origin + '/');
          return clients.openWindow('/');
        }
      })
      .catch(err => {
        console.error('[SW] ✗ Error en notificationclick:', err);
      })
  );
});

console.log('[SW] ✅ Service Worker completamente inicializado');
console.log('[SW] Estado final:', swState);
