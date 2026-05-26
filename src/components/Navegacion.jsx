import { useState } from "react";
import { Home, CreditCard, PlusCircle, History, Bot, Shield, Bell, Check, X as CloseIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function Navegacion({ activeTab, setActiveTab, esSuperadmin, notificaciones = [], markAsRead, responderSolicitud }) {
  const [mostrarNotis, setMostrarNotis] = useState(false);
  
  const tabs = [
    { id: "inicio", icon: Home, label: "Inicio" },
    { id: "cuentas", icon: CreditCard, label: "Deudas" },
    { id: "ingresos", icon: PlusCircle, label: "Ingresos" },
    { id: "historial", icon: History, label: "Historial" },
    { id: "asistente", icon: Bot, label: "IA" },
  ];

  if (esSuperadmin) tabs.push({ id: "admin", icon: Shield, label: "Admin" });

  const noLeidas = notificaciones.filter(n => !n.leida).length;

  return (
    <div className="flex items-center gap-1 p-1.5 glass-panel rounded-2xl border-white/10 shadow-2xl relative">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button key={tab.id} onClick={() => { setActiveTab(tab.id); setMostrarNotis(false); }} className={`relative flex flex-col items-center justify-center py-2 px-3 rounded-xl transition-all duration-300 ${isActive ? "text-indigo-400 bg-indigo-500/10" : "text-slate-400 hover:bg-white/5"}`}>
            <Icon className={`w-5 h-5 mb-1 ${isActive ? "animate-pulse" : ""}`} />
            <span className="text-[10px] font-medium tracking-wide uppercase">{tab.label}</span>
            {isActive && <div className="absolute -bottom-0.5 w-1 h-1 bg-indigo-400 rounded-full shadow-[0_0_8px_rgba(129,140,248,0.8)]" />}
          </button>
        );
      })}

      <button onClick={() => { setMostrarNotis(!mostrarNotis); if (!mostrarNotis && noLeidas > 0) markAsRead(); }} className={`relative flex flex-col items-center justify-center py-2 px-3 rounded-xl transition-all ${mostrarNotis ? "text-amber-400 bg-amber-500/10" : "text-slate-400"}`}>
        <div className="relative">
          <Bell className="w-5 h-5 mb-1" />
          {noLeidas > 0 && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 border-2 border-slate-900 rounded-full animate-bounce" />}
        </div>
        <span className="text-[10px] font-medium uppercase">Alertas</span>
      </button>

      <AnimatePresence>
        {mostrarNotis && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute bottom-20 right-0 w-72 max-h-96 glass-panel rounded-3xl border border-white/10 shadow-2xl p-4 overflow-y-auto z-[100]">
            <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-2">
              <h4 className="text-xs font-black text-white uppercase tracking-widest">Notificaciones</h4>
              <span className="text-[10px] text-slate-500 font-bold">{notificaciones.length} total</span>
            </div>
            
            <div className="space-y-2">
              {notificaciones.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-[10px] font-bold uppercase italic">No hay alertas</div>
              ) : (
                notificaciones.map((n) => (
                  <div key={n.id} className={`p-3 rounded-xl border ${n.tipo === 'alerta' ? 'bg-amber-500/5 border-amber-500/10' : 'bg-white/5 border-white/5'}`}>
                    <div className="text-[10px] font-black text-white mb-1">{n.titulo}</div>
                    <p className="text-[10px] text-slate-400 leading-relaxed mb-2">{n.mensaje}</p>
                    
                    {/* HU-07: Botones para solicitudes de ayuda */}
                    {n.metadata?.tipo === 'solicitud_ayuda' && (
                      <div className="flex gap-2 mt-3">
                        <button onClick={() => responderSolicitud(n, true)} className="flex-1 py-1.5 bg-indigo-600 text-white text-[9px] font-black rounded-lg flex items-center justify-center gap-1"><Check size={12}/> ACEPTAR</button>
                        <button onClick={() => responderSolicitud(n, false)} className="flex-1 py-1.5 bg-white/5 text-slate-400 text-[9px] font-black rounded-lg flex items-center justify-center gap-1"><CloseIcon size={12}/> RECHAZAR</button>
                      </div>
                    )}
                    <div className="text-[8px] text-slate-600 font-bold mt-2 uppercase">{new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
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
