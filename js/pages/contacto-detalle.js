(async function () {
  const ui = Pulso.ui;
  const forms = Pulso.forms;
  const user = await Pulso.auth.requireAuth();
  if (!user) return;
  const esc = ui.escapeHtml;
  const id = new URLSearchParams(window.location.search).get('id');
  let data = null;

  async function load() {
    try {
      data = await Pulso.api.get('/contactos/' + encodeURIComponent(id));
      render();
    } catch (e) {
      ui.renderPageError('clientes', user, e.message, 'clientes.html#personas', 'Volver al listado');
    }
  }

  function render() {
    const ct = data.contacto;
    const p = data.permisos;
    const nombre = ct.nombre + ' ' + ct.apellido;
    const empresaHtml = !ct.empresa_id
      ? 'Particular'
      : (data.ver_empresa ? '<a href="empresa-detalle.html?id=' + esc(ct.empresa_id) + '">' + esc(ct.empresa_nombre) + '</a>' : esc(ct.empresa_nombre));

    document.getElementById('app').innerHTML =
      ui.renderShellStart('clientes', user) +
      ui.renderTopbar({
        hideSearch: true,
        actionsHtml:
          '<button class="btn-ghost" onclick="Pulso.pages.contactoDetalle.nuevaActividad()">Registrar actividad</button>' +
          '<button class="btn-ghost" onclick="Pulso.pages.contactoDetalle.nuevaOportunidad()">Nueva oportunidad</button>' +
          (p.reasignar ? '<button class="btn-ghost" onclick="Pulso.pages.contactoDetalle.reasignar()">Reasignar</button>' : '') +
          '<button class="btn-ghost" onclick="Pulso.pages.contactoDetalle.baja()">Dar de baja</button>' +
          (p.eliminar ? '<button class="btn-ghost" onclick="Pulso.pages.contactoDetalle.eliminar()">Eliminar</button>' : '') +
          '<button class="btn-primary" onclick="Pulso.pages.contactoDetalle.editar()">Editar</button>'
      }) +
      '<div class="content flex-col gap-16">' +
        '<div class="breadcrumb"><a href="clientes.html#personas">Interesados y socios</a> / Personas / <span class="current">' + esc(nombre) + '</span></div>' +
        '<div class="panel" style="flex-direction:row;align-items:center;justify-content:space-between;">' +
          '<div class="flex items-center gap-16">' +
            '<div class="avatar lg">' + ui.initials(ct.nombre, ct.apellido) + '</div>' +
            '<div class="flex-col" style="gap:3px;">' +
              '<span style="font-family:var(--font-display);font-weight:700;font-size:19px;color:var(--ink);">' + esc(nombre) + '</span>' +
              '<span class="text-faint" style="font-size:13px;">' + esc(ct.empresa_nombre ? 'Vinculado a ' + ct.empresa_nombre : (ct.cargo || 'Cliente individual')) + '</span>' +
            '</div>' +
          '</div>' + ui.estadoBadge(ct.estado) +
        '</div>' +
        '<div class="detail-grid">' +
          '<div class="flex-col gap-16">' +
            '<div class="panel">' +
              '<span class="panel-title">Datos personales</span>' +
              ui.kvText('Documento', ct.dni) +
              ui.kvText('Cargo', ct.cargo) +
              ui.kvText('Correo electrónico', ct.email) +
              ui.kvText('Teléfono', ct.telefono) +
              ui.kv('Empresa relacionada', empresaHtml) +
              ui.kvText('Sede de interés', ct.sede_nombre) +
              ui.kvText('Estado', ui.estadoClienteLabel(ct.estado)) +
              ui.kvText('Responsable comercial', ct.responsable_nombre) +
              ui.kvText('Origen', ct.origen_nombre) +
              ui.observaciones(ct.observaciones) +
            '</div>' +
            '<div class="panel"><span class="panel-title">Registro de cambios</span>' + ui.auditList(data.auditoria) + '</div>' +
          '</div>' +
          '<div class="flex-col gap-16">' +
            '<div class="panel"><span class="panel-title">Oportunidades</span><div class="flex-col gap-12">' + ui.oportunidadesList(data.oportunidades, 'Todavía no hay oportunidades vinculadas a esta persona.') + '</div></div>' +
            '<div class="panel"><span class="panel-title">Historial de actividades</span>' + ui.activityTimeline(data.actividades, { showClient: false }) + '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      ui.renderShellEnd();
  }

  const fail = (e) => ui.toast(e.message, true);

  Pulso.pages.contactoDetalle = {
    editar() { forms.openContacto(user, data.contacto, load).catch(fail); },
    nuevaActividad() { forms.openActividad({ contacto_id: id, label: data.contacto.nombre + ' ' + data.contacto.apellido }, load).catch(fail); },
    nuevaOportunidad() {
      const c = data.contacto;
      forms.openOportunidad(user, null, load, { contacto_id: id, contacto_nombre: c.nombre + ' ' + c.apellido, empresa_id: data.ver_empresa ? c.empresa_id : null, sede_id: c.sede_id, origen_id: c.origen_id }).catch(fail);
    },
    reasignar() { forms.openReasignar('contactos', data.contacto, load).catch(fail); },
    baja() { forms.openBaja('contactos', data.contacto, load); },
    eliminar() { forms.openEliminar('contactos', data.contacto, data.contacto.nombre + ' ' + data.contacto.apellido, 'clientes.html#personas'); }
  };

  load();
})();
