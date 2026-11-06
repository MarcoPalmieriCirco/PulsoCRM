const crypto = require('crypto');
const { promisify } = require('util');
const scrypt = promisify(crypto.scrypt);

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const bad = (msg) => new HttpError(400, msg);
const forbidden = (msg) => new HttpError(403, msg || 'Tu rol no tiene permiso para esta acción.');
const notFound = (msg) => new HttpError(404, msg || 'No encontrado.');
const conflict = (msg) => new HttpError(409, msg);

const newId = () => crypto.randomUUID();
const nowIso = () => new Date().toISOString();
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

// ---------- Contraseñas (scrypt con sal aleatoria) ----------
async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const key = await scrypt(password, salt, 64);
  return 'scrypt$' + salt + '$' + key.toString('hex');
}

async function verifyPassword(password, stored) {
  const [, salt, hash] = String(stored).split('$');
  if (!salt || !hash) return false;
  const key = await scrypt(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return expected.length === key.length && crypto.timingSafeEqual(expected, key);
}

// ---------- Texto ----------
const str = (v) => (v === undefined || v === null ? '' : String(v).trim());
const strOrNull = (v) => str(v) || null;

function required(value, label) {
  const s = str(value);
  if (!s) throw bad('Falta completar: ' + label + '.');
  return s;
}

function optionalNumber(v, label, { min = 0, max = Infinity } = {}) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) throw bad(label + ' no es un valor válido.');
  return n;
}

function validEmail(v, label = 'El correo electrónico') {
  const s = str(v);
  if (s && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) throw bad(label + ' no es válido.');
  return s || null;
}

function validDate(v, label) {
  const s = required(v, label);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || isNaN(Date.parse(s))) throw bad(label + ' no es una fecha válida.');
  return s;
}

// Fecha de hoy en Argentina: evita rechazar un cierre de hoy cuando en UTC ya es mañana.
function todayAr() {
  return new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
}

// ---------- Búsqueda sin distinguir mayúsculas ni acentos ----------
const ACENTOS = [['á', 'a'], ['é', 'e'], ['í', 'i'], ['ó', 'o'], ['ú', 'u'], ['ñ', 'n'], ['Á', 'a'], ['É', 'e'], ['Í', 'i'], ['Ó', 'o'], ['Ú', 'u'], ['Ñ', 'n']];

function normSql(expr) {
  return ACENTOS.reduce((acc, [a, b]) => "replace(" + acc + ",'" + a + "','" + b + "')", 'lower(' + expr + ')');
}

function normQ(q) {
  return str(q).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Agrega "(col1 LIKE ? OR col2 LIKE ?)" a where/args si hay texto de búsqueda.
function addSearch(q, columns, where, args) {
  const term = normQ(q);
  if (!term) return;
  const pattern = '%' + term.replace(/[%_\\]/g, (m) => '\\' + m) + '%';
  where.push('(' + columns.map((c) => normSql("COALESCE(" + c + ",'')") + " LIKE ? ESCAPE '\\'").join(' OR ') + ')');
  columns.forEach(() => args.push(pattern));
}

// ---------- Paginación ----------
function pageParams(query, defaultLimit = 8) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const raw = query.limit === 'all' ? 1000 : parseInt(query.limit, 10);
  const limit = Math.min(1000, Math.max(1, raw || defaultLimit));
  return { page, limit, offset: (page - 1) * limit };
}

function pageResult(items, total, { page, limit }) {
  return { items, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) };
}

// ---------- Auditoría ----------
function auditStmt(user, entidad, entidadId, accion, detalle) {
  return {
    sql: 'INSERT INTO auditoria (id, entidad, entidad_id, accion, detalle, usuario_id, fecha_hora) VALUES (?,?,?,?,?,?,?)',
    args: [newId(), entidad, entidadId, accion, detalle || null, user.id, nowIso()]
  };
}

// Compara dos registros y describe solo los campos que cambiaron.
function describeChanges(before, after, fields) {
  const show = (v) => (v === undefined || v === null || v === '' ? '(vacío)' : v);
  const out = [];
  Object.keys(fields).forEach((key) => {
    const a = show(before[key]);
    const b = show(after[key]);
    if (String(a) !== String(b)) out.push(fields[key] + ': ' + a + ' → ' + b);
  });
  return out.join(' · ');
}

module.exports = {
  HttpError, bad, forbidden, notFound, conflict,
  newId, nowIso, sha256, hashPassword, verifyPassword,
  str, strOrNull, required, optionalNumber, validEmail, validDate, todayAr,
  addSearch, pageParams, pageResult, auditStmt, describeChanges
};
