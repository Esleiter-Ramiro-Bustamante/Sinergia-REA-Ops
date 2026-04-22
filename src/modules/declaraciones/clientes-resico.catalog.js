/* ================================================================
   SINERGIA REA â€” clientes-resico.catalog.js
   Responsabilidad: CatÃ¡logo estÃ¡tico de clientes RESICO (626)
   extraÃ­dos del Excel "RESUMEN_ENERO_A_DICIEMBRE_2026.xlsx".

   SRP: Solo datos. No toca Firebase, UI ni lÃ³gica.

   USO:
     import { CLIENTES_RESICO_EXCEL, CLIENTES_SUELDOS_EXCEL } from './clientes-resico.catalog.js';

   Estos clientes se usan como FALLBACK cuando Firestore no tiene
   clientes con regimenFiscal: '626' o '605'.
   Se fusionan con los clientes reales de Firestore (sin duplicados por RFC).
   ================================================================ */

/**
 * 25 clientes RESICO (rÃ©gimen 626) del Excel de Marzo 2026.
 * Campo `baja: true` indica que en el Excel aparecen como BAJA.
 * El ID usa el RFC como clave Ãºnica para evitar duplicados.
 */
export const CLIENTES_RESICO_EXCEL = [
  { id: 'excel_RECJ7903097T9', name: 'JESUS REYES COBAXIN',                  rfc: 'RECJ7903097T9', giro: 'TAXISTA 0%',                    regimenFiscal: '626', fuente: 'excel', baja: false },
  { id: 'excel_COSP490127K82', name: 'PAULA COBAXIN SOSME',                   rfc: 'COSP490127K82', giro: 'TAXISTA 0%',                    regimenFiscal: '626', fuente: 'excel', baja: true  },
  { id: 'excel_HELG971215C55', name: 'GABRIEL DARIO HERNANDEZ LINARES',       rfc: 'HELG971215C55', giro: 'AGAPES TABACOS 0%',             regimenFiscal: '626', fuente: 'excel', baja: false },
  { id: 'excel_RECA760209LS1', name: 'ALMA ROSA REYES COBAXIN',               rfc: 'RECA760209LS1', giro: 'TAXISTA 0%',                    regimenFiscal: '626', fuente: 'excel', baja: false },
  { id: 'excel_RECE861222FP9', name: 'ELEBIT REYES COBAXIN',                  rfc: 'RECE861222FP9', giro: 'TAXISTA 0%',                    regimenFiscal: '626', fuente: 'excel', baja: true  },
  { id: 'excel_OOCL501213N21', name: 'LUCINO OCHOA CERVANTES',                rfc: 'OOCL501213N21', giro: 'HERRERIA 16%',                  regimenFiscal: '626', fuente: 'excel', baja: false },
  { id: 'excel_PURL700919JY5', name: 'LETICIA PUCHETA ROSALES',               rfc: 'PURL700919JY5', giro: 'PURIFICADORA AGUA 0%',          regimenFiscal: '626', fuente: 'excel', baja: false },
  { id: 'excel_CAVA560802EI2', name: 'ANGEL CADENA VILLEGAS',                 rfc: 'CAVA560802EI2', giro: 'TAXISTA 0%',                    regimenFiscal: '626', fuente: 'excel', baja: false },
  { id: 'excel_CATG891213P34', name: 'MARIA GUADALUPE CHAPOL TON',            rfc: 'CATG891213P34', giro: 'RECICLAJE, CARTON, METAL 16%',  regimenFiscal: '626', fuente: 'excel', baja: false },
  { id: 'excel_MIOF8211248B0', name: 'FLOR MIXTEGA OCHOA',                    rfc: 'MIOF8211248B0', giro: 'VIVERO DE PLANTAS 0%',          regimenFiscal: '626', fuente: 'excel', baja: false },
  { id: 'excel_FETS7811207K5', name: 'SOFIA ALEJANDRA',                       rfc: 'FETS7811207K5', giro: 'ABARROTES 16 Y 0%',             regimenFiscal: '626', fuente: 'excel', baja: false },
  { id: 'excel_VEMI740317BZ8', name: 'IRMA PATRICIA VELAZQUEZ MENDIZABAL',    rfc: 'VEMI740317BZ8', giro: 'PAPELERIA 16%',                 regimenFiscal: '626', fuente: 'excel', baja: false },
  { id: 'excel_VEPA440705HE9', name: 'ANTONIO VELAZQUEZ PEREA',               rfc: 'VEPA440705HE9', giro: 'PAPELERIA 16%',                 regimenFiscal: '626', fuente: 'excel', baja: true  },
  { id: 'excel_TOOR600821TK5', name: 'ROLANDO TORRES OSTOS',                  rfc: 'TOOR600821TK5', giro: 'ABARROTES PANADERIA 16 Y 0%',  regimenFiscal: '626', fuente: 'excel', baja: false },
  { id: 'excel_QUOP411124L8A', name: 'PORFIRIO QUIALA ORTEGA',                rfc: 'QUOP411124L8A', giro: 'ABARROTES 16 Y 0%',             regimenFiscal: '626', fuente: 'excel', baja: false },
  { id: 'excel_UEMP610328T37', name: 'PETRA UTRERA MIL',                      rfc: 'UEMP610328T37', giro: 'TALLER MECANICO',               regimenFiscal: '626', fuente: 'excel', baja: false },
  { id: 'excel_OICA8808273AA', name: 'ADELA CHIGO OBIL',                      rfc: 'OICA8808273AA', giro: 'PIZZAS 16%',                    regimenFiscal: '626', fuente: 'excel', baja: false },
  { id: 'excel_OICP5801158G4', name: 'PAULINA OBIL CAGAL',                    rfc: 'OICP5801158G4', giro: 'RESTAURANT BAR 16%',            regimenFiscal: '626', fuente: 'excel', baja: false },

{ id: 'excel_TESS890928NK2', name: 'SHEILA STEPHANIE TEPACH SOSA',          rfc: 'TESS890928NK2', giro: 'FARMACIA 16 Y 0%',              regimenFiscal: '626', fuente: 'excel', baja: false },
  { id: 'excel_MOCS640313AC5', name: 'SARA MOTO CHIGO',                       rfc: 'MOCS640313AC5', giro: 'TORTAS DEL TRIUNFO 16%',        regimenFiscal: '626', fuente: 'excel', baja: false },
  { id: 'excel_MOMA8304157Z0', name: 'ANASTACIA MOLINA MUÃ‘OZ',                rfc: 'MOMA8304157Z0', giro: 'TALLER MECANICO 16%',           regimenFiscal: '626', fuente: 'excel', baja: false },
  { id: 'excel_VEVV790907IF5', name: 'VALENTINA VEGA VELA',                   rfc: 'VEVV790907IF5', giro: 'AGRICULTURA 0%',                regimenFiscal: '626', fuente: 'excel', baja: false },
  { id: 'excel_VEMY691119J49', name: 'YOLANDA LOURDES VELAZQUEZ MENDI',       rfc: 'VEMY691119J49', giro: 'COMERCIO DE TEMPORADA',         regimenFiscal: '626', fuente: 'excel', baja: true  },
  { id: 'excel_SACF920923UE5', name: 'FRANCISCO DE JESUS SAYAS COSME',        rfc: 'SACF920923UE5', giro: 'SOPORTE TECNICO 16%',           regimenFiscal: '626', fuente: 'excel', baja: false },
  { id: 'excel_JURG8504065R2', name: 'GLORIA JUAREZ ROMERO',                  rfc: 'JURG8504065R2', giro: 'MUNDO VERDE 0%',                regimenFiscal: '626', fuente: 'excel', baja: false },
];

/**
 * Clientes de Sueldos y Salarios (rÃ©gimen 605).
 * Agregar aquÃ­ cuando se tenga la lista del Excel.
 */
export const CLIENTES_SUELDOS_EXCEL = [
  // Ejemplo â€” reemplazar con los reales cuando estÃ©n disponibles:
  // { id: 'excel_s_RFC', name: 'NOMBRE COMPLETO', rfc: 'RFC', regimenFiscal: '605', fuente: 'excel', baja: false },
];

/**
 * Fusiona clientes de Firestore con clientes del Excel.
 * Evita duplicados comparando por RFC.
 * Los clientes de Firestore tienen prioridad (se usan sus datos si hay coincidencia de RFC).
 *
 * @param {Object[]} clientesFirestore - Clientes que ya vienen de Firestore con el rÃ©gimen correcto
 * @param {Object[]} clientesExcel     - CatÃ¡logo estÃ¡tico del Excel (CLIENTES_RESICO_EXCEL, etc.)
 * @returns {Object[]} Lista fusionada sin duplicados
 */
export function fusionarClientes(clientesFirestore, clientesExcel) {
  // RFCs que ya estÃ¡n en Firestore
  const rfcsFirestore = new Set(
    clientesFirestore.map(c => (c.rfc || '').toUpperCase().trim())
  );

  // Del Excel, solo agregar los que NO estÃ¡n ya en Firestore por RFC
  const soloExcel = clientesExcel.filter(c => {
    const rfc = (c.rfc || '').toUpperCase().trim();
    return rfc && !rfcsFirestore.has(rfc);
  });

  return [...clientesFirestore, ...soloExcel];
}

