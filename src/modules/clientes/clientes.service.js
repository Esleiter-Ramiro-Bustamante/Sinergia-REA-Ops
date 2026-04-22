/* ================================================================
   SINERGIA REA — clientes.service.js
   Bridge para acceder a los clientes desde módulos legacy.
   ================================================================ */

export function obtenerClientes() {
  // window.dbGet es expuesto en navigation.js y lee de __DB_CACHE
  return window.dbGet('clients') || [];
}

export function obtenerClientesPorRegimen(clave) {
  const todos = obtenerClientes();
  return todos.filter(c => {
    if (Array.isArray(c.regimenFiscal)) {
      return c.regimenFiscal.includes(clave);
    }
    return c.regimenFiscal === clave;
  });
}

export function getNombreCliente(id) {
  const c = obtenerClientes().find(x => x.id === id);
  return c?.name || c?.nombre || 'Desconocido';
}

export function getNombreRegimen(clave) {
  const r = (window.REGIMENES_SAT || []).find(x => x.clave === clave);
  return r ? `${r.clave} — ${r.nombre}` : clave;
}

export function getNombreGiro(giroId) {
  const g = (window.GIROS_EMPRESARIALES || []).find(x => x.id === giroId);
  return g ? `${g.nombre} (IVA: ${g.iva})` : giroId;
}

export async function crearCliente(datos) {
  return window.dbCreate('clients', datos);
}
