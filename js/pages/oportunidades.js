(async function () {
  const ui = Pulso.ui;
  const api = Pulso.api;
  const forms = Pulso.forms;
  const user = await Pulso.auth.requireAuth();
  if (!user) return;
  const esc = ui.escapeHtml;

  let cat;
  try {
    cat = await forms.catalogos();
  } catch (e) {
    ui.renderPageError('oportunidades', user, e.message);
    return;
  }

  const state = {
    view: 'tablero',
    search: '',
    page: 1,
    filters: { responsable_id: '', etapa_id: '', estado: '', origen_id: '', sede_id: '' },
    dragId: null,
    items: []
  };
  let reqId = 0;

  const COLS = '1.6fr 1.3fr 1fr 1fr 1.2fr 0.9fr 0.8fr';

  function renderFilters() {
    const f = state.filters;
    const setF = (k) => 'Pulso.pages.oportunidades.setFilter(\'' + k + '\', this.value)';
    const opt = (list) => list.map((o) => ({ value: o.id, label: o.nombre }));
    return (
      (Pulso.auth.isVendedor(user) ? '' : ui.filterChip('Responsable', f.responsable_id, opt(cat.responsables), setF('responsable_id'))) +
      ui.filterChip('Etapa', f.etapa_id, opt(cat.etapas), setF('etapa_id')) +
      ui.filterChip('Estado', f.estado, [{ value: 'abierta', label: 'Abierta' }, { value: 'ganada', label: 'Ganada' }, { value: 'perdida', label: 'Perdida' }], setF('estado')) +
      ui.filterChip('Origen', f.origen_id, opt(cat.origenes), setF('origen_id')) +
      ui.filterChip('Sede', f.sede_id, opt(cat.sedes), setF('sede_id'))
    );
  }

  function renderBoard(items) {
    // Las etapas inactivas solo se muestran si todavía conservan oportunidades.
    const etapas = cat.etapas.filter((et) => et.activo || items.some((o) => o.etapa_id === et.id));
    const cols = etapas.map((et) => {
      const colItems = items.filter((o) => o.etapa_id === et.id);
      const total = colItems.reduce((sum, o) => sum + (ui.valorOpp(o) || 0), 0);
      const cardsHtml = colItems.map((o) => {
        let flag = '';
        if (o.estado === 'ganada') {
          flag = '<div class="opp-card-flag-won">' + ui.ICONS.check + '<span>Alta · cierre ' + esc(ui.formatDate(o.fecha_real_cierre)) + '</span></div>';
        } else if (o.estado === 'perdida') {
          flag = '<div class="opp-card-flag-lost"><span>Motivo: ' + esc(o.motivo_nombre || 'Sin especificar') + '</span></div>';
        }
        return (
          '<div class="opp-card" draggable="true" data-id="' + esc(o.id) + '" ondragstart="Pulso.pages.oportunidades.onDragStart(event,\'' + esc(o.id) + '\')" onclick="Pulso.pages.oportunidades.goDetail(\'' + esc(o.id) + '\')">' +
            '<div class="opp-card-top"><span class="opp-card-title">' + esc(o.titulo) + '</span><span class="opp-card-tag">' + (o.empresa_id ? 'Empresa' : 'Persona') + '</span></div>' +
            '<span class="opp-card-product">' + esc(ui.clienteOpp(o)) + ' · ' + esc(o.plan_nombre) + '</span>' +
            '<span class="opp-card-days">' + esc(o.sede_nombre) + '</span>' +
            '<div class="opp-card-bottom">' +
              '<div class="opp-card-owner"><span class="avatar">' + ui.initials(o.responsable_nombre) + '</span><span class="opp-card-days">' + esc(o.responsable_nombre) + '</span></div>' +
              '<span class="opp-card-value">' + esc(ui.formatMoney(ui.valorOpp(o))) + '</span>' +
            '</div>' + flag +
          '</div>'
        );
      }).join('');

      return (
        '<div class="board-col" data-etapa="' + esc(et.id) + '">' +
          '<div class="board-col-head">' +
            '<div class="board-col-head-row"><span class="dot" style="background:' + esc(et.color) + ';"></span><span style="font-size:13px;font-weight:600;color:var(--ink);">' + esc(et.nombre) + '</span><span class="board-col-count">' + colItems.length + '</span></div>' +
            '<span class="board-col-total">' + (total > 0 ? esc(ui.formatMoney(total)) : 'Sin valor') + '</span>' +
          '</div>' +
          '<div class="board-drop" id="drop-' + esc(et.id) + '" ondragover="Pulso.pages.oportunidades.onDragOver(event,\'' + esc(et.id) + '\')" ondragleave="Pulso.pages.oportunidades.onDragLeave(\'' + esc(et.id) + '\')" ondrop="Pulso.pages.oportunidades.onDrop(event,\'' + esc(et.id) + '\')">' + cardsHtml + '</div>' +
        '</div>'
      );
    }).join('');
    return '<div class="board">' + cols + '</div>';
  }

  function renderList(r) {
    if (!r.total) return '<div class="empty-state">No hay oportunidades que coincidan con los filtros.</div>';
    const rows = r.items.map((o) => (
      '<div class="row" style="grid-template-columns:' + COLS + ';" onclick="Pulso.pages.oportunidades.goDetail(\'' + esc(o.id) + '\')">' +
        '<span class="cell" style="font-weight:600;color:var(--ink);">' + esc(o.titulo) + '</span>' +
        '<span class="cell">' + esc(ui.clienteOpp(o)) + '</span>' +
        '<span class="cell">' + esc(o.plan_nombre) + '</span>' +
        '<span class="cell">' + esc(o.responsable_nombre) + '</span>' +
        '<span class="cell">' + esc(o.etapa_nombre) + '</span>' +
        '<span class="cell mono">' + esc(ui.formatMoney(ui.valorOpp(o))) + '</span>' +
        '<span class="cell">' + ui.estadoOppBadge(o.estado) + '</span>' +
      '</div>'
    )).join('');
    return '<div class="data-table"><div class="thead-row" style="grid-template-columns:' + COLS + ';">' +
      '<span>Título</span><span>Empresa / Persona</span><span>Plan</span><span>Responsable</span><span>Etapa</span><span>Valor</span><span>Estado</span></div>' + rows + '</div>' +
      ui.pagination(r, 'Pulso.pages.oportunidades.setPage', 'oportunidades');
  }

  function renderShell() {
    document.getElementById('app').innerHTML =
      ui.renderShellStart('oportunidades', user) +
      ui.renderTopbar({
        searchPlaceholder: 'Buscar por título, cliente o plan…',
        searchValue: state.search,
        onSearch: 'Pulso.pages.oportunidades.setSearch(this.value)',
        actionsHtml: '<button class="btn-primary" onclick="Pulso.pages.oportunidades.openNew()">' + ui.ICONS.plus + ' Nueva oportunidad</button>'
      }) +
      '<div class="subbar">' +
        '<div class="flex items-center gap-12" style="flex-wrap:wrap;">' +
          '<div class="tab-group">' +
            '<button class="tab-btn' + (state.view === 'tablero' ? ' active' : '') + '" onclick="Pulso.pages.oportunidades.setView(\'tablero\')">Tablero</button>' +
            '<button class="tab-btn' + (state.view === 'lista' ? ' active' : '') + '" onclick="Pulso.pages.oportunidades.setView(\'lista\')">Lista</button>' +
          '</div>' + renderFilters() +
        '</div>' +
        '<span class="subbar-count" id="list-count"></span>' +
      '</div>' +
      '<div class="content flex-col gap-12" id="list-region">' + ui.renderLoading() + '</div>' +
      ui.renderShellEnd();
  }

  async function loadList() {
    const id = ++reqId;
    const isBoard = state.view === 'tablero';
    const params = Object.assign({ q: state.search }, state.filters, isBoard ? { limit: 'all' } : { page: state.page });
    try {
      const r = await api.get('/oportunidades', params);
      if (id !== reqId) return;
      state.items = r.items;
      document.getElementById('list-region').innerHTML = isBoard ? renderBoard(r.items) : renderList(r);
      document.getElementById('list-count').textContent = r.total + ' oportunidades';
    } catch (e) {
      if (id === reqId) document.getElementById('list-region').innerHTML = '<div class="empty-state">' + esc(e.message) + '</div>';
    }
  }

  const searchLater = ui.debounce(loadList);

  Pulso.pages.oportunidades = {
    setView(v) { state.view = v; state.page = 1; renderShell(); loadList(); },
    setSearch(v) { state.search = v; state.page = 1; searchLater(); },
    setFilter(k, v) { state.filters[k] = v; state.page = 1; renderShell(); loadList(); },
    setPage(p) { state.page = p; loadList(); },
    openNew() { forms.openOportunidad(user, null, loadList).catch((e) => ui.toast(e.message, true)); },
    goDetail(id) { window.location.href = 'oportunidad-detalle.html?id=' + encodeURIComponent(id); },
    onDragStart(e, id) {
      state.dragId = id;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', id);
    },
    onDragOver(e, etapaId) {
      e.preventDefault();
      const el = document.getElementById('drop-' + etapaId);
      if (el) el.classList.add('drag-over');
    },
    onDragLeave(etapaId) {
      const el = document.getElementById('drop-' + etapaId);
      if (el) el.classList.remove('drag-over');
    },
    onDrop(e, etapaId) {
      e.preventDefault();
      this.onDragLeave(etapaId);
      const id = state.dragId || e.dataTransfer.getData('text/plain');
      state.dragId = null;
      const opp = state.items.find((o) => o.id === id);
      if (!opp) return;
      forms.changeStage(user, opp, etapaId, {}, loadList).catch((err) => ui.toast(err.message, true));
    }
  };

  renderShell();
  loadList();
})();
