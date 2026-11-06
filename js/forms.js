// Formularios compartidos entre pantallas. El cambio de etapa vive acá para que el
// tablero, la lista y el detalle apliquen exactamente el mismo flujo.
window.Pulso = window.Pulso || {};

Pulso.pages = Pulso.pages || {};

Pulso.forms = (function () {
  const ui = Pulso.ui;
  const api = Pulso.api;
  const auth = Pulso.auth;

  let catalogosCache = null;
  async function catalogos(force) {
    if (!catalogosCache || force) catalogosCache = await api.get('/catalogos');
    return catalogosCache;
  }

  const responsableField = (user, cat, selected, label) => {
    if (auth.isVendedor(user)) {
      // Al vendedor no se le ofrece asignar: el servidor lo fija como responsable.
      const actual = selected && selected !== user.id ? 'Asignado por supervisión' : user.nombre;
      return ui.field(label || 'Responsable comercial', '<div class="form-static">' + ui.escapeHtml(actual) + '</div>');
    }
    return ui.field(label || 'Responsable comercial', ui.select('f-responsable', cat.responsables, selected || user.id, {
      label: (u) => u.nombre + ' (' + ui.ROL_LABEL[u.rol] + ')'
    }));
  };

  const responsableValue = (user, record) => (auth.isVendedor(user) ? (record ? record.responsable_id : user.id) : ui.val('f-responsable'));

  // ---------- Empresa ----------
  async function openEmpresa(user, record, onSaved) {
    const cat = await catalogos();
    const r = record || {};
    ui.formModal(
      record ? 'Editar empresa' : 'Añadir empresa',
      ui.field('Razón social o nombre comercial', ui.input('f-nombre', r.nombre, 'type="text" placeholder="Ej: Estudio Contable Beltrán"')) +
      '<div class="form-row">' +
        ui.field('CUIT', ui.input('f-cuit', r.cuit, 'type="text" placeholder="30-71234567-9"'), 'si corresponde') +
        ui.field('Industria o actividad', ui.input('f-industria', r.industria, 'type="text" placeholder="Ej: Salud"')) +
      '</div>' +
      '<div class="form-row">' +
        ui.field('Correo electrónico', ui.input('f-email', r.email, 'type="email" placeholder="nombre@empresa.com"')) +
        ui.field('Teléfono', ui.input('f-telefono', r.telefono, 'type="text" placeholder="+54 11 0000-0000"')) +
      '</div>' +
      ui.field('Dirección', ui.input('f-direccion', r.direccion, 'type="text" placeholder="Calle, número, localidad"')) +
      '<div class="form-row">' +
        ui.field('Sitio web', ui.input('f-sitio', r.sitio_web, 'type="text"'), 'si corresponde') +
        ui.field('Estado', '<select id="f-estado">' + ui.estadoOptions(r.estado || 'Potencial') + '</select>') +
      '</div>' +
      '<div class="form-row">' +
        responsableField(user, cat, r.responsable_id) +
        ui.field('Origen', ui.select('f-origen', cat.origenes, r.origen_id, { placeholder: 'Seleccionar…' })) +
      '</div>' +
      ui.field('Observaciones', ui.textarea('f-obs', r.observaciones, 'Opcional')),
      record ? 'Guardar cambios' : 'Crear empresa',
      async () => {
        const body = {
          nombre: ui.val('f-nombre'), cuit: ui.val('f-cuit'), industria: ui.val('f-industria'), email: ui.val('f-email'),
          telefono: ui.val('f-telefono'), direccion: ui.val('f-direccion'), sitio_web: ui.val('f-sitio'), estado: ui.val('f-estado'),
          responsable_id: responsableValue(user, record), origen_id: ui.val('f-origen'), observaciones: ui.val('f-obs')
        };
        const saved = record ? await api.put('/empresas/' + record.id, body) : await api.post('/empresas', body);
        ui.closeModal();
        ui.toast(record ? 'Cambios guardados.' : 'Empresa "' + saved.nombre + '" creada.');
        onSaved(saved);
      }
    );
  }

  // ---------- Persona (interesado o socio) ----------
  async function openContacto(user, record, onSaved, preset) {
    const [cat, opc] = await Promise.all([catalogos(), api.get('/opciones-clientes')]);
    const r = record || preset || {};
    ui.formModal(
      record ? 'Editar persona' : 'Añadir interesado o socio',
      '<div class="form-row">' +
        ui.field('Nombre', ui.input('f-nombre', r.nombre, 'type="text" placeholder="Ej: Marcos"')) +
        ui.field('Apellido', ui.input('f-apellido', r.apellido, 'type="text" placeholder="Ej: Ibarra"')) +
      '</div>' +
      '<div class="form-row">' +
        ui.field('Documento', ui.input('f-dni', r.dni, 'type="text" placeholder="00.000.000"'), 'si corresponde') +
        ui.field('Cargo', ui.input('f-cargo', r.cargo, 'type="text" placeholder="Ej: Interesado particular"')) +
      '</div>' +
      '<div class="form-row">' +
        ui.field('Correo electrónico', ui.input('f-email', r.email, 'type="email" placeholder="nombre@correo.com"')) +
        ui.field('Teléfono', ui.input('f-telefono', r.telefono, 'type="text" placeholder="+54 11 0000-0000"')) +
      '</div>' +
      '<div class="form-row">' +
        ui.field('Empresa relacionada', ui.select('f-empresa', withCurrent(opc.empresas, r.empresa_id, r.empresa_nombre), r.empresa_id, { placeholder: 'Ninguna (cliente individual)' })) +
        ui.field('Sede de interés', ui.select('f-sede', cat.sedes, r.sede_id, { placeholder: 'Sin definir' })) +
      '</div>' +
      '<div class="form-row">' +
        responsableField(user, cat, r.responsable_id) +
        ui.field('Estado', '<select id="f-estado">' + ui.estadoOptions(r.estado || 'Potencial') + '</select>') +
      '</div>' +
      ui.field('Origen', ui.select('f-origen', cat.origenes, r.origen_id, { placeholder: 'Seleccionar…' })) +
      ui.field('Observaciones', ui.textarea('f-obs', r.observaciones, 'Objetivo, horarios preferidos, etc.')),
      record ? 'Guardar cambios' : 'Crear',
      async () => {
        const body = {
          nombre: ui.val('f-nombre'), apellido: ui.val('f-apellido'), dni: ui.val('f-dni'), cargo: ui.val('f-cargo'),
          email: ui.val('f-email'), telefono: ui.val('f-telefono'), empresa_id: ui.val('f-empresa'), sede_id: ui.val('f-sede'),
          responsable_id: responsableValue(user, record), estado: ui.val('f-estado'), origen_id: ui.val('f-origen'), observaciones: ui.val('f-obs')
        };
        const saved = record ? await api.put('/contactos/' + record.id, body) : await api.post('/contactos', body);
        ui.closeModal();
        ui.toast(record ? 'Cambios guardados.' : saved.nombre + ' ' + saved.apellido + ' quedó registrado.');
        onSaved(saved);
      }
    );
  }

  // Un vendedor puede no tener asignado al cliente de su oportunidad: se conserva el vínculo.
  function withCurrent(list, id, nombre) {
    if (!id || list.some((x) => x.id === id)) return list;
    return list.concat([{ id: id, nombre: nombre || 'Asignado a otro responsable' }]);
  }

  const noContactar = (c) => c.estado === 'No contactar';
  const labelCliente = (c) => c.nombre + (c.estado === 'No contactar' ? ' (No contactar)' : '');

  // ---------- Oportunidad ----------
  async function openOportunidad(user, record, onSaved, preset) {
    const [cat, opc] = await Promise.all([catalogos(), api.get('/opciones-clientes')]);
    const r = record || preset || {};
    const cerrada = record && record.estado !== 'abierta';
    const planInicial = cat.planes.find((p) => p.id === r.plan_id);
    const socios = r.cantidad_socios || 1;

    const cierreHtml = !cerrada ? '' : (
      '<div class="notice">Esta oportunidad está cerrada. El cambio queda registrado con tu usuario y el motivo.</div>' +
      ui.field('Motivo de la autorización', ui.textarea('f-autorizacion', '', 'Obligatorio')) +
      '<div class="form-row">' +
        ui.field('Fecha real de cierre', ui.input('f-fecha-real', record.fecha_real_cierre, 'type="date" max="' + ui.todayLocal() + '"')) +
        (record.estado === 'ganada'
          ? ui.field('Valor final', ui.input('f-valor-final', record.valor_final, 'type="number" min="0" step="any"'))
          : ui.field('Motivo de pérdida', ui.select('f-motivo', cat.motivos, record.motivo_perdida_id))) +
      '</div>'
    );

    ui.formModal(
      record ? 'Editar oportunidad' : 'Nueva oportunidad',
      ui.field('Título', ui.input('f-titulo', r.titulo, 'type="text" placeholder="Ej: Alta Pase Olímpico - Marcos"')) +
      '<div class="form-row">' +
        ui.field('Empresa', ui.select('f-empresa', withCurrent(opc.empresas, r.empresa_id, r.empresa_nombre), r.empresa_id, { placeholder: 'Ninguna', disable: noContactar, label: labelCliente })) +
        ui.field('Interesado o socio', ui.select('f-contacto', withCurrent(opc.contactos, r.contacto_id, r.contacto_nombre), r.contacto_id, { placeholder: 'Ninguno', disable: noContactar, label: labelCliente })) +
      '</div>' +
      '<div class="form-row">' +
        ui.field('Plan', ui.select('f-plan', cat.planes, r.plan_id, { placeholder: 'Seleccionar…', onchange: 'Pulso.forms.syncValor()', label: (p) => p.nombre + ' ($' + Number(p.precio).toLocaleString('es-AR') + ')' })) +
        ui.field('Socios', ui.input('f-socios', socios, 'type="number" min="1" step="1" oninput="Pulso.forms.syncValor()"'), 'convenios') +
      '</div>' +
      '<div class="form-row">' +
        ui.field('Sede', ui.select('f-sede', cat.sedes, r.sede_id, { placeholder: 'Seleccionar…' })) +
        responsableField(user, cat, r.responsable_id) +
      '</div>' +
      '<div class="form-row">' +
        ui.field('Valor estimado', ui.input('f-valor', r.valor_estimado !== undefined ? r.valor_estimado : (planInicial ? planInicial.precio * socios : ''), 'type="number" min="0" step="any" oninput="this.dataset.manual=1"')) +
        ui.field('Probabilidad de cierre', ui.input('f-prob', r.probabilidad, 'type="number" min="0" max="100" placeholder="0 a 100"'), '%') +
      '</div>' +
      '<div class="form-row">' +
        ui.field('Fecha estimada de cierre', ui.input('f-fecha', r.fecha_estimada_cierre, 'type="date"')) +
        ui.field('Origen', ui.select('f-origen', cat.origenes, r.origen_id, { placeholder: 'Seleccionar…' })) +
      '</div>' +
      ui.field('Observaciones', ui.textarea('f-obs', r.observaciones, 'Opcional')) +
      cierreHtml,
      record ? 'Guardar cambios' : 'Crear oportunidad',
      async () => {
        const body = {
          titulo: ui.val('f-titulo'), empresa_id: ui.val('f-empresa'), contacto_id: ui.val('f-contacto'), plan_id: ui.val('f-plan'),
          cantidad_socios: ui.val('f-socios'), sede_id: ui.val('f-sede'), responsable_id: responsableValue(user, record),
          valor_estimado: ui.val('f-valor'), probabilidad: ui.val('f-prob'), fecha_estimada_cierre: ui.val('f-fecha'),
          origen_id: ui.val('f-origen'), observaciones: ui.val('f-obs')
        };
        if (cerrada) {
          body.autorizacion = ui.val('f-autorizacion');
          body.fecha_real_cierre = ui.val('f-fecha-real');
          if (record.estado === 'ganada') body.valor_final = ui.val('f-valor-final');
          else body.motivo_perdida_id = ui.val('f-motivo');
        }
        const saved = record ? await api.put('/oportunidades/' + record.id, body) : await api.post('/oportunidades', body);
        ui.closeModal();
        ui.toast(record ? 'Cambios guardados.' : 'Oportunidad creada en "' + saved.etapa_nombre + '".');
        onSaved(saved);
      }
    );
  }

  // El valor sugerido sigue al plan y los socios hasta que el usuario lo escribe a mano.
  function syncValor() {
    const valor = document.getElementById('f-valor');
    if (!valor || valor.dataset.manual || !catalogosCache) return;
    const plan = catalogosCache.planes.find((p) => p.id === ui.val('f-plan'));
    if (plan) valor.value = plan.precio * (Number(ui.val('f-socios')) || 1);
  }

  // ---------- Cambio de etapa ----------
  async function changeStage(user, opp, etapaId, opts, onDone) {
    opts = opts || {};
    const cat = await catalogos();
    const etapa = cat.etapas.find((e) => e.id === etapaId);
    if (!etapa || etapaId === opp.etapa_id) return;
    const cerrada = opp.estado !== 'abierta';

    if (cerrada && !auth.isSupervisor(user)) {
      ui.toast('La oportunidad está cerrada. Solo un administrador o responsable comercial puede autorizar el cambio.', true);
      return;
    }

    const autorizacionHtml = cerrada
      ? '<div class="notice">Esta oportunidad está cerrada. El cambio queda registrado con tu usuario y el motivo.</div>' +
        ui.field('Motivo de la autorización', ui.textarea('f-autorizacion', '', 'Obligatorio'))
      : '';

    const send = async (extra) => {
      const saved = await api.post('/oportunidades/' + opp.id + '/etapa', Object.assign({ etapa_id: etapaId, observacion: opts.observacion || '' }, extra));
      ui.closeModal();
      ui.toast('Etapa actualizada a "' + etapa.nombre + '".');
      onDone(saved);
    };

    if (etapa.tipo === 'abierta' && !cerrada) {
      try {
        await send({});
      } catch (e) {
        ui.toast(e.message, true);
      }
      return;
    }

    const obsHtml = ui.field('Observación', ui.textarea('f-etapa-obs', opts.observacion || '', 'Opcional'));

    if (etapa.tipo === 'abierta') {
      ui.formModal('Reabrir en "' + etapa.nombre + '"', autorizacionHtml + obsHtml, 'Autorizar y reabrir', () => send({
        autorizacion: ui.val('f-autorizacion'), observacion: ui.val('f-etapa-obs')
      }));
      return;
    }

    if (etapa.tipo === 'ganada') {
      ui.formModal(
        'Marcar como "' + etapa.nombre + '"',
        autorizacionHtml +
        '<p class="modal-text">Registrá la fecha y el valor final para cerrar la oportunidad como ganada.</p>' +
        '<div class="form-row">' +
          ui.field('Fecha real de cierre', ui.input('f-fecha-real', ui.todayLocal(), 'type="date" max="' + ui.todayLocal() + '"')) +
          ui.field('Valor final', ui.input('f-valor-final', opp.valor_estimado, 'type="number" min="0" step="any"')) +
        '</div>' + obsHtml,
        'Confirmar alta',
        () => send({
          autorizacion: ui.val('f-autorizacion'), fecha_real_cierre: ui.val('f-fecha-real'),
          valor_final: ui.val('f-valor-final'), observacion: ui.val('f-etapa-obs')
        })
      );
      return;
    }

    ui.formModal(
      'Marcar como "' + etapa.nombre + '"',
      autorizacionHtml +
      '<p class="modal-text">Registrá la fecha y el motivo para saber por qué no se concretó.</p>' +
      '<div class="form-row">' +
        ui.field('Fecha real de cierre', ui.input('f-fecha-real', ui.todayLocal(), 'type="date" max="' + ui.todayLocal() + '"')) +
        ui.field('Motivo de pérdida', ui.select('f-motivo', cat.motivos, null, { placeholder: 'Seleccionar…' })) +
      '</div>' + obsHtml,
      'Confirmar pérdida',
      () => send({
        autorizacion: ui.val('f-autorizacion'), fecha_real_cierre: ui.val('f-fecha-real'),
        motivo_perdida_id: ui.val('f-motivo'), observacion: ui.val('f-etapa-obs')
      })
    );
  }

  // ---------- Actividad: solo hechos que ya ocurrieron ----------
  async function openActividad(preset, onSaved) {
    preset = preset || {};
    const cat = await catalogos();
    const fijo = preset.oportunidad_id || preset.empresa_id || preset.contacto_id;
    const opc = fijo ? null : await api.get('/opciones-clientes');
    const relacion = fijo
      ? ui.field('Relacionada con', '<div class="form-static">' + ui.escapeHtml(preset.label) + '</div>')
      : ui.field('Oportunidad', ui.select('f-rel-opp', opc.oportunidades, null, { placeholder: 'Ninguna', label: (o) => o.titulo }), 'si corresponde') +
        '<div class="form-row">' +
          ui.field('Empresa', ui.select('f-rel-empresa', opc.empresas, null, { placeholder: 'Ninguna' })) +
          ui.field('Interesado o socio', ui.select('f-rel-contacto', opc.contactos, null, { placeholder: 'Ninguno' })) +
        '</div>';

    ui.formModal(
      'Registrar actividad realizada',
      '<p class="modal-text">Registrá algo que ya ocurrió. Pulso no gestiona agenda ni recordatorios.</p>' +
      '<div class="form-row">' +
        ui.field('Tipo', ui.select('f-tipo', cat.tipos, null, { placeholder: 'Seleccionar…' })) +
        ui.field('Fecha y hora', ui.input('f-fecha-hora', ui.nowLocalInput(), 'type="datetime-local" max="' + ui.nowLocalInput() + '"')) +
      '</div>' +
      relacion +
      ui.field('Descripción', ui.textarea('f-desc', '', 'Qué se conversó o hizo')) +
      ui.field('Resultado', ui.textarea('f-res', '', 'Cómo terminó')),
      'Registrar actividad',
      async () => {
        const raw = ui.val('f-fecha-hora');
        const body = {
          tipo_id: ui.val('f-tipo'),
          fecha_hora: raw ? new Date(raw).toISOString() : '',
          descripcion: ui.val('f-desc'),
          resultado: ui.val('f-res'),
          oportunidad_id: fijo ? preset.oportunidad_id : ui.val('f-rel-opp'),
          empresa_id: fijo ? preset.empresa_id : ui.val('f-rel-empresa'),
          contacto_id: fijo ? preset.contacto_id : ui.val('f-rel-contacto')
        };
        await api.post('/actividades', body);
        ui.closeModal();
        ui.toast('Actividad registrada.');
        onSaved();
      }
    );
  }

  // ---------- Reasignación ----------
  async function openReasignar(tipo, record, onSaved) {
    const cat = await catalogos();
    const esCliente = tipo !== 'oportunidades';
    ui.formModal(
      'Reasignar responsable',
      ui.field('Nuevo responsable', ui.select('f-responsable', cat.responsables, record.responsable_id, { label: (u) => u.nombre + ' (' + ui.ROL_LABEL[u.rol] + ')' })) +
      (esCliente ? '<label class="check-row"><input type="checkbox" id="f-cascada"> Reasignar también sus oportunidades abiertas' + (tipo === 'empresas' ? ' y sus contactos' : '') + '</label>' : ''),
      'Reasignar',
      async () => {
        const check = document.getElementById('f-cascada');
        await api.post('/' + tipo + '/' + record.id + '/reasignar', { responsable_id: ui.val('f-responsable'), cascada: !!(check && check.checked) });
        ui.closeModal();
        ui.toast('Responsable actualizado.');
        onSaved();
      }
    );
  }

  // ---------- Baja lógica y eliminación ----------
  function openBaja(tipo, record, onSaved) {
    ui.formModal(
      'Dar de baja',
      '<p class="modal-text">El registro se conserva con sus oportunidades y actividades; solo cambia su estado.</p>' +
      ui.field('Nuevo estado', '<select id="f-estado-baja">' + ['Inactivo', 'No contactar'].map((s) => '<option value="' + s + '">' + s + '</option>').join('') + '</select>'),
      'Confirmar baja',
      async () => {
        await api.post('/' + tipo + '/' + record.id + '/baja', { estado: ui.val('f-estado-baja') });
        ui.closeModal();
        ui.toast('Baja registrada. El historial se conserva.');
        onSaved();
      }
    );
  }

  function openEliminar(tipo, record, nombre, backHref) {
    ui.confirmModal('Eliminar', '¿Eliminar definitivamente "' + nombre + '"? Solo es posible si no tiene historial comercial.', 'Eliminar', async () => {
      await api.del('/' + tipo + '/' + record.id);
      window.location.href = backHref;
    });
  }

  // ---------- Contraseña propia ----------
  function openPassword() {
    ui.formModal(
      'Cambiar contraseña',
      ui.field('Contraseña actual', '<input id="f-pass-actual" type="password" autocomplete="current-password">') +
      ui.field('Contraseña nueva', '<input id="f-pass-nueva" type="password" autocomplete="new-password">', 'mínimo 8 caracteres'),
      'Cambiar',
      async () => {
        await api.post('/auth/password', { actual: document.getElementById('f-pass-actual').value, nueva: document.getElementById('f-pass-nueva').value });
        ui.closeModal();
        ui.toast('Contraseña actualizada.');
      }
    );
  }

  return { catalogos, openEmpresa, openContacto, openOportunidad, syncValor, changeStage, openActividad, openReasignar, openBaja, openEliminar, openPassword };
})();

