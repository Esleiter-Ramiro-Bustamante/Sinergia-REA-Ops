/* ================================================================
   SINERGIA REA — Core: Utils
   Funciones reutilizables de fechas, formato y helpers de UI.
   Todas las funciones son puras (sin efectos secundarios),
   excepto toast() que interactúa con SweetAlert2.
   ================================================================ */

import { dbGet } from './db.js';

/** Nombres de meses en español (índice 0 = Enero) */
export const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

/**
 * Calcula días transcurridos DESDE una fecha hasta hoy.
 * Positivo = días pasados. Usado para detectar tareas abandonadas.
 * @param {string} dateStr - Fecha ISO
 * @returns {number}
 */
export function daysDiff(dateStr) {
  const d   = new Date(dateStr);
  const now = new Date();
  return Math.floor((now - d) / 86400000);
}

/**
 * Calcula días RESTANTES hasta una fecha futura.
 * Negativo = ya venció. Usado para detectar vencimientos.
 * @param {string} dateStr - Fecha límite ISO
 * @returns {number}
 */
export function daysUntil(dateStr) {
  const d   = new Date(dateStr);
  const now = new Date();
  return Math.floor((d - now) / 86400000);
}

/**
 * Formatea fecha ISO a texto legible en español.
 * Ej: "2024-03-15" → "15 mar. 2024"
 * @param {string} dateStr - Fecha ISO
 * @returns {string}
 */
export function fmtDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}

/**
 * Formatea fecha+hora ISO a texto legible.
 * Ej: "2024-03-15T14:30" → "15 mar. 2024, 2:30 p.m."
 * @param {string} dateStr - Fecha+hora ISO
 * @returns {string}
 */
export function fmtDateTime(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

/**
 * Retorna el nombre del mes a partir de su número (1–12).
 * @param {number} n - Número de mes
 * @returns {string}
 */
export function monthName(n) {
  return MONTHS[n - 1] || '';
}

/**
 * Busca el nombre de un cliente por su ID desde la caché.
 * @param {string} id - ID del cliente
 * @returns {string}
 */
export function clientName(id) {
  const c = dbGet('clients').find(x => x.id === id);
  return c ? c.name : 'Desconocido';
}

/**
 * Actualiza los selects de clientes en TODOS los filtros de la app.
 * Se llama tras crear o eliminar un cliente.
 */
export function populateAllClientFilters() {
  const clients = dbGet('clients');
  const opts = '<option value="">Todos los clientes</option>' +
    clients.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

  ['task-client-filter', 'absence-client-filter', 'appt-client-filter'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = opts;
  });
}

/**
 * Muestra una notificación tipo toast (pequeña, temporal, esquina superior).
 * @param {string} msg  - Mensaje a mostrar
 * @param {string} icon - 'success' | 'info' | 'warning' | 'error'
 */
export function toast(msg, icon = 'success') {
  Swal.fire({
    toast:             true,
    position:          'top-end',
    icon,
    title:             msg,
    showConfirmButton: false,
    timer:             2200,
    timerProgressBar:  true
  });
}
