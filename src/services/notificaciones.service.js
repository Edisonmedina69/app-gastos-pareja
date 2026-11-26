import { supabase } from "./supabaseClient";

/** Últimas 15 notificaciones del hogar. */
export const listarNotificaciones = (espacioId) =>
  supabase.from("notificaciones").select("*").eq("espacio_id", espacioId).order("created_at", { ascending: false }).limit(15);

/** Inserta una o varias notificaciones. Acepta un objeto o un arreglo. */
export const insertarNotificaciones = (filas) =>
  supabase.from("notificaciones").insert(Array.isArray(filas) ? filas : [filas]);

export const marcarNotificacionesLeidas = (espacioId) =>
  supabase.from("notificaciones").update({ leida: true }).eq("espacio_id", espacioId).eq("leida", false);

export const eliminarNotificacion = (id) => supabase.from("notificaciones").delete().eq("id", id);

export const eliminarNotificacionesDeEspacio = (espacioId) =>
  supabase.from("notificaciones").delete().eq("espacio_id", espacioId);
