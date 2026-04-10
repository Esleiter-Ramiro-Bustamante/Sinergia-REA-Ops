/* ================================================================
   SINERGIA REA — Sistema de Control Contable
   Archivo: app.js
   Descripción: Lógica principal del sistema (Data + Logic + UI)
   Arquitectura:
     1. CORE — Storage (localStorage CRUD)
     2. UTILS — Fechas y helpers
     3. ALERTS ENGINE — Motor de alertas inteligentes
     4. NAVIGATION — Control de vistas
     5. MÓDULO: CLIENTES
     6. MÓDULO: TAREAS (Kanban + Lista)
     7. MÓDULO: FALTAS
     8. MÓDULO: CITAS
     9. DASHBOARD — Vista principal
    10. REPORTES — Reporte mensual
    11. EXPORT — Backup JSON
    12. INIT — Arranque de la app
   ================================================================ */

/* ================================================================
   1. CORE — STORAGE
   Maneja toda la persistencia en localStorage.
   Clave única: 'sinergia_rea_db'
   Estructura: { clients, tasks, absences, appointments, meta }
   ================================================================ */

/** Clave única de la base de datos en localStorage */
const DB_KEY = 'sinergia_rea_db';

/**
 * Genera un ID único combinando timestamp + random string.
 * Se usa para identificar cada registro (cliente, tarea, etc.)
 * @returns {string} ID único como "m8gj2k3x9a"
 */
function uuid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

/**
 * Inicializa la base de datos si no existe.
 * Solo crea la estructura la primera vez que se abre la app.
 * Si ya existe data, no la sobreescribe.
 */
function initDB() {
  const existing = localStorage.getItem(DB_KEY);
  if (!existing) {
    const base = {
      clients:      [],   // Array de objetos Cliente
      tasks:        [],   // Array de objetos Tarea
      absences:     [],   // Array de objetos Falta
      appointments: [],   // Array de objetos Cita
      meta: {
        lastMonthCheck: new Date().getMonth(),  // Para detectar cambio de mes
        lastLogin:      new Date().toISOString()
      }
    };
    localStorage.setItem(DB_KEY, JSON.stringify(base));
    console.log('[Sinergia REA] Base de datos inicializada.');
  }
}

/**
 * Lee y retorna toda la base de datos del localStorage.
 * @returns {Object} Objeto con clients, tasks, absences, appointments, meta
 */
function getDB() {
  return JSON.parse(localStorage.getItem(DB_KEY));
}

/**
 * Guarda la base de datos completa en localStorage.
 * @param {Object} db - Objeto completo de la base de datos
 */
function saveDB(db) {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

/* ── Operaciones CRUD genéricas ── */

/**
 * Obtiene todos los registros de una entidad.
 * @param {string} entity - 'clients' | 'tasks' | 'absences' | 'appointments'
 * @returns {Array} Array de registros
 */
function dbGet(entity) {
  return getDB()[entity] || [];
}

/**
 * Crea un nuevo registro en una entidad.
 * Agrega automáticamente: id y createdAt.
 * @param {string} entity - Entidad destino
 * @param {Object} obj - Datos del nuevo registro (sin id ni createdAt)
 * @returns {Object} Registro creado con id y createdAt
 */
function dbCreate(entity, obj) {
  const db = getDB();
  obj.id        = uuid();
  obj.createdAt = new Date().toISOString();
  db[entity].push(obj);
  saveDB(db);
  return obj;
}

/**
 * Actualiza campos específicos de un registro existente.
 * @param {string} entity - Entidad objetivo
 * @param {string} id     - ID del registro a actualizar
 * @param {Object} changes - Campos a sobreescribir
 */
function dbUpdate(entity, id, changes) {
  const db  = getDB();
  const idx = db[entity].findIndex(x => x.id === id);
  if (idx !== -1) {
    db[entity][idx] = { ...db[entity][idx], ...changes };
    saveDB(db);
  }
}

/**
 * Elimina un registro por su ID.
 * @param {string} entity - Entidad objetivo
 * @param {string} id     - ID del registro a eliminar
 */
function dbDelete(entity, id) {
  const db    = getDB();
  db[entity]  = db[entity].filter(x => x.id !== id);
  saveDB(db);
}

/* ================================================================
   2. UTILS — FECHAS Y HELPERS
   Funciones reutilizables para fechas y formato.
   Centralizar aquí evita errores de cálculo dispersos.
   ================================================================ */

/** Nombres de meses en español */
const MONTHS = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
];

/**
 * Calcula cuántos días han pasado DESDE una fecha hasta hoy.
 * Positivo = días transcurridos. Se usa para detectar abandono.
 * @param {string} dateStr - Fecha en formato ISO
 * @returns {number} Días transcurridos
 */
function daysDiff(dateStr) {
  const d   = new Date(dateStr);
  const now = new Date();
  return Math.floor((now - d) / 86400000);  // 86400000 = ms en un día
}

/**
 * Calcula cuántos días FALTAN hasta una fecha futura.
 * Negativo = fecha ya pasó. Se usa para detectar vencimientos.
 * @param {string} dateStr - Fecha límite en formato ISO
 * @returns {number} Días restantes (negativo si ya venció)
 */
function daysUntil(dateStr) {
  const d   = new Date(dateStr);
  const now = new Date();
  return Math.floor((d - now) / 86400000);
}

/**
 * Formatea una fecha ISO a texto legible en español.
 * Ejemplo: "2024-03-15" → "15 mar. 2024"
 * @param {string} dateStr - Fecha ISO
 * @returns {string} Fecha formateada o '—' si está vacía
 */
function fmtDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}

/**
 * Formatea una fecha+hora ISO a texto legible.
 * Ejemplo: "2024-03-15T14:30" → "15 mar. 2024, 2:30 p.m."
 * @param {string} dateStr - Fecha+hora ISO
 * @returns {string} Fecha y hora formateada o '—'
 */
function fmtDateTime(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

/**
 * Retorna el nombre del mes a partir de su número (1-12).
 * @param {number} n - Número de mes (1=Enero, 12=Diciembre)
 * @returns {string} Nombre del mes
 */
function monthName(n) {
  return MONTHS[n - 1] || '';
}

/**
 * Busca el nombre de un cliente por su ID.
 * Helper usado en múltiples renderizadores.
 * @param {string} id - ID del cliente
 * @returns {string} Nombre del cliente o 'Desconocido'
 */
function clientName(id) {
  const clients = dbGet('clients');
  const c = clients.find(x => x.id === id);
  return c ? c.name : 'Desconocido';
}

/* ================================================================
   3. ALERTS ENGINE — Motor de alertas inteligentes
   Se ejecuta al cargar la app y tras cada acción del usuario.
   Evalúa condiciones y actualiza la lista ACTIVE_ALERTS.
   ================================================================ */

/** Array global con las alertas activas actuales */
let ACTIVE_ALERTS = [];

/** Días sin actualizar para considerar una tarea abandonada */
const STALE_DAYS = 7;

/** Días antes del vencimiento para alertar */
const WARN_DAYS = 3;

/**
 * Motor principal de alertas.
 * Evalúa TODAS las condiciones críticas del sistema:
 *   - Tareas vencidas (hoy > dueDate y no completada)
 *   - Tareas próximas a vencer (dueDate - hoy <= WARN_DAYS)
 *   - Tareas sin seguimiento (lastUpdate > STALE_DAYS días)
 *   - Citas no realizadas (dateTime < ahora y aún "scheduled")
 *
 * LLAMAR después de: init, crear, editar, eliminar cualquier registro.
 */
function runAlertsEngine() {
  ACTIVE_ALERTS = [];  // Limpiar alertas anteriores

  const tasks        = dbGet('tasks');
  const appointments = dbGet('appointments');

  /* ── Evaluar tareas ── */
  tasks.forEach(t => {
    // Ignorar tareas ya completadas
    if (t.status === 'completed') return;

    const cname = clientName(t.clientId);

    // 1. Tarea vencida
    if (t.dueDate && daysUntil(t.dueDate) < 0) {
      ACTIVE_ALERTS.push({
        type: 'red',
        text: `Tarea vencida: "${t.title}"`,
        sub:  `${cname} · Venció hace ${Math.abs(daysUntil(t.dueDate))} día(s)`
      });
    }
    // 2. Próxima a vencer (solo si no está ya vencida)
    else if (t.dueDate && daysUntil(t.dueDate) <= WARN_DAYS) {
      ACTIVE_ALERTS.push({
        type: 'orange',
        text: `Próxima a vencer: "${t.title}"`,
        sub:  `${cname} · Vence en ${daysUntil(t.dueDate)} día(s)`
      });
    }

    // 3. Sin seguimiento (no se ha actualizado en X días)
    if (t.lastUpdate && daysDiff(t.lastUpdate) >= STALE_DAYS) {
      ACTIVE_ALERTS.push({
        type: 'gold',
        text: `Sin seguimiento: "${t.title}"`,
        sub:  `${cname} · ${daysDiff(t.lastUpdate)} días sin actualizar`
      });
    }
  });

  /* ── Evaluar citas no realizadas ── */
  appointments.forEach(a => {
    // Si estaba "programada" y ya pasó la hora → marcar como "no realizada"
    if (a.status === 'scheduled' && new Date(a.dateTime) < new Date()) {
      dbUpdate('appointments', a.id, { status: 'missed' });
      ACTIVE_ALERTS.push({
        type: 'red',
        text: `Cita no realizada: "${a.title}"`,
        sub:  `${clientName(a.clientId)} · ${fmtDateTime(a.dateTime)}`
      });
    }
  });

  /* ── Actualizar badge visual ── */
  const count = ACTIVE_ALERTS.length;
  document.getElementById('alert-count').textContent = count;
  const dot = document.getElementById('alert-dot');
  if (dot) dot.style.display = count > 0 ? 'block' : 'none';
}

/* ================================================================
   SISTEMA DE SONIDO — Howler.js (3 niveles)
   🔴 Crítico    → SD_ALERT_33.mp3 volumen 0.9 completo
   🟠 Advertencia → SD_ALERT_33.mp3 volumen 0.45, solo 2s
   🟢 Completado  → tono suave Web Audio API
   Condición: 1x/hora + usuario inactivo 55+ min
   ================================================================ */

const SOUND_KEY        = 'sinergia_rea_last_sound';
let   soundPlaying     = false;
let   lastUserActivity = Date.now();
let   howlCritical     = null;
let   howlWarning      = null;
let   howlReady        = false;

function recordUserActivity() { lastUserActivity = Date.now(); }

/** Se llama en el primer clic del usuario para desbloquear audio */
function initHowler() {
  if (howlReady) return;
  howlReady = true;
  howlCritical = new Howl({ src: ['SD_ALERT_33.mp3'], volume: 0.9 });
  howlWarning  = new Howl({ src: ['SD_ALERT_33.mp3'], volume: 0.45,
                             sprite: { warn: [0, 2000] } });
  console.log('[Sinergia REA] Howler.js listo.');
}

/** Tono agradable de "completado" via Web Audio API */
function playCompletionTone() {
  try {
    const ctx  = new (window.AudioContext || window.webkitAudioContext)();
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.22, ctx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.0);
    [523.25, 659.25].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.connect(gain);
      osc.start(ctx.currentTime + i * 0.12);
      osc.stop(ctx.currentTime + 1.3);
    });
  } catch(e) {}
}

/** Reproduce sonido diferenciado según nivel de alerta activo */
function playAlertSound() {
  if (soundPlaying || !howlReady) return;
  const hasRed    = ACTIVE_ALERTS.some(a => a.type === 'red');
  const hasOrange = ACTIVE_ALERTS.some(a => a.type === 'orange');
  if (!hasRed && !hasOrange) return;
  const inactiveMs = Date.now() - lastUserActivity;
  if (inactiveMs < 55 * 60 * 1000) return;
  const lastSound  = parseInt(localStorage.getItem(SOUND_KEY) || '0');
  if ((Date.now() - lastSound) < 60 * 60 * 1000) return;

  soundPlaying = true;
  localStorage.setItem(SOUND_KEY, Date.now().toString());

  if (hasRed) {
    howlCritical.play();
    showSoundIndicator('red', '🚨 ALERTA CRÍTICA');
    setTimeout(() => { soundPlaying = false; }, 6000);
  } else {
    howlWarning.play('warn');
    showSoundIndicator('orange', '⚠️ Advertencia');
    setTimeout(() => { soundPlaying = false; }, 3000);
  }
}

/** Notificación flotante cuando suena la alerta */
function showSoundIndicator(level, label) {
  const prev = document.getElementById('sound-indicator');
  if (prev) prev.remove();
  const count = ACTIVE_ALERTS.filter(a => level === 'red' ? a.type === 'red' : true).length;
  const border = level === 'red' ? 'var(--red)' : 'var(--orange)';
  const div = document.createElement('div');
  div.id = 'sound-indicator';
  div.className = 'sound-indicator';
  div.style.borderColor = border;
  div.onclick = () => { div.remove(); if(howlCritical) howlCritical.stop(); if(howlWarning) howlWarning.stop(); };
  div.innerHTML = `<span class="sound-icon">${level === 'red' ? '🚨' : '⚠️'}</span>
    <div><div class="sound-text" style="color:${border}">${label} — ${count} tarea(s)</div>
    <div class="sound-sub">Haz clic para silenciar</div></div>`;
  document.body.appendChild(div);
  setTimeout(() => { if (div.parentNode) div.remove(); }, 9000);
}

/** Inicia el scheduler periódico (cada 10 min) */
function startAlertScheduler() {
  ['click','keydown','mousemove','touchstart','scroll'].forEach(e =>
    document.addEventListener(e, recordUserActivity, { passive: true })
  );
  document.addEventListener('click', initHowler, { once: true });
  setInterval(() => {
    runAlertsEngine();
    renderDashboard();
    playAlertSound();
  }, 10 * 60 * 1000);
}

/**
 * Muestra un modal con todas las alertas activas.
 * Se activa al hacer clic en el botón 🔔 del topbar.
 */
function showAlertsPanel() {
  if (ACTIVE_ALERTS.length === 0) {
    Swal.fire({
      icon: 'success',
      title: '¡Todo en orden!',
      text: 'No hay alertas activas en este momento.',
      confirmButtonText: 'Entendido'
    });
    return;
  }

  // Construir HTML de la lista de alertas
  const html = ACTIVE_ALERTS.map(a => {
    const dotColor = a.type === 'red' ? '#ef4444' : a.type === 'orange' ? '#f97316' : '#f59e0b';
    return `
      <div style="display:flex;gap:10px;align-items:flex-start;
                  padding:10px 0;border-bottom:1px solid rgba(26,35,126,0.08);">
        <span style="width:8px;height:8px;border-radius:50%;background:${dotColor};
                     flex-shrink:0;margin-top:5px;"></span>
        <div>
          <div style="font-size:13px;color:#1a1f3c;font-weight:500">${a.text}</div>
          <div style="font-size:11px;color:#8892b0;margin-top:2px">${a.sub}</div>
        </div>
      </div>`;
  }).join('');

  Swal.fire({
    title: `🔔 Alertas activas (${ACTIVE_ALERTS.length})`,
    html:  `<div style="text-align:left;max-height:320px;overflow-y:auto">${html}</div>`,
    confirmButtonText: 'Cerrar'
  });
}

/**
 * Detecta si cambió el mes desde la última visita.
 * Si cambió → muestra aviso y actualiza meta.lastMonthCheck.
 * Se llama al iniciar la app.
 */
function checkMonthChange() {
  const db           = getDB();
  const currentMonth = new Date().getMonth();  // 0-11

  if (db.meta.lastMonthCheck !== currentMonth) {
    db.meta.lastMonthCheck = currentMonth;
    saveDB(db);

    // Esperar un momento para que cargue la UI antes de mostrar el modal
    setTimeout(() => {
      Swal.fire({
        icon:              'info',
        title:             `📊 Nuevo mes: ${MONTHS[currentMonth]}`,
        text:              'Se ha iniciado un nuevo mes. Revisa el reporte mensual de faltas e incidencias.',
        confirmButtonText: 'Ver reporte'
      }).then(r => { if (r.isConfirmed) navigate('reports'); });
    }, 1200);
  }
}

/* ================================================================
   4. NAVIGATION — Control de vistas
   ================================================================ */

/** Vista activa actual */
let currentView = 'dashboard';

/** Títulos para el topbar por vista */
const viewTitles = {
  dashboard:    'Dashboard',
  clients:      'Clientes',
  tasks:        'Tareas Contables',
  absences:     'Registro de Faltas',
  appointments: 'Agenda de Citas',
  reports:      'Reporte Mensual'
};

/**
 * Navega a una vista específica del sistema.
 * Oculta todas las vistas y muestra solo la seleccionada.
 * Actualiza el título del topbar y el nav item activo.
 * @param {string} view - ID de la vista destino
 */
function navigate(view) {
  currentView = view;

  // Ocultar todas las vistas
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));

  // Mostrar la vista seleccionada
  const targetView = document.getElementById('view-' + view);
  if (targetView) targetView.classList.add('active');

  // Actualizar título del topbar
  document.getElementById('topbar-title').textContent = viewTitles[view] || view;

  // Actualizar nav item activo
  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.toggle('active', n.dataset.view === view);
  });

  // Ejecutar la función de renderizado correspondiente
  const renderMap = {
    dashboard:    renderDashboard,
    clients:      renderClients,
    tasks:        () => { populateTaskFilters(); renderTasks(); },
    absences:     () => { populateAbsenceFilters(); renderAbsences(); },
    appointments: () => { populateApptFilters(); renderAppointments(); },
    reports:      renderReports
  };

  if (renderMap[view]) renderMap[view]();

  // Cerrar sidebar en mobile
  closeSidebar();
}

/** Abre/cierra el sidebar en mobile */
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('overlay').classList.toggle('open');
}

/** Cierra el sidebar en mobile */
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('overlay').classList.remove('open');
}

/**
 * Maneja el clic del botón "+ Nuevo" del topbar.
 * Según la vista activa, abre el formulario correspondiente.
 */
function handleAddClick() {
  const actions = {
    dashboard:    addTask,
    clients:      addClient,
    tasks:        addTask,
    absences:     addAbsence,
    appointments: addAppointment,
    reports:      exportData
  };
  (actions[currentView] || addTask)();
}

/* ================================================================
   5. MÓDULO: CLIENTES
   CRUD completo de clientes del despacho contable.
   ================================================================ */

/**
 * Abre el formulario para crear o editar un cliente.
 * Si se pasa un objeto `prefill`, rellena el formulario para editar.
 * @param {Object} prefill - Cliente existente para editar (opcional)
 */
async function addClient(prefill = {}) {
  const { value: form } = await Swal.fire({
    title: prefill.id ? '✏️ Editar Cliente' : '👤 Nuevo Cliente',
    html: `
      <div class="swal-form">
        <label>Nombre *</label>
        <input id="s-name" value="${prefill.name || ''}" placeholder="Nombre completo del cliente">

        <label>Razón Social</label>
        <input id="s-biz" value="${prefill.businessName || ''}" placeholder="Empresa o razón social">

        <div class="two-col">
          <div>
            <label>Teléfono</label>
            <input id="s-phone" value="${prefill.phone || ''}" placeholder="55 0000 0000">
          </div>
          <div>
            <label>Email</label>
            <input id="s-email" value="${prefill.email || ''}" placeholder="correo@ejemplo.com">
          </div>
        </div>

        <label>Estado</label>
        <select id="s-status">
          <option value="active"   ${(prefill.status || 'active') === 'active'   ? 'selected' : ''}>Activo</option>
          <option value="inactive" ${prefill.status === 'inactive' ? 'selected' : ''}>Inactivo</option>
        </select>
      </div>`,
    confirmButtonText: prefill.id ? 'Guardar cambios' : 'Crear cliente',
    showCancelButton:  true,
    cancelButtonText:  'Cancelar',
    preConfirm: () => {
      const name = document.getElementById('s-name').value.trim();

      // Validar nombre obligatorio
      if (!name) {
        Swal.showValidationMessage('El nombre del cliente es obligatorio');
        return false;
      }

      // Validar que no exista otro cliente con el mismo nombre
      const clients = dbGet('clients');
      const dup = clients.find(c =>
        c.name.toLowerCase() === name.toLowerCase() && c.id !== prefill.id
      );
      if (dup) {
        Swal.showValidationMessage('Ya existe un cliente con ese nombre');
        return false;
      }

      return {
        name,
        businessName: document.getElementById('s-biz').value.trim(),
        phone:        document.getElementById('s-phone').value.trim(),
        email:        document.getElementById('s-email').value.trim(),
        status:       document.getElementById('s-status').value
      };
    }
  });

  if (!form) return;  // Usuario canceló

  if (prefill.id) {
    dbUpdate('clients', prefill.id, form);
    toast('Cliente actualizado', 'success');
  } else {
    dbCreate('clients', form);
    toast('Cliente creado exitosamente', 'success');
  }

  renderClients();
  populateAllClientFilters();  // Actualizar todos los selects de clientes
}

/**
 * Renderiza la tabla de clientes con filtros aplicados.
 * Se llama al entrar a la vista y al escribir en el buscador.
 */
function renderClients() {
  // Obtener valores de filtros
  const search  = (document.getElementById('client-search')?.value  || '').toLowerCase();
  const statusF =  document.getElementById('client-status-filter')?.value || '';

  // Filtrar clientes
  let clients = dbGet('clients');
  if (search)  clients = clients.filter(c =>
    c.name.toLowerCase().includes(search) ||
    (c.businessName || '').toLowerCase().includes(search)
  );
  if (statusF) clients = clients.filter(c => c.status === statusF);

  const tbody = document.getElementById('clients-tbody');
  if (!tbody) return;

  // Estado vacío
  if (!clients.length) {
    tbody.innerHTML = `
      <tr><td colspan="6">
        <div class="empty-state">
          <div class="empty-icon">👤</div>
          <div class="empty-title">Sin clientes registrados</div>
          <div class="empty-sub">Haz clic en "+ Nuevo" para agregar tu primer cliente</div>
        </div>
      </td></tr>`;
    return;
  }

  // Renderizar filas
  tbody.innerHTML = clients.map(c => `
    <tr>
      <td><strong>${c.name}</strong></td>
      <td>${c.businessName || '<span style="color:var(--text-muted)">—</span>'}</td>
      <td>${c.phone        || '<span style="color:var(--text-muted)">—</span>'}</td>
      <td><span class="badge ${c.status === 'active' ? 'badge-active' : 'badge-inactive'}">
        ${c.status === 'active' ? '● Activo' : '○ Inactivo'}
      </span></td>
      <td>${fmtDate(c.createdAt)}</td>
      <td>
        <div style="display:flex;gap:6px;">
          <button class="btn-edit"   onclick='addClient(${JSON.stringify(c)})'>Editar</button>
          <button class="btn-danger" onclick="deleteClient('${c.id}')">Eliminar</button>
        </div>
      </td>
    </tr>`
  ).join('');
}

/**
 * Elimina un cliente y todos sus registros relacionados.
 * Pide confirmación antes de proceder.
 * @param {string} id - ID del cliente a eliminar
 */
async function deleteClient(id) {
  const result = await Swal.fire({
    title:             '¿Eliminar cliente?',
    text:              'Se eliminarán también todas sus tareas, faltas y citas asociadas.',
    icon:              'warning',
    showCancelButton:  true,
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText:  'Cancelar'
  });

  if (!result.isConfirmed) return;

  // Eliminar el cliente
  dbDelete('clients', id);

  // Eliminar registros relacionados en cascada
  const db    = getDB();
  db.tasks        = db.tasks.filter(t => t.clientId !== id);
  db.absences     = db.absences.filter(a => a.clientId !== id);
  db.appointments = db.appointments.filter(a => a.clientId !== id);
  saveDB(db);

  toast('Cliente eliminado', 'info');
  renderClients();
  populateAllClientFilters();
}

/* ================================================================
   6. MÓDULO: TAREAS
   Sistema tipo Kanban + Lista para gestión de tareas contables.
   ================================================================ */

/** Modo de vista actual: 'kanban' o 'list' */
let taskViewMode = 'kanban';

/** Etiquetas de tipo de tarea */
const typeLabel = {
  tax:        '🏛️ Impuestos',
  declaration:'📄 Declaraciones',
  invoice:    '🧾 Facturación',
  payroll:    '💼 Nómina',
  accounting: '📊 Contabilidad',
  imss:       '🏥 IMSS',
  infonavit:  '🏠 Infonavit',
  other:      '📌 Otro'
};

/** Etiquetas de prioridad */
const prioLabel = { low: 'Baja', medium: 'Media', high: 'Alta' };

/** Etiquetas de estado */
const statusLabel = { pending: 'Pendiente', in_progress: 'En proceso', completed: 'Completado' };

/** Mapeo de estado a clase badge */
const statusBadgeMap = {
  pending:     'badge-pending',
  in_progress: 'badge-progress',
  completed:   'badge-done'
};

/**
 * Alterna entre vista Kanban y vista Lista de tareas.
 */
function toggleTaskView() {
  taskViewMode = taskViewMode === 'kanban' ? 'list' : 'kanban';
  const btn = document.getElementById('task-view-toggle');
  if (btn) btn.textContent = taskViewMode === 'kanban' ? '📋 Lista' : '🗂 Kanban';
  renderTasks();
}

/**
 * Llena el select de clientes en los filtros de tareas.
 * Se llama al navegar a la vista de tareas.
 */
function populateTaskFilters() {
  const sel = document.getElementById('task-client-filter');
  if (!sel) return;
  const clients = dbGet('clients');
  sel.innerHTML = '<option value="">Todos los clientes</option>' +
    clients.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
}

/**
 * Abre el formulario para crear o editar una tarea.
 * @param {Object} prefill - Tarea existente para editar (opcional)
 */
async function addTask(prefill = {}) {
  const clients = dbGet('clients');

  // No se pueden crear tareas sin clientes
  if (!clients.length) {
    Swal.fire({ icon: 'warning', title: 'Sin clientes', text: 'Primero debes registrar al menos un cliente.' });
    return;
  }

  const clientOpts = clients.map(c =>
    `<option value="${c.id}" ${c.id === prefill.clientId ? 'selected' : ''}>${c.name}</option>`
  ).join('');

  // Formatear fecha para el input date
  const dueVal = prefill.dueDate ? prefill.dueDate.split('T')[0] : '';

  const { value: form } = await Swal.fire({
    title: prefill.id ? '✏️ Editar Tarea' : '📋 Nueva Tarea Contable',
    html: `
      <div class="swal-form">
        <label>Título *</label>
        <input id="t-title" value="${prefill.title || ''}" placeholder="Ej: Declaración mensual ISR">

        <label>Cliente *</label>
        <select id="t-client">
          <option value="">— Seleccionar cliente —</option>
          ${clientOpts}
        </select>

        <label>Descripción</label>
        <textarea id="t-desc" rows="2" placeholder="Detalles o instrucciones de la tarea">${prefill.description || ''}</textarea>

        <div class="two-col">
          <div>
            <label>Tipo de tarea</label>
            <select id="t-type">
              <option value="tax"         ${prefill.type === 'tax'         ? 'selected' : ''}>🏛️ Impuestos</option>
              <option value="declaration" ${prefill.type === 'declaration' ? 'selected' : ''}>📄 Declaraciones</option>
              <option value="invoice"     ${prefill.type === 'invoice'     ? 'selected' : ''}>🧾 Facturación</option>
              <option value="payroll"     ${prefill.type === 'payroll'     ? 'selected' : ''}>💼 Nómina</option>
              <option value="accounting"  ${prefill.type === 'accounting'  ? 'selected' : ''}>📊 Contabilidad</option>
              <option value="imss"        ${prefill.type === 'imss'        ? 'selected' : ''}>🏥 IMSS</option>
              <option value="infonavit"   ${prefill.type === 'infonavit'   ? 'selected' : ''}>🏠 Infonavit</option>
              <option value="other"       ${prefill.type === 'other'       ? 'selected' : ''}>📌 Otro</option>
            </select>
          </div>
          <div>
            <label>Prioridad</label>
            <select id="t-priority">
              <option value="low"    ${prefill.priority === 'low'                   ? 'selected' : ''}>🟢 Baja</option>
              <option value="medium" ${(prefill.priority || 'medium') === 'medium'  ? 'selected' : ''}>🟡 Media</option>
              <option value="high"   ${prefill.priority === 'high'                  ? 'selected' : ''}>🔴 Alta</option>
            </select>
          </div>
        </div>

        <div class="two-col">
          <div>
            <label>Estado</label>
            <select id="t-status" onchange="document.getElementById('cb-row').style.display=this.value==='completed'?'':'none'">
              <option value="pending"     ${(prefill.status || 'pending') === 'pending'     ? 'selected' : ''}>⏳ Pendiente</option>
              <option value="in_progress" ${prefill.status === 'in_progress'                ? 'selected' : ''}>🔄 En proceso</option>
              <option value="completed"   ${prefill.status === 'completed'                  ? 'selected' : ''}>✅ Completado</option>
            </select>
          </div>
          <div>
            <label>Fecha límite</label>
            <input type="date" id="t-due" value="${dueVal}">
          </div>
        </div>

        <div id="cb-row" style="${prefill.status === 'completed' ? '' : 'display:none'}">
          <label>Completado por</label>
          <input id="t-completed-by" value="${prefill.completedBy || ''}" placeholder="Nombre de quien realizó la tarea">
        </div>
      </div>`,
    confirmButtonText: prefill.id ? 'Guardar cambios' : 'Crear tarea',
    showCancelButton:  true,
    cancelButtonText:  'Cancelar',
    preConfirm: () => {
      const title    = document.getElementById('t-title').value.trim();
      const clientId = document.getElementById('t-client').value;

      if (!title)    { Swal.showValidationMessage('El título es obligatorio'); return false; }
      if (!clientId) { Swal.showValidationMessage('Debes seleccionar un cliente'); return false; }

      const dueInput   = document.getElementById('t-due').value;
      const statusVal  = document.getElementById('t-status').value;
      const completedBy = document.getElementById('t-completed-by')?.value?.trim() || '';
      return {
        title,
        clientId,
        description:  document.getElementById('t-desc').value.trim(),
        type:         document.getElementById('t-type').value,
        priority:     document.getElementById('t-priority').value,
        status:       statusVal,
        dueDate:      dueInput ? new Date(dueInput).toISOString() : null,
        lastUpdate:   new Date().toISOString(),
        completedBy:  statusVal === 'completed' ? completedBy : null,
        completedAt:  statusVal === 'completed' ? new Date().toISOString() : null
      };
    }
  });

  if (!form) return;

  if (prefill.id) {
    dbUpdate('tasks', prefill.id, form);
    if (form.status === 'completed' && prefill.status !== 'completed') {
      playCompletionTone();
      toast('✅ ¡Tarea completada!', 'success');
    } else {
      toast('Tarea actualizada', 'success');
    }
  } else {
    dbCreate('tasks', form);
    toast('Tarea creada exitosamente', 'success');
  }

  runAlertsEngine();
  renderTasks();
  renderDashboard();
}

/**
 * Construye la etiqueta HTML de fecha con colores semáforo.
 * Rojo = vencida, Naranja = próxima, Normal = ok.
 * @param {Object} t - Objeto tarea
 * @returns {string} HTML de la etiqueta de fecha
 */
function taskDateLabel(t) {
  if (!t.dueDate) return '<span class="task-date">Sin fecha límite</span>';
  const d = daysUntil(t.dueDate);
  if (d < 0)       return `<span class="task-date overdue">⚠ Vencida hace ${Math.abs(d)}d</span>`;
  if (d <= WARN_DAYS) return `<span class="task-date warning">⏰ Vence en ${d}d</span>`;
  return `<span class="task-date">📅 ${fmtDate(t.dueDate)}</span>`;
}

/**
 * Determina la clase CSS de una tarjeta de tarea según su estado.
 * @param {Object} t - Objeto tarea
 * @returns {string} Clase CSS ('overdue', 'warning', o '')
 */
function taskCardClass(t) {
  if (t.status === 'completed') return '';
  if (t.dueDate && daysUntil(t.dueDate) < 0)       return 'overdue';
  if (t.dueDate && daysUntil(t.dueDate) <= WARN_DAYS) return 'warning';
  return '';
}

/**
 * Renderiza el tablero de tareas (Kanban o Lista).
 * Aplica filtros de búsqueda, cliente y prioridad.
 */
function renderTasks() {
  // Obtener filtros
  const search   = (document.getElementById('task-search')?.value    || '').toLowerCase();
  const clientF  =  document.getElementById('task-client-filter')?.value   || '';
  const priorityF = document.getElementById('task-priority-filter')?.value || '';

  // Filtrar tareas
  let tasks = dbGet('tasks');
  if (search)    tasks = tasks.filter(t => t.title.toLowerCase().includes(search) || (t.description || '').toLowerCase().includes(search));
  if (clientF)   tasks = tasks.filter(t => t.clientId === clientF);
  if (priorityF) tasks = tasks.filter(t => t.priority === priorityF);

  if (taskViewMode === 'kanban') {
    renderKanban(tasks);
  } else {
    renderTaskList(tasks);
  }
}

/**
 * Renderiza el tablero Kanban con 3 columnas.
 * @param {Array} tasks - Tareas ya filtradas
 */
function renderKanban(tasks) {
  const kanbanEl = document.getElementById('tasks-kanban');
  const listEl   = document.getElementById('tasks-list');
  if (!kanbanEl) return;

  kanbanEl.style.display = '';
  if (listEl) listEl.style.display = 'none';

  // Definición de columnas
  const cols = [
    { key: 'pending',     label: 'Pendiente',  cls: 'col-pending'  },
    { key: 'in_progress', label: 'En proceso', cls: 'col-progress' },
    { key: 'completed',   label: 'Completado', cls: 'col-done'     }
  ];

  kanbanEl.innerHTML = `<div class="kanban-board">${
    cols.map(col => {
      const colTasks = tasks.filter(t => t.status === col.key);
      return `
        <div class="kanban-col ${col.cls}">
          <div class="kanban-col-header">
            <span class="kanban-col-title">${col.label}</span>
            <span class="col-count">${colTasks.length}</span>
          </div>
          ${colTasks.length
            ? colTasks.map(t => `
                <div class="task-card ${taskCardClass(t)}">
                  <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">
                    <div class="task-card-title">${t.title}</div>
                    <span class="badge badge-${t.priority}">${prioLabel[t.priority] || t.priority}</span>
                  </div>
                  <div class="task-card-client">
                    👤 ${clientName(t.clientId)} · ${typeLabel[t.type] || t.type}
                  </div>
                  ${t.description
                    ? `<div style="font-size:12px;color:var(--text-secondary);margin-bottom:6px;line-height:1.4">
                         ${t.description.slice(0, 90)}${t.description.length > 90 ? '…' : ''}
                       </div>`
                    : ''}
                  <div class="task-card-footer">
                    ${taskDateLabel(t)}
                    <div class="task-actions">
                      <button title="Editar"   onclick='addTask(${JSON.stringify(t)})'>✏️</button>
                      <button title="Eliminar" onclick="deleteTask('${t.id}')">🗑️</button>
                    </div>
                  </div>
                  ${t.status === 'completed'
                    ? `<div class="completed-by">✅ ${t.completedBy ? 'Por: ' + t.completedBy : 'Completado'}</div>`
                    : ''}
                </div>`
            ).join('')
            : `<div class="empty-state" style="padding:24px 10px;">
                 <div class="empty-icon">📭</div>
                 <div class="empty-sub">Sin tareas</div>
               </div>`
          }
        </div>`;
    }).join('')
  }</div>`;
}

/**
 * Renderiza la vista de lista de tareas (tabla).
 * @param {Array} tasks - Tareas ya filtradas
 */
function renderTaskList(tasks) {
  const kanbanEl = document.getElementById('tasks-kanban');
  const listEl   = document.getElementById('tasks-list');
  if (!listEl) return;

  if (kanbanEl) kanbanEl.style.display = 'none';
  listEl.style.display = '';

  if (!tasks.length) {
    listEl.innerHTML = `
      <div class="table-wrap">
        <div class="empty-state">
          <div class="empty-icon">📋</div>
          <div class="empty-title">Sin tareas registradas</div>
          <div class="empty-sub">Usa "+ Nuevo" para crear tu primera tarea</div>
        </div>
      </div>`;
    return;
  }

  listEl.innerHTML = `
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Tarea</th>
            <th>Cliente</th>
            <th>Tipo</th>
            <th>Prioridad</th>
            <th>Estado</th>
            <th>Vencimiento</th>
            <th>Completado por</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${tasks.map(t => `
            <tr>
              <td>
                <strong>${t.title}</strong>
                ${t.description
                  ? `<div style="font-size:11px;color:var(--text-muted);margin-top:2px">
                       ${t.description.slice(0, 60)}${t.description.length > 60 ? '…' : ''}
                     </div>`
                  : ''}
              </td>
              <td>${clientName(t.clientId)}</td>
              <td>${typeLabel[t.type] || t.type}</td>
              <td><span class="badge badge-${t.priority}">${prioLabel[t.priority] || t.priority}</span></td>
              <td><span class="badge ${statusBadgeMap[t.status]}">${statusLabel[t.status] || t.status}</span></td>
              <td>${taskDateLabel(t)}</td>
              <td>${t.status === 'completed'
                ? `<span class="completed-by">✅ ${t.completedBy || 'Completado'}</span>`
                : '<span style="color:var(--text-muted)">—</span>'}</td>
              <td>
                <div style="display:flex;gap:6px;">
                  <button class="btn-edit"   onclick='addTask(${JSON.stringify(t)})'>Editar</button>
                  <button class="btn-danger" onclick="deleteTask('${t.id}')">Eliminar</button>
                </div>
              </td>
            </tr>`
          ).join('')}
        </tbody>
      </table>
    </div>`;
}

/**
 * Elimina una tarea con confirmación.
 * @param {string} id - ID de la tarea
 */
async function deleteTask(id) {
  const r = await Swal.fire({
    title:             '¿Eliminar tarea?',
    text:              'Esta acción no se puede deshacer.',
    icon:              'warning',
    showCancelButton:  true,
    confirmButtonText: 'Eliminar',
    cancelButtonText:  'Cancelar'
  });

  if (!r.isConfirmed) return;

  dbDelete('tasks', id);
  runAlertsEngine();
  renderTasks();
  renderDashboard();
  toast('Tarea eliminada', 'info');
}

/* ================================================================
   7. MÓDULO: FALTAS
   Registro de incumplimientos/faltas por cliente y mes.
   ================================================================ */

/**
 * Llena el select de clientes en filtros de faltas.
 */
function populateAbsenceFilters() {
  const sel = document.getElementById('absence-client-filter');
  if (!sel) return;
  const clients = dbGet('clients');
  sel.innerHTML = '<option value="">Todos los clientes</option>' +
    clients.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
}

/**
 * Abre el formulario para registrar o editar una falta.
 * Calcula automáticamente el mes y año desde la fecha seleccionada.
 * @param {Object} prefill - Falta existente para editar (opcional)
 */
async function addAbsence(prefill = {}) {
  const clients = dbGet('clients');

  if (!clients.length) {
    Swal.fire({ icon: 'warning', title: 'Sin clientes', text: 'Primero registra al menos un cliente.' });
    return;
  }

  const clientOpts = clients.map(c =>
    `<option value="${c.id}" ${c.id === prefill.clientId ? 'selected' : ''}>${c.name}</option>`
  ).join('');

  const { value: form } = await Swal.fire({
    title: prefill.id ? '✏️ Editar Falta' : '❌ Registrar Falta',
    html: `
      <div class="swal-form">
        <label>Cliente *</label>
        <select id="a-client">
          <option value="">— Seleccionar cliente —</option>
          ${clientOpts}
        </select>

        <div class="two-col">
          <div>
            <label>Fecha *</label>
            <input type="date" id="a-date" value="${prefill.date ? prefill.date.split('T')[0] : ''}">
          </div>
          <div>
            <label>Tipo de falta</label>
            <input id="a-type" value="${prefill.type || ''}" placeholder="Ej: Documentación, Pago">
          </div>
        </div>

        <label>Observaciones</label>
        <textarea id="a-notes" rows="2" placeholder="Notas adicionales sobre la falta">${prefill.notes || ''}</textarea>
      </div>`,
    confirmButtonText: prefill.id ? 'Guardar' : 'Registrar falta',
    showCancelButton:  true,
    cancelButtonText:  'Cancelar',
    preConfirm: () => {
      const clientId = document.getElementById('a-client').value;
      const date     = document.getElementById('a-date').value;

      if (!clientId) { Swal.showValidationMessage('Selecciona un cliente'); return false; }
      if (!date)     { Swal.showValidationMessage('La fecha es obligatoria'); return false; }

      const d = new Date(date);
      return {
        clientId,
        date:  d.toISOString(),
        type:  document.getElementById('a-type').value.trim(),
        notes: document.getElementById('a-notes').value.trim(),
        month: d.getMonth() + 1,  // Mes 1-12, calculado automáticamente
        year:  d.getFullYear()    // Año, calculado automáticamente
      };
    }
  });

  if (!form) return;

  if (prefill.id) {
    dbUpdate('absences', prefill.id, form);
    toast('Falta actualizada', 'success');
  } else {
    dbCreate('absences', form);
    toast('Falta registrada', 'success');
  }

  renderAbsences();
  renderDashboard();
}

/**
 * Renderiza la tabla de faltas con filtros aplicados.
 */
function renderAbsences() {
  const clientF = document.getElementById('absence-client-filter')?.value || '';
  const monthF  = document.getElementById('absence-month-filter')?.value  || '';

  let absences = dbGet('absences');
  if (clientF) absences = absences.filter(a => a.clientId === clientF);
  if (monthF)  absences = absences.filter(a => String(a.month) === monthF);

  // Ordenar por fecha descendente
  absences.sort((a, b) => new Date(b.date) - new Date(a.date));

  const tbody = document.getElementById('absences-tbody');
  if (!tbody) return;

  if (!absences.length) {
    tbody.innerHTML = `
      <tr><td colspan="6">
        <div class="empty-state">
          <div class="empty-icon">✅</div>
          <div class="empty-title">Sin faltas registradas</div>
          <div class="empty-sub">No hay incumplimientos con los filtros aplicados</div>
        </div>
      </td></tr>`;
    return;
  }

  tbody.innerHTML = absences.map(a => `
    <tr>
      <td><strong>${clientName(a.clientId)}</strong></td>
      <td>${fmtDate(a.date)}</td>
      <td>${a.type  || '<span style="color:var(--text-muted)">—</span>'}</td>
      <td><span class="badge badge-pending">${monthName(a.month)} ${a.year}</span></td>
      <td>${a.notes || '<span style="color:var(--text-muted)">—</span>'}</td>
      <td>
        <div style="display:flex;gap:6px;">
          <button class="btn-edit"   onclick='addAbsence(${JSON.stringify(a)})'>Editar</button>
          <button class="btn-danger" onclick="deleteAbsence('${a.id}')">Eliminar</button>
        </div>
      </td>
    </tr>`
  ).join('');
}

/**
 * Elimina una falta con confirmación.
 * @param {string} id - ID de la falta
 */
async function deleteAbsence(id) {
  const r = await Swal.fire({
    title: '¿Eliminar falta?', icon: 'warning',
    showCancelButton: true, confirmButtonText: 'Eliminar', cancelButtonText: 'Cancelar'
  });
  if (!r.isConfirmed) return;
  dbDelete('absences', id);
  renderAbsences();
  renderDashboard();
  toast('Falta eliminada', 'info');
}

/* ================================================================
   8. MÓDULO: CITAS
   Agenda de reuniones con clientes. Detección automática de citas
   no realizadas mediante el motor de alertas.
   ================================================================ */

/**
 * Llena el select de clientes en filtros de citas.
 */
function populateApptFilters() {
  const sel = document.getElementById('appt-client-filter');
  if (!sel) return;
  const clients = dbGet('clients');
  sel.innerHTML = '<option value="">Todos los clientes</option>' +
    clients.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
}

/**
 * Abre el formulario para crear o editar una cita.
 * @param {Object} prefill - Cita existente para editar (opcional)
 */
async function addAppointment(prefill = {}) {
  const clients = dbGet('clients');

  if (!clients.length) {
    Swal.fire({ icon: 'warning', title: 'Sin clientes', text: 'Primero registra al menos un cliente.' });
    return;
  }

  const clientOpts = clients.map(c =>
    `<option value="${c.id}" ${c.id === prefill.clientId ? 'selected' : ''}>${c.name}</option>`
  ).join('');

  // Formatear datetime para el input
  const dtVal = prefill.dateTime ? prefill.dateTime.slice(0, 16) : '';

  const { value: form } = await Swal.fire({
    title: prefill.id ? '✏️ Editar Cita' : '📅 Nueva Cita',
    html: `
      <div class="swal-form">
        <label>Cliente *</label>
        <select id="ap-client">
          <option value="">— Seleccionar cliente —</option>
          ${clientOpts}
        </select>

        <label>Título / Motivo *</label>
        <input id="ap-title" value="${prefill.title || ''}" placeholder="Ej: Revisión declaración anual">

        <div class="two-col">
          <div>
            <label>Fecha y hora *</label>
            <input type="datetime-local" id="ap-dt" value="${dtVal}">
          </div>
          <div>
            <label>Estado</label>
            <select id="ap-status">
              <option value="scheduled"  ${(prefill.status || 'scheduled') === 'scheduled'  ? 'selected' : ''}>📅 Programada</option>
              <option value="completed"  ${prefill.status === 'completed'                   ? 'selected' : ''}>✅ Realizada</option>
              <option value="missed"     ${prefill.status === 'missed'                      ? 'selected' : ''}>❌ No realizada</option>
              <option value="cancelled"  ${prefill.status === 'cancelled'                   ? 'selected' : ''}>🚫 Cancelada</option>
            </select>
          </div>
        </div>

        <label>Descripción / Notas</label>
        <textarea id="ap-desc" rows="2" placeholder="Detalles adicionales de la cita">${prefill.description || ''}</textarea>
      </div>`,
    confirmButtonText: prefill.id ? 'Guardar cambios' : 'Agendar cita',
    showCancelButton:  true,
    cancelButtonText:  'Cancelar',
    preConfirm: () => {
      const clientId = document.getElementById('ap-client').value;
      const title    = document.getElementById('ap-title').value.trim();
      const dt       = document.getElementById('ap-dt').value;

      if (!clientId) { Swal.showValidationMessage('Selecciona un cliente'); return false; }
      if (!title)    { Swal.showValidationMessage('El título es obligatorio'); return false; }
      if (!dt)       { Swal.showValidationMessage('La fecha y hora son obligatorias'); return false; }

      return {
        clientId,
        title,
        dateTime:    new Date(dt).toISOString(),
        status:      document.getElementById('ap-status').value,
        description: document.getElementById('ap-desc').value.trim()
      };
    }
  });

  if (!form) return;

  if (prefill.id) {
    dbUpdate('appointments', prefill.id, form);
    toast('Cita actualizada', 'success');
  } else {
    dbCreate('appointments', form);
    toast('Cita agendada exitosamente', 'success');
  }

  runAlertsEngine();
  renderAppointments();
  renderDashboard();
}

/**
 * Renderiza la tabla de citas con filtros aplicados.
 */
function renderAppointments() {
  const clientF = document.getElementById('appt-client-filter')?.value || '';
  const statusF = document.getElementById('appt-status-filter')?.value || '';

  let appts = dbGet('appointments');
  if (clientF) appts = appts.filter(a => a.clientId === clientF);
  if (statusF) appts = appts.filter(a => a.status === statusF);

  // Ordenar por fecha descendente (más reciente primero)
  appts.sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime));

  const apptStatusLabel = {
    scheduled: 'Programada',
    completed: 'Realizada',
    missed:    'No realizada',
    cancelled: 'Cancelada'
  };

  const apptBadgeMap = {
    scheduled: 'badge-scheduled',
    completed: 'badge-completed',
    missed:    'badge-missed',
    cancelled: 'badge-cancelled'
  };

  const tbody = document.getElementById('appointments-tbody');
  if (!tbody) return;

  if (!appts.length) {
    tbody.innerHTML = `
      <tr><td colspan="6">
        <div class="empty-state">
          <div class="empty-icon">📅</div>
          <div class="empty-title">Sin citas registradas</div>
          <div class="empty-sub">Usa "+ Nuevo" para agendar una cita</div>
        </div>
      </td></tr>`;
    return;
  }

  tbody.innerHTML = appts.map(a => `
    <tr>
      <td><strong>${clientName(a.clientId)}</strong></td>
      <td>${a.title}</td>
      <td>${fmtDateTime(a.dateTime)}</td>
      <td><span class="badge ${apptBadgeMap[a.status]}">${apptStatusLabel[a.status] || a.status}</span></td>
      <td>${a.description || '<span style="color:var(--text-muted)">—</span>'}</td>
      <td>
        <div style="display:flex;gap:6px;">
          <button class="btn-edit"   onclick='addAppointment(${JSON.stringify(a)})'>Editar</button>
          <button class="btn-danger" onclick="deleteAppt('${a.id}')">Eliminar</button>
        </div>
      </td>
    </tr>`
  ).join('');
}

/**
 * Elimina una cita con confirmación.
 * @param {string} id - ID de la cita
 */
async function deleteAppt(id) {
  const r = await Swal.fire({
    title: '¿Eliminar cita?', icon: 'warning',
    showCancelButton: true, confirmButtonText: 'Eliminar', cancelButtonText: 'Cancelar'
  });
  if (!r.isConfirmed) return;
  dbDelete('appointments', id);
  renderAppointments();
  renderDashboard();
  toast('Cita eliminada', 'info');
}

/* ================================================================
   9. DASHBOARD — Vista principal ejecutiva
   Muestra el estado completo del despacho en un vistazo.
   ================================================================ */

/**
 * Renderiza el dashboard principal con KPIs y alertas.
 * Se llama: al cargar la app, y tras cualquier operación CRUD.
 */
function renderDashboard() {
  const tasks        = dbGet('tasks');
  const clients      = dbGet('clients');
  const absences     = dbGet('absences');
  const appointments = dbGet('appointments');
  const now          = new Date();

  /* ── Calcular métricas ── */
  const pending     = tasks.filter(t => t.status === 'pending').length;
  const overdue     = tasks.filter(t =>
    t.status !== 'completed' && t.dueDate && daysUntil(t.dueDate) < 0
  ).length;
  const noFollow    = tasks.filter(t =>
    t.status !== 'completed' && t.lastUpdate && daysDiff(t.lastUpdate) >= STALE_DAYS
  ).length;
  const todayAppts  = appointments.filter(a => {
    const d = new Date(a.dateTime);
    return d.getDate()        === now.getDate()     &&
           d.getMonth()       === now.getMonth()    &&
           d.getFullYear()    === now.getFullYear();
  }).length;
  const activeClients  = clients.filter(c => c.status === 'active').length;
  const monthAbsences  = absences.filter(a =>
    a.month === now.getMonth() + 1 && a.year === now.getFullYear()
  ).length;

  /* ── Actualizar cards KPI ── */
  const setKPI = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  setKPI('kpi-pending',   pending);
  setKPI('kpi-overdue',   overdue);
  setKPI('kpi-no-follow', noFollow);
  setKPI('kpi-appts',     todayAppts);
  setKPI('kpi-clients',   activeClients);
  setKPI('kpi-absences',  monthAbsences);

  /* ── Panel de alertas en dashboard ── */
  const alertsContainer = document.getElementById('alerts-panel-container');
  if (alertsContainer) {
    if (ACTIVE_ALERTS.length > 0) {
      alertsContainer.innerHTML = `
        <div class="alerts-panel">
          <div class="alerts-header">🔔 Alertas activas — ${ACTIVE_ALERTS.length} incidencia(s) requieren atención</div>
          ${ACTIVE_ALERTS.slice(0, 5).map(a => `
            <div class="alert-item">
              <span class="alert-dot ${a.type}"></span>
              <div>
                <div class="alert-text">${a.text}</div>
                <div class="alert-sub">${a.sub}</div>
              </div>
            </div>`
          ).join('')}
          ${ACTIVE_ALERTS.length > 5
            ? `<div class="alert-item">
                 <span style="font-size:12px;color:var(--text-muted);padding:0 6px">
                   + ${ACTIVE_ALERTS.length - 5} alertas más · Haz clic en 🔔 para ver todas
                 </span>
               </div>`
            : ''}
        </div>`;
    } else {
      alertsContainer.innerHTML = '';
    }
  }

  /* ── Tabla de tareas recientes ── */
  const recentTasks = [...tasks]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 6);  // Solo las 6 más recientes

  const dashTable = document.getElementById('dash-tasks-table');
  if (!dashTable) return;

  if (!recentTasks.length) {
    dashTable.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📋</div>
        <div class="empty-title">Sin tareas registradas</div>
        <div class="empty-sub">Ve al módulo de Tareas para crear tu primera tarea contable</div>
      </div>`;
    return;
  }

  dashTable.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Tarea</th>
          <th>Cliente</th>
          <th>Prioridad</th>
          <th>Estado</th>
          <th>Vencimiento</th>
        </tr>
      </thead>
      <tbody>
        ${recentTasks.map(t => `
          <tr>
            <td><strong>${t.title}</strong></td>
            <td>${clientName(t.clientId)}</td>
            <td><span class="badge badge-${t.priority}">${prioLabel[t.priority] || t.priority}</span></td>
            <td><span class="badge ${statusBadgeMap[t.status]}">${statusLabel[t.status] || t.status}</span></td>
            <td>${t.dueDate ? fmtDate(t.dueDate) : '<span style="color:var(--text-muted)">Sin fecha</span>'}</td>
          </tr>`
        ).join('')}
      </tbody>
    </table>`;
}

/* ================================================================
   10. REPORTES — Reporte mensual de faltas e incidencias
   ================================================================ */

/**
 * Renderiza el reporte mensual completo.
 * Muestra métricas del mes actual y detalle por cliente.
 */
function renderReports() {
  const absences = dbGet('absences');
  const tasks    = dbGet('tasks');
  const now      = new Date();
  const currentMonth = now.getMonth() + 1;  // 1-12
  const currentYear  = now.getFullYear();

  // Filtrar faltas del mes actual
  const monthAbsences = absences.filter(a =>
    a.month === currentMonth && a.year === currentYear
  );

  // Agrupar faltas por cliente
  const byClient = {};
  monthAbsences.forEach(a => {
    if (!byClient[a.clientId]) byClient[a.clientId] = [];
    byClient[a.clientId].push(a);
  });

  // Ordenar clientes por número de faltas (más faltas primero)
  const sorted     = Object.entries(byClient).sort((a, b) => b[1].length - a[1].length);
  const topClient  = sorted.length ? clientName(sorted[0][0]) : '—';
  const overdueCnt = tasks.filter(t => t.status !== 'completed' && t.dueDate && daysUntil(t.dueDate) < 0).length;

  const container = document.getElementById('report-content');
  if (!container) return;

  container.innerHTML = `
    <!-- Tarjeta de métricas del mes -->
    <div class="report-card">
      <div class="report-title">📊 Reporte — ${monthName(currentMonth)} ${currentYear}</div>
      <div class="report-grid">
        <div class="report-stat">
          <div class="report-stat-val">${monthAbsences.length}</div>
          <div class="report-stat-lbl">Faltas del mes</div>
        </div>
        <div class="report-stat">
          <div class="report-stat-val">${sorted.length}</div>
          <div class="report-stat-lbl">Clientes con faltas</div>
        </div>
        <div class="report-stat">
          <div class="report-stat-val" style="color:var(--red)">${overdueCnt}</div>
          <div class="report-stat-lbl">Tareas vencidas</div>
        </div>
        <div class="report-stat">
          <div class="report-stat-val" style="font-size:18px;color:var(--brand-navy)">${topClient}</div>
          <div class="report-stat-lbl">Cliente con más faltas</div>
        </div>
      </div>
    </div>

    <!-- Detalle por cliente -->
    ${sorted.length ? `
    <div class="section-header">
      <div>
        <div class="section-title">Detalle por cliente</div>
        <div class="section-subtitle">Todas las faltas de ${monthName(currentMonth)} ${currentYear}</div>
      </div>
    </div>
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Total faltas</th>
            <th>Fechas registradas</th>
            <th>Tipo</th>
          </tr>
        </thead>
        <tbody>
          ${sorted.map(([cid, abs]) => `
            <tr>
              <td><strong>${clientName(cid)}</strong></td>
              <td><span class="badge badge-high">${abs.length}</span></td>
              <td style="font-size:12px">${abs.map(a => fmtDate(a.date)).join(' · ')}</td>
              <td style="font-size:12px;color:var(--text-muted)">
                ${[...new Set(abs.map(a => a.type).filter(Boolean))].join(', ') || '—'}
              </td>
            </tr>`
          ).join('')}
        </tbody>
      </table>
    </div>`
    : `
    <div class="empty-state" style="margin-top:16px;">
      <div class="empty-icon">🎉</div>
      <div class="empty-title">¡Sin faltas este mes!</div>
      <div class="empty-sub">No hay incumplimientos registrados en ${monthName(currentMonth)} ${currentYear}</div>
    </div>`}`;
}

/* ================================================================
   11. EXPORT — Backup del sistema
   ================================================================ */

/**
 * Exporta toda la base de datos como archivo JSON.
 * El usuario puede guardarlo como respaldo manual.
 */
function exportData() {
  const db   = getDB();
  const json = JSON.stringify(db, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');

  a.href     = url;
  a.download = `sinergia_rea_backup_${new Date().toISOString().split('T')[0]}.json`;
  a.click();

  URL.revokeObjectURL(url);
  toast('Backup exportado correctamente', 'success');
}

/* ================================================================
   HELPERS GLOBALES
   ================================================================ */

/**
 * Actualiza los selects de clientes en TODOS los módulos.
 * Se llama después de crear o eliminar un cliente.
 */
function populateAllClientFilters() {
  const clients = dbGet('clients');
  const opts    = '<option value="">Todos los clientes</option>' +
    clients.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

  // IDs de todos los selects de filtro de clientes
  ['task-client-filter', 'absence-client-filter', 'appt-client-filter'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = opts;
  });
}

/**
 * Muestra una notificación tipo toast (pequeño, temporal).
 * @param {string} msg  - Mensaje a mostrar
 * @param {string} icon - 'success' | 'info' | 'warning' | 'error'
 */
function toast(msg, icon = 'success') {
  Swal.fire({
    toast:            true,
    position:         'top-end',
    icon,
    title:            msg,
    showConfirmButton: false,
    timer:            2200,
    timerProgressBar: true
  });
}

/* ================================================================
   12. INIT — Arranque de la aplicación
   ================================================================ */

/**
 * Función de inicialización principal.
 * Se ejecuta cuando el DOM está listo.
 * Orden: inicializar DB → detectar mes → alertas → dashboard → bienvenida.
 */
function init() {
  console.log('[Sinergia REA] Iniciando sistema...');

  // 1. Inicializar base de datos (solo si es la primera vez)
  initDB();

  // 2. Verificar si cambió el mes
  checkMonthChange();

  // 3. Ejecutar el motor de alertas
  runAlertsEngine();

  // 4. Renderizar el dashboard inicial
  renderDashboard();

  // 5. Asignar data-view a nav items para el navigate()
  const navItems = document.querySelectorAll('.nav-item');
  const views = ['dashboard', 'clients', 'tasks', 'absences', 'appointments', 'reports'];
  navItems.forEach((el, i) => {
    if (views[i]) el.dataset.view = views[i];
  });

  // 6. Iniciar scheduler de alertas con sonido Howler.js
  startAlertScheduler();

  // 7. Mostrar pantalla de bienvenida si es la primera vez (sin datos)
  const db = getDB();
  if (!db.clients.length && !db.tasks.length) {
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

  console.log('[Sinergia REA] Sistema listo.');
}

// Esperar a que el DOM esté completamente cargado
document.addEventListener('DOMContentLoaded', init);
