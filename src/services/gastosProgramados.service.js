import { supabase } from "./supabaseClient";

/**
 * Gastos programados: gastos fijos mensuales y previsiones
 * (los que tienen el prefijo `[PRESUPUESTO]` en el concepto).
 */
export const listarGastosProgramados = (espacioId) =>
  supabase.from("gastos_programados").select("*").eq("espacio_id", espacioId).order("dia_recurrencia", { ascending: true });

/** Inserta uno o varios gastos programados. Acepta un objeto o un arreglo. */
export const insertarGastosProgramados = (filas) =>
  supabase.from("gastos_programados").insert(Array.isArray(filas) ? filas : [filas]);

export const actualizarGastoProgramado = (id, cambios) =>
  supabase.from("gastos_programados").update(cambios).eq("id", id);

export const eliminarGastoProgramado = (id) => supabase.from("gastos_programados").delete().eq("id", id);

export const eliminarGastosProgramadosDeEspacio = (espacioId) =>
  supabase.from("gastos_programados").delete().eq("espacio_id", espacioId);

export const existeAlgunGastoProgramado = (espacioId) =>
  supabase.from("gastos_programados").select("id").eq("espacio_id", espacioId).limit(1);
