/* ================================================================
   SINERGIA REA — Módulo: Reportes
   Reporte mensual de faltas + backup JSON del sistema.
   ================================================================ */

import { dbGet, getDB }                from '../../core/db.js';
import { daysUntil, fmtDate, clientName, monthName, toast } from '../../core/utils.js';

/* ── Render ───────────────────────────────────────────────────── */
/** Renderiza el reporte mensual completo con métricas y detalle */
export function renderReports() {
  const absences = dbGet('absences');
  const tasks    = dbGet('tasks');
  const now      = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear  = now.getFullYear();

  // Faltas del mes actual
  const monthAbsences = absences.filter(a =>
    a.month === currentMonth && a.year === currentYear
  );

  // Agrupar por cliente y ordenar por cantidad (más faltas primero)
  const byClient = {};
  monthAbsences.forEach(a => {
    if (!byClient[a.clientId]) byClient[a.clientId] = [];
    byClient[a.clientId].push(a);
  });
  const sorted    = Object.entries(byClient).sort((a, b) => b[1].length - a[1].length);
  const topClient = sorted.length ? clientName(sorted[0][0]) : '—';

  const overdueCnt = tasks.filter(t =>
    t.status !== 'completed' && t.dueDate && daysUntil(t.dueDate) < 0
  ).length;

  const container = document.getElementById('report-content');
  if (!container) return;

  container.innerHTML = `
    <div class="report-card">
      <div class="report-title">📊 Reporte — ${monthName(currentMonth)} ${currentYear}</div>
      <div class="report-grid">
        <div class="report-stat">
          <div class="report-stat-val">${monthAbsences.length}</div>
          <div class="report-stat-lbl">Faltas del mes</div>
        </div>
        <div class="report-stat">
          <div class="report-stat-val">${sorted.length}</div>
          <div class="report-stat-lbl">Clientes con faltas</div>
        </div>
        <div class="report-stat">
          <div class="report-stat-val" style="color:var(--red)">${overdueCnt}</div>
          <div class="report-stat-lbl">Tareas vencidas</div>
        </div>
        <div class="report-stat">
          <div class="report-stat-val" style="font-size:18px;color:var(--brand-navy)">${topClient}</div>
          <div class="report-stat-lbl">Cliente con más faltas</div>
        </div>
      </div>
    </div>

    ${sorted.length ? `
    <div class="section-header">
      <div>
        <div class="section-title">Detalle por cliente</div>
        <div class="section-subtitle">Todas las faltas de ${monthName(currentMonth)} ${currentYear}</div>
      </div>
    </div>
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr><th>Cliente</th><th>Total faltas</th><th>Fechas registradas</th><th>Tipo</th></tr>
        </thead>
        <tbody>
          ${sorted.map(([cid, abs]) => `
            <tr>
              <td><strong>${clientName(cid)}</strong></td>
              <td><span class="badge badge-high">${abs.length}</span></td>
              <td style="font-size:12px">${abs.map(a => fmtDate(a.date)).join(' · ')}</td>
              <td style="font-size:12px;color:var(--text-muted)">
                ${[...new Set(abs.map(a => a.type).filter(Boolean))].join(', ') || '—'}
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`
    : `
    <div class="empty-state" style="margin-top:16px;">
      <div class="empty-icon">🎉</div>
      <div class="empty-title">¡Sin faltas este mes!</div>
      <div class="empty-sub">No hay incumplimientos registrados en ${monthName(currentMonth)} ${currentYear}</div>
    </div>`}`;
}

/* ── Exportar Backup ──────────────────────────────────────────── */
/**
 * Exporta todos los datos de la caché como archivo JSON.
 * El usuario puede guardarlo como respaldo manual.
 */
export function exportData() {
  const db   = getDB();
  const json = JSON.stringify(db, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');

  a.href     = url;
  a.download = `sinergia_rea_backup_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);

  toast('Backup exportado correctamente', 'success');
}
