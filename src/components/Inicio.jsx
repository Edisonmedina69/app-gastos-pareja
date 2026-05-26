import { useState } from "react";
import { supabase } from "../supabase";
import { toast } from "react-hot-toast";
import { formatearNumero } from "../utils/formatters";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Plus, Wallet, TrendingUp, AlertTriangle, Users, 
  Sparkles, CreditCard, HeartPulse, Activity, User
} from "lucide-react";
import IngresoMagico from "./IngresoMagico";

export default function Inicio({
  usuarioActual,
  otroUsuario,
  usuarios,
  gastos,
  ingresos,
  deudas,
  monedaGlobal,
  setMonedaGlobal,
  obtenerDatos,
  datosHogar,
  modoVista,
  saludFinanciera
}) {
  const [mostrarMagico, setMostrarMagico] = useState(false);

  // Lógica Semáforo (HU-10)
  const getColorSalud = () => {
    if (saludFinanciera.indice <= 30) return "text-emerald-400";
    if (saludFinanciera.indice <= 40) return "text-amber-400";
    return "text-red-400";
  };

  const proximosVencimientos = deudas?.flatMap(d => 
    d.cuotas_detalle?.filter(c => {
      if (c.estado === 'pagado') return false;
      const h = new Date(); const v = new Date(c.fecha_vencimiento);
      const diff = Math.ceil((v - h) / (1000 * 60 * 60 * 24));
      return diff >= 0 && diff <= 7;
    }).map(c => ({ ...c, titulo: d.titulo, moneda: d.moneda }))
  ).sort((a,b) => new Date(a.fecha_vencimiento) - new Date(b.fecha_vencimiento)) || [];

  // HU-13: Confirmar Gasto Mágico (Ticket o Voz)
  async function confirmarGastoMagico(datos) {
    if (!usuarioActual || !datosHogar) return;
    const toastId = toast.loading("Registrando gasto inteligente...");

    try {
      const { error } = await supabase.from("gastos").insert([
        {
          ...datos,
          usuario_id: usuarioActual.id,
          pagador_id: usuarioActual.id,
          para_quien: "Ambos",
          espacio_id: datosHogar.espacio_id,
          tasa_cambio: 1 
        },
      ]);

      if (error) throw error;
      toast.success("¡Gasto guardado con éxito! ✨", { id: toastId });
      obtenerDatos();
    } catch (err) {
      toast.error("Error al guardar: " + err.message, { id: toastId });
    }
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Selector Moneda */}
      <div className="flex justify-center">
        <div className="inline-flex p-1 bg-white/5 border border-white/10 rounded-full backdrop-blur-md">
          {[{id:"PYG", f:"🇵🇾"}, {id:"BRL", f:"🇧🇷"}].map(m => (
            <button key={m.id} onClick={() => setMonedaGlobal(m.id)} className={`px-4 py-1.5 rounded-full text-xs font-black transition-all ${monedaGlobal===m.id?'bg-indigo-600 text-white shadow-lg':'text-slate-400'}`}><span>{m.f}</span> {m.id}</button>
          ))}
        </div>
      </div>

      {/* DASHBOARD PRINCIPAL */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* SALUD FINANCIERA (HU-10) */}
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-card flex items-center gap-4 relative overflow-hidden">
          <div className={`w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center ${getColorSalud()}`}>
            <Activity size={32} />
          </div>
          <div>
            <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Salud Financiera</div>
            <div className={`text-2xl font-black ${getColorSalud()}`}>{saludFinanciera.indice.toFixed(1)}%</div>
            <p className="text-[9px] text-slate-400 font-bold uppercase">{saludFinanciera.indice <= 35 ? '¡Excelente control!' : 'Cuidado con las cuotas.'}</p>
          </div>
          <div className="absolute top-0 right-0 p-2 opacity-10"><HeartPulse size={48} /></div>
        </motion.div>

        {/* SALDOS (Mixto Individual y Familiar) */}
        <div className="grid grid-cols-2 gap-3">
          <div className="glass-card p-4 border-l-4 border-l-emerald-500">
             <div className="flex items-center gap-1.5 text-slate-500 mb-1"><User size={12}/><span className="text-[9px] font-black uppercase">Mi Saldo</span></div>
             <div className="text-lg font-black text-white">{formatearNumero(saludFinanciera.ingresos - saludFinanciera.carga, monedaGlobal)}</div>
          </div>
          <div className="glass-card p-4 border-l-4 border-l-indigo-500">
             <div className="flex items-center gap-1.5 text-slate-500 mb-1"><Users size={12}/><span className="text-[9px] font-black uppercase">Saldo Familiar</span></div>
             <div className="text-lg font-black text-indigo-400">{formatearNumero(saludFinanciera.balanceHogar, monedaGlobal)}</div>
          </div>
        </div>
      </div>

      {/* ALERTAS VENCIMIENTO */}
      <AnimatePresence>
        {proximosVencimientos.length > 0 && (
          <motion.section initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="glass-card border-l-4 border-l-amber-500">
            <h3 className="text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-2 mb-4"><AlertTriangle size={16} className="text-amber-500" /> Vencimientos Críticos</h3>
            <div className="space-y-2">
              {proximosVencimientos.map(v => (
                <div key={v.id} className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5 group hover:bg-white/10 transition-all">
                  <div>
                    <div className="text-xs font-bold text-white group-hover:text-amber-400 transition-colors">{v.titulo}</div>
                    <div className="text-[9px] text-slate-500 font-bold uppercase">Cuota {v.numero_cuota}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-black text-white">{formatearNumero(v.monto_cuota - v.monto_abonado, v.moneda)}</div>
                    <div className="text-[8px] text-amber-500 font-black uppercase tracking-tighter">Vence en {Math.ceil((new Date(v.fecha_vencimiento)-new Date())/(1000*60*60*24))} días</div>
                  </div>
                </div>
              ))}
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* GASTO INTELIGENTE (BOTÓN RÁPIDO) */}
      <div className="grid grid-cols-1 gap-4">
         <button 
           onClick={() => setMostrarMagico(true)} 
           className="glass-card flex items-center justify-center gap-3 py-8 border-2 border-dashed border-indigo-500/30 hover:bg-indigo-600/5 hover:border-indigo-500 transition-all active:scale-95 group"
         >
            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-600/20 group-hover:animate-bounce">
              <Sparkles size={24} />
            </div>
            <div className="text-left">
              <span className="block text-sm font-black text-white uppercase tracking-tight">Gasto Inteligente</span>
              <span className="block text-[9px] text-slate-500 font-bold uppercase tracking-widest">Voz o Foto de Ticket</span>
            </div>
         </button>
      </div>

      <AnimatePresence>
        {mostrarMagico && (
          <IngresoMagico 
            isOpen={mostrarMagico} 
            onClose={() => setMostrarMagico(false)} 
            onConfirm={confirmarGastoMagico} 
            monedaGlobal={monedaGlobal}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
