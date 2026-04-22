/* ================================================================
   SINERGIA REA — declaraciones.ui.js  v3.2 (Restaurado Completo)
   Responsabilidad: Interfaz de usuario para declaraciones SAT.
   ================================================================ */

import { obtenerClientesPorRegimen } from '../clientes/clientes.service.js';
import {
  obtenerPeriodos,
  crearPeriodoSiNoExiste,
  obtenerMapaDeclaraciones,
  guardarDeclaracion
} from './declaraciones.service.js';
import {
  CHECKS_RESICO,
  CHECKS_SUELDOS,
  calcularEstado,
  estadoMeta,
  colorProgreso
} from '../../utils/porcentaje.utils.js';
import { obtenerPeriodoActual, periodoLabel, siguientePeriodo } from '../../utils/date.utils.js';
import {
  CLIENTES_RESICO_EXCEL,
  CLIENTES_SUELDOS_EXCEL,
  fusionarClientes
} from './clientes-resico.catalog.js';

/* ── Estado local ── */
let periodoActivo  = '';
let subvistaActiva = 'resico';
let mapaDeclaraciones = {};
let todosLosClientes = [];

function getEstadoClientes() {
  try { return JSON.parse(localStorage.getItem('sinergia_estado_clientes') || '{}'); }
  catch { return {}; }
}
function setEstadoCliente(id, status) {
  const m = getEstadoClientes();
  m[id] = status;
  localStorage.setItem('sinergia_estado_clientes', JSON.stringify(m));
}
function getClienteStatus(id) {
  return getEstadoClientes()[id] || 'active';
}

export async function initDeclaracionesView() {
  const contenedor = document.getElementById('view-declaraciones');
  if (!contenedor) return;
  contenedor.innerHTML = buildLoader('Sincronizando datos...');

  try {
    periodoActivo = obtenerPeriodoActual();
    await crearPeriodoSiNoExiste(periodoActivo);
    const periodos = await obtenerPeriodos();
    
    // Cargar todos los clientes para tenerlos disponibles en reportes
    const resicoF = obtenerClientesPorRegimen('626');
    const sueldosF = obtenerClientesPorRegimen('605');
    const resicoTotal = fusionarClientes(resicoF, CLIENTES_RESICO_EXCEL);
    const sueldosTotal = fusionarClientes(sueldosF, CLIENTES_SUELDOS_EXCEL);
    todosLosClientes = [...resicoTotal, ...sueldosTotal];

    contenedor.innerHTML = buildVistaHTML(periodos);
    await cargarSubvista(subvistaActiva);
  } catch (err) {
    contenedor.innerHTML = `<div class="empty-state">⚠️ Error: ${err.message}</div>`;
  }
}

function buildVistaHTML(periodos) {
  const opcionesPeriodo = periodos.map(p =>
    `<option value="${p}" ${p === periodoActivo ? 'selected' : ''}>${periodoLabel(p)}</option>`
  ).join('');

  return `
    <div class="section-header">
      <div>
        <div class="section-title">Declaraciones Mensuales SAT</div>
        <div class="section-subtitle">Control de avance por cliente y periodo · Régimen RESICO y Sueldos & Salarios</div>
      </div>
      <div style="display:flex;gap:12px;">
        <button class="btn-secondary" onclick="window.__decl_agregarClienteResico()">➕ Nuevo cliente</button>
        <button class="btn-secondary" onclick="window.__decl_crearSiguientePeriodo()">📅 Abrir periodo</button>
      </div>
    </div>
    <div class="decl-toolbar">
      <div class="decl-periodo-wrap">
        <label class="decl-label">PERÍODO</label>
        <select id="decl-periodo-select" class="filter-select" onchange="window.__decl_cambiarPeriodo(this.value)">${opcionesPeriodo}</select>
      </div>
      <div class="decl-tabs">
        <button id="tab-resico" class="decl-tab ${subvistaActiva === 'resico' ? 'active' : ''}" onclick="window.__decl_cambiarTab('resico')">🏛️ RESICO (626)</button>
        <button id="tab-sueldos" class="decl-tab ${subvistaActiva === 'sueldos' ? 'active' : ''}" onclick="window.__decl_cambiarTab('sueldos')">💼 Sueldos y Salarios (605)</button>
        <button id="tab-reportes" class="decl-tab ${subvistaActiva === 'reportes' ? 'active' : ''}" onclick="window.__decl_cambiarTab('reportes')">📊 Completados & Inactivos</button>
      </div>
    </div>
    <div id="decl-resumen-bar"></div>
    <div id="decl-tabla-container"></div>`;
}

async function cargarSubvista(tipo) {
  const contenedor = document.getElementById('decl-tabla-container');
  if (!contenedor) return;

  // Cargar mapas de declaraciones
  const mapaResico = await obtenerMapaDeclaraciones(periodoActivo, 'resico');
  const mapaSueldos = await obtenerMapaDeclaraciones(periodoActivo, 'sueldos');
  mapaDeclaraciones = { ...mapaResico, ...mapaSueldos };

  if (tipo === 'reportes') { await cargarReportes(contenedor); return; }

  const checksDef = tipo === 'resico' ? CHECKS_RESICO : CHECKS_SUELDOS;
  const catalogoExcel = tipo === 'resico' ? CLIENTES_RESICO_EXCEL : CLIENTES_SUELDOS_EXCEL;
  const clientesFirestore = obtenerClientesPorRegimen(tipo === 'resico' ? '626' : '605');
  const clientesActuales = fusionarClientes(clientesFirestore, catalogoExcel);

  const filas = clientesActuales.map(c => {
    const decl = mapaDeclaraciones[c.id] || {};
    const checks = decl.checks || {};
    const clientStatus = getClienteStatus(c.id);
    const { estado, porcentaje } = calcularEstado(checks, checksDef, clientStatus);
    return { cliente: c, checks, estado, porcentaje, clientStatus };
  });

  contenedor.innerHTML = buildTablaHTML(filas, checksDef, tipo);
  renderResumenBar(filas, checksDef);
}

function buildTablaHTML(filas, checksDef, tipo) {
  const pendientes = filas.filter(f => f.estado !== 'COMPLETO' && f.estado !== 'INACTIVO');
  if (!pendientes.length) return `<div class="empty-state">✅ Todo listo en este régimen para el periodo seleccionado.</div>`;

  const rows = pendientes.map(({ cliente, checks, estado, porcentaje, clientStatus }, index) => {
    const meta = estadoMeta(estado);
    const barColor = colorProgreso(porcentaje);

    const tdChecks = checksDef.map(c => `
      <td style="text-align:center;">
        <input type="checkbox" class="decl-check" data-cliente="${cliente.id}" data-check="${c.key}" data-tipo="${tipo}"
          ${checks[c.key] ? 'checked' : ''} onchange="window.__decl_onCheck(this)">
      </td>`).join('');

    return `
      <tr id="decl-row-${cliente.id}">
        <td style="color:var(--text-muted);font-weight:700;font-size:11px;width:30px">${index + 1}</td>
        <td>
          <div style="font-weight:700;font-size:14px;display:flex;align-items:center;gap:10px;">
            ${cliente.name || cliente.nombre}
            <button class="btn-action-baja" onclick="window.__decl_toggleCliente('${cliente.id}', 'inactive')" title="Mover a inactivos">
              🚫 Baja
            </button>
          </div>
          <div style="font-size:10px;color:var(--text-muted);margin-top:2px">${cliente.rfc || 'SIN RFC'}</div>
        </td>
        ${tdChecks}
        <td>
          <div style="display:flex;align-items:center;gap:10px;">
            <div class="progress-container"><div class="progress-fill" style="width:${porcentaje}%;background:${barColor};"></div></div>
            <span style="font-size:11px;font-weight:800;color:${barColor};min-width:30px">${porcentaje}%</span>
          </div>
        </td>
        <td><span class="badge-status" style="background:${meta.bg};color:${meta.color}">${meta.icon} ${estado}</span></td>
      </tr>`;
  }).join('');

  return `
    <div class="table-group-label">📋 LISTADO DE TRABAJO (${pendientes.length})</div>
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>#</th><th>Cliente</th>${checksDef.map(c => `<th>${c.label}</th>`).join('')}<th>Avance</th><th>Estado</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

async function cargarReportes(contenedor) {
  const data = todosLosClientes.map(c => {
    const decl = mapaDeclaraciones[c.id] || {};
    const checks = decl.checks || {};
    const status = getClienteStatus(c.id);
    const regType = (c.regimen1 === '626' || c.regimen2 === '626') ? 'resico' : 'sueldos';
    const checksDef = regType === 'resico' ? CHECKS_RESICO : CHECKS_SUELDOS;
    const { estado, porcentaje } = calcularEstado(checks, checksDef, status);
    return { cliente: c, estado, porcentaje, status, regType };
  });

  const completados = data.filter(d => d.estado === 'COMPLETO');
  const inactivos   = data.filter(d => d.estado === 'INACTIVO');

  let html = '';

  // 1. COMPLETADOS
  if (completados.length) {
    const rows = completados.map((d, index) => {
      const meta = estadoMeta('COMPLETO');
      return `
        <tr>
          <td style="color:var(--text-muted);font-weight:700;width:30px">${index + 1}</td>
          <td>
            <div style="font-weight:700">${d.cliente.name || d.cliente.nombre}</div>
            <div style="font-size:10px;color:var(--text-muted)">${d.cliente.rfc || ''}</div>
          </td>
          <td><div style="font-size:11px;font-weight:600;color:var(--text-muted)">${d.regType === 'resico' ? '🏛️ RESICO (626)' : '💼 SUELDOS (605)'}</div></td>
          <td>
             <div style="display:flex;align-items:center;gap:10px;">
              <div class="progress-container"><div class="progress-fill" style="width:100%;background:var(--green);"></div></div>
              <span style="font-size:11px;font-weight:800;color:var(--green);">100%</span>
            </div>
          </td>
          <td><span class="badge-status" style="background:${meta.bg};color:${meta.color}">${meta.icon} COMPLETO</span></td>
        </tr>`;
    }).join('');

    html += `
      <div class="table-group-label" style="color:var(--green)">✅ COMPLETADOS (${completados.length})</div>
      <div class="table-wrap" style="margin-bottom:30px">
        <table class="data-table">
          <thead><tr><th>#</th><th>Cliente</th><th>Régimen</th><th>Avance</th><th>Estado</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  // 2. INACTIVOS
  if (inactivos.length) {
    const rows = inactivos.map((d, index) => `
      <tr>
        <td style="color:var(--text-muted);font-weight:700;width:30px">${index + 1}</td>
        <td>
          <div style="font-weight:600">${d.cliente.name || d.cliente.nombre}</div>
          <div style="font-size:10px;color:var(--text-muted)">${d.cliente.rfc || ''}</div>
        </td>
        <td>
          <div style="display:flex;gap:8px;">
            <button class="btn-action-reactivar" onclick="window.__decl_toggleCliente('${d.cliente.id}', 'active')">✅ Reactivar</button>
            <button class="btn-action-delete" onclick="window.__decl_eliminarDefinitivo('${d.cliente.id}', '${d.cliente.name || d.cliente.nombre}')">🗑️ Eliminar</button>
          </div>
        </td>
      </tr>`).join('');

    html += `
      <div class="table-group-label" style="color:#f97316">🚫 CLIENTES EN BAJA / INACTIVOS (${inactivos.length})</div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>#</th><th>Cliente</th><th>Acciones</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  if (!html) html = `<div class="empty-state">📂 No hay datos para mostrar en esta sección.</div>`;
  contenedor.innerHTML = html;
}

function renderResumenBar(filas, checksDef) {
  const el = document.getElementById('decl-resumen-bar');
  if (!el) return;
  const activos = filas.filter(f => f.estado !== 'INACTIVO');
  const completos = activos.filter(f => f.estado === 'COMPLETO').length;
  const pct = activos.length ? Math.round((completos / activos.length) * 100) : 0;
  
  el.innerHTML = `
    <div class="decl-resumen-bar">
      <div class="decl-resumen-stat"><span>${activos.length}</span><label>Clientes</label></div>
      <div class="decl-divider"></div>
      <div class="decl-resumen-stat"><span>${completos}</span><label>Listos</label></div>
      <div class="decl-divider"></div>
      <div style="flex:1;display:flex;flex-direction:column;gap:5px;">
        <div style="font-size:11px;font-weight:800;color:var(--text-muted);text-transform:uppercase">${pct}% Avance Global</div>
        <div class="progress-container"><div class="progress-fill" style="width:${pct}%;background:${colorProgreso(pct)}"></div></div>
      </div>
    </div>`;
}

/* ── Global Handlers ── */
window.__decl_onCheck = async function(el) {
  const { cliente, check, tipo } = el.dataset;
  if (!mapaDeclaraciones[cliente]) mapaDeclaraciones[cliente] = { checks: {} };
  mapaDeclaraciones[cliente].checks[check] = el.checked;

  const checksDef = tipo === 'resico' ? CHECKS_RESICO : CHECKS_SUELDOS;
  const { estado, porcentaje } = calcularEstado(mapaDeclaraciones[cliente].checks, checksDef);
  
  await guardarDeclaracion({ clienteId: cliente, periodo: periodoActivo, tipo, checks: mapaDeclaraciones[cliente].checks, estado, porcentaje });
  
  if (estado === 'COMPLETO') {
    window.toast && window.toast('¡Declaración completada!', 'success');
    cargarSubvista(tipo);
  } else {
    actualizarFilaDOM(cliente, mapaDeclaraciones[cliente].checks, estado, porcentaje);
  }
};

window.__decl_toggleCliente = async function(id, status) {
  const isBaja = status === 'inactive';
  const { isConfirmed } = await Swal.fire({
    title: isBaja ? '¿Mover a Inactivos?' : '¿Reactivar Cliente?',
    text: isBaja ? 'El cliente dejará de aparecer en la lista de trabajo actual.' : 'El cliente volverá a la lista de trabajo.',
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: isBaja ? 'Sí, dar de baja' : 'Sí, reactivar',
    confirmButtonColor: isBaja ? '#f97316' : '#16a34a'
  });

  if (isConfirmed) {
    setEstadoCliente(id, status);
    cargarSubvista(subvistaActiva);
  }
};

window.__decl_eliminarDefinitivo = async function(id, nombre) {
  const { isConfirmed } = await Swal.fire({
    title: '⚠️ ELIMINACIÓN DEFINITIVA',
    html: `¿Estás seguro de eliminar a <b>${nombre}</b>?<br><small>Esta acción no se puede deshacer y borrará todo su historial.</small>`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'ELIMINAR PARA SIEMPRE',
    confirmButtonColor: '#ef4444'
  });

  if (isConfirmed) {
    const m = getEstadoClientes();
    delete m[id];
    localStorage.setItem('sinergia_estado_clientes', JSON.stringify(m));
    window.toast && window.toast('Cliente eliminado definitivamente', 'info');
    cargarSubvista('reportes');
  }
};

window.__decl_cambiarTab = (t) => { subvistaActiva = t; cargarSubvista(t); };
window.__decl_cambiarPeriodo = (p) => { periodoActivo = p; cargarSubvista(subvistaActiva); };

function actualizarFilaDOM(id, checks, estado, porcentaje) {
  const row = document.getElementById(`decl-row-${id}`);
  if (!row) return;
  const meta = estadoMeta(estado);
  const barColor = colorProgreso(porcentaje);
  row.querySelector('.progress-fill').style.width = `${porcentaje}%`;
  row.querySelector('.progress-fill').style.background = barColor;
  row.querySelector('.badge-status').innerHTML = `${meta.icon} ${estado}`;
  row.querySelector('.badge-status').style.color = meta.color;
  row.querySelector('.badge-status').style.background = meta.bg;
}

function buildLoader(msg) { return `<div class="empty-state">⏳ ${msg}</div>`; }
export { cargarSubvista };
