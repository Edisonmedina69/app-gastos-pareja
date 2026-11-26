import {
  actualizarRolPerfil,
  buscarEspaciosPorNombre,
  crearEspacioSoloId,
  obtenerPerfilConEspacio,
  obtenerPrimerEspacio,
  upsertPerfilConEspacio,
} from "../../../services/hogar.service";
import { DEMO_EMAIL, NOMBRE_HOGAR_DEMO, NOMBRE_PERFIL_DEMO, sembrarDatosDemo } from "../../../services/demo.service";
import { EMAIL_SUPERADMIN } from "./roles";

/**
 * Carga el perfil del usuario con su hogar. Casos especiales:
 * - Cuenta demo: garantiza hogar demo, perfil y datos de ejemplo.
 * - Superadmin: crea el perfil si falta y garantiza el rol `superadmin`.
 *
 * Devuelve el perfil o `null` (nunca lanza).
 */
export async function verificarPerfil(usuarioId, userEmail) {
  try {
    let { data: perfil, error } = await obtenerPerfilConEspacio(usuarioId);

    if (userEmail === DEMO_EMAIL) {
      let espacioId = perfil?.espacio_id;

      if (!perfil || !espacioId) {
        const { data: espacios } = await buscarEspaciosPorNombre(NOMBRE_HOGAR_DEMO);
        espacioId = espacios && espacios.length > 0 ? espacios[0].id : null;

        if (!espacioId) {
          const { data: nuevoEspacio } = await crearEspacioSoloId({ nombre_familia: NOMBRE_HOGAR_DEMO });
          if (nuevoEspacio) espacioId = nuevoEspacio.id;
        }

        if (espacioId) {
          const { data: nuevoPerfilDemo } = await upsertPerfilConEspacio({
            id: usuarioId,
            nombre: NOMBRE_PERFIL_DEMO,
            rol: "miembro",
            espacio_id: espacioId,
          });
          if (nuevoPerfilDemo) perfil = nuevoPerfilDemo;
        }
      }

      // Siempre verificar si el hogar demo necesita sus datos de prueba
      if (espacioId) {
        await sembrarDatosDemo(espacioId, usuarioId, { incluirGastosProgramados: true });
      }
    } else if (userEmail === EMAIL_SUPERADMIN) {
      if (!perfil || error) {
        // Vincular temporalmente a algún espacio existente (evita fallos de RLS)
        const { data: espacios } = await obtenerPrimerEspacio();
        const espacioId = espacios && espacios.length > 0 ? espacios[0].id : null;

        const { data: nuevoPerfil, error: errCrear } = await upsertPerfilConEspacio({
          id: usuarioId,
          nombre: "Edison (Admin)",
          rol: "superadmin",
          espacio_id: espacioId,
        });
        if (!errCrear && nuevoPerfil) perfil = nuevoPerfil;
      } else if (perfil.rol !== "superadmin") {
        const { data: perfilActualizado } = await actualizarRolPerfil(usuarioId, "superadmin");
        if (perfilActualizado) perfil = perfilActualizado;
      }
    }
    return !perfil ? null : perfil;
  } catch {
    return null;
  }
}
