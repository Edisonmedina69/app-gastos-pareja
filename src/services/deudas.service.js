import { supabase } from "./supabaseClient";

/* ---------------------------------------------------------------------------
 * Deudas maestras (préstamos, cuotas fijas y tarjetas de crédito)
 * ------------------------------------------------------------------------- */

/** Deudas del hogar con todas sus cuotas embebidas. */
export const listarDeudasConCuotas = (espacioId) =>
  supabase.from("deudas_maestras").select("*, cuotas_detalle(*)").eq("espacio_id", espacioId);

/** Inserta una deuda y devuelve la fila completa. */
export const crearDeuda = (deuda) => supabase.from("deudas_maestras").insert([deuda]).select().single();

/** Inserta una deuda y devuelve solo su `id`. */
export const crearDeudaSoloId = (deuda) =>
  supabase.from("deudas_maestras").insert([deuda]).select("id").single();

export const actualizarDeuda = (id, cambios) => supabase.from("deudas_maestras").update(cambios).eq("id", id);

export const eliminarDeuda = (id) => supabase.from("deudas_maestras").delete().eq("id", id);

export const eliminarDeudasDeEspacio = (espacioId) =>
  supabase.from("deudas_maestras").delete().eq("espacio_id", espacioId);

export const existeAlgunaDeuda = (espacioId) =>
  supabase.from("deudas_maestras").select("id").eq("espacio_id", espacioId).limit(1);

/* ---------------------------------------------------------------------------
 * Cuotas
 * ------------------------------------------------------------------------- */

export const obtenerCuota = (id) => supabase.from("cuotas_detalle").select("*").eq("id", id).single();

/** Estado de todas las cuotas de una deuda (para saber si quedó saldada). */
export const listarEstadosCuotas = (deudaId) =>
  supabase.from("cuotas_detalle").select("estado").eq("deuda_maestra_id", deudaId);

/** Inserta una o varias cuotas. Acepta un objeto o un arreglo. */
export const insertarCuotas = (cuotas) =>
  supabase.from("cuotas_detalle").insert(Array.isArray(cuotas) ? cuotas : [cuotas]);

export const actualizarCuota = (id, cambios) => supabase.from("cuotas_detalle").update(cambios).eq("id", id);

export const eliminarCuota = (id) => supabase.from("cuotas_detalle").delete().eq("id", id);

export const eliminarCuotasDeDeuda = (deudaId) =>
  supabase.from("cuotas_detalle").delete().eq("deuda_maestra_id", deudaId);
