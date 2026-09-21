// Datos precargados del sistema (Entrega 1: no requieren configuración desde la UI).
window.Pulso = window.Pulso || {};

Pulso.constants = (function () {
  const PRODUCTOS = [
    { id: 'estandar', nombre: 'Pase Estándar', descripcion: 'Suscripción mensual · Acceso a musculación', precio: 15000 },
    { id: 'atleta', nombre: 'Pase Atleta', descripcion: 'Suscripción mensual + 1 clase por semana', precio: 22000 },
    { id: 'olimpico', nombre: 'Pase Olímpico', descripcion: 'Suscripción mensual + 3 clases por semana', precio: 30000 }
  ];

  // Embudo comercial precargado, en orden. "tipo" determina si la etapa es
  // abierta, ganada o perdida (regla: una oportunidad abierta debe estar en
  // una etapa abierta).
  const ETAPAS = [
    { key: 'nuevo', nombre: 'Nuevo Contacto / Consulta', orden: 1, tipo: 'abierta', dot: '#C7C7C7' },
    { key: 'relevamiento', nombre: 'Relevamiento de Necesidades', orden: 2, tipo: 'abierta', dot: '#9E9E9E' },
    { key: 'demo', nombre: 'Clase de Prueba / Demo Agendada', orden: 3, tipo: 'abierta', dot: '#6E6E6E' },
    { key: 'propuesta', nombre: 'Propuesta / Negociación', orden: 4, tipo: 'abierta', dot: '#3A3A3A' },
    { key: 'ganada', nombre: 'Ganada', orden: 5, tipo: 'ganada', dot: '#141414' },
    { key: 'perdida', nombre: 'Perdida', orden: 6, tipo: 'perdida', dot: '#D42B2B' }
  ];

  const ORIGENES = ['Sitio web', 'Redes sociales', 'Publicidad', 'Recomendación', 'Evento', 'Prospección comercial', 'Cliente existente'];

  const ESTADOS_CLIENTE = ['Potencial', 'Cliente', 'Inactivo', 'No contactar'];

  const MOTIVOS_PERDIDA = ['Precio', 'Falta de presupuesto', 'Eligió otro gimnasio', 'Producto inadecuado', 'Falta de respuesta', 'Decisión postergada'];

  function etapa(key) {
    return ETAPAS.find((e) => e.key === key) || null;
  }

  function producto(id) {
    return PRODUCTOS.find((p) => p.id === id) || null;
  }

  return { PRODUCTOS, ETAPAS, ORIGENES, ESTADOS_CLIENTE, MOTIVOS_PERDIDA, etapa, producto };
})();
