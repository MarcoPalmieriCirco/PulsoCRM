(function () {
  const ui = Pulso.ui;
  const db = Pulso.db;
  const constants = Pulso.constants;
  const oppLogic = Pulso.opportunities;
  const user = Pulso.auth.requireAuth();
  if (!user) return;

  const state = {
    view: 'tablero', // 'tablero' | 'lista'
    search: '',
    filters: { responsable: '', etapa: '', estado: '', origen: '' },
    dragId: null
  };

  function enrich(o) {
    return Object.assign({}, o, {
      entidadNombre: ui.entidadNombre(o.entidadTipo, o.entidadId),
      producto: constants.producto(o.productoId),
      responsable: db.findUser(o.responsableId),
      etapa: constants.etapa(o.etapaKey)
    });
  }

  function matchesFilters(o) {
    const f = state.filters;
    if (f.responsable && o.responsableId !== f.responsable) return false;
    if (f.etapa && o.etapaKey !== f.etapa) return false;
    if (f.estado && o.estado !== f.estado) return false;
    if (f.origen && o.origen !== f.origen) return false;
    if (state.search) {
      const q = state.search.toLowerCase();
      const hay = (o.titulo + ' ' + o.entidadNombre).toLowerCase();
      if (hay.indexOf(q) === -1) return false;
    }
    return true;
  }

  function getFiltered() {
    return db.oportunidades().map(enrich).filter(matchesFilters);
  }

  function filterChip(field, label, options) {
    const current = state.filters[field];
    const opts = ['<option value="">' + label + '</option>'].concat(
      options.map((o) => '<option value="' + o.value + '"' + (current === o.value ? ' selected' : '') + '>' + ui.escapeHtml(o.label) + '</option>')
    ).join('');
    const cls = 'filter-chip' + (current ? ' active' : '');
    return '<div class="' + cls + '"><select onchange="Pulso.pages.oportunidades.setFilter(\'' + field + '\', this.value)">' + opts + '</select></div>';
  }

  function renderFilters() {
    const responsables = db.users().map((u) => ({ value: u.id, label: u.nombre }));
    const etapas = constants.ETAPAS.map((e) => ({ value: e.key, label: e.nombre }));
    const estados = [{ value: 'abierta', label: 'Abierta' }, { value: 'ganada', label: 'Ganada' }, { value: 'perdida', label: 'Perdida' }];
    const origenes = constants.ORIGENES.map((o) => ({ value: o, label: o }));
    return (
      filterChip('responsable', 'Responsable', responsables) +
      filterChip('etapa', 'Etapa', etapas) +
      filterChip('estado', 'Estado', estados) +
      filterChip('origen', 'Origen', origenes)
    );
  }

  function renderBoard(items) {
    const cols = constants.ETAPAS.map((et) => {
      const colItems = items.filter((o) => o.etapaKey === et.key);
      const total = colItems.reduce((sum, o) => sum + (o.valor || 0), 0);
      const cardsHtml = colItems.map((o) => {
        let flag = '';
        if (o.estado === 'ganada') {
          flag = '<div class="opp-card-flag-won">' + ui.ICONS.check + '<span>Ganada · cierre ' + ui.formatDate(o.fechaRealCierre) + '</span></div>';
        } else if (o.estado === 'perdida') {
          flag = '<div class="opp-card-flag-lost"><span>Motivo: ' + ui.escapeHtml(o.motivoPerdida || 'Sin especificar') + '</span></div>';
        }
        return (
          '<div class="opp-card" draggable="true" ondragstart="Pulso.pages.oportunidades.onDragStart(event,\'' + o.id + '\')" onclick="Pulso.pages.oportunidades.goDetail(\'' + o.id + '\')">' +
            '<div class="opp-card-top"><span class="opp-card-title">' + ui.escapeHtml(o.titulo) + '</span><span class="opp-card-tag">' + (o.entidadTipo === 'empresa' ? 'Empresa' : 'Contacto') + '</span></div>' +
            '<span class="opp-card-product">' + ui.escapeHtml(o.entidadNombre) + (o.producto ? ' · ' + ui.escapeHtml(o.producto.nombre) : '') + '</span>' +
            '<div class="opp-card-bottom">' +
              '<div class="opp-card-owner"><span class="avatar">' + (o.responsable ? ui.initials(o.responsable.nombre) : '?') + '</span><span class="opp-card-days">' + ui.escapeHtml(o.responsable ? o.responsable.nombre : '') + '</span></div>' +
              '<span class="opp-card-value">' + ui.formatMoney(o.valor) + '</span>' +
            '</div>' +
            flag +
          '</div>'
        );
      }).join('');

      return (
        '<div class="board-col">' +
          '<div class="board-col-head">' +
            '<div class="board-col-head-row"><span class="dot" style="background:' + et.dot + ';"></span><span style="font-size:13px;font-weight:600;color:var(--ink);">' + ui.escapeHtml(et.nombre) + '</span><span class="board-col-count">' + colItems.length + '</span></div>' +
            '<span class="board-col-total">' + (total > 0 ? ui.formatMoney(total) : '—') + '</span>' +
          '</div>' +
          '<div class="board-drop" id="drop-' + et.key + '" ondragover="Pulso.pages.oportunidades.onDragOver(event,\'' + et.key + '\')" ondragleave="Pulso.pages.oportunidades.onDragLeave(event,\'' + et.key + '\')" ondrop="Pulso.pages.oportunidades.onDrop(event,\'' + et.key + '\')">' + cardsHtml + '</div>' +
        '</div>'
      );
    }).join('');

    return '<div class="board">' + cols + '</div>';
  }

  function renderList(items) {
    if (!items.length) return '<div class="empty-state">No hay oportunidades que coincidan con los filtros.</div>';
    const rows = items.map((o) => (
      '<div class="row" style="grid-template-columns:1.6fr 1.3fr 1fr 1fr 1.2fr 0.9fr 0.8fr;" onclick="Pulso.pages.oportunidades.goDetail(\'' + o.id + '\')">' +
        '<span class="cell" style="font-weight:600;color:var(--ink);">' + ui.escapeHtml(o.titulo) + '</span>' +
        '<span class="cell">' + ui.escapeHtml(o.entidadNombre) + '</span>' +
        '<span class="cell">' + (o.producto ? ui.escapeHtml(o.producto.nombre) : '—') + '</span>' +
        '<span class="cell">' + (o.responsable ? ui.escapeHtml(o.responsable.nombre) : '—') + '</span>' +
        '<span class="cell">' + ui.escapeHtml(o.etapa ? o.etapa.nombre : o.etapaKey) + '</span>' +
        '<span class="cell mono">' + ui.formatMoney(o.valor) + '</span>' +
        '<span class="cell"><span class="badge ' + ui.estadoOppBadgeClass(o.estado) + '">' + (o.estado === 'abierta' ? 'Abierta' : o.estado === 'ganada' ? 'Ganada' : 'Perdida') + '</span></span>' +
      '</div>'
    )).join('');

    return (
      '<div class="data-table">' +
        '<div class="thead-row" style="grid-template-columns:1.6fr 1.3fr 1fr 1fr 1.2fr 0.9fr 0.8fr;">' +
          '<span>Título</span><span>Empresa / Contacto</span><span>Producto</span><span>Responsable</span><span>Etapa</span><span>Valor</span><span>Estado</span>' +
        '</div>' + rows +
      '</div>'
    );
  }

  function render() {
    const items = getFiltered();
    const total = items.reduce((sum, o) => sum + (o.valor || 0), 0);
    const app = document.getElementById('app');
    const focused = document.activeElement;
    const focusInfo = focused && focused.id === 'topbar-search' ? { id: focused.id, start: focused.selectionStart, end: focused.selectionEnd } : null;
    app.innerHTML =
      ui.renderShellStart('oportunidades', user) +
      ui.renderTopbar({
        searchPlaceholder: 'Buscar oportunidades…',
        searchValue: state.search,
        onSearch: 'Pulso.pages.oportunidades.setSearch(this.value)',
        actionsHtml: '<button class="btn-primary" onclick="Pulso.pages.oportunidades.openNewModal()">' + ui.ICONS.plus + ' Nueva oportunidad</button>'
      }) +
      '<div class="subbar">' +
        '<div class="flex items-center gap-12" style="flex-wrap:wrap;">' +
          '<div class="tab-group">' +
            '<button class="tab-btn' + (state.view === 'tablero' ? ' active' : '') + '" onclick="Pulso.pages.oportunidades.setView(\'tablero\')">Tablero</button>' +
            '<button class="tab-btn' + (state.view === 'lista' ? ' active' : '') + '" onclick="Pulso.pages.oportunidades.setView(\'lista\')">Lista</button>' +
          '</div>' +
          renderFilters() +
        '</div>' +
        '<span class="subbar-count">' + items.length + ' oportunidades por ' + ui.formatMoney(total) + '</span>' +
      '</div>' +
      '<div class="content">' + (state.view === 'tablero' ? renderBoard(items) : renderList(items)) + '</div>' +
      ui.renderShellEnd();

    if (focusInfo) {
      const el = document.getElementById(focusInfo.id);
      if (el) {
        el.focus();
        if (typeof el.setSelectionRange === 'function' && focusInfo.start != null) {
          try { el.setSelectionRange(focusInfo.start, focusInfo.end); } catch (e) {}
        }
      }
    }
  }

  // ---------- Modal: nueva oportunidad ----------
  function newOppFormHtml() {
    const productos = constants.PRODUCTOS;
    const defaultProducto = productos[0];
    return (
      ui.modalHeader('Nueva oportunidad') +
      '<div class="form-field"><label>Título</label><input type="text" id="f-titulo" placeholder="Ej: Alta Membresía Anual Musculación"></div>' +
      '<div class="form-field"><label>Empresa o contacto</label><select id="f-entidad">' + ui.entidadOptionsHtml(null, null) + '</select></div>' +
      '<div class="form-row">' +
        '<div class="form-field"><label>Producto / servicio</label><select id="f-producto" onchange="Pulso.pages.oportunidades.onProductoChange(this.value)">' + ui.productoOptionsHtml(defaultProducto.id) + '</select></div>' +
        '<div class="form-field"><label>Responsable</label><select id="f-responsable">' + ui.usuarioOptionsHtml(user.id) + '</select></div>' +
      '</div>' +
      '<div class="form-row">' +
        '<div class="form-field"><label>Valor (según producto)</label><div class="form-static" id="f-valor-label">' + ui.formatMoney(defaultProducto.precio) + ' /mes</div></div>' +
        '<div class="form-field"><label>Fecha estimada de cierre</label><input type="date" id="f-fecha"></div>' +
      '</div>' +
      '<div class="form-field"><label>Origen</label><select id="f-origen">' + ui.origenOptionsHtml(constants.ORIGENES[0]) + '</select></div>' +
      '<div class="form-field"><label>Observaciones</label><textarea id="f-obs" rows="2" placeholder="Opcional"></textarea></div>' +
      '<div id="f-error" class="form-error hidden"></div>' +
      '<div class="modal-actions">' +
        '<button class="btn-ghost" onclick="Pulso.ui.closeModal()">Cancelar</button>' +
        '<button class="btn-primary" onclick="Pulso.pages.oportunidades.submitNew()">Crear oportunidad</button>' +
      '</div>'
    );
  }

  function onProductoChange(id) {
    const p = constants.producto(id);
    document.getElementById('f-valor-label').textContent = ui.formatMoney(p ? p.precio : 0) + ' /mes';
  }

  function submitNew() {
    const titulo = document.getElementById('f-titulo').value.trim();
    const entidadVal = document.getElementById('f-entidad').value;
    const productoId = document.getElementById('f-producto').value;
    const responsableId = document.getElementById('f-responsable').value;
    const fecha = document.getElementById('f-fecha').value;
    const origen = document.getElementById('f-origen').value;
    const obs = document.getElementById('f-obs').value.trim();
    const errEl = document.getElementById('f-error');

    if (!titulo || !entidadVal || !responsableId) {
      errEl.textContent = 'Completá título, empresa o contacto, y responsable.';
      errEl.classList.remove('hidden');
      return;
    }
    const [entidadTipo, entidadId] = entidadVal.split(':');
    const producto = constants.producto(productoId);

    db.createOportunidad({
      titulo: titulo,
      entidadTipo: entidadTipo,
      entidadId: entidadId,
      productoId: productoId,
      valor: producto ? producto.precio : 0,
      responsableId: responsableId,
      etapaKey: constants.ETAPAS[0].key,
      fechaEstimadaCierre: fecha || null,
      fechaRealCierre: null,
      origen: origen,
      estado: 'abierta',
      observaciones: obs,
      motivoPerdida: null
    });

    ui.closeModal();
    render();
    ui.toast('Oportunidad "' + titulo + '" creada en "' + constants.ETAPAS[0].nombre + '".');
  }

  function openNewModal() {
    ui.openModal(newOppFormHtml());
  }

  // ---------- Motivo de pérdida ----------
  function motivoModalHtml(id) {
    const opts = constants.MOTIVOS_PERDIDA.map((m) => '<option value="' + m + '">' + m + '</option>').join('');
    return (
      ui.modalHeader('Marcar oportunidad como perdida') +
      '<p style="font-size:13px;color:var(--ink-soft);">Indicá el motivo de la pérdida para conservarlo en el registro de la oportunidad.</p>' +
      '<div class="form-field"><label>Motivo de pérdida</label><select id="f-motivo">' + opts + '</select></div>' +
      '<div class="modal-actions">' +
        '<button class="btn-ghost" onclick="Pulso.ui.closeModal()">Cancelar</button>' +
        '<button class="btn-primary" onclick="Pulso.pages.oportunidades.confirmMotivo(\'' + id + '\')">Confirmar</button>' +
      '</div>'
    );
  }

  function confirmMotivo(id) {
    const motivo = document.getElementById('f-motivo').value;
    const result = oppLogic.move(id, 'perdida', { motivo: motivo });
    ui.closeModal();
    if (result.ok) {
      render();
      ui.toast('Oportunidad movida a "Perdida". Guardado en la base de datos.');
    }
  }

  // ---------- Drag & drop ----------
  function onDragStart(e, id) {
    state.dragId = id;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  }

  function onDragOver(e, key) {
    e.preventDefault();
    const el = document.getElementById('drop-' + key);
    if (el) el.classList.add('drag-over');
  }

  function onDragLeave(e, key) {
    const el = document.getElementById('drop-' + key);
    if (el) el.classList.remove('drag-over');
  }

  function onDrop(e, newKey) {
    e.preventDefault();
    const el = document.getElementById('drop-' + newKey);
    if (el) el.classList.remove('drag-over');
    const id = state.dragId || e.dataTransfer.getData('text/plain');
    state.dragId = null;
    if (!id) return;
    applyMove(id, newKey);
  }

  function applyMove(id, newKey) {
    const opp = db.findOportunidad(id);
    if (!opp) return;
    const result = oppLogic.move(id, newKey);
    if (result.ok) {
      render();
      ui.toast('Oportunidad movida a "' + constants.etapa(newKey).nombre + '". Guardado en la base de datos.');
      return;
    }
    if (result.needsMotivo) {
      ui.openModal(motivoModalHtml(id));
      return;
    }
    if (result.needsConfirm) {
      if (confirm('Esta oportunidad está cerrada. ¿Confirmás reabrirla en "' + constants.etapa(newKey).nombre + '"?')) {
        const r2 = oppLogic.move(id, newKey, { confirmed: true });
        if (r2.ok) {
          render();
          ui.toast('Oportunidad reabierta en "' + constants.etapa(newKey).nombre + '".');
        }
      }
    }
  }

  function goDetail(id) {
    window.location.href = 'oportunidad-detalle.html?id=' + encodeURIComponent(id);
  }

  Pulso.pages = Pulso.pages || {};
  Pulso.pages.oportunidades = {
    setView: function (v) { state.view = v; render(); },
    setSearch: function (v) { state.search = v; render(); },
    setFilter: function (field, value) { state.filters[field] = value; render(); },
    openNewModal, onProductoChange, submitNew,
    confirmMotivo,
    onDragStart, onDragOver, onDragLeave, onDrop,
    goDetail
  };

  render();
})();
