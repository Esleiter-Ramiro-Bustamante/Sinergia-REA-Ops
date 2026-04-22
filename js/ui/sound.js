/* ================================================================
   SINERGIA REA — UI: Sound
   Wrapper sobre Howler.js y Web Audio API para alertas sonoras.
   Encapsula toda la lógica de audio en un único módulo.

   Niveles de alerta:
     🔴 Crítico   → SD_ALERT_33.mp3 vol 0.9 completo
     🟠 Advertencia → SD_ALERT_33.mp3 vol 0.45, solo 2s
     🟢 Completado  → tono suave Web Audio API

   Condición de disparo:
     - Usuario inactivo ≥ 3 minutos
     - Cooldown de 15 minutos entre sonidos
   ================================================================ */

/* ── Estado interno del módulo ─────────────────────────────────── */
const SOUND_KEY    = 'sinergia_rea_last_sound';
let soundPlaying   = false;
let lastActivity   = Date.now();
let howlCritical   = null;
let howlWarning    = null;
let howlReady      = false;

// Limpiar timestamp de cooldown al iniciar sesión (FIX BUG 3)
// Evita que un valor viejo del día anterior bloquee el sonido indefinidamente.
localStorage.removeItem(SOUND_KEY);

/* ── Registro de actividad del usuario ────────────────────────── */
/** Actualiza el timestamp de última actividad */
export function recordUserActivity() {
  lastActivity = Date.now();
}

/* ── Inicialización de Howler.js ──────────────────────────────── */
/**
 * Inicializa Howler.js. Idempotente — se puede llamar múltiples veces.
 * Requiere gesto del usuario (política de audio del navegador).
 *
 * FIX BUG 2: El listener original usaba { once: true }, causando que
 * howlReady quedara en true pero las instancias fueran null si Howler
 * no había terminado de cargar. Ahora es idempotente con guard howlReady.
 */
export function initHowler() {
  if (howlReady) return; // Guard: evitar instancias duplicadas
  howlReady    = true;
  howlCritical = new Howl({ src: ['SD_ALERT_33.mp3'], volume: 0.9 });
  howlWarning  = new Howl({
    src:    ['SD_ALERT_33.mp3'],
    volume: 0.45,
    sprite: { warn: [0, 2000] }
  });
  console.log('[Sinergia REA] Howler.js listo.');
}

/* ── Tono de completado ────────────────────────────────────────── */
/**
 * Reproduce un tono agradable al completar una tarea.
 * Usa Web Audio API (sin dependencias externas).
 */
export function playCompletionTone() {
  try {
    const ctx  = new (window.AudioContext || window.webkitAudioContext)();
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.22, ctx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.0);
    [523.25, 659.25].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.connect(gain);
      osc.start(ctx.currentTime + i * 0.12);
      osc.stop(ctx.currentTime + 1.3);
    });
  } catch (e) { /* Silenciar errores de AudioContext */ }
}

/* ── Reproducción de alerta ───────────────────────────────────── */
/**
 * Reproduce sonido según el nivel de alerta activo.
 * Solo suena si:
 *   - Howler.js está inicializado
 *   - Hay alertas rojas u naranjas
 *   - El usuario lleva ≥ 3 min inactivo (FIX BUG 1)
 *   - Han pasado ≥ 15 min desde el último sonido
 *
 * @param {Array} activeAlerts - Array de alertas activas del motor
 */
export function playAlertSound(activeAlerts) {
  // FIX BUG 2: si Howler no está listo, no podemos reproducir aún
  if (!howlReady) {
    console.warn('[Sinergia REA] Howler no listo — audio pendiente de primer clic.');
    return;
  }

  if (soundPlaying) return;

  const hasRed    = activeAlerts.some(a => a.type === 'red');
  const hasOrange = activeAlerts.some(a => a.type === 'orange');
  if (!hasRed && !hasOrange) return;

  // FIX BUG 1: solo sonar si usuario lleva ≥ 3 min inactivo
  const INACTIVITY_MS = 3 * 60 * 1000;
  if ((Date.now() - lastActivity) < INACTIVITY_MS) {
    console.log('[Sinergia REA] Usuario activo — sonido diferido.');
    return;
  }

  // Cooldown: máximo 1 sonido cada 15 minutos
  const lastSound = parseInt(localStorage.getItem(SOUND_KEY) || '0');
  if ((Date.now() - lastSound) < 15 * 60 * 1000) return;

  soundPlaying = true;
  localStorage.setItem(SOUND_KEY, Date.now().toString());

  if (hasRed) {
    howlCritical.play();
    _showSoundIndicator('red', '🚨 ALERTA CRÍTICA', activeAlerts);
    setTimeout(() => { soundPlaying = false; }, 6000);
  } else {
    howlWarning.play('warn');
    _showSoundIndicator('orange', '⚠️ Advertencia', activeAlerts);
    setTimeout(() => { soundPlaying = false; }, 3000);
  }
}

/* ── Indicador visual de sonido ───────────────────────────────── */
/** Muestra una notificación flotante cuando suena una alerta */
function _showSoundIndicator(level, label, activeAlerts) {
  const prev = document.getElementById('sound-indicator');
  if (prev) prev.remove();

  const count  = activeAlerts.filter(a => level === 'red' ? a.type === 'red' : true).length;
  const border = level === 'red' ? 'var(--red)' : 'var(--orange)';

  const div      = document.createElement('div');
  div.id         = 'sound-indicator';
  div.className  = 'sound-indicator';
  div.style.borderColor = border;
  div.onclick    = () => {
    div.remove();
    if (howlCritical) howlCritical.stop();
    if (howlWarning)  howlWarning.stop();
  };
  div.innerHTML  = `
    <span class="sound-icon">${level === 'red' ? '🚨' : '⚠️'}</span>
    <div>
      <div class="sound-text" style="color:${border}">${label} — ${count} alerta(s)</div>
      <div class="sound-sub">Haz clic para silenciar</div>
    </div>`;

  document.body.appendChild(div);
  setTimeout(() => { if (div.parentNode) div.remove(); }, 9000);
}

/* ── Scheduler de actividad del usuario ───────────────────────── */
/**
 * Registra los eventos de actividad del usuario.
 * Llamar una vez al iniciar la app.
 */
export function startUserActivityTracker() {
  ['click', 'keydown', 'mousemove', 'touchstart', 'scroll'].forEach(evt =>
    document.addEventListener(evt, recordUserActivity, { passive: true })
  );
  // FIX BUG 2: listener persistente sin { once: true }
  document.addEventListener('click', initHowler);
}
