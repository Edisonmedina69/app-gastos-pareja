import { supabase } from "./supabaseClient";

/* ---------------------------------------------------------------------------
 * Perfiles
 * ------------------------------------------------------------------------- */

/** Perfil del usuario con su espacio embebido (o `null` si no existe). */
export const obtenerPerfilConEspacio = (usuarioId) =>
  supabase.from("perfiles").select("*, espacios(*)").eq("id", usuarioId).maybeSingle();

/** Inserta o actualiza un perfil y devuelve la fila con el espacio embebido. */
export const upsertPerfilConEspacio = (perfil) =>
  supabase.from("perfiles").upsert([perfil]).select("*, espacios(*)").single();

export const insertarPerfil = (perfil) => supabase.from("perfiles").insert([perfil]);

export const actualizarRolPerfil = (usuarioId, rol) =>
  supabase.from("perfiles").update({ rol }).eq("id", usuarioId).select("*, espacios(*)").single();

export const actualizarPerfil = (usuarioId, cambios) =>
  supabase.from("perfiles").update(cambios).eq("id", usuarioId);

export const eliminarPerfil = (usuarioId) => supabase.from("perfiles").delete().eq("id", usuarioId);

/** Miembros (perfiles) de un hogar. */
export const listarMiembros = (espacioId) =>
  supabase.rpc("listar_miembros_hogar", { p_espacio_id: espacioId });

/** Perfiles sin hogar asignado. */
export const listarPerfilesSinEspacio = () =>
  supabase.from("perfiles").select("*").is("espacio_id", null);


/* ---------------------------------------------------------------------------
 * Espacios (hogares)
 * ------------------------------------------------------------------------- */

/** Todos los espacios con sus miembros (panel superadmin). */
export const listarEspaciosConMiembros = () =>
  supabase.from("espacios").select("*, perfiles(id, nombre)").order("created_at", { ascending: false });

/** Primer espacio existente (lo usa la creación del perfil de administrador). */
export const obtenerPrimerEspacio = () => supabase.from("espacios").select("id").limit(1);

export const buscarEspaciosPorNombre = (nombreFamilia) =>
  supabase.from("espacios").select("id").eq("nombre_familia", nombreFamilia).limit(1);

/**
 * Une al usuario actual a un hogar con su código de invitación. El servidor
 * valida el código y el límite de miembros (RPC `unirse_a_espacio`).
 */
export const unirseAEspacio = (codigo, nombre) =>
  supabase.rpc("unirse_a_espacio", { p_codigo: codigo, p_nombre: nombre });

/**
 * Crea un hogar nuevo con el usuario actual como `admin_hogar`. El código de
 * invitación se genera en el servidor (RPC `crear_espacio`).
 */
export const crearEspacioPropio = (nombreEspacio, nombre) =>
  supabase.rpc("crear_espacio", { p_nombre_espacio: nombreEspacio, p_nombre: nombre });

/** Inserta un espacio y devuelve la fila completa. */
export const crearEspacio = (espacio) => supabase.from("espacios").insert([espacio]).select().single();

/** Inserta un espacio y devuelve solo su `id`. */
export const crearEspacioSoloId = (espacio) =>
  supabase.from("espacios").insert([espacio]).select("id").single();

export const actualizarEspacio = (espacioId, cambios) =>
  supabase.from("espacios").update(cambios).eq("id", espacioId);

/** Borra un espacio; la base elimina en cascada todo lo vinculado. */
export const eliminarEspacio = (espacioId) => supabase.from("espacios").delete().eq("id", espacioId);

export const eliminarEspacios = (ids) => supabase.from("espacios").delete().in("id", ids);

/* ---------------------------------------------------------------------------
 * Tiempo real
 * ------------------------------------------------------------------------- */

/**
 * Escucha cualquier cambio del esquema `public` filtrado por `espacio_id` y
 * llama a `alCambiar`. Devuelve una función para cancelar la suscripción.
 */
export function suscribirCambiosEspacio(espacioId, alCambiar) {
  const canal = supabase
    .channel(`espacio-${espacioId}`)
    .on("postgres_changes", { event: "*", schema: "public", filter: `espacio_id=eq.${espacioId}` }, () => alCambiar())
    .subscribe();

  return () => {
    supabase.removeChannel(canal);
  };
}
