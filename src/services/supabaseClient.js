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

const cliente = createClient(supabaseUrl, supabaseKey, {
  global: { headers: { "x-app-version": "2" } },
});
let espacioEsperado = null;
let generacion = 0;

/** Solo memoria: el servidor siempre vuelve a validar sesión y membresía. */
export function establecerContextoEspacio(id) {
  espacioEsperado = id;
  generacion += 1;
}
export const capturarContextoEspacio = () => {
  const actual = generacion;
  return () => actual === generacion;
};

// PostgrestQueryBuilder expone headers; cada from() crea su propia copia.
// Capturar al construir la consulta evita reutilizar el contexto tras un await.
export const supabase = new Proxy(cliente, {
  get(target, propiedad) {
    if (propiedad === "from") return (...args) => {
      const consulta = target.from(...args);
      if (espacioEsperado) consulta.headers.set("x-espacio-id-esperado", espacioEsperado);
      return consulta;
    };
    const valor = Reflect.get(target, propiedad);
    return typeof valor === "function" ? valor.bind(target) : valor;
  },
});

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
