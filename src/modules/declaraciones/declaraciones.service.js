/* ================================================================
   SINERGIA REA — declaraciones.service.js
   Responsabilidad: Acceso a datos de declaraciones en Firestore.
   ================================================================ */

import {
  getFirestore,
  collection, doc,
  getDocs, getDoc,
  setDoc, updateDoc,
  query, where,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

import { getEmailActual, getNombreActual } from '../../services/auth.service.js';
import { ahora } from '../../utils/date.utils.js';

function getDB() {
  if (window.__firebaseDb) return window.__firebaseDb;
  throw new Error('[declaraciones.service] Firestore no inicializado. Verifica firebase.js.');
}

export async function obtenerPeriodos() {
  const snap = await getDocs(collection(getDB(), 'periodos'));
  const periodos = snap.docs.map(d => d.id).sort();
  return periodos;
}

export async function crearPeriodoSiNoExiste(periodo) {
  const ref = doc(getDB(), 'periodos', periodo);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      periodo,
      creadoEn:  ahora(),
      creadoPor: getEmailActual()
    });
  }
}

export function buildDeclaracionId(clienteId, periodo, tipo) {
  return `${clienteId}_${periodo}_${tipo}`;
}

export async function obtenerDeclaracionesPorPeriodo(periodo) {
  const q    = query(
    collection(getDB(), 'declaraciones'),
    where('periodo', '==', periodo)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ ...d.data(), _docId: d.id }));
}

export async function guardarDeclaracion({ clienteId, periodo, tipo, checks, estado, porcentaje }) {
  const docId  = buildDeclaracionId(clienteId, periodo, tipo);
  const ref    = doc(getDB(), 'declaraciones', docId);

  await setDoc(ref, {
    clienteId,
    periodo,
    tipo,
    checks,
    estado,
    porcentaje,
    updatedAt: ahora(),
    updatedBy: getEmailActual()
  }, { merge: true });
}

export async function obtenerMapaDeclaraciones(periodo, tipo) {
  const todas = await obtenerDeclaracionesPorPeriodo(periodo);
  const mapa  = {};
  todas
    .filter(d => d.tipo === tipo)
    .forEach(d => { mapa[d.clienteId] = d; });
  return mapa;
}
