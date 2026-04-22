/* ================================================================
   SINERGIA REA — Bootstrap: main.js
   Punto de entrada único de la aplicación.
   Orquesta la inicialización de todos los módulos.

   Flujo de arranque:
     1. startAuth() → Firebase onAuthStateChanged
     2. loadAllFromFirestore() → caché en memoria
     3. init() → bindStaticEvents + alertas + dashboard
     4. startAlertScheduler() → ciclo de 10 min

   Patrones aplicados:
     - Registry Pattern (MODULE_REGISTRY en navigation.js)
     - Facade Pattern (auth.js envuelve Auth + FCM)
     - Repository Pattern (db.js abstrae Firestore)

   Para agregar un módulo nuevo:
     1. Crear js/modules/[nombre]/index.js
     2. Importar sus funciones aquí
     3. Registrar en MODULE_REGISTRY de navigation.js
     4. Agregar vista en index.html
   ================================================================ */

import { startAuth }          from './core/auth.js';
import { runAlertsEngine,
         checkMonthChange,
         startAlertScheduler } from './core/alerts.js';
import { startUserActivityTracker,
         playAlertSound,
         initHowler }          from './ui/sound.js';
import { bindStaticEvents,
         navigate }            from './ui/navigation.js';
import { renderDashboard }     from './modules/dashboard/index.js';
import { ACTIVE_ALERTS }       from './core/alerts.js';

/* ── Función de inicialización ────────────────────────────────── */
/**
 * Se ejecuta cuando Auth + Firestore están listos.
 * Orden estricto: alertas → dashboard → eventos → scheduler → bienvenida.
 */
function init() {
  console.log('[Sinergia REA] Iniciando sistema...');

  // 1. Detectar cambio de mes
  checkMonthChange(() => navigate('reports'));

  // 2. Ejecutar motor de alertas inicial
  runAlertsEngine();

  // 3. Renderizar dashboard con datos frescos
  renderDashboard();

  // 4. Vincular todos los eventos del layout
  bindStaticEvents();

  // 5. Iniciar tracking de actividad del usuario + Howler.js
  startUserActivityTracker();

  // 6. Iniciar scheduler de alertas (cada 10 min)
  startAlertScheduler(() => {
    renderDashboard(); // re-render tras cada ciclo del scheduler
  });

  // 7. Pantalla de bienvenida si no hay datos
  const cache = window.__DB_CACHE || {};
  const hasClients = cache.clients && cache.clients.length > 0;
  const hasTasks   = cache.tasks && cache.tasks.length > 0;

  if (!hasClients && !hasTasks) {
    setTimeout(() => {
      Swal.fire({
        title: '¡Bienvenido a Sinergia REA!',
        html: `
          <div style="text-align:left;font-size:14px;color:#4a5080;line-height:1.8">
            <p>Tu sistema de control contable está listo para usar.</p>
            <p style="margin-top:12px;font-weight:700;color:#1a237e">Primeros pasos:</p>
            <p>1️⃣ Ve a <strong>Clientes</strong> y registra tus clientes</p>
            <p>2️⃣ Crea <strong>Tareas</strong> contables para cada cliente</p>
            <p>3️⃣ Registra <strong>Faltas</strong> e incumplimientos</p>
            <p>4️⃣ Agenda <strong>Citas</strong> y da seguimiento</p>
          </div>`,
        confirmButtonText: '¡Empecemos!',
        icon: 'info'
      });
    }, 700);
  }

  // 8. Manejador de actualizaciones en tiempo real (Handshake activado)
  window.__onRealtimeUpdate = (entity) => {
    const activeView = document.querySelector('.view.active')?.id;
    console.log(`[Realtime] 🔄 Cambio detectado en ${entity}. Refrescando ${activeView}...`);

    // Refrescar solo lo necesario según la vista activa
    if (activeView === 'view-dashboard') renderDashboard();
    if (activeView === 'view-clients' && entity === 'clients') {
      import('../modules/clients/index.js').then(m => m.renderClients());
    }
    if (activeView === 'view-tasks' && entity === 'tasks') {
       import('../modules/tasks/index.js').then(m => m.renderTasks());
    }
    if (activeView === 'view-appointments' && entity === 'appointments') {
       import('../modules/appointments/index.js').then(m => m.renderAppointments());
    }
    if (activeView === 'view-declaraciones') {
       import('../src/modules/declaraciones/declaraciones.ui.js').then(m => m.cargarSubvista('resico')); 
    }
  };

  // 9. Ocultar cargador inicial
  const loader = document.getElementById('initial-loader-overlay');
  if (loader) {
    loader.style.opacity = '0';
    setTimeout(() => loader.style.visibility = 'hidden', 500);
  }

  console.log('[Sinergia REA] Sistema listo y sincronizado.');
}

/* ── Arranque de la aplicación ────────────────────────────────── */
// startAuth() es el único punto de entrada.
// Cuando Firebase Auth + datos estén listos, llama a init().
startAuth(init);

/**
 * Función global para forzar la solicitud de permisos de notificación.
 * Expuesta en window para el botón del sidebar.
 */
window.__setupNotifications = async function() {
  if (!("Notification" in window)) {
    Swal.fire('No compatible', 'Tu navegador no soporta notificaciones de escritorio.', 'error');
    return;
  }

  // Si ya están concedidas
  if (Notification.permission === "granted") {
    Swal.fire({
      icon: 'info',
      title: '¡Ya están activas!',
      text: 'Tu navegador ya tiene permiso para enviar notificaciones.',
      confirmButtonColor: '#f5a623'
    });
    return;
  }

  // Si están denegadas (bloqueadas manualmente)
  if (Notification.permission === "denied") {
    Swal.fire({
      icon: 'warning',
      title: 'Permiso Bloqueado',
      html: `
        <div style="text-align:left; font-size:14px;">
          <p>Has bloqueado las notificaciones anteriormente.</p>
          <p style="margin-top:10px;"><b>Para activarlas:</b></p>
          <ol>
            <li>Haz clic en el icono del <b>candado 🔒</b> junto a la dirección (URL).</li>
            <li>Busca <b>"Notificaciones"</b>.</li>
            <li>Cambia el interruptor a <b>"Permitir"</b>.</li>
            <li>Recarga la página.</li>
          </ol>
        </div>`,
      confirmButtonText: 'Entendido',
      confirmButtonColor: '#f5a623'
    });
    return;
  }

  // Si están en 'default', pedir permiso
  const permission = await Notification.requestPermission();
  
  if (permission === "granted") {
    new Notification("Sinergia REA", { body: "¡Notificaciones activadas correctamente!" });
    Swal.fire({
      icon: 'success',
      title: '¡Activado!',
      text: 'Ahora recibirás alertas de tareas y citas.',
      confirmButtonColor: '#f5a623'
    });
  }
};
