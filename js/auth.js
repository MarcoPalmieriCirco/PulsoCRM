// Autenticación simple: valida contra los usuarios precargados y guarda la
// sesión en localStorage. La gestión completa de roles y permisos queda
// fuera del alcance de esta entrega.
window.Pulso = window.Pulso || {};

Pulso.auth = (function () {
  const SESSION_KEY = 'pulso_session';

  function login(email, password) {
    const user = Pulso.db.findUserByEmail(email);
    if (!user || user.password !== password) return null;
    localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: user.id }));
    return user;
  }

  function logout() {
    localStorage.removeItem(SESSION_KEY);
    window.location.href = 'index.html';
  }

  function currentUser() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const session = JSON.parse(raw);
      return Pulso.db.findUser(session.userId);
    } catch (e) {
      return null;
    }
  }

  function requireAuth() {
    const user = currentUser();
    if (!user) {
      window.location.href = 'index.html';
      return null;
    }
    return user;
  }

  return { login, logout, currentUser, requireAuth };
})();
