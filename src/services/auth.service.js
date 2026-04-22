/* ================================================================
   SINERGIA REA — auth.service.js
   Bridge para obtener información del usuario autenticado.
   ================================================================ */

/** Retorna el email del usuario actual desde el objeto global */
export function getEmailActual() {
  return window.currentUser?.email || 'desconocido@sinergiarea.com';
}

/** Retorna el nombre completo del usuario actual */
export function getNombreActual() {
  return window.currentUser?.nombre || 'Usuario Sinergia';
}
