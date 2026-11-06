// Autenticación por token (bearer) y permisos por rol. El frontend está en otro
// dominio (GitHub Pages), por eso se usa un encabezado y no una cookie de terceros.
const crypto = require('crypto');
const db = require('./db');
const { HttpError, forbidden, notFound, sha256, nowIso } = require('./lib');

const SESSION_HOURS = 12;
const ROLES = { ADMIN: 'administrador', RESPONSABLE: 'responsable', VENDEDOR: 'vendedor' };

async function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + SESSION_HOURS * 3600 * 1000).toISOString();
  await db.run('INSERT INTO sesiones (token_hash, usuario_id, expires_at, created_at) VALUES (?,?,?,?)',
    [sha256(token), userId, expires, nowIso()]);
  return token;
}

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) throw new HttpError(401, 'Iniciá sesión para continuar.');
  // El rol y el estado se leen de la base en cada pedido: un cambio aplica de inmediato.
  const user = await db.get(
    `SELECT u.id, u.nombre, u.email, u.rol, u.activo FROM sesiones s
     JOIN usuarios u ON u.id = s.usuario_id
     WHERE s.token_hash = ? AND s.expires_at > ?`,
    [sha256(token), nowIso()]
  );
  if (!user || !user.activo) throw new HttpError(401, 'Tu sesión no es válida. Iniciá sesión de nuevo.');
  req.user = user;
  req.tokenHash = sha256(token);
  next();
}

const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.rol)) throw forbidden();
  next();
};

const isVendedor = (user) => user.rol === ROLES.VENDEDOR;
const canSupervise = (user) => user.rol === ROLES.ADMIN || user.rol === ROLES.RESPONSABLE;

// Condición SQL que limita al vendedor a lo que tiene asignado.
function scopeTo(user, alias, where, args) {
  if (isVendedor(user)) {
    where.push(alias + '.responsable_id = ?');
    args.push(user.id);
  }
}

function assertOwner(user, record, label) {
  if (!record) throw notFound(label + ' no existe.');
  if (isVendedor(user) && record.responsable_id !== user.id) {
    throw forbidden('No tenés asignado este registro (' + label.toLowerCase() + ' de otro responsable).');
  }
}

module.exports = { ROLES, createSession, requireAuth, requireRole, isVendedor, canSupervise, scopeTo, assertOwner };
