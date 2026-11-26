import { obtenerFechaCierreExacta } from "../../../shared/lib/formatters.js";

/**
 * Notificaciones nuevas para cuotas pendientes que vencen hoy o en los
 * próximos 2 días. No repite mensajes que ya estén en `notisActuales`.
 */
export function construirAlertasVencimiento(deudas, notisActuales, { espacioId, usuarioId }, hoy = new Date()) {
  const alertas = [];
  deudas.forEach((d) => {
    d.cuotas_detalle?.forEach((c) => {
      if (c.estado !== "pendiente") return;
      const venc = new Date(c.fecha_vencimiento);
      const diffDays = Math.ceil((venc - hoy) / (1000 * 60 * 60 * 24));
      if (diffDays >= 0 && diffDays <= 2) {
        const msg = `Cuota ${c.numero_cuota} de "${d.titulo}" vence en ${diffDays === 0 ? "hoy" : diffDays + " días"}.`;
        if (!notisActuales.some((n) => n.mensaje === msg)) {
          alertas.push({ espacio_id: espacioId, usuario_id: usuarioId, titulo: "⚠️ Vencimiento", mensaje: msg, tipo: "alerta" });
        }
      }
    });
  });
  return alertas;
}

/**
 * Tarjetas activas cuyo cierre ya llegó (hoy ≥ fecha de cierre de la cuota
 * pendiente). Devuelve pares `{ deuda, cuota }` listos para cerrar.
 */
export function tarjetasParaCierreAutomatico(deudas, hoy = new Date()) {
  const ref = new Date(hoy);
  ref.setHours(0, 0, 0, 0);
  const pendientes = [];
  for (const d of deudas) {
    if (d.tipo !== "tarjeta_credito" || d.estado !== "activa" || !d.fecha_cierre_tarjeta) continue;
    const cuota = d.cuotas_detalle?.find((c) => c.estado === "pendiente");
    if (!cuota) continue;
    const cierreStr = obtenerFechaCierreExacta(cuota.fecha_vencimiento, d.fecha_cierre_tarjeta);
    if (!cierreStr) continue;
    const cierre = new Date(cierreStr);
    cierre.setHours(0, 0, 0, 0);
    if (ref >= cierre) pendientes.push({ deuda: d, cuota });
  }
  return pendientes;
}
