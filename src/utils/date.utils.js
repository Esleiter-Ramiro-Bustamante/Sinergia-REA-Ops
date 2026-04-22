/* ================================================================
   SINERGIA REA — date.utils.js
   Funciones de utilidad para manejo de fechas y periodos SAT.
   ================================================================ */

/** Retorna fecha actual en formato ISO string */
export function ahora() {
  return new Date().toISOString();
}

/** 
 * Retorna el periodo actual en formato "YYYY-MM" 
 * Ejemplo: Marzo 2026 -> "2026-03"
 */
export function obtenerPeriodoActual() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/**
 * Convierte "2026-03" a "Marzo 2026"
 */
export function periodoLabel(periodo) {
  if (!periodo) return '';
  const [y, m] = periodo.split('-');
  const meses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  return `${meses[parseInt(m) - 1]} ${y}`;
}

/**
 * Retorna el siguiente periodo cronológico
 * "2026-03" -> "2026-04"
 */
export function siguientePeriodo(periodo) {
  let [y, m] = periodo.split('-').map(Number);
  m++;
  if (m > 12) { m = 1; y++; }
  return `${y}-${String(m).padStart(2, '0')}`;
}
