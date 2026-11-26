import { toast } from "react-hot-toast";
import { cerrarSesionGlobal } from "../../../services/auth.service";

/** Pide confirmación y cierra la sesión en todos los dispositivos. */
export async function confirmarCierreGlobal(mensajeExito = "Sesiones cerradas") {
  const confirmar = window.confirm("¿Seguro que querés cerrar la sesión en todos tus dispositivos?");
  if (!confirmar) return;
  const toastId = toast.loading("Cerrando todas las sesiones...");
  try {
    const { error } = await cerrarSesionGlobal();
    if (error) throw error;
    toast.success(mensajeExito, { id: toastId });
  } catch (err) {
    toast.error(err.message, { id: toastId });
  }
}
