import { useState } from "react";
import { Home, CreditCard, PlusCircle, History, Bot, Shield, Bell, Check, X as CloseIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function Navegacion({ activeTab, setActiveTab, esSuperadmin, notificaciones = [], markAsRead, responderSolicitud }) {
  const [mostrarNotis, setMostrarNotis] = useState(false);
  
  const tabs = [
    { id: "inicio", icon: Home, label: "Inicio" },
    { id: "cuentas", icon: CreditCard, label: "Deudas" },
    { id: "ingresos", icon: PlusCircle, label: "Ingresos" },
    { id: "historial", icon: History, label: "Libro" },
    { id: "asistente", icon: Bot, label: "IA" },
  ];

  if (esSuperadmin) tabs.push({ id: "admin", icon: Shield, label: "Admin" });

  const noLeidas = notificaciones.filter(n => !n.leida).length;

  return (
    <div className="flex items-center justify-between gap-0.5 p-1 glass-panel rounded-2xl border-white/10 shadow-2xl relative w-[95vw] max-w-md mx-auto">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button 
            key={tab.id} 
            onClick={() => { setActiveTab(tab.id); setMostrarNotis(false); }} 
            className={`relative flex flex-col items-center justify-center flex-1 py-2 px-1 rounded-xl transition-all duration-300 ${isActive ? "text-indigo-400 bg-indigo-500/10" : "text-slate-400"}`}
          >
            <Icon className={`w-5 h-5 mb-1 ${isActive ? "animate-pulse" : ""}`} />
            <span className="text-[9px] font-black tracking-tighter uppercase">{tab.label}</span>
            {isActive && <div className="absolute -bottom-0.5 w-1 h-1 bg-indigo-400 rounded-full shadow-[0_0_8px_rgba(129,140,248,0.8)]" />}
          </button>
        );
      })}

      <button 
        onClick={() => { setMostrarNotis(!mostrarNotis); if (!mostrarNotis && noLeidas > 0) markAsRead(); }} 
        className={`relative flex flex-col items-center justify-center flex-1 py-2 px-1 rounded-xl transition-all ${mostrarNotis ? "text-amber-400 bg-amber-500/10" : "text-slate-400"}`}
      >
        <div className="relative">
          <Bell className="w-5 h-5 mb-1" />
          {noLeidas > 0 && <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 border border-slate-900 rounded-full animate-bounce" />}
        </div>
        <span className="text-[9px] font-black tracking-tighter uppercase">SOS</span>
      </button>

      <AnimatePresence>
        {mostrarNotis && (
          <motion.div 
            initial={{ opacity: 0, y: 10, scale: 0.95 }} 
            animate={{ opacity: 1, y: 0, scale: 1 }} 
            exit={{ opacity: 0, y: 10, scale: 0.95 }} 
            className="absolute bottom-20 right-0 left-0 w-full max-h-[70vh] glass-panel rounded-3xl border border-white/10 shadow-2xl p-4 overflow-y-auto z-[100]"
          >
            <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-2">
              <h4 className="text-[10px] font-black text-white uppercase tracking-widest">Notificaciones</h4>
              <span className="text-[9px] text-slate-500 font-bold">{notificaciones.length} total</span>
            </div>
            
            <div className="space-y-2">
              {notificaciones.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-[10px] font-black uppercase italic">No hay alertas nuevas</div>
              ) : (
                notificaciones.map((n) => (
                  <div key={n.id} className={`p-3 rounded-xl border ${n.tipo === 'alerta' ? 'bg-amber-500/5 border-amber-500/10' : 'bg-white/5 border-white/5'}`}>
                    <div className="text-[10px] font-black text-white mb-1">{n.titulo}</div>
                    <p className="text-[10px] text-slate-400 leading-tight mb-2">{n.mensaje}</p>
                    {n.metadata?.tipo === 'solicitud_ayuda' && (
                      <div className="flex gap-2 mt-3">
                        <button onClick={() => responderSolicitud(n, true)} className="flex-1 py-2 bg-indigo-600 text-white text-[9px] font-black rounded-lg">ACEPTAR</button>
                        <button onClick={() => responderSolicitud(n, false)} className="flex-1 py-2 bg-white/5 text-slate-400 text-[9px] font-black rounded-lg">RECHAZAR</button>
                      </div>
                    )}
                    <div className="text-[8px] text-slate-600 font-bold mt-2 uppercase">{new Date(n.created_at).toLocaleTimeString()}</div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
