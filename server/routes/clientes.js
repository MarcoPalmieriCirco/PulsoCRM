// Empresas y contactos: datos mínimos, estados, asignación y baja lógica.
const express = require('express');
const db = require('../db');
const { ROLES, requireRole, isVendedor, canSupervise, scopeTo, assertOwner } = require('../auth');
const lib = require('../lib');
const { bad, forbidden, conflict, notFound, required, str, strOrNull, validEmail, newId, nowIso, addSearch, pageParams, pageResult, auditStmt, describeChanges } = lib;
const { actividadesDe, auditoriaDe } = require('./historial');

const router = express.Router();
const ESTADOS = ['Potencial', 'Cliente', 'Inactivo', 'No contactar'];

async function assertActivo(table, id, label) {
  const row = await db.get('SELECT id, activo FROM ' + table + ' WHERE id = ?', [id]);
  if (!row || !row.activo) throw bad(label + ' no es válido o está inactivo.');
}

function parseEstado(v) {
  const estado = str(v) || 'Potencial';
  if (!ESTADOS.includes(estado)) throw bad('El estado no es válido.');
  return estado;
}

// El vendedor siempre queda como responsable; solo la supervisión asigna a otros.
async function resolveResponsable(user, value, actual) {
  const pedido = str(value) || actual || user.id;
  if (isVendedor(user)) {
    if (pedido !== (actual || user.id)) throw forbidden('Solo el administrador o el responsable comercial pueden reasignar.');
    return pedido;
  }
  if (pedido !== actual) await assertActivo('usuarios', pedido, 'El responsable');
  return pedido;
}

// ---------- Empresas ----------
const EMPRESA_SELECT = `SELECT e.*, u.nombre responsable_nombre, ori.nombre origen_nombre
  FROM empresas e
  JOIN usuarios u ON u.id = e.responsable_id
  JOIN origenes ori ON ori.id = e.origen_id`;

const EMPRESA_FIELDS = {
  nombre: 'Razón social', cuit: 'CUIT', industria: 'Actividad', email: 'Correo', telefono: 'Teléfono',
  direccion: 'Dirección', sitio_web: 'Sitio web', estado: 'Estado', responsable_nombre: 'Responsable',
  origen_nombre: 'Origen', observaciones: 'Observaciones'
};

async function parseEmpresa(body, user, before) {
  const cuit = strOrNull(body.cuit);
  if (cuit && !/^\d{2}-?\d{8}-?\d$/.test(cuit)) throw bad('El CUIT debe tener 11 dígitos (por ejemplo 30-71234567-9).');
  const origen_id = required(body.origen_id, 'origen');
  if (!before || before.origen_id !== origen_id) await assertActivo('origenes', origen_id, 'El origen');
  return {
    nombre: required(body.nombre, 'razón social o nombre comercial'),
    cuit,
    industria: strOrNull(body.industria),
    email: validEmail(body.email),
    telefono: strOrNull(body.telefono),
    direccion: strOrNull(body.direccion),
    sitio_web: strOrNull(body.sitio_web),
    estado: parseEstado(body.estado),
    responsable_id: await resolveResponsable(user, body.responsable_id, before && before.responsable_id),
    origen_id,
    observaciones: strOrNull(body.observaciones)
  };
}

router.get('/empresas', async (req, res) => {
  const where = [];
  const args = [];
  scopeTo(req.user, 'e', where, args);
  addSearch(req.query.q, ['e.nombre', 'e.cuit', 'e.industria', 'e.email'], where, args);
  if (req.query.responsable_id) { where.push('e.responsable_id = ?'); args.push(req.query.responsable_id); }
  if (req.query.estado) { where.push('e.estado = ?'); args.push(req.query.estado); }
  if (req.query.origen_id) { where.push('e.origen_id = ?'); args.push(req.query.origen_id); }
  const w = where.length ? ' WHERE ' + where.join(' AND ') : '';
  const p = pageParams(req.query, 5);
  const total = (await db.get('SELECT COUNT(*) n FROM empresas e' + w, args)).n;
  const items = await db.all(EMPRESA_SELECT + w + ' ORDER BY e.nombre LIMIT ? OFFSET ?', [...args, p.limit, p.offset]);
  res.json(pageResult(items, total, p));
});

router.post('/empresas', async (req, res) => {
  const d = await parseEmpresa(req.body, req.user);
  const id = newId();
  const now = nowIso();
  await db.batch([
    {
      sql: `INSERT INTO empresas (id,nombre,cuit,industria,email,telefono,direccion,sitio_web,estado,responsable_id,origen_id,observaciones,created_by,created_at,updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      args: [id, d.nombre, d.cuit, d.industria, d.email, d.telefono, d.direccion, d.sitio_web, d.estado, d.responsable_id, d.origen_id, d.observaciones, req.user.id, now, now]
    },
    auditStmt(req.user, 'empresa', id, 'Alta de empresa', d.nombre)
  ]);
  res.status(201).json(await db.get(EMPRESA_SELECT + ' WHERE e.id = ?', [id]));
});

router.get('/empresas/:id', async (req, res) => {
  const empresa = await db.get(EMPRESA_SELECT + ' WHERE e.id = ?', [req.params.id]);
  assertOwner(req.user, empresa, 'La empresa');
  const vendedor = isVendedor(req.user);
  const scope = vendedor ? ' AND responsable_id = ?' : '';
  const scopeArgs = vendedor ? [req.user.id] : [];
  const contactos = await db.all("SELECT id, nombre, apellido, cargo, estado FROM contactos WHERE empresa_id = ?" + scope + ' ORDER BY apellido', [empresa.id, ...scopeArgs]);
  const oportunidades = await db.all(
    `SELECT o.id, o.titulo, o.estado, o.valor_estimado, o.valor_final, o.fecha_estimada_cierre, o.fecha_real_cierre,
            et.nombre etapa_nombre, p.nombre plan_nombre, u.nombre responsable_nombre
     FROM oportunidades o JOIN etapas et ON et.id=o.etapa_id JOIN planes p ON p.id=o.plan_id JOIN usuarios u ON u.id=o.responsable_id
     WHERE o.empresa_id = ?` + (vendedor ? ' AND o.responsable_id = ?' : '') + ' ORDER BY o.created_at DESC',
    [empresa.id, ...scopeArgs]
  );
  res.json({
    empresa, contactos, oportunidades,
    actividades: await actividadesDe('empresa', empresa.id, req.user),
    auditoria: await auditoriaDe('empresa', empresa.id),
    permisos: { editar: true, reasignar: canSupervise(req.user), eliminar: req.user.rol === ROLES.ADMIN }
  });
});

router.put('/empresas/:id', async (req, res) => {
  const before = await db.get(EMPRESA_SELECT + ' WHERE e.id = ?', [req.params.id]);
  assertOwner(req.user, before, 'La empresa');
  const d = await parseEmpresa(req.body, req.user, before);
  await db.run(
    `UPDATE empresas SET nombre=?,cuit=?,industria=?,email=?,telefono=?,direccion=?,sitio_web=?,estado=?,responsable_id=?,origen_id=?,observaciones=?,updated_at=? WHERE id=?`,
    [d.nombre, d.cuit, d.industria, d.email, d.telefono, d.direccion, d.sitio_web, d.estado, d.responsable_id, d.origen_id, d.observaciones, nowIso(), before.id]
  );
  const after = await db.get(EMPRESA_SELECT + ' WHERE e.id = ?', [before.id]);
  const detalle = describeChanges(before, after, EMPRESA_FIELDS);
  if (detalle) await db.batch([auditStmt(req.user, 'empresa', before.id, 'Modificación', detalle)]);
  res.json(after);
});

// ---------- Contactos (personas: interesados y socios) ----------
const CONTACTO_SELECT = `SELECT c.*, u.nombre responsable_nombre, ori.nombre origen_nombre, e.nombre empresa_nombre,
    e.responsable_id empresa_responsable_id, s.nombre sede_nombre
  FROM contactos c
  JOIN usuarios u ON u.id = c.responsable_id
  JOIN origenes ori ON ori.id = c.origen_id
  LEFT JOIN empresas e ON e.id = c.empresa_id
  LEFT JOIN sedes s ON s.id = c.sede_id`;

const CONTACTO_FIELDS = {
  nombre: 'Nombre', apellido: 'Apellido', dni: 'Documento', cargo: 'Cargo', email: 'Correo', telefono: 'Teléfono',
  empresa_nombre: 'Empresa', sede_nombre: 'Sede', estado: 'Estado', responsable_nombre: 'Responsable',
  origen_nombre: 'Origen', observaciones: 'Observaciones'
};

async function parseContacto(body, user, before) {
  const origen_id = required(body.origen_id, 'origen');
  if (!before || before.origen_id !== origen_id) await assertActivo('origenes', origen_id, 'El origen');
  const empresa_id = strOrNull(body.empresa_id);
  if (empresa_id && (!before || before.empresa_id !== empresa_id)) {
    const empresa = await db.get('SELECT id, responsable_id FROM empresas WHERE id = ?', [empresa_id]);
    assertOwner(user, empresa, 'La empresa');
  }
  const sede_id = strOrNull(body.sede_id);
  if (sede_id && (!before || before.sede_id !== sede_id)) await assertActivo('sedes', sede_id, 'La sede');
  return {
    nombre: required(body.nombre, 'nombre'),
    apellido: required(body.apellido, 'apellido'),
    dni: strOrNull(body.dni),
    cargo: strOrNull(body.cargo),
    email: validEmail(body.email),
    telefono: strOrNull(body.telefono),
    empresa_id,
    sede_id,
    responsable_id: await resolveResponsable(user, body.responsable_id, before && before.responsable_id),
    estado: parseEstado(body.estado),
    origen_id,
    observaciones: strOrNull(body.observaciones)
  };
}

router.get('/contactos', async (req, res) => {
  const where = [];
  const args = [];
  scopeTo(req.user, 'c', where, args);
  addSearch(req.query.q, ['c.nombre', 'c.apellido', "c.nombre || ' ' || c.apellido", 'c.dni', 'c.email', 'c.telefono', 'e.nombre'], where, args);
  if (req.query.responsable_id) { where.push('c.responsable_id = ?'); args.push(req.query.responsable_id); }
  if (req.query.estado) { where.push('c.estado = ?'); args.push(req.query.estado); }
  if (req.query.origen_id) { where.push('c.origen_id = ?'); args.push(req.query.origen_id); }
  if (req.query.sede_id) { where.push('c.sede_id = ?'); args.push(req.query.sede_id); }
  const w = where.length ? ' WHERE ' + where.join(' AND ') : '';
  const p = pageParams(req.query);
  const total = (await db.get('SELECT COUNT(*) n FROM contactos c LEFT JOIN empresas e ON e.id = c.empresa_id' + w, args)).n;
  const items = await db.all(CONTACTO_SELECT + w + ' ORDER BY c.apellido, c.nombre LIMIT ? OFFSET ?', [...args, p.limit, p.offset]);
  res.json(pageResult(items, total, p));
});

router.post('/contactos', async (req, res) => {
  const d = await parseContacto(req.body, req.user);
  const id = newId();
  const now = nowIso();
  await db.batch([
    {
      sql: `INSERT INTO contactos (id,nombre,apellido,dni,cargo,email,telefono,empresa_id,sede_id,responsable_id,estado,origen_id,observaciones,created_by,created_at,updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      args: [id, d.nombre, d.apellido, d.dni, d.cargo, d.email, d.telefono, d.empresa_id, d.sede_id, d.responsable_id, d.estado, d.origen_id, d.observaciones, req.user.id, now, now]
    },
    auditStmt(req.user, 'contacto', id, 'Alta de contacto', d.nombre + ' ' + d.apellido)
  ]);
  res.status(201).json(await db.get(CONTACTO_SELECT + ' WHERE c.id = ?', [id]));
});

router.get('/contactos/:id', async (req, res) => {
  const contacto = await db.get(CONTACTO_SELECT + ' WHERE c.id = ?', [req.params.id]);
  assertOwner(req.user, contacto, 'El contacto');
  const vendedor = isVendedor(req.user);
  const oportunidades = await db.all(
    `SELECT o.id, o.titulo, o.estado, o.valor_estimado, o.valor_final, o.fecha_estimada_cierre, o.fecha_real_cierre,
            et.nombre etapa_nombre, p.nombre plan_nombre, u.nombre responsable_nombre
     FROM oportunidades o JOIN etapas et ON et.id=o.etapa_id JOIN planes p ON p.id=o.plan_id JOIN usuarios u ON u.id=o.responsable_id
     WHERE o.contacto_id = ?` + (vendedor ? ' AND o.responsable_id = ?' : '') + ' ORDER BY o.created_at DESC',
    vendedor ? [contacto.id, req.user.id] : [contacto.id]
  );
  res.json({
    contacto, oportunidades,
    ver_empresa: !!contacto.empresa_id && (!vendedor || contacto.empresa_responsable_id === req.user.id),
    actividades: await actividadesDe('contacto', contacto.id, req.user),
    auditoria: await auditoriaDe('contacto', contacto.id),
    permisos: { editar: true, reasignar: canSupervise(req.user), eliminar: req.user.rol === ROLES.ADMIN }
  });
});

router.put('/contactos/:id', async (req, res) => {
  const before = await db.get(CONTACTO_SELECT + ' WHERE c.id = ?', [req.params.id]);
  assertOwner(req.user, before, 'El contacto');
  const d = await parseContacto(req.body, req.user, before);
  await db.run(
    `UPDATE contactos SET nombre=?,apellido=?,dni=?,cargo=?,email=?,telefono=?,empresa_id=?,sede_id=?,responsable_id=?,estado=?,origen_id=?,observaciones=?,updated_at=? WHERE id=?`,
    [d.nombre, d.apellido, d.dni, d.cargo, d.email, d.telefono, d.empresa_id, d.sede_id, d.responsable_id, d.estado, d.origen_id, d.observaciones, nowIso(), before.id]
  );
  const after = await db.get(CONTACTO_SELECT + ' WHERE c.id = ?', [before.id]);
  const detalle = describeChanges(before, after, CONTACTO_FIELDS);
  if (detalle) await db.batch([auditStmt(req.user, 'contacto', before.id, 'Modificación', detalle)]);
  res.json(after);
});

// ---------- Baja lógica ----------
for (const table of ['empresas', 'contactos']) {
router.post('/' + table + '/:id/baja', async (req, res) => {
  const label = table === 'empresas' ? 'La empresa' : 'El contacto';
  const row = await db.get('SELECT id, estado, responsable_id FROM ' + table + ' WHERE id = ?', [req.params.id]);
  assertOwner(req.user, row, label);
  const estado = str(req.body.estado) || 'Inactivo';
  if (!['Inactivo', 'No contactar'].includes(estado)) throw bad('La baja solo admite los estados Inactivo o No contactar.');
  await db.batch([
    { sql: 'UPDATE ' + table + ' SET estado = ?, updated_at = ? WHERE id = ?', args: [estado, nowIso(), row.id] },
    auditStmt(req.user, table === 'empresas' ? 'empresa' : 'contacto', row.id, 'Baja lógica', 'Estado: ' + row.estado + ' → ' + estado)
  ]);
  res.json({ ok: true, estado });
});

// Borrado físico: solo administrador y solo si el registro no tiene historial comercial.
router.delete('/' + table + '/:id', requireRole(ROLES.ADMIN), async (req, res) => {
  const isEmpresa = table === 'empresas';
  const row = await db.get('SELECT id FROM ' + table + ' WHERE id = ?', [req.params.id]);
  if (!row) throw notFound();
  const col = isEmpresa ? 'empresa_id' : 'contacto_id';
  const n = async (sql) => (await db.get(sql, [row.id])).n;
  const historial = (await n('SELECT COUNT(*) n FROM oportunidades WHERE ' + col + ' = ?'))
    + (await n('SELECT COUNT(*) n FROM actividades WHERE ' + col + ' = ?'))
    + (isEmpresa ? await n('SELECT COUNT(*) n FROM contactos WHERE empresa_id = ?') : 0);
  if (historial > 0) {
    throw conflict('Tiene historial comercial y no puede eliminarse. Usá la baja lógica para conservar sus oportunidades y actividades.');
  }
  await db.batch([
    { sql: 'DELETE FROM ' + table + ' WHERE id = ?', args: [row.id] },
    auditStmt(req.user, isEmpresa ? 'empresa' : 'contacto', row.id, 'Eliminación sin historial')
  ]);
  res.json({ ok: true });
});

// Reasignación, con opción de llevar también su cartera (redistribuir clientes).
router.post('/' + table + '/:id/reasignar', requireRole(ROLES.ADMIN, ROLES.RESPONSABLE), async (req, res) => {
  const isEmpresa = table === 'empresas';
  const row = await db.get('SELECT id, responsable_id FROM ' + table + ' WHERE id = ?', [req.params.id]);
  if (!row) throw notFound();
  const destino = required(req.body.responsable_id, 'nuevo responsable');
  const nuevo = await db.get('SELECT id, nombre, activo FROM usuarios WHERE id = ?', [destino]);
  if (!nuevo || !nuevo.activo) throw bad('El responsable no es válido o está inactivo.');
  const anterior = await db.get('SELECT nombre FROM usuarios WHERE id = ?', [row.responsable_id]);
  const now = nowIso();
  const stmts = [
    { sql: 'UPDATE ' + table + ' SET responsable_id = ?, updated_at = ? WHERE id = ?', args: [destino, now, row.id] },
    auditStmt(req.user, isEmpresa ? 'empresa' : 'contacto', row.id, 'Reasignación', 'Responsable: ' + anterior.nombre + ' → ' + nuevo.nombre)
  ];
  if (req.body.cascada) {
    const col = isEmpresa ? 'empresa_id' : 'contacto_id';
    const abiertas = await db.all("SELECT id, responsable_id FROM oportunidades WHERE " + col + " = ? AND estado = 'abierta' AND responsable_id <> ?", [row.id, destino]);
    abiertas.forEach((o) => {
      stmts.push({ sql: 'UPDATE oportunidades SET responsable_id = ?, updated_at = ? WHERE id = ?', args: [destino, now, o.id] });
      stmts.push(auditStmt(req.user, 'oportunidad', o.id, 'Reasignación', 'Por reasignación del cliente. Nuevo responsable: ' + nuevo.nombre));
    });
    if (isEmpresa) stmts.push({ sql: 'UPDATE contactos SET responsable_id = ?, updated_at = ? WHERE empresa_id = ?', args: [destino, now, row.id] });
  }
  await db.batch(stmts);
  res.json({ ok: true });
});
}

module.exports = router;
