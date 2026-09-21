(function () {
  const ui = Pulso.ui;
  const db = Pulso.db;
  const constants = Pulso.constants;
  const oppLogic = Pulso.opportunities;
  const user = Pulso.auth.requireAuth();
  if (!user) return;

  const params = new URLSearchParams(window.location.search);
  const oppId = params.get('id');

  function render() {
    const opp = oppId && db.findOportunidad(oppId);
    const app = document.getElementById('app');

    if (!opp) {
      app.innerHTML =
        ui.renderShellStart('oportunidades', user) +
        ui.renderTopbar({ hideSearch: true, actionsHtml: '' }) +
        '<div class="content"><div class="empty-state">No se encontró la oportunidad. <a href="oportunidades.html">Volver al listado</a></div></div>' +
        ui.renderShellEnd();
      return;
    }

    const entidadNombre = ui.entidadNombre(opp.entidadTipo, opp.entidadId);
    const producto = constants.producto(opp.productoId);
    const responsable = db.findUser(opp.responsableId);
    const etapa = constants.etapa(opp.etapaKey);
    const entidadHref = opp.entidadTipo === 'empresa' ? ('empresa-detalle.html?id=' + opp.entidadId) : ('contacto-detalle.html?id=' + opp.entidadId);

    const estadoLabel = opp.estado === 'abierta' ? 'Abierta' : opp.estado === 'ganada' ? 'Ganada' : 'Perdida';

    const etapaOptions = constants.ETAPAS.map((e) => '<option value="' + e.key + '"' + (e.key === opp.etapaKey ? ' selected' : '') + '>' + ui.escapeHtml(e.nombre) + '</option>').join('');

    app.innerHTML =
      ui.renderShellStart('oportunidades', user) +
      ui.renderTopbar({ hideSearch: true, actionsHtml: '<button class="btn-primary" onclick="Pulso.pages.oportunidadDetalle.openEditModal()">Editar</button>' }) +
      '<div class="content flex-col gap-16">' +
        '<div class="breadcrumb"><a href="oportunidades.html">Oportunidades</a> / <span class="current">' + ui.escapeHtml(opp.titulo) + '</span></div>' +
        '<div class="panel" style="flex-direction:row;align-items:center;justify-content:space-between;">' +
          '<div class="flex-col gap-12" style="gap:4px;">' +
            '<span style="font-family:var(--font-display);font-weight:700;font-size:19px;color:var(--ink);">' + ui.escapeHtml(opp.titulo) + '</span>' +
            '<span class="text-faint" style="font-size:13px;"><a href="' + entidadHref + '">' + ui.escapeHtml(entidadNombre) + '</a> · ' + (producto ? ui.escapeHtml(producto.nombre) : '—') + '</span>' +
          '</div>' +
          '<span class="badge ' + ui.estadoOppBadgeClass(opp.estado) + '">' + estadoLabel + '</span>' +
        '</div>' +
        '<div class="flex gap-20" style="align-items:flex-start;flex-wrap:wrap;">' +
          '<div class="panel" style="width:420px;flex:0 0 420px;">' +
            '<span class="panel-title">Datos de la oportunidad</span>' +
            '<div class="kv-row"><span class="k">Empresa / Contacto</span><span class="v"><a href="' + entidadHref + '">' + ui.escapeHtml(entidadNombre) + '</a></span></div>' +
            '<div class="kv-row"><span class="k">Responsable</span><span class="v">' + (responsable ? ui.escapeHtml(responsable.nombre) : '—') + '</span></div>' +
            '<div class="kv-row"><span class="k">Producto / servicio</span><span class="v">' + (producto ? ui.escapeHtml(producto.nombre) : '—') + '</span></div>' +
            '<div class="kv-row"><span class="k">Valor</span><span class="v mono">' + ui.formatMoney(opp.valor) + ' /mes</span></div>' +
            '<div class="kv-row"><span class="k">Etapa actual</span><span class="v">' + (etapa ? ui.escapeHtml(etapa.nombre) : opp.etapaKey) + '</span></div>' +
            '<div class="kv-row"><span class="k">Origen</span><span class="v">' + ui.escapeHtml(opp.origen || '—') + '</span></div>' +
            '<div class="kv-row"><span class="k">Fecha estimada de cierre</span><span class="v">' + ui.formatDate(opp.fechaEstimadaCierre) + '</span></div>' +
            '<div class="kv-row"><span class="k">Fecha real de cierre</span><span class="v">' + ui.formatDate(opp.fechaRealCierre) + '</span></div>' +
            (opp.estado === 'perdida' ? '<div class="kv-row"><span class="k">Motivo de pérdida</span><span class="v">' + ui.escapeHtml(opp.motivoPerdida || '—') + '</span></div>' : '') +
            (opp.observaciones ? '<div class="flex-col" style="gap:5px;padding-top:6px;border-top:1px solid var(--line);"><span class="k">Observaciones</span><span class="v" style="text-align:left;line-height:1.5;">' + ui.escapeHtml(opp.observaciones) + '</span></div>' : '') +
          '</div>' +
          '<div class="panel flex-1" style="min-width:320px;">' +
            '<span class="panel-title">Cambiar etapa</span>' +
            '<p class="text-faint" style="font-size:12px;margin-top:-6px;">El cambio se guarda de inmediato y queda reflejado en el embudo comercial.</p>' +
            '<div class="form-row" style="align-items:flex-end;">' +
              '<div class="form-field"><label>Nueva etapa</label><select id="f-etapa">' + etapaOptions + '</select></div>' +
              '<button class="btn-primary" style="flex:0 0 auto;" onclick="Pulso.pages.oportunidadDetalle.applyStageChange()">Guardar etapa</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      ui.renderShellEnd();
  }

  function applyStageChange() {
    const newKey = document.getElementById('f-etapa').value;
    doMove(newKey);
  }

  function doMove(newKey, opts) {
    const result = oppLogic.move(oppId, newKey, opts);
    if (result.ok) {
      render();
      ui.toast('Etapa actualizada a "' + constants.etapa(newKey).nombre + '". Guardado en la base de datos.');
      return;
    }
    if (result.needsMotivo) {
      ui.openModal(motivoModalHtml(newKey));
      return;
    }
    if (result.needsConfirm) {
      if (confirm('Esta oportunidad está cerrada. ¿Confirmás reabrirla en "' + constants.etapa(newKey).nombre + '"?')) {
        doMove(newKey, { confirmed: true });
      }
    }
  }

  function motivoModalHtml(newKey) {
    const opts = constants.MOTIVOS_PERDIDA.map((m) => '<option value="' + m + '">' + m + '</option>').join('');
    return (
      ui.modalHeader('Marcar oportunidad como perdida') +
      '<p style="font-size:13px;color:var(--ink-soft);">Indicá el motivo de la pérdida para conservarlo en el registro de la oportunidad.</p>' +
      '<div class="form-field"><label>Motivo de pérdida</label><select id="f-motivo">' + opts + '</select></div>' +
      '<div class="modal-actions">' +
        '<button class="btn-ghost" onclick="Pulso.ui.closeModal()">Cancelar</button>' +
        '<button class="btn-primary" onclick="Pulso.pages.oportunidadDetalle.confirmMotivo(\'' + newKey + '\')">Confirmar</button>' +
      '</div>'
    );
  }

  function confirmMotivo(newKey) {
    const motivo = document.getElementById('f-motivo').value;
    ui.closeModal();
    doMove(newKey, { motivo: motivo });
  }

  function editFormHtml() {
    const opp = db.findOportunidad(oppId);
    return (
      ui.modalHeader('Editar oportunidad') +
      '<div class="form-field"><label>Título</label><input type="text" id="f-titulo" value="' + ui.escapeHtml(opp.titulo) + '"></div>' +
      '<div class="form-field"><label>Empresa o contacto</label><select id="f-entidad">' + ui.entidadOptionsHtml(opp.entidadTipo, opp.entidadId) + '</select></div>' +
      '<div class="form-row">' +
        '<div class="form-field"><label>Producto / servicio</label><select id="f-producto" onchange="Pulso.pages.oportunidadDetalle.onProductoChange(this.value)">' + ui.productoOptionsHtml(opp.productoId) + '</select></div>' +
        '<div class="form-field"><label>Responsable</label><select id="f-responsable">' + ui.usuarioOptionsHtml(opp.responsableId) + '</select></div>' +
      '</div>' +
      '<div class="form-row">' +
        '<div class="form-field"><label>Valor (según producto)</label><div class="form-static" id="f-valor-label">' + ui.formatMoney((constants.producto(opp.productoId) || {}).precio) + ' /mes</div></div>' +
        '<div class="form-field"><label>Fecha estimada de cierre</label><input type="date" id="f-fecha" value="' + (opp.fechaEstimadaCierre || '') + '"></div>' +
      '</div>' +
      '<div class="form-field"><label>Origen</label><select id="f-origen">' + ui.origenOptionsHtml(opp.origen) + '</select></div>' +
      '<div class="form-field"><label>Observaciones</label><textarea id="f-obs" rows="2">' + ui.escapeHtml(opp.observaciones || '') + '</textarea></div>' +
      '<div id="f-error" class="form-error hidden"></div>' +
      '<div class="modal-actions">' +
        '<button class="btn-ghost" onclick="Pulso.ui.closeModal()">Cancelar</button>' +
        '<button class="btn-primary" onclick="Pulso.pages.oportunidadDetalle.submitEdit()">Guardar cambios</button>' +
      '</div>'
    );
  }

  function onProductoChange(id) {
    const p = constants.producto(id);
    document.getElementById('f-valor-label').textContent = ui.formatMoney(p ? p.precio : 0) + ' /mes';
  }

  function submitEdit() {
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

    db.updateOportunidad(oppId, {
      titulo: titulo,
      entidadTipo: entidadTipo,
      entidadId: entidadId,
      productoId: productoId,
      valor: producto ? producto.precio : 0,
      responsableId: responsableId,
      fechaEstimadaCierre: fecha || null,
      origen: origen,
      observaciones: obs
    });

    ui.closeModal();
    render();
    ui.toast('Cambios guardados.');
  }

  function openEditModal() {
    ui.openModal(editFormHtml());
  }

  Pulso.pages = Pulso.pages || {};
  Pulso.pages.oportunidadDetalle = { applyStageChange, confirmMotivo, openEditModal, onProductoChange, submitEdit };

  render();
})();
