// Cliente de la API: agrega el token de sesión y unifica el manejo de errores.
window.Pulso = window.Pulso || {};

Pulso.api = (function () {
  const TOKEN_KEY = 'pulso_token';

  function getToken() {
    try { return localStorage.getItem(TOKEN_KEY); } catch (e) { return null; }
  }

  function setToken(token) {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch (e) { /* sin almacenamiento: la sesión dura lo que la página */ }
  }

  async function request(method, path, body) {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const token = getToken();
    if (token) headers.Authorization = 'Bearer ' + token;

    let res;
    try {
      res = await fetch(Pulso.config.apiBase + '/api' + path, {
        method: method,
        headers: headers,
        body: body !== undefined ? JSON.stringify(body) : undefined
      });
    } catch (e) {
      throw Object.assign(new Error('No se pudo conectar con el servidor. Revisá tu conexión y probá de nuevo.'), { status: 0 });
    }

    let data = null;
    try { data = await res.json(); } catch (e) { /* respuesta sin cuerpo */ }
    if (!res.ok) {
      if (res.status === 401 && path !== '/auth/login') {
        setToken(null);
        window.location.href = 'index.html';
      }
      throw Object.assign(new Error((data && data.error) || 'Ocurrió un error inesperado.'), { status: res.status });
    }
    return data;
  }

  function qs(params) {
    const parts = [];
    Object.keys(params || {}).forEach((k) => {
      const v = params[k];
      if (v !== '' && v !== null && v !== undefined) parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(v));
    });
    return parts.length ? '?' + parts.join('&') : '';
  }

  return {
    getToken, setToken, qs,
    get: (path, params) => request('GET', path + qs(params)),
    post: (path, body) => request('POST', path, body || {}),
    put: (path, body) => request('PUT', path, body || {}),
    del: (path) => request('DELETE', path)
  };
})();
