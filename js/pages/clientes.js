(async function () {
  const ui = Pulso.ui;
  const api = Pulso.api;
  const forms = Pulso.forms;
  const user = await Pulso.auth.requireAuth();
  if (!user) return;
  const esc = ui.escapeHtml;

  const cat = await forms.catalogos();
  const hash = window.location.hash === '#personas' ? 'contactos' : 'empresas';
  const state = { tab: hash, search: '', page: 1, filters: { responsable_id: '', estado: '', origen_id: '' } };
  let reqId = 0;

  const COLS_EMPRESA = '2fr 1.1fr 1.3fr 1.1fr 1fr 1fr 0.7fr';
  const COLS_CONTACTO = '1.3fr 0.9fr 1.4fr 1fr 0.9fr 0.9fr 1fr 0.6fr';

  function empresasTable(r) {
    if (!r.total) return '<div class="empty-state">No hay empresas que coincidan con la búsqueda.</div>';
    const rows = r.items.map((e) => (
      '<div class="row" style="grid-template-columns:' + COLS_EMPRESA + ';" onclick="window.location.href=\'empresa-detalle.html?id=' + esc(e.id) + '\'">' +
        '<span class="cell" style="font-weight:600;color:var(--ink);">' + esc(e.nombre) + '</span>' +
        '<span class="cell mono">' + esc(e.cuit || 'Sin CUIT') + '</span>' +
        '<span class="cell">' + esc(e.industria || 'Sin dato') + '</span>' +
        '<span class="cell">' + esc(e.responsable_nombre) + '</span>' +
        '<span class="cell">' + ui.estadoBadge(e.estado) + '</span>' +
        '<span class="cell text-faint">' + esc(e.origen_nombre) + '</span>' +
        '<span class="cell"><a href="empresa-detalle.html?id=' + esc(e.id) + '">Ver ficha</a></span>' +
      '</div>'
    )).join('');
    return '<div class="data-table"><div class="thead-row" style="grid-template-columns:' + COLS_EMPRESA + ';">' +
      '<span>Razón social</span><span>CUIT</span><span>Actividad</span><span>Responsable</span><span>Estado</span><span>Origen</span><span></span></div>' + rows + '</div>' +
      ui.pagination(r, 'Pulso.pages.clientes.setPage', 'empresas');
  }

  function contactosTable(r) {
    if (!r.total) return '<div class="empty-state">No hay interesados ni socios que coincidan con la búsqueda.</div>';
    const rows = r.items.map((c) => (
      '<div class="row" style="grid-template-columns:' + COLS_CONTACTO + ';" onclick="window.location.href=\'contacto-detalle.html?id=' + esc(c.id) + '\'">' +
        '<span class="cell" style="font-weight:600;color:var(--ink);">' + esc(c.nombre + ' ' + c.apellido) + '</span>' +
        '<span class="cell mono">' + esc(c.dni || 'Sin dato') + '</span>' +
        '<span class="cell ' + (c.empresa_nombre ? '' : 'text-faint') + '">' + esc(c.empresa_nombre || 'Particular') + '</span>' +
        '<span class="cell mono">' + esc(c.telefono || 'Sin dato') + '</span>' +
        '<span class="cell">' + esc(c.responsable_nombre) + '</span>' +
        '<span class="cell text-faint">' + esc(c.origen_nombre) + '</span>' +
        '<span class="cell">' + ui.estadoBadge(c.estado) + '</span>' +
        '<span class="cell"><a href="contacto-detalle.html?id=' + esc(c.id) + '">Ver ficha</a></span>' +
      '</div>'
    )).join('');
    return '<div class="data-table"><div class="thead-row" style="grid-template-columns:' + COLS_CONTACTO + ';">' +
      '<span>Nombre</span><span>DNI</span><span>Empresa</span><span>Teléfono</span><span>Responsable</span><span>Origen</span><span>Estado</span><span></span></div>' + rows + '</div>' +
      ui.pagination(r, 'Pulso.pages.clientes.setPage', 'personas');
  }

  function renderFilters() {
    const f = state.filters;
    const setF = (k) => 'Pulso.pages.clientes.setFilter(\'' + k + '\', this.value)';
    return (
      (Pulso.auth.isVendedor(user) ? '' : ui.filterChip('Responsable', f.responsable_id, cat.responsables.map((u) => ({ value: u.id, label: u.nombre })), setF('responsable_id'))) +
      ui.filterChip('Estado', f.estado, ui.ESTADOS_CLIENTE.map((s) => ({ value: s, label: ui.estadoClienteLabel(s) })), setF('estado')) +
      ui.filterChip('Origen', f.origen_id, cat.origenes.map((o) => ({ value: o.id, label: o.nombre })), setF('origen_id'))
    );
  }

  function renderShell() {
    const isEmpresas = state.tab === 'empresas';
    document.getElementById('app').innerHTML =
      ui.renderShellStart('clientes', user) +
      ui.renderTopbar({
        searchPlaceholder: isEmpresas ? 'Buscar empresas por nombre, CUIT o actividad…' : 'Buscar interesados y socios por nombre, DNI o empresa…',
        searchValue: state.search,
        onSearch: 'Pulso.pages.clientes.setSearch(this.value)',
        actionsHtml: '<button class="btn-primary" onclick="Pulso.pages.clientes.openAdd()">' + ui.ICONS.plus + ' Añadir ' + (isEmpresas ? 'empresa' : 'interesado o socio') + '</button>'
      }) +
      '<div class="subbar">' +
        '<div class="flex items-center gap-12" style="flex-wrap:wrap;">' +
          '<div class="tab-group">' +
            '<button class="tab-btn' + (isEmpresas ? ' active' : '') + '" onclick="Pulso.pages.clientes.setTab(\'empresas\')">Empresas</button>' +
            '<button class="tab-btn' + (!isEmpresas ? ' active' : '') + '" onclick="Pulso.pages.clientes.setTab(\'contactos\')">Personas</button>' +
          '</div>' + renderFilters() +
        '</div>' +
        '<span class="subbar-count" id="list-count"></span>' +
      '</div>' +
      '<div class="content flex-col gap-12" id="list-region">' + ui.renderLoading() + '</div>' +
      ui.renderShellEnd();
  }

  async function loadList() {
    const id = ++reqId;
    const isEmpresas = state.tab === 'empresas';
    try {
      const r = await api.get('/' + state.tab, Object.assign({ q: state.search, page: state.page }, state.filters));
      if (id !== reqId) return; // llegó una búsqueda más nueva
      document.getElementById('list-region').innerHTML = isEmpresas ? empresasTable(r) : contactosTable(r);
      document.getElementById('list-count').textContent = r.total + (isEmpresas ? ' empresas' : ' personas');
    } catch (e) {
      if (id === reqId) document.getElementById('list-region').innerHTML = '<div class="empty-state">' + esc(e.message) + '</div>';
    }
  }

  const searchLater = ui.debounce(loadList);

  Pulso.pages.clientes = {
    setTab(t) {
      state.tab = t;
      state.page = 1;
      window.location.hash = t === 'contactos' ? 'personas' : 'empresas';
      renderShell();
      loadList();
    },
    setSearch(v) { state.search = v; state.page = 1; searchLater(); },
    setFilter(k, v) { state.filters[k] = v; state.page = 1; renderShell(); loadList(); },
    setPage(p) { state.page = p; loadList(); },
    openAdd() {
      const after = () => { state.page = 1; loadList(); };
      (state.tab === 'empresas' ? forms.openEmpresa(user, null, after) : forms.openContacto(user, null, after))
        .catch((e) => ui.toast(e.message, true));
    }
  };

  renderShell();
  loadList();
})();
