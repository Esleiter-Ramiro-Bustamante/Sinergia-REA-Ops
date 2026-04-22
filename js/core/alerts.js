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
import { playAlertSound } from '../ui/sound.js';

/* ── Constantes ────────────────────────────────────────────────── */
const STALE_DAYS = 7;  // Días sin actualizar → tarea abandonada
const WARN_DAYS  = 3;  // Días antes del vencimiento → alerta preventiva

/** IDs de citas ya alertadas en esta sesión (evita duplicados) */
const ALERTED_APPOINTMENTS = new Set();

/* ── Estado exportable ─────────────────────────────────────────── */
/** Array de alertas activas. Importar en dashboard para mostrarlas. */
export let ACTIVE_ALERTS = [];

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
      ACTIVE_ALERTS.push({
        type: 'red',
        text: `Tarea vencida: "${t.title}"`,
        sub:  `${cname} · Venció hace ${Math.abs(daysUntil(t.dueDate))} día(s)`
      });
    } else if (t.dueDate && daysUntil(t.dueDate) <= WARN_DAYS) {
      // 2. Próxima a vencer
      ACTIVE_ALERTS.push({
        type: 'orange',
        text: `Próxima a vencer: "${t.title}"`,
        sub:  `${cname} · Vence en ${daysUntil(t.dueDate)} día(s)`
      });
    }

    if (t.lastUpdate && daysDiff(t.lastUpdate) >= STALE_DAYS) {
      // 3. Sin seguimiento
      ACTIVE_ALERTS.push({
        type: 'gold',
        text: `Sin seguimiento: "${t.title}"`,
        sub:  `${cname} · ${daysDiff(t.lastUpdate)} días sin actualizar`
      });
    }
  });

  /* ── 4-5. Evaluar citas no realizadas ── */
  appointments.forEach(a => {
    // FIX BUG 6: también mostrar citas 'missed' recientes (< 24h)
    // para que la alerta persista aunque el scheduler ya cambió el status.
    const esReciente = (new Date() - new Date(a.dateTime)) < 24 * 60 * 60 * 1000;

    if (a.status === 'scheduled' && new Date(a.dateTime) < new Date()) {
      // 4. Marcar como missed y alertar
      dbUpdate('appointments', a.id, { status: 'missed' });
      ACTIVE_ALERTS.push({
        type: 'red',
        text: `Cita no realizada: "${a.title}"`,
        sub:  `${clientName(a.clientId)} · ${fmtDateTime(a.dateTime)}`
      });
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
    } else if (minutesBefore <= 30) {
      ACTIVE_ALERTS.push({
        type: 'orange',
        text: `📅 Cita próxima: "${a.title}"`,
        sub:  `${cname} · Inicia en ${mins} minutos`
      });
    } else {
      ACTIVE_ALERTS.push({
        type: 'orange',
        text: `📅 Cita en 1 hora: "${a.title}"`,
        sub:  `${cname} · Inicia en ${mins} minutos`
      });
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
 * Inicia el scheduler que re-evalúa alertas cada 10 minutos.
 * @param {Function} onTick - Callback tras cada evaluación (para re-renderizar dashboard)
 */
export function startAlertScheduler(onTick) {
  setInterval(() => {
    runAlertsEngine();
    if (onTick) onTick();
    // playAlertSound ya se llama dentro de runAlertsEngine
  }, 30 * 60 * 1000); // Cada 30 minutos
}
