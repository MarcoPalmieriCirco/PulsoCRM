// Configuración y catálogos: planes, etapas, orígenes, motivos, tipos de actividad y sedes.
const express = require('express');
const db = require('../db');
const { ROLES, requireAuth, requireRole, isVendedor } = require('../auth');
const lib = require('../lib');
const { bad, conflict, notFound, required, str, strOrNull, optionalNumber, newId, addSearch, pageParams, pageResult, auditStmt, describeChanges } = lib;

const router = express.Router();
const adminOnly = requireRole(ROLES.ADMIN);

// Lo que necesitan los formularios y filtros de cualquier pantalla.
router.get('/catalogos', requireAuth, async (req, res) => {
  const [etapas, origenes, motivos, tipos, sedes, planes] = await Promise.all([
    db.all('SELECT * FROM etapas ORDER BY orden'),
    db.all('SELECT * FROM origenes ORDER BY nombre'),
    db.all('SELECT * FROM motivos_perdida ORDER BY nombre'),
    db.all('SELECT * FROM tipos_actividad ORDER BY nombre'),
    db.all('SELECT * FROM sedes ORDER BY nombre'),
    db.all('SELECT * FROM planes ORDER BY precio')
  ]);
  // El vendedor no asigna a terceros: solo recibe su propio usuario.
  const responsables = isVendedor(req.user)
    ? [{ id: req.user.id, nombre: req.user.nombre, rol: req.user.rol, activo: 1 }]
    : await db.all('SELECT id, nombre, rol, activo FROM usuarios WHERE activo = 1 ORDER BY nombre');
  res.json({ etapas, origenes, motivos, tipos, sedes, planes, responsables });
});

// Datos que el usuario puede vincular al crear oportunidades y actividades.
router.get('/opciones-clientes', requireAuth, async (req, res) => {
  const vendedor = isVendedor(req.user);
  const w = vendedor ? ' WHERE responsable_id = ?' : '';
  const args = vendedor ? [req.user.id] : [];
  const empresas = await db.all('SELECT id, nombre, estado FROM empresas' + w + ' ORDER BY nombre', args);
  const contactos = await db.all("SELECT id, nombre || ' ' || apellido nombre, estado, empresa_id FROM contactos" + w + ' ORDER BY apellido', args);
  const oportunidades = await db.all("SELECT id, titulo, empresa_id, contacto_id FROM oportunidades" + w + ' ORDER BY created_at DESC', args);
  res.json({ empresas, contactos, oportunidades });
});

// Resumen de Inicio: cada rol ve solo lo que le corresponde.
router.get('/resumen', requireAuth, async (req, res) => {
  const vendedor = isVendedor(req.user);
  const w = vendedor ? ' WHERE responsable_id = ?' : '';
  const args = vendedor ? [req.user.id] : [];
  const n = async (table) => (await db.get('SELECT COUNT(*) n FROM ' + table + w, args)).n;
  const opps = await db.all('SELECT etapa_id, estado, COALESCE(valor_final, valor_estimado, 0) valor FROM oportunidades' + w, args);
  const etapas = await db.all('SELECT id, nombre, color, activo FROM etapas ORDER BY orden');
  res.json({
    empresas: await n('empresas'),
    contactos: await n('contactos'),
    abiertas: opps.filter((o) => o.estado === 'abierta').length,
    ganadas: opps.filter((o) => o.estado === 'ganada').length,
    perdidas: opps.filter((o) => o.estado === 'perdida').length,
    valor_abierto: opps.filter((o) => o.estado === 'abierta').reduce((s, o) => s + o.valor, 0),
    por_etapa: etapas
      .map((e) => {
        const items = opps.filter((o) => o.etapa_id === e.id);
        return { ...e, cantidad: items.length, valor: items.reduce((s, o) => s + o.valor, 0) };
      })
      .filter((e) => e.activo || e.cantidad > 0)
  });
});

// ---------- Planes ----------
function parsePlan(body) {
  const clases = optionalNumber(body.clases_semanales, 'Las clases por semana', { min: 0, max: 14 }) || 0;
  const precio = optionalNumber(body.precio, 'El precio');
  if (precio === null) throw bad('Falta completar: precio.');
  const duracion = str(body.duracion) || 'Mensual';
  if (!['Mensual', 'Trimestral', 'Semestral', 'Anual'].includes(duracion)) throw bad('La duración no es válida.');
  return { nombre: required(body.nombre, 'nombre'), descripcion: strOrNull(body.descripcion), duracion, clases_semanales: clases, precio, activo: body.activo === false || body.activo === 0 ? 0 : 1 };
}

router.get('/planes', requireAuth, async (req, res) => {
  const where = [];
  const args = [];
  addSearch(req.query.q, ['nombre', 'descripcion'], where, args);
  if (req.query.activo === '1' || req.query.activo === '0') { where.push('activo = ?'); args.push(Number(req.query.activo)); }
  const w = where.length ? ' WHERE ' + where.join(' AND ') : '';
  const p = pageParams(req.query, 6);
  const total = (await db.get('SELECT COUNT(*) n FROM planes' + w, args)).n;
  const items = await db.all('SELECT * FROM planes' + w + ' ORDER BY activo DESC, precio LIMIT ? OFFSET ?', [...args, p.limit, p.offset]);
  res.json(pageResult(items, total, p));
});

router.post('/planes', requireAuth, adminOnly, async (req, res) => {
  const d = parsePlan(req.body);
  const id = newId();
  await db.batch([
    { sql: 'INSERT INTO planes (id,nombre,descripcion,duracion,clases_semanales,precio,activo) VALUES (?,?,?,?,?,?,?)', args: [id, d.nombre, d.descripcion, d.duracion, d.clases_semanales, d.precio, d.activo] },
    auditStmt(req.user, 'plan', id, 'Alta de plan', d.nombre)
  ]);
  res.status(201).json(await db.get('SELECT * FROM planes WHERE id = ?', [id]));
});

router.put('/planes/:id', requireAuth, adminOnly, async (req, res) => {
  const before = await db.get('SELECT * FROM planes WHERE id = ?', [req.params.id]);
  if (!before) throw notFound('El plan no existe.');
  const d = parsePlan(req.body);
  const detalle = describeChanges(before, d, { nombre: 'Nombre', descripcion: 'Descripción', duracion: 'Duración', clases_semanales: 'Clases', precio: 'Precio', activo: 'Activo' });
  await db.batch([
    { sql: 'UPDATE planes SET nombre=?,descripcion=?,duracion=?,clases_semanales=?,precio=?,activo=? WHERE id=?', args: [d.nombre, d.descripcion, d.duracion, d.clases_semanales, d.precio, d.activo, before.id] },
    detalle ? auditStmt(req.user, 'plan', before.id, 'Modificación de plan', detalle) : null
  ]);
  res.json(await db.get('SELECT * FROM planes WHERE id = ?', [before.id]));
});

router.delete('/planes/:id', requireAuth, adminOnly, async (req, res) => {
  const row = await db.get('SELECT nombre FROM planes WHERE id = ?', [req.params.id]);
  if (!row) throw notFound('El plan no existe.');
  const usos = (await db.get('SELECT COUNT(*) n FROM oportunidades WHERE plan_id = ?', [req.params.id])).n;
  if (usos > 0) throw conflict('El plan aparece en ' + usos + ' oportunidades: desactivalo en lugar de eliminarlo.');
  await db.batch([
    { sql: 'DELETE FROM planes WHERE id = ?', args: [req.params.id] },
    auditStmt(req.user, 'plan', req.params.id, 'Eliminación de plan', row.nombre)
  ]);
  res.json({ ok: true });
});

// ---------- Catálogos simples ----------
const CATALOGOS = {
  origenes: { label: 'Origen', usos: ['SELECT COUNT(*) n FROM empresas WHERE origen_id = ?', 'SELECT COUNT(*) n FROM contactos WHERE origen_id = ?', 'SELECT COUNT(*) n FROM oportunidades WHERE origen_id = ?'] },
  motivos_perdida: { label: 'Motivo de pérdida', usos: ['SELECT COUNT(*) n FROM oportunidades WHERE motivo_perdida_id = ?'] },
  tipos_actividad: { label: 'Tipo de actividad', usos: ['SELECT COUNT(*) n FROM actividades WHERE tipo_id = ?'] },
  sedes: { label: 'Sede', extra: ['direccion'], usos: ['SELECT COUNT(*) n FROM oportunidades WHERE sede_id = ?', 'SELECT COUNT(*) n FROM contactos WHERE sede_id = ?'] }
};

function catalogo(req) {
  const cfg = CATALOGOS[req.params.tabla];
  if (!cfg) throw notFound('Catálogo inexistente.');
  return cfg;
}

// Los catálogos no pueden quedar sin ningún valor activo.
async function assertQuedaOtroActivo(tabla, id) {
  const n = (await db.get('SELECT COUNT(*) n FROM ' + tabla + ' WHERE activo = 1 AND id <> ?', [id])).n;
  if (n === 0) throw conflict('Debe quedar al menos un valor activo en este catálogo.');
}

router.post('/config/:tabla', requireAuth, adminOnly, async (req, res) => {
  const cfg = catalogo(req);
  const tabla = req.params.tabla;
  const nombre = required(req.body.nombre, 'nombre');
  const dup = await db.get('SELECT id FROM ' + tabla + ' WHERE lower(nombre) = lower(?)', [nombre]);
  if (dup) throw conflict('Ya existe "' + nombre + '" en este catálogo.');
  const id = newId();
  const hasExtra = !!cfg.extra;
  await db.batch([
    {
      sql: hasExtra ? 'INSERT INTO ' + tabla + ' (id,nombre,direccion,activo) VALUES (?,?,?,1)' : 'INSERT INTO ' + tabla + ' (id,nombre,activo) VALUES (?,?,1)',
      args: hasExtra ? [id, nombre, strOrNull(req.body.direccion)] : [id, nombre]
    },
    auditStmt(req.user, tabla, id, 'Alta en configuración', cfg.label + ': ' + nombre)
  ]);
  res.status(201).json(await db.get('SELECT * FROM ' + tabla + ' WHERE id = ?', [id]));
});

router.put('/config/:tabla/:id', requireAuth, adminOnly, async (req, res) => {
  const cfg = catalogo(req);
  const tabla = req.params.tabla;
  const before = await db.get('SELECT * FROM ' + tabla + ' WHERE id = ?', [req.params.id]);
  if (!before) throw notFound();
  const nombre = required(req.body.nombre, 'nombre');
  const dup = await db.get('SELECT id FROM ' + tabla + ' WHERE lower(nombre) = lower(?) AND id <> ?', [nombre, before.id]);
  if (dup) throw conflict('Ya existe "' + nombre + '" en este catálogo.');
  const activo = req.body.activo === undefined ? before.activo : (req.body.activo ? 1 : 0);
  if (before.activo && !activo) await assertQuedaOtroActivo(tabla, before.id);
  const direccion = cfg.extra ? strOrNull(req.body.direccion) : null;
  await db.batch([
    {
      sql: cfg.extra ? 'UPDATE ' + tabla + ' SET nombre=?, direccion=?, activo=? WHERE id=?' : 'UPDATE ' + tabla + ' SET nombre=?, activo=? WHERE id=?',
      args: cfg.extra ? [nombre, direccion, activo, before.id] : [nombre, activo, before.id]
    },
    auditStmt(req.user, tabla, before.id, 'Modificación en configuración', cfg.label + ': ' + before.nombre + ' → ' + nombre + (activo ? '' : ' (inactivo)'))
  ]);
  res.json(await db.get('SELECT * FROM ' + tabla + ' WHERE id = ?', [before.id]));
});

router.delete('/config/:tabla/:id', requireAuth, adminOnly, async (req, res) => {
  const cfg = catalogo(req);
  const tabla = req.params.tabla;
  const row = await db.get('SELECT * FROM ' + tabla + ' WHERE id = ?', [req.params.id]);
  if (!row) throw notFound();
  for (const sql of cfg.usos) {
    if ((await db.get(sql, [row.id])).n > 0) throw conflict('Está en uso en registros históricos: desactivalo en lugar de eliminarlo.');
  }
  if (row.activo) await assertQuedaOtroActivo(tabla, row.id);
  await db.batch([
    { sql: 'DELETE FROM ' + tabla + ' WHERE id = ?', args: [row.id] },
    auditStmt(req.user, tabla, row.id, 'Eliminación en configuración', cfg.label + ': ' + row.nombre)
  ]);
  res.json({ ok: true });
});

// ---------- Etapas del embudo ----------
const TIPOS = ['abierta', 'ganada', 'perdida'];

async function assertQuedaEtapaDelTipo(tipo, exceptId) {
  const n = (await db.get('SELECT COUNT(*) n FROM etapas WHERE activo = 1 AND tipo = ? AND id <> ?', [tipo, exceptId])).n;
  if (n === 0) throw conflict('El embudo necesita al menos una etapa activa de tipo "' + tipo + '".');
}

function parseColor(v) {
  const c = str(v) || '#9E9E9E';
  if (!/^#[0-9a-fA-F]{6}$/.test(c)) throw bad('El color no es válido.');
  return c;
}

router.post('/etapas', requireAuth, adminOnly, async (req, res) => {
  const nombre = required(req.body.nombre, 'nombre');
  const tipo = str(req.body.tipo);
  if (!TIPOS.includes(tipo)) throw bad('El tipo de etapa no es válido.');
  const dup = await db.get('SELECT id FROM etapas WHERE lower(nombre) = lower(?)', [nombre]);
  if (dup) throw conflict('Ya existe una etapa con ese nombre.');
  const orden = ((await db.get('SELECT MAX(orden) m FROM etapas')).m || 0) + 1;
  const id = newId();
  await db.batch([
    { sql: 'INSERT INTO etapas (id,nombre,orden,tipo,color,activo) VALUES (?,?,?,?,?,1)', args: [id, nombre, orden, tipo, parseColor(req.body.color)] },
    auditStmt(req.user, 'etapa', id, 'Alta de etapa', nombre + ' (' + tipo + ')')
  ]);
  res.status(201).json(await db.get('SELECT * FROM etapas WHERE id = ?', [id]));
});

router.post('/etapas/orden', requireAuth, adminOnly, async (req, res) => {
  const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
  const actuales = await db.all('SELECT id FROM etapas');
  if (ids.length !== actuales.length || !actuales.every((e) => ids.includes(e.id))) throw bad('El orden debe incluir todas las etapas.');
  await db.batch([
    ...ids.map((id, i) => ({ sql: 'UPDATE etapas SET orden = ? WHERE id = ?', args: [i + 1, id] })),
    auditStmt(req.user, 'etapa', 'orden', 'Cambio de orden del embudo')
  ]);
  res.json(await db.all('SELECT * FROM etapas ORDER BY orden'));
});

router.put('/etapas/:id', requireAuth, adminOnly, async (req, res) => {
  const before = await db.get('SELECT * FROM etapas WHERE id = ?', [req.params.id]);
  if (!before) throw notFound('La etapa no existe.');
  const nombre = required(req.body.nombre, 'nombre');
  const tipo = str(req.body.tipo) || before.tipo;
  if (!TIPOS.includes(tipo)) throw bad('El tipo de etapa no es válido.');
  const dup = await db.get('SELECT id FROM etapas WHERE lower(nombre) = lower(?) AND id <> ?', [nombre, before.id]);
  if (dup) throw conflict('Ya existe una etapa con ese nombre.');
  const activo = req.body.activo === undefined ? before.activo : (req.body.activo ? 1 : 0);
  const enUso = (await db.get('SELECT COUNT(*) n FROM oportunidades WHERE etapa_id = ?', [before.id])).n;
  // Cambiar el tipo de una etapa en uso rompería la regla de compatibilidad etapa/estado.
  if (tipo !== before.tipo && enUso > 0) throw conflict('No se puede cambiar el tipo: hay ' + enUso + ' oportunidades en esta etapa.');
  if (before.activo && (!activo || tipo !== before.tipo)) await assertQuedaEtapaDelTipo(before.tipo, before.id);
  if (before.activo && !activo && enUso > 0) throw conflict('No se puede desactivar: hay ' + enUso + ' oportunidades en esta etapa. Movelas primero.');
  const color = parseColor(req.body.color || before.color);
  const detalle = describeChanges(before, { nombre, tipo, color, activo }, { nombre: 'Nombre', tipo: 'Tipo', color: 'Color', activo: 'Activa' });
  await db.batch([
    { sql: 'UPDATE etapas SET nombre=?, tipo=?, color=?, activo=? WHERE id=?', args: [nombre, tipo, color, activo, before.id] },
    detalle ? auditStmt(req.user, 'etapa', before.id, 'Modificación de etapa', detalle) : null
  ]);
  res.json(await db.get('SELECT * FROM etapas WHERE id = ?', [before.id]));
});

router.delete('/etapas/:id', requireAuth, adminOnly, async (req, res) => {
  const row = await db.get('SELECT * FROM etapas WHERE id = ?', [req.params.id]);
  if (!row) throw notFound('La etapa no existe.');
  const usos = (await db.get('SELECT COUNT(*) n FROM oportunidades WHERE etapa_id = ?', [row.id])).n
    + (await db.get('SELECT COUNT(*) n FROM historial_etapas WHERE etapa_nueva_id = ? OR etapa_anterior_id = ?', [row.id, row.id])).n;
  if (usos > 0) throw conflict('La etapa figura en el historial de oportunidades: desactivala en lugar de eliminarla.');
  if (row.activo) await assertQuedaEtapaDelTipo(row.tipo, row.id);
  await db.batch([
    { sql: 'DELETE FROM etapas WHERE id = ?', args: [row.id] },
    auditStmt(req.user, 'etapa', row.id, 'Eliminación de etapa', row.nombre)
  ]);
  res.json({ ok: true });
});

module.exports = router;
