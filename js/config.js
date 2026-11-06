// URL de la API. En local la sirve el mismo servidor; publicado en GitHub Pages
// apunta a la API desplegada en Vercel.
window.Pulso = window.Pulso || {};

Pulso.config = (function () {
  const API_PRODUCCION = 'https://PENDIENTE-DE-DESPLIEGUE.vercel.app';
  const esLocal = /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);
  return { apiBase: esLocal ? '' : API_PRODUCCION };
})();
