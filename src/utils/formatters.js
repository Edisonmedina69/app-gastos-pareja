export function formatearNumero(num, mon = "PYG") {
  if (!num) return mon === "BRL" ? `R$ 0` : `0 Gs.`;
  const formato = Number(num).toLocaleString("es-PY");
  return mon === "BRL" ? `R$ ${formato}` : `${formato} Gs.`;
}

// Para formatear mientras se escribe (ej: 1.000.000)
export function formatarInput(valor) {
  if (valor === "" || valor === null || valor === undefined) return "";
  
  // 1. Eliminar todo lo que no sea dígito
  const soloNumeros = valor.toString().replace(/\D/g, "");
  
  // 2. Si el resultado es vacío, retornar string vacío
  if (!soloNumeros) return "";
  
  // 3. Convertir a número y aplicar formato de miles con puntos
  return new Intl.NumberFormat("es-PY").format(parseInt(soloNumeros, 10));
}

// Para obtener el número puro para la base de datos
export function desformatearInput(valor) {
  if (!valor) return 0;
  // Eliminar todos los puntos y convertir a número
  const stringLimpio = valor.toString().replace(/\./g, "");
  return parseInt(stringLimpio, 10) || 0;
}

export function formatearFecha(fechaStr) {
  if (!fechaStr) return "";
  const f = new Date(fechaStr);
  return (
    f.toLocaleDateString("es-PY") +
    " " +
    f.toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit" })
  );
}

export function obtenerRangoCicloFinanciero(diaCobro = 1, fechaReferencia = new Date()) {
  const ref = new Date(fechaReferencia);
  const diaNum = parseInt(diaCobro, 10) || 1;
  const anio = ref.getFullYear();
  const mes = ref.getMonth(); // 0-based
  const diaHoy = ref.getDate();

  let inicio, fin;

  if (diaHoy >= diaNum) {
    // El ciclo actual comenzó el día (diaNum) de este mes
    const ultDiaMesActual = new Date(anio, mes + 1, 0).getDate();
    inicio = new Date(anio, mes, Math.min(diaNum, ultDiaMesActual), 0, 0, 0);

    // Termina el día anterior al próximo día de cobro del mes siguiente
    const ultDiaMesSig = new Date(anio, mes + 2, 0).getDate();
    const diaSig = Math.min(diaNum, ultDiaMesSig);
    fin = new Date(anio, mes + 1, diaSig - 1, 23, 59, 59);
  } else {
    // El ciclo actual comenzó el día (diaNum) del mes anterior
    const ultDiaMesAnt = new Date(anio, mes, 0).getDate();
    inicio = new Date(anio, mes - 1, Math.min(diaNum, ultDiaMesAnt), 0, 0, 0);

    const ultDiaMesActual = new Date(anio, mes + 1, 0).getDate();
    const diaActual = Math.min(diaNum, ultDiaMesActual);
    fin = new Date(anio, mes, diaActual - 1, 23, 59, 59);
  }

  return { inicio, fin };
}

export function estaEnCicloFinanciero(fechaObjOrStr, diaCobro = 1, fechaRef = new Date()) {
  if (!fechaObjOrStr) return false;
  const target = new Date(fechaObjOrStr);
  if (isNaN(target.getTime())) return false;

  const { inicio, fin } = obtenerRangoCicloFinanciero(diaCobro, fechaRef);
  return target >= inicio && target <= fin;
}

export function formatearFechaCorta(fechaStr) {
  if (!fechaStr) return "";
  const parts = fechaStr.split("T")[0].split("-");
  if (parts.length === 3) {
    const date = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    return `${parseInt(parts[2], 10)} ${meses[date.getMonth()]} ${parts[0]}`;
  }
  const f = new Date(fechaStr);
  if (isNaN(f.getTime())) return "";
  const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  return `${f.getDate()} ${meses[f.getMonth()]} ${f.getFullYear()}`;
}

export function obtenerFechaCierreExacta(fechaVencimientoStr, diaCierre) {
  if (!fechaVencimientoStr || !diaCierre) return null;
  const parts = fechaVencimientoStr.split("T")[0].split("-");
  if (parts.length !== 3) return null;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1; // 0-based month
  const d = parseInt(parts[2], 10);

  const due = new Date(y, m, d);
  
  // Safe helper to construct a date clamping the day of month to avoid rollover
  const constructSafeDate = (year, month, targetDay) => {
    const lastDay = new Date(year, month + 1, 0).getDate();
    const day = Math.min(targetDay, lastDay);
    return new Date(year, month, day);
  };

  const closingSameMonth = constructSafeDate(y, m, diaCierre);

  let closing;
  if (closingSameMonth >= due) {
    closing = constructSafeDate(y, m - 1, diaCierre);
  } else {
    closing = constructSafeDate(y, m, diaCierre);
  }
  
  const cy = closing.getFullYear();
  const cm = String(closing.getMonth() + 1).padStart(2, "0");
  const cd = String(closing.getDate()).padStart(2, "0");
  return `${cy}-${cm}-${cd}`;
}

export function obtenerPlanAmortizacion(montoCuota, totalCuotas, tasaInteresAnual, cargos = 0) {
  const plan = [];
  const r = (tasaInteresAnual || 0) / 100 / 12;
  const cuotaNeto = Math.max(0, montoCuota - (cargos || 0));
  
  if (r === 0) {
    for (let i = 1; i <= totalCuotas; i++) {
      plan.push({
        numero: i,
        cuota: montoCuota,
        capital: cuotaNeto,
        interes: 0,
        cargos: cargos || 0,
        saldo: cuotaNeto * (totalCuotas - i)
      });
    }
    return plan;
  }
  
  // P = A * (1 - (1 + r)^-n) / r
  let saldoPendiente = cuotaNeto * ((1 - Math.pow(1 + r, -totalCuotas)) / r);
  
  for (let i = 1; i <= totalCuotas; i++) {
    const interes = saldoPendiente * r;
    const capital = Math.max(0, cuotaNeto - interes);
    saldoPendiente = Math.max(0, saldoPendiente - capital);
    
    plan.push({
      numero: i,
      cuota: montoCuota,
      capital: capital,
      interes: interes,
      cargos: cargos || 0,
      saldo: saldoPendiente
    });
  }
  return plan;
}

export function calcularFechaCobroReal(diaRecurrencia, mes = new Date().getMonth() + 1, anio = new Date().getFullYear(), soloDiasHabiles = true, ajuste = 'anterior') {
  const diaNum = parseInt(diaRecurrencia, 10) || 1;
  const ultimoDiaMes = new Date(anio, mes, 0).getDate();
  const diaValido = Math.min(diaNum, ultimoDiaMes);
  
  let fecha = new Date(anio, mes - 1, diaValido);
  
  if (soloDiasHabiles) {
    const dayOfWeek = fecha.getDay(); // 0: Domingo, 6: Sábado
    if (dayOfWeek === 6) { // Sábado
      if (ajuste === 'anterior') {
        fecha.setDate(fecha.getDate() - 1); // Viernes
      } else {
        fecha.setDate(fecha.getDate() + 2); // Lunes
      }
    } else if (dayOfWeek === 0) { // Domingo
      if (ajuste === 'anterior') {
        fecha.setDate(fecha.getDate() - 2); // Viernes
      } else {
        fecha.setDate(fecha.getDate() + 1); // Lunes
      }
    }
  }

  const yyyy = fecha.getFullYear();
  const mm = String(fecha.getMonth() + 1).padStart(2, '0');
  const dd = String(fecha.getDate()).padStart(2, '0');
  
  return {
    fechaStr: `${yyyy}-${mm}-${dd}`,
    fechaObj: fecha,
    esAjustado: soloDiasHabiles && (new Date(anio, mes - 1, diaValido).getDay() === 0 || new Date(anio, mes - 1, diaValido).getDay() === 6)
  };
}
