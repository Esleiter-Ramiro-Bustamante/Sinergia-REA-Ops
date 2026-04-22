/* ================================================================
   SINERGIA REA — Core: Database Repository
   Abstrae TODAS las operaciones de Firestore.
   Los módulos de negocio nunca llaman a Firestore directamente.

   Pattern: Repository — capa de acceso a datos con caché en memoria.
   Garantía: La caché siempre refleja el estado real de Firestore.
   ================================================================ */

import {
  collection, addDoc, getDocs,
  updateDoc, deleteDoc, doc, writeBatch,
  onSnapshot
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { db } from './firebase.js';

/* ── Caché en memoria ──────────────────────────────────────────── */
/** Estado central de la aplicación — todas las lecturas vienen aquí */
export const __DB_CACHE = {
  clients:        [],
  tasks:          [],
  absences:       [],
  appointments:   [],
  declaraciones:  [],
  meta: {
    lastMonthCheck: new Date().getMonth(),
    lastLogin:      new Date().toISOString()
  }
};

/* ── Lectura síncrona desde caché ─────────────────────────────── */
/**
 * Obtiene todos los registros de una colección desde la caché.
 * @param {string} entity - Nombre de la colección (clients, tasks, etc.)
 * @returns {Array} Array de registros
 */
export const dbGet = (entity) => __DB_CACHE[entity] || [];

/** Retorna el objeto completo de caché (para compatibilidad) */
export const getDB = () => __DB_CACHE;

/* ── Persistencia de metadatos ────────────────────────────────── */
/**
 * Persiste el objeto meta en localStorage (lastMonthCheck, etc.)
 * Los datos de negocio SIEMPRE van a Firestore, nunca a localStorage.
 * @param {Object} obj - Objeto con propiedad meta
 */
export function saveDB(obj) {
  if (obj?.meta) {
    __DB_CACHE.meta = obj.meta;
    localStorage.setItem('sinergia_rea_meta', JSON.stringify(obj.meta));
  }
}

/* ── Carga inicial desde Firestore ────────────────────────────── */
/**
 * Carga todos los datos de Firestore en la caché en memoria.
 * Se llama UNA VEZ al iniciar sesión. Luego se trabaja con la caché.
 */
export async function loadAllFromFirestore(onDataUpdate) {
  const cols = ['clients', 'tasks', 'absences', 'appointments', 'declaraciones'];
  
  // Creamos una promesa que se resuelve cuando TODAS las colecciones reciban su primer snapshot
  const initialLoadPromises = cols.map(col => {
    return new Promise((resolve) => {
      let isFirst = true;
      onSnapshot(collection(db, col), (snap) => {
        __DB_CACHE[col] = snap.docs.map(d => {
          const data = d.data();
          Object.keys(data).forEach(k => {
            if (data[k]?.toDate) data[k] = data[k].toDate().toISOString();
          });
          return { ...data, id: d.id };
        });

        if (isFirst) {
          isFirst = false;
          resolve(); // Primera carga de esta colección completada
        }

        // Notificar actualizaciones posteriores (Tiempo Real)
        if (onDataUpdate) onDataUpdate(col);
      }, (err) => {
        console.warn(`[Firebase] Error en tiempo real (${col}):`, err.message);
        resolve(); // Resolver aunque falle para no bloquear la app
      });
    });
  });

  await Promise.all(initialLoadPromises);
  console.log('[Firebase] ✅ Sincronización inicial completa.');

  const savedMeta = localStorage.getItem('sinergia_rea_meta');
  if (savedMeta) __DB_CACHE.meta = JSON.parse(savedMeta);
}

/* ── CRUD: Crear ──────────────────────────────────────────────── */
/**
 * Crea un nuevo documento en Firestore y lo agrega a la caché.
 * @param {string} entity - Nombre de la colección
 * @param {Object} obj    - Datos del nuevo documento
 * @returns {Promise<Object>} Documento creado con su ID de Firestore
 */
export async function dbCreate(entity, obj) {
  obj.createdAt = new Date().toISOString();
  obj.updatedBy = window.currentUser?.nombre || 'Sistema';
  obj.updatedAt = obj.createdAt;

  const clean = Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  );

  try {
    const ref = await addDoc(collection(db, entity), clean);
    // Ya no actualizamos la caché manualmente, onSnapshot lo hará solo
    return { ...clean, id: ref.id };
  } catch (e) {
    Swal.fire('Error', 'No se pudo guardar en el servidor.', 'error');
    throw e;
  }
}

/* ── CRUD: Actualizar ─────────────────────────────────────────── */
/**
 * Actualiza un documento en Firestore y sincroniza la caché.
 * @param {string} entity  - Nombre de la colección
 * @param {string} id      - ID del documento
 * @param {Object} changes - Campos a actualizar
 */
export async function dbUpdate(entity, id, changes) {
  changes.updatedBy = window.currentUser?.nombre || 'Sistema';
  changes.updatedAt = new Date().toISOString();

  const clean = Object.fromEntries(
    Object.entries(changes)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, v !== null ? v : ''])
  );

  try {
    await updateDoc(doc(db, entity, id), clean);
    // onSnapshot detectará el cambio y actualizará la caché automáticamente
  } catch (e) {
    Swal.fire('Error', 'No se pudo actualizar en el servidor.', 'error');
    throw e;
  }
}

/* ── CRUD: Eliminar ───────────────────────────────────────────── */
/**
 * Elimina un documento de Firestore y lo remueve de la caché.
 * @param {string} entity - Nombre de la colección
 * @param {string} id     - ID del documento
 */
export async function dbDelete(entity, id) {
  try {
    await deleteDoc(doc(db, entity, id));
    __DB_CACHE[entity] = __DB_CACHE[entity].filter(x => x.id !== id);
  } catch (e) {
    Swal.fire('Error', 'No se pudo eliminar.', 'error');
    throw e;
  }
}

/* ── Eliminación en cascada de cliente ───────────────────────── */
/**
 * Elimina un cliente y TODOS sus registros relacionados en un solo batch.
 * Usa Firestore writeBatch para garantizar atomicidad (todo o nada).
 * @param {string} clientId - ID del cliente a eliminar
 */
export async function deleteClientCascade(clientId) {
  const batch = writeBatch(db);

  // Marcar para eliminación: tareas, faltas y citas del cliente
  ['tasks', 'absences', 'appointments'].forEach(col => {
    __DB_CACHE[col]
      .filter(x => x.clientId === clientId)
      .forEach(x => batch.delete(doc(db, col, x.id)));
  });

  // Marcar para eliminación: el propio cliente
  batch.delete(doc(db, 'clients', clientId));

  // Ejecutar todo en una sola operación atómica
  await batch.commit();

  // Limpiar caché
  ['tasks', 'absences', 'appointments'].forEach(col => {
    __DB_CACHE[col] = __DB_CACHE[col].filter(x => x.clientId !== clientId);
  });
  __DB_CACHE.clients = __DB_CACHE.clients.filter(x => x.id !== clientId);
}
