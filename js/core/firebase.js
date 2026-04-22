/* ================================================================
   SINERGIA REA — Core: Firebase (Singleton)
   Único punto de inicialización de Firebase en todo el sistema.
   Exporta instancias compartidas. Ningún otro módulo inicializa Firebase.

   Pattern: Singleton — una instancia por servicio, compartida globalmente.
   ================================================================ */

import { initializeApp }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getFirestore }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { getAuth }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getMessaging }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging.js';

const firebaseConfig = {
  apiKey:            'AIzaSyDW7e5W8AfPOyr9Yxs-oQjiK3Pr96EhuQ0',
  authDomain:        'sinergiareaops.firebaseapp.com',
  projectId:         'sinergiareaops',
  storageBucket:     'sinergiareaops.firebasestorage.app',
  messagingSenderId: '183145068777',
  appId:             '1:183145068777:web:2d00873eb660edfac29878'
};

const _app = initializeApp(firebaseConfig);

/** Instancia de Firestore — importar en db.js y módulos que la necesiten */
export const db        = getFirestore(_app);

/** Instancia de Firebase Auth */
export const auth      = getAuth(_app);

/** Instancia de Firebase Messaging (FCM) */
export const messaging = getMessaging(_app);

// ── Exponer db para módulos externos (declaraciones.service.js, etc.) ──
window.__firebaseDb = db;

/* ================================================================
   Catálogos SAT — fuente única de verdad para regímenes y giros.
   Se exportan aquí para que cualquier módulo los consuma sin
   duplicar datos.
   ================================================================ */

/** Regímenes fiscales del SAT */
export const REGIMENES_SAT = [
  { clave: '601', nombre: 'General de Ley Personas Morales' },
  { clave: '603', nombre: 'Personas Morales con Fines no Lucrativos' },
  { clave: '605', nombre: 'Sueldos y Salarios e Ingresos Asimilados a Salarios' },
  { clave: '606', nombre: 'Arrendamiento' },
  { clave: '607', nombre: 'Régimen de Enajenación o Adquisición de Bienes' },
  { clave: '608', nombre: 'Demás ingresos' },
  { clave: '610', nombre: 'Residentes en el Extranjero sin EP en México' },
  { clave: '611', nombre: 'Ingresos por Dividendos (socios y accionistas)' },
  { clave: '612', nombre: 'Personas Físicas con Actividades Empresariales y Profesionales' },
  { clave: '614', nombre: 'Ingresos por intereses' },
  { clave: '615', nombre: 'Régimen de los ingresos por obtención de premios' },
  { clave: '616', nombre: 'Sin obligaciones fiscales' },
  { clave: '620', nombre: 'Sociedades Cooperativas de Producción' },
  { clave: '621', nombre: 'Incorporación Fiscal' },
  { clave: '622', nombre: 'Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras' },
  { clave: '623', nombre: 'Opcional para Grupos de Sociedades' },
  { clave: '624', nombre: 'Coordinados' },
  { clave: '625', nombre: 'Actividades Empresariales vía Plataformas Tecnológicas' },
  { clave: '626', nombre: 'Régimen Simplificado de Confianza (RESICO)' }
];

/** Giros empresariales con clasificación de IVA */
export const GIROS_EMPRESARIALES = [
  { id: 'taxista',       nombre: 'TAXISTA',                  iva: '0%' },
  { id: 'herreria',      nombre: 'HERRERÍA',                 iva: '16%' },
  { id: 'asalariado',    nombre: 'SUELDOS Y SALARIOS',       iva: '0%' },
  { id: 'pensionado',    nombre: 'JUBILADOS',                iva: '0%' },
  { id: 'purificadora',  nombre: 'PURIFICADORA DE AGUA',     iva: '0%' },
  { id: 'reciclaje',     nombre: 'RECICLAJE (CARTÓN/METAL)', iva: '16%' },
  { id: 'vivero',        nombre: 'VIVERO DE PLANTAS',        iva: '0%' },
  { id: 'abarrotes',     nombre: 'ABARROTES',                iva: '16% y 0%' },
  { id: 'papeleria',     nombre: 'PAPELERÍA',                iva: '16%' },
  { id: 'abarrotes_pan', nombre: 'ABARROTES Y PANADERÍA',    iva: '16% y 0%' },
  { id: 'taller_mec',    nombre: 'TALLER MECÁNICO',          iva: '16%' },
  { id: 'pizzas',        nombre: 'PIZZAS',                   iva: '16%' },
  { id: 'restaurant',    nombre: 'RESTAURANT BAR',           iva: '16%' },
  { id: 'farmacia',      nombre: 'FARMACIA',                 iva: '16% y 0%' },
  { id: 'tortas',        nombre: 'TORTAS / COMIDA',          iva: '16%' },
  { id: 'agricultura',   nombre: 'AGRICULTURA',              iva: '0%' },
  { id: 'comercio_temp', nombre: 'COMERCIO DE TEMPORADA',    iva: '16%' },
  { id: 'soporte_tec',   nombre: 'SOPORTE TÉCNICO',          iva: '16%' },
  { id: 'mundo_verde',   nombre: 'MUNDO VERDE / NATURISTA',  iva: '0%' },
  { id: 'construccion',  nombre: 'CONSTRUCCIÓN',             iva: '16%' },
  { id: 'transporte',    nombre: 'TRANSPORTE DE CARGA',      iva: '0%' },
  { id: 'salon',         nombre: 'SALÓN DE BELLEZA',         iva: '16%' },
  { id: 'ropa',          nombre: 'ROPA Y CALZADO',           iva: '16%' },
  { id: 'medico',        nombre: 'SERVICIOS MÉDICOS',        iva: '0%' },
  { id: 'otro',          nombre: 'OTRO',                     iva: '16%' }
];

// Exponer catálogos globalmente para compatibilidad con código existente
window.REGIMENES_SAT      = REGIMENES_SAT;
window.GIROS_EMPRESARIALES = GIROS_EMPRESARIALES;
