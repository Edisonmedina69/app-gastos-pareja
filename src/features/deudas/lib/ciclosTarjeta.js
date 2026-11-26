/**
 * Reglas puras (sin red) del ciclo de facturación de tarjetas de crédito.
 * Las usan el cierre automático al cargar datos y el cierre manual en Deudas Pro.
 */

/** Si la fecha cae sábado o domingo, la corre al lunes siguiente. */
export function ajustarDiaHabil(fecha) {
  const d = fecha.getDay();
  const nf = new Date(fecha);
  if (d === 0) nf.setDate(nf.getDate() + 1);
  else if (d === 6) nf.setDate(nf.getDate() + 2);
  return nf;
}

/** `Date` → `"AAAA-MM-DD"` en hora local. */
export function aFechaISOLocal(fecha) {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`;
}

/** Saldo que queda sin pagar en una cuota y el interés mensual que genera. */
export function calcularSaldoEInteres(deuda, cuota) {
  const saldoPendiente = Math.max(0, Number(cuota.monto_cuota) - Number(cuota.monto_abonado));
  const interesGenerado =
    saldoPendiente > 0 && deuda.tasa_interes > 0 ? Math.round(saldoPendiente * (deuda.tasa_interes / 100 / 12)) : 0;
  return { saldoPendiente, interesGenerado };
}

/**
 * Vencimiento del ciclo siguiente: mismo día del mes próximo (recortado al
 * último día si el mes es más corto) y corrido a día hábil.
 */
export function calcularSiguienteVencimiento(fechaVencimientoStr) {
  const parts = fechaVencimientoStr.split("-");
  let nextYear = parseInt(parts[0], 10);
  let nextMonth = parseInt(parts[1], 10); // mes 1-based = índice 0-based del mes siguiente
  if (nextMonth > 11) {
    nextMonth = 0;
    nextYear += 1;
  }
  const rawDay = Math.min(parseInt(parts[2], 10), new Date(nextYear, nextMonth + 1, 0).getDate());
  return aFechaISOLocal(ajustarDiaHabil(new Date(nextYear, nextMonth, rawDay)));
}

/** Cuota nueva que abre el ciclo siguiente al cerrar `cuota`. */
export function construirCuotaSiguienteCiclo(deuda, cuota, espacioId) {
  const { saldoPendiente, interesGenerado } = calcularSaldoEInteres(deuda, cuota);
  const montoInicial = saldoPendiente + interesGenerado;
  return {
    deuda_maestra_id: deuda.id,
    espacio_id: espacioId,
    numero_cuota: cuota.numero_cuota + 1,
    monto_cuota: montoInicial,
    monto_abonado: 0,
    pago_minimo: montoInicial * 0.1, // 10 % por defecto
    fecha_vencimiento: calcularSiguienteVencimiento(cuota.fecha_vencimiento),
    estado: "pendiente",
  };
}
