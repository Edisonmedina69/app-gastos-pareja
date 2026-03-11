export function formatearNumero(num, mon = "PYG") {
  if (!num) return "0";
  const formato = Number(num).toLocaleString("es-PY");
  return mon === "BRL" ? `R$ ${formato}` : `${formato} Gs.`;
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
