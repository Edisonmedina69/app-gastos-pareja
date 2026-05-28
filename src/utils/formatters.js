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


