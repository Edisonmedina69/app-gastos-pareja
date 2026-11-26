import { actualizarCuota, insertarCuotas } from "../../../services/deudas.service";
import { construirCuotaSiguienteCiclo } from "./ciclosTarjeta";

/**
 * Cierra el ciclo de una tarjeta: archiva la cuota actual como pagada y crea la
 * del mes siguiente con el saldo pendiente más el interés.
 *
 * `{ verificarArchivo: true }` corta si falla el archivado (cierre automático);
 * el cierre manual nunca verificó ese paso y se mantiene igual.
 */
export async function cerrarCicloTarjeta(deuda, cuota, espacioId, usuarioId, { verificarArchivo = false } = {}) {
  const { error: errUpd } = await actualizarCuota(cuota.id, {
    estado: "pagado",
    fecha_pago: new Date().toISOString(),
    pagador_id: usuarioId,
  });
  if (verificarArchivo && errUpd) throw errUpd;

  const { error: errIns } = await insertarCuotas([construirCuotaSiguienteCiclo(deuda, cuota, espacioId)]);
  if (errIns) throw errIns;
}
