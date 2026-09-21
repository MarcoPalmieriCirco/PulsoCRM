(function () {
  const ui = Pulso.ui;
  const db = Pulso.db;
  const constants = Pulso.constants;
  const user = Pulso.auth.requireAuth();
  if (!user) return;

  function render() {
    const empresas = db.empresas();
    const contactos = db.contactos();
    const oportunidades = db.oportunidades();
    const abiertas = oportunidades.filter((o) => o.estado === 'abierta');
    const valorAbierto = abiertas.reduce((sum, o) => sum + (o.valor || 0), 0);
    const ganadas = oportunidades.filter((o) => o.estado === 'ganada');

    const stageRows = constants.ETAPAS.map((et) => {
      const items = oportunidades.filter((o) => o.etapaKey === et.key);
      const total = items.reduce((sum, o) => sum + (o.valor || 0), 0);
      return (
        '<div class="stage-mini-row">' +
          '<span class="flex items-center gap-8"><span class="dot" style="background:' + et.dot + ';"></span>' + ui.escapeHtml(et.nombre) + '</span>' +
          '<span class="text-faint">' + items.length + ' · <span class="mono">' + ui.formatMoney(total) + '</span></span>' +
        '</div>'
      );
    }).join('');

    const app = document.getElementById('app');
    app.innerHTML =
      ui.renderShellStart('inicio', user) +
      ui.renderTopbar({ hideSearch: true, actionsHtml: '<a class="btn-primary" href="oportunidades.html">' + ui.ICONS.oportunidades + ' Ir al embudo comercial</a>' }) +
      '<div class="content flex-col gap-20">' +
        '<div>' +
          '<h2 style="font-size:22px;">Hola, ' + ui.escapeHtml(user.nombre.split(' ')[0]) + '</h2>' +
          '<p class="text-faint" style="margin-top:4px;">Resumen general de Pulso CRM.</p>' +
        '</div>' +
        '<div class="stat-grid">' +
          '<div class="stat-card"><span class="stat-value">' + empresas.length + '</span><span class="stat-label">Empresas registradas</span></div>' +
          '<div class="stat-card"><span class="stat-value">' + contactos.length + '</span><span class="stat-label">Contactos registrados</span></div>' +
          '<div class="stat-card"><span class="stat-value">' + abiertas.length + '</span><span class="stat-label">Oportunidades abiertas</span></div>' +
          '<div class="stat-card"><span class="stat-value mono">' + ui.formatMoney(valorAbierto) + '</span><span class="stat-label">Valor en el embudo</span></div>' +
          '<div class="stat-card"><span class="stat-value">' + ganadas.length + '</span><span class="stat-label">Oportunidades ganadas</span></div>' +
        '</div>' +
        '<div class="panel" style="max-width:560px;">' +
          '<span class="panel-title">Oportunidades por etapa</span>' +
          '<div>' + stageRows + '</div>' +
        '</div>' +
      '</div>' +
      ui.renderShellEnd();
  }

  render();
})();
