import { supabase, obtenerClienteSinSesion } from "./supabaseClient";

/** Sesión actual (misma forma que `supabase.auth.getSession()`). */
export const obtenerSesion = () => supabase.auth.getSession();

/** Suscribe a cambios de sesión. Devuelve `{ data: { subscription } }`. */
export const escucharCambiosSesion = (callback) => supabase.auth.onAuthStateChange(callback);

export const iniciarSesion = (email, password) =>
  supabase.auth.signInWithPassword({ email, password });

/** Cierra la sesión en este dispositivo. */
export const cerrarSesion = () => supabase.auth.signOut();

/** Cierra la sesión en todos los dispositivos del usuario. */
export const cerrarSesionGlobal = () => supabase.auth.signOut({ scope: "global" });

/**
 * Registra una cuenta nueva sin tocar la sesión activa (lo usa el superadmin
 * para dar de alta miembros de un hogar).
 */
export const registrarCuentaSinSesion = (email, password) =>
  obtenerClienteSinSesion().auth.signUp({ email, password });
