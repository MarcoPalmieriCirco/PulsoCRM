// Gestión de usuarios: solo administrador (el servidor también lo exige).
(async function () {
  const ui = Pulso.ui;
  const api = Pulso.api;
  const user = await Pulso.auth.requireAuth();
  if (!user) return;
  const esc = ui.escapeHtml;

  if (!Pulso.auth.isAdmin(user)) {
    ui.renderPageError('usuarios', user, 'Solo el administrador puede gestionar usuarios.', 'inicio.html', 'Volver a Inicio');
    return;
  }

  const state = { search: '', rol: '', activo: '', page: 1, items: [] };
  let reqId = 0;
  const COLS = '1.3fr 1.6fr 1.2fr 0.7fr 0.6fr';
  const ROLES = Object.keys(ui.ROL_LABEL).map((k) => ({ value: k, label: ui.ROL_LABEL[k] }));

  function renderShell() {
    document.getElementById('app').innerHTML =
      ui.renderShellStart('usuarios', user) +
      ui.renderTopbar({
        searchPlaceholder: 'Buscar por nombre o email…',
        searchValue: state.search,
        onSearch: 'Pulso.pages.usuarios.setSearch(this.value)',
        actionsHtml: '<button class="btn-primary" onclick="Pulso.pages.usuarios.nuevo()">' + ui.ICONS.plus + ' Nuevo usuario</button>'
      }) +
      '<div class="subbar"><div class="flex items-center gap-12" style="flex-wrap:wrap;">' +
        ui.filterChip('Rol', state.rol, ROLES, 'Pulso.pages.usuarios.setFilter(\'rol\', this.value)') +
        ui.filterChip('Estado', state.activo, [{ value: '1', label: 'Activos' }, { value: '0', label: 'Inactivos' }], 'Pulso.pages.usuarios.setFilter(\'activo\', this.value)') +
      '</div><span class="subbar-count" id="list-count"></span></div>' +
      '<div class="content flex-col gap-12" id="list-region">' + ui.renderLoading() + '</div>' +
      ui.renderShellEnd();
  }

  async function load() {
    const id = ++reqId;
    try {
      const r = await api.get('/usuarios', { q: state.search, rol: state.rol, activo: state.activo, page: state.page });
      if (id !== reqId) return;
      state.items = r.items;
      const rows = r.items.map((u) => (
        '<div class="row" style="grid-template-columns:' + COLS + ';" onclick="Pulso.pages.usuarios.editar(\'' + esc(u.id) + '\')">' +
          '<span class="cell" style="font-weight:600;color:var(--ink);">' + esc(u.nombre) + '</span>' +
          '<span class="cell">' + esc(u.email) + '</span>' +
          '<span class="cell">' + esc(ui.ROL_LABEL[u.rol]) + '</span>' +
          '<span class="cell"><span class="badge ' + (u.activo ? 'badge-abierta' : 'badge-no-contactar') + '">' + (u.activo ? 'Activo' : 'Inactivo') + '</span></span>' +
          '<span class="cell"><a href="#" onclick="return false;">Editar</a></span>' +
        '</div>'
      )).join('');
      document.getElementById('list-region').innerHTML = r.total
        ? '<div class="data-table"><div class="thead-row" style="grid-template-columns:' + COLS + ';"><span>Nombre</span><span>Email</span><span>Rol</span><span>Estado</span><span></span></div>' + rows + '</div>' +
          ui.pagination(r, 'Pulso.pages.usuarios.setPage', 'usuarios')
        : '<div class="empty-state">No hay usuarios que coincidan con la búsqueda.</div>';
      document.getElementById('list-count').textContent = r.total + ' usuarios';
    } catch (e) {
      if (id === reqId) document.getElementById('list-region').innerHTML = '<div class="empty-state">' + esc(e.message) + '</div>';
    }
  }

  function form(u) {
    const r = u || {};
    const rolOptions = ROLES.map((o) => '<option value="' + o.value + '"' + (o.value === (r.rol || 'vendedor') ? ' selected' : '') + '>' + o.label + '</option>').join('');
    ui.formModal(
      u ? 'Editar usuario' : 'Nuevo usuario',
      ui.field('Nombre', ui.input('f-nombre', r.nombre, 'type="text"')) +
      ui.field('Email', ui.input('f-email', r.email, 'type="email" autocomplete="off"')) +
      '<div class="form-row">' +
        ui.field('Rol', '<select id="f-rol">' + rolOptions + '</select>') +
        (u ? ui.field('Estado', '<select id="f-activo"><option value="1"' + (r.activo ? ' selected' : '') + '>Activo</option><option value="0"' + (r.activo ? '' : ' selected') + '>Inactivo</option></select>') : '') +
      '</div>' +
      ui.field(u ? 'Nueva contraseña' : 'Contraseña', '<input id="f-password" type="password" autocomplete="new-password">', u ? 'dejar vacío para no cambiarla' : 'mínimo 8 caracteres'),
      u ? 'Guardar cambios' : 'Crear usuario',
      async () => {
        const body = { nombre: ui.val('f-nombre'), email: ui.val('f-email'), rol: ui.val('f-rol'), password: document.getElementById('f-password').value };
        if (u) {
          body.activo = ui.val('f-activo') === '1';
          await api.put('/usuarios/' + u.id, body);
        } else {
          await api.post('/usuarios', body);
        }
        ui.closeModal();
        ui.toast(u ? 'Usuario actualizado.' : 'Usuario creado.');
        load();
      }
    );
  }

  Pulso.pages.usuarios = {
    setSearch: ui.debounce((v) => { state.search = v; state.page = 1; load(); }),
    setFilter(k, v) { state[k] = v; state.page = 1; renderShell(); load(); },
    setPage(p) { state.page = p; load(); },
    nuevo() { form(null); },
    editar(id) { form(state.items.find((u) => u.id === id)); }
  };

  renderShell();
  load();
})();
