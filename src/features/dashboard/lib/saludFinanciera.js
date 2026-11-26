import { estaEnCicloFinanciero } from "../../../shared/lib/formatters.js";

export const SALUD_FINANCIERA_VACIA = {
  carga: 0,
  ingresos: 0,
  indice: 0,
  balanceHogar: 0,
  individual: { carga: 0, ingresos: 0, indice: 0 },
  familiar: { carga: 0, ingresos: 0, indice: 0 },
};

/** Monto que falta pagar de la cuota vigente (pago mínimo en tarjetas). */
export function montoCuotaRestante(deuda, cuota) {
  if (deuda.tipo === "tarjeta_credito") {
    const minPago = cuota.pago_minimo || cuota.monto_cuota;
    return Math.max(0, minPago - Number(cuota.monto_abonado));
  }
  return Math.max(0, cuota.monto_cuota - Number(cuota.monto_abonado));
}

/**
 * Índice de endeudamiento individual y del hogar.
 *
 * - Ingresos propios: los del ciclo financiero vigente o los del mes calendario.
 * - Carga individual: deudas individuales propias al 100 % y familiares al 50 %.
 * - Índice = carga / ingresos × 100 (100 si hay carga y no hay ingresos).
 */
export function calcularSaludFinanciera({ usuarioActual, deudas, ingresos, gastos, gastosProgramados }, ahora = new Date()) {
  if (!usuarioActual) return SALUD_FINANCIERA_VACIA;

  const mesActual = ahora.getMonth() + 1;
  const anioActual = ahora.getFullYear();

  const progYo = gastosProgramados?.find((p) => p.usuario_id === usuarioActual.id) || null;
  const diaCobroYo = progYo?.dia_recurrencia || 1;

  const totalIngresosYo =
    ingresos
      ?.filter(
        (i) =>
          i.usuario_id === usuarioActual.id &&
          (estaEnCicloFinanciero(i.fecha_efectiva || i.fecha || i.created_at, diaCobroYo, ahora) ||
            (Number(i.mes) === mesActual && Number(i.anio) === anioActual))
      )
      ?.reduce((acc, i) => acc + Number(i.monto) * (i.tasa_cambio || 1), 0) || 0;

  const totalIngresosHogar =
    ingresos
      ?.filter((i) => Number(i.mes) === mesActual && Number(i.anio) === anioActual)
      ?.reduce((acc, i) => acc + Number(i.monto) * (i.tasa_cambio || 1), 0) || 0;

  const totalGastosHogar =
    gastos
      ?.filter((g) => {
        const fG = new Date(g.fecha || g.created_at);
        return fG.getMonth() + 1 === mesActual && fG.getFullYear() === anioActual;
      })
      ?.reduce((acc, g) => acc + Number(g.monto) * (g.tasa_cambio || 1), 0) || 0;

  let cargaIndividual = 0;
  let cargaTotalHogar = 0;
  (deudas || []).forEach((d) => {
    if (d.estado === "cerrada") return;
    const cuotaActual = d.cuotas_detalle?.find((c) => c.estado === "pendiente");
    if (!cuotaActual) return;

    const montoCuotaPYG = montoCuotaRestante(d, cuotaActual) * (d.tasa_cambio || 1);
    if (d.alcance === "individual" && d.creador_id === usuarioActual.id) cargaIndividual += montoCuotaPYG;
    else if (d.alcance === "familiar") cargaIndividual += montoCuotaPYG * 0.5;
    cargaTotalHogar += montoCuotaPYG;
  });

  const indice = totalIngresosYo > 0 ? (cargaIndividual / totalIngresosYo) * 100 : cargaIndividual > 0 ? 100 : 0;
  const indiceFamiliar =
    totalIngresosHogar > 0 ? (cargaTotalHogar / totalIngresosHogar) * 100 : cargaTotalHogar > 0 ? 100 : 0;
  const balanceHogar = totalIngresosHogar - totalGastosHogar - cargaTotalHogar;

  return {
    carga: cargaIndividual,
    ingresos: totalIngresosYo,
    indice,
    balanceHogar,
    individual: { carga: cargaIndividual, ingresos: totalIngresosYo, indice },
    familiar: { carga: cargaTotalHogar, ingresos: totalIngresosHogar, indice: indiceFamiliar },
  };
}
