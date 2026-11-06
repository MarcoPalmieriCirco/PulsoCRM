// Crea el esquema y carga los datos de demostración.
//   npm run seed         crea lo que falte; no toca una base que ya tiene datos
//   npm run seed:reset   borra todo y vuelve a cargar la demo
const db = require('./db');
const { TABLAS, ORDEN_BORRADO } = require('./schema');
const { hashPassword, newId } = require('./lib');

const PASSWORD_DEMO = 'pulso123';
const DIA = 24 * 3600 * 1000;

const haceDias = (n, hora = 11) => {
  const d = new Date(Date.now() - n * DIA);
  d.setUTCHours(hora + 3, 0, 0, 0); // hora argentina
  return d.toISOString();
};
const fecha = (n) => new Date(Date.now() - n * DIA - 3 * 3600 * 1000).toISOString().slice(0, 10);

async function crearEsquema() {
  await db.batch(TABLAS.map((sql) => ({ sql, args: [] })));
}

async function cargarDatos() {
  const s = [];
  const add = (sql, args) => s.push({ sql, args });

  // ---------- Usuarios: uno por rol, más un segundo vendedor y uno inactivo ----------
  const hash = await hashPassword(PASSWORD_DEMO);
  const U = { admin: 'u-admin', resp: 'u-responsable', cam: 'u-vendedor', lara: 'u-vendedor2', ex: 'u-inactivo' };
  [
    [U.admin, 'Sofía Medina', 'admin@pulsocrm.com', 'administrador', 1],
    [U.resp, 'Julián Roa', 'responsable@pulsocrm.com', 'responsable', 1],
    [U.cam, 'Cam Novoa', 'vendedor@pulsocrm.com', 'vendedor', 1],
    [U.lara, 'Lara Quiroga', 'vendedor2@pulsocrm.com', 'vendedor', 1],
    [U.ex, 'Tomás Vera', 'tomas.vera@pulsocrm.com', 'vendedor', 0]
  ].forEach(([id, nombre, email, rol, activo]) => {
    add('INSERT INTO usuarios (id,nombre,email,password_hash,rol,activo,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)',
      [id, nombre, email, hash, rol, activo, haceDias(120), haceDias(120)]);
  });

  // ---------- Embudo del gimnasio ----------
  const E = { consulta: 'et-consulta', agendada: 'et-agendada', realizada: 'et-realizada', propuesta: 'et-propuesta', negociacion: 'et-negociacion', alta: 'et-alta', perdida: 'et-perdida' };
  const nombreEtapa = {
    [E.consulta]: 'Consulta recibida', [E.agendada]: 'Clase de prueba agendada', [E.realizada]: 'Clase de prueba realizada',
    [E.propuesta]: 'Propuesta de plan', [E.negociacion]: 'Negociación', [E.alta]: 'Alta', [E.perdida]: 'Perdida'
  };
  [
    [E.consulta, 1, 'abierta', '#C7C7C7'], [E.agendada, 2, 'abierta', '#9E9E9E'], [E.realizada, 3, 'abierta', '#6E6E6E'],
    [E.propuesta, 4, 'abierta', '#4A4A4A'], [E.negociacion, 5, 'abierta', '#2A2A2A'], [E.alta, 6, 'ganada', '#141414'], [E.perdida, 7, 'perdida', '#D42B2B']
  ].forEach(([id, orden, tipo, color]) => {
    add('INSERT INTO etapas (id,nombre,orden,tipo,color,activo) VALUES (?,?,?,?,?,1)', [id, nombreEtapa[id], orden, tipo, color]);
  });

  const catalogo = (tabla, filas) => filas.forEach(([id, nombre]) => add('INSERT INTO ' + tabla + ' (id,nombre,activo) VALUES (?,?,1)', [id, nombre]));
  const O = { ig: 'or-instagram', wa: 'or-whatsapp', ref: 'or-referido', local: 'or-local', web: 'or-web' };
  catalogo('origenes', [[O.ig, 'Instagram'], [O.wa, 'WhatsApp'], [O.ref, 'Referido'], [O.local, 'Pasó por el local'], [O.web, 'Web']]);
  const M = { precio: 'mo-precio', distancia: 'mo-distancia', horarios: 'mo-horarios', otro: 'mo-otro-gimnasio' };
  catalogo('motivos_perdida', [[M.precio, 'Precio'], [M.distancia, 'Distancia'], [M.horarios, 'Horarios'], [M.otro, 'Eligió otro gimnasio']]);
  const T = { llamada: 'ta-llamada', correo: 'ta-correo', mensaje: 'ta-mensaje', presencial: 'ta-presencial', virtual: 'ta-virtual', demo: 'ta-demo', propuesta: 'ta-propuesta', nota: 'ta-nota', clase: 'ta-clase', recorrida: 'ta-recorrida', otro: 'ta-otro' };
  catalogo('tipos_actividad', [
    [T.llamada, 'Llamada'], [T.correo, 'Correo electrónico'], [T.mensaje, 'Mensaje'], [T.presencial, 'Reunión presencial'], [T.virtual, 'Reunión virtual'],
    [T.demo, 'Demostración'], [T.propuesta, 'Envío de propuesta'], [T.nota, 'Nota interna'], [T.clase, 'Clase de prueba'], [T.recorrida, 'Recorrida por la sede'], [T.otro, 'Otro']
  ]);

  const S = { ramos: 'se-ramos', justo: 'se-justo', casanova: 'se-casanova' };
  [[S.ramos, 'Sede Ramos Mejía', 'Av. de Mayo 1450, Ramos Mejía'], [S.justo, 'Sede San Justo', 'Arieta 3300, San Justo'], [S.casanova, 'Sede Isidro Casanova', 'Av. Crovara 3100, Isidro Casanova']]
    .forEach(([id, nombre, direccion]) => add('INSERT INTO sedes (id,nombre,direccion,activo) VALUES (?,?,?,1)', [id, nombre, direccion]));

  const P = { estandar: 'pl-estandar', atleta: 'pl-atleta', olimpico: 'pl-olimpico', anual: 'pl-anual', corporativo: 'pl-corporativo', viejo: 'pl-verano' };
  [
    [P.estandar, 'Pase Estándar', 'Acceso a musculación', 'Mensual', 0, 15000, 1],
    [P.atleta, 'Pase Atleta', 'Musculación y 1 clase grupal por semana', 'Mensual', 1, 22000, 1],
    [P.olimpico, 'Pase Olímpico', 'Musculación y 3 clases grupales por semana', 'Mensual', 3, 30000, 1],
    [P.anual, 'Pase Olímpico Anual', 'Pase Olímpico con pago anual anticipado', 'Anual', 3, 300000, 1],
    [P.corporativo, 'Convenio Corporativo', 'Precio por socio para empleados de empresas con convenio', 'Mensual', 1, 18000, 1],
    [P.viejo, 'Pase Verano 2025', 'Promoción de temporada discontinuada', 'Trimestral', 2, 45000, 0]
  ].forEach((f) => add('INSERT INTO planes (id,nombre,descripcion,duracion,clases_semanales,precio,activo) VALUES (?,?,?,?,?,?,?)', f));

  // ---------- Empresas con convenio ----------
  const EM = { beltran: 'em-beltran', solutio: 'em-solutio', logistica: 'em-logistica', clinica: 'em-clinica', escuela: 'em-escuela', ferreteria: 'em-ferreteria' };
  [
    [EM.beltran, 'Estudio Contable Beltrán', '30-70988712-4', 'Servicios contables', 'contacto@beltran.example', '+54 11 4321-7788', 'Rivadavia 2200, La Matanza', 'beltran.example', 'Cliente', U.cam, O.web, 'Convenio para el personal del estudio.', 60],
    [EM.solutio, 'Solutio Software S.A.', '30-71987654-5', 'Desarrollo de software', 'rrhh@solutio.example', '+54 11 4033-8890', 'Av. Corrientes 4200, CABA', 'solutio.example', 'Cliente', U.cam, O.ref, 'Convenio corporativo para 50 empleados.', 90],
    [EM.logistica, 'Logística del Oeste', '30-69887654-1', 'Transporte y logística', 'personal@logisticaoeste.example', '+54 11 4678-2233', 'Ruta 3 km 28, Isidro Casanova', '', 'Potencial', U.lara, O.local, '', 25],
    [EM.clinica, 'Clínica San Justo', '30-71556443-2', 'Salud', 'bienestar@clinicasj.example', '+54 11 4900-5566', 'Almafuerte 3100, San Justo', 'clinicasj.example', 'Potencial', U.lara, O.ig, 'Interesados en beneficios para enfermería.', 20],
    [EM.escuela, 'Colegio Santa Rosa', '30-68123456-7', 'Educación', 'admin@colegiosr.example', '+54 11 4654-1200', 'Belgrano 450, Ramos Mejía', '', 'Inactivo', U.cam, O.ref, 'Dejaron de responder en la temporada pasada.', 150],
    [EM.ferreteria, 'Ferretería Don Hugo', '30-71222333-8', 'Comercio', 'hugo@donhugo.example', '+54 11 4466-0011', 'Illia 900, San Justo', '', 'No contactar', U.lara, O.local, 'Pidió expresamente no recibir más consultas.', 100]
  ].forEach(([id, nombre, cuit, ind, email, tel, dir, web, estado, resp, ori, obs, dias]) => {
    add(`INSERT INTO empresas (id,nombre,cuit,industria,email,telefono,direccion,sitio_web,estado,responsable_id,origen_id,observaciones,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, nombre, cuit, ind, email, tel, dir, web || null, estado, resp, ori, obs || null, resp, haceDias(dias), haceDias(dias)]);
  });

  // ---------- Personas: interesados y socios ----------
  const C = { marcos: 'ct-marcos', rocio: 'ct-rocio', nadia: 'ct-nadia', valeria: 'ct-valeria', noelia: 'ct-noelia', braian: 'ct-braian', lucia: 'ct-lucia', diego: 'ct-diego', martina: 'ct-martina', federico: 'ct-federico', agustina: 'ct-agustina', pablo: 'ct-pablo', carla: 'ct-carla', gaston: 'ct-gaston' };
  [
    [C.marcos, 'Marcos', 'Ibarra', '34.789.221', 'Interesado particular', 'marcos.ibarra@correo.example', '+54 11 4456-7890', null, S.justo, U.lara, 'Potencial', O.ig, 'Busca clases funcionales grupales, turno tarde.', 18],
    [C.rocio, 'Rocío', 'Beltrán', '31.220.987', 'Socia gerente', 'rocio@beltran.example', '+54 11 4321-7789', EM.beltran, S.ramos, U.cam, 'Cliente', O.web, '', 60],
    [C.nadia, 'Nadia', 'Gómez', '33.109.456', 'Encargada de personal', 'nadia.gomez@logisticaoeste.example', '+54 11 4678-2234', EM.logistica, S.casanova, U.lara, 'Potencial', O.local, '', 25],
    [C.valeria, 'Valeria', 'Sosa', '32.445.678', 'Responsable de RR.HH.', 'valeria.sosa@solutio.example', '+54 11 4033-8891', EM.solutio, S.ramos, U.cam, 'Cliente', O.ref, '', 90],
    [C.noelia, 'Noelia', 'Sued', '36.221.004', 'Socia particular', 'noelia.sued@correo.example', '+54 11 4212-3345', null, S.ramos, U.lara, 'Cliente', O.ref, '', 35],
    [C.braian, 'Braian', 'Coria', '37.102.556', 'Interesado particular', 'braian.coria@correo.example', '+54 11 4788-2210', null, S.justo, U.cam, 'Inactivo', O.web, 'Se anotó en otro gimnasio más cerca de su casa.', 40],
    [C.lucia, 'Lucía', 'Farías', '38.220.114', 'Interesada particular', 'lucia.farias@correo.example', '+54 11 4321-0098', null, S.ramos, U.cam, 'Potencial', O.ig, 'Consultó por Instagram sobre pases mensuales.', 6],
    [C.diego, 'Diego', 'Paz', '28.554.112', 'Dueño', 'diego.paz@donhugo.example', '+54 11 4466-0012', EM.ferreteria, null, U.lara, 'No contactar', O.local, 'No volver a contactar.', 100],
    [C.martina, 'Martina', 'Ledesma', '39.441.220', 'Interesada particular', 'martina.ledesma@correo.example', '+54 11 5012-1188', null, S.casanova, U.cam, 'Potencial', O.wa, 'Quiere bajar de peso, disponible por la mañana.', 12],
    [C.federico, 'Federico', 'Álvarez', '30.118.774', 'Interesado particular', 'fede.alvarez@correo.example', '+54 11 5012-2299', null, S.ramos, U.cam, 'Potencial', O.local, 'Pasó por la sede con un amigo que ya es socio.', 9],
    [C.agustina, 'Agustina', 'Ríos', '40.227.331', 'Socia particular', 'agus.rios@correo.example', '+54 11 5012-3300', null, S.justo, U.lara, 'Cliente', O.wa, '', 45],
    [C.pablo, 'Pablo', 'Herrera', '29.882.103', 'Médico de planta', 'pablo.herrera@clinicasj.example', '+54 11 4900-5567', EM.clinica, S.justo, U.lara, 'Potencial', O.ig, '', 20],
    [C.carla, 'Carla', 'Benítez', '35.664.902', 'Interesada particular', 'carla.benitez@correo.example', '+54 11 5012-4411', null, S.casanova, U.lara, 'Potencial', O.web, 'Pregunta por horarios nocturnos.', 15],
    [C.gaston, 'Gastón', 'Molina', '33.970.215', 'Interesado particular', 'gaston.molina@correo.example', '+54 11 5012-5522', null, S.ramos, U.cam, 'Potencial', O.ref, 'Lo recomendó Noelia Sued.', 4]
  ].forEach(([id, nombre, apellido, dni, cargo, email, tel, emp, sede, resp, estado, ori, obs, dias]) => {
    add(`INSERT INTO contactos (id,nombre,apellido,dni,cargo,email,telefono,empresa_id,sede_id,responsable_id,estado,origen_id,observaciones,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, nombre, apellido, dni, cargo, email, tel, emp, sede, resp, estado, ori, obs || null, resp, haceDias(dias), haceDias(dias)]);
  });

  // ---------- Oportunidades con su recorrido por el embudo ----------
  const ACT = [];
  const oportunidad = (o) => {
    const id = 'op-' + o.clave;
    const ultima = o.recorrido[o.recorrido.length - 1];
    const tipo = ultima[0] === E.alta ? 'ganada' : ultima[0] === E.perdida ? 'perdida' : 'abierta';
    add(`INSERT INTO oportunidades (id,titulo,empresa_id,contacto_id,plan_id,sede_id,cantidad_socios,responsable_id,valor_estimado,valor_final,etapa_id,estado,probabilidad,fecha_estimada_cierre,fecha_real_cierre,origen_id,motivo_perdida_id,observaciones,created_by,created_at,updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, o.titulo, o.empresa || null, o.contacto || null, o.plan, o.sede, o.socios || 1, o.resp, o.valor, tipo === 'ganada' ? o.valorFinal : null,
      ultima[0], tipo, o.prob === undefined ? null : o.prob, fecha(o.estimada), tipo === 'abierta' ? null : fecha(ultima[1]),
      o.origen, o.motivo || null, o.obs || null, o.resp, haceDias(o.recorrido[0][1], 10), haceDias(ultima[1], 16)]);
    o.recorrido.forEach(([etapa, dias, obs, usuario], i) => {
      const previa = i ? o.recorrido[i - 1][0] : null;
      add(`INSERT INTO historial_etapas (id,oportunidad_id,etapa_anterior_id,etapa_nueva_id,etapa_anterior_nombre,etapa_nueva_nombre,fecha_hora,usuario_id,observacion) VALUES (?,?,?,?,?,?,?,?,?)`,
        [newId(), id, previa, etapa, previa ? nombreEtapa[previa] : null, nombreEtapa[etapa], haceDias(dias, i === 0 ? 10 : 16), usuario || o.resp, obs || (i === 0 ? 'Creación de la oportunidad' : null)]);
    });
    add('INSERT INTO auditoria (id,entidad,entidad_id,accion,detalle,usuario_id,fecha_hora) VALUES (?,?,?,?,?,?,?)',
      [newId(), 'oportunidad', id, 'Creación de la oportunidad', o.titulo, o.resp, haceDias(o.recorrido[0][1], 10)]);
    if (tipo !== 'abierta') {
      add('INSERT INTO auditoria (id,entidad,entidad_id,accion,detalle,usuario_id,fecha_hora) VALUES (?,?,?,?,?,?,?)',
        [newId(), 'oportunidad', id, 'Cierre', nombreEtapa[ultima[0]] + ' (' + fecha(ultima[1]) + ')', o.resp, haceDias(ultima[1], 16)]);
    }
    (o.actividades || []).forEach(([tipoAct, dias, descripcion, resultado, usuario]) => {
      ACT.push([tipoAct, haceDias(dias, 15), usuario || o.resp, o.empresa || null, o.contacto || null, id, descripcion, resultado]);
    });
  };

  oportunidad({ clave: 'lucia', titulo: 'Alta Pase Estándar - Lucía', contacto: C.lucia, plan: P.estandar, sede: S.ramos, resp: U.cam, valor: 15000, estimada: -10, origen: O.ig, prob: 20,
    recorrido: [[E.consulta, 6]],
    actividades: [[T.mensaje, 6, 'Respondimos la consulta por Instagram con precios y horarios.', 'Pidió volver a hablar la semana próxima.']] });
  oportunidad({ clave: 'gaston', titulo: 'Referido de Noelia - Pase Atleta', contacto: C.gaston, plan: P.atleta, sede: S.ramos, resp: U.cam, valor: 22000, estimada: -12, origen: O.ref, prob: 30,
    recorrido: [[E.consulta, 4]],
    actividades: [[T.llamada, 3, 'Llamada de presentación por referido.', 'Le interesa conocer las clases de funcional.']] });
  oportunidad({ clave: 'martina', titulo: 'Clase de prueba funcional - Martina', contacto: C.martina, plan: P.atleta, sede: S.casanova, resp: U.cam, valor: 22000, estimada: -8, origen: O.wa, prob: 45,
    recorrido: [[E.consulta, 12], [E.agendada, 7, 'Se anotó para probar funcional.']],
    actividades: [[T.mensaje, 11, 'Consulta por WhatsApp sobre planes para bajar de peso.', 'Enviamos planes y grilla de clases.'], [T.llamada, 7, 'Coordinamos la clase de prueba por teléfono.', 'Confirmó que quiere probar funcional.']] });
  oportunidad({ clave: 'federico', titulo: 'Pase Olímpico - Federico', contacto: C.federico, plan: P.olimpico, sede: S.ramos, resp: U.cam, valor: 30000, estimada: -6, origen: O.local, prob: 60,
    recorrido: [[E.consulta, 9], [E.agendada, 7], [E.realizada, 3, 'Le gustó la clase de crossfit.']],
    actividades: [[T.recorrida, 9, 'Recorrió la sede de Ramos Mejía con un socio.', 'Quedó interesado en clases grupales.'], [T.clase, 3, 'Tomó una clase de prueba de crossfit.', 'Muy conforme; pide propuesta.']] });
  oportunidad({ clave: 'beltran', titulo: 'Convenio Pase Atleta x10 - Estudio Beltrán', empresa: EM.beltran, contacto: C.rocio, plan: P.corporativo, sede: S.ramos, socios: 10, resp: U.cam, valor: 180000, estimada: -15, origen: O.web, prob: 70,
    recorrido: [[E.consulta, 20], [E.realizada, 12, 'Dos empleados probaron la clase.'], [E.propuesta, 5, 'Se envió propuesta por 10 socios.']],
    actividades: [[T.presencial, 12, 'Reunión con Rocío en la sede.', 'Quieren un precio por volumen.'], [T.propuesta, 5, 'Enviamos propuesta de convenio para 10 socios.', 'La evalúan con los socios del estudio.']] });
  oportunidad({ clave: 'logistica', titulo: 'Convenio empleados x25 - Logística del Oeste', empresa: EM.logistica, contacto: C.nadia, plan: P.corporativo, sede: S.casanova, socios: 25, resp: U.lara, valor: 450000, estimada: -20, origen: O.local, prob: 75,
    recorrido: [[E.consulta, 24], [E.propuesta, 14], [E.negociacion, 4, 'Piden descuento por volumen.']],
    actividades: [[T.virtual, 14, 'Reunión virtual con Nadia para relevar turnos del personal.', 'Necesitan acceso nocturno.'], [T.llamada, 4, 'Discutimos el precio por socio.', 'Esperan contraoferta.']] });
  oportunidad({ clave: 'marcos', titulo: 'Clase de prueba funcional - Marcos', contacto: C.marcos, plan: P.atleta, sede: S.justo, resp: U.lara, valor: 22000, estimada: -9, origen: O.ig, prob: 40,
    recorrido: [[E.consulta, 18], [E.agendada, 5]],
    actividades: [[T.mensaje, 16, 'Conversación por Instagram sobre clases funcionales.', 'Prefiere turno tarde.']] });
  oportunidad({ clave: 'clinica', titulo: 'Beneficio enfermería x15 - Clínica San Justo', empresa: EM.clinica, contacto: C.pablo, plan: P.corporativo, sede: S.justo, socios: 15, resp: U.lara, valor: 270000, estimada: -25, origen: O.ig, prob: 25,
    recorrido: [[E.consulta, 19]],
    actividades: [[T.correo, 19, 'Enviamos información del programa de convenios.', 'Lo elevan a la dirección de la clínica.']] });
  oportunidad({ clave: 'carla', titulo: 'Plan nocturno - Carla', contacto: C.carla, plan: P.estandar, sede: S.casanova, resp: U.lara, valor: 15000, estimada: -7, origen: O.web, prob: 50,
    recorrido: [[E.consulta, 15], [E.agendada, 11], [E.realizada, 8], [E.propuesta, 2, 'Se ofreció Pase Estándar turno noche.']],
    actividades: [[T.clase, 8, 'Probó musculación en el turno noche.', 'Conforme con el horario.']] });
  oportunidad({ clave: 'solutio', titulo: 'Convenio corporativo x50 - Solutio', empresa: EM.solutio, contacto: C.valeria, plan: P.corporativo, sede: S.ramos, socios: 50, resp: U.cam, valor: 900000, valorFinal: 850000, estimada: 30, origen: O.ref, prob: 100,
    obs: '50 pases mensuales para el personal.',
    recorrido: [[E.consulta, 80], [E.agendada, 70], [E.realizada, 60], [E.propuesta, 50], [E.negociacion, 42, 'Pidieron 5% de descuento.'], [E.alta, 35, 'Convenio firmado.']],
    actividades: [[T.presencial, 70, 'Reunión con RR.HH. y recorrida por la sede.', 'Avanzan con una prueba para el equipo.'], [T.propuesta, 50, 'Propuesta para 50 empleados.', 'Pidieron descuento.'], [T.llamada, 36, 'Cierre de condiciones del convenio.', 'Aceptan el 5% de descuento.']] });
  oportunidad({ clave: 'noelia', titulo: 'Alta Pase Olímpico - Noelia', contacto: C.noelia, plan: P.olimpico, sede: S.ramos, resp: U.lara, valor: 30000, valorFinal: 30000, estimada: 25, origen: O.ref, prob: 100,
    recorrido: [[E.consulta, 34], [E.agendada, 32], [E.realizada, 30], [E.alta, 28, 'Se anotó en recepción.']],
    actividades: [[T.clase, 30, 'Clase de prueba de spinning.', 'Decidió anotarse.']] });
  oportunidad({ clave: 'agustina', titulo: 'Alta Pase Anual - Agustina', contacto: C.agustina, plan: P.anual, sede: S.justo, resp: U.lara, valor: 300000, valorFinal: 280000, estimada: 15, origen: O.wa, prob: 100,
    recorrido: [[E.consulta, 44], [E.propuesta, 30], [E.alta, 21, 'Pago anual anticipado.']],
    actividades: [[T.mensaje, 30, 'Le enviamos la promoción anual por WhatsApp.', 'Pidió un pequeño descuento.']] });
  oportunidad({ clave: 'braian', titulo: 'Consulta Pase Estándar - Braian', contacto: C.braian, plan: P.estandar, sede: S.justo, resp: U.cam, valor: 15000, estimada: 28, origen: O.web, motivo: M.distancia, prob: 0,
    recorrido: [[E.consulta, 40], [E.agendada, 36], [E.perdida, 30, 'Le queda lejos de la casa.']],
    actividades: [[T.llamada, 30, 'Llamada de seguimiento tras la clase de prueba.', 'Se anotó en un gimnasio más cerca.']] });
  oportunidad({ clave: 'escuela', titulo: 'Convenio docentes x20 - Colegio Santa Rosa', empresa: EM.escuela, plan: P.corporativo, sede: S.ramos, socios: 20, resp: U.cam, valor: 360000, estimada: 100, origen: O.ref, motivo: M.precio, prob: 0,
    recorrido: [[E.consulta, 140], [E.propuesta, 125], [E.negociacion, 118], [E.perdida, 110, 'El presupuesto no alcanzó.']],
    actividades: [[T.propuesta, 125, 'Propuesta para 20 docentes.', 'Les pareció caro.']] });
  oportunidad({ clave: 'ex', titulo: 'Pase Atleta turno mañana', contacto: C.carla, plan: P.atleta, sede: S.casanova, resp: U.lara, valor: 22000, estimada: 50, origen: O.web, motivo: M.horarios, prob: 0,
    recorrido: [[E.consulta, 60], [E.perdida, 55, 'No hay clases en el horario que necesita.']] });
  oportunidad({ clave: 'competencia', titulo: 'Pase Olímpico - consulta local', contacto: C.martina, plan: P.olimpico, sede: S.ramos, resp: U.cam, valor: 30000, estimada: 20, origen: O.local, motivo: M.otro, prob: 0,
    recorrido: [[E.consulta, 25], [E.realizada, 22], [E.perdida, 18, 'Eligió otro gimnasio por una promoción.']] });

  // Actividades directas sobre la ficha, sin oportunidad.
  ACT.push([T.nota, haceDias(12), U.cam, null, C.martina, null, 'Prefiere que la contacten solo por WhatsApp.', 'Queda registrado para el equipo.']);
  ACT.push([T.nota, haceDias(100), U.lara, EM.ferreteria, C.diego, null, 'Pidió no recibir más comunicaciones.', 'Marcado como No contactar.']);
  ACT.push([T.llamada, haceDias(15), U.cam, EM.beltran, C.rocio, null, 'Consulta de socios actuales del convenio.', 'Sin novedades.']);
  ACT.forEach(([tipo, f, usuario, empresa, contacto, opp, descripcion, resultado]) => {
    add('INSERT INTO actividades (id,tipo_id,fecha_hora,usuario_id,empresa_id,contacto_id,oportunidad_id,descripcion,resultado,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [newId(), tipo, f, usuario, empresa, contacto, opp, descripcion, resultado, f]);
  });

  await db.batch(s);
}

async function borrarTodo() {
  await db.batch(ORDEN_BORRADO.map((t) => ({ sql: 'DROP TABLE IF EXISTS ' + t, args: [] })));
}

// Deja la base lista: crea tablas y solo carga la demo si está vacía.
async function ensureDatabase() {
  await crearEsquema();
  const row = await db.get('SELECT COUNT(*) n FROM usuarios');
  if (row.n === 0) {
    await cargarDatos();
    return true;
  }
  return false;
}

async function main() {
  if (process.argv.includes('--reset')) await borrarTodo();
  const cargada = await ensureDatabase();
  console.log(cargada ? 'Datos de demostración cargados.' : 'La base ya tenía datos; no se modificó.');
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { ensureDatabase, borrarTodo, PASSWORD_DEMO };
