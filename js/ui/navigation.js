/* ================================================================
   SINERGIA REA — UI: Navigation
   Control de vistas, navegación y eventos estáticos del layout.

   Pattern: Registry — MODULE_REGISTRY mapea vistas a sus funciones
   de renderizado y acción, permitiendo registrar módulos nuevos
   sin tocar ningún otro archivo.
   ================================================================ */

import { renderDashboard }                                        from '../modules/dashboard/index.js';
import { renderClients, addClient, deleteClient }                  from '../modules/clients/index.js';
import { renderTasks, addTask, deleteTask, toggleTaskView,
         populateTaskFilters }                                     from '../modules/tasks/index.js';
import { renderAbsences, addAbsence, deleteAbsence,
         populateAbsenceFilters }                                  from '../modules/absences/index.js';
import { renderAppointments, addAppointment, deleteAppt,
         populateApptFilters }                                     from '../modules/appointments/index.js';
import { renderReports, exportData }                               from '../modules/reports/index.js';
import { initDeclaracionesView }                                   from '../modules/declaraciones/index.js';
import { showAlertsPanel, testNotify }                                  from '../core/alerts.js';

import { dbGet, dbCreate, dbUpdate, dbDelete,
         deleteClientCascade }                                     from '../core/db.js';

/* ================================================================
   MODULE REGISTRY — Patrón Registry para extensibilidad
   ----------------------------------------------------------------
   Agregar un módulo nuevo = añadir UNA entrada aquí.
   Cada entrada define:
     render → función que dibuja la vista al navegar a ella
     add    → función del botón "+ Nuevo" (opcional)
   ================================================================ */
const MODULE_REGISTRY = {
  dashboard:    {
    render: renderDashboard,
    add:    addTask           // El dashboard crea tareas como acción primaria
  },
  clients:      { render: renderClients,      add: addClient },
  tasks:        {
    render: () => { populateTaskFilters(); renderTasks(); },
    add:    addTask
  },
  absences:     {
    render: () => { populateAbsenceFilters(); renderAbsences(); },
    add:    addAbsence
  },
  appointments: {
    render: () => { populateApptFilters(); renderAppointments(); },
    add:    addAppointment
  },
  reports:      { render: renderReports,      add: exportData },
  declaraciones: {
    render: initDeclaracionesView,
    add:    () => window.__decl_crearSiguientePeriodo?.()
  }
};

/** Mapa de títulos para el topbar */
const VIEW_TITLES = {
  dashboard:     'Dashboard',
  clients:       'Clientes',
  tasks:         'Tareas Contables',
  absences:      'Registro de Faltas',
  appointments:  'Agenda de Citas',
  reports:       'Reporte Mensual',
  declaraciones: 'Declaraciones Mensuales SAT'
};

/* ── Estado de navegación ─────────────────────────────────────── */
let currentView = 'dashboard';

/* ── Navegación ───────────────────────────────────────────────── */
/**
 * Navega a una vista del sistema.
 * Oculta todas las vistas, muestra la seleccionada y ejecuta su render.
 * @param {string} view - Clave del módulo en MODULE_REGISTRY
 */
export function navigate(view) {
  currentView = view;

  // Ocultar todas las vistas
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));

  // Mostrar la vista seleccionada
  const target = document.getElementById('view-' + view);
  if (target) target.classList.add('active');

  // Actualizar título del topbar
  const titleEl = document.getElementById('topbar-title');
  if (titleEl) titleEl.textContent = VIEW_TITLES[view] || view;

  // Actualizar nav item activo
  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.toggle('active', n.dataset.view === view);
  });

  // Ejecutar render del módulo
  MODULE_REGISTRY[view]?.render?.();

  // Cerrar sidebar en mobile
  closeSidebar();
}

/* ── Sidebar mobile ───────────────────────────────────────────── */
export function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('overlay').classList.toggle('open');
}

export function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('overlay').classList.remove('open');
}

/* ── Botón "+ Nuevo" ──────────────────────────────────────────── */
/** Ejecuta la acción de creación del módulo activo */
export function handleAddClick() {
  MODULE_REGISTRY[currentView]?.add?.();
}

/* ── Binding de eventos estáticos ────────────────────────────── */
/**
 * Vincula todos los eventos del layout estático (sidebar, topbar, filtros).
 * Se llama UNA SOLA VEZ al iniciar la app.
 * Los botones dentro de tablas generadas dinámicamente usan window.*
 */
export function bindStaticEvents() {
  // Layout global
  document.getElementById('overlay')?.addEventListener('click', closeSidebar);
  document.querySelector('.menu-toggle')?.addEventListener('click', toggleSidebar);
  document.querySelector('.alert-badge')?.addEventListener('click', showAlertsPanel);
  document.getElementById('btn-add')?.addEventListener('click', handleAddClick);

  // Dashboard — botón "Ver todas"
  const viewAllBtn = document.querySelector('#view-dashboard .btn-secondary');
  if (viewAllBtn) viewAllBtn.addEventListener('click', () => navigate('tasks'));

  // Asignar data-view a nav-items y bindear eventos
  // El orden debe coincidir EXACTAMENTE con el HTML de index.html
  const navViews = ['dashboard', 'clients', 'tasks', 'absences', 'appointments', 'declaraciones', 'reports'];
  document.querySelectorAll('.nav-item').forEach((el, i) => {
    if (navViews[i]) {
      el.dataset.view = navViews[i];
      el.addEventListener('click', () => navigate(navViews[i]));
    }
  });

  // Filtros — Clientes
  document.getElementById('client-search')?.addEventListener('input', renderClients);
  document.getElementById('client-status-filter')?.addEventListener('change', renderClients);

  // Filtros — Tareas
  document.getElementById('task-view-toggle')?.addEventListener('click', toggleTaskView);
  document.getElementById('task-search')?.addEventListener('input', renderTasks);
  document.getElementById('task-client-filter')?.addEventListener('change', renderTasks);
  document.getElementById('task-priority-filter')?.addEventListener('change', renderTasks);

  // Filtros — Faltas
  document.getElementById('absence-client-filter')?.addEventListener('change', renderAbsences);
  document.getElementById('absence-month-filter')?.addEventListener('change', renderAbsences);

  // Filtros — Citas
  document.getElementById('appt-client-filter')?.addEventListener('change', renderAppointments);
  document.getElementById('appt-status-filter')?.addEventListener('change', renderAppointments);

  // Reportes — botón exportar
  document.querySelector('#view-reports .btn-secondary')?.addEventListener('click', exportData);
}

/* ── Exposición global (para onclick/onchange en HTML estático y dinámico) ── */
// Funciones llamadas desde onclick/onchange inline en index.html
window.closeSidebar       = closeSidebar;
window.toggleSidebar      = toggleSidebar;
window.showAlertsPanel    = showAlertsPanel;
window.__testNotify       = testNotify;

window.handleAddClick     = handleAddClick;


window.renderClients      = renderClients;
window.renderTasks        = renderTasks;
window.renderAbsences     = renderAbsences;
window.renderAppointments = renderAppointments;

// Funciones llamadas desde tablas generadas dinámicamente (rows de módulos)
window.navigate        = navigate;
window.addClient       = addClient;
window.deleteClient    = deleteClient;
window.addTask         = addTask;
window.deleteTask      = deleteTask;
window.addAbsence      = addAbsence;
window.deleteAbsence   = deleteAbsence;
window.addAppointment  = addAppointment;
window.deleteAppt      = deleteAppt;
window.exportData      = exportData;
window.toggleTaskView  = toggleTaskView;

// Retrocompatibilidad: módulos src/ (declaraciones) acceden a estas
// funciones via window.* para no romper su arquitectura original.
window.dbGet               = dbGet;
window.dbCreate            = dbCreate;
window.dbUpdate            = dbUpdate;
window.dbDelete            = dbDelete;
window.deleteClientCascade = deleteClientCascade;
window.crearCliente        = (datos) => dbCreate('clients', datos);
