// Lógica de negocio compartida para el cambio de etapa de una oportunidad,
// usada tanto por el tablero/lista como por el detalle. Centralizada acá
// para no duplicar las reglas en cada pantalla.
window.Pulso = window.Pulso || {};

Pulso.opportunities = (function () {
  const db = Pulso.db;
  const constants = Pulso.constants;

  function todayIso() {
    return new Date().toISOString().slice(0, 10);
  }

  function stageType(key) {
    const e = constants.etapa(key);
    return e ? e.tipo : 'abierta';
  }

  // Aplica el cambio de etapa respetando las reglas de negocio:
  // - etapa "ganada" registra fecha real de cierre.
  // - etapa "perdida" exige motivo de pérdida y registra fecha real de cierre.
  // - reabrir una oportunidad cerrada pide confirmación explícita.
  // Devuelve { ok:true } si se aplicó, o { ok:false, needsMotivo|needsConfirm:true } si falta un paso.
  function move(id, newKey, opts) {
    opts = opts || {};
    const opp = db.findOportunidad(id);
    if (!opp || opp.etapaKey === newKey) return { ok: false };

    const newType = stageType(newKey);
    const wasClosed = opp.estado !== 'abierta';

    if (newType === 'perdida') {
      if (!opts.motivo) return { ok: false, needsMotivo: true };
      db.updateOportunidad(id, { etapaKey: newKey, estado: 'perdida', fechaRealCierre: todayIso(), motivoPerdida: opts.motivo });
      return { ok: true };
    }

    if (newType === 'ganada') {
      db.updateOportunidad(id, { etapaKey: newKey, estado: 'ganada', fechaRealCierre: todayIso(), motivoPerdida: null });
      return { ok: true };
    }

    // Nueva etapa abierta.
    if (wasClosed && !opts.confirmed) return { ok: false, needsConfirm: true };
    db.updateOportunidad(id, { etapaKey: newKey, estado: 'abierta', fechaRealCierre: null, motivoPerdida: null });
    return { ok: true };
  }

  return { move, todayIso, stageType };
})();
