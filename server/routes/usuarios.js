const express = require('express');
const db = require('../db');
const { ROLES, requireRole } = require('../auth');
const lib = require('../lib');
const { bad, conflict, notFound, required, validEmail, str, newId, nowIso, addSearch, pageParams, pageResult, auditStmt, describeChanges } = lib;

const router = express.Router();
const ROLES_VALIDOS = Object.values(ROLES);
const ROL_LABEL = { administrador: 'Administrador', responsable: 'Responsable comercial', vendedor: 'Vendedor' };
const COLS = 'id, nombre, email, rol, activo, created_at, updated_at';

// Solo el administrador gestiona usuarios.
router.use(requireRole(ROLES.ADMIN));

router.get('/', async (req, res) => {
  const where = [];
  const args = [];
  addSearch(req.query.q, ['nombre', 'email'], where, args);
  if (req.query.rol) { where.push('rol = ?'); args.push(req.query.rol); }
  if (req.query.activo === '1' || req.query.activo === '0') { where.push('activo = ?'); args.push(Number(req.query.activo)); }
  const w = where.length ? ' WHERE ' + where.join(' AND ') : '';
  const p = pageParams(req.query);
  const total = (await db.get('SELECT COUNT(*) n FROM usuarios' + w, args)).n;
  const items = await db.all('SELECT ' + COLS + ' FROM usuarios' + w + ' ORDER BY nombre LIMIT ? OFFSET ?', [...args, p.limit, p.offset]);
  res.json(pageResult(items, total, p));
});

function parse(body) {
  const nombre = required(body.nombre, 'nombre');
  const email = validEmail(required(body.email, 'email'), 'El email');
  const rol = str(body.rol);
  if (!ROLES_VALIDOS.includes(rol)) throw bad('El rol no es válido.');
  return { nombre, email, rol };
}

async function assertEmailLibre(email, exceptId) {
  const other = await db.get('SELECT id FROM usuarios WHERE email = ? AND id <> ?', [email, exceptId || '']);
  if (other) throw conflict('Ya existe un usuario con ese email.');
}

function parsePassword(v) {
  const p = String(v || '');
  if (p.length < 8) throw bad('La contraseña debe tener al menos 8 caracteres.');
  return p;
}

router.post('/', async (req, res) => {
  const data = parse(req.body);
  const password = parsePassword(req.body.password);
  await assertEmailLibre(data.email);
  const id = newId();
  const now = nowIso();
  await db.batch([
    {
      sql: 'INSERT INTO usuarios (id, nombre, email, password_hash, rol, activo, created_at, updated_at) VALUES (?,?,?,?,?,1,?,?)',
      args: [id, data.nombre, data.email, await lib.hashPassword(password), data.rol, now, now]
    },
    auditStmt(req.user, 'usuario', id, 'Alta de usuario', data.nombre + ' (' + ROL_LABEL[data.rol] + ')')
  ]);
  res.status(201).json(await db.get('SELECT ' + COLS + ' FROM usuarios WHERE id = ?', [id]));
});

// Siempre debe quedar al menos un administrador activo.
async function assertNoEsUltimoAdmin(id) {
  const n = (await db.get("SELECT COUNT(*) n FROM usuarios WHERE rol = 'administrador' AND activo = 1 AND id <> ?", [id])).n;
  if (n === 0) throw conflict('Debe quedar al menos un administrador activo.');
}

router.put('/:id', async (req, res) => {
  const before = await db.get('SELECT * FROM usuarios WHERE id = ?', [req.params.id]);
  if (!before) throw notFound('El usuario no existe.');
  const data = parse(req.body);
  const activo = req.body.activo === undefined ? before.activo : (req.body.activo ? 1 : 0);
  await assertEmailLibre(data.email, before.id);
  if (before.rol === ROLES.ADMIN && before.activo && (data.rol !== ROLES.ADMIN || !activo)) await assertNoEsUltimoAdmin(before.id);

  // Un usuario inactivo no puede quedar a cargo de negociaciones en curso.
  if (before.activo && !activo) {
    const open = (await db.get("SELECT COUNT(*) n FROM oportunidades WHERE responsable_id = ? AND estado = 'abierta'", [before.id])).n;
    if (open > 0) throw conflict('Tiene ' + open + ' oportunidades abiertas. Reasignalas antes de desactivarlo.');
  }

  const stmts = [{
    sql: 'UPDATE usuarios SET nombre = ?, email = ?, rol = ?, activo = ?, updated_at = ? WHERE id = ?',
    args: [data.nombre, data.email, data.rol, activo, nowIso(), before.id]
  }];
  if (req.body.password) {
    stmts.push({ sql: 'UPDATE usuarios SET password_hash = ? WHERE id = ?', args: [await lib.hashPassword(parsePassword(req.body.password)), before.id] });
    stmts.push({ sql: 'DELETE FROM sesiones WHERE usuario_id = ?', args: [before.id] });
    stmts.push(auditStmt(req.user, 'usuario', before.id, 'Restablecimiento de contraseña'));
  }
  if (!activo) stmts.push({ sql: 'DELETE FROM sesiones WHERE usuario_id = ?', args: [before.id] });
  const fmt = (u) => ({ nombre: u.nombre, email: u.email, rol: ROL_LABEL[u.rol], estado: u.activo ? 'Activo' : 'Inactivo' });
  const detalle = describeChanges(fmt(before), fmt({ ...data, activo }), { nombre: 'Nombre', email: 'Email', rol: 'Rol', estado: 'Estado' });
  if (detalle) stmts.push(auditStmt(req.user, 'usuario', before.id, 'Modificación de usuario', detalle));
  await db.batch(stmts);
  res.json(await db.get('SELECT ' + COLS + ' FROM usuarios WHERE id = ?', [before.id]));
});

module.exports = router;
