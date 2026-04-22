/* ================================================================
   SINERGIA REA — Módulo: Faltas
   Control de incumplimientos por cliente y período mensual.
   ================================================================ */

import { dbGet, dbCreate, dbUpdate, dbDelete } from '../../core/db.js';
import { fmtDate, monthName, clientName, toast } from '../../core/utils.js';
import { renderDashboard } from '../dashboard/index.js';

/* ── Filtros ──────────────────────────────────────────────────── */
/** Rellena el select de clientes en el filtro de faltas */
export function populateAbsenceFilters() {
  const sel = document.getElementById('absence-client-filter');
  if (!sel) return;
  const clients = dbGet('clients');
  sel.innerHTML = '<option value="">Todos los clientes</option>' +
    clients.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
}

/* ── Render ───────────────────────────────────────────────────── */
/** Renderiza la tabla de faltas con filtros aplicados */
export function renderAbsences() {
  const clientF = document.getElementById('absence-client-filter')?.value || '';
  const monthF  = document.getElementById('absence-month-filter')?.value  || '';

  let absences = dbGet('absences');
  if (clientF) absences = absences.filter(a => a.clientId === clientF);
  if (monthF)  absences = absences.filter(a => String(a.month) === monthF);
  absences.sort((a, b) => new Date(b.date) - new Date(a.date));

  const tbody = document.getElementById('absences-tbody');
  if (!tbody) return;

  if (!absences.length) {
    tbody.innerHTML = `
      <tr><td colspan="6">
        <div class="empty-state">
          <div class="empty-icon">✅</div>
          <div class="empty-title">Sin faltas registradas</div>
          <div class="empty-sub">No hay incumplimientos con los filtros aplicados</div>
        </div>
      </td></tr>`;
    return;
  }

  tbody.innerHTML = absences.map(a => `
    <tr>
      <td><strong>${clientName(a.clientId)}</strong></td>
      <td>${fmtDate(a.date)}</td>
      <td>${a.type || '<span style="color:var(--text-muted)">—</span>'}</td>
      <td><span class="badge badge-pending">${monthName(a.month)} ${a.year}</span></td>
      <td>${a.notes || '<span style="color:var(--text-muted)">—</span>'}</td>
      <td>
        <div style="display:flex;gap:6px;">
          <button class="btn-edit"   onclick='window.addAbsence(${JSON.stringify(a).replace(/'/g,"&#39;")})'>Editar</button>
          <button class="btn-danger" onclick="window.deleteAbsence('${a.id}')">Eliminar</button>
        </div>
      </td>
    </tr>`).join('');
}

/* ── Alta/Edición ─────────────────────────────────────────────── */
export async function addAbsence(prefill = {}) {
  const clients = dbGet('clients');
  if (!clients.length) {
    Swal.fire({ icon: 'warning', title: 'Sin clientes', text: 'Primero registra al menos un cliente.' });
    return;
  }

  const clientOpts = clients.map(c =>
    `<option value="${c.id}" ${c.id === prefill.clientId ? 'selected' : ''}>${c.name}</option>`
  ).join('');

  const { value: form } = await Swal.fire({
    title: prefill.id ? '✏️ Editar Falta' : '❌ Registrar Falta',
    html: `
      <div class="swal-form">
        <label>Cliente *</label>
        <select id="a-client">
          <option value="">— Seleccionar cliente —</option>
          ${clientOpts}
        </select>
        <div class="two-col">
          <div>
            <label>Fecha *</label>
            <input type="date" id="a-date" value="${prefill.date ? prefill.date.split('T')[0] : ''}">
          </div>
          <div>
            <label>Tipo de falta</label>
            <input id="a-type" value="${prefill.type || ''}" placeholder="Ej: Documentación, Pago">
          </div>
        </div>
        <label>Observaciones</label>
        <textarea id="a-notes" rows="2" placeholder="Notas adicionales">${prefill.notes || ''}</textarea>
      </div>`,
    confirmButtonText: prefill.id ? 'Guardar' : 'Registrar falta',
    showCancelButton:  true,
    cancelButtonText:  'Cancelar',
    preConfirm: () => {
      const clientId = document.getElementById('a-client').value;
      const date     = document.getElementById('a-date').value;
      if (!clientId) { Swal.showValidationMessage('Selecciona un cliente'); return false; }
      if (!date)     { Swal.showValidationMessage('La fecha es obligatoria'); return false; }
      const d = new Date(date);
      return {
        clientId,
        date:  d.toISOString(),
        type:  document.getElementById('a-type').value.trim(),
        notes: document.getElementById('a-notes').value.trim(),
        month: d.getMonth() + 1,
        year:  d.getFullYear()
      };
    }
  });

  if (!form) return;

  if (prefill.id) {
    await dbUpdate('absences', prefill.id, form);
    toast('Falta actualizada', 'success');
  } else {
    await dbCreate('absences', form);
    toast('Falta registrada', 'success');
  }

  renderAbsences();
  renderDashboard();
}

/* ── Eliminación ──────────────────────────────────────────────── */
export async function deleteAbsence(id) {
  const r = await Swal.fire({
    title: '¿Eliminar falta?', icon: 'warning',
    showCancelButton: true, confirmButtonText: 'Eliminar', cancelButtonText: 'Cancelar'
  });
  if (!r.isConfirmed) return;
  await dbDelete('absences', id);
  renderAbsences();
  renderDashboard();
  toast('Falta eliminada', 'info');
}
