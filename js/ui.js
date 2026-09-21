// Helpers de interfaz compartidos: shell (sidebar + topbar), modal, toast y
// formateadores. Cada página construye su HTML con estas funciones y las
// inyecta en el DOM; el manejo de eventos usa handlers colgados de window
// (patrón simple, sin frameworks).
window.Pulso = window.Pulso || {};

Pulso.ui = (function () {
  const ICONS = {
    inicio: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="1"></rect><path d="M9 8h1M14 8h1M9 12h1M14 12h1M9 16h1M14 16h1"></path></svg>',
    clientes: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 00-3-3.87"></path><path d="M16 3.13a4 4 0 010 7.75"></path></svg>',
    oportunidades: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l6-6 4 4 8-8"></path><path d="M15 7h6v6"></path></svg>',
    productos: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 7l-9 9-4-4"></path></svg>',
    actividades: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M4 12h16M4 18h10"></path></svg>',
    search: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8C8C8C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"></circle><path d="M21 21l-4-4"></path></svg>',
    plus: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"></path></svg>',
    check: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"></path></svg>',
    close: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"></path></svg>',
    chevronDown: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"></path></svg>'
  };

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatMoney(n) {
    if (!n) return '—';
    return '$' + Number(n).toLocaleString('es-AR');
  }

  function formatDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso + (iso.length <= 10 ? 'T00:00:00' : ''));
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('es-AR');
  }

  function formatDateTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('es-AR') + ', ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  }

  function initials(nombre, apellido) {
    const a = (nombre || '').trim().charAt(0);
    const b = (apellido || '').trim().charAt(0);
    if (b) return (a + b).toUpperCase();
    const parts = (nombre || '').trim().split(/\s+/);
    return parts.slice(0, 2).map((p) => p.charAt(0)).join('').toUpperCase() || '?';
  }

  function estadoBadgeClass(estado) {
    const map = { 'Cliente': 'badge-cliente', 'Potencial': 'badge-potencial', 'Inactivo': 'badge-inactivo', 'No contactar': 'badge-no-contactar' };
    return map[estado] || 'badge-potencial';
  }

  function estadoOppBadgeClass(estado) {
    const map = { abierta: 'badge-abierta', ganada: 'badge-ganada', perdida: 'badge-perdida' };
    return map[estado] || 'badge-abierta';
  }

  // ---------- Shell ----------
  function renderSidebar(active, user) {
    const items = [
      { key: 'inicio', label: 'Inicio', href: 'inicio.html', icon: ICONS.inicio },
      { key: 'clientes', label: 'Clientes', href: 'clientes.html', icon: ICONS.clientes },
      { key: 'oportunidades', label: 'Oportunidades', href: 'oportunidades.html', icon: ICONS.oportunidades },
      { key: 'productos', label: 'Productos', href: 'productos.html', icon: ICONS.productos }
    ];
    const navHtml = items.map((it) => {
      const cls = 'navlink' + (it.key === active ? ' active' : '');
      return '<a class="' + cls + '" href="' + it.href + '">' + it.icon + it.label + '</a>';
    }).join('') + '<span class="navlink disabled" title="No incluido en esta entrega">' + ICONS.actividades + 'Actividades</span>';

    const userName = user ? escapeHtml(user.nombre) : '';
    const userRole = user ? escapeHtml(user.rol) : '';
    const userInitials = user ? initials(user.nombre) : '';

    return (
      '<div class="sidebar">' +
        '<div class="sidebar-brand">' +
          '<div class="sidebar-brand-row"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FF5252" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h4l2 7 4-14 2 7h6"></path></svg><span class="sidebar-brand-name">Pulso</span></div>' +
          '<span class="sidebar-tagline">Seguile el Ritmo a tu Gimnasio</span>' +
        '</div>' +
        '<nav class="nav">' + navHtml + '</nav>' +
        '<div class="sidebar-user">' +
          '<div class="avatar">' + userInitials + '</div>' +
          '<div class="flex-col">' +
            '<span class="sidebar-user-name">' + userName + '</span>' +
            '<span class="sidebar-user-role">' + userRole + '</span>' +
            '<button class="logout-btn" onclick="Pulso.auth.logout()">Cerrar sesión</button>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function renderTopbar(opts) {
    opts = opts || {};
    const searchHtml = opts.hideSearch ? '' : (
      '<div class="search-box">' + ICONS.search +
      '<input type="text" id="topbar-search" placeholder="' + escapeHtml(opts.searchPlaceholder || 'Buscar…') + '" value="' + escapeHtml(opts.searchValue || '') + '" oninput="' + (opts.onSearch || '') + '">' +
      '</div>'
    );
    return '<div class="topbar">' + searchHtml + '<div class="topbar-actions">' + (opts.actionsHtml || '') + '</div></div>';
  }

  function renderShellStart(active, user) {
    return '<div class="app-shell">' + renderSidebar(active, user) + '<div class="main">';
  }

  function renderShellEnd() {
    return '</div></div>';
  }

  // ---------- Modal ----------
  function ensureModalRoot() {
    let root = document.getElementById('modal-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'modal-root';
      document.body.appendChild(root);
    }
    return root;
  }

  function openModal(innerHtml) {
    const root = ensureModalRoot();
    root.innerHTML =
      '<div class="modal-overlay" onclick="if(event.target===this) Pulso.ui.closeModal()">' +
        '<div class="modal-box">' + innerHtml + '</div>' +
      '</div>';
  }

  function closeModal() {
    const root = document.getElementById('modal-root');
    if (root) root.innerHTML = '';
  }

  function modalHeader(title) {
    return '<div class="modal-head"><span class="modal-title">' + escapeHtml(title) + '</span>' +
      '<button class="modal-close" onclick="Pulso.ui.closeModal()">' + ICONS.close + '</button></div>';
  }

  // ---------- Toast ----------
  let toastTimer = null;
  function toast(message) {
    let el = document.getElementById('toast-root');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast-root';
      document.body.appendChild(el);
    }
    el.innerHTML =
      '<div class="toast">' + ICONS.check +
      '<span>' + escapeHtml(message) + '</span>' +
      '<button class="toast-close" onclick="Pulso.ui.dismissToast()">' + ICONS.close + '</button></div>';
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(dismissToast, 4000);
  }

  function dismissToast() {
    const el = document.getElementById('toast-root');
    if (el) el.innerHTML = '';
  }

  // ---------- Entidades (empresa/contacto) ----------
  function entidadOptionsHtml(selectedTipo, selectedId) {
    const empresas = Pulso.db.empresas();
    const contactos = Pulso.db.contactos();
    let html = '<option value="">Seleccionar…</option>';
    if (empresas.length) {
      html += '<optgroup label="Empresas">';
      empresas.forEach((e) => {
        const val = 'empresa:' + e.id;
        const sel = selectedTipo === 'empresa' && selectedId === e.id ? ' selected' : '';
        html += '<option value="' + val + '"' + sel + '>' + escapeHtml(e.nombre) + '</option>';
      });
      html += '</optgroup>';
    }
    if (contactos.length) {
      html += '<optgroup label="Contactos">';
      contactos.forEach((c) => {
        const val = 'contacto:' + c.id;
        const sel = selectedTipo === 'contacto' && selectedId === c.id ? ' selected' : '';
        html += '<option value="' + val + '"' + sel + '>' + escapeHtml(c.nombre + ' ' + c.apellido) + '</option>';
      });
      html += '</optgroup>';
    }
    return html;
  }

  function entidadNombre(tipo, id) {
    if (tipo === 'empresa') {
      const e = Pulso.db.findEmpresa(id);
      return e ? e.nombre : 'Empresa eliminada';
    }
    const c = Pulso.db.findContacto(id);
    return c ? (c.nombre + ' ' + c.apellido) : 'Contacto eliminado';
  }

  function usuarioOptionsHtml(selectedId) {
    return Pulso.db.users().map((u) => '<option value="' + u.id + '"' + (u.id === selectedId ? ' selected' : '') + '>' + escapeHtml(u.nombre) + '</option>').join('');
  }

  function productoOptionsHtml(selectedId) {
    return Pulso.constants.PRODUCTOS.map((p) => '<option value="' + p.id + '"' + (p.id === selectedId ? ' selected' : '') + '>' + escapeHtml(p.nombre) + '</option>').join('');
  }

  function origenOptionsHtml(selected) {
    return Pulso.constants.ORIGENES.map((o) => '<option value="' + o + '"' + (o === selected ? ' selected' : '') + '>' + o + '</option>').join('');
  }

  function estadoClienteOptionsHtml(selected) {
    return Pulso.constants.ESTADOS_CLIENTE.map((s) => '<option value="' + s + '"' + (s === selected ? ' selected' : '') + '>' + s + '</option>').join('');
  }

  return {
    ICONS, escapeHtml, formatMoney, formatDate, formatDateTime, initials,
    estadoBadgeClass, estadoOppBadgeClass,
    renderSidebar, renderTopbar, renderShellStart, renderShellEnd,
    openModal, closeModal, modalHeader,
    toast, dismissToast,
    entidadOptionsHtml, entidadNombre, usuarioOptionsHtml, productoOptionsHtml, origenOptionsHtml, estadoClienteOptionsHtml
  };
})();
