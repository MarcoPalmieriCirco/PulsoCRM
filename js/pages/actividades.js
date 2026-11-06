// Registro general de actividades realizadas (hechos pasados).
(async function () {
  const ui = Pulso.ui;
  const api = Pulso.api;
  const user = await Pulso.auth.requireAuth();
  if (!user) return;
  const esc = ui.escapeHtml;
  const cat = await Pulso.forms.catalogos();
  const state = { search: '', page: 1, tipo_id: '', usuario_id: '' };
  let reqId = 0;

  function renderShell() {
    const opt = (list) => list.map((o) => ({ value: o.id, label: o.nombre }));
    document.getElementById('app').innerHTML =
      ui.renderShellStart('actividades', user) +
      ui.renderTopbar({
        searchPlaceholder: 'Buscar por descripción, resultado o cliente…',
        searchValue: state.search,
        onSearch: 'Pulso.pages.actividades.setSearch(this.value)',
        actionsHtml: '<button class="btn-primary" onclick="Pulso.pages.actividades.nueva()">' + ui.ICONS.plus + ' Registrar actividad</button>'
      }) +
      '<div class="subbar"><div class="flex items-center gap-12" style="flex-wrap:wrap;">' +
        ui.filterChip('Tipo', state.tipo_id, opt(cat.tipos), 'Pulso.pages.actividades.setFilter(\'tipo_id\', this.value)') +
        (Pulso.auth.isVendedor(user) ? '' : ui.filterChip('Usuario', state.usuario_id, opt(cat.responsables), 'Pulso.pages.actividades.setFilter(\'usuario_id\', this.value)')) +
      '</div><span class="subbar-count" id="list-count"></span></div>' +
      '<div class="content flex-col gap-12" id="list-region">' + ui.renderLoading() + '</div>' +
      ui.renderShellEnd();
  }

  async function load() {
    const id = ++reqId;
    try {
      const r = await api.get('/actividades', { q: state.search, page: state.page, tipo_id: state.tipo_id, usuario_id: state.usuario_id });
      if (id !== reqId) return;
      document.getElementById('list-region').innerHTML = r.total
        ? '<div class="panel">' + ui.activityTimeline(r.items, { showClient: true }) + '</div>' + ui.pagination(r, 'Pulso.pages.actividades.setPage', 'actividades')
        : '<div class="empty-state">No hay actividades que coincidan con la búsqueda.</div>';
      document.getElementById('list-count').textContent = r.total + ' actividades';
    } catch (e) {
      if (id === reqId) document.getElementById('list-region').innerHTML = '<div class="empty-state">' + esc(e.message) + '</div>';
    }
  }

  Pulso.pages.actividades = {
    setSearch: ui.debounce((v) => { state.search = v; state.page = 1; load(); }),
    setFilter(k, v) { state[k] = v; state.page = 1; renderShell(); load(); },
    setPage(p) { state.page = p; load(); },
    nueva() { Pulso.forms.openActividad({}, () => { state.page = 1; load(); }).catch((e) => ui.toast(e.message, true)); }
  };

  renderShell();
  load();
})();
