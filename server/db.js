// Acceso a datos. En produccion usa Turso (HTTP, sin binarios nativos);
// en local usa un archivo SQLite con el mismo dialecto y la misma API.
const path = require('path');
const fs = require('fs');

let client = null;

function getClient() {
  if (client) return client;
  let url = process.env.TURSO_DATABASE_URL;
  if (!url) {
    const dir = path.join(__dirname, '..', 'data');
    fs.mkdirSync(dir, { recursive: true });
    url = 'file:' + path.join(dir, 'pulso.db').replace(/\\/g, '/');
  }
  const { createClient } = url.startsWith('file:')
    ? require('@libsql/client')
    : require('@libsql/client/web');
  client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  return client;
}

function toObjects(result) {
  return result.rows.map((row) => {
    const obj = {};
    result.columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  });
}

async function all(sql, args = []) {
  return toObjects(await getClient().execute({ sql, args }));
}

async function get(sql, args = []) {
  return (await all(sql, args))[0] || null;
}

async function run(sql, args = []) {
  return getClient().execute({ sql, args });
}

// Ejecuta varias sentencias de forma atomica: o se aplican todas o ninguna.
async function batch(statements) {
  return getClient().batch(statements.filter(Boolean), 'write');
}

function reset() {
  if (client) client.close();
  client = null;
}

module.exports = { all, get, run, batch, reset };
