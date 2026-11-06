// Consultas de historial compartidas por los detalles de empresa, contacto y oportunidad.
const db = require('../db');
const { isVendedor } = require('../auth');

const ACTIVIDAD_SELECT = `SELECT a.*, t.nombre tipo_nombre, u.nombre usuario_nombre, e.nombre empresa_nombre,
    c.nombre || ' ' || c.apellido contacto_nombre, o.titulo oportunidad_titulo, o.responsable_id oportunidad_responsable_id
  FROM actividades a
  JOIN tipos_actividad t ON t.id = a.tipo_id
  JOIN usuarios u ON u.id = a.usuario_id
  LEFT JOIN empresas e ON e.id = a.empresa_id
  LEFT JOIN contactos c ON c.id = a.contacto_id
  LEFT JOIN oportunidades o ON o.id = a.oportunidad_id`;

// Una actividad aparece en cada ficha con la que está relacionada, directa o por su oportunidad.
const FILTRO = {
  empresa: 'a.empresa_id = ?',
  contacto: 'a.contacto_id = ?',
  oportunidad: 'a.oportunidad_id = ?'
};

async function actividadesDe(tipo, id, user) {
  const rows = await db.all(ACTIVIDAD_SELECT + ' WHERE ' + FILTRO[tipo] + ' ORDER BY a.fecha_hora DESC', [id]);
  // El historial del cliente es completo, pero el vendedor solo enlaza a sus oportunidades.
  return rows.map((a) => ({
    ...a,
    ver_oportunidad: !!a.oportunidad_id && (!isVendedor(user) || a.oportunidad_responsable_id === user.id)
  }));
}

async function auditoriaDe(entidad, id) {
  return db.all(
    `SELECT a.accion, a.detalle, a.fecha_hora, u.nombre usuario_nombre
     FROM auditoria a JOIN usuarios u ON u.id = a.usuario_id
     WHERE a.entidad = ? AND a.entidad_id = ? ORDER BY a.fecha_hora DESC`,
    [entidad, id]
  );
}

module.exports = { ACTIVIDAD_SELECT, actividadesDe, auditoriaDe };
