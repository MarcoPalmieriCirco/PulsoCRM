(function () {
  const ui = Pulso.ui;
  const check = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF5252" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"></path></svg>';

  function render(errorMsg, email) {
    const app = document.getElementById('app');
    app.innerHTML =
      '<div class="login-shell">' +
        '<div class="login-aside">' +
          '<div class="login-brand"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#FF5252" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h4l2 7 4-14 2 7h6"></path></svg><span>Pulso</span></div>' +
          '<div class="flex-col gap-20">' +
            '<span class="login-pitch">El CRM pensado para gimnasios y centros de entrenamiento.</span>' +
            '<div class="flex-col gap-12">' +
              '<div class="login-feature">' + check + '<span>Embudo comercial visual, con cada etapa y su historial.</span></div>' +
              '<div class="login-feature">' + check + '<span>Interesados, socios, planes y sedes en un solo lugar.</span></div>' +
              '<div class="login-feature">' + check + '<span>Permisos diferenciados por rol, validados en el servidor.</span></div>' +
            '</div>' +
          '</div>' +
          '<span style="font-size:12px;color:#7A7A7A;">© 2026 Pulso CRM</span>' +
        '</div>' +
        '<div class="login-form-wrap">' +
          '<form class="login-form" id="login-form">' +
            '<div class="flex-col" style="gap:6px;">' +
              '<span style="font-family:var(--font-display);font-weight:700;font-size:26px;color:var(--ink);">Iniciar sesión</span>' +
              '<span style="font-size:14px;color:var(--ink-faint);">Ingresá con tu cuenta de Pulso CRM.</span>' +
            '</div>' +
            '<div class="form-field"><label>Email</label><input type="email" id="login-email" placeholder="nombre@pulsocrm.com" value="' + ui.escapeHtml(email || '') + '" required autofocus></div>' +
            '<div class="form-field"><label>Contraseña</label><input type="password" id="login-password" placeholder="••••••••" required></div>' +
            (errorMsg ? '<div class="form-error">' + ui.escapeHtml(errorMsg) + '</div>' : '') +
            '<button type="submit" class="btn-primary" id="login-submit" style="justify-content:center;">Iniciar sesión</button>' +
            '<div class="login-hint">Usuarios de demostración (contraseña <strong>pulso123</strong>):<br>' +
              '<strong>admin@pulsocrm.com</strong> Administrador<br>' +
              '<strong>responsable@pulsocrm.com</strong> Responsable comercial<br>' +
              '<strong>vendedor@pulsocrm.com</strong> Vendedor' +
            '</div>' +
          '</form>' +
        '</div>' +
      '</div>';

    document.getElementById('login-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      const emailValue = document.getElementById('login-email').value.trim();
      const btn = document.getElementById('login-submit');
      btn.disabled = true;
      try {
        await Pulso.auth.login(emailValue, document.getElementById('login-password').value);
        window.location.href = 'inicio.html';
      } catch (err) {
        render(err.message, emailValue);
      }
    });
  }

  // Si ya hay sesión activa, saltar directo a Inicio.
  (async function () {
    if (await Pulso.auth.currentUser()) {
      window.location.href = 'inicio.html';
    } else {
      render(null);
    }
  })();
})();
