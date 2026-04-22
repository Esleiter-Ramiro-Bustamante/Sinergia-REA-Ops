/* ================================================================
   SINERGIA REA — Módulo: Tareas
   Tablero Kanban + Vista Lista para gestión de tareas contables.
   Incluye alertas visuales de vencimiento y prioridad.
   ================================================================ */

import { dbGet, dbCreate, dbUpdate, dbDelete } from '../../core/db.js';
import { fmtDate, daysUntil, clientName, toast } from '../../core/utils.js';
import { runAlertsEngine }    from '../../core/alerts.js';
import { playCompletionTone } from '../../ui/sound.js';
import { renderDashboard }    from '../dashboard/index.js';

/* ── Constantes ── */
const WARN_DAYS = 3;

const typeLabel = {
  tax: '🏛️ Impuestos', declaration: '📄 Declaraciones',
  invoice: '🧾 Facturación', payroll: '💼 Nómina',
  accounting: '📊 Contabilidad', imss: '🏥 IMSS',
  infonavit: '🏠 Infonavit', other: '📌 Otro'
};
const prioLabel      = { low: 'Baja', medium: 'Media', high: 'Alta' };
const statusLabel    = { pending: 'Pendiente', in_progress: 'En proceso', completed: 'Completado' };
const statusBadgeMap = { pending: 'badge-pending', in_progress: 'badge-progress', completed: 'badge-done' };

/* ── Estado del módulo ── */
let taskViewMode = 'kanban';

/* ── Helpers internos ── */
function _taskDateLabel(t) {
  if (!t.dueDate) return '<span class="task-date">Sin fecha límite</span>';
  const d = daysUntil(t.dueDate);
  if (d < 0)          return `<span class="task-date overdue">⚠ Vencida hace ${Math.abs(d)}d</span>`;
  if (d <= WARN_DAYS) return `<span class="task-date warning">⏰ Vence en ${d}d</span>`;
  return `<span class="task-date">📅 ${fmtDate(t.dueDate)}</span>`;
}

function _taskCardClass(t) {
  if (t.status === 'completed') return '';
  if (t.dueDate && daysUntil(t.dueDate) < 0)          return 'overdue';
  if (t.dueDate && daysUntil(t.dueDate) <= WARN_DAYS)  return 'warning';
  return '';
}

/* ── Filtros ──────────────────────────────────────────────────── */
/** Rellena el select de clientes en el filtro de tareas */
export function populateTaskFilters() {
  const sel = document.getElementById('task-client-filter');
  if (!sel) return;
  const clients = dbGet('clients');
  sel.innerHTML = '<option value="">Todos los clientes</option>' +
    clients.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
}

/** Alterna entre vista Kanban y vista Lista */
export function toggleTaskView() {
  taskViewMode = taskViewMode === 'kanban' ? 'list' : 'kanban';
  const btn = document.getElementById('task-view-toggle');
  if (btn) btn.textContent = taskViewMode === 'kanban' ? '📋 Vista Lista' : '🗂 Vista Kanban';
  renderTasks();
}

/* ── Render principal ─────────────────────────────────────────── */
/** Aplica filtros y delega al renderizador de vista activa */
export function renderTasks() {
  const search    = (document.getElementById('task-search')?.value    || '').toLowerCase();
  const clientF   =  document.getElementById('task-client-filter')?.value   || '';
  const priorityF =  document.getElementById('task-priority-filter')?.value || '';

  let tasks = dbGet('tasks');
  if (search)    tasks = tasks.filter(t => t.title.toLowerCase().includes(search) || (t.description || '').toLowerCase().includes(search));
  if (clientF)   tasks = tasks.filter(t => t.clientId === clientF);
  if (priorityF) tasks = tasks.filter(t => t.priority === priorityF);

  taskViewMode === 'kanban' ? _renderKanban(tasks) : _renderTaskList(tasks);
}

/* ── Kanban ───────────────────────────────────────────────────── */
function _renderKanban(tasks) {
  const kanbanEl = document.getElementById('tasks-kanban');
  const listEl   = document.getElementById('tasks-list');
  if (!kanbanEl) return;
  kanbanEl.style.display = '';
  if (listEl) listEl.style.display = 'none';

  const cols = [
    { key: 'pending',     label: 'Pendiente',  cls: 'col-pending'  },
    { key: 'in_progress', label: 'En proceso', cls: 'col-progress' },
    { key: 'completed',   label: 'Completado', cls: 'col-done'     }
  ];

  kanbanEl.innerHTML = `<div class="kanban-board">${
    cols.map(col => {
      const colTasks = tasks.filter(t => t.status === col.key);
      return `
        <div class="kanban-col ${col.cls}">
          <div class="kanban-col-header">
            <span class="kanban-col-title">${col.label}</span>
            <span class="col-count">${colTasks.length}</span>
          </div>
          ${colTasks.length
            ? colTasks.map(t => `
                <div class="task-card ${_taskCardClass(t)}">
                  <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">
                    <div class="task-card-title">${t.title}</div>
                    <span class="badge badge-${t.priority}">${prioLabel[t.priority] || t.priority}</span>
                  </div>
                  <div class="task-card-client">👤 ${clientName(t.clientId)} · ${typeLabel[t.type] || t.type}</div>
                  ${t.description ? `<div style="font-size:12px;color:var(--text-secondary);margin-bottom:6px;line-height:1.4">${t.description.slice(0,90)}${t.description.length>90?'…':''}</div>` : ''}
                  <div class="task-card-footer">
                    ${_taskDateLabel(t)}
                    <div class="task-actions">
                      <button title="Editar"   onclick='window.addTask(${JSON.stringify(t).replace(/'/g,"&#39;")})'>✏️</button>
                      <button title="Eliminar" onclick="window.deleteTask('${t.id}')">🗑️</button>
                    </div>
                  </div>
                  ${t.status === 'completed' ? `<div class="completed-by">✅ ${t.completedBy ? 'Por: '+t.completedBy : 'Completado'}</div>` : ''}
                </div>`).join('')
            : `<div class="empty-state" style="padding:24px 10px;">
                 <div class="empty-icon">📭</div>
                 <div class="empty-sub">Sin tareas</div>
               </div>`}
        </div>`;
    }).join('')
  }</div>`;
}

/* ── Lista ────────────────────────────────────────────────────── */
function _renderTaskList(tasks) {
  const kanbanEl = document.getElementById('tasks-kanban');
  const listEl   = document.getElementById('tasks-list');
  if (!listEl) return;
  if (kanbanEl) kanbanEl.style.display = 'none';
  listEl.style.display = '';

  if (!tasks.length) {
    listEl.innerHTML = `<div class="table-wrap"><div class="empty-state"><div class="empty-icon">📋</div><div class="empty-title">Sin tareas registradas</div><div class="empty-sub">Usa "+ Nuevo" para crear tu primera tarea</div></div></div>`;
    return;
  }

  listEl.innerHTML = `
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Tarea</th><th>Cliente</th><th>Tipo</th><th>Prioridad</th><th>Estado</th><th>Vencimiento</th><th>Completado por</th><th>Acciones</th></tr></thead>
        <tbody>
          ${tasks.map(t => `
            <tr>
              <td><strong>${t.title}</strong>${t.description ? `<div style="font-size:11px;color:var(--text-muted);margin-top:2px">${t.description.slice(0,60)}${t.description.length>60?'…':''}</div>` : ''}</td>
              <td>${clientName(t.clientId)}</td>
              <td>${typeLabel[t.type] || t.type}</td>
              <td><span class="badge badge-${t.priority}">${prioLabel[t.priority] || t.priority}</span></td>
              <td><span class="badge ${statusBadgeMap[t.status]}">${statusLabel[t.status] || t.status}</span></td>
              <td>${_taskDateLabel(t)}</td>
              <td>${t.status === 'completed' ? `<span class="completed-by">✅ ${t.completedBy || 'Completado'}</span>` : '<span style="color:var(--text-muted)">—</span>'}</td>
              <td>
                <div style="display:flex;gap:6px;">
                  <button class="btn-edit"   onclick='window.addTask(${JSON.stringify(t).replace(/'/g,"&#39;")})'>Editar</button>
                  <button class="btn-danger" onclick="window.deleteTask('${t.id}')">Eliminar</button>
                </div>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

/* ── Alta/Edición ─────────────────────────────────────────────── */
export async function addTask(prefill = {}) {
  const clients = dbGet('clients');
  if (!clients.length) {
    Swal.fire({ icon: 'warning', title: 'Sin clientes', text: 'Primero debes registrar al menos un cliente.' });
    return;
  }

  const clientOpts = clients.map(c =>
    `<option value="${c.id}" ${c.id === prefill.clientId ? 'selected' : ''}>${c.name}</option>`
  ).join('');

  const dueVal = prefill.dueDate ? prefill.dueDate.split('T')[0] : '';

  const { value: form } = await Swal.fire({
    title: prefill.id ? '✏️ Editar Tarea' : '📋 Nueva Tarea Contable',
    html: `
      <div class="swal-form">
        <label>Título *</label>
        <input id="t-title" value="${prefill.title || ''}" placeholder="Ej: Declaración mensual ISR">
        <label>Cliente *</label>
        <select id="t-client"><option value="">— Seleccionar cliente —</option>${clientOpts}</select>
        <label>Descripción</label>
        <textarea id="t-desc" rows="2" placeholder="Detalles o instrucciones">${prefill.description || ''}</textarea>
        <div class="two-col">
          <div>
            <label>Tipo de tarea</label>
            <select id="t-type">
              <option value="tax"         ${prefill.type==='tax'?'selected':''}>🏛️ Impuestos</option>
              <option value="declaration" ${prefill.type==='declaration'?'selected':''}>📄 Declaraciones</option>
              <option value="invoice"     ${prefill.type==='invoice'?'selected':''}>🧾 Facturación</option>
              <option value="payroll"     ${prefill.type==='payroll'?'selected':''}>💼 Nómina</option>
              <option value="accounting"  ${prefill.type==='accounting'?'selected':''}>📊 Contabilidad</option>
              <option value="imss"        ${prefill.type==='imss'?'selected':''}>🏥 IMSS</option>
              <option value="infonavit"   ${prefill.type==='infonavit'?'selected':''}>🏠 Infonavit</option>
              <option value="other"       ${prefill.type==='other'?'selected':''}>📌 Otro</option>
            </select>
          </div>
          <div>
            <label>Prioridad</label>
            <select id="t-priority">
              <option value="low"    ${prefill.priority==='low'?'selected':''}>🟢 Baja</option>
              <option value="medium" ${(prefill.priority||'medium')==='medium'?'selected':''}>🟡 Media</option>
              <option value="high"   ${prefill.priority==='high'?'selected':''}>🔴 Alta</option>
            </select>
          </div>
        </div>
        <div class="two-col">
          <div>
            <label>Estado</label>
            <select id="t-status" onchange="document.getElementById('cb-row').style.display=this.value==='completed'?'':'none'">
              <option value="pending"     ${(prefill.status||'pending')==='pending'?'selected':''}>⏳ Pendiente</option>
              <option value="in_progress" ${prefill.status==='in_progress'?'selected':''}>🔄 En proceso</option>
              <option value="completed"   ${prefill.status==='completed'?'selected':''}>✅ Completado</option>
            </select>
          </div>
          <div>
            <label>Fecha límite</label>
            <input type="date" id="t-due" value="${dueVal}">
          </div>
        </div>
        <div id="cb-row" style="${prefill.status==='completed'?'':'display:none'}">
          <label>Completado por</label>
          <input id="t-completed-by" value="${prefill.completedBy||''}" placeholder="Nombre de quien realizó la tarea">
        </div>
      </div>`,
    confirmButtonText: prefill.id ? 'Guardar cambios' : 'Crear tarea',
    showCancelButton:  true,
    cancelButtonText:  'Cancelar',
    preConfirm: () => {
      const title    = document.getElementById('t-title').value.trim();
      const clientId = document.getElementById('t-client').value;
      if (!title)    { Swal.showValidationMessage('El título es obligatorio'); return false; }
      if (!clientId) { Swal.showValidationMessage('Debes seleccionar un cliente'); return false; }
      const dueInput    = document.getElementById('t-due').value;
      const statusVal   = document.getElementById('t-status').value;
      const completedBy = document.getElementById('t-completed-by')?.value?.trim() || '';
      return {
        title, clientId,
        description:  document.getElementById('t-desc').value.trim(),
        type:         document.getElementById('t-type').value,
        priority:     document.getElementById('t-priority').value,
        status:       statusVal,
        dueDate:      dueInput ? new Date(dueInput).toISOString() : null,
        lastUpdate:   new Date().toISOString(),
        completedBy:  statusVal === 'completed' ? completedBy : null,
        completedAt:  statusVal === 'completed' ? new Date().toISOString() : null
      };
    }
  });

  if (!form) return;

  if (prefill.id) {
    await dbUpdate('tasks', prefill.id, form);
    if (form.status === 'completed' && prefill.status !== 'completed') {
      playCompletionTone();
      toast('✅ ¡Tarea completada!', 'success');
    } else {
      toast('Tarea actualizada', 'success');
    }
  } else {
    await dbCreate('tasks', form);
    toast('Tarea creada exitosamente', 'success');
  }

  runAlertsEngine();
  renderTasks();
  renderDashboard();
}

/* ── Eliminación ──────────────────────────────────────────────── */
export async function deleteTask(id) {
  const r = await Swal.fire({
    title: '¿Eliminar tarea?', text: 'Esta acción no se puede deshacer.',
    icon: 'warning', showCancelButton: true,
    confirmButtonText: 'Eliminar', cancelButtonText: 'Cancelar'
  });
  if (!r.isConfirmed) return;
  await dbDelete('tasks', id);
  runAlertsEngine();
  renderTasks();
  renderDashboard();
  toast('Tarea eliminada', 'info');
}
