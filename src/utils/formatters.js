export function formatearNumero(num, mon = "PYG") {
  if (!num) return mon === "BRL" ? `R$ 0` : `0 Gs.`;
  const formato = Number(num).toLocaleString("es-PY");
  return mon === "BRL" ? `R$ ${formato}` : `${formato} Gs.`;
}

// Para formatear mientras se escribe (ej: 1.000.000)
export function formatarInput(valor) {
  if (!valor) return "";
  const num = valor.toString().replace(/\D/g, "");
  return num.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

// Para obtener el número puro para la base de datos
export function desformatearInput(valor) {
  if (!valor) return 0;
  return parseFloat(valor.toString().replace(/\./g, "")) || 0;
}

export function formatearFecha(fechaStr) {
...
  const f = new Date(fechaStr);
  return (
    f.toLocaleDateString("es-PY") +
    " " +
    f.toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit" })
  );
}
