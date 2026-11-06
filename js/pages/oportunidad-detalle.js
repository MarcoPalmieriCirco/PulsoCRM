(async function () {
  const ui = Pulso.ui;
  const forms = Pulso.forms;
  const user = await Pulso.auth.requireAuth();
  if (!user) return;
  const esc = ui.escapeHtml;
  const id = new URLSearchParams(window.location.search).get('id');
  let data = null;
  let cat = null;

  async function load() {
    try {
      [data, cat] = await Promise.all([Pulso.api.get('/oportunidades/' + encodeURIComponent(id)), forms.catalogos()]);
      render();
    } catch (e) {
      ui.renderPageError('oportunidades', user, e.message, 'oportunidades.html', 'Volver al listado');
    }
  }

  function clienteLink(idCliente, nombre, puedeVer, pagina) {
    if (!idCliente) return null;
    return puedeVer ? '<a href="' + pagina + '?id=' + esc(idCliente) + '">' + esc(nombre) + '</a>' : esc(nombre);
  }

  function render() {
    const o = data.oportunidad;
    const p = data.permisos;
    const empresa = clienteLink(o.empresa_id, o.empresa_nombre, data.ver_empresa, 'empresa-detalle.html');
    const contacto = clienteLink(o.contacto_id, o.contacto_nombre, data.ver_contacto, 'contacto-detalle.html');
    const cerrada = o.estado !== 'abierta';

    const etapas = cat.etapas.filter((e) => e.activo || e.id === o.etapa_id);
    const etapaOptions = etapas.map((e) => '<option value="' + esc(e.id) + '"' + (e.id === o.etapa_id ? ' selected' : '') + '>' + esc(e.nombre) + '</option>').join('');

    const cambioEtapa = p.cambiar_etapa
      ? '<p class="text-faint" style="font-size:12px;margin:-6px 0 0;">' +
          (cerrada ? 'Oportunidad cerrada: el cambio requiere indicar el motivo de la autorización y queda registrado.' : 'Cada cambio queda en el historial. Alta y Perdida piden los datos de cierre.') +
        '</p>' +
        ui.field('Nueva etapa', '<select id="f-etapa">' + etapaOptions + '</select>') +
        ui.field('Observación', ui.textarea('f-observacion', '', 'Opcional')) +
        '<div><button class="btn-primary" onclick="Pulso.pages.oportunidadDetalle.cambiarEtapa()">Guardar etapa</button></div>'
      : '<div class="notice">Esta oportunidad está cerrada. Solo un administrador o responsable comercial puede autorizar cambios.</div>';

    document.getElementById('app').innerHTML =
      ui.renderShellStart('oportunidades', user) +
      ui.renderTopbar({
        hideSearch: true,
        actionsHtml:
          '<button class="btn-ghost" onclick="Pulso.pages.oportunidadDetalle.nuevaActividad()">Registrar actividad</button>' +
          (p.reasignar ? '<button class="btn-ghost" onclick="Pulso.pages.oportunidadDetalle.reasignar()">Reasignar</button>' : '') +
          (p.editar ? '<button class="btn-primary" onclick="Pulso.pages.oportunidadDetalle.editar()">Editar</button>' : '')
      }) +
      '<div class="content flex-col gap-16">' +
        '<div class="breadcrumb"><a href="oportunidades.html">Oportunidades</a> / <span class="current">' + esc(o.titulo) + '</span></div>' +
        '<div class="panel" style="flex-direction:row;align-items:center;justify-content:space-between;">' +
          '<div class="flex-col" style="gap:4px;">' +
            '<span style="font-family:var(--font-display);font-weight:700;font-size:19px;color:var(--ink);">' + esc(o.titulo) + '</span>' +
            '<span class="text-faint" style="font-size:13px;">' + (empresa || contacto) + ' · ' + esc(o.plan_nombre) + ' · ' + esc(o.sede_nombre) + '</span>' +
          '</div>' + ui.estadoOppBadge(o.estado) +
        '</div>' +
        '<div class="detail-grid">' +
          '<div class="flex-col gap-16">' +
            '<div class="panel">' +
              '<span class="panel-title">Datos de la oportunidad</span>' +
              (empresa ? ui.kv('Empresa', empresa) : '') +
              (contacto ? ui.kv('Interesado o socio', contacto) : '') +
              ui.kvText('Responsable comercial', o.responsable_nombre) +
              ui.kvText('Plan', o.plan_nombre) +
              ui.kvText('Sede', o.sede_nombre) +
              ui.kvText('Socios', o.cantidad_socios) +
              ui.kvText('Valor estimado', ui.formatMoney(o.valor_estimado)) +
              (o.estado === 'ganada' ? ui.kvText('Valor final', ui.formatMoney(o.valor_final)) : '') +
              ui.kvText('Etapa actual', o.etapa_nombre) +
              ui.kvText('Estado', ui.estadoOppLabel(o.estado)) +
              ui.kvText('Probabilidad de cierre', o.probabilidad === null ? '' : o.probabilidad + '%') +
              ui.kvText('Origen', o.origen_nombre) +
              ui.kvText('Fecha estimada de cierre', ui.formatDate(o.fecha_estimada_cierre)) +
              ui.kvText('Fecha real de cierre', o.fecha_real_cierre ? ui.formatDate(o.fecha_real_cierre) : '') +
              (o.estado === 'perdida' ? ui.kvText('Motivo de pérdida', o.motivo_nombre) : '') +
              ui.observaciones(o.observaciones) +
            '</div>' +
            '<div class="panel"><span class="panel-title">Registro de cambios</span>' + ui.auditList(data.auditoria) + '</div>' +
          '</div>' +
          '<div class="flex-col gap-16">' +
            '<div class="panel"><span class="panel-title">Cambiar etapa</span>' + cambioEtapa + '</div>' +
            '<div class="panel"><span class="panel-title">Historial de etapas</span>' + ui.stageHistory(data.historial) + '</div>' +
            '<div class="panel"><span class="panel-title">Historial de actividades</span>' + ui.activityTimeline(data.actividades) + '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      ui.renderShellEnd();
  }

  const fail = (e) => ui.toast(e.message, true);

  Pulso.pages.oportunidadDetalle = {
    cambiarEtapa() {
      const etapaId = ui.val('f-etapa');
      if (etapaId === data.oportunidad.etapa_id) {
        ui.toast('La oportunidad ya está en esa etapa.', true);
        return;
      }
      forms.changeStage(user, data.oportunidad, etapaId, { observacion: ui.val('f-observacion') }, load).catch(fail);
    },
    editar() { forms.openOportunidad(user, data.oportunidad, load).catch(fail); },
    reasignar() { forms.openReasignar('oportunidades', data.oportunidad, load).catch(fail); },
    nuevaActividad() { forms.openActividad({ oportunidad_id: id, label: data.oportunidad.titulo }, load).catch(fail); }
  };

  load();
})();
