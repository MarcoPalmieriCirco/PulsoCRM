(function () {
  const ui = Pulso.ui;
  const db = Pulso.db;
  const constants = Pulso.constants;
  const user = Pulso.auth.requireAuth();
  if (!user) return;

  const params = new URLSearchParams(window.location.search);
  const empId = params.get('id');

  function render() {
    const emp = empId && db.findEmpresa(empId);
    const app = document.getElementById('app');

    if (!emp) {
      app.innerHTML =
        ui.renderShellStart('clientes', user) +
        ui.renderTopbar({ hideSearch: true, actionsHtml: '' }) +
        '<div class="content"><div class="empty-state">No se encontró la empresa. <a href="clientes.html">Volver al listado</a></div></div>' +
        ui.renderShellEnd();
      return;
    }

    const contactos = db.contactosDeEmpresa(emp.id);
    const oportunidades = db.oportunidadesDeEntidad('empresa', emp.id);
    const responsable = db.findUser(emp.responsableId);

    const contactosHtml = contactos.length
      ? contactos.map((c) => (
          '<div class="panel" style="flex-direction:row;align-items:center;justify-content:space-between;padding:12px;">' +
            '<div class="flex items-center gap-12"><span class="avatar">' + ui.initials(c.nombre, c.apellido) + '</span>' +
            '<div class="flex-col"><span style="font-size:13px;font-weight:600;color:var(--ink);">' + ui.escapeHtml(c.nombre + ' ' + c.apellido) + '</span>' +
            '<span style="font-size:11px;color:var(--ink-faint);">' + ui.escapeHtml(c.cargo || 'Sin cargo especificado') + '</span></div></div>' +
            '<a href="contacto-detalle.html?id=' + c.id + '">Ver contacto</a>' +
          '</div>'
        )).join('')
      : '<div class="empty-state">Todavía no hay contactos vinculados a esta empresa.</div>';

    const oportunidadesHtml = oportunidades.length
      ? oportunidades.map((o) => {
          const etapa = constants.etapa(o.etapaKey);
          const producto = constants.producto(o.productoId);
          const estadoLabel = o.estado === 'abierta' ? (etapa ? etapa.nombre : 'Abierta') : (o.estado === 'ganada' ? 'Ganada' : 'Perdida');
          return (
            '<div class="panel" style="padding:14px;cursor:pointer;" onclick="Pulso.pages.empresaDetalle.goOportunidad(\'' + o.id + '\')">' +
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
      : '<div class="empty-state">Todavía no hay oportunidades vinculadas a esta empresa.</div>';

    app.innerHTML =
      ui.renderShellStart('clientes', user) +
      ui.renderTopbar({ hideSearch: true, actionsHtml: '<button class="btn-primary" onclick="Pulso.pages.empresaDetalle.openEditModal()">Editar</button>' }) +
      '<div class="content flex-col gap-16">' +
        '<div class="breadcrumb"><a href="clientes.html">Clientes</a> / Empresas / <span class="current">' + ui.escapeHtml(emp.nombre) + '</span></div>' +
        '<div class="panel" style="flex-direction:row;align-items:center;justify-content:space-between;">' +
          '<div class="flex items-center gap-16">' +
            '<div class="avatar lg square">' + ui.initials(emp.nombre) + '</div>' +
            '<div class="flex-col" style="gap:3px;">' +
              '<span style="font-family:var(--font-display);font-weight:700;font-size:19px;color:var(--ink);">' + ui.escapeHtml(emp.nombre) + '</span>' +
              '<span class="text-faint" style="font-size:13px;">' + ui.escapeHtml(emp.industria || 'Sin industria especificada') + (emp.cuit ? ' · CUIT ' + ui.escapeHtml(emp.cuit) : '') + '</span>' +
            '</div>' +
          '</div>' +
          '<span class="badge ' + ui.estadoBadgeClass(emp.estado) + '">' + ui.escapeHtml(emp.estado) + '</span>' +
        '</div>' +
        '<div class="flex gap-20" style="align-items:flex-start;flex-wrap:wrap;">' +
          '<div class="flex-col gap-16" style="width:420px;flex:0 0 420px;">' +
            '<div class="panel">' +
              '<span class="panel-title">Datos de la empresa</span>' +
              '<div class="kv-row"><span class="k">Razón social</span><span class="v">' + ui.escapeHtml(emp.nombre) + '</span></div>' +
              '<div class="kv-row"><span class="k">CUIT</span><span class="v mono">' + ui.escapeHtml(emp.cuit || '—') + '</span></div>' +
              '<div class="kv-row"><span class="k">Industria</span><span class="v">' + ui.escapeHtml(emp.industria || '—') + '</span></div>' +
              '<div class="kv-row"><span class="k">Email</span><span class="v">' + ui.escapeHtml(emp.email || '—') + '</span></div>' +
              '<div class="kv-row"><span class="k">Teléfono</span><span class="v mono">' + ui.escapeHtml(emp.telefono || '—') + '</span></div>' +
              '<div class="kv-row"><span class="k">Dirección</span><span class="v">' + ui.escapeHtml(emp.direccion || '—') + '</span></div>' +
              '<div class="kv-row"><span class="k">Sitio web</span><span class="v">' + ui.escapeHtml(emp.sitioWeb || '—') + '</span></div>' +
              '<div class="kv-row"><span class="k">Responsable comercial</span><span class="v">' + ui.escapeHtml(responsable ? responsable.nombre : '—') + '</span></div>' +
              '<div class="kv-row"><span class="k">Origen</span><span class="v">' + ui.escapeHtml(emp.origen || '—') + '</span></div>' +
              (emp.observaciones ? '<div class="flex-col" style="gap:5px;padding-top:6px;border-top:1px solid var(--line);"><span class="k">Observaciones</span><span class="v" style="text-align:left;line-height:1.5;">' + ui.escapeHtml(emp.observaciones) + '</span></div>' : '') +
            '</div>' +
            '<div class="panel">' +
              '<span class="panel-title">Contactos vinculados</span>' +
              '<div class="flex-col gap-8">' + contactosHtml + '</div>' +
            '</div>' +
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
    const emp = db.findEmpresa(empId);
    return (
      ui.modalHeader('Editar empresa') +
      '<div class="form-field"><label>Razón social o nombre comercial</label><input type="text" id="f-nombre" value="' + ui.escapeHtml(emp.nombre) + '"></div>' +
      '<div class="form-row">' +
        '<div class="form-field"><label>CUIT</label><input type="text" id="f-cuit" value="' + ui.escapeHtml(emp.cuit || '') + '"></div>' +
        '<div class="form-field"><label>Industria o actividad</label><input type="text" id="f-industria" value="' + ui.escapeHtml(emp.industria || '') + '"></div>' +
      '</div>' +
      '<div class="form-row">' +
        '<div class="form-field"><label>Correo electrónico</label><input type="text" id="f-email" value="' + ui.escapeHtml(emp.email || '') + '"></div>' +
        '<div class="form-field"><label>Teléfono</label><input type="text" id="f-telefono" value="' + ui.escapeHtml(emp.telefono || '') + '"></div>' +
      '</div>' +
      '<div class="form-field"><label>Dirección</label><input type="text" id="f-direccion" value="' + ui.escapeHtml(emp.direccion || '') + '"></div>' +
      '<div class="form-row">' +
        '<div class="form-field"><label>Sitio web</label><input type="text" id="f-sitioweb" value="' + ui.escapeHtml(emp.sitioWeb || '') + '"></div>' +
        '<div class="form-field"><label>Estado</label><select id="f-estado">' + ui.estadoClienteOptionsHtml(emp.estado) + '</select></div>' +
      '</div>' +
      '<div class="form-row">' +
        '<div class="form-field"><label>Responsable comercial</label><select id="f-responsable">' + ui.usuarioOptionsHtml(emp.responsableId) + '</select></div>' +
        '<div class="form-field"><label>Origen</label><select id="f-origen">' + ui.origenOptionsHtml(emp.origen) + '</select></div>' +
      '</div>' +
      '<div class="form-field"><label>Observaciones</label><textarea id="f-obs" rows="2">' + ui.escapeHtml(emp.observaciones || '') + '</textarea></div>' +
      '<div id="f-error" class="form-error hidden"></div>' +
      '<div class="modal-actions">' +
        '<button class="btn-ghost" onclick="Pulso.ui.closeModal()">Cancelar</button>' +
        '<button class="btn-primary" onclick="Pulso.pages.empresaDetalle.submitEdit()">Guardar cambios</button>' +
      '</div>'
    );
  }

  function submitEdit() {
    const nombre = document.getElementById('f-nombre').value.trim();
    const errEl = document.getElementById('f-error');
    if (!nombre) {
      errEl.textContent = 'La razón social es obligatoria.';
      errEl.classList.remove('hidden');
      return;
    }
    db.updateEmpresa(empId, {
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
    render();
    ui.toast('Cambios guardados.');
  }

  Pulso.pages = Pulso.pages || {};
  Pulso.pages.empresaDetalle = {
    openEditModal: function () { ui.openModal(editFormHtml()); },
    submitEdit,
    goOportunidad: function (id) { window.location.href = 'oportunidad-detalle.html?id=' + encodeURIComponent(id); }
  };

  render();
})();
