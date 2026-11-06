// Servidor local: API + frontend en http://localhost:8420. Crea y carga la base si está vacía.
const path = require('path');
const express = require('express');
const app = require('./app');
const { ensureDatabase } = require('./seed');

const ROOT = path.join(__dirname, '..');
const PORT = process.env.PORT || 8420;

// Solo se publica el frontend, nunca el código del servidor ni la base.
app.use('/css', express.static(path.join(ROOT, 'css')));
app.use('/js', express.static(path.join(ROOT, 'js')));
app.get(/^\/([a-z-]+\.html)?$/, (req, res, next) => {
  res.sendFile(req.params[0] || 'index.html', { root: ROOT }, (err) => { if (err) next(); });
});

ensureDatabase().then(() => {
  app.listen(PORT, () => console.log('Pulso CRM en http://localhost:' + PORT));
}).catch((err) => {
  console.error('No se pudo preparar la base de datos:', err);
  process.exit(1);
});
