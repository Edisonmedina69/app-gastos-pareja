import { Shield, LogOut } from "lucide-react";
import { cerrarSesion } from "../../../services/auth.service";
import { Button } from "../../../shared/ui";

/** Pantalla para usuarios autenticados que todavía no pertenecen a un hogar. */
export default function AccesoRestringido() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[500px] h-[500px] bg-red-600/10 rounded-full blur-[120px]" />
      </div>
      <div className="w-full max-w-md z-10 glass-card border-white/10 p-8 text-center space-y-6">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-red-500/10 text-red-500 rounded-full shadow-lg mb-2">
          <Shield size={32} />
        </div>
        <h2 className="text-xl font-bold text-white uppercase tracking-tight">Acceso Restringido</h2>
        <p className="text-slate-400 text-sm leading-relaxed">
          Tu usuario no está asociado a ningún Hogar activo en el sistema.
        </p>
        <p className="text-slate-500 text-xs leading-relaxed">
          Por favor, contactá al Administrador para que vincule tu cuenta a un Hogar o verifique tu registro.
        </p>
        <Button variante="secondary" tamano="lg" onClick={() => cerrarSesion()} className="w-full text-destructive border-destructive/20 hover:text-destructive">
          <LogOut size={16} aria-hidden="true" /> Cerrar Sesión / Volver
        </Button>
      </div>
    </div>
  );
}
