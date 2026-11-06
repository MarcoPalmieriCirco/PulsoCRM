const express = require('express');
const db = require('../db');
const { createSession, requireAuth } = require('../auth');
const { HttpError, hashPassword, verifyPassword, bad, str, auditStmt, nowIso } = require('../lib');

const router = express.Router();
const publicUser = ({ id, nombre, email, rol }) => ({ id, nombre, email, rol });

// Hash fijo para que un email inexistente tarde lo mismo que uno válido.
const hashFalso = hashPassword('pulso-usuario-inexistente');

router.post('/login', async (req, res) => {
  const email = str(req.body.email);
  const password = String(req.body.password || '');
  if (!email || !password) throw bad('Ingresá email y contraseña.');
  const user = await db.get('SELECT * FROM usuarios WHERE email = ?', [email]);
  const ok = await verifyPassword(password, user ? user.password_hash : await hashFalso);
  if (!user || !ok) throw new HttpError(401, 'Email o contraseña incorrectos.');
  if (!user.activo) throw new HttpError(403, 'Tu usuario está inactivo. Consultá con el administrador.');
  await db.run('DELETE FROM sesiones WHERE expires_at < ?', [nowIso()]);
  const token = await createSession(user.id);
  res.json({ token, user: publicUser(user) });
});

router.post('/logout', requireAuth, async (req, res) => {
  await db.run('DELETE FROM sesiones WHERE token_hash = ?', [req.tokenHash]);
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

router.post('/password', requireAuth, async (req, res) => {
  const actual = String(req.body.actual || '');
  const nueva = String(req.body.nueva || '');
  if (nueva.length < 8) throw bad('La contraseña nueva debe tener al menos 8 caracteres.');
  const user = await db.get('SELECT password_hash FROM usuarios WHERE id = ?', [req.user.id]);
  if (!(await verifyPassword(actual, user.password_hash))) throw bad('La contraseña actual no es correcta.');
  await db.batch([
    { sql: 'UPDATE usuarios SET password_hash = ?, updated_at = ? WHERE id = ?', args: [await hashPassword(nueva), nowIso(), req.user.id] },
    auditStmt(req.user, 'usuario', req.user.id, 'Cambio de contraseña')
  ]);
  res.json({ ok: true });
});

module.exports = router;
