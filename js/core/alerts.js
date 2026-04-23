/* ================================================================
   SINERGIA REA — Core: Alerts Engine
   Motor de alertas inteligente. Evalúa condiciones críticas del sistema
   y mantiene el array ACTIVE_ALERTS actualizado.

   Condiciones evaluadas:
     1. Tareas vencidas (dueDate < hoy, no completada)
     2. Tareas próximas a vencer (≤ 3 días)
     3. Tareas sin seguimiento (lastUpdate ≥ 7 días)
     4. Citas no realizadas (scheduled + dateTime < ahora)
     5. Citas missed recientes (< 24h) — FIX BUG 6
     6. Alertas anticipadas de citas (≤ 60 min)
   ================================================================ */

import { dbGet, dbUpdate, getDB, saveDB } from './db.js';
import { daysUntil, daysDiff, clientName, fmtDateTime, MONTHS } from './utils.js';
import { playAlertSound, initHowler } from '../ui/sound.js';

/* ── Constantes ────────────────────────────────────────────────── */
const STALE_DAYS = 7;  // Días sin actualizar → tarea abandonada
const WARN_DAYS  = 3;  // Días antes del vencimiento → alerta preventiva

/** IDs de citas ya alertadas en esta sesión (evita duplicados) */
const ALERTED_APPOINTMENTS = new Set();

/* ── Estado exportable ─────────────────────────────────────────── */
/** Array de alertas activas. Importar en dashboard para mostrarlas. */
export let ACTIVE_ALERTS = [];

/* ================================================================
   NOTIFICACIONES DE ESCRITORIO
   Muestra una notificación nativa del SO + reproduce el sonido
   SD_ALERT_33.mp3 via Howler. Solo notifica si el usuario ya
   concedió el permiso (se pide desde el botón en el sidebar).
   ================================================================ */

/** Claves de alertas ya notificadas al escritorio en esta sesión */
const DESKTOP_NOTIFIED = new Set();

/** Instancia Howl reutilizable para el sonido de alerta */
let _alertSound = null;
function _getAlertSound() {
  if (!_alertSound && typeof Howl !== 'undefined') {
    _alertSound = new Howl({ src: ['/SD_ALERT_33.mp3'], volume: 0.8 });
  }
  return _alertSound;
}

/**
 * Muestra una notificación nativa del SO con sonido.
 * @param {string}      title - Título de la notificación
 * @param {string}      body  - Cuerpo del mensaje
 * @param {string|null} key   - Clave única para evitar duplicados (null = siempre notificar)
 */
function _desktopNotify(title, body, key = null) {
  if (Notification.permission !== 'granted') return;
  if (key !== null) {
    if (DESKTOP_NOTIFIED.has(key)) return;
    DESKTOP_NOTIFIED.add(key);
  }
  try {
    new Notification(title, {
      body,
      icon:     'https://cdn-icons-png.flaticon.com/512/2942/2942254.png',
      badge:    'https://cdn-icons-png.flaticon.com/512/2942/2942254.png',
      tag:      key || title,
      renotify: true
    });
    const snd = _getAlertSound();
    if (snd) snd.play();
  } catch (e) {
    console.warn('[Alerts] No se pudo mostrar notificación:', e.message);
  }
}


/* ── Motor principal ───────────────────────────────────────────── */
/**
 * Evalúa TODAS las condiciones del sistema y actualiza ACTIVE_ALERTS.
 * Debe llamarse: al iniciar, tras cualquier operación CRUD, y en el scheduler.
 */
export function runAlertsEngine() {
  ACTIVE_ALERTS = [];

  const tasks        = dbGet('tasks');
  const appointments = dbGet('appointments');

  /* ── 1-3. Evaluar tareas ── */
  tasks.forEach(t => {
    if (t.status === 'completed') return;

    const cname = clientName(t.clientId);

    if (t.dueDate && daysUntil(t.dueDate) < 0) {
      // 1. Tarea vencida
      const key = `overdue_${t.id}`;
      ACTIVE_ALERTS.push({
        type: 'red',
        text: `Tarea vencida: "${t.title}"`,
        sub:  `${cname} · Venció hace ${Math.abs(daysUntil(t.dueDate))} día(s)`
      });
      _desktopNotify(
        '🚨 Tarea vencida',
        `"${t.title}" — ${cname} · Venció hace ${Math.abs(daysUntil(t.dueDate))} día(s)`,
        key
      );
    } else if (t.dueDate && daysUntil(t.dueDate) <= WARN_DAYS) {
      // 2. Próxima a vencer
      const key = `warn_${t.id}_${daysUntil(t.dueDate)}`;
      ACTIVE_ALERTS.push({
        type: 'orange',
        text: `Próxima a vencer: "${t.title}"`,
        sub:  `${cname} · Vence en ${daysUntil(t.dueDate)} día(s)`
      });
      _desktopNotify(
        '⚠️ Tarea próxima a vencer',
        `"${t.title}" — ${cname} · Vence en ${daysUntil(t.dueDate)} día(s)`,
        key
      );
    }

    if (t.lastUpdate && daysDiff(t.lastUpdate) >= STALE_DAYS) {
      // 3. Sin seguimiento
      const key = `stale_${t.id}_${daysDiff(t.lastUpdate)}`;
      ACTIVE_ALERTS.push({
        type: 'gold',
        text: `Sin seguimiento: "${t.title}"`,
        sub:  `${cname} · ${daysDiff(t.lastUpdate)} días sin actualizar`
      });
      _desktopNotify(
        '🔔 Tarea sin seguimiento',
        `"${t.title}" — ${cname} · ${daysDiff(t.lastUpdate)} días sin actualizar`,
        key
      );
    }
  });


  /* ── 4-5. Evaluar citas no realizadas ── */
  appointments.forEach(a => {
    // FIX BUG 6: también mostrar citas 'missed' recientes (< 24h)
    const esReciente = (new Date() - new Date(a.dateTime)) < 24 * 60 * 60 * 1000;

    if (a.status === 'scheduled' && new Date(a.dateTime) < new Date()) {
      // 4. Marcar como missed y alertar
      dbUpdate('appointments', a.id, { status: 'missed' });
      ACTIVE_ALERTS.push({
        type: 'red',
        text: `Cita no realizada: "${a.title}"`,
        sub:  `${clientName(a.clientId)} · ${fmtDateTime(a.dateTime)}`
      });
      _desktopNotify(
        '🚨 Cita no realizada',
        `"${a.title}" — ${clientName(a.clientId)} · ${fmtDateTime(a.dateTime)}`,
        `missed_${a.id}`
      );
    } else if (a.status === 'missed' && esReciente) {
      // 5. FIX BUG 6: cita missed reciente — mantener alerta visible
      ACTIVE_ALERTS.push({
        type: 'red',
        text: `Cita no realizada: "${a.title}"`,
        sub:  `${clientName(a.clientId)} · ${fmtDateTime(a.dateTime)}`
      });
    }
  });


  /* ── 6. Alertas anticipadas de citas próximas ── */
  appointments.forEach(a => {
    if (a.status !== 'scheduled') return;

    const minutesBefore = (new Date(a.dateTime) - new Date()) / 60000;
    if (minutesBefore <= 0 || minutesBefore > 60) return;

    const alertKey = `${a.id}_${minutesBefore <= 10 ? '10' : minutesBefore <= 30 ? '30' : '60'}`;
    if (ALERTED_APPOINTMENTS.has(alertKey)) return;
    ALERTED_APPOINTMENTS.add(alertKey);

    const mins  = Math.floor(minutesBefore);
    const cname = clientName(a.clientId);

    if (minutesBefore <= 10) {
      ACTIVE_ALERTS.push({
        type: 'red',
        text: `⏰ ¡Cita AHORA: "${a.title}"!`,
        sub:  `${cname} · Inicia en ${mins} minuto(s)`
      });
      _desktopNotify(
        '⏰ ¡Cita AHORA!',
        `"${a.title}" — ${cname} · Inicia en ${mins} minuto(s)`,
        alertKey
      );
    } else if (minutesBefore <= 30) {
      ACTIVE_ALERTS.push({
        type: 'orange',
        text: `📅 Cita próxima: "${a.title}"`,
        sub:  `${cname} · Inicia en ${mins} minutos`
      });
      _desktopNotify(
        '📅 Cita en 30 minutos',
        `"${a.title}" — ${cname} · Inicia en ${mins} minutos`,
        alertKey
      );
    } else {
      ACTIVE_ALERTS.push({
        type: 'orange',
        text: `📅 Cita en 1 hora: "${a.title}"`,
        sub:  `${cname} · Inicia en ${mins} minutos`
      });
      _desktopNotify(
        '📅 Cita en 1 hora',
        `"${a.title}" — ${cname} · Inicia en ${mins} minutos`,
        alertKey
      );
    }
  });


  /* ── Actualizar badge visual ── */
  const count = ACTIVE_ALERTS.length;
  const countEl = document.getElementById('alert-count');
  if (countEl) countEl.textContent = count;
  const dot = document.getElementById('alert-dot');
  if (dot) dot.style.display = count > 0 ? 'block' : 'none';

  // Sonar si hay alertas (esto asegura que suene al iniciar la app)
  playAlertSound(ACTIVE_ALERTS);
}

/* ── Panel de alertas ──────────────────────────────────────────── */
/** Muestra un modal con todas las alertas activas al clicar en 🔔 */
export function showAlertsPanel() {
  if (ACTIVE_ALERTS.length === 0) {
    Swal.fire({
      icon:              'success',
      title:             '¡Todo en orden!',
      text:              'No hay alertas activas en este momento.',
      confirmButtonText: 'Entendido'
    });
    return;
  }

  const html = ACTIVE_ALERTS.map(a => {
    const dotColor = a.type === 'red' ? '#ef4444' : a.type === 'orange' ? '#f97316' : '#f59e0b';
    return `
      <div style="display:flex;gap:10px;align-items:flex-start;
                  padding:10px 0;border-bottom:1px solid rgba(26,35,126,0.08);">
        <span style="width:8px;height:8px;border-radius:50%;background:${dotColor};
                     flex-shrink:0;margin-top:5px;"></span>
        <div>
          <div style="font-size:13px;color:#1a1f3c;font-weight:500">${a.text}</div>
          <div style="font-size:11px;color:#8892b0;margin-top:2px">${a.sub}</div>
        </div>
      </div>`;
  }).join('');

  Swal.fire({
    title:             `🔔 Alertas activas (${ACTIVE_ALERTS.length})`,
    html:              `<div style="text-align:left;max-height:320px;overflow-y:auto">${html}</div>`,
    confirmButtonText: 'Cerrar'
  });
}

/* ── Detección de cambio de mes ───────────────────────────────── */
/**
 * Detecta si cambió el mes desde la última visita.
 * Si cambió → muestra aviso y actualiza meta.
 * @param {Function} onConfirm - Callback cuando el usuario acepta ver el reporte
 */
export function checkMonthChange(onConfirm) {
  const db           = getDB();
  const currentMonth = new Date().getMonth();

  if (db.meta.lastMonthCheck !== currentMonth) {
    db.meta.lastMonthCheck = currentMonth;
    saveDB(db);

    setTimeout(() => {
      Swal.fire({
        icon:              'info',
        title:             `📊 Nuevo mes: ${MONTHS[currentMonth]}`,
        text:              'Se inició un nuevo mes. Revisa el reporte mensual.',
        confirmButtonText: 'Ver reporte'
      }).then(r => { if (r.isConfirmed && onConfirm) onConfirm(); });
    }, 1200);
  }
}

/* ── Scheduler periódico ───────────────────────────────────────── */
/**
 * Inicia el scheduler que re-evalúa alertas cada 30 minutos.
 * También programa la alerta diaria a las 14:50 (2:50 PM).
 * @param {Function} onTick - Callback tras cada evaluación (para re-renderizar dashboard)
 */
export function startAlertScheduler(onTick) {
  setInterval(() => {
    runAlertsEngine();
    if (onTick) onTick();
  }, 30 * 60 * 1000); // Cada 30 minutos

  // Programar recordatorio diario a las 14:50
  _scheduleDailyReminder();
}

/* ================================================================
   RECORDATORIO DIARIO A LAS 14:50 (2:50 PM)
   Calcula los ms que faltan hasta las 14:50 del día actual
   (o mañana si ya pasó) y usa setTimeout.
   Después se repite cada 24h con setInterval.
   ================================================================ */
let _dailyReminderTimer = null;

function _scheduleDailyReminder() {
  const now    = new Date();
  const target = new Date();
  target.setHours(14, 50, 0, 0);

  // Si ya pasó hoy, programar para mañana
  if (now >= target) target.setDate(target.getDate() + 1);

  const msUntil = target - now;
  console.log(`[Alerts] 📅 Recordatorio 14:50 en ${Math.round(msUntil / 60000)} min`);

  clearTimeout(_dailyReminderTimer);
  _dailyReminderTimer = setTimeout(() => {
    _fireDailyReminder();
    setInterval(_fireDailyReminder, 24 * 60 * 60 * 1000);
  }, msUntil);
}

function _fireDailyReminder() {
  const pendientes = dbGet('tasks').filter(t => t.status !== 'completed').length;
  const title = '🔔 Recordatorio Sinergia REA';
  const body  = pendientes > 0
    ? `Tienes ${pendientes} tarea(s) pendiente(s). ¿Hay nuevas tareas por asignar hoy?`
    : '¿Hay tareas nuevas por asignar hoy? Revisa el tablero.';

  console.log('[Alerts] 📅 Recordatorio diario 14:50 disparado');
  // key = null: no anti-duplicado, siempre notifica a las 14:50
  _desktopNotify(title, body, null);
}

/**
 * Función de prueba para verificar sonido y notificaciones.
 */
export function testNotify() {
  // Asegurar que Howler esté despierto (gesto del usuario)
  initHowler();

  console.log('[Alerts] 🧪 Disparando notificación de prueba...');
  _desktopNotify(
    '🔔 Prueba de Sinergia REA',
    '¡El sistema de audio y notificaciones está funcionando correctamente! ✨',
    null // null para que siempre suene al probar
  );
}

