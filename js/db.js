// Capa de persistencia sobre localStorage. Toda la información creada durante
// la demo (empresas, contactos, oportunidades) se guarda acá y sobrevive a un
// refresh de la página.
window.Pulso = window.Pulso || {};

Pulso.db = (function () {
  const NS = 'pulso_';
  const SEED_FLAG = NS + 'seeded_v1';

  function load(key, fallback) {
    try {
      const raw = localStorage.getItem(NS + key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      console.error('Error leyendo', key, e);
      return fallback;
    }
  }

  function save(key, value) {
    localStorage.setItem(NS + key, JSON.stringify(value));
  }

  function uid(prefix) {
    return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  // ---------- Seed ----------
  function seed() {
    if (localStorage.getItem(SEED_FLAG)) return;

    const users = [
      { id: 'u1', nombre: 'Cam N.', email: 'cam@pulsocrm.com', password: 'pulso123', rol: 'Vendedor' },
      { id: 'u2', nombre: 'Julián Roa', email: 'julian@pulsocrm.com', password: 'pulso123', rol: 'Vendedor' }
    ];

    const empresas = [
      { id: 'emp1', nombre: 'Sport Club - Sede Ramos Mejía', cuit: '30-71234567-9', industria: 'Cadena de gimnasios', email: 'administracion@sportclub.com.ar', telefono: '+54 11 4555-1020', direccion: 'Av. de Mayo 1450, Ramos Mejía', sitioWeb: 'sportclub.com.ar', estado: 'Cliente', responsableId: 'u1', origen: 'Recomendación', observaciones: '', createdAt: '2026-08-01T10:00:00.000Z' },
      { id: 'emp2', nombre: 'Estudio Contable Beltrán', cuit: '30-70988712-4', industria: 'Servicios contables', email: 'contacto@beltranconsultora.com.ar', telefono: '+54 11 4321-7788', direccion: 'Rivadavia 2200, La Matanza', sitioWeb: 'beltranconsultora.com.ar', estado: 'Cliente', responsableId: 'u1', origen: 'Sitio web', observaciones: '', createdAt: '2026-08-05T10:00:00.000Z' },
      { id: 'emp3', nombre: 'Megafit - Sede Isidro Casanova', cuit: '30-69887654-1', industria: 'Cadena de gimnasios', email: 'info@megafit.com.ar', telefono: '+54 11 4678-2233', direccion: 'San Martín 890, Isidro Casanova', sitioWeb: '', estado: 'Potencial', responsableId: 'u2', origen: 'Redes sociales', observaciones: '', createdAt: '2026-08-10T10:00:00.000Z' },
      { id: 'emp4', nombre: 'Box Combate La Matanza', cuit: '30-71556443-2', industria: 'Centro de entrenamiento', email: 'boxcombate@gmail.com', telefono: '+54 11 4900-5566', direccion: 'Av. Crovara 3100, La Matanza', sitioWeb: '', estado: 'Potencial', responsableId: 'u2', origen: 'Prospección comercial', observaciones: '', createdAt: '2026-08-12T10:00:00.000Z' },
      { id: 'emp5', nombre: 'Solutio Software S.A.', cuit: '30-71987654-5', industria: 'Desarrollo de software', email: 'rrhh@solutio.com.ar', telefono: '+54 11 4033-8890', direccion: 'Av. Corrientes 4200, CABA', sitioWeb: 'solutio.com.ar', estado: 'Cliente', responsableId: 'u1', origen: 'Evento', observaciones: 'Convenio corporativo para 50 empleados.', createdAt: '2026-08-15T10:00:00.000Z' }
    ];

    const contactos = [
      { id: 'ct1', nombre: 'Marcos', apellido: 'Ibarra', dni: '34.789.221', cargo: 'Interesado individual', email: 'marcos.ibarra@gmail.com', telefono: '+54 11 4456-7890', empresaId: null, responsableId: 'u2', estado: 'Potencial', origen: 'Redes sociales', observaciones: 'Interesado en clases funcionales grupales, prefiere turno tarde.', createdAt: '2026-09-10T09:41:00.000Z' },
      { id: 'ct2', nombre: 'Diego', apellido: 'Farías', dni: '28.554.112', cargo: 'Coordinador deportivo', email: 'diego.farias@sportclub.com.ar', telefono: '+54 11 4555-1021', empresaId: 'emp1', responsableId: 'u1', estado: 'Cliente', origen: 'Recomendación', observaciones: '', createdAt: '2026-08-01T10:05:00.000Z' },
      { id: 'ct3', nombre: 'Rocío', apellido: 'Beltrán', dni: '31.220.987', cargo: 'Socia gerente', email: 'rocio@beltranconsultora.com.ar', telefono: '+54 11 4321-7789', empresaId: 'emp2', responsableId: 'u1', estado: 'Cliente', origen: 'Sitio web', observaciones: '', createdAt: '2026-08-05T10:05:00.000Z' },
      { id: 'ct4', nombre: 'Nadia', apellido: 'Gómez', dni: '33.109.456', cargo: 'Gerente de sede', email: 'nadia.gomez@megafit.com.ar', telefono: '+54 11 4678-2234', empresaId: 'emp3', responsableId: 'u2', estado: 'Potencial', origen: 'Redes sociales', observaciones: '', createdAt: '2026-08-10T10:05:00.000Z' },
      { id: 'ct5', nombre: 'Ezequiel', apellido: 'Paz', dni: '35.887.230', cargo: 'Dueño', email: 'ezequiel.paz@gmail.com', telefono: '+54 11 4900-5567', empresaId: 'emp4', responsableId: 'u2', estado: 'Potencial', origen: 'Prospección comercial', observaciones: '', createdAt: '2026-08-12T10:05:00.000Z' },
      { id: 'ct6', nombre: 'Valeria', apellido: 'Sosa', dni: '32.445.678', cargo: 'Responsable de RR.HH. y bienestar', email: 'valeria.sosa@solutio.com.ar', telefono: '+54 11 4033-8891', empresaId: 'emp5', responsableId: 'u1', estado: 'Cliente', origen: 'Evento', observaciones: '', createdAt: '2026-08-15T10:05:00.000Z' },
      { id: 'ct7', nombre: 'Noelia', apellido: 'Sued', dni: '36.221.004', cargo: 'Interesada individual', email: 'noelia.sued@gmail.com', telefono: '+54 11 4212-3345', empresaId: null, responsableId: 'u2', estado: 'Cliente', origen: 'Recomendación', observaciones: '', createdAt: '2026-08-20T10:00:00.000Z' },
      { id: 'ct8', nombre: 'Braian', apellido: 'Coria', dni: '37.102.556', cargo: 'Interesado individual', email: 'braian.coria@gmail.com', telefono: '+54 11 4788-2210', empresaId: null, responsableId: 'u1', estado: 'Inactivo', origen: 'Publicidad', observaciones: 'Consultó por pase estándar, priorizó otra opción.', createdAt: '2026-09-01T10:00:00.000Z' },
      { id: 'ct9', nombre: 'Lucía', apellido: 'Farías', dni: '38.220.114', cargo: 'Interesada individual', email: 'lucia.farias@gmail.com', telefono: '+54 11 4321-0098', empresaId: null, responsableId: 'u1', estado: 'Potencial', origen: 'Sitio web', observaciones: 'Consultó por Instagram sobre pases mensuales.', createdAt: '2026-09-19T09:00:00.000Z' }
    ];

    const oportunidades = [
      { id: 'op1', titulo: 'Alta Pase Estándar', entidadTipo: 'contacto', entidadId: 'ct9', productoId: 'estandar', valor: 15000, responsableId: 'u1', etapaKey: 'nuevo', fechaEstimadaCierre: '2026-09-28', fechaRealCierre: null, origen: 'Sitio web', estado: 'abierta', observaciones: '', motivoPerdida: null, createdAt: '2026-09-19T09:00:00.000Z', updatedAt: '2026-09-19T09:00:00.000Z' },
      { id: 'op2', titulo: 'Convenio Pase Atleta x10', entidadTipo: 'empresa', entidadId: 'emp2', productoId: 'atleta', valor: 220000, responsableId: 'u1', etapaKey: 'relevamiento', fechaEstimadaCierre: '2026-10-05', fechaRealCierre: null, origen: 'Sitio web', estado: 'abierta', observaciones: '', motivoPerdida: null, createdAt: '2026-09-17T10:00:00.000Z', updatedAt: '2026-09-17T10:00:00.000Z' },
      { id: 'op3', titulo: 'Clase de Prueba Funcional', entidadTipo: 'contacto', entidadId: 'ct1', productoId: 'atleta', valor: 22000, responsableId: 'u2', etapaKey: 'demo', fechaEstimadaCierre: '2026-09-25', fechaRealCierre: null, origen: 'Redes sociales', estado: 'abierta', observaciones: 'Demo funcional agendada para el sábado 20/9 a las 10 hs.', motivoPerdida: null, createdAt: '2026-09-10T09:41:00.000Z', updatedAt: '2026-09-15T11:20:00.000Z' },
      { id: 'op4', titulo: 'Membresía Corporate x14 - Sede Ramos Mejía', entidadTipo: 'empresa', entidadId: 'emp1', productoId: 'olimpico', valor: 420000, responsableId: 'u1', etapaKey: 'propuesta', fechaEstimadaCierre: '2026-10-10', fechaRealCierre: null, origen: 'Recomendación', estado: 'abierta', observaciones: '', motivoPerdida: null, createdAt: '2026-09-05T10:00:00.000Z', updatedAt: '2026-09-16T12:00:00.000Z' },
      { id: 'op5', titulo: 'Alta Pase Olímpico', entidadTipo: 'contacto', entidadId: 'ct7', productoId: 'olimpico', valor: 30000, responsableId: 'u2', etapaKey: 'ganada', fechaEstimadaCierre: '2026-09-12', fechaRealCierre: '2026-09-12', origen: 'Recomendación', estado: 'ganada', observaciones: '', motivoPerdida: null, createdAt: '2026-08-25T10:00:00.000Z', updatedAt: '2026-09-12T10:00:00.000Z' },
      { id: 'op6', titulo: 'Consulta Pase Estándar', entidadTipo: 'contacto', entidadId: 'ct8', productoId: 'estandar', valor: 0, responsableId: 'u1', etapaKey: 'perdida', fechaEstimadaCierre: '2026-09-08', fechaRealCierre: '2026-09-08', origen: 'Publicidad', estado: 'perdida', observaciones: '', motivoPerdida: 'Eligió otro gimnasio', createdAt: '2026-09-01T10:00:00.000Z', updatedAt: '2026-09-08T10:00:00.000Z' },
      { id: 'op7', titulo: 'Membresía Corporate x50 (Pase Atleta)', entidadTipo: 'empresa', entidadId: 'emp5', productoId: 'atleta', valor: 1100000, responsableId: 'u1', etapaKey: 'ganada', fechaEstimadaCierre: '2026-09-03', fechaRealCierre: '2026-09-03', origen: 'Evento', estado: 'ganada', observaciones: '50 suscripciones mensuales Pase Atleta para el personal de la empresa.', motivoPerdida: null, createdAt: '2026-08-15T10:00:00.000Z', updatedAt: '2026-09-03T10:15:00.000Z' }
    ];

    save('users', users);
    save('empresas', empresas);
    save('contactos', contactos);
    save('oportunidades', oportunidades);
    localStorage.setItem(SEED_FLAG, '1');
  }

  // ---------- Genérico ----------
  function all(collection) {
    return load(collection, []);
  }

  function find(collection, id) {
    return all(collection).find((r) => r.id === id) || null;
  }

  function insert(collection, record) {
    const records = all(collection);
    records.push(record);
    save(collection, records);
    return record;
  }

  function update(collection, id, patch) {
    const records = all(collection);
    const idx = records.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    records[idx] = Object.assign({}, records[idx], patch);
    save(collection, records);
    return records[idx];
  }

  // ---------- API por entidad ----------
  const users = () => all('users');
  const findUser = (id) => find('users', id);
  const findUserByEmail = (email) => users().find((u) => u.email.toLowerCase() === String(email).toLowerCase()) || null;

  const empresas = () => all('empresas');
  const findEmpresa = (id) => find('empresas', id);
  const createEmpresa = (data) => insert('empresas', Object.assign({ id: uid('emp') }, data, { createdAt: new Date().toISOString() }));
  const updateEmpresa = (id, patch) => update('empresas', id, patch);

  const contactos = () => all('contactos');
  const findContacto = (id) => find('contactos', id);
  const createContacto = (data) => insert('contactos', Object.assign({ id: uid('ct') }, data, { createdAt: new Date().toISOString() }));
  const updateContacto = (id, patch) => update('contactos', id, patch);
  const contactosDeEmpresa = (empresaId) => contactos().filter((c) => c.empresaId === empresaId);

  const oportunidades = () => all('oportunidades');
  const findOportunidad = (id) => find('oportunidades', id);
  const createOportunidad = (data) => {
    const now = new Date().toISOString();
    return insert('oportunidades', Object.assign({ id: uid('op') }, data, { createdAt: now, updatedAt: now }));
  };
  const updateOportunidad = (id, patch) => update('oportunidades', id, Object.assign({}, patch, { updatedAt: new Date().toISOString() }));
  const oportunidadesDeEntidad = (tipo, id) => oportunidades().filter((o) => o.entidadTipo === tipo && o.entidadId === id);

  return {
    seed,
    users, findUser, findUserByEmail,
    empresas, findEmpresa, createEmpresa, updateEmpresa,
    contactos, findContacto, createContacto, updateContacto, contactosDeEmpresa,
    oportunidades, findOportunidad, createOportunidad, updateOportunidad, oportunidadesDeEntidad,
    uid
  };
})();

Pulso.db.seed();
