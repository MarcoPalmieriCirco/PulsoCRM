// Punto de entrada que detecta Vercel: expone la misma app que corre en local.
// (Vercel busca un archivo en esta ubicación que importe express.)
require('express');
module.exports = require('./server/app');
