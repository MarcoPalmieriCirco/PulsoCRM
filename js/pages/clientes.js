(function () {
  const ui = Pulso.ui;
  const db = Pulso.db;
  const constants = Pulso.constants;
  const user = Pulso.auth.requireAuth();
  if (!user) return;

  const PAGE_SIZE = 5;
  const state = {
    tab: 'empresas', // 'empresas' | 'contactos'
    search: '',
    onlyClientes: false,
    page: 1,
    addingNewResponsable: false
  };

  function getEmpresasFiltered() {
    let list = db.empresas();
    if (state.search) {
      const q = state.search.toLowerCase();
      list = list.filter((e) => (e.nombre + ' ' + e.industria).toLowerCase().indexOf(q) !== -1);
    }
    return list;
  }

  function getContactosFiltered() {
    let list = db.contactos();
    if (state.onlyClientes) list = list.filter((c) => c.estado === 'Cliente');
    if (state.search) {
      const q = state.search.toLowerCase();
      list = list.filter((c) => (c.nombre + ' ' + c.apellido + ' ' + c.dni).toLowerCase().indexOf(q) !== -1);
    }
    return list;
  }

  function paginate(list) {
    const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    const page = Math.min(state.page, totalPages);
    const start = (page - 1) * PAGE_SIZE;
    return { pageItems: list.slice(start, start + PAGE_SIZE), page, totalPages, total: list.length };
  }

  function empresaEmpresaLabel(empresaId) {
    if (!empresaId) return '—';
    const e = db.findEmpresa(empresaId);
    return e ? e.nombre : '—';
  }

  function renderEmpresasTab() {
    const filtered = getEmpresasFiltered();
    const { pageItems, page, totalPages, total } = paginate(filtered);

    if (!total) return { table: '<div class="empty-state">No hay empresas que coincidan con la búsqueda.</div>', total };

    const rows = pageItems.map((e) => (
      '<div class="row" style="grid-template-columns:2fr 1.1fr 1.3fr 1.1fr 0.9fr 1fr 0.7fr;" onclick="Pulso.pages.clientes.goEmpresa(\'' + e.id + '\')">' +
        '<span class="cell" style="font-weight:600;color:var(--ink);">' + ui.escapeHtml(e.nombre) + '</span>' +
        '<span class="cell mono">' + ui.escapeHtml(e.cuit || '—') + '</span>' +
        '<span class="cell">' + ui.escapeHtml(e.industria || '—') + '</span>' +
        '<span class="cell">' + ui.escapeHtml((db.findUser(e.responsableId) || {}).nombre || '—') + '</span>' +
        '<span class="cell"><span class="badge ' + ui.estadoBadgeClass(e.estado) + '">' + ui.escapeHtml(e.estado) + '</span></span>' +
        '<span class="cell text-faint">' + ui.escapeHtml(e.origen || '—') + '</span>' +
        '<span class="cell"><a href="empresa-detalle.html?id=' + e.id + '">Ver ficha</a></span>' +
      '</div>'
    )).join('');

    const table =
      '<div class="data-table">' +
        '<div class="thead-row" style="grid-template-columns:2fr 1.1fr 1.3fr 1.1fr 0.9fr 1fr 0.7fr;">' +
          '<span>Razón social</span><span>CUIT</span><span>Industria</span><span>Responsable comercial</span><span>Estado</span><span>Origen</span><span></span>' +
        '</div>' + rows +
      '</div>' +
      '<div class="pagination"><span class="text-faint" style="font-size:12px;">Mostrando ' + pageItems.length + ' de ' + total + ' empresas</span>' +
      '<div class="flex gap-8"><button class="pg-btn" ' + (page <= 1 ? 'disabled' : 'onclick="Pulso.pages.clientes.setPage(' + (page - 1) + ')"') + '>Anterior</button>' +
      '<button class="pg-btn" ' + (page >= totalPages ? 'disabled' : 'onclick="Pulso.pages.clientes.setPage(' + (page + 1) + ')"') + '>Siguiente</button></div></div>';

    return { table, total };
  }

  function renderContactosTab() {
    const filtered = getContactosFiltered();
    const { pageItems, page, totalPages, total } = paginate(filtered);

    if (!total) return { table: '<div class="empty-state">No hay contactos que coincidan con la búsqueda.</div>', total };

    const rows = pageItems.map((c) => (
      '<div class="row" style="grid-template-columns:1.3fr 0.9fr 1.4fr 1fr 0.9fr 0.9fr 0.8fr 0.6fr;" onclick="Pulso.pages.clientes.goContacto(\'' + c.id + '\')">' +
        '<span class="cell" style="font-weight:600;color:var(--ink);">' + ui.escapeHtml(c.nombre + ' ' + c.apellido) + '</span>' +
        '<span class="cell mono">' + ui.escapeHtml(c.dni || '—') + '</span>' +
        '<span class="cell ' + (c.empresaId ? '' : 'text-faint') + '">' + ui.escapeHtml(empresaEmpresaLabel(c.empresaId)) + '</span>' +
        '<span class="cell mono">' + ui.escapeHtml(c.telefono || '—') + '</span>' +
        '<span class="cell">' + ui.escapeHtml((db.findUser(c.responsableId) || {}).nombre || '—') + '</span>' +
        '<span class="cell text-faint">' + ui.escapeHtml(c.origen || '—') + '</span>' +
        '<span class="cell"><span class="badge ' + ui.estadoBadgeClass(c.estado) + '">' + ui.escapeHtml(c.estado) + '</span></span>' +
        '<span class="cell"><a href="contacto-detalle.html?id=' + c.id + '">Ver ficha</a></span>' +
      '</div>'
    )).join('');

    const table =
      '<div class="data-table">' +
        '<div class="thead-row" style="grid-template-columns:1.3fr 0.9fr 1.4fr 1fr 0.9fr 0.9fr 0.8fr 0.6fr;">' +
          '<span>Nombre</span><span>DNI</span><span>Empresa relacionada</span><span>Teléfono</span><span>Responsable</span><span>Origen</span><span>Estado</span><span></span>' +
        '</div>' + rows +
      '</div>' +
      '<div class="pagination"><span class="text-faint" style="font-size:12px;">Mostrando ' + pageItems.length + ' de ' + total + ' contactos</span>' +
      '<div class="flex gap-8"><button class="pg-btn" ' + (page <= 1 ? 'disabled' : 'onclick="Pulso.pages.clientes.setPage(' + (page - 1) + ')"') + '>Anterior</button>' +
      '<button class="pg-btn" ' + (page >= totalPages ? 'disabled' : 'onclick="Pulso.pages.clientes.setPage(' + (page + 1) + ')"') + '>Siguiente</button></div></div>';

    return { table, total };
  }

  function render() {
    const isEmpresas = state.tab === 'empresas';
    const result = isEmpresas ? renderEmpresasTab() : renderContactosTab();

    const app = document.getElementById('app');
    const focused = document.activeElement;
    const focusInfo = focused && focused.id === 'topbar-search' ? { id: focused.id, start: focused.selectionStart, end: focused.selectionEnd } : null;

    app.innerHTML =
      ui.renderShellStart('clientes', user) +
      ui.renderTopbar({
        searchPlaceholder: 'Buscar empresas o contactos…',
        searchValue: state.search,
        onSearch: 'Pulso.pages.clientes.setSearch(this.value)',
        actionsHtml: '<button class="btn-primary" onclick="Pulso.pages.clientes.openAddModal()">' + ui.ICONS.plus + ' Añadir ' + (isEmpresas ? 'Empresa' : 'Contacto') + '</button>'
      }) +
      '<div class="subbar">' +
        '<div class="flex items-center gap-12" style="flex-wrap:wrap;">' +
          '<div class="tab-group">' +
            '<button class="tab-btn' + (isEmpresas ? ' active' : '') + '" onclick="Pulso.pages.clientes.setTab(\'empresas\')">Empresas</button>' +
            '<button class="tab-btn' + (!isEmpresas ? ' active' : '') + '" onclick="Pulso.pages.clientes.setTab(\'contactos\')">Contactos</button>' +
          '</div>' +
          (!isEmpresas ? '<button class="filter-chip' + (state.onlyClientes ? ' active' : '') + '" onclick="Pulso.pages.clientes.toggleOnlyClientes()">' + ui.ICONS.check + ' Solo clientes</button>' : '') +
        '</div>' +
        '<span class="subbar-count">' + result.total + ' ' + (isEmpresas ? 'empresas' : 'contactos') + '</span>' +
      '</div>' +
      '<div class="content">' + result.table + '</div>' +
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

  // ---------- Modal: añadir empresa ----------
  function empresaFormHtml() {
    return (
      ui.modalHeader('Añadir empresa') +
      '<div class="form-field"><label>Razón social o nombre comercial</label><input type="text" id="f-nombre" placeholder="Ej: Sport Club - Sede Ramos Mejía"></div>' +
      '<div class="form-row">' +
        '<div class="form-field"><label>CUIT</label><input type="text" id="f-cuit" placeholder="Si corresponde"></div>' +
        '<div class="form-field"><label>Industria o actividad</label><input type="text" id="f-industria" placeholder="Ej: Cadena de gimnasios"></div>' +
      '</div>' +
      '<div class="form-row">' +
        '<div class="form-field"><label>Correo electrónico</label><input type="text" id="f-email" placeholder="nombre@empresa.com"></div>' +
        '<div class="form-field"><label>Teléfono</label><input type="text" id="f-telefono" placeholder="+54 11 0000-0000"></div>' +
      '</div>' +
      '<div class="form-field"><label>Dirección</label><input type="text" id="f-direccion" placeholder="Calle, número, localidad"></div>' +
      '<div class="form-row">' +
        '<div class="form-field"><label>Sitio web</label><input type="text" id="f-sitioweb" placeholder="Si corresponde"></div>' +
        '<div class="form-field"><label>Estado</label><select id="f-estado">' + ui.estadoClienteOptionsHtml('Potencial') + '</select></div>' +
      '</div>' +
      '<div class="form-row">' +
        '<div class="form-field"><label>Responsable comercial</label><select id="f-responsable">' + ui.usuarioOptionsHtml(user.id) + '</select></div>' +
        '<div class="form-field"><label>Origen</label><select id="f-origen">' + ui.origenOptionsHtml(constants.ORIGENES[0]) + '</select></div>' +
      '</div>' +
      '<div class="form-field"><label>Observaciones</label><textarea id="f-obs" rows="2" placeholder="Opcional"></textarea></div>' +
      '<div id="f-error" class="form-error hidden"></div>' +
      '<div class="modal-actions">' +
        '<button class="btn-ghost" onclick="Pulso.ui.closeModal()">Cancelar</button>' +
        '<button class="btn-primary" onclick="Pulso.pages.clientes.submitEmpresa()">Crear empresa</button>' +
      '</div>'
    );
  }

  function submitEmpresa() {
    const nombre = document.getElementById('f-nombre').value.trim();
    const errEl = document.getElementById('f-error');
    if (!nombre) {
      errEl.textContent = 'La razón social es obligatoria.';
      errEl.classList.remove('hidden');
      return;
    }
    db.createEmpresa({
      nombre: nombre,
      cuit: document.getElementById('f-cuit').value.trim(),
      industria: document.getElementById('f-industria').value.trim(),
      email: document.getElementById('f-email').value.trim(),
      telefono: document.getElementById('f-telefono').value.trim(),
      direccion: document.getElementById('f-direccion').value.trim(),
      sitioWeb: document.getElementById('f-sitioweb').value.trim(),
      estado: document.getElementById('f-estado').value,
      responsableId: document.getElementById('f-responsable').value,
      origen: document.getElementById('f-origen').value,
      observaciones: document.getElementById('f-obs').value.trim()
    });
    ui.closeModal();
    state.tab = 'empresas';
    state.page = 1;
    render();
    ui.toast('Empresa "' + nombre + '" creada. Guardada en el sistema.');
  }

  // ---------- Modal: añadir contacto ----------
  function contactoFormHtml() {
    const empresas = db.empresas();
    const empresasOpts = empresas.map((e) => '<option value="' + e.id + '">' + ui.escapeHtml(e.nombre) + '</option>').join('');
    return (
      ui.modalHeader('Añadir contacto') +
      '<div class="form-row">' +
        '<div class="form-field"><label>Nombre</label><input type="text" id="f-nombre" placeholder="Ej: Marcos"></div>' +
        '<div class="form-field"><label>Apellido</label><input type="text" id="f-apellido" placeholder="Ej: Ibarra"></div>' +
      '</div>' +
      '<div class="form-row">' +
        '<div class="form-field"><label>DNI</label><input type="text" id="f-dni" placeholder="00.000.000"></div>' +
        '<div class="form-field"><label>Cargo</label><input type="text" id="f-cargo" placeholder="Opcional"></div>' +
      '</div>' +
      '<div class="form-row">' +
        '<div class="form-field"><label>Correo electrónico</label><input type="text" id="f-email" placeholder="nombre@correo.com"></div>' +
        '<div class="form-field"><label>Teléfono</label><input type="text" id="f-telefono" placeholder="+54 11 0000-0000"></div>' +
      '</div>' +
      '<div class="form-row">' +
        '<div class="form-field"><label>Empresa relacionada</label><select id="f-empresa"><option value="">Ninguna (contacto particular)</option>' + empresasOpts + '</select></div>' +
        '<div class="form-field"><label>Responsable</label><select id="f-responsable">' + ui.usuarioOptionsHtml(user.id) + '</select></div>' +
      '</div>' +
      '<div class="form-row">' +
        '<div class="form-field"><label>Estado</label><select id="f-estado">' + ui.estadoClienteOptionsHtml('Potencial') + '</select></div>' +
        '<div class="form-field"><label>Origen</label><select id="f-origen">' + ui.origenOptionsHtml(constants.ORIGENES[0]) + '</select></div>' +
      '</div>' +
      '<div class="form-field"><label>Observaciones</label><textarea id="f-obs" rows="2" placeholder="Notas sobre el contacto…"></textarea></div>' +
      '<div id="f-error" class="form-error hidden"></div>' +
      '<div class="modal-actions">' +
        '<button class="btn-ghost" onclick="Pulso.ui.closeModal()">Cancelar</button>' +
        '<button class="btn-primary" onclick="Pulso.pages.clientes.submitContacto()">Crear contacto</button>' +
      '</div>'
    );
  }

  function submitContacto() {
    const nombre = document.getElementById('f-nombre').value.trim();
    const apellido = document.getElementById('f-apellido').value.trim();
    const errEl = document.getElementById('f-error');
    if (!nombre || !apellido) {
      errEl.textContent = 'Nombre y apellido son obligatorios.';
      errEl.classList.remove('hidden');
      return;
    }
    db.createContacto({
      nombre: nombre,
      apellido: apellido,
      dni: document.getElementById('f-dni').value.trim(),
      cargo: document.getElementById('f-cargo').value.trim(),
      email: document.getElementById('f-email').value.trim(),
      telefono: document.getElementById('f-telefono').value.trim(),
      empresaId: document.getElementById('f-empresa').value || null,
      responsableId: document.getElementById('f-responsable').value,
      estado: document.getElementById('f-estado').value,
      origen: document.getElementById('f-origen').value,
      observaciones: document.getElementById('f-obs').value.trim()
    });
    ui.closeModal();
    state.tab = 'contactos';
    state.page = 1;
    render();
    ui.toast('Contacto "' + nombre + ' ' + apellido + '" creado y guardado en el sistema.');
  }

  function openAddModal() {
    ui.openModal(state.tab === 'empresas' ? empresaFormHtml() : contactoFormHtml());
  }

  Pulso.pages = Pulso.pages || {};
  Pulso.pages.clientes = {
    setTab: function (t) { state.tab = t; state.page = 1; render(); },
    setSearch: function (v) { state.search = v; state.page = 1; render(); },
    toggleOnlyClientes: function () { state.onlyClientes = !state.onlyClientes; state.page = 1; render(); },
    setPage: function (p) { state.page = p; render(); },
    openAddModal, submitEmpresa, submitContacto,
    goEmpresa: function (id) { window.location.href = 'empresa-detalle.html?id=' + encodeURIComponent(id); },
    goContacto: function (id) { window.location.href = 'contacto-detalle.html?id=' + encodeURIComponent(id); }
  };

  render();
})();
