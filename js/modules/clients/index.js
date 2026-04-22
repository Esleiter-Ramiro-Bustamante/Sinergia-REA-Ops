/* ================================================================
   SINERGIA REA — Módulo: Clientes
   CRUD completo de clientes del despacho contable.
   Incluye soporte de regímenes fiscales SAT y giros empresariales.
   ================================================================ */

import { dbGet, dbCreate, dbUpdate, deleteClientCascade } from '../../core/db.js';
import { fmtDate, clientName, toast, populateAllClientFilters } from '../../core/utils.js';
import { REGIMENES_SAT, GIROS_EMPRESARIALES } from '../../core/firebase.js';

/* ── Renderizado ──────────────────────────────────────────────── */
/**
 * Renderiza la tabla de clientes aplicando los filtros activos.
 * Se llama al entrar a la vista y al escribir en el buscador.
 */
export function renderClients() {
  const search  = (document.getElementById('client-search')?.value  || '').toLowerCase();
  const statusF =  document.getElementById('client-status-filter')?.value || '';
  const regimeF =  document.getElementById('client-regime-filter')?.value || '';

  let clients = dbGet('clients');
  
  // Aplicar Filtros
  if (search)  clients = clients.filter(c =>
    c.name.toLowerCase().includes(search) ||
    (c.businessName || '').toLowerCase().includes(search) ||
    (c.rfc || '').toLowerCase().includes(search)
  );
  if (statusF) clients = clients.filter(c => c.status === statusF);
  if (regimeF) clients = clients.filter(c => c.regimen1 === regimeF || c.regimen2 === regimeF);

  const tbody = document.getElementById('clients-tbody');
  if (!tbody) return;

  if (!clients.length) {
    tbody.innerHTML = `
      <tr><td colspan="8">
        <div class="empty-state">
          <div class="empty-icon">👤</div>
          <div class="empty-title">Sin clientes registrados</div>
          <div class="empty-sub">No se encontraron clientes con los filtros aplicados</div>
        </div>
      </td></tr>`;
    return;
  }

  tbody.innerHTML = clients.map((c, index) => {
    const reg1     = c.regimen1 ? `<span class="badge badge-pending" style="font-size:10px;">${c.regimen1}</span>` : '<span style="color:var(--text-muted)">—</span>';
    const reg2     = c.regimen2 ? `<span class="badge badge-progress" style="font-size:10px;margin-left:3px;">${c.regimen2}</span>` : '';
    const ivaColor = c.giroIva === '0%' ? 'var(--green)' : c.giroIva === '16%' ? 'var(--blue)' : 'var(--brand-gold)';
    const historial = c.updatedBy ? `<div style="font-size:10px;color:var(--text-muted);margin-top:2px;">✏️ ${c.updatedBy} · ${fmtDate(c.updatedAt)}</div>` : '';
    
    return `
      <tr>
        <td style="color:var(--text-muted);font-weight:700;font-size:12px;">${index + 1}</td>
        <td><strong>${c.name}</strong>${historial}</td>
        <td>${c.businessName || '<span style="color:var(--text-muted)">—</span>'}</td>
        <td>${c.phone || '<span style="color:var(--text-muted)">—</span>'}</td>
        <td>
          <div>${reg1}${reg2}</div>
          ${c.regimen1Nombre ? `<div style="font-size:10px;color:var(--text-muted);margin-top:2px;">${c.regimen1Nombre.slice(0,35)}${c.regimen1Nombre.length>35?'…':''}</div>` : ''}
        </td>
        <td>
          ${c.giroNombre ? `<div style="font-size:12px;font-weight:700;color:#fff;">${c.giroNombre}</div>` : '<span style="color:var(--text-muted)">—</span>'}
          ${c.giroIva ? `<div style="font-size:10px;font-weight:800;color:${ivaColor};">IVA ${c.giroIva}</div>` : ''}
        </td>
        <td><span class="badge ${c.status === 'active' ? 'badge-active' : 'badge-inactive'}">${c.status === 'active' ? '● Activo' : '○ Inactivo'}</span></td>
        <td>
          <div style="display:flex;gap:6px;">
            <button class="btn-edit"   onclick='window.addClient(${JSON.stringify(c)})'>Editar</button>
            <button class="btn-danger" onclick="window.deleteClient('${c.id}')">Eliminar</button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

/* ── Formulario de Alta/Edición ──────────────────────────────── */
/**
 * Abre el modal SweetAlert2 para crear o editar un cliente.
 * @param {Object} prefill - Cliente existente para editar (vacío = nuevo)
 */
export async function addClient(prefill = {}) {
  const regOpts = REGIMENES_SAT.map(r => {
    const isPrincipal = r.clave === '626' || r.clave === '612';
    const label = isPrincipal ? `⭐ ${r.clave} — ${r.nombre}` : `${r.clave} — ${r.nombre}`;
    return `<option value="${r.clave}" ${prefill.regimen1 === r.clave ? 'selected' : ''}>${label}</option>`;
  }).join('');

  const reg2Opts = REGIMENES_SAT.map(r =>
    `<option value="${r.clave}" ${prefill.regimen2 === r.clave ? 'selected' : ''}>${r.clave} — ${r.nombre}</option>`
  ).join('');

  const giroOpts = GIROS_EMPRESARIALES.map(g =>
    `<option value="${g.id}" data-iva="${g.iva}" ${prefill.giroId === g.id ? 'selected' : ''}>${g.nombre} (IVA: ${g.iva})</option>`
  ).join('');

  const { value: form } = await Swal.fire({
    title:  prefill.id ? '✏️ Editar Cliente' : '👤 Nuevo Cliente',
    width:  600,
    html: `
      <div class="swal-form">
        <label>Nombre *</label>
        <input id="s-name" value="${prefill.name || ''}" placeholder="Nombre completo del cliente">

        <label>Razón Social</label>
        <input id="s-biz" value="${prefill.businessName || ''}" placeholder="Empresa o razón social">

        <div class="two-col">
          <div>
            <label>Teléfono</label>
            <input id="s-phone" value="${prefill.phone || ''}" placeholder="55 0000 0000">
          </div>
          <div>
            <label>Email</label>
            <input id="s-email" value="${prefill.email || ''}" placeholder="correo@ejemplo.com">
          </div>
        </div>

        <label>Estado</label>
        <select id="s-status">
          <option value="active"   ${(prefill.status || 'active') === 'active' ? 'selected' : ''}>Activo</option>
          <option value="inactive" ${prefill.status === 'inactive' ? 'selected' : ''}>Inactivo</option>
        </select>

        <label>Régimen Fiscal Principal * (⭐ = más comunes)</label>
        <select id="s-reg1">
          <option value="">— Seleccionar régimen —</option>
          ${regOpts}
        </select>

        <label>Segundo Régimen Fiscal (opcional)</label>
        <select id="s-reg2">
          <option value="">— Ninguno —</option>
          ${reg2Opts}
        </select>

        <label>Giro Empresarial *</label>
        <select id="s-giro" onchange="
          const g = window.GIROS_EMPRESARIALES?.find(x=>x.id===this.value);
          document.getElementById('s-iva-display').textContent = g ? 'IVA: '+g.iva : '';
        ">
          <option value="">— Seleccionar giro —</option>
          ${giroOpts}
        </select>
        <div id="s-iva-display" style="font-size:11px;color:#00e676;font-weight:700;margin-top:-4px;">
          ${prefill.giroIva ? 'IVA: ' + prefill.giroIva : ''}
        </div>
      </div>`,
    confirmButtonText: prefill.id ? 'Guardar cambios' : 'Crear cliente',
    showCancelButton:  true,
    cancelButtonText:  'Cancelar',
    preConfirm: () => {
      const name = document.getElementById('s-name').value.trim();
      if (!name) { Swal.showValidationMessage('El nombre es obligatorio'); return false; }

      const clients = dbGet('clients');
      const dup = clients.find(c => c.name.toLowerCase() === name.toLowerCase() && c.id !== prefill.id);
      if (dup) { Swal.showValidationMessage('Ya existe un cliente con ese nombre'); return false; }

      const reg1 = document.getElementById('s-reg1').value;
      if (!reg1) { Swal.showValidationMessage('Selecciona al menos un régimen fiscal'); return false; }

      const giroId = document.getElementById('s-giro').value;
      if (!giroId) { Swal.showValidationMessage('Selecciona el giro empresarial'); return false; }

      const reg2  = document.getElementById('s-reg2').value;
      const giro  = GIROS_EMPRESARIALES.find(g => g.id === giroId);
      const rObj1 = REGIMENES_SAT.find(r => r.clave === reg1);
      const rObj2 = reg2 ? REGIMENES_SAT.find(r => r.clave === reg2) : null;

      return {
        name,
        businessName:   document.getElementById('s-biz').value.trim(),
        phone:          document.getElementById('s-phone').value.trim(),
        email:          document.getElementById('s-email').value.trim(),
        status:         document.getElementById('s-status').value,
        regimen1:       reg1,
        regimen1Nombre: rObj1 ? rObj1.nombre : '',
        regimen2:       reg2 || '',
        regimen2Nombre: rObj2 ? rObj2.nombre : '',
        giroId,
        giroNombre:     giro ? giro.nombre : '',
        giroIva:        giro ? giro.iva : ''
      };
    }
  });

  if (!form) return;

  if (prefill.id) {
    await dbUpdate('clients', prefill.id, form);
    toast('Cliente actualizado', 'success');
  } else {
    await dbCreate('clients', form);
    toast('Cliente creado exitosamente', 'success');
  }

  renderClients();
  populateAllClientFilters();
}

/* ── Eliminación ──────────────────────────────────────────────── */
/**
 * Elimina un cliente y todos sus registros relacionados.
 * @param {string} id - ID del cliente
 */
export async function deleteClient(id) {
  const { isConfirmed } = await Swal.fire({
    title:             '¿Eliminar cliente?',
    text:              'Se eliminarán también todas sus tareas, faltas y citas asociadas.',
    icon:              'warning',
    showCancelButton:  true,
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText:  'Cancelar'
  });

  if (!isConfirmed) return;

  try {
    await deleteClientCascade(id);
    toast('Cliente eliminado', 'info');
    renderClients();
    populateAllClientFilters();
  } catch (e) { /* Error ya mostrado por deleteClientCascade */ }
}
