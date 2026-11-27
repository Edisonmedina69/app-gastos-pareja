import { supabase } from "./supabaseClient";

/* ---------------------------------------------------------------------------
 * Ingresos mensuales (registros reales)
 * ------------------------------------------------------------------------- */

export const listarIngresos = (espacioId) =>
  supabase.from("ingresos_mensuales").select("*").eq("espacio_id", espacioId);

/** Inserta uno o varios ingresos. Acepta un objeto o un arreglo. */
export const insertarIngresos = (filas) =>
  supabase.from("ingresos_mensuales").insert(Array.isArray(filas) ? filas : [filas]);

export const actualizarIngreso = (id, cambios) =>
  supabase.from("ingresos_mensuales").update(cambios).eq("id", id);

export const eliminarIngreso = (id) => supabase.from("ingresos_mensuales").delete().eq("id", id);

export const eliminarIngresosDeEspacio = (espacioId) =>
  supabase.from("ingresos_mensuales").delete().eq("espacio_id", espacioId);

export const existeAlgunIngreso = (espacioId) =>
  supabase.from("ingresos_mensuales").select("id").eq("espacio_id", espacioId).limit(1);

/* ---------------------------------------------------------------------------
 * Ingresos programados (sueldos fijos)
 * ------------------------------------------------------------------------- */

/** Todos los ingresos programados del hogar (incluye inactivos). */
export const listarIngresosProgramados = (espacioId) =>
  supabase.from("ingresos_programados").select("*").eq("espacio_id", espacioId);

/** Ingresos programados activos, ordenados por día de cobro. */
export const listarIngresosProgramadosActivos = (espacioId) =>
  supabase
    .from("ingresos_programados")
    .select("*")
    .eq("espacio_id", espacioId)
    .eq("activo", true)
    .order("dia_recurrencia", { ascending: true });

export const insertarIngresoProgramado = (fila) => supabase.from("ingresos_programados").insert([fila]);

export const actualizarIngresoProgramado = (id, cambios) =>
  supabase.from("ingresos_programados").update(cambios).eq("id", id);

export const eliminarIngresoProgramado = (id) => supabase.from("ingresos_programados").delete().eq("id", id);

/* ---------------------------------------------------------------------------
 * Historial de salarios
 * ------------------------------------------------------------------------- */

export const listarHistorialSalarios = (espacioId) =>
  supabase.from("historial_salarios").select("*").eq("espacio_id", espacioId).order("created_at", { ascending: false });

export const insertarHistorialSalario = (fila) => supabase.from("historial_salarios").insert([fila]);
