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
