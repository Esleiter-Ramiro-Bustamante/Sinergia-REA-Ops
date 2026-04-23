/* ================================================================
   SINERGIA REA — Core: Auth (Facade)  (FIX v2)
   Envuelve Firebase Auth + FCM + pantallas de carga en una
   interfaz simple: startAuth(onReady).

   Pattern: Facade — oculta la complejidad de:
     - Firebase onAuthStateChanged
     - Pantalla de login personalizada
     - Carga inicial de datos desde Firestore
     - Inicialización de FCM (push notifications)

   Uso desde main.js:
     import { startAuth } from './core/auth.js';
     startAuth(init); // init() se llama cuando todo está listo

   FIX v2:
     - onMessage() ya NO crea new Howl() directamente.
       Usa playForegroundAlert() del módulo sound.js, que reutiliza
       las instancias ya inicializadas por el usuario y evita el error
       "AudioContext was not allowed to start".
     - Se elimina el import innecesario de Howl dentro del callback.
   ================================================================ */

import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
  getToken, onMessage
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging.js';
import { auth, messaging } from './firebase.js';
import { loadAllFromFirestore } from './db.js';

// FIX v2: importar función de audio del módulo centralizado
import { playForegroundAlert } from '../ui/sound.js';

/* ── Usuarios autorizados ─────────────────────────────────────── */
const USUARIOS = {
  'esleiter@sinergiarea.com':  { nombre: 'Esleiter Ramiro',              rol: 'admin' },
  'angelica@sinergiarea.com':  { nombre: 'CP. Angelica Chagala Sixtega', rol: 'contadora' }
};

window.currentUser = null;

/* ── VAPID Key para FCM ───────────────────────────────────────── */
const FCM_VAPID_KEY = 'BMrGJhDoVNqgCAVvv-B689jxtzdC8T7CIeE8ugUgIDaMvGlHelqUL45YWLuOY1XYbyO71RAAnDfRB5-eQv4gnEQ';

/* ================================================================
   Pantalla de carga
   ================================================================ */
function _showLoadingScreen(msg = 'Conectando...') {
  if (document.getElementById('firebase-loading')) return;
  const d = document.createElement('div');
  d.id = 'firebase-loading';
  d.style.cssText = 'position:fixed;inset:0;z-index:9998;background:linear-gradient(135deg,#070e30,#0b1640);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;';
  d.innerHTML = `
    <div style="font-family:'DM Serif Display',serif;font-size:28px;color:#f5a623;">Sinergia <span style="color:#fff">REA</span></div>
    <div style="width:48px;height:48px;border:3px solid rgba(245,166,35,0.2);border-top-color:#f5a623;border-radius:50%;animation:spin .8s linear infinite"></div>
    <div style="font-size:13px;color:rgba(180,200,255,0.6);font-family:sans-serif;font-weight:600">${msg}</div>
    <style>@keyframes spin{to{transform:rotate(360deg)}}</style>`;
  document.body.appendChild(d);
}

function _hideLoadingScreen() {
  const el = document.getElementById('firebase-loading');
  if (el) {
    el.style.transition = 'opacity .4s';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 400);
  }
}

/* ================================================================
   Pantalla de login
   ================================================================ */
function _showLoginScreen() {
  const s = document.getElementById('sidebar');
  const m = document.querySelector('.main');
  if (s) s.style.display = 'none';
  if (m) m.style.display = 'none';
  if (document.getElementById('login-screen')) return;

  const div = document.createElement('div');
  div.id = 'login-screen';
  div.style.cssText = 'position:fixed;inset:0;z-index:9999;background:linear-gradient(135deg,#070e30 0%,#0b1640 60%,#0f1f6b 100%);display:flex;align-items:center;justify-content:center;font-family:Outfit,DM Sans,sans-serif;';
  div.innerHTML = `
    <div style="background:rgba(16,32,96,0.92);border:1px solid rgba(100,140,255,0.25);border-radius:20px;padding:44px 40px;width:100%;max-width:420px;box-shadow:0 24px 64px rgba(0,0,0,0.6);">
      <div style="text-align:center;margin-bottom:32px;">
        <div style="font-family:'DM Serif Display',serif;font-size:32px;color:#f5a623;text-shadow:0 0 20px rgba(245,166,35,0.4);line-height:1;">Sinergia <span style="color:#fff">REA</span></div>
        <div style="font-size:11px;color:#6880c8;letter-spacing:3px;text-transform:uppercase;margin-top:6px;font-weight:700;">Servicios Contables</div>
      </div>
      <div style="font-size:18px;font-weight:800;color:#fff;margin-bottom:4px;">Iniciar sesión</div>
      <div style="font-size:13px;color:#6880c8;margin-bottom:26px;font-weight:600;">Acceso exclusivo para personal autorizado</div>
      <div style="display:grid;gap:14px;">
        <div>
          <label style="font-size:10.5px;color:#6880c8;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;display:block;margin-bottom:6px;">Correo electrónico</label>
          <input id="login-email" type="email" placeholder="correo@sinergiarea.com"
            style="width:100%;background:#0b1640;border:1.5px solid rgba(100,140,255,0.3);border-radius:10px;padding:12px 16px;font-size:13px;color:#fff;outline:none;font-family:inherit;font-weight:600;"
            onkeydown="if(event.key==='Enter')window.doLogin()">
        </div>
        <div>
          <label style="font-size:10.5px;color:#6880c8;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;display:block;margin-bottom:6px;">Contraseña</label>
          <input id="login-pass" type="password" placeholder="••••••••"
            style="width:100%;background:#0b1640;border:1.5px solid rgba(100,140,255,0.3);border-radius:10px;padding:12px 16px;font-size:13px;color:#fff;outline:none;font-family:inherit;font-weight:600;"
            onkeydown="if(event.key==='Enter')window.doLogin()">
        </div>
        <div id="login-error" style="display:none;background:rgba(255,64,64,0.12);border:1px solid rgba(255,64,64,0.3);border-radius:8px;padding:10px 14px;font-size:12px;color:#ff4040;font-weight:700;"></div>
        <button id="login-btn" onclick="window.doLogin()"
          style="background:linear-gradient(135deg,#f5a623,#ff6b35);color:#fff;border:none;border-radius:10px;padding:13px;font-size:14px;font-weight:800;cursor:pointer;font-family:inherit;margin-top:4px;box-shadow:0 4px 20px rgba(245,166,35,0.4);">
          Entrar al sistema →
        </button>
      </div>
      <div style="text-align:center;margin-top:24px;font-size:11px;color:rgba(100,140,255,0.4);font-weight:600;">🔒 Sistema privado — Solo personal autorizado</div>
    </div>`;
  document.body.appendChild(div);
  setTimeout(() => document.getElementById('login-email')?.focus(), 100);
}

/* ── Info de usuario en topbar ────────────────────────────────── */
function _renderUserInfo() {
  const el = document.getElementById('user-info-topbar');
  if (!el || !window.currentUser) return;
  const u = window.currentUser;
  const c = u.rol === 'admin' ? '#f5a623' : '#00d4ff';
  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;">
      <div style="text-align:right;line-height:1.3;">
        <div style="font-size:12px;font-weight:800;color:#fff;white-space:nowrap;">${u.nombre.split(' ')[0]}</div>
        <div style="font-size:9.5px;font-weight:700;color:${c};text-transform:uppercase;letter-spacing:.7px;">${u.rol === 'admin' ? 'Admin' : 'Contadora'}</div>
      </div>
      <div style="width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,${c},#0b1640);border:2px solid ${c};display:flex;align-items:center;justify-content:center;font-size:15px;" title="${u.nombre}">${u.rol === 'admin' ? '👨‍💼' : '👩‍💼'}</div>
      <button onclick="window.doLogout()" style="background:rgba(255,64,64,0.15);border:1px solid rgba(255,64,64,0.3);color:#ff4040;border-radius:8px;padding:5px 10px;font-size:11px;font-weight:800;cursor:pointer;font-family:inherit;">Salir</button>
    </div>`;
}

/* ================================================================
   FCM — Push Notifications
   ================================================================ */
async function _esperarSWActivo(swReg, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    if (swReg.active) { resolve(); return; }
    const sw = swReg.installing || swReg.waiting;
    if (!sw) { resolve(); return; }
    const timer = setTimeout(() => resolve(), timeoutMs);
    sw.addEventListener('statechange', function onStateChange(e) {
      if (e.target.state === 'activated') {
        clearTimeout(timer); sw.removeEventListener('statechange', onStateChange); resolve();
      } else if (e.target.state === 'redundant') {
        clearTimeout(timer); sw.removeEventListener('statechange', onStateChange);
        reject(new Error('SW redundant'));
      }
    });
  });
}

async function _initFCM() {
  if (!('serviceWorker' in navigator) || !('Notification' in window)) return;

  try {
    // Limpiar SWs huérfanos que no sean el nuestro
    const existing = await navigator.serviceWorker.getRegistrations();
    for (const reg of existing) {
      if (!reg.scope.endsWith('/firebase-messaging-sw.js') &&
           reg.scope !== window.location.origin + '/') {
        await reg.unregister();
      }
    }

    const swPath = new URL('firebase-messaging-sw.js', window.location.href).pathname;
    const swReg  = await navigator.serviceWorker.register(swPath);
    await _esperarSWActivo(swReg);

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      setTimeout(() => {
        Swal.fire({
          icon: 'info', title: '⚠️ Notificaciones bloqueadas',
          html: '<p>Permiso de notificaciones rechazado.</p><p><small>Para habilitarlas, ve a Configuración → Sinergia REA → Notificaciones</small></p>',
          confirmButtonText: 'Entendido'
        });
      }, 1500);
      return;
    }

    const token = await getToken(messaging, { vapidKey: FCM_VAPID_KEY, serviceWorkerRegistration: swReg });
    if (!token) return;

    // Guardar token en Firestore
    const uid = window.currentUser?.uid;
    if (uid) {
      try {
        const { doc, updateDoc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
        const { db: fsDb } = await import('./firebase.js');
        await updateDoc(doc(fsDb, 'fcm_tokens', uid), { token, updatedAt: new Date().toISOString() })
          .catch(async () => {
            await setDoc(doc(fsDb, 'fcm_tokens', uid), {
              token, email: window.currentUser.email,
              nombre: window.currentUser.nombre,
              createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
            });
          });
      } catch { /* Guardar token es opcional, no bloquea */ }
    }

    // ── Notificaciones en FOREGROUND (app abierta) ──────────────
    // FIX v2: no crear new Howl() aquí — el AudioContext estaría bloqueado.
    // playForegroundAlert() reutiliza las instancias de sound.js ya
    // inicializadas por el primer click del usuario.
    onMessage(messaging, payload => {
      console.log('[FCM] 📩 Mensaje foreground recibido:', payload);

      const title = payload.notification?.title || '🔔 Sinergia REA';
      const body  = payload.notification?.body  || 'Tienes una alerta pendiente';

      // Mostrar notificación visual del navegador
      if (Notification.permission === 'granted') {
        new Notification(title, {
          body,
          icon:     'https://cdn-icons-png.flaticon.com/512/2942/2942254.png',
          badge:    'https://cdn-icons-png.flaticon.com/512/2942/2942254.png',
          tag:      'sinergia-rea-foreground',
          renotify: true
        });
      }

      // FIX v2: reproducir sonido usando el módulo centralizado
      // Determinar nivel según datos del payload (si se envían) o usar crítico por defecto
      const nivel = payload.data?.nivel === 'advertencia' ? 'advertencia' : 'critico';
      playForegroundAlert(nivel);
    });

    console.log('[FCM] ✅ Push notifications ACTIVAS. Token:', token.substring(0, 20) + '...');
    window.__FCM_DEBUG = { status: 'ACTIVE', token, uid };

  } catch (err) {
    const esPushError = err.message && (
      err.message.includes('push service error') ||
      err.message.includes('Registration failed') ||
      err.message.includes('AbortError')
    );
    window.__FCM_DEBUG = { status: 'ERROR', error: err.message };
    if (!esPushError) {
      console.error('[FCM] Error inesperado:', err.message);
    } else {
      // Este error desaparece una vez que el dominio esté autorizado
      // en Firebase Console → Authentication → Authorized domains
      console.warn('[FCM] Push Service no disponible. Verifica que el dominio esté autorizado en Firebase Console.');
    }
  }
}

/* ================================================================
   Facade principal: startAuth
   ================================================================ */
/**
 * Inicia el ciclo completo de autenticación.
 * Llama a onReady() cuando el usuario está autenticado y los datos cargados.
 * @param {Function} onReady - Callback de inicialización de la app
 */
export function startAuth(onReady) {
  _showLoadingScreen('Verificando sesión...');

  onAuthStateChanged(auth, async user => {
    if (user) {
      const info = USUARIOS[user.email];
      if (!info) {
        await signOut(auth);
        _hideLoadingScreen();
        Swal.fire('Acceso denegado', 'Este correo no está autorizado.', 'error');
        _showLoginScreen();
        return;
      }

      window.currentUser = { ...info, email: user.email, uid: user.uid };
      document.getElementById('login-screen')?.remove();

      const s = document.getElementById('sidebar');
      const m = document.querySelector('.main');
      if (s) s.style.display = '';
      if (m) m.style.display = '';

      _showLoadingScreen('Cargando datos...');
      try {
        await loadAllFromFirestore();
        _hideLoadingScreen();
        _renderUserInfo();
        if (typeof onReady === 'function') onReady();
        _initFCM();
      } catch (e) {
        _hideLoadingScreen();
        Swal.fire({
          icon: 'error', title: 'Error de conexión',
          html: 'No se pudo conectar a Firestore.<br>Verifica las reglas de seguridad.',
          confirmButtonText: 'Reintentar'
        }).then(() => location.reload());
      }
    } else {
      _hideLoadingScreen();
      document.getElementById('sidebar') && (document.getElementById('sidebar').style.display = 'none');
      document.querySelector('.main')    && (document.querySelector('.main').style.display    = 'none');
      _showLoginScreen();
    }
  });
}

/* ── Exponer doLogin / doLogout globalmente ───────────────────── */
window.doLogin = async function() {
  const email  = document.getElementById('login-email')?.value?.trim();
  const pass   = document.getElementById('login-pass')?.value;
  const errEl  = document.getElementById('login-error');
  const btn    = document.getElementById('login-btn');
  errEl.style.display = 'none';
  if (!email || !pass) { errEl.textContent = 'Ingresa tu correo y contraseña.'; errEl.style.display = 'block'; return; }
  btn.textContent = 'Verificando...'; btn.disabled = true;
  try {
    await signInWithEmailAndPassword(auth, email, pass);
  } catch {
    errEl.textContent = 'Credenciales incorrectas. Verifica e intenta de nuevo.';
    errEl.style.display = 'block';
    btn.textContent = 'Entrar al sistema →'; btn.disabled = false;
  }
};

window.doLogout = async function() {
  const { isConfirmed } = await Swal.fire({
    title: '¿Cerrar sesión?', icon: 'question',
    showCancelButton: true, confirmButtonText: 'Sí, salir', cancelButtonText: 'Cancelar'
  });
  if (isConfirmed) await signOut(auth);
};
