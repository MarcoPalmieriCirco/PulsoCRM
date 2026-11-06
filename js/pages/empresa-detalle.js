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
      data = await Pulso.api.get('/empresas/' + encodeURIComponent(id));
      render();
    } catch (e) {
      ui.renderPageError('clientes', user, e.message, 'clientes.html', 'Volver al listado');
    }
  }

  function render() {
    const emp = data.empresa;
    const p = data.permisos;
    const contactosHtml = data.contactos.length
      ? data.contactos.map((c) => (
          '<div class="panel" style="flex-direction:row;align-items:center;justify-content:space-between;padding:12px;">' +
            '<div class="flex items-center gap-12"><span class="avatar">' + ui.initials(c.nombre, c.apellido) + '</span>' +
            '<div class="flex-col"><span style="font-size:13px;font-weight:600;color:var(--ink);">' + esc(c.nombre + ' ' + c.apellido) + '</span>' +
            '<span style="font-size:11px;color:var(--ink-faint);">' + esc(c.cargo || 'Sin cargo especificado') + '</span></div></div>' +
            '<a href="contacto-detalle.html?id=' + esc(c.id) + '">Ver ficha</a>' +
          '</div>'
        )).join('')
      : '<div class="empty-state">Todavía no hay personas vinculadas a esta empresa.</div>';

    document.getElementById('app').innerHTML =
      ui.renderShellStart('clientes', user) +
      ui.renderTopbar({
        hideSearch: true,
        actionsHtml:
          '<button class="btn-ghost" onclick="Pulso.pages.empresaDetalle.nuevaActividad()">Registrar actividad</button>' +
          '<button class="btn-ghost" onclick="Pulso.pages.empresaDetalle.nuevaOportunidad()">Nueva oportunidad</button>' +
          (p.reasignar ? '<button class="btn-ghost" onclick="Pulso.pages.empresaDetalle.reasignar()">Reasignar</button>' : '') +
          '<button class="btn-ghost" onclick="Pulso.pages.empresaDetalle.baja()">Dar de baja</button>' +
          (p.eliminar ? '<button class="btn-ghost" onclick="Pulso.pages.empresaDetalle.eliminar()">Eliminar</button>' : '') +
          '<button class="btn-primary" onclick="Pulso.pages.empresaDetalle.editar()">Editar</button>'
      }) +
      '<div class="content flex-col gap-16">' +
        '<div class="breadcrumb"><a href="clientes.html">Interesados y socios</a> / Empresas / <span class="current">' + esc(emp.nombre) + '</span></div>' +
        '<div class="panel" style="flex-direction:row;align-items:center;justify-content:space-between;">' +
          '<div class="flex items-center gap-16">' +
            '<div class="avatar lg square">' + ui.initials(emp.nombre) + '</div>' +
            '<div class="flex-col" style="gap:3px;">' +
              '<span style="font-family:var(--font-display);font-weight:700;font-size:19px;color:var(--ink);">' + esc(emp.nombre) + '</span>' +
              '<span class="text-faint" style="font-size:13px;">' + esc(emp.industria || 'Sin actividad especificada') + (emp.cuit ? ' · CUIT ' + esc(emp.cuit) : '') + '</span>' +
            '</div>' +
          '</div>' + ui.estadoBadge(emp.estado) +
        '</div>' +
        '<div class="detail-grid">' +
          '<div class="flex-col gap-16">' +
            '<div class="panel">' +
              '<span class="panel-title">Datos de la empresa</span>' +
              ui.kvText('Razón social', emp.nombre) +
              ui.kvText('CUIT', emp.cuit) +
              ui.kvText('Actividad', emp.industria) +
              ui.kvText('Correo electrónico', emp.email) +
              ui.kvText('Teléfono', emp.telefono) +
              ui.kvText('Dirección', emp.direccion) +
              ui.kvText('Sitio web', emp.sitio_web) +
              ui.kvText('Estado', ui.estadoClienteLabel(emp.estado)) +
              ui.kvText('Responsable comercial', emp.responsable_nombre) +
              ui.kvText('Origen', emp.origen_nombre) +
              ui.observaciones(emp.observaciones) +
            '</div>' +
            '<div class="panel"><span class="panel-title">Personas vinculadas</span><div class="flex-col gap-8">' + contactosHtml + '</div></div>' +
            '<div class="panel"><span class="panel-title">Registro de cambios</span>' + ui.auditList(data.auditoria) + '</div>' +
          '</div>' +
          '<div class="flex-col gap-16">' +
            '<div class="panel"><span class="panel-title">Oportunidades</span><div class="flex-col gap-12">' + ui.oportunidadesList(data.oportunidades, 'Todavía no hay oportunidades vinculadas a esta empresa.') + '</div></div>' +
            '<div class="panel"><span class="panel-title">Historial de actividades</span>' + ui.activityTimeline(data.actividades, { showClient: false }) + '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      ui.renderShellEnd();
  }

  const fail = (e) => ui.toast(e.message, true);

  Pulso.pages.empresaDetalle = {
    editar() { forms.openEmpresa(user, data.empresa, load).catch(fail); },
    nuevaActividad() { forms.openActividad({ empresa_id: id, label: data.empresa.nombre }, load).catch(fail); },
    nuevaOportunidad() { forms.openOportunidad(user, null, load, { empresa_id: id, empresa_nombre: data.empresa.nombre, origen_id: data.empresa.origen_id }).catch(fail); },
    reasignar() { forms.openReasignar('empresas', data.empresa, load).catch(fail); },
    baja() { forms.openBaja('empresas', data.empresa, load); },
    eliminar() { forms.openEliminar('empresas', data.empresa, data.empresa.nombre, 'clientes.html'); }
  };

  load();
})();
