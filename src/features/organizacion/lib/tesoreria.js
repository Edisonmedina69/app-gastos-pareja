export const MONEDAS_ORG = ['PYG', 'USD', 'BRL'];

export const TIPOS_CUENTA_ORG = {
  banco: 'Banco',
  billetera: 'Billetera',
  efectivo: 'Efectivo / Caja',
  socio: 'Custodia de socio',
};

export const TIPOS_OPERACION_ORG = {
  transferencia: 'Transferencia / Cambio',
  financiacion_socio: 'Pago personal de socio',
  reembolso_socio: 'Reembolso a socio',
  retiro_socio: 'Retiro de socio',
  reversion: 'Reversión referenciada',
  pago: 'Pago',
  cobro: 'Cobro',
  ajuste: 'Ajuste',
};

// La autorización final se repite en revertir_org; otros tipos se deniegan.
export function puedeRevertirOperacionOrg(operacion, permisos) {
  const recurso = {
    transferencia: 'cuentas',
    financiacion_socio: 'gastos',
    reembolso_socio: 'socios',
    retiro_socio: 'socios',
  }[operacion?.tipo];
  return Boolean(recurso && permisos.some(p => p.recurso === recurso && p.accion === 'anular' && p.permitido));
}

/**
 * Formatea un importe según las reglas de precisión de Etapa 3:
 * PYG: 0 decimales; USD y BRL: 2 decimales.
 */
export function formatearMonedaOrg(valor, moneda = 'PYG') {
  const numero = Number(valor || 0);
  if (!Number.isFinite(numero)) return moneda === 'USD' ? 'USD 0,00' : moneda === 'BRL' ? 'R$ 0,00' : '0 Gs.';
  if (moneda === 'PYG') {
    const entero = Math.round(numero);
    return `${entero.toLocaleString('es-PY')} Gs.`;
  }
  const formateado = numero.toLocaleString('es-PY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return moneda === 'USD' ? `USD ${formateado}` : `R$ ${formateado}`;
}

/**
 * Parsea un importe ingresado por el usuario respetando la precisión de la moneda.
 * Para PYG exige entero positivo; para USD/BRL hasta 2 decimales.
 */
export function parsearImporteOrg(texto, moneda = 'PYG') {
  if (texto === null || texto === undefined) return NaN;
  const limpio = String(texto).trim().replace(/\s+/g, '');
  if (!limpio) return NaN;
  let normalizado = limpio;
  if (moneda === 'PYG') {
    if (limpio.includes(',')) return NaN;
    normalizado = limpio.replace(/\./g, '');
    if (!/^\d+$/.test(normalizado)) return NaN;
    return Number(normalizado);
  }
  // En USD/BRL admitimos coma o punto como separador decimal (hasta 2 decimales)
  if (limpio.includes(',') && limpio.includes('.')) {
    normalizado = limpio.replace(/\./g, '').replace(',', '.');
  } else if (limpio.includes(',')) {
    normalizado = limpio.replace(',', '.');
  }
  if (!/^\d+(\.\d{1,2})?$/.test(normalizado)) return NaN;
  return Number(normalizado);
}

/**
 * Valida una tasa manual hacia la moneda base PYG (unidades de PYG por 1 unidad de moneda origen).
 * Nunca acepta 1 como fallback para USD o BRL.
 */
export function validarTasaBaseOrg(moneda, tasa) {
  if (!MONEDAS_ORG.includes(moneda)) {
    return { valida: false, error: 'Moneda no admitida.' };
  }
  const num = Number(tasa);
  if (moneda === 'PYG') {
    if (num !== 1) return { valida: false, error: 'La tasa de la moneda base PYG es siempre 1.' };
    return { valida: true, tasa: 1 };
  }
  if (!Number.isFinite(num) || num <= 1) {
    return {
      valida: false,
      error: `Ingresá y confirmá la tasa manual en PYG por 1 ${moneda} (mayor a 1; nunca se usa 1 por defecto).`,
    };
  }
  return { valida: true, tasa: num };
}

/**
 * Valida los datos de una transferencia o cambio de moneda antes de llamar a la RPC.
 */
export function validarTransferenciaOrg({
  cuentaOrigen,
  cuentaDestino,
  importeOrigen,
  importeDestino,
  tasaOrigenBase,
  tasaDestinoBase,
  confirmarSaldoInsuficiente = false,
  motivo = '',
}) {
  if (!cuentaOrigen || !cuentaDestino) {
    return { valida: false, error: 'Seleccioná la cuenta de origen y la cuenta de destino.' };
  }
  if (cuentaOrigen.id === cuentaDestino.id) {
    return { valida: false, error: 'La cuenta de origen y la de destino deben ser distintas.' };
  }
  const impOrig = parsearImporteOrg(importeOrigen, cuentaOrigen.moneda);
  if (!Number.isFinite(impOrig) || impOrig <= 0) {
    return {
      valida: false,
      error: cuentaOrigen.moneda === 'PYG'
        ? 'Ingresá un importe entero mayor a cero en PYG.'
        : `Ingresá un importe válido en ${cuentaOrigen.moneda} (hasta 2 decimales).`,
    };
  }
  const esCambio = cuentaOrigen.moneda !== cuentaDestino.moneda;
  const impDest = esCambio ? parsearImporteOrg(importeDestino, cuentaDestino.moneda) : impOrig;
  if (esCambio && (!Number.isFinite(impDest) || impDest <= 0)) {
    return {
      valida: false,
      error: `Indicá el importe acreditado en ${cuentaDestino.moneda}.`,
    };
  }

  const valOrig = validarTasaBaseOrg(
    cuentaOrigen.moneda,
    cuentaOrigen.moneda === 'PYG' ? 1 : tasaOrigenBase
  );
  if (!valOrig.valida) return valOrig;

  const valDest = validarTasaBaseOrg(
    cuentaDestino.moneda,
    cuentaDestino.moneda === 'PYG' ? 1 : (esCambio ? tasaDestinoBase : valOrig.tasa)
  );
  if (!valDest.valida) return valDest;

  const saldoDisponible = Number(cuentaOrigen.saldo || 0);
  const saldoInsuficiente = saldoDisponible < impOrig;
  if (saldoInsuficiente) {
    if (!confirmarSaldoInsuficiente) {
      return {
        valida: false,
        requiereConfirmarSaldo: true,
        error: `Saldo insuficiente en ${cuentaOrigen.nombre} (${formatearMonedaOrg(saldoDisponible, cuentaOrigen.moneda)}). Marcá la confirmación de excepción e indicá el motivo.`,
      };
    }
    if (!String(motivo || '').trim()) {
      return {
        valida: false,
        requiereConfirmarSaldo: true,
        error: 'Indicá el motivo para autorizar la transferencia con saldo insuficiente.',
      };
    }
  }

  const baseOrigen = Math.round(impOrig * valOrig.tasa);
  const baseDestino = Math.round(impDest * valDest.tasa);

  return {
    valida: true,
    esCambio,
    importeOrigen: impOrig,
    importeDestino: impDest,
    tasaOrigenBase: valOrig.tasa,
    tasaDestinoBase: valDest.tasa,
    baseOrigen,
    baseDestino,
    diferenciaValoracionBase: baseDestino - baseOrigen,
  };
}
