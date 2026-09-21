(function () {
  const ui = Pulso.ui;
  const db = Pulso.db;
  const constants = Pulso.constants;
  const user = Pulso.auth.requireAuth();
  if (!user) return;

  const params = new URLSearchParams(window.location.search);
  const ctId = params.get('id');

  function render() {
    const ct = ctId && db.findContacto(ctId);
    const app = document.getElementById('app');

    if (!ct) {
      app.innerHTML =
        ui.renderShellStart('clientes', user) +
        ui.renderTopbar({ hideSearch: true, actionsHtml: '' }) +
        '<div class="content"><div class="empty-state">No se encontró el contacto. <a href="clientes.html">Volver al listado</a></div></div>' +
        ui.renderShellEnd();
      return;
    }

    const empresa = ct.empresaId ? db.findEmpresa(ct.empresaId) : null;
    const oportunidades = db.oportunidadesDeEntidad('contacto', ct.id);
    const responsable = db.findUser(ct.responsableId);

    const oportunidadesHtml = oportunidades.length
      ? oportunidades.map((o) => {
          const etapa = constants.etapa(o.etapaKey);
          const producto = constants.producto(o.productoId);
          const estadoLabel = o.estado === 'abierta' ? (etapa ? etapa.nombre : 'Abierta') : (o.estado === 'ganada' ? 'Ganada' : 'Perdida');
          return (
            '<div class="panel" style="padding:14px;cursor:pointer;" onclick="Pulso.pages.contactoDetalle.goOportunidad(\'' + o.id + '\')">' +
              '<div class="flex items-center justify-between gap-12">' +
                '<span style="font-size:14px;font-weight:600;color:var(--ink);">' + ui.escapeHtml(o.titulo) + '</span>' +
                '<span class="badge ' + ui.estadoOppBadgeClass(o.estado) + '">' + ui.escapeHtml(estadoLabel) + '</span>' +
              '</div>' +
              '<span class="text-faint" style="font-size:12px;">' + (producto ? ui.escapeHtml(producto.nombre) : '') + ' · Responsable: ' + ui.escapeHtml((db.findUser(o.responsableId) || {}).nombre || '—') + '</span>' +
              '<div class="flex items-center justify-between" style="margin-top:4px;">' +
                '<span class="mono" style="font-size:13px;font-weight:600;color:var(--ink);">' + ui.formatMoney(o.valor) + '</span>' +
                '<span class="text-faint" style="font-size:11px;">' + (o.fechaRealCierre ? 'Cierre: ' + ui.formatDate(o.fechaRealCierre) : 'Est.: ' + ui.formatDate(o.fechaEstimadaCierre)) + '</span>' +
              '</div>' +
            '</div>'
          );
        }).join('')
      : '<div class="empty-state">Todavía no hay oportunidades vinculadas a este contacto.</div>';

    app.innerHTML =
      ui.renderShellStart('clientes', user) +
      ui.renderTopbar({ hideSearch: true, actionsHtml: '<button class="btn-primary" onclick="Pulso.pages.contactoDetalle.openEditModal()">Editar</button>' }) +
      '<div class="content flex-col gap-16">' +
        '<div class="breadcrumb"><a href="clientes.html">Clientes</a> / Contactos / <span class="current">' + ui.escapeHtml(ct.nombre + ' ' + ct.apellido) + '</span></div>' +
        '<div class="panel" style="flex-direction:row;align-items:center;justify-content:space-between;">' +
          '<div class="flex items-center gap-16">' +
            '<div class="avatar lg">' + ui.initials(ct.nombre, ct.apellido) + '</div>' +
            '<div class="flex-col" style="gap:3px;">' +
              '<span style="font-family:var(--font-display);font-weight:700;font-size:19px;color:var(--ink);">' + ui.escapeHtml(ct.nombre + ' ' + ct.apellido) + '</span>' +
              '<span class="text-faint" style="font-size:13px;">' + (empresa ? ('Vinculado a ' + ui.escapeHtml(empresa.nombre)) : (ui.escapeHtml(ct.cargo) || 'Sin empresa asociada')) + '</span>' +
            '</div>' +
          '</div>' +
          '<span class="badge ' + ui.estadoBadgeClass(ct.estado) + '">' + ui.escapeHtml(ct.estado) + '</span>' +
        '</div>' +
        '<div class="flex gap-20" style="align-items:flex-start;flex-wrap:wrap;">' +
          '<div class="panel" style="width:420px;flex:0 0 420px;">' +
            '<span class="panel-title">Datos de contacto</span>' +
            '<div class="kv-row"><span class="k">DNI</span><span class="v mono">' + ui.escapeHtml(ct.dni || '—') + '</span></div>' +
            '<div class="kv-row"><span class="k">Cargo</span><span class="v">' + ui.escapeHtml(ct.cargo || '—') + '</span></div>' +
            '<div class="kv-row"><span class="k">Email</span><span class="v">' + ui.escapeHtml(ct.email || '—') + '</span></div>' +
            '<div class="kv-row"><span class="k">Teléfono</span><span class="v mono">' + ui.escapeHtml(ct.telefono || '—') + '</span></div>' +
            '<div class="kv-row"><span class="k">Empresa relacionada</span><span class="v">' + (empresa ? ('<a href="empresa-detalle.html?id=' + empresa.id + '">' + ui.escapeHtml(empresa.nombre) + '</a>') : '—') + '</span></div>' +
            '<div class="kv-row"><span class="k">Responsable</span><span class="v">' + ui.escapeHtml(responsable ? responsable.nombre : '—') + '</span></div>' +
            '<div class="kv-row"><span class="k">Origen</span><span class="v">' + ui.escapeHtml(ct.origen || '—') + '</span></div>' +
            (ct.observaciones ? '<div class="flex-col" style="gap:5px;padding-top:6px;border-top:1px solid var(--line);"><span class="k">Observaciones</span><span class="v" style="text-align:left;line-height:1.5;">' + ui.escapeHtml(ct.observaciones) + '</span></div>' : '') +
          '</div>' +
          '<div class="panel flex-1" style="min-width:320px;">' +
            '<span class="panel-title">Oportunidades vinculadas</span>' +
            '<div class="flex-col gap-12">' + oportunidadesHtml + '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      ui.renderShellEnd();
  }

  function editFormHtml() {
    const ct = db.findContacto(ctId);
    const empresas = db.empresas();
    const empresasOpts = empresas.map((e) => '<option value="' + e.id + '"' + (ct.empresaId === e.id ? ' selected' : '') + '>' + ui.escapeHtml(e.nombre) + '</option>').join('');
    return (
      ui.modalHeader('Editar contacto') +
      '<div class="form-row">' +
        '<div class="form-field"><label>Nombre</label><input type="text" id="f-nombre" value="' + ui.escapeHtml(ct.nombre) + '"></div>' +
        '<div class="form-field"><label>Apellido</label><input type="text" id="f-apellido" value="' + ui.escapeHtml(ct.apellido) + '"></div>' +
      '</div>' +
      '<div class="form-row">' +
        '<div class="form-field"><label>DNI</label><input type="text" id="f-dni" value="' + ui.escapeHtml(ct.dni || '') + '"></div>' +
        '<div class="form-field"><label>Cargo</label><input type="text" id="f-cargo" value="' + ui.escapeHtml(ct.cargo || '') + '"></div>' +
      '</div>' +
      '<div class="form-row">' +
        '<div class="form-field"><label>Correo electrónico</label><input type="text" id="f-email" value="' + ui.escapeHtml(ct.email || '') + '"></div>' +
        '<div class="form-field"><label>Teléfono</label><input type="text" id="f-telefono" value="' + ui.escapeHtml(ct.telefono || '') + '"></div>' +
      '</div>' +
      '<div class="form-row">' +
        '<div class="form-field"><label>Empresa relacionada</label><select id="f-empresa"><option value="">Ninguna (contacto particular)</option>' + empresasOpts + '</select></div>' +
        '<div class="form-field"><label>Responsable</label><select id="f-responsable">' + ui.usuarioOptionsHtml(ct.responsableId) + '</select></div>' +
      '</div>' +
      '<div class="form-row">' +
        '<div class="form-field"><label>Estado</label><select id="f-estado">' + ui.estadoClienteOptionsHtml(ct.estado) + '</select></div>' +
        '<div class="form-field"><label>Origen</label><select id="f-origen">' + ui.origenOptionsHtml(ct.origen) + '</select></div>' +
      '</div>' +
      '<div class="form-field"><label>Observaciones</label><textarea id="f-obs" rows="2">' + ui.escapeHtml(ct.observaciones || '') + '</textarea></div>' +
      '<div id="f-error" class="form-error hidden"></div>' +
      '<div class="modal-actions">' +
        '<button class="btn-ghost" onclick="Pulso.ui.closeModal()">Cancelar</button>' +
        '<button class="btn-primary" onclick="Pulso.pages.contactoDetalle.submitEdit()">Guardar cambios</button>' +
      '</div>'
    );
  }

  function submitEdit() {
    const nombre = document.getElementById('f-nombre').value.trim();
    const apellido = document.getElementById('f-apellido').value.trim();
    const errEl = document.getElementById('f-error');
    if (!nombre || !apellido) {
      errEl.textContent = 'Nombre y apellido son obligatorios.';
      errEl.classList.remove('hidden');
      return;
    }
    db.updateContacto(ctId, {
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
    render();
    ui.toast('Cambios guardados.');
  }

  Pulso.pages = Pulso.pages || {};
  Pulso.pages.contactoDetalle = {
    openEditModal: function () { ui.openModal(editFormHtml()); },
    submitEdit,
    goOportunidad: function (id) { window.location.href = 'oportunidad-detalle.html?id=' + encodeURIComponent(id); }
  };

  render();
})();
