// Oportunidades, cambio de etapa, cierre, reapertura y reasignación.
// Todas las reglas de negocio se validan acá, sin importar qué pantalla originó el pedido.
const express = require('express');
const db = require('../db');
const { ROLES, requireRole, isVendedor, canSupervise, scopeTo, assertOwner } = require('../auth');
const lib = require('../lib');
const { bad, forbidden, conflict, notFound, required, str, strOrNull, optionalNumber, validDate, todayAr, newId, nowIso, addSearch, pageParams, pageResult, auditStmt, describeChanges } = lib;
const { actividadesDe, auditoriaDe } = require('./historial');

const router = express.Router();

const SELECT = `SELECT o.*, e.nombre empresa_nombre, e.responsable_id empresa_responsable_id,
    c.nombre || ' ' || c.apellido contacto_nombre, c.responsable_id contacto_responsable_id,
    p.nombre plan_nombre, s.nombre sede_nombre, u.nombre responsable_nombre,
    et.nombre etapa_nombre, et.tipo etapa_tipo, et.color etapa_color,
    ori.nombre origen_nombre, m.nombre motivo_nombre
  FROM oportunidades o
  LEFT JOIN empresas e ON e.id = o.empresa_id
  LEFT JOIN contactos c ON c.id = o.contacto_id
  JOIN planes p ON p.id = o.plan_id
  JOIN sedes s ON s.id = o.sede_id
  JOIN usuarios u ON u.id = o.responsable_id
  JOIN etapas et ON et.id = o.etapa_id
  JOIN origenes ori ON ori.id = o.origen_id
  LEFT JOIN motivos_perdida m ON m.id = o.motivo_perdida_id`;

const CAMPOS = {
  titulo: 'Título', empresa_nombre: 'Empresa', contacto_nombre: 'Contacto', plan_nombre: 'Plan', sede_nombre: 'Sede',
  cantidad_socios: 'Socios', responsable_nombre: 'Responsable', valor_estimado: 'Valor estimado', valor_final: 'Valor final',
  probabilidad: 'Probabilidad', fecha_estimada_cierre: 'Fecha estimada', fecha_real_cierre: 'Fecha real',
  origen_nombre: 'Origen', motivo_nombre: 'Motivo de pérdida', observaciones: 'Observaciones'
};

const MSG_AUTORIZACION = 'La oportunidad está cerrada. Solo un administrador o responsable comercial puede autorizar el cambio.';

const getOpp = (id) => db.get(SELECT + ' WHERE o.id = ?', [id]);

function historialStmt(oppId, anterior, nueva, user, observacion, fecha) {
  return {
    sql: `INSERT INTO historial_etapas (id, oportunidad_id, etapa_anterior_id, etapa_nueva_id, etapa_anterior_nombre, etapa_nueva_nombre, fecha_hora, usuario_id, observacion)
          VALUES (?,?,?,?,?,?,?,?,?)`,
    args: [newId(), oppId, anterior ? anterior.id : null, nueva.id, anterior ? anterior.nombre : null, nueva.nombre, fecha || nowIso(), user.id, observacion || null]
  };
}

// ---------- Validación de los datos de la oportunidad ----------
async function assertActivo(table, id, label) {
  const row = await db.get('SELECT activo FROM ' + table + ' WHERE id = ?', [id]);
  if (!row || !row.activo) throw bad(label + ' no es válido o está inactivo.');
}

async function parseClientes(body, user, before) {
  const empresa_id = strOrNull(body.empresa_id);
  const contacto_id = strOrNull(body.contacto_id);
  if (!empresa_id && !contacto_id) throw bad('La oportunidad debe estar asociada a una empresa o a un contacto.');
  let empresa = null;
  let contacto = null;
  if (empresa_id) {
    empresa = await db.get('SELECT id, nombre, estado, responsable_id FROM empresas WHERE id = ?', [empresa_id]);
    if (!empresa) throw bad('La empresa no existe.');
    if (!before || before.empresa_id !== empresa_id) {
      assertOwner(user, empresa, 'La empresa');
      if (empresa.estado === 'No contactar') throw conflict(empresa.nombre + ' está marcada como No contactar: no se pueden crear oportunidades.');
    }
  }
  if (contacto_id) {
    contacto = await db.get('SELECT id, nombre, apellido, estado, empresa_id, responsable_id FROM contactos WHERE id = ?', [contacto_id]);
    if (!contacto) throw bad('El contacto no existe.');
    if (!before || before.contacto_id !== contacto_id) {
      assertOwner(user, contacto, 'El contacto');
      if (contacto.estado === 'No contactar') throw conflict(contacto.nombre + ' ' + contacto.apellido + ' está marcado como No contactar: no se pueden crear oportunidades.');
    }
    if (empresa_id && contacto.empresa_id && contacto.empresa_id !== empresa_id) throw bad('El contacto pertenece a otra empresa.');
    // Si la persona trabaja en una empresa, la negociación también figura en la ficha de esa empresa.
    if (!empresa_id && contacto.empresa_id) {
      const propia = await db.get('SELECT estado FROM empresas WHERE id = ?', [contacto.empresa_id]);
      if (propia && propia.estado === 'No contactar' && !before) throw conflict('La empresa de este contacto está marcada como No contactar: no se pueden crear oportunidades.');
      return { empresa_id: contacto.empresa_id, contacto_id };
    }
  }
  return { empresa_id, contacto_id };
}

async function parseOpp(body, user, before) {
  const clientes = await parseClientes(body, user, before);
  const plan_id = required(body.plan_id, 'plan');
  const sede_id = required(body.sede_id, 'sede');
  const origen_id = required(body.origen_id, 'origen');
  if (!before || before.plan_id !== plan_id) await assertActivo('planes', plan_id, 'El plan');
  if (!before || before.sede_id !== sede_id) await assertActivo('sedes', sede_id, 'La sede');
  if (!before || before.origen_id !== origen_id) await assertActivo('origenes', origen_id, 'El origen');

  let responsable_id = str(body.responsable_id) || (before ? before.responsable_id : user.id);
  if (isVendedor(user)) {
    const permitido = before ? before.responsable_id : user.id;
    if (responsable_id !== permitido) throw forbidden('Solo el administrador o el responsable comercial pueden asignar a otro responsable.');
  } else if (!before || before.responsable_id !== responsable_id) {
    await assertActivo('usuarios', responsable_id, 'El responsable');
  }

  return {
    ...clientes,
    titulo: required(body.titulo, 'título'),
    plan_id,
    sede_id,
    origen_id,
    responsable_id,
    cantidad_socios: optionalNumber(body.cantidad_socios, 'La cantidad de socios', { min: 1, max: 100000 }) || 1,
    valor_estimado: optionalNumber(body.valor_estimado, 'El valor estimado'),
    probabilidad: optionalNumber(body.probabilidad, 'La probabilidad', { min: 0, max: 100 }),
    fecha_estimada_cierre: validDate(body.fecha_estimada_cierre, 'fecha estimada de cierre'),
    observaciones: strOrNull(body.observaciones)
  };
}

// ---------- Listado (lista paginada y tablero) ----------
router.get('/', async (req, res) => {
  const where = [];
  const args = [];
  scopeTo(req.user, 'o', where, args);
  addSearch(req.query.q, ['o.titulo', 'e.nombre', "c.nombre || ' ' || c.apellido", 'p.nombre'], where, args);
  const filtros = { responsable_id: 'o.responsable_id', etapa_id: 'o.etapa_id', estado: 'o.estado', origen_id: 'o.origen_id', sede_id: 'o.sede_id', plan_id: 'o.plan_id' };
  Object.keys(filtros).forEach((k) => {
    if (req.query[k]) { where.push(filtros[k] + ' = ?'); args.push(req.query[k]); }
  });
  const w = where.length ? ' WHERE ' + where.join(' AND ') : '';
  const p = pageParams(req.query);
  const total = (await db.get(
    `SELECT COUNT(*) n FROM oportunidades o
     LEFT JOIN empresas e ON e.id = o.empresa_id LEFT JOIN contactos c ON c.id = o.contacto_id JOIN planes p ON p.id = o.plan_id` + w,
    args
  )).n;
  const items = await db.all(SELECT + w + ' ORDER BY o.created_at DESC LIMIT ? OFFSET ?', [...args, p.limit, p.offset]);
  res.json(pageResult(items, total, p));
});

// ---------- Alta ----------
router.post('/', async (req, res) => {
  const d = await parseOpp(req.body, req.user);
  let etapa;
  if (req.body.etapa_id) {
    etapa = await db.get('SELECT * FROM etapas WHERE id = ? AND activo = 1', [req.body.etapa_id]);
    if (!etapa) throw bad('La etapa no es válida.');
  } else {
    etapa = await db.get("SELECT * FROM etapas WHERE tipo = 'abierta' AND activo = 1 ORDER BY orden LIMIT 1");
  }
  if (!etapa) throw conflict('No hay etapas abiertas configuradas.');
  if (etapa.tipo !== 'abierta') throw bad('Una oportunidad nueva debe comenzar en una etapa abierta.');
  const id = newId();
  const now = nowIso();
  await db.batch([
    {
      sql: `INSERT INTO oportunidades (id,titulo,empresa_id,contacto_id,plan_id,sede_id,cantidad_socios,responsable_id,valor_estimado,etapa_id,estado,probabilidad,fecha_estimada_cierre,origen_id,observaciones,created_by,created_at,updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,'abierta',?,?,?,?,?,?,?)`,
      args: [id, d.titulo, d.empresa_id, d.contacto_id, d.plan_id, d.sede_id, d.cantidad_socios, d.responsable_id, d.valor_estimado, etapa.id, d.probabilidad, d.fecha_estimada_cierre, d.origen_id, d.observaciones, req.user.id, now, now]
    },
    historialStmt(id, null, etapa, req.user, 'Creación de la oportunidad', now),
    auditStmt(req.user, 'oportunidad', id, 'Creación de la oportunidad', d.titulo)
  ]);
  res.status(201).json(await getOpp(id));
});

// ---------- Detalle ----------
router.get('/:id', async (req, res) => {
  const opp = await getOpp(req.params.id);
  assertOwner(req.user, opp, 'La oportunidad');
  const historial = await db.all(
    `SELECT h.*, u.nombre usuario_nombre FROM historial_etapas h JOIN usuarios u ON u.id = h.usuario_id
     WHERE h.oportunidad_id = ? ORDER BY h.fecha_hora ASC`,
    [opp.id]
  );
  const vendedor = isVendedor(req.user);
  const cerrada = opp.estado !== 'abierta';
  res.json({
    oportunidad: opp,
    historial,
    actividades: await actividadesDe('oportunidad', opp.id, req.user),
    auditoria: await auditoriaDe('oportunidad', opp.id),
    ver_empresa: !!opp.empresa_id && (!vendedor || opp.empresa_responsable_id === req.user.id),
    ver_contacto: !!opp.contacto_id && (!vendedor || opp.contacto_responsable_id === req.user.id),
    permisos: {
      editar: !cerrada || canSupervise(req.user),
      cambiar_etapa: !cerrada || canSupervise(req.user),
      reasignar: canSupervise(req.user),
      autorizar_cerrada: canSupervise(req.user)
    }
  });
});

// ---------- Edición: nunca cambia etapa ni estado ----------
router.put('/:id', async (req, res) => {
  const before = await getOpp(req.params.id);
  assertOwner(req.user, before, 'La oportunidad');
  const cerrada = before.estado !== 'abierta';
  let motivoAutorizacion = '';
  if (cerrada) {
    if (!canSupervise(req.user)) throw forbidden(MSG_AUTORIZACION);
    motivoAutorizacion = required(req.body.autorizacion, 'motivo de la modificación de una oportunidad cerrada');
  }
  const d = await parseOpp(req.body, req.user, before);

  let valorFinal = before.valor_final;
  let fechaReal = before.fecha_real_cierre;
  let motivoId = before.motivo_perdida_id;
  if (cerrada) {
    fechaReal = validDate(req.body.fecha_real_cierre || before.fecha_real_cierre, 'fecha real de cierre');
    if (fechaReal > todayAr()) throw bad('La fecha real de cierre no puede ser futura.');
    if (before.estado === 'ganada') {
      valorFinal = optionalNumber(req.body.valor_final === undefined ? before.valor_final : req.body.valor_final, 'El valor final');
      if (!valorFinal) throw bad('Una oportunidad ganada debe tener valor final.');
    } else {
      motivoId = str(req.body.motivo_perdida_id) || before.motivo_perdida_id;
      if (!motivoId) throw bad('Una oportunidad perdida debe tener motivo de pérdida.');
      if (motivoId !== before.motivo_perdida_id) await assertActivo('motivos_perdida', motivoId, 'El motivo de pérdida');
    }
  }

  await db.run(
    `UPDATE oportunidades SET titulo=?,empresa_id=?,contacto_id=?,plan_id=?,sede_id=?,cantidad_socios=?,responsable_id=?,valor_estimado=?,valor_final=?,probabilidad=?,fecha_estimada_cierre=?,fecha_real_cierre=?,origen_id=?,motivo_perdida_id=?,observaciones=?,updated_at=? WHERE id=?`,
    [d.titulo, d.empresa_id, d.contacto_id, d.plan_id, d.sede_id, d.cantidad_socios, d.responsable_id, d.valor_estimado, valorFinal, d.probabilidad, d.fecha_estimada_cierre, fechaReal, d.origen_id, motivoId, d.observaciones, nowIso(), before.id]
  );
  const after = await getOpp(before.id);
  const cambios = describeChanges(before, after, CAMPOS);
  if (cambios || cerrada) {
    await db.batch([auditStmt(
      req.user, 'oportunidad', before.id,
      cerrada ? 'Modificación de oportunidad cerrada' : 'Modificación',
      (cerrada ? 'Autorización: ' + motivoAutorizacion + (cambios ? ' · ' : '') : '') + cambios
    )]);
  }
  res.json(after);
});

// ---------- Cambio de etapa, único camino para cerrar o reabrir ----------
router.post('/:id/etapa', async (req, res) => {
  const opp = await getOpp(req.params.id);
  assertOwner(req.user, opp, 'La oportunidad');
  const etapaId = required(req.body.etapa_id, 'etapa');
  if (etapaId === opp.etapa_id) throw bad('La oportunidad ya está en esa etapa.');
  const nueva = await db.get('SELECT * FROM etapas WHERE id = ? AND activo = 1', [etapaId]);
  if (!nueva) throw bad('La etapa no es válida o está inactiva.');
  const anterior = { id: opp.etapa_id, nombre: opp.etapa_nombre };
  const cerrada = opp.estado !== 'abierta';
  const observacion = str(req.body.observacion);

  let autorizacion = '';
  if (cerrada) {
    if (!canSupervise(req.user)) throw forbidden(MSG_AUTORIZACION);
    autorizacion = required(req.body.autorizacion, 'motivo de la autorización para cambiar una oportunidad cerrada');
  }

  const now = nowIso();
  let campos;
  const stmts = [];
  if (nueva.tipo === 'ganada') {
    const fecha = validDate(req.body.fecha_real_cierre, 'fecha real de cierre');
    if (fecha > todayAr()) throw bad('La fecha real de cierre no puede ser futura.');
    const valor = optionalNumber(req.body.valor_final, 'El valor final');
    if (!valor) throw bad('Para marcarla como Alta hay que indicar el valor final.');
    campos = { estado: 'ganada', fecha_real_cierre: fecha, valor_final: valor, motivo_perdida_id: null };
    // Proceso del gimnasio: el Alta convierte al interesado en cliente (socio).
    if (opp.contacto_id) {
      const c = await db.get('SELECT estado FROM contactos WHERE id = ?', [opp.contacto_id]);
      if (['Potencial', 'Inactivo'].includes(c.estado)) {
        stmts.push({ sql: "UPDATE contactos SET estado='Cliente', updated_at=? WHERE id=?", args: [now, opp.contacto_id] });
        stmts.push(auditStmt(req.user, 'contacto', opp.contacto_id, 'Alta de socio', 'Estado: ' + c.estado + ' → Cliente, por: ' + opp.titulo));
      }
    }
    if (opp.empresa_id) {
      const e = await db.get('SELECT estado FROM empresas WHERE id = ?', [opp.empresa_id]);
      if (['Potencial', 'Inactivo'].includes(e.estado)) {
        stmts.push({ sql: "UPDATE empresas SET estado='Cliente', updated_at=? WHERE id=?", args: [now, opp.empresa_id] });
        stmts.push(auditStmt(req.user, 'empresa', opp.empresa_id, 'Alta de convenio', 'Estado: ' + e.estado + ' → Cliente, por: ' + opp.titulo));
      }
    }
  } else if (nueva.tipo === 'perdida') {
    const fecha = validDate(req.body.fecha_real_cierre, 'fecha real de cierre');
    if (fecha > todayAr()) throw bad('La fecha real de cierre no puede ser futura.');
    const motivo = required(req.body.motivo_perdida_id, 'motivo de pérdida');
    await assertActivo('motivos_perdida', motivo, 'El motivo de pérdida');
    campos = { estado: 'perdida', fecha_real_cierre: fecha, valor_final: null, motivo_perdida_id: motivo };
  } else {
    campos = { estado: 'abierta', fecha_real_cierre: null, valor_final: null, motivo_perdida_id: null };
  }

  const obsHistorial = [autorizacion && 'Autorización: ' + autorizacion, observacion].filter(Boolean).join(' · ');
  stmts.unshift(
    {
      sql: 'UPDATE oportunidades SET etapa_id=?, estado=?, fecha_real_cierre=?, valor_final=?, motivo_perdida_id=?, updated_at=? WHERE id=?',
      args: [nueva.id, campos.estado, campos.fecha_real_cierre, campos.valor_final, campos.motivo_perdida_id, now, opp.id]
    },
    historialStmt(opp.id, anterior, nueva, req.user, obsHistorial, now)
  );
  if (cerrada) {
    const accion = campos.estado === 'abierta' ? 'Reapertura autorizada' : 'Cambio de cierre autorizado';
    stmts.push(auditStmt(req.user, 'oportunidad', opp.id, accion, anterior.nombre + ' → ' + nueva.nombre + ' · Autorización: ' + autorizacion));
  } else if (campos.estado !== 'abierta') {
    stmts.push(auditStmt(req.user, 'oportunidad', opp.id, 'Cierre', nueva.nombre + ' (' + campos.fecha_real_cierre + ')'));
  }
  await db.batch(stmts);
  res.json(await getOpp(opp.id));
});

// ---------- Reasignación ----------
router.post('/:id/reasignar', requireRole(ROLES.ADMIN, ROLES.RESPONSABLE), async (req, res) => {
  const opp = await getOpp(req.params.id);
  if (!opp) throw notFound('La oportunidad no existe.');
  const destino = required(req.body.responsable_id, 'nuevo responsable');
  const nuevo = await db.get('SELECT nombre, activo FROM usuarios WHERE id = ?', [destino]);
  if (!nuevo || !nuevo.activo) throw bad('El responsable no es válido o está inactivo.');
  if (destino === opp.responsable_id) throw bad('La oportunidad ya está asignada a ese responsable.');
  await db.batch([
    { sql: 'UPDATE oportunidades SET responsable_id=?, updated_at=? WHERE id=?', args: [destino, nowIso(), opp.id] },
    auditStmt(req.user, 'oportunidad', opp.id, 'Reasignación', 'Responsable: ' + opp.responsable_nombre + ' → ' + nuevo.nombre)
  ]);
  res.json(await getOpp(opp.id));
});

module.exports = router;
