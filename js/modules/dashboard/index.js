/* ================================================================
   SINERGIA REA — Módulo: Dashboard
   Vista ejecutiva principal. Muestra KPIs y alertas activas.
   Lee directamente de la caché (sin llamadas async).
   ================================================================ */

import { dbGet }                           from '../../core/db.js';
import { daysUntil, daysDiff, fmtDate, clientName } from '../../core/utils.js';
import { ACTIVE_ALERTS }                   from '../../core/alerts.js';

/* ── Constantes ── */
const STALE_DAYS = 7;

const prioLabel     = { low: 'Baja', medium: 'Media', high: 'Alta' };
const statusLabel   = { pending: 'Pendiente', in_progress: 'En proceso', completed: 'Completado' };
const statusBadgeMap = {
  pending:     'badge-pending',
  in_progress: 'badge-progress',
  completed:   'badge-done'
};

/* ── Render principal ─────────────────────────────────────────── */
/**
 * Renderiza el dashboard completo: KPIs, panel de alertas y tareas recientes.
 * Se llama al navegar al dashboard y tras cualquier operación CRUD.
 */
export function renderDashboard() {
  const tasks        = dbGet('tasks');
  const clients      = dbGet('clients');
  const absences     = dbGet('absences');
  const appointments = dbGet('appointments');
  const now          = new Date();

  /* ── Calcular métricas KPI ── */
  const pending    = tasks.filter(t => t.status === 'pending').length;
  const overdue    = tasks.filter(t =>
    t.status !== 'completed' && t.dueDate && daysUntil(t.dueDate) < 0
  ).length;
  const noFollow   = tasks.filter(t =>
    t.status !== 'completed' && t.lastUpdate && daysDiff(t.lastUpdate) >= STALE_DAYS
  ).length;
  const todayAppts = appointments.filter(a => {
    const d = new Date(a.dateTime);
    return d.getDate()     === now.getDate()  &&
           d.getMonth()    === now.getMonth() &&
           d.getFullYear() === now.getFullYear();
  }).length;
  const activeClients = clients.filter(c => c.status === 'active').length;
  const monthAbsences = absences.filter(a =>
    a.month === now.getMonth() + 1 && a.year === now.getFullYear()
  ).length;

  /* ── Actualizar tarjetas KPI ── */
  const setKPI = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };
  setKPI('kpi-pending',   pending);
  setKPI('kpi-overdue',   overdue);
  setKPI('kpi-no-follow', noFollow);
  setKPI('kpi-appts',     todayAppts);
  setKPI('kpi-clients',   activeClients);
  setKPI('kpi-absences',  monthAbsences);

  /* ── Panel de alertas ── */
  const alertsContainer = document.getElementById('alerts-panel-container');
  if (alertsContainer) {
    if (ACTIVE_ALERTS.length > 0) {
      alertsContainer.innerHTML = `
        <div class="alerts-panel">
          <div class="alerts-header">🔔 Alertas activas — ${ACTIVE_ALERTS.length} incidencia(s) requieren atención</div>
          ${ACTIVE_ALERTS.slice(0, 5).map(a => `
            <div class="alert-item">
              <span class="alert-dot ${a.type}"></span>
              <div>
                <div class="alert-text">${a.text}</div>
                <div class="alert-sub">${a.sub}</div>
              </div>
            </div>`).join('')}
          ${ACTIVE_ALERTS.length > 5
            ? `<div class="alert-item">
                 <span style="font-size:12px;color:var(--text-muted);padding:0 6px">
                   + ${ACTIVE_ALERTS.length - 5} alertas más · Haz clic en 🔔 para ver todas
                 </span>
               </div>`
            : ''}
        </div>`;
    } else {
      alertsContainer.innerHTML = '';
    }
  }

  /* ── Tareas recientes ── */
  const recentTasks = [...tasks]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 6);

  const dashTable = document.getElementById('dash-tasks-table');
  if (!dashTable) return;

  if (!recentTasks.length) {
    dashTable.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📋</div>
        <div class="empty-title">Sin tareas registradas</div>
        <div class="empty-sub">Ve al módulo de Tareas para crear tu primera tarea contable</div>
      </div>`;
    return;
  }

  dashTable.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Tarea</th><th>Cliente</th>
          <th>Prioridad</th><th>Estado</th><th>Vencimiento</th>
        </tr>
      </thead>
      <tbody>
        ${recentTasks.map(t => `
          <tr>
            <td><strong>${t.title}</strong></td>
            <td>${clientName(t.clientId)}</td>
            <td><span class="badge badge-${t.priority}">${prioLabel[t.priority] || t.priority}</span></td>
            <td><span class="badge ${statusBadgeMap[t.status]}">${statusLabel[t.status] || t.status}</span></td>
            <td>${t.dueDate ? fmtDate(t.dueDate) : '<span style="color:var(--text-muted)">Sin fecha</span>'}</td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}
