// Helpers de interfaz compartidos: shell (sidebar + topbar), modal, toast,
// listas, historiales y formateadores. Cada página construye su HTML con estas
// funciones y las inyecta en el DOM.
window.Pulso = window.Pulso || {};

Pulso.ui = (function () {
  const svg = (w, body, extra) => '<svg width="' + w + '" height="' + w + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (extra || 2) + '" stroke-linecap="round" stroke-linejoin="round">' + body + '</svg>';
  const ICONS = {
    inicio: svg(18, '<rect x="4" y="3" width="16" height="18" rx="1"></rect><path d="M9 8h1M14 8h1M9 12h1M14 12h1M9 16h1M14 16h1"></path>'),
    clientes: svg(18, '<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 00-3-3.87"></path><path d="M16 3.13a4 4 0 010 7.75"></path>'),
    oportunidades: svg(18, '<path d="M3 17l6-6 4 4 8-8"></path><path d="M15 7h6v6"></path>'),
    productos: svg(18, '<path d="M6 7v10M18 7v10M2 10v4M22 10v4M6 12h12"></path>'),
    actividades: svg(18, '<path d="M4 6h16M4 12h16M4 18h10"></path>'),
    usuarios: svg(18, '<circle cx="12" cy="8" r="4"></circle><path d="M4 21v-1a6 6 0 016-6h4a6 6 0 016 6v1"></path>'),
    configuracion: svg(18, '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"></path><circle cx="16" cy="7" r="2"></circle><circle cx="8" cy="17" r="2"></circle>'),
    search: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8C8C8C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"></circle><path d="M21 21l-4-4"></path></svg>',
    plus: svg(16, '<path d="M12 5v14M5 12h14"></path>', 2.5),
    check: svg(14, '<path d="M5 13l4 4L19 7"></path>', 2.5),
    close: svg(16, '<path d="M6 6l12 12M18 6L6 18"></path>'),
    menu: svg(20, '<path d="M4 7h16M4 12h16M4 17h16"></path>'),
    up: svg(14, '<path d="M6 15l6-6 6 6"></path>', 2.5),
    down: svg(14, '<path d="M6 9l6 6 6-6"></path>', 2.5)
  };

  const ROL_LABEL = { administrador: 'Administrador', responsable: 'Responsable comercial', vendedor: 'Vendedor' };
  const ESTADOS_CLIENTE = ['Potencial', 'Cliente', 'Inactivo', 'No contactar'];

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  const esc = escapeHtml;

  function formatMoney(n) {
    if (n === null || n === undefined || n === '') return 'Sin valor';
    return '$' + Number(n).toLocaleString('es-AR');
  }

  function formatDate(iso) {
    if (!iso) return 'Sin fecha';
    const d = new Date(iso + (iso.length <= 10 ? 'T00:00:00' : ''));
    if (isNaN(d.getTime())) return 'Sin fecha';
    return d.toLocaleDateString('es-AR');
  }

  function formatDateTime(iso) {
    if (!iso) return 'Sin fecha';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return 'Sin fecha';
    return d.toLocaleDateString('es-AR') + ', ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  }

  function pad(n) { return String(n).padStart(2, '0'); }

  function todayLocal() {
    const d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function nowLocalInput() {
    const d = new Date();
    return todayLocal() + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function initials(nombre, apellido) {
    const a = (nombre || '').trim().charAt(0);
    const b = (apellido || '').trim().charAt(0);
    if (b) return esc((a + b).toUpperCase());
    const parts = (nombre || '').trim().split(/\s+/);
    return esc(parts.slice(0, 2).map((p) => p.charAt(0)).join('').toUpperCase() || '?');
  }

  function estadoBadgeClass(estado) {
    const map = { 'Cliente': 'badge-cliente', 'Potencial': 'badge-potencial', 'Inactivo': 'badge-inactivo', 'No contactar': 'badge-no-contactar' };
    return map[estado] || 'badge-potencial';
  }

  // El estado se guarda como pide la consigna; en pantalla se aclara el término del gimnasio.
  function estadoClienteLabel(estado) {
    return estado === 'Cliente' ? 'Cliente (socio)' : estado;
  }

  function estadoBadge(estado) {
    return '<span class="badge ' + estadoBadgeClass(estado) + '">' + esc(estadoClienteLabel(estado)) + '</span>';
  }

  function estadoOppLabel(estado) {
    return { abierta: 'Abierta', ganada: 'Ganada', perdida: 'Perdida' }[estado] || estado;
  }

  function estadoOppBadge(estado) {
    const cls = { abierta: 'badge-abierta', ganada: 'badge-ganada', perdida: 'badge-perdida' }[estado] || 'badge-abierta';
    return '<span class="badge ' + cls + '">' + esc(estadoOppLabel(estado)) + '</span>';
  }

  function clienteOpp(o) {
    return o.empresa_nombre || o.contacto_nombre || 'Sin cliente';
  }

  function valorOpp(o) {
    return o.valor_final !== null && o.valor_final !== undefined ? o.valor_final : o.valor_estimado;
  }

  // ---------- Shell ----------
  function renderSidebar(active, user) {
    const items = [
      { key: 'inicio', label: 'Inicio', href: 'inicio.html', icon: ICONS.inicio },
      { key: 'clientes', label: 'Interesados y socios', href: 'clientes.html', icon: ICONS.clientes },
      { key: 'oportunidades', label: 'Oportunidades', href: 'oportunidades.html', icon: ICONS.oportunidades },
      { key: 'actividades', label: 'Actividades', href: 'actividades.html', icon: ICONS.actividades },
      { key: 'productos', label: 'Planes', href: 'productos.html', icon: ICONS.productos }
    ];
    if (user && user.rol === 'administrador') {
      items.push({ key: 'usuarios', label: 'Usuarios', href: 'usuarios.html', icon: ICONS.usuarios });
      items.push({ key: 'configuracion', label: 'Configuración', href: 'configuracion.html', icon: ICONS.configuracion });
    }
    const navHtml = items.map((it) => {
      const cls = 'navlink' + (it.key === active ? ' active' : '');
      return '<a class="' + cls + '" href="' + it.href + '">' + it.icon + it.label + '</a>';
    }).join('');

    return (
      '<div class="sidebar" id="sidebar">' +
        '<div class="sidebar-brand">' +
          '<div class="sidebar-brand-row"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FF5252" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h4l2 7 4-14 2 7h6"></path></svg><span class="sidebar-brand-name">Pulso</span></div>' +
          '<span class="sidebar-tagline">Seguile el Ritmo a tu Gimnasio</span>' +
        '</div>' +
        '<nav class="nav">' + navHtml + '</nav>' +
        '<div class="sidebar-user">' +
          '<div class="avatar">' + (user ? initials(user.nombre) : '') + '</div>' +
          '<div class="flex-col">' +
            '<span class="sidebar-user-name">' + (user ? esc(user.nombre) : '') + '</span>' +
            '<span class="sidebar-user-role">' + (user ? esc(ROL_LABEL[user.rol] || user.rol) : '') + '</span>' +
            '<button class="logout-btn" onclick="Pulso.forms.openPassword()">Cambiar contraseña</button>' +
            '<button class="logout-btn" onclick="Pulso.auth.logout()">Cerrar sesión</button>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function toggleSidebar() {
    const el = document.getElementById('sidebar');
    if (el) el.classList.toggle('open');
  }

  function renderTopbar(opts) {
    opts = opts || {};
    const searchHtml = opts.hideSearch ? '<span></span>' : (
      '<div class="search-box">' + ICONS.search +
      '<input type="text" id="topbar-search" placeholder="' + esc(opts.searchPlaceholder || 'Buscar…') + '" value="' + esc(opts.searchValue || '') + '" oninput="' + (opts.onSearch || '') + '">' +
      '</div>'
    );
    return '<div class="topbar"><button class="menu-btn" aria-label="Menú" onclick="Pulso.ui.toggleSidebar()">' + ICONS.menu + '</button>' + searchHtml + '<div class="topbar-actions">' + (opts.actionsHtml || '') + '</div></div>';
  }

  function renderShellStart(active, user) {
    return '<div class="app-shell">' + renderSidebar(active, user) + '<div class="main">';
  }

  function renderShellEnd() {
    return '</div></div>';
  }

  function renderLoading() {
    return '<div class="empty-state">Cargando…</div>';
  }

  function renderPageError(active, user, message, backHref, backLabel) {
    document.getElementById('app').innerHTML =
      renderShellStart(active, user) +
      renderTopbar({ hideSearch: true }) +
      '<div class="content"><div class="empty-state">' + esc(message) +
      (backHref ? ' <a href="' + backHref + '">' + esc(backLabel) + '</a>' : '') + '</div></div>' +
      renderShellEnd();
  }

  // ---------- Modal ----------
  function ensureRoot(id) {
    let root = document.getElementById(id);
    if (!root) {
      root = document.createElement('div');
      root.id = id;
      document.body.appendChild(root);
    }
    return root;
  }

  function openModal(innerHtml) {
    ensureRoot('modal-root').innerHTML =
      '<div class="modal-overlay" onmousedown="if(event.target===this) Pulso.ui.closeModal()">' +
        '<div class="modal-box">' + innerHtml + '</div>' +
      '</div>';
  }

  function closeModal() {
    const root = document.getElementById('modal-root');
    if (root) root.innerHTML = '';
    pendingSubmit = null;
  }

  function modalHeader(title) {
    return '<div class="modal-head"><span class="modal-title">' + esc(title) + '</span>' +
      '<button class="modal-close" onclick="Pulso.ui.closeModal()">' + ICONS.close + '</button></div>';
  }

  // Modal con formulario: muestra los errores del servidor sin cerrarse.
  let pendingSubmit = null;
  function formModal(title, bodyHtml, submitLabel, onSubmit) {
    pendingSubmit = onSubmit;
    openModal(
      modalHeader(title) + bodyHtml +
      '<div id="f-error" class="form-error hidden"></div>' +
      '<div class="modal-actions">' +
        '<button class="btn-ghost" onclick="Pulso.ui.closeModal()">Cancelar</button>' +
        '<button class="btn-primary" id="f-submit" onclick="Pulso.ui.submitModal()">' + esc(submitLabel) + '</button>' +
      '</div>'
    );
  }

  async function submitModal() {
    const btn = document.getElementById('f-submit');
    const errEl = document.getElementById('f-error');
    if (!pendingSubmit || !btn) return;
    btn.disabled = true;
    errEl.classList.add('hidden');
    try {
      await pendingSubmit();
    } catch (e) {
      errEl.textContent = e.message;
      errEl.classList.remove('hidden');
      btn.disabled = false;
    }
  }

  function confirmModal(title, message, submitLabel, onConfirm) {
    formModal(title, '<p class="modal-text">' + esc(message) + '</p>', submitLabel, onConfirm);
  }

  // ---------- Toast ----------
  let toastTimer = null;
  function toast(message, isError) {
    ensureRoot('toast-root').innerHTML =
      '<div class="toast' + (isError ? ' toast-error' : '') + '">' + (isError ? '' : ICONS.check) +
      '<span>' + esc(message) + '</span>' +
      '<button class="toast-close" onclick="Pulso.ui.dismissToast()">' + ICONS.close + '</button></div>';
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(dismissToast, isError ? 7000 : 4000);
  }

  function dismissToast() {
    const el = document.getElementById('toast-root');
    if (el) el.innerHTML = '';
  }

  // ---------- Formularios ----------
  const val = (id) => {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
  };

  function field(label, control, hint) {
    return '<div class="form-field"><label>' + esc(label) + (hint ? ' <span class="hint">' + esc(hint) + '</span>' : '') + '</label>' + control + '</div>';
  }

  function input(id, value, attrs) {
    return '<input id="' + id + '" value="' + esc(value === null || value === undefined ? '' : value) + '" ' + (attrs || 'type="text"') + '>';
  }

  function textarea(id, value, placeholder) {
    return '<textarea id="' + id + '" rows="2" placeholder="' + esc(placeholder || '') + '">' + esc(value || '') + '</textarea>';
  }

  // Oculta valores inactivos salvo el que ya tiene el registro: se conserva el dato histórico.
  function options(list, selected, opts) {
    opts = opts || {};
    let html = opts.placeholder !== undefined ? '<option value="">' + esc(opts.placeholder) + '</option>' : '';
    list.forEach((o) => {
      if (o.activo === 0 && o.id !== selected) return;
      const disabled = opts.disable && opts.disable(o) && o.id !== selected;
      const label = opts.label ? opts.label(o) : o.nombre;
      html += '<option value="' + esc(o.id) + '"' + (o.id === selected ? ' selected' : '') + (disabled ? ' disabled' : '') + '>' + esc(label) + (o.activo === 0 ? ' (inactivo)' : '') + '</option>';
    });
    return html;
  }

  function select(id, list, selected, opts) {
    const change = opts && opts.onchange ? ' onchange="' + opts.onchange + '"' : '';
    return '<select id="' + id + '"' + change + '>' + options(list, selected, opts) + '</select>';
  }

  function estadoOptions(selected) {
    return ESTADOS_CLIENTE.map((s) => '<option value="' + s + '"' + (s === selected ? ' selected' : '') + '>' + esc(estadoClienteLabel(s)) + '</option>').join('');
  }

  // ---------- Listas ----------
  function filterChip(label, current, list, onchange) {
    const opts = list.map((o) => '<option value="' + esc(o.value) + '"' + (current === o.value ? ' selected' : '') + '>' + esc(o.label) + '</option>').join('');
    return '<div class="filter-chip' + (current ? ' active' : '') + '"><select aria-label="' + esc(label) + '" onchange="' + onchange + '"><option value="">' + esc(label) + '</option>' + opts + '</select></div>';
  }

  function pagination(result, handler, noun) {
    const page = result.page;
    return '<div class="pagination"><span class="text-faint" style="font-size:12px;">Página ' + page + ' de ' + result.pages + ' · ' + result.total + ' ' + esc(noun) + '</span>' +
      '<div class="flex gap-8">' +
        '<button class="pg-btn" ' + (page <= 1 ? 'disabled' : 'onclick="' + handler + '(' + (page - 1) + ')"') + '>Anterior</button>' +
        '<button class="pg-btn" ' + (page >= result.pages ? 'disabled' : 'onclick="' + handler + '(' + (page + 1) + ')"') + '>Siguiente</button>' +
      '</div></div>';
  }

  function debounce(fn, ms) {
    let t = null;
    return function () {
      const args = arguments;
      clearTimeout(t);
      t = setTimeout(() => fn.apply(null, args), ms || 250);
    };
  }

  // ---------- Historiales ----------
  function activityTimeline(items, opts) {
    opts = opts || {};
    if (!items.length) return '<div class="empty-state">Todavía no hay actividades registradas.</div>';
    return '<div class="timeline">' + items.map((a) => {
      const rel = [];
      if (a.oportunidad_titulo) rel.push(a.ver_oportunidad ? '<a href="oportunidad-detalle.html?id=' + esc(a.oportunidad_id) + '">' + esc(a.oportunidad_titulo) + '</a>' : esc(a.oportunidad_titulo));
      if (opts.showClient) {
        if (a.empresa_nombre) rel.push(esc(a.empresa_nombre));
        if (a.contacto_nombre) rel.push(esc(a.contacto_nombre));
      }
      return (
        '<div class="timeline-item">' +
          '<div class="timeline-head"><span class="timeline-title">' + esc(a.tipo_nombre) + '</span><span class="timeline-date">' + esc(formatDateTime(a.fecha_hora)) + '</span></div>' +
          '<div class="timeline-body">' + esc(a.descripcion) + '</div>' +
          '<div class="timeline-body"><strong>Resultado:</strong> ' + esc(a.resultado) + '</div>' +
          '<div class="timeline-meta">Registró ' + esc(a.usuario_nombre) + (rel.length ? ' · ' + rel.join(' · ') : '') + '</div>' +
        '</div>'
      );
    }).join('') + '</div>';
  }

  function stageHistory(items) {
    if (!items.length) return '<div class="empty-state">Sin cambios de etapa.</div>';
    return '<div class="timeline">' + items.map((h) => (
      '<div class="timeline-item">' +
        '<div class="timeline-head"><span class="timeline-title">' +
          (h.etapa_anterior_nombre ? esc(h.etapa_anterior_nombre) + ' → ' + esc(h.etapa_nueva_nombre) : 'Comenzó en ' + esc(h.etapa_nueva_nombre)) +
        '</span><span class="timeline-date">' + esc(formatDateTime(h.fecha_hora)) + '</span></div>' +
        (h.observacion ? '<div class="timeline-body">' + esc(h.observacion) + '</div>' : '') +
        '<div class="timeline-meta">Por ' + esc(h.usuario_nombre) + '</div>' +
      '</div>'
    )).join('') + '</div>';
  }

  function auditList(items) {
    if (!items.length) return '<div class="empty-state">Sin cambios registrados.</div>';
    return '<div class="timeline">' + items.map((a) => (
      '<div class="timeline-item">' +
        '<div class="timeline-head"><span class="timeline-title">' + esc(a.accion) + '</span><span class="timeline-date">' + esc(formatDateTime(a.fecha_hora)) + '</span></div>' +
        (a.detalle ? '<div class="timeline-body">' + esc(a.detalle) + '</div>' : '') +
        '<div class="timeline-meta">Por ' + esc(a.usuario_nombre) + '</div>' +
      '</div>'
    )).join('') + '</div>';
  }

  function oportunidadesList(items, emptyText) {
    if (!items.length) return '<div class="empty-state">' + esc(emptyText) + '</div>';
    return items.map((o) => (
      '<a class="panel opp-link" href="oportunidad-detalle.html?id=' + esc(o.id) + '">' +
        '<div class="flex items-center justify-between gap-12"><span class="opp-link-title">' + esc(o.titulo) + '</span>' +
        '<span class="badge ' + ({ abierta: 'badge-abierta', ganada: 'badge-ganada', perdida: 'badge-perdida' }[o.estado]) + '">' + esc(o.estado === 'abierta' ? o.etapa_nombre : estadoOppLabel(o.estado)) + '</span></div>' +
        '<span class="text-faint" style="font-size:12px;">' + esc(o.plan_nombre) + ' · Responsable: ' + esc(o.responsable_nombre) + '</span>' +
        '<div class="flex items-center justify-between"><span class="mono opp-link-value">' + esc(formatMoney(valorOpp(o))) + '</span>' +
        '<span class="text-faint" style="font-size:11px;">' + esc(o.fecha_real_cierre ? 'Cierre: ' + formatDate(o.fecha_real_cierre) : 'Est.: ' + formatDate(o.fecha_estimada_cierre)) + '</span></div>' +
      '</a>'
    )).join('');
  }

  function kv(label, value) {
    return '<div class="kv-row"><span class="k">' + esc(label) + '</span><span class="v">' + value + '</span></div>';
  }

  function kvText(label, value) {
    return kv(label, esc(value === null || value === undefined || value === '' ? 'Sin dato' : value));
  }

  function observaciones(text) {
    return text ? '<div class="flex-col" style="gap:5px;padding-top:6px;border-top:1px solid var(--line);"><span class="k" style="font-size:12px;color:var(--ink-faint);">Observaciones</span><span style="font-size:13px;color:var(--ink);line-height:1.5;">' + esc(text) + '</span></div>' : '';
  }

  return {
    ICONS, ROL_LABEL, ESTADOS_CLIENTE, escapeHtml, formatMoney, formatDate, formatDateTime, todayLocal, nowLocalInput, initials,
    estadoBadge, estadoClienteLabel, estadoOppBadge, estadoOppLabel, clienteOpp, valorOpp,
    renderSidebar, toggleSidebar, renderTopbar, renderShellStart, renderShellEnd, renderLoading, renderPageError,
    openModal, closeModal, modalHeader, formModal, submitModal, confirmModal,
    toast, dismissToast,
    val, field, input, textarea, options, select, estadoOptions,
    filterChip, pagination, debounce,
    activityTimeline, stageHistory, auditList, oportunidadesList, kv, kvText, observaciones
  };
})();
