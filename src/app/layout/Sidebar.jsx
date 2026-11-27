import { LogOut } from "lucide-react";
import { cerrarSesion } from "../../services/auth.service";
import { confirmarCierreGlobal } from "../../features/auth/lib/confirmarCierreGlobal";
import { obtenerSecciones } from "../navegacion";

/** Barra lateral de escritorio (≥ lg). */
export default function Sidebar({ datosHogar, usuarioActual, activeTab, setActiveTab, esSuperadmin }) {
  return (
    <aside className="hidden lg:flex flex-col w-64 p-6 border-r border-white/5 space-y-8">
      <div className="flex items-center gap-3 px-2">
        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/20 flex-shrink-0"><span className="text-xl font-black text-white">Ñ</span></div>
        <div className="flex flex-col min-w-0">
          <h1 className="text-sm font-black tracking-tight text-white truncate" title={datosHogar?.nombre_familia || "ÑandeFinanza"}>
            {datosHogar?.nombre_familia || "ÑandeFinanza"}
          </h1>
          {datosHogar?.nombre_familia && <span className="text-[9px] text-indigo-400 font-black uppercase tracking-widest mt-0.5">Hogar Activo</span>}
        </div>
      </div>
      <nav className="flex-1 space-y-2">
        {obtenerSecciones(esSuperadmin).map((link) => (
          <button key={link.id} onClick={() => setActiveTab(link.id)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${activeTab === link.id ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"}`}>
            <link.icon size={20} /> {link.label}
          </button>
        ))}
      </nav>
      <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center text-[10px] font-bold">{usuarioActual?.nombre?.charAt(0)}</div>
          <div>
            <div className="text-xs font-bold text-white leading-none">{usuarioActual?.nombre}</div>
            <div className="text-[10px] text-slate-500 font-bold uppercase mt-1 tracking-tighter">{datosHogar.rol}</div>
          </div>
        </div>
        <button onClick={() => cerrarSesion()} className="w-full flex items-center justify-center gap-2 py-2 text-[10px] font-black text-slate-500 hover:text-red-400 transition-colors uppercase tracking-widest"><LogOut size={14} /> Cerrar Sesión</button>
        <button
          onClick={() => confirmarCierreGlobal("Sesiones cerradas en todos los dispositivos")}
          className="w-full flex items-center justify-center gap-2 py-1.5 text-[8px] font-bold text-slate-600 hover:text-red-400 transition-colors uppercase tracking-widest mt-1 border-t border-white/5 pt-1.5"
        >
          Cerrar en todos los dispositivos
        </button>
      </div>
    </aside>
  );
}
