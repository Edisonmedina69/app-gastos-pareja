/**
 * Sueldos programados del usuario que ya deberían estar acreditados este mes
 * (día de cobro alcanzado) y todavía no tienen su ingreso `[FIJO]` registrado.
 */
export function sueldosPendientesDeAcreditar(programados, ingresos, usuarioId, hoy = new Date()) {
  const diaActual = hoy.getDate();
  const mesActual = hoy.getMonth() + 1;
  const anioActual = hoy.getFullYear();

  return programados.filter((prog) => {
    if (prog.usuario_id !== usuarioId) return false;
    if (diaActual < prog.dia_recurrencia) return false;
    const yaCobrado = ingresos.some(
      (ing) =>
        ing.concepto === `[FIJO] ${prog.descripcion}` &&
        Number(ing.mes) === mesActual &&
        Number(ing.anio) === anioActual &&
        ing.usuario_id === prog.usuario_id
    );
    return !yaCobrado;
  });
}
