import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, LogOut, Shield } from "lucide-react";
import { cerrarSesion } from "../../services/auth.service";
import { confirmarCierreGlobal } from "../../features/auth/lib/confirmarCierreGlobal";

/** Cabecera fija del celular: nombre del hogar y menú de perfil. */
export default function HeaderMovil({ datosHogar, usuarioActual }) {
  const [mostrarMenuPerfilMovil, setMostrarMenuPerfilMovil] = useState(false);

  return (
    <header className="flex lg:hidden justify-between items-center px-6 py-4 border-b border-white/5 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40 w-full">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-600/20 flex-shrink-0">
          <span className="text-sm font-black text-white">Ñ</span>
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-xs font-black tracking-tight text-white truncate max-w-[150px]">
            {datosHogar?.nombre_familia || "ÑandeFinanza"}
          </span>
          {datosHogar?.nombre_familia && <span className="text-xs text-indigo-400 font-bold uppercase tracking-wider">Hogar Activo</span>}
        </div>
      </div>

      <div className="relative">
        <button
          onClick={() => setMostrarMenuPerfilMovil(!mostrarMenuPerfilMovil)}
          className="flex items-center gap-1.5 focus:outline-none p-1 hover:bg-white/5 rounded-full transition-all"
          aria-label="Menú de perfil"
        >
          <div className="w-9 h-9 bg-slate-800 rounded-full flex items-center justify-center text-xs font-bold text-indigo-400 border border-indigo-500/30 shadow-inner">
            {usuarioActual?.nombre?.charAt(0) || <User size={16} />}
          </div>
        </button>

        <AnimatePresence>
          {mostrarMenuPerfilMovil && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMostrarMenuPerfilMovil(false)} />
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute right-0 mt-2 z-50 w-64 bg-slate-900/95 border border-white/10 rounded-2xl p-4 shadow-2xl backdrop-blur-md flex flex-col gap-3"
              >
                <div className="pb-3 border-b border-white/5 px-1">
                  <div className="text-xs font-black text-white leading-none">{usuarioActual?.nombre || "Usuario"}</div>
                  <div className="text-xs text-slate-400 font-bold uppercase mt-1 tracking-tighter">
                    {datosHogar?.nombre_familia || "Mi Hogar"} • {datosHogar?.rol || "miembro"}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setMostrarMenuPerfilMovil(false);
                    cerrarSesion();
                  }}
                  className="w-full flex items-center justify-start gap-3 py-3 px-4 rounded-xl text-sm font-black text-red-400 bg-red-500/5 hover:bg-red-500/10 active:scale-95 transition-all border border-red-500/10"
                >
                  <LogOut size={16} /> Cerrar Sesión
                </button>
                <button
                  onClick={() => {
                    setMostrarMenuPerfilMovil(false);
                    confirmarCierreGlobal("Sesiones cerradas");
                  }}
                  className="w-full flex items-center justify-start gap-2.5 py-2 px-3 text-xs font-bold text-slate-400 hover:text-slate-300 transition-colors border-t border-white/5 pt-3 mt-1"
                >
                  <Shield size={14} className="text-slate-400" /> Cerrar en todos los dispositivos
                </button>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}
