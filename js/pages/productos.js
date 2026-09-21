(function () {
  const ui = Pulso.ui;
  const constants = Pulso.constants;
  const user = Pulso.auth.requireAuth();
  if (!user) return;

  const ICONS = {
    estandar: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 7v10M18 7v10M2 10v4M22 10v4M6 12h12"></path></svg>',
    atleta: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2c3 4 6 7 6 11a6 6 0 01-12 0c0-1.5.5-2.7 1.3-3.8.2 1.4 1 2 1.7 1.3C8.5 8 9 5 12 2z"></path></svg>',
    olimpico: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4h8v5a4 4 0 01-8 0V4z"></path><path d="M8 4H4v2a4 4 0 004 4"></path><path d="M16 4h4v2a4 4 0 01-4 4"></path><path d="M12 13v4"></path><path d="M9 21h6"></path><path d="M9 21c0-2 1.3-3 3-3s3 1 3 3"></path></svg>'
  };

  function render() {
    const cards = constants.PRODUCTOS.map((p) => (
      '<div class="product-card">' +
        '<div class="product-icon">' + (ICONS[p.id] || '') + '</div>' +
        '<div class="flex-col" style="gap:6px;">' +
          '<span style="font-family:var(--font-display);font-weight:700;font-size:17px;color:var(--ink);">' + ui.escapeHtml(p.nombre) + '</span>' +
          '<span style="font-size:13px;color:var(--ink-soft);line-height:1.5;">' + ui.escapeHtml(p.descripcion) + '</span>' +
        '</div>' +
        '<span class="product-price">' + ui.formatMoney(p.precio) + '<span class="unit"> /mes</span></span>' +
      '</div>'
    )).join('');

    const app = document.getElementById('app');
    app.innerHTML =
      ui.renderShellStart('productos', user) +
      ui.renderTopbar({ hideSearch: true, actionsHtml: '' }) +
      '<div class="subbar"><span style="font-size:13px;font-weight:600;color:var(--ink);">Catálogo</span><span class="subbar-count">' + constants.PRODUCTOS.length + ' productos activos</span></div>' +
      '<div class="content"><p class="text-faint" style="font-size:12px;margin-bottom:16px;">Catálogo precargado para esta entrega. La gestión completa de productos se incorporará más adelante.</p>' +
      '<div class="product-grid">' + cards + '</div></div>' +
      ui.renderShellEnd();
  }

  render();
})();
