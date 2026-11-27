import { createClient } from "@supabase/supabase-js";

/**
 * Cliente único de Supabase.
 *
 * Regla de arquitectura: solo los módulos dentro de `src/services/` importan
 * este archivo. Componentes, hooks y features hablan con la base a través de
 * los servicios de dominio (`*.service.js`).
 */
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Cliente sin sesión persistente: sirve para registrar cuentas nuevas desde el
 * panel de superadmin sin cerrar ni reemplazar la sesión del administrador.
 * Se crea recién cuando se necesita.
 */
let clienteSinSesion = null;

export function obtenerClienteSinSesion() {
  if (!clienteSinSesion) {
    clienteSinSesion = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storageKey: "sb-temp-auth-token",
        storage: {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        },
      },
    });
  }
  return clienteSinSesion;
}
