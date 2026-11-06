// Configuración comercial: etapas del embudo, tipos de actividad, orígenes, motivos y sedes.
(async function () {
  const ui = Pulso.ui;
  const api = Pulso.api;
  const forms = Pulso.forms;
  const user = await Pulso.auth.requireAuth();
  if (!user) return;
  const esc = ui.escapeHtml;

  if (!Pulso.auth.isAdmin(user)) {
    ui.renderPageError('configuracion', user, 'Solo el administrador puede modificar la configuración.', 'inicio.html', 'Volver a Inicio');
    return;
  }

  const TABS = [
    { key: 'etapas', label: 'Etapas del embudo' },
    { key: 'tipos_actividad', label: 'Tipos de actividad', campo: 'tipos', singular: 'tipo de actividad' },
    { key: 'origenes', label: 'Orígenes', campo: 'origenes', singular: 'origen' },
    { key: 'motivos_perdida', label: 'Motivos de pérdida', campo: 'motivos', singular: 'motivo de pérdida' },
    { key: 'sedes', label: 'Sedes', campo: 'sedes', singular: 'sede' }
  ];
  const TIPO_LABEL = { abierta: 'Abierta', ganada: 'Ganada', perdida: 'Perdida' };

  const state = { tab: 'etapas', cat: null };
  const tabInfo = () => TABS.find((t) => t.key === state.tab);

  function etapasTable() {
    const etapas = state.cat.etapas;
    const cols = '0.5fr 1.8fr 0.8fr 0.7fr 1.6fr';
    const rows = etapas.map((e, i) => (
      '<div class="row row-static" style="grid-template-columns:' + cols + ';">' +
        '<span class="cell flex gap-8"><button class="icon-btn" title="Subir" ' + (i === 0 ? 'disabled' : '') + ' onclick="Pulso.pages.configuracion.mover(' + i + ',-1)">' + ui.ICONS.up + '</button><button class="icon-btn" title="Bajar" ' + (i === etapas.length - 1 ? 'disabled' : '') + ' onclick="Pulso.pages.configuracion.mover(' + i + ',1)">' + ui.ICONS.down + '</button></span>' +
        '<span class="cell flex items-center gap-8" style="font-weight:600;color:var(--ink);"><span class="dot" style="background:' + esc(e.color) + ';"></span>' + (i + 1) + '. ' + esc(e.nombre) + '</span>' +
        '<span class="cell">' + esc(TIPO_LABEL[e.tipo]) + '</span>' +
        '<span class="cell"><span class="badge ' + (e.activo ? 'badge-abierta' : 'badge-no-contactar') + '">' + (e.activo ? 'Activa' : 'Inactiva') + '</span></span>' +
        '<span class="cell flex gap-8" style="flex-wrap:wrap;">' +
          '<button class="btn-ghost btn-small" onclick="Pulso.pages.configuracion.editarEtapa(\'' + esc(e.id) + '\')">Editar</button>' +
          '<button class="btn-ghost btn-small" onclick="Pulso.pages.configuracion.toggleEtapa(\'' + esc(e.id) + '\')">' + (e.activo ? 'Desactivar' : 'Activar') + '</button>' +
          '<button class="btn-ghost btn-small" onclick="Pulso.pages.configuracion.eliminarEtapa(\'' + esc(e.id) + '\')">Eliminar</button>' +
        '</span>' +
      '</div>'
    )).join('');
    return '<p class="text-faint" style="font-size:12px;margin:0;">El orden define las columnas del tablero. El tipo determina el estado de la oportunidad: las etapas Ganada y Perdida exigen los datos de cierre.</p>' +
      '<div class="data-table"><div class="thead-row" style="grid-template-columns:' + cols + ';"><span>Orden</span><span>Etapa</span><span>Tipo</span><span>Estado</span><span></span></div>' + rows + '</div>';
  }

  function catalogoTable() {
    const info = tabInfo();
    const items = state.cat[info.campo];
    const esSede = state.tab === 'sedes';
    const cols = esSede ? '1.3fr 1.5fr 0.7fr 1.6fr' : '2fr 0.7fr 1.6fr';
    const rows = items.map((it) => (
      '<div class="row row-static" style="grid-template-columns:' + cols + ';">' +
        '<span class="cell" style="font-weight:600;color:var(--ink);">' + esc(it.nombre) + '</span>' +
        (esSede ? '<span class="cell">' + esc(it.direccion || 'Sin dirección') + '</span>' : '') +
        '<span class="cell"><span class="badge ' + (it.activo ? 'badge-abierta' : 'badge-no-contactar') + '">' + (it.activo ? 'Activo' : 'Inactivo') + '</span></span>' +
        '<span class="cell flex gap-8" style="flex-wrap:wrap;">' +
          '<button class="btn-ghost btn-small" onclick="Pulso.pages.configuracion.editarItem(\'' + esc(it.id) + '\')">Editar</button>' +
          '<button class="btn-ghost btn-small" onclick="Pulso.pages.configuracion.toggleItem(\'' + esc(it.id) + '\')">' + (it.activo ? 'Desactivar' : 'Activar') + '</button>' +
          '<button class="btn-ghost btn-small" onclick="Pulso.pages.configuracion.eliminarItem(\'' + esc(it.id) + '\')">Eliminar</button>' +
        '</span>' +
      '</div>'
    )).join('');
    return '<p class="text-faint" style="font-size:12px;margin:0;">Un valor en uso no se elimina: se desactiva y los registros históricos lo conservan.</p>' +
      '<div class="data-table"><div class="thead-row" style="grid-template-columns:' + cols + ';"><span>Nombre</span>' + (esSede ? '<span>Dirección</span>' : '') + '<span>Estado</span><span></span></div>' + rows + '</div>';
  }

  function render() {
    const info = tabInfo();
    document.getElementById('app').innerHTML =
      ui.renderShellStart('configuracion', user) +
      ui.renderTopbar({
        hideSearch: true,
        actionsHtml: '<button class="btn-primary" onclick="Pulso.pages.configuracion.nuevo()">' + ui.ICONS.plus + ' ' + (state.tab === 'etapas' ? 'Nueva etapa' : 'Agregar ' + esc(info.singular)) + '</button>'
      }) +
      '<div class="subbar"><div class="tab-group tab-wrap">' +
        TABS.map((t) => '<button class="tab-btn' + (t.key === state.tab ? ' active' : '') + '" onclick="Pulso.pages.configuracion.setTab(\'' + t.key + '\')">' + esc(t.label) + '</button>').join('') +
      '</div></div>' +
      '<div class="content flex-col gap-12">' + (state.tab === 'etapas' ? etapasTable() : catalogoTable()) + '</div>' +
      ui.renderShellEnd();
  }

  async function reload() {
    state.cat = await forms.catalogos(true);
    render();
  }

  const fail = (e) => ui.toast(e.message, true);
  const findEtapa = (id) => state.cat.etapas.find((e) => e.id === id);
  const findItem = (id) => state.cat[tabInfo().campo].find((x) => x.id === id);

  function etapaForm(e) {
    const r = e || {};
    ui.formModal(
      e ? 'Editar etapa' : 'Nueva etapa',
      ui.field('Nombre', ui.input('f-nombre', r.nombre, 'type="text" placeholder="Ej: Evaluación física"')) +
      '<div class="form-row">' +
        ui.field('Tipo', '<select id="f-tipo">' + Object.keys(TIPO_LABEL).map((t) => '<option value="' + t + '"' + (t === (r.tipo || 'abierta') ? ' selected' : '') + '>' + TIPO_LABEL[t] + '</option>').join('') + '</select>') +
        ui.field('Color', ui.input('f-color', r.color || '#9E9E9E', 'type="color"')) +
      '</div>',
      e ? 'Guardar cambios' : 'Crear etapa',
      async () => {
        const body = { nombre: ui.val('f-nombre'), tipo: ui.val('f-tipo'), color: ui.val('f-color') };
        if (e) await api.put('/etapas/' + e.id, Object.assign(body, { activo: e.activo }));
        else await api.post('/etapas', body);
        ui.closeModal();
        ui.toast('Etapa guardada.');
        await reload();
      }
    );
  }

  function itemForm(it) {
    const info = tabInfo();
    const r = it || {};
    ui.formModal(
      (it ? 'Editar ' : 'Agregar ') + info.singular,
      ui.field('Nombre', ui.input('f-nombre', r.nombre, 'type="text"')) +
      (state.tab === 'sedes' ? ui.field('Dirección', ui.input('f-direccion', r.direccion, 'type="text"')) : ''),
      it ? 'Guardar cambios' : 'Agregar',
      async () => {
        const body = { nombre: ui.val('f-nombre'), direccion: ui.val('f-direccion') };
        if (it) await api.put('/config/' + state.tab + '/' + it.id, Object.assign(body, { activo: it.activo }));
        else await api.post('/config/' + state.tab, body);
        ui.closeModal();
        ui.toast('Guardado.');
        await reload();
      }
    );
  }

  Pulso.pages.configuracion = {
    setTab(t) { state.tab = t; render(); },
    nuevo() { if (state.tab === 'etapas') etapaForm(null); else itemForm(null); },
    editarEtapa(id) { etapaForm(findEtapa(id)); },
    async toggleEtapa(id) {
      const e = findEtapa(id);
      try {
        await api.put('/etapas/' + id, { nombre: e.nombre, tipo: e.tipo, color: e.color, activo: !e.activo });
        ui.toast(e.activo ? 'Etapa desactivada.' : 'Etapa activada.');
        await reload();
      } catch (err) { fail(err); }
    },
    eliminarEtapa(id) {
      const e = findEtapa(id);
      ui.confirmModal('Eliminar etapa', '¿Eliminar "' + e.nombre + '"? Si figura en el historial hay que desactivarla.', 'Eliminar', async () => {
        await api.del('/etapas/' + id);
        ui.closeModal();
        ui.toast('Etapa eliminada.');
        await reload();
      });
    },
    async mover(i, delta) {
      const ids = state.cat.etapas.map((e) => e.id);
      const [id] = ids.splice(i, 1);
      ids.splice(i + delta, 0, id);
      try {
        await api.post('/etapas/orden', { ids: ids });
        await reload();
      } catch (err) { fail(err); }
    },
    editarItem(id) { itemForm(findItem(id)); },
    async toggleItem(id) {
      const it = findItem(id);
      try {
        await api.put('/config/' + state.tab + '/' + id, { nombre: it.nombre, direccion: it.direccion, activo: !it.activo });
        ui.toast(it.activo ? 'Desactivado.' : 'Activado.');
        await reload();
      } catch (err) { fail(err); }
    },
    eliminarItem(id) {
      const it = findItem(id);
      ui.confirmModal('Eliminar', '¿Eliminar "' + it.nombre + '"? Si está en uso hay que desactivarlo.', 'Eliminar', async () => {
        await api.del('/config/' + state.tab + '/' + id);
        ui.closeModal();
        ui.toast('Eliminado.');
        await reload();
      });
    }
  };

  try {
    await reload();
  } catch (e) {
    ui.renderPageError('configuracion', user, e.message);
  }
})();
