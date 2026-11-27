import { formatarInput } from "../../../shared/lib/formatters.js";

/**
 * Valores iniciales de los formularios de Deudas Pro. Sin argumento devuelven
 * los de un alta nueva; con un registro, los de su edición (misma lógica que
 * tenían `resetForm*` / `iniciarEdicion*` dentro de Cuentas.jsx).
 */

export function valoresInicialesDeuda(d, monedaGlobal = "PYG") {
  const base = {
    deudaEditandoId: null,
    titulo: "",
    tipoDeuda: "fija",
    alcanceDeuda: "familiar",
    nroTarjeta: "",
    tasaInteres: "",
    montoTotalFormateado: "",
    lineaCreditoFormateada: "",
    pagoMinimoFormateado: "",
    cargosMensualesFormateado: "",
    cantidadCuotas: 1,
    cuotasPagadas: 0,
    diaVencimiento: "5",
    fechaCierreTarjeta: "25",
    deudaMedioPago: "transferencia",
    deudaTipoCuenta: "alias",
    deudaAliasCuenta: "",
    deudaNroCuenta: "",
    deudaNombreTitular: "",
    deudaCiTitular: "",
    monedaDeuda: monedaGlobal,
    modoMonto: "cuota",
    fechaInicioDeuda: "",
  };
  if (!d) return base;

  const cuotas = d.cuotas_detalle || [];
  const primerVencimiento = cuotas[0]?.fecha_vencimiento;
  let diaVencimiento = "5";
  if (primerVencimiento) {
    const parts = primerVencimiento.split("-");
    if (parts.length === 3) diaVencimiento = parseInt(parts[2], 10).toString();
  }
  const totalMontoVal = cuotas.reduce((acc, c) => acc + Number(c.monto_cuota), 0);
  const cuotaMontoVal = cuotas[0]?.monto_cuota || 0;
  const esTarjeta = d.tipo === "tarjeta_credito";

  return {
    ...base,
    deudaEditandoId: d.id,
    titulo: d.titulo,
    tipoDeuda: d.tipo,
    alcanceDeuda: d.alcance,
    nroTarjeta: d.nro_tarjeta || "",
    tasaInteres: d.tasa_interes?.toString() || "",
    monedaDeuda: d.moneda,
    fechaInicioDeuda: primerVencimiento || "",
    diaVencimiento,
    fechaCierreTarjeta: d.fecha_cierre_tarjeta?.toString() || "25",
    modoMonto: esTarjeta ? "total" : "cuota",
    montoTotalFormateado: formatarInput(esTarjeta ? totalMontoVal : cuotaMontoVal),
    lineaCreditoFormateada: formatarInput(d.linea_credito_total),
    pagoMinimoFormateado: formatarInput(cuotas[0]?.pago_minimo || 0),
    cargosMensualesFormateado: formatarInput(cuotas[0]?.cargos || 0),
    cantidadCuotas: cuotas.length || 1,
    cuotasPagadas: cuotas.filter((c) => c.estado === "pagado").length,
    deudaMedioPago: d.medio_pago || "transferencia",
    deudaTipoCuenta: d.tipo_cuenta || "alias",
    deudaAliasCuenta: d.alias_cuenta || "",
    deudaNroCuenta: d.nro_cuenta || "",
    deudaNombreTitular: d.nombre_titular || "",
    deudaCiTitular: d.ci_titular || "",
  };
}

export function valoresInicialesFijo(f, monedaGlobal = "PYG") {
  if (!f) {
    return {
      idFijoEditando: null,
      fijoConcepto: "",
      fijoMontoFormateado: "",
      fijoMoneda: monedaGlobal,
      fijoDiaRecurrencia: "5",
      fijoCategoria: "Casa",
      fijoParaQuien: "Ambos",
      fijoMedioPago: "transferencia",
      fijoTipoCuenta: "alias",
      fijoAliasCuenta: "",
      fijoNroCuenta: "",
      fijoNombreTitular: "",
      fijoCiTitular: "",
    };
  }
  return {
    idFijoEditando: f.id,
    fijoConcepto: f.concepto,
    fijoMontoFormateado: formatarInput(f.monto),
    fijoMoneda: f.moneda,
    fijoDiaRecurrencia: f.dia_recurrencia.toString(),
    fijoCategoria: f.categoria,
    fijoParaQuien: f.para_quien,
    fijoMedioPago: f.medio_pago || "transferencia",
    fijoTipoCuenta: f.tipo_cuenta || "alias",
    fijoAliasCuenta: f.alias_cuenta || "",
    fijoNroCuenta: f.nro_cuenta || "",
    fijoNombreTitular: f.nombre_titular || "",
    fijoCiTitular: f.ci_titular || "",
  };
}

export function valoresInicialesPrevision(p, monedaGlobal = "PYG") {
  if (!p) {
    return { idPrevisionEditando: null, previsionConcepto: "", previsionMontoFormateado: "", previsionMoneda: monedaGlobal, previsionParaQuien: "Ambos" };
  }
  return {
    idPrevisionEditando: p.id,
    previsionConcepto: p.concepto.replace("[PRESUPUESTO] ", ""),
    previsionMontoFormateado: formatarInput(p.monto),
    previsionMoneda: p.moneda,
    previsionParaQuien: p.para_quien,
  };
}

export function valoresInicialesPagoFijo(f, usuarioId) {
  return {
    pagarMontoFormateado: f.monto > 0 ? formatarInput(f.monto) : "",
    pagarMoneda: f.moneda,
    pagarPagadorId: usuarioId || "",
    pagarParaQuien: f.para_quien,
    pagarMedioPago: f.medio_pago || "transferencia",
  };
}

export function valoresInicialesMedioPago(item) {
  return {
    mpEditMedioPago: item.medio_pago || "transferencia",
    mpEditTipoCuenta: item.tipo_cuenta || "alias",
    mpEditAlias: item.alias_cuenta || "",
    mpEditNroCuenta: item.nro_cuenta || "",
    mpEditNombreTitular: item.nombre_titular || "",
    mpEditCiTitular: item.ci_titular || "",
  };
}

/** Datos de cuenta a guardar según el medio de pago (null si no aplica). */
export function datosCuentaParaGuardar({ medioPago, tipoCuenta, alias, nroCuenta, nombreTitular, ciTitular }) {
  const transferencia = medioPago === "transferencia";
  const porNro = transferencia && tipoCuenta === "nro_cuenta";
  return {
    medio_pago: medioPago,
    tipo_cuenta: transferencia ? tipoCuenta : null,
    alias_cuenta: transferencia && tipoCuenta === "alias" ? alias.trim() : null,
    nro_cuenta: porNro ? nroCuenta.trim() : null,
    nombre_titular: porNro ? nombreTitular.trim() : null,
    ci_titular: porNro ? ciTitular.trim() : null,
  };
}
