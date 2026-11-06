const express = require('express');
const { HttpError } = require('./lib');
const { requireAuth } = require('./auth');

const app = express();

// El frontend publicado en GitHub Pages llama a esta API desde otro dominio.
const ORIGENES_PERMITIDOS = (process.env.CORS_ORIGIN || 'https://marcopalmiericirco.github.io')
  .split(',').map((s) => s.trim()).filter(Boolean);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  const local = origin && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  if (origin && (ORIGENES_PERMITIDOS.includes(origin) || local)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Max-Age', '600');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.json({ limit: '200kb' }));

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/usuarios', requireAuth, require('./routes/usuarios'));
app.use('/api/oportunidades', requireAuth, require('./routes/oportunidades'));
app.use('/api/actividades', requireAuth, require('./routes/actividades'));
app.use('/api', require('./routes/config'));
app.use('/api', requireAuth, require('./routes/clientes'));

app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta inexistente.' }));

app.use((err, req, res, next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'El cuerpo del pedido no es JSON válido.' });
  console.error(err);
  res.status(500).json({ error: 'Ocurrió un error en el servidor. Probá de nuevo.' });
});

module.exports = app;
