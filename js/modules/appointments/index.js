/* ================================================================
   SINERGIA REA — Módulo: Citas
   Agenda de reuniones con clientes. Detección automática de citas
   no realizadas mediante el motor de alertas.
   ================================================================ */

import { dbGet, dbCreate, dbUpdate, dbDelete } from '../../core/db.js';
import { fmtDateTime, clientName, toast } from '../../core/utils.js';
import { runAlertsEngine } from '../../core/alerts.js';
import { renderDashboard } from '../dashboard/index.js';

/* ── Filtros ──────────────────────────────────────────────────── */
/** Rellena el select de clientes en el filtro de citas */
export function populateApptFilters() {
  const sel = document.getElementById('appt-client-filter');
  if (!sel) return;
  const clients = dbGet('clients');
  sel.innerHTML = '<option value="">Todos los clientes</option>' +
    clients.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
}

/* ── Render ───────────────────────────────────────────────────── */
/** Renderiza la tabla de citas con filtros aplicados */
export function renderAppointments() {
  const clientF = document.getElementById('appt-client-filter')?.value || '';
  const statusF = document.getElementById('appt-status-filter')?.value || '';

  let appts = dbGet('appointments');
  if (clientF) appts = appts.filter(a => a.clientId === clientF);
  if (statusF) appts = appts.filter(a => a.status   === statusF);
  appts.sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime));

  const apptStatusLabel = {
    scheduled: 'Programada', completed: 'Realizada',
    missed: 'No realizada',  cancelled: 'Cancelada'
  };
  const apptColorMap = {
    scheduled: '#6366f1', completed: '#10b981',
    missed:    '#ef4444', cancelled: '#6b7280'
  };

  const container = document.getElementById('appointments-grid');
  if (!container) return;

  if (!appts.length) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1; padding: 60px;">
        <div class="empty-icon">📅</div>
        <div class="empty-title">Sin citas registradas</div>
        <div class="empty-sub">No hay reuniones agendadas con los filtros seleccionados.</div>
      </div>`;
    return;
  }

  container.innerHTML = appts.map(a => {
    const color = apptColorMap[a.status] || '#6366f1';
    return `
      <div class="appt-card" style="border-left: 4px solid ${color}">
        <div class="appt-card-header">
          <div class="appt-client">${clientName(a.clientId)}</div>
          <div class="appt-status-dot" style="background: ${color}" title="${apptStatusLabel[a.status]}"></div>
        </div>
        <div class="appt-title">${a.title}</div>
        <div class="appt-time">
          <span class="icon">🕒</span> ${fmtDateTime(a.dateTime)}
        </div>
        <div class="appt-desc">${a.description || 'Sin notas adicionales.'}</div>
        <div class="appt-actions">
          <button class="btn-action-edit" onclick='window.addAppointment(${JSON.stringify(a).replace(/'/g,"&#39;")})'>
            ✏️ Editar
          </button>
          <button class="btn-action-del" onclick="window.deleteAppt('${a.id}')">
            🗑️ Eliminar
          </button>
        </div>
      </div>`;
  }).join('');
}

/* ── Alta/Edición ─────────────────────────────────────────────── */
export async function addAppointment(prefill = {}) {
  const clients = dbGet('clients');
  if (!clients.length) {
    Swal.fire({ icon: 'warning', title: 'Sin clientes', text: 'Primero registra al menos un cliente.' });
    return;
  }

  const clientOpts = clients.map(c =>
    `<option value="${c.id}" ${c.id === prefill.clientId ? 'selected' : ''}>${c.name}</option>`
  ).join('');

  const dtVal = prefill.dateTime ? prefill.dateTime.slice(0, 16) : '';

  const { value: form } = await Swal.fire({
    title: prefill.id ? '✏️ Editar Cita' : '📅 Nueva Cita',
    html: `
      <div class="swal-form">
        <label>Cliente *</label>
        <select id="ap-client">
          <option value="">— Seleccionar cliente —</option>
          ${clientOpts}
        </select>
        <label>Título / Motivo *</label>
        <input id="ap-title" value="${prefill.title || ''}" placeholder="Ej: Revisión declaración anual">
        <div class="two-col">
          <div>
            <label>Fecha y hora *</label>
            <input type="datetime-local" id="ap-dt" value="${dtVal}">
          </div>
          <div>
            <label>Estado</label>
            <select id="ap-status">
              <option value="scheduled"  ${(prefill.status||'scheduled')==='scheduled'?'selected':''}>📅 Programada</option>
              <option value="completed"  ${prefill.status==='completed'?'selected':''}>✅ Realizada</option>
              <option value="missed"     ${prefill.status==='missed'?'selected':''}>❌ No realizada</option>
              <option value="cancelled"  ${prefill.status==='cancelled'?'selected':''}>🚫 Cancelada</option>
            </select>
          </div>
        </div>
        <label>Descripción / Notas</label>
        <textarea id="ap-desc" rows="2" placeholder="Detalles adicionales">${prefill.description || ''}</textarea>
      </div>`,
    confirmButtonText: prefill.id ? 'Guardar cambios' : 'Agendar cita',
    showCancelButton:  true,
    cancelButtonText:  'Cancelar',
    preConfirm: () => {
      const clientId = document.getElementById('ap-client').value;
      const title    = document.getElementById('ap-title').value.trim();
      const dt       = document.getElementById('ap-dt').value;
      if (!clientId) { Swal.showValidationMessage('Selecciona un cliente'); return false; }
      if (!title)    { Swal.showValidationMessage('El título es obligatorio'); return false; }
      if (!dt)       { Swal.showValidationMessage('La fecha y hora son obligatorias'); return false; }
      return {
        clientId, title,
        dateTime:    new Date(dt).toISOString(),
        status:      document.getElementById('ap-status').value,
        description: document.getElementById('ap-desc').value.trim()
      };
    }
  });

  if (!form) return;

  if (prefill.id) {
    await dbUpdate('appointments', prefill.id, form);
    toast('Cita actualizada', 'success');
  } else {
    await dbCreate('appointments', form);
    toast('Cita agendada exitosamente', 'success');
  }

  runAlertsEngine();
  renderAppointments();
  renderDashboard();
}

/* ── Eliminación ──────────────────────────────────────────────── */
export async function deleteAppt(id) {
  const r = await Swal.fire({
    title: '¿Eliminar cita?', icon: 'warning',
    showCancelButton: true, confirmButtonText: 'Eliminar', cancelButtonText: 'Cancelar'
  });
  if (!r.isConfirmed) return;
  await dbDelete('appointments', id);
  renderAppointments();
  renderDashboard();
  toast('Cita eliminada', 'info');
}
