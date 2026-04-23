/* ================================================================
   SINERGIA REA — UI: Sound  (FIX v2)
   Wrapper sobre Howler.js y Web Audio API para alertas sonoras.
   Encapsula toda la lógica de audio en un único módulo.

   Niveles de alerta:
     🔴 Crítico      → SD_ALERT_33.mp3 vol 0.9 completo
     🟠 Advertencia  → SD_ALERT_33.mp3 vol 0.45, solo 2s
     🟢 Completado   → tono suave Web Audio API

   Condición de disparo (modo scheduler):
     - Usuario inactivo ≥ 3 minutos
     - Cooldown de 15 minutos entre sonidos

   FIX v2:
     - playAlertSound() acepta array de alertas O string ('critico'|'advertencia')
       para poder ser llamado directamente desde onMessage() en foreground
       sin crear new Howl() duplicado (que ignora el AudioContext bloqueado).
     - Se exporta playForegroundAlert() como alias semántico limpio.
   ================================================================ */

/* ── Estado interno del módulo ─────────────────────────────────── */
const SOUND_KEY  = 'sinergia_rea_last_sound';
let soundPlaying = false;
let lastActivity = Date.now();
let howlCritical = null;
let howlWarning  = null;
let howlReady    = false;

// Limpiar cooldown stale al cargar (sesión nueva = sonido habilitado)
localStorage.removeItem(SOUND_KEY);

/* ── Registro de actividad del usuario ────────────────────────── */
export function recordUserActivity() {
  lastActivity = Date.now();
}

/* ── Inicialización de Howler.js ──────────────────────────────── */
/**
 * Idempotente. Solo puede ejecutarse tras un gesto del usuario
 * (política de autoplay de los navegadores).
 * startUserActivityTracker() lo conecta automáticamente al primer click.
 */
export function initHowler() {
  if (howlReady) {
    // Si ya está listo pero el contexto está suspendido, intentar reanudar
    if (typeof Howler !== 'undefined' && Howler.ctx && Howler.ctx.state === 'suspended') {
      Howler.ctx.resume().then(() => console.log('[Sound] AudioContext reanudado.'));
    }
    return;
  }
  
  howlReady    = true;
  howlCritical = new Howl({ src: ['SD_ALERT_33.mp3'], volume: 0.9 });
  howlWarning  = new Howl({
    src:    ['SD_ALERT_33.mp3'],
    volume: 0.45,
    sprite: { warn: [0, 2000] }
  });
  
  // Asegurar que el contexto se reanude tras la creación
  if (Howler.ctx && Howler.ctx.state === 'suspended') {
    Howler.ctx.resume();
  }
  
  console.log('[Sinergia REA] Howler.js inicializado y listo.');
}

/* ── Tono de completado ────────────────────────────────────────── */
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
  } catch (e) { /* AudioContext puede fallar si no hubo interacción */ }
}

/* ── Reproducción directa (foreground FCM) ────────────────────── */
/**
 * Reproduce sonido inmediatamente por nivel, SIN verificar inactividad
 * ni cooldown. Usar desde onMessage() cuando llega push en foreground.
 *
 * @param {'critico'|'advertencia'} nivel
 */
export function playForegroundAlert(nivel = 'critico') {
  if (!howlReady) {
    console.warn('[Sound] Howler no inicializado — el usuario aún no hizo click.');
    return;
  }
  if (soundPlaying) return;

  soundPlaying = true;

  if (nivel === 'critico' && howlCritical) {
    howlCritical.play();
    setTimeout(() => { soundPlaying = false; }, 6000);
  } else if (howlWarning) {
    howlWarning.play('warn');
    setTimeout(() => { soundPlaying = false; }, 3000);
  } else {
    soundPlaying = false;
  }
}

/* ── Reproducción de alerta (scheduler de alertas) ───────────── */
/**
 * Reproduce sonido según las alertas activas.
 * Verifica inactividad (≥ 3 min) y cooldown (≥ 15 min).
 *
 * Acepta:
 *   - Array de alertas: [{ type: 'red' }, { type: 'orange' }]
 *   - String de nivel:  'critico' | 'advertencia'  (alias directo)
 *
 * @param {Array|string} input
 */
export function playAlertSound(input) {
  // Alias: si recibe string, delegar a playForegroundAlert
  if (typeof input === 'string') {
    playForegroundAlert(input);
    return;
  }

  const activeAlerts = Array.isArray(input) ? input : [];

  if (!howlReady) {
    console.warn('[Sinergia REA] Howler no listo — audio pendiente de primer clic.');
    return;
  }

  if (soundPlaying) return;

  const hasRed    = activeAlerts.some(a => a.type === 'red');
  const hasOrange = activeAlerts.some(a => a.type === 'orange');
  if (!hasRed && !hasOrange) return;

  // Solo sonar si usuario lleva ≥ 3 min inactivo
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
function _showSoundIndicator(level, label, activeAlerts) {
  const prev = document.getElementById('sound-indicator');
  if (prev) prev.remove();

  const count  = activeAlerts.filter(a => level === 'red' ? a.type === 'red' : true).length;
  const border = level === 'red' ? 'var(--red)' : 'var(--orange)';

  const div     = document.createElement('div');
  div.id        = 'sound-indicator';
  div.className = 'sound-indicator';
  div.style.borderColor = border;
  div.onclick   = () => {
    div.remove();
    if (howlCritical) howlCritical.stop();
    if (howlWarning)  howlWarning.stop();
  };
  div.innerHTML = `
    <span class="sound-icon">${level === 'red' ? '🚨' : '⚠️'}</span>
    <div>
      <div class="sound-text" style="color:${border}">${label} — ${count} alerta(s)</div>
      <div class="sound-sub">Haz clic para silenciar</div>
    </div>`;

  document.body.appendChild(div);
  setTimeout(() => { if (div.parentNode) div.remove(); }, 9000);
}

/* ── Scheduler de actividad del usuario ───────────────────────── */
export function startUserActivityTracker() {
  ['click', 'keydown', 'mousemove', 'touchstart', 'scroll'].forEach(evt =>
    document.addEventListener(evt, recordUserActivity, { passive: true })
  );
  // Inicializar Howler en el primer click (política de autoplay)
  document.addEventListener('click', initHowler);
}
