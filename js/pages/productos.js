// Planes del gimnasio: todos los consultan, solo el administrador los gestiona.
(async function () {
  const ui = Pulso.ui;
  const api = Pulso.api;
  const user = await Pulso.auth.requireAuth();
  if (!user) return;
  const esc = ui.escapeHtml;
  const isAdmin = Pulso.auth.isAdmin(user);

  const ICONS = [
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 7v10M18 7v10M2 10v4M22 10v4M6 12h12"></path></svg>',
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2c3 4 6 7 6 11a6 6 0 01-12 0c0-1.5.5-2.7 1.3-3.8.2 1.4 1 2 1.7 1.3C8.5 8 9 5 12 2z"></path></svg>',
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4h8v5a4 4 0 01-8 0V4z"></path><path d="M8 4H4v2a4 4 0 004 4"></path><path d="M16 4h4v2a4 4 0 01-4 4"></path><path d="M12 13v4"></path><path d="M9 21h6"></path></svg>'
  ];
  const DURACIONES = ['Mensual', 'Trimestral', 'Semestral', 'Anual'];
  const UNIDAD = { Mensual: '/mes', Trimestral: '/trimestre', Semestral: '/semestre', Anual: '/año' };

  const state = { search: '', activo: '', page: 1, items: [] };
  let reqId = 0;

  function card(p, i) {
    const clases = p.clases_semanales ? p.clases_semanales + ' clases por semana' : 'Sin clases grupales';
    const acciones = isAdmin
      ? '<div class="flex gap-8" style="flex-wrap:wrap;">' +
          '<button class="btn-ghost btn-small" onclick="Pulso.pages.productos.editar(\'' + esc(p.id) + '\')">Editar</button>' +
          '<button class="btn-ghost btn-small" onclick="Pulso.pages.productos.toggle(\'' + esc(p.id) + '\')">' + (p.activo ? 'Desactivar' : 'Activar') + '</button>' +
          '<button class="btn-ghost btn-small" onclick="Pulso.pages.productos.eliminar(\'' + esc(p.id) + '\')">Eliminar</button>' +
        '</div>'
      : '';
    return (
      '<div class="product-card' + (p.activo ? '' : ' is-inactive') + '">' +
        '<div class="flex items-center justify-between"><div class="product-icon">' + ICONS[i % ICONS.length] + '</div>' + (p.activo ? '' : '<span class="badge badge-inactivo">Inactivo</span>') + '</div>' +
        '<div class="flex-col" style="gap:6px;">' +
          '<span style="font-family:var(--font-display);font-weight:700;font-size:17px;color:var(--ink);">' + esc(p.nombre) + '</span>' +
          '<span style="font-size:13px;color:var(--ink-soft);line-height:1.5;">' + esc(p.descripcion || '') + '</span>' +
          '<span class="text-faint" style="font-size:12px;">' + esc(p.duracion) + ' · ' + esc(clases) + '</span>' +
        '</div>' +
        '<span class="product-price">' + esc(ui.formatMoney(p.precio)) + '<span class="unit"> ' + esc(UNIDAD[p.duracion] || '') + '</span></span>' +
        acciones +
      '</div>'
    );
  }

  function renderShell() {
    document.getElementById('app').innerHTML =
      ui.renderShellStart('productos', user) +
      ui.renderTopbar({
        searchPlaceholder: 'Buscar planes…',
        searchValue: state.search,
        onSearch: 'Pulso.pages.productos.setSearch(this.value)',
        actionsHtml: isAdmin ? '<button class="btn-primary" onclick="Pulso.pages.productos.nuevo()">' + ui.ICONS.plus + ' Nuevo plan</button>' : ''
      }) +
      '<div class="subbar"><div class="flex items-center gap-12"><span style="font-size:13px;font-weight:600;color:var(--ink);">Planes del gimnasio</span>' +
        ui.filterChip('Estado', state.activo, [{ value: '1', label: 'Activos' }, { value: '0', label: 'Inactivos' }], 'Pulso.pages.productos.setActivo(this.value)') +
      '</div><span class="subbar-count" id="list-count"></span></div>' +
      '<div class="content flex-col gap-16" id="list-region">' + ui.renderLoading() + '</div>' +
      ui.renderShellEnd();
  }

  async function load() {
    const id = ++reqId;
    try {
      const r = await api.get('/planes', { q: state.search, activo: state.activo, page: state.page });
      if (id !== reqId) return;
      state.items = r.items;
      document.getElementById('list-region').innerHTML = r.total
        ? '<div class="product-grid">' + r.items.map(card).join('') + '</div>' + ui.pagination(r, 'Pulso.pages.productos.setPage', 'planes')
        : '<div class="empty-state">No hay planes que coincidan con la búsqueda.</div>';
      document.getElementById('list-count').textContent = r.total + ' planes';
    } catch (e) {
      if (id === reqId) document.getElementById('list-region').innerHTML = '<div class="empty-state">' + esc(e.message) + '</div>';
    }
  }

  function form(plan) {
    const p = plan || {};
    const body = () => ({
      nombre: ui.val('f-nombre'), descripcion: ui.val('f-desc'), duracion: ui.val('f-duracion'),
      clases_semanales: ui.val('f-clases'), precio: ui.val('f-precio'), activo: plan ? plan.activo : 1
    });
    ui.formModal(
      plan ? 'Editar plan' : 'Nuevo plan',
      ui.field('Nombre', ui.input('f-nombre', p.nombre, 'type="text" placeholder="Ej: Pase Yoga"')) +
      ui.field('Descripción', ui.textarea('f-desc', p.descripcion, 'Qué incluye')) +
      '<div class="form-row">' +
        ui.field('Duración', '<select id="f-duracion">' + DURACIONES.map((d) => '<option' + (d === (p.duracion || 'Mensual') ? ' selected' : '') + '>' + d + '</option>').join('') + '</select>') +
        ui.field('Clases por semana', ui.input('f-clases', p.clases_semanales || 0, 'type="number" min="0" max="14"')) +
      '</div>' +
      ui.field('Precio', ui.input('f-precio', p.precio, 'type="number" min="0" step="any"')),
      plan ? 'Guardar cambios' : 'Crear plan',
      async () => {
        if (plan) await api.put('/planes/' + plan.id, body());
        else await api.post('/planes', body());
        ui.closeModal();
        ui.toast(plan ? 'Plan actualizado.' : 'Plan creado.');
        Pulso.forms.catalogos(true).catch(() => {});
        load();
      }
    );
  }

  const find = (id) => state.items.find((p) => p.id === id);

  Pulso.pages.productos = {
    setSearch: ui.debounce((v) => { state.search = v; state.page = 1; load(); }),
    setActivo(v) { state.activo = v; state.page = 1; renderShell(); load(); },
    setPage(p) { state.page = p; load(); },
    nuevo() { form(null); },
    editar(id) { form(find(id)); },
    async toggle(id) {
      const p = find(id);
      try {
        await api.put('/planes/' + id, Object.assign({}, p, { activo: p.activo ? 0 : 1 }));
        ui.toast(p.activo ? 'Plan desactivado: ya no se ofrece en nuevas oportunidades.' : 'Plan activado.');
        load();
      } catch (e) {
        ui.toast(e.message, true);
      }
    },
    eliminar(id) {
      const p = find(id);
      ui.confirmModal('Eliminar plan', '¿Eliminar "' + p.nombre + '"? Si aparece en oportunidades hay que desactivarlo.', 'Eliminar', async () => {
        await api.del('/planes/' + id);
        ui.closeModal();
        ui.toast('Plan eliminado.');
        load();
      });
    }
  };

  renderShell();
  load();
})();
