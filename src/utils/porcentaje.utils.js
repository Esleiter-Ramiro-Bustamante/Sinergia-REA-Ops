/* ================================================================
   SINERGIA REA — porcentaje.utils.js
   Lógica de progreso y estados para declaraciones.
   ================================================================ */

export const CHECKS_RESICO = [
  { key: 'resumen',  label: 'Resumen' },
  { key: 'facturas', label: 'Facturas' },
  { key: 'diotOvh',  label: 'DIOT/OVH' }
];

export const CHECKS_SUELDOS = [
  { key: 'resumen',  label: 'Nómina' },
  { key: 'facturas', label: 'Timbrado' }
];

export function calcularEstado(checks = {}, checksDef = [], clientStatus = 'active') {
  if (clientStatus === 'inactive') {
    return { estado: 'INACTIVO', porcentaje: 0 };
  }

  const total = checksDef.length;
  if (total === 0) return { estado: 'PENDIENTE', porcentaje: 0 };

  const marcados = checksDef.filter(c => checks[c.key]).length;
  const porcentaje = Math.round((marcados / total) * 100);

  let estado = 'PENDIENTE';
  if (porcentaje === 100) estado = 'COMPLETO';
  else if (porcentaje > 0) estado = 'EN PROCESO';

  return { estado, porcentaje };
}

export function estadoMeta(estado) {
  const metas = {
    'COMPLETO':   { icon: '✅', color: '#16a34a', bg: 'rgba(22,163,74,0.1)' },
    'EN PROCESO': { icon: '⏳', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
    'PENDIENTE':  { icon: '⭕', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
    'INACTIVO':   { icon: '🔴', color: '#6b7280', bg: 'rgba(107,114,128,0.1)' }
  };
  return metas[estado] || metas['PENDIENTE'];
}

export function colorProgreso(pct) {
  if (pct >= 100) return '#16a34a'; // verde
  if (pct >= 50)  return '#f59e0b'; // ambar
  return '#ef4444';                // rojo
}
