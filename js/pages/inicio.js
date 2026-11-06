(async function () {
  const ui = Pulso.ui;
  const user = await Pulso.auth.requireAuth();
  if (!user) return;

  let r;
  try {
    r = await Pulso.api.get('/resumen');
  } catch (e) {
    ui.renderPageError('inicio', user, e.message);
    return;
  }

  const stageRows = r.por_etapa.map((et) => (
    '<div class="stage-mini-row">' +
      '<span class="flex items-center gap-8"><span class="dot" style="background:' + ui.escapeHtml(et.color) + ';"></span>' + ui.escapeHtml(et.nombre) + '</span>' +
      '<span class="text-faint">' + et.cantidad + ' · <span class="mono">' + ui.formatMoney(et.valor) + '</span></span>' +
    '</div>'
  )).join('');

  const alcance = Pulso.auth.isVendedor(user) ? 'Resumen de tu cartera asignada.' : 'Resumen de todo el equipo comercial.';

  document.getElementById('app').innerHTML =
    ui.renderShellStart('inicio', user) +
    ui.renderTopbar({ hideSearch: true, actionsHtml: '<a class="btn-primary" href="oportunidades.html">' + ui.ICONS.oportunidades + ' Ir al embudo comercial</a>' }) +
    '<div class="content flex-col gap-20">' +
      '<div>' +
        '<h2 style="font-size:22px;">Hola, ' + ui.escapeHtml(user.nombre.split(' ')[0]) + '</h2>' +
        '<p class="text-faint" style="margin-top:4px;">' + alcance + '</p>' +
      '</div>' +
      '<div class="stat-grid">' +
        '<div class="stat-card"><span class="stat-value">' + r.empresas + '</span><span class="stat-label">Empresas registradas</span></div>' +
        '<div class="stat-card"><span class="stat-value">' + r.contactos + '</span><span class="stat-label">Interesados y socios</span></div>' +
        '<div class="stat-card"><span class="stat-value">' + r.abiertas + '</span><span class="stat-label">Oportunidades abiertas</span></div>' +
        '<div class="stat-card"><span class="stat-value mono">' + ui.formatMoney(r.valor_abierto) + '</span><span class="stat-label">Valor en el embudo</span></div>' +
        '<div class="stat-card"><span class="stat-value">' + r.ganadas + '</span><span class="stat-label">Altas (ganadas)</span></div>' +
        '<div class="stat-card"><span class="stat-value">' + r.perdidas + '</span><span class="stat-label">Oportunidades perdidas</span></div>' +
      '</div>' +
      '<div class="panel" style="max-width:560px;">' +
        '<span class="panel-title">Oportunidades por etapa</span>' +
        '<div>' + stageRows + '</div>' +
      '</div>' +
    '</div>' +
    ui.renderShellEnd();
})();
