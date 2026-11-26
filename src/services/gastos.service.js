import { supabase } from "./supabaseClient";

/** Gastos reales del hogar, del más reciente al más antiguo. */
export const listarGastos = (espacioId) =>
  supabase.from("gastos").select("*").eq("espacio_id", espacioId).order("fecha", { ascending: false });

/** Inserta uno o varios gastos. Acepta un objeto o un arreglo. */
export const insertarGastos = (gastos) =>
  supabase.from("gastos").insert(Array.isArray(gastos) ? gastos : [gastos]);

export const actualizarGasto = (id, cambios) => supabase.from("gastos").update(cambios).eq("id", id);

export const eliminarGasto = (id) => supabase.from("gastos").delete().eq("id", id);

export const eliminarGastosDeEspacio = (espacioId) =>
  supabase.from("gastos").delete().eq("espacio_id", espacioId);

/** ¿El hogar ya tiene algún gasto? (consulta liviana de un solo id) */
export const existeAlgunGasto = (espacioId) =>
  supabase.from("gastos").select("id").eq("espacio_id", espacioId).limit(1);
