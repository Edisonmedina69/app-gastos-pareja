import { obtenerPerfilConEspacio } from "../../../services/hogar.service";

/** Consulta de identidad sin promociones ni pertenencias inferidas en cliente. */
export async function verificarPerfil(usuarioId) {
  const { data, error } = await obtenerPerfilConEspacio(usuarioId);
  return error ? null : data;
}
