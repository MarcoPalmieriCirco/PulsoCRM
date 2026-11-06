// Actividades: hechos que ya ocurrieron. No hay edición, borrado ni fechas futuras.
const express = require('express');
const db = require('../db');
const { isVendedor, assertOwner } = require('../auth');
const lib = require('../lib');
const { bad, required, strOrNull, newId, nowIso, addSearch, pageParams, pageResult } = lib;
const { ACTIVIDAD_SELECT } = require('./historial');

const router = express.Router();
const TOLERANCIA_MS = 60 * 1000;

router.get('/', async (req, res) => {
  const where = [];
  const args = [];
  if (isVendedor(req.user)) {
    where.push('(a.usuario_id = ? OR o.responsable_id = ? OR e.responsable_id = ? OR c.responsable_id = ?)');
    args.push(req.user.id, req.user.id, req.user.id, req.user.id);
  }
  addSearch(req.query.q, ['a.descripcion', 'a.resultado', 'e.nombre', "c.nombre || ' ' || c.apellido", 'o.titulo'], where, args);
  if (req.query.tipo_id) { where.push('a.tipo_id = ?'); args.push(req.query.tipo_id); }
  if (req.query.usuario_id) { where.push('a.usuario_id = ?'); args.push(req.query.usuario_id); }
  const w = where.length ? ' WHERE ' + where.join(' AND ') : '';
  const p = pageParams(req.query);
  const joins = ` FROM actividades a LEFT JOIN empresas e ON e.id = a.empresa_id
    LEFT JOIN contactos c ON c.id = a.contacto_id LEFT JOIN oportunidades o ON o.id = a.oportunidad_id`;
  const total = (await db.get('SELECT COUNT(*) n' + joins + w, args)).n;
  const rows = await db.all(ACTIVIDAD_SELECT + w + ' ORDER BY a.fecha_hora DESC LIMIT ? OFFSET ?', [...args, p.limit, p.offset]);
  const items = rows.map((a) => ({
    ...a,
    ver_oportunidad: !!a.oportunidad_id && (!isVendedor(req.user) || a.oportunidad_responsable_id === req.user.id)
  }));
  res.json(pageResult(items, total, p));
});

router.post('/', async (req, res) => {
  const tipo_id = required(req.body.tipo_id, 'tipo de actividad');
  const tipo = await db.get('SELECT activo FROM tipos_actividad WHERE id = ?', [tipo_id]);
  if (!tipo || !tipo.activo) throw bad('El tipo de actividad no es válido o está inactivo.');

  const fecha = new Date(required(req.body.fecha_hora, 'fecha y hora'));
  if (isNaN(fecha.getTime())) throw bad('La fecha y hora no es válida.');
  if (fecha.getTime() > Date.now() + TOLERANCIA_MS) {
    throw bad('Una actividad registra un hecho que ya ocurrió: la fecha no puede ser futura.');
  }

  let empresa_id = strOrNull(req.body.empresa_id);
  let contacto_id = strOrNull(req.body.contacto_id);
  const oportunidad_id = strOrNull(req.body.oportunidad_id);
  if (!empresa_id && !contacto_id && !oportunidad_id) throw bad('La actividad debe relacionarse con una empresa, un contacto o una oportunidad.');

  if (oportunidad_id) {
    const opp = await db.get('SELECT id, responsable_id, empresa_id, contacto_id FROM oportunidades WHERE id = ?', [oportunidad_id]);
    assertOwner(req.user, opp, 'La oportunidad');
    empresa_id = empresa_id || opp.empresa_id;
    contacto_id = contacto_id || opp.contacto_id;
    if (!empresa_id && contacto_id) {
      const c = await db.get('SELECT empresa_id FROM contactos WHERE id = ?', [contacto_id]);
      empresa_id = c ? c.empresa_id : null;
    }
  } else {
    if (contacto_id) {
      const c = await db.get('SELECT id, responsable_id, empresa_id FROM contactos WHERE id = ?', [contacto_id]);
      assertOwner(req.user, c, 'El contacto');
      empresa_id = empresa_id || c.empresa_id;
    } else {
      const e = await db.get('SELECT id, responsable_id FROM empresas WHERE id = ?', [empresa_id]);
      assertOwner(req.user, e, 'La empresa');
    }
  }

  const id = newId();
  await db.run(
    `INSERT INTO actividades (id,tipo_id,fecha_hora,usuario_id,empresa_id,contacto_id,oportunidad_id,descripcion,resultado,created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [id, tipo_id, fecha.toISOString(), req.user.id, empresa_id, contacto_id, oportunidad_id,
      required(req.body.descripcion, 'descripción'), required(req.body.resultado, 'resultado'), nowIso()]
  );
  res.status(201).json(await db.get(ACTIVIDAD_SELECT + ' WHERE a.id = ?', [id]));
});

module.exports = router;
