// Pruebas de la API: reglas de negocio y permisos por rol. Corre contra una base temporal.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const os = require('os');
const fs = require('fs');
const path = require('path');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pulso-test-'));
process.env.TURSO_DATABASE_URL = 'file:' + path.join(dir, 'test.db').replace(/\\/g, '/');

const { ensureDatabase, PASSWORD_DEMO } = require('../seed');
const app = require('../app');
const db = require('../db');

let server, base;
const tokens = {};

async function api(rol, method, url, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (rol && tokens[rol]) headers.Authorization = 'Bearer ' + tokens[rol];
  const res = await fetch(base + '/api' + url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, body: await res.json() };
}

const USUARIOS = { admin: 'admin@pulsocrm.com', resp: 'responsable@pulsocrm.com', vend: 'vendedor@pulsocrm.com', vend2: 'vendedor2@pulsocrm.com' };
const hoy = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
const manana = () => new Date(Date.now() + 27 * 3600 * 1000).toISOString().slice(0, 10);
const nuevaOpp = (extra = {}) => ({
  titulo: 'Prueba', contacto_id: 'ct-lucia', plan_id: 'pl-estandar', sede_id: 'se-ramos', origen_id: 'or-web',
  fecha_estimada_cierre: '2030-01-01', valor_estimado: 15000, ...extra
});

before(async () => {
  await ensureDatabase();
  await new Promise((resolve) => { server = app.listen(0, resolve); });
  base = 'http://127.0.0.1:' + server.address().port;
  for (const [rol, email] of Object.entries(USUARIOS)) {
    const r = await api(null, 'POST', '/auth/login', { email, password: PASSWORD_DEMO });
    assert.strictEqual(r.status, 200);
    tokens[rol] = r.body.token;
  }
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  db.reset();
  // En Windows el archivo puede seguir bloqueado un instante; es solo una carpeta temporal.
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* se limpia con el sistema */ }
});

// ---------- Autenticación ----------
test('sin token no se accede a nada', async () => {
  for (const url of ['/oportunidades', '/empresas', '/contactos', '/usuarios', '/actividades', '/catalogos', '/resumen', '/planes']) {
    assert.strictEqual((await api(null, 'GET', url)).status, 401, url);
  }
});

test('contraseña incorrecta y usuario inactivo no ingresan', async () => {
  assert.strictEqual((await api(null, 'POST', '/auth/login', { email: USUARIOS.admin, password: 'mala' })).status, 401);
  assert.strictEqual((await api(null, 'POST', '/auth/login', { email: 'tomas.vera@pulsocrm.com', password: PASSWORD_DEMO })).status, 403);
});

test('la contraseña se guarda con hash', async () => {
  const rows = await db.all('SELECT password_hash FROM usuarios');
  rows.forEach((r) => {
    assert.ok(r.password_hash.startsWith('scrypt$'));
    assert.ok(!r.password_hash.includes(PASSWORD_DEMO));
  });
});

// ---------- Visibilidad por rol ----------
test('el vendedor solo ve lo asignado; admin y responsable ven todo', async () => {
  const todas = (await api('admin', 'GET', '/oportunidades?limit=all')).body;
  assert.strictEqual((await api('resp', 'GET', '/oportunidades?limit=all')).body.total, todas.total);
  const propias = (await api('vend', 'GET', '/oportunidades?limit=all')).body;
  assert.ok(propias.total > 0 && propias.total < todas.total);
  propias.items.forEach((o) => assert.strictEqual(o.responsable_id, 'u-vendedor'));

  const empresas = (await api('vend', 'GET', '/empresas?limit=all')).body.items;
  empresas.forEach((e) => assert.strictEqual(e.responsable_id, 'u-vendedor'));
  const contactos = (await api('vend', 'GET', '/contactos?limit=all')).body.items;
  contactos.forEach((c) => assert.strictEqual(c.responsable_id, 'u-vendedor'));
});

test('el vendedor no puede abrir ni modificar registros de otro por URL', async () => {
  assert.strictEqual((await api('vend', 'GET', '/oportunidades/op-marcos')).status, 403);
  assert.strictEqual((await api('vend', 'GET', '/empresas/em-logistica')).status, 403);
  assert.strictEqual((await api('vend', 'GET', '/contactos/ct-marcos')).status, 403);
  assert.strictEqual((await api('vend', 'POST', '/oportunidades/op-marcos/etapa', { etapa_id: 'et-propuesta' })).status, 403);
  assert.strictEqual((await api('vend', 'PUT', '/oportunidades/op-marcos', nuevaOpp())).status, 403);
  assert.strictEqual((await api('vend', 'POST', '/actividades', { tipo_id: 'ta-nota', fecha_hora: new Date().toISOString(), oportunidad_id: 'op-marcos', descripcion: 'x', resultado: 'y' })).status, 403);
  assert.strictEqual((await api('resp', 'GET', '/oportunidades/op-marcos')).status, 200);
});

test('la búsqueda y los filtros tampoco muestran datos ajenos al vendedor', async () => {
  const r = await api('vend', 'GET', '/oportunidades?q=marcos');
  assert.strictEqual(r.body.total, 0);
  const s = await api('vend', 'GET', '/oportunidades?responsable_id=u-vendedor2');
  assert.strictEqual(s.body.total, 0);
  const a = await api('vend', 'GET', '/actividades?limit=all');
  assert.ok(a.body.total > 0);
  assert.ok(!a.body.items.some((x) => x.oportunidad_id === 'op-marcos'));
});

test('usuarios y configuración son solo del administrador', async () => {
  for (const rol of ['resp', 'vend']) {
    assert.strictEqual((await api(rol, 'GET', '/usuarios')).status, 403);
    assert.strictEqual((await api(rol, 'POST', '/usuarios', { nombre: 'X', email: 'x@x.com', rol: 'administrador', password: '12345678' })).status, 403);
    assert.strictEqual((await api(rol, 'POST', '/etapas', { nombre: 'X', tipo: 'abierta' })).status, 403);
    assert.strictEqual((await api(rol, 'POST', '/etapas/orden', { ids: [] })).status, 403);
    assert.strictEqual((await api(rol, 'POST', '/config/origenes', { nombre: 'X' })).status, 403);
    assert.strictEqual((await api(rol, 'POST', '/config/motivos_perdida', { nombre: 'X' })).status, 403);
    assert.strictEqual((await api(rol, 'POST', '/config/tipos_actividad', { nombre: 'X' })).status, 403);
    assert.strictEqual((await api(rol, 'POST', '/config/sedes', { nombre: 'X' })).status, 403);
    assert.strictEqual((await api(rol, 'POST', '/planes', { nombre: 'X', precio: 1 })).status, 403);
    assert.strictEqual((await api(rol, 'GET', '/planes')).status, 200);
  }
});

test('el vendedor no reasigna; el responsable sí, y queda registrado', async () => {
  assert.strictEqual((await api('vend', 'POST', '/oportunidades/op-lucia/reasignar', { responsable_id: 'u-vendedor2' })).status, 403);
  assert.strictEqual((await api('vend', 'POST', '/empresas/em-beltran/reasignar', { responsable_id: 'u-vendedor2' })).status, 403);
  assert.strictEqual((await api('vend', 'POST', '/oportunidades', nuevaOpp({ responsable_id: 'u-vendedor2' }))).status, 403);

  assert.strictEqual((await api('resp', 'POST', '/oportunidades/op-gaston/reasignar', { responsable_id: 'u-vendedor2' })).status, 200);
  const d = (await api('resp', 'GET', '/oportunidades/op-gaston')).body;
  const reg = d.auditoria.find((a) => a.accion === 'Reasignación');
  assert.ok(reg && reg.usuario_nombre === 'Julián Roa');
  assert.strictEqual((await api('vend', 'GET', '/oportunidades/op-gaston')).status, 403);
  assert.strictEqual((await api('resp', 'POST', '/oportunidades/op-gaston/reasignar', { responsable_id: 'u-inactivo' })).status, 400);
  await api('resp', 'POST', '/oportunidades/op-gaston/reasignar', { responsable_id: 'u-vendedor' });
});

// ---------- Oportunidades: datos obligatorios ----------
test('una oportunidad exige cliente y nace en etapa abierta con historial', async () => {
  assert.strictEqual((await api('vend', 'POST', '/oportunidades', nuevaOpp({ contacto_id: null }))).status, 400);
  assert.strictEqual((await api('vend', 'POST', '/oportunidades', nuevaOpp({ etapa_id: 'et-alta' }))).status, 400);
  const r = await api('vend', 'POST', '/oportunidades', nuevaOpp());
  assert.strictEqual(r.status, 201);
  assert.strictEqual(r.body.responsable_id, 'u-vendedor');
  assert.strictEqual(r.body.estado, 'abierta');
  const d = (await api('vend', 'GET', '/oportunidades/' + r.body.id)).body;
  assert.strictEqual(d.historial.length, 1);
  assert.strictEqual(d.historial[0].etapa_anterior_id, null);
  assert.strictEqual(d.historial[0].etapa_nueva_nombre, 'Consulta recibida');
});

test('no se crean oportunidades para un cliente No contactar', async () => {
  const r = await api('resp', 'POST', '/oportunidades', nuevaOpp({ contacto_id: null, empresa_id: 'em-ferreteria' }));
  assert.strictEqual(r.status, 409);
});

test('un vendedor no vincula clientes ajenos', async () => {
  assert.strictEqual((await api('vend', 'POST', '/oportunidades', nuevaOpp({ contacto_id: 'ct-marcos' }))).status, 403);
});

// ---------- Cierre y etapas ----------
test('ganada exige fecha real y valor final; perdida exige fecha y motivo', async () => {
  const id = (await api('vend', 'POST', '/oportunidades', nuevaOpp())).body.id;
  const url = '/oportunidades/' + id + '/etapa';
  assert.strictEqual((await api('vend', 'POST', url, { etapa_id: 'et-alta' })).status, 400);
  assert.strictEqual((await api('vend', 'POST', url, { etapa_id: 'et-alta', fecha_real_cierre: hoy() })).status, 400);
  assert.strictEqual((await api('vend', 'POST', url, { etapa_id: 'et-alta', valor_final: 100 })).status, 400);
  assert.strictEqual((await api('vend', 'POST', url, { etapa_id: 'et-alta', fecha_real_cierre: manana(), valor_final: 100 })).status, 400);
  assert.strictEqual((await api('vend', 'POST', url, { etapa_id: 'et-perdida' })).status, 400);
  assert.strictEqual((await api('vend', 'POST', url, { etapa_id: 'et-perdida', fecha_real_cierre: hoy() })).status, 400);
  assert.strictEqual((await api('vend', 'POST', url, { etapa_id: 'et-perdida', motivo_perdida_id: 'mo-precio' })).status, 400);
  const ok = await api('vend', 'POST', url, { etapa_id: 'et-perdida', fecha_real_cierre: hoy(), motivo_perdida_id: 'mo-precio', observacion: 'Muy caro' });
  assert.strictEqual(ok.status, 200);
  assert.strictEqual(ok.body.estado, 'perdida');
  assert.strictEqual(ok.body.motivo_nombre, 'Precio');
});

test('cada cambio queda como registro independiente con usuario y observación', async () => {
  const id = (await api('vend', 'POST', '/oportunidades', nuevaOpp())).body.id;
  await api('vend', 'POST', '/oportunidades/' + id + '/etapa', { etapa_id: 'et-agendada', observacion: 'Viene el martes' });
  await api('vend', 'POST', '/oportunidades/' + id + '/etapa', { etapa_id: 'et-realizada' });
  const { historial } = (await api('vend', 'GET', '/oportunidades/' + id)).body;
  assert.strictEqual(historial.length, 3);
  assert.strictEqual(historial[1].etapa_anterior_nombre, 'Consulta recibida');
  assert.strictEqual(historial[1].etapa_nueva_nombre, 'Clase de prueba agendada');
  assert.strictEqual(historial[1].observacion, 'Viene el martes');
  assert.strictEqual(historial[2].usuario_nombre, 'Cam Novoa');
  assert.ok(historial[2].fecha_hora);
});

test('una cerrada no se reabre ni modifica sin autorización, y queda registrado', async () => {
  const id = (await api('vend', 'POST', '/oportunidades', nuevaOpp())).body.id;
  const url = '/oportunidades/' + id;
  await api('vend', 'POST', url + '/etapa', { etapa_id: 'et-alta', fecha_real_cierre: hoy(), valor_final: 15000 });

  // Vendedor: bloqueado, incluso pasando de ganada a perdida o editando.
  assert.strictEqual((await api('vend', 'POST', url + '/etapa', { etapa_id: 'et-consulta', autorizacion: 'x' })).status, 403);
  assert.strictEqual((await api('vend', 'POST', url + '/etapa', { etapa_id: 'et-perdida', fecha_real_cierre: hoy(), motivo_perdida_id: 'mo-precio' })).status, 403);
  assert.strictEqual((await api('vend', 'PUT', url, nuevaOpp({ titulo: 'Cambiado' }))).status, 403);

  // Responsable: necesita indicar la autorización.
  assert.strictEqual((await api('resp', 'POST', url + '/etapa', { etapa_id: 'et-consulta' })).status, 400);
  assert.strictEqual((await api('resp', 'PUT', url, nuevaOpp({ titulo: 'Cambiado' }))).status, 400);
  const edit = await api('resp', 'PUT', url, nuevaOpp({ titulo: 'Cambiado', autorizacion: 'Error de carga' }));
  assert.strictEqual(edit.status, 200);
  assert.strictEqual(edit.body.estado, 'ganada');

  const re = await api('resp', 'POST', url + '/etapa', { etapa_id: 'et-consulta', autorizacion: 'El socio se arrepintió' });
  assert.strictEqual(re.status, 200);
  assert.strictEqual(re.body.estado, 'abierta');
  assert.strictEqual(re.body.fecha_real_cierre, null);
  assert.strictEqual(re.body.valor_final, null);

  const d = (await api('resp', 'GET', url)).body;
  assert.ok(d.auditoria.some((a) => a.accion === 'Modificación de oportunidad cerrada' && a.detalle.includes('Error de carga')));
  assert.ok(d.auditoria.some((a) => a.accion === 'Reapertura autorizada' && a.usuario_nombre === 'Julián Roa'));
  assert.ok(d.historial[d.historial.length - 1].observacion.includes('El socio se arrepintió'));
});

test('la edición no permite saltear las reglas de etapa', async () => {
  const id = (await api('vend', 'POST', '/oportunidades', nuevaOpp())).body.id;
  const r = await api('vend', 'PUT', '/oportunidades/' + id, nuevaOpp({ etapa_id: 'et-alta', estado: 'ganada' }));
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body.estado, 'abierta');
  assert.strictEqual(r.body.etapa_id, 'et-consulta');
});

test('el Alta convierte al interesado en cliente', async () => {
  const c = (await api('vend', 'POST', '/contactos', { nombre: 'Ana', apellido: 'Test', origen_id: 'or-web' })).body;
  assert.strictEqual(c.estado, 'Potencial');
  const id = (await api('vend', 'POST', '/oportunidades', nuevaOpp({ contacto_id: c.id }))).body.id;
  await api('vend', 'POST', '/oportunidades/' + id + '/etapa', { etapa_id: 'et-alta', fecha_real_cierre: hoy(), valor_final: 15000 });
  assert.strictEqual((await api('vend', 'GET', '/contactos/' + c.id)).body.contacto.estado, 'Cliente');
});

// ---------- Actividades ----------
test('actividad: solo hechos pasados, con relación, y el usuario lo pone el servidor', async () => {
  const b = { tipo_id: 'ta-llamada', contacto_id: 'ct-lucia', descripcion: 'Llamada', resultado: 'Atendió' };
  const futuro = new Date(Date.now() + 3600 * 1000).toISOString();
  assert.strictEqual((await api('vend', 'POST', '/actividades', { ...b, fecha_hora: futuro })).status, 400);
  assert.strictEqual((await api('vend', 'POST', '/actividades', { ...b, contacto_id: null, fecha_hora: new Date().toISOString() })).status, 400);
  assert.strictEqual((await api('vend', 'POST', '/actividades', { ...b, descripcion: '', fecha_hora: new Date().toISOString() })).status, 400);
  const ok = await api('vend', 'POST', '/actividades', { ...b, usuario_id: 'u-admin', fecha_hora: new Date(Date.now() - 60000).toISOString() });
  assert.strictEqual(ok.status, 201);
  assert.strictEqual(ok.body.usuario_nombre, 'Cam Novoa');
});

test('el historial cronológico aparece en empresa, contacto y oportunidad', async () => {
  const fecha = new Date(Date.now() - 1000).toISOString();
  const a = await api('vend', 'POST', '/actividades', { tipo_id: 'ta-nota', oportunidad_id: 'op-beltran', fecha_hora: fecha, descripcion: 'Vinculada', resultado: 'OK' });
  assert.strictEqual(a.status, 201);
  for (const [url, key] of [['/oportunidades/op-beltran', 'oportunidad'], ['/empresas/em-beltran', 'empresa'], ['/contactos/ct-rocio', 'contacto']]) {
    const lista = (await api('vend', 'GET', url)).body.actividades;
    assert.ok(lista.some((x) => x.descripcion === 'Vinculada'), key);
    const fechas = lista.map((x) => x.fecha_hora);
    assert.deepStrictEqual(fechas, [...fechas].sort().reverse(), key + ' ordenada');
  }
});

// ---------- Baja lógica ----------
test('con historial no hay borrado físico; sin historial solo borra el admin', async () => {
  assert.strictEqual((await api('admin', 'DELETE', '/empresas/em-beltran')).status, 409);
  assert.strictEqual((await api('admin', 'DELETE', '/contactos/ct-rocio')).status, 409);
  const c = (await api('vend', 'POST', '/contactos', { nombre: 'Sin', apellido: 'Historial', origen_id: 'or-web' })).body;
  assert.strictEqual((await api('vend', 'DELETE', '/contactos/' + c.id)).status, 403);
  assert.strictEqual((await api('resp', 'DELETE', '/contactos/' + c.id)).status, 403);
  assert.strictEqual((await api('admin', 'DELETE', '/contactos/' + c.id)).status, 200);
});

test('la baja lógica conserva el registro y su historial', async () => {
  const r = await api('vend', 'POST', '/empresas/em-escuela/baja', { estado: 'Inactivo' });
  assert.strictEqual(r.status, 200);
  const d = (await api('vend', 'GET', '/empresas/em-escuela')).body;
  assert.strictEqual(d.empresa.estado, 'Inactivo');
  assert.ok(d.oportunidades.length > 0);
  assert.ok(d.auditoria.some((a) => a.accion === 'Baja lógica'));
});

test('empresa: valida CUIT y estado', async () => {
  const b = { nombre: 'X', origen_id: 'or-web' };
  assert.strictEqual((await api('vend', 'POST', '/empresas', { ...b, cuit: '123' })).status, 400);
  assert.strictEqual((await api('vend', 'POST', '/empresas', { ...b, estado: 'Otro' })).status, 400);
  assert.strictEqual((await api('vend', 'POST', '/empresas', { ...b, nombre: '' })).status, 400);
  assert.strictEqual((await api('vend', 'POST', '/empresas', { ...b, cuit: '30-71234567-9' })).status, 201);
});

// ---------- Gestión de usuarios ----------
test('ABM de usuarios: alta, rol, inactivo corta la sesión, último admin protegido', async () => {
  const u = await api('admin', 'POST', '/usuarios', { nombre: 'Nuevo', email: 'nuevo@pulsocrm.com', rol: 'vendedor', password: 'clave1234' });
  assert.strictEqual(u.status, 201);
  assert.strictEqual(u.body.password_hash, undefined);
  assert.strictEqual((await api('admin', 'POST', '/usuarios', { nombre: 'Otro', email: 'NUEVO@pulsocrm.com', rol: 'vendedor', password: 'clave1234' })).status, 409);
  const login = await api(null, 'POST', '/auth/login', { email: 'nuevo@pulsocrm.com', password: 'clave1234' });
  assert.strictEqual(login.status, 200);
  tokens.nuevo = login.body.token;
  assert.strictEqual((await api('nuevo', 'GET', '/usuarios')).status, 403);

  assert.strictEqual((await api('admin', 'PUT', '/usuarios/' + u.body.id, { nombre: 'Nuevo', email: 'nuevo@pulsocrm.com', rol: 'responsable' })).body.rol, 'responsable');
  assert.strictEqual((await api('nuevo', 'GET', '/oportunidades/op-marcos')).status, 200);

  await api('admin', 'PUT', '/usuarios/' + u.body.id, { nombre: 'Nuevo', email: 'nuevo@pulsocrm.com', rol: 'responsable', activo: false });
  assert.strictEqual((await api('nuevo', 'GET', '/oportunidades')).status, 401);
  assert.strictEqual((await api('admin', 'PUT', '/usuarios/u-admin', { nombre: 'S', email: USUARIOS.admin, rol: 'vendedor' })).status, 409);
  assert.strictEqual((await api('admin', 'PUT', '/usuarios/u-vendedor', { nombre: 'Cam Novoa', email: USUARIOS.vend, rol: 'vendedor', activo: false })).status, 409);
});

// ---------- Configuración ----------
test('etapas: ABM, orden y protecciones del embudo', async () => {
  const nueva = await api('admin', 'POST', '/etapas', { nombre: 'Evaluación física', tipo: 'abierta' });
  assert.strictEqual(nueva.status, 201);
  const etapas = (await api('admin', 'GET', '/catalogos')).body.etapas;
  const ids = etapas.map((e) => e.id);
  ids.splice(ids.indexOf(nueva.body.id), 1);
  ids.splice(1, 0, nueva.body.id);
  const orden = await api('admin', 'POST', '/etapas/orden', { ids });
  assert.strictEqual(orden.body[1].nombre, 'Evaluación física');

  assert.strictEqual((await api('admin', 'PUT', '/etapas/et-consulta', { nombre: 'Consulta recibida', tipo: 'ganada' })).status, 409);
  assert.strictEqual((await api('admin', 'PUT', '/etapas/et-alta', { nombre: 'Alta', activo: false })).status, 409);
  assert.strictEqual((await api('admin', 'DELETE', '/etapas/et-consulta')).status, 409);
  assert.strictEqual((await api('admin', 'DELETE', '/etapas/' + nueva.body.id)).status, 200);
});

test('catálogos: ABM y protección de valores usados', async () => {
  for (const tabla of ['origenes', 'motivos_perdida', 'tipos_actividad', 'sedes']) {
    const r = await api('admin', 'POST', '/config/' + tabla, { nombre: 'Valor nuevo' });
    assert.strictEqual(r.status, 201, tabla);
    assert.strictEqual((await api('admin', 'POST', '/config/' + tabla, { nombre: 'valor nuevo' })).status, 409, tabla);
    assert.strictEqual((await api('admin', 'PUT', '/config/' + tabla + '/' + r.body.id, { nombre: 'Valor editado' })).body.nombre, 'Valor editado');
    assert.strictEqual((await api('admin', 'DELETE', '/config/' + tabla + '/' + r.body.id)).status, 200, tabla);
  }
  assert.strictEqual((await api('admin', 'DELETE', '/config/origenes/or-web')).status, 409);
  assert.strictEqual((await api('admin', 'DELETE', '/config/motivos_perdida/mo-precio')).status, 409);
  assert.strictEqual((await api('admin', 'POST', '/config/usuarios', { nombre: 'x' })).status, 404);
  const off = await api('admin', 'PUT', '/config/motivos_perdida/mo-horarios', { nombre: 'Horarios', activo: false });
  assert.strictEqual(off.body.activo, 0);
  await api('admin', 'PUT', '/config/motivos_perdida/mo-horarios', { nombre: 'Horarios', activo: true });
});

test('planes: ABM con baja lógica si está en uso', async () => {
  const p = await api('admin', 'POST', '/planes', { nombre: 'Pase Yoga', precio: 12000, duracion: 'Mensual', clases_semanales: 2 });
  assert.strictEqual(p.status, 201);
  assert.strictEqual((await api('admin', 'PUT', '/planes/' + p.body.id, { nombre: 'Pase Yoga', precio: 13000 })).body.precio, 13000);
  assert.strictEqual((await api('admin', 'DELETE', '/planes/' + p.body.id)).status, 200);
  assert.strictEqual((await api('admin', 'DELETE', '/planes/pl-estandar')).status, 409);
  assert.strictEqual((await api('vend', 'POST', '/oportunidades', nuevaOpp({ plan_id: 'pl-verano' }))).status, 400);
});

// ---------- Listas ----------
test('búsqueda sin acentos, filtros combinados y paginación', async () => {
  const q = await api('admin', 'GET', '/contactos?q=rocio');
  assert.ok(q.body.items.some((c) => c.nombre === 'Rocío'));
  const nombreCompleto = await api('admin', 'GET', '/contactos?q=' + encodeURIComponent('Lucía Farías'));
  assert.strictEqual(nombreCompleto.body.total, 1);
  const pg = await api('admin', 'GET', '/oportunidades?limit=5&page=2');
  assert.strictEqual(pg.body.items.length, 5);
  assert.strictEqual(pg.body.page, 2);
  assert.ok(pg.body.pages >= 2);
  const f = await api('admin', 'GET', '/oportunidades?estado=perdida&origen_id=or-web&responsable_id=u-vendedor');
  assert.ok(f.body.total >= 1);
  f.body.items.forEach((o) => {
    assert.strictEqual(o.estado, 'perdida');
    assert.strictEqual(o.origen_id, 'or-web');
    assert.strictEqual(o.responsable_id, 'u-vendedor');
  });
  const et = await api('admin', 'GET', '/oportunidades?etapa_id=et-alta');
  et.body.items.forEach((o) => assert.strictEqual(o.etapa_tipo, 'ganada'));
  const e = await api('admin', 'GET', '/empresas?estado=Cliente');
  e.body.items.forEach((x) => assert.strictEqual(x.estado, 'Cliente'));
});

test('datos del gimnasio cargados', async () => {
  const c = (await api('admin', 'GET', '/catalogos')).body;
  assert.deepStrictEqual(
    c.etapas.filter((e) => e.activo).map((e) => e.nombre),
    ['Consulta recibida', 'Clase de prueba agendada', 'Clase de prueba realizada', 'Propuesta de plan', 'Negociación', 'Alta', 'Perdida']
  );
  assert.deepStrictEqual(c.motivos.map((m) => m.nombre).sort(), ['Distancia', 'Eligió otro gimnasio', 'Horarios', 'Precio']);
  assert.deepStrictEqual(c.origenes.map((m) => m.nombre).sort(), ['Instagram', 'Pasó por el local', 'Referido', 'Web', 'WhatsApp']);
  const res = (await api('vend', 'GET', '/resumen')).body;
  const resAdmin = (await api('admin', 'GET', '/resumen')).body;
  assert.ok(res.abiertas < resAdmin.abiertas);
});

test('todas las oportunidades respetan las reglas de cierre y no hay actividades futuras', async () => {
  const rows = await db.all('SELECT o.*, e.tipo FROM oportunidades o JOIN etapas e ON e.id = o.etapa_id');
  rows.forEach((o) => {
    assert.strictEqual(o.estado, o.tipo, o.titulo);
    if (o.estado === 'ganada') assert.ok(o.fecha_real_cierre && o.valor_final, o.titulo);
    if (o.estado === 'perdida') assert.ok(o.fecha_real_cierre && o.motivo_perdida_id, o.titulo);
    if (o.estado === 'abierta') assert.ok(!o.fecha_real_cierre && !o.valor_final, o.titulo);
  });
  const fut = await db.get('SELECT COUNT(*) n FROM actividades WHERE fecha_hora > ?', [new Date().toISOString()]);
  assert.strictEqual(fut.n, 0);
});
