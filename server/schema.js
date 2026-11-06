// Modelo de datos. "CREATE IF NOT EXISTS" permite correrlo mas de una vez.
const TABLAS = [
  `CREATE TABLE IF NOT EXISTS usuarios (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    rol TEXT NOT NULL CHECK (rol IN ('administrador','responsable','vendedor')),
    activo INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS sesiones (
    token_hash TEXT PRIMARY KEY,
    usuario_id TEXT NOT NULL REFERENCES usuarios(id),
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS etapas (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    orden INTEGER NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('abierta','ganada','perdida')),
    color TEXT NOT NULL DEFAULT '#9E9E9E',
    activo INTEGER NOT NULL DEFAULT 1
  )`,
  `CREATE TABLE IF NOT EXISTS origenes (id TEXT PRIMARY KEY, nombre TEXT NOT NULL, activo INTEGER NOT NULL DEFAULT 1)`,
  `CREATE TABLE IF NOT EXISTS motivos_perdida (id TEXT PRIMARY KEY, nombre TEXT NOT NULL, activo INTEGER NOT NULL DEFAULT 1)`,
  `CREATE TABLE IF NOT EXISTS tipos_actividad (id TEXT PRIMARY KEY, nombre TEXT NOT NULL, activo INTEGER NOT NULL DEFAULT 1)`,
  `CREATE TABLE IF NOT EXISTS sedes (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    direccion TEXT,
    activo INTEGER NOT NULL DEFAULT 1
  )`,
  `CREATE TABLE IF NOT EXISTS planes (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    duracion TEXT NOT NULL DEFAULT 'Mensual',
    clases_semanales INTEGER NOT NULL DEFAULT 0,
    precio REAL NOT NULL DEFAULT 0,
    activo INTEGER NOT NULL DEFAULT 1
  )`,
  `CREATE TABLE IF NOT EXISTS empresas (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    cuit TEXT,
    industria TEXT,
    email TEXT,
    telefono TEXT,
    direccion TEXT,
    sitio_web TEXT,
    estado TEXT NOT NULL CHECK (estado IN ('Potencial','Cliente','Inactivo','No contactar')),
    responsable_id TEXT NOT NULL REFERENCES usuarios(id),
    origen_id TEXT NOT NULL REFERENCES origenes(id),
    observaciones TEXT,
    created_by TEXT REFERENCES usuarios(id),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS contactos (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    apellido TEXT NOT NULL,
    dni TEXT,
    cargo TEXT,
    email TEXT,
    telefono TEXT,
    empresa_id TEXT REFERENCES empresas(id),
    sede_id TEXT REFERENCES sedes(id),
    responsable_id TEXT NOT NULL REFERENCES usuarios(id),
    estado TEXT NOT NULL CHECK (estado IN ('Potencial','Cliente','Inactivo','No contactar')),
    origen_id TEXT NOT NULL REFERENCES origenes(id),
    observaciones TEXT,
    created_by TEXT REFERENCES usuarios(id),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS oportunidades (
    id TEXT PRIMARY KEY,
    titulo TEXT NOT NULL,
    empresa_id TEXT REFERENCES empresas(id),
    contacto_id TEXT REFERENCES contactos(id),
    plan_id TEXT NOT NULL REFERENCES planes(id),
    sede_id TEXT NOT NULL REFERENCES sedes(id),
    cantidad_socios INTEGER NOT NULL DEFAULT 1,
    responsable_id TEXT NOT NULL REFERENCES usuarios(id),
    valor_estimado REAL,
    valor_final REAL,
    etapa_id TEXT NOT NULL REFERENCES etapas(id),
    estado TEXT NOT NULL CHECK (estado IN ('abierta','ganada','perdida')),
    probabilidad INTEGER,
    fecha_estimada_cierre TEXT NOT NULL,
    fecha_real_cierre TEXT,
    origen_id TEXT NOT NULL REFERENCES origenes(id),
    motivo_perdida_id TEXT REFERENCES motivos_perdida(id),
    observaciones TEXT,
    created_by TEXT REFERENCES usuarios(id),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CHECK (empresa_id IS NOT NULL OR contacto_id IS NOT NULL)
  )`,
  // Cada cambio es una fila nueva: nunca se actualiza ni se borra.
  `CREATE TABLE IF NOT EXISTS historial_etapas (
    id TEXT PRIMARY KEY,
    oportunidad_id TEXT NOT NULL REFERENCES oportunidades(id),
    etapa_anterior_id TEXT REFERENCES etapas(id),
    etapa_nueva_id TEXT NOT NULL REFERENCES etapas(id),
    etapa_anterior_nombre TEXT,
    etapa_nueva_nombre TEXT NOT NULL,
    fecha_hora TEXT NOT NULL,
    usuario_id TEXT NOT NULL REFERENCES usuarios(id),
    observacion TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS actividades (
    id TEXT PRIMARY KEY,
    tipo_id TEXT NOT NULL REFERENCES tipos_actividad(id),
    fecha_hora TEXT NOT NULL,
    usuario_id TEXT NOT NULL REFERENCES usuarios(id),
    empresa_id TEXT REFERENCES empresas(id),
    contacto_id TEXT REFERENCES contactos(id),
    oportunidad_id TEXT REFERENCES oportunidades(id),
    descripcion TEXT NOT NULL,
    resultado TEXT NOT NULL,
    created_at TEXT NOT NULL,
    CHECK (empresa_id IS NOT NULL OR contacto_id IS NOT NULL)
  )`,
  // Quien hizo cada cambio importante (reasignaciones, cierres, ediciones, altas).
  `CREATE TABLE IF NOT EXISTS auditoria (
    id TEXT PRIMARY KEY,
    entidad TEXT NOT NULL,
    entidad_id TEXT NOT NULL,
    accion TEXT NOT NULL,
    detalle TEXT,
    usuario_id TEXT NOT NULL REFERENCES usuarios(id),
    fecha_hora TEXT NOT NULL
  )`,
  'CREATE INDEX IF NOT EXISTS idx_opp_responsable ON oportunidades(responsable_id)',
  'CREATE INDEX IF NOT EXISTS idx_opp_etapa ON oportunidades(etapa_id)',
  'CREATE INDEX IF NOT EXISTS idx_hist_opp ON historial_etapas(oportunidad_id)',
  'CREATE INDEX IF NOT EXISTS idx_act_opp ON actividades(oportunidad_id)',
  'CREATE INDEX IF NOT EXISTS idx_act_contacto ON actividades(contacto_id)',
  'CREATE INDEX IF NOT EXISTS idx_act_empresa ON actividades(empresa_id)',
  'CREATE INDEX IF NOT EXISTS idx_aud_entidad ON auditoria(entidad, entidad_id)'
];

const ORDEN_BORRADO = [
  'auditoria', 'actividades', 'historial_etapas', 'oportunidades', 'contactos', 'empresas',
  'planes', 'sedes', 'tipos_actividad', 'motivos_perdida', 'origenes', 'etapas', 'sesiones', 'usuarios'
];

module.exports = { TABLAS, ORDEN_BORRADO };
