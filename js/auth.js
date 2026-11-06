// Sesión del usuario. La autorización real ocurre en el servidor: estos helpers
// solo deciden qué botones mostrar.
window.Pulso = window.Pulso || {};

Pulso.auth = (function () {
  async function login(email, password) {
    const data = await Pulso.api.post('/auth/login', { email: email, password: password });
    Pulso.api.setToken(data.token);
    return data.user;
  }

  async function logout() {
    try { await Pulso.api.post('/auth/logout'); } catch (e) { /* se cierra igual en este navegador */ }
    Pulso.api.setToken(null);
    window.location.href = 'index.html';
  }

  async function currentUser() {
    if (!Pulso.api.getToken()) return null;
    try {
      return (await Pulso.api.get('/auth/me')).user;
    } catch (e) {
      return null;
    }
  }

  async function requireAuth() {
    const user = await currentUser();
    if (!user) {
      window.location.href = 'index.html';
      return null;
    }
    return user;
  }

  const isAdmin = (u) => u.rol === 'administrador';
  const isVendedor = (u) => u.rol === 'vendedor';
  const isSupervisor = (u) => u.rol === 'administrador' || u.rol === 'responsable';

  return { login, logout, currentUser, requireAuth, isAdmin, isVendedor, isSupervisor };
})();
