import { useState, useEffect } from "react";
import { supabase } from "../supabase";
import { toast } from "react-hot-toast";
import { formatearNumero } from "../utils/formatters";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Plus, Wallet, TrendingUp, AlertTriangle, Users, 
  Sparkles, CreditCard, HeartPulse, Activity
} from "lucide-react";
import IngresoMagico from "./IngresoMagico";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

export default function Inicio({
  usuarioActual, otroUsuario, usuarios, gastos, ingresos, deudas,
  monedaGlobal, setMonedaGlobal, obtenerDatos, datosHogar, modoVista,
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

  return (
    <div className="space-y-6 pb-20">
      {/* Selector Moneda */}
      <div className="flex justify-center">
        <div className="inline-flex p-1 bg-white/5 border border-white/10 rounded-full">
          {[{id:"PYG", f:"🇵🇾"}, {id:"BRL", f:"🇧🇷"}].map(m => (
            <button key={m.id} onClick={() => setMonedaGlobal(m.id)} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${monedaGlobal===m.id?'bg-indigo-600 text-white':'text-slate-400'}`}><span>{m.f}</span> {m.id}</button>
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
            <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Índice Endeudamiento</div>
            <div className={`text-2xl font-black ${getColorSalud()}`}>{saludFinanciera.indice.toFixed(1)}%</div>
            <p className="text-[9px] text-slate-400 font-bold">{saludFinanciera.indice <= 35 ? '¡Saludable! Tenés margen.' : '¡Ojo! Tus deudas pesan mucho.'}</p>
          </div>
          <div className="absolute top-0 right-0 p-2 opacity-10"><HeartPulse size={48} /></div>
        </motion.div>

        {/* SALDO HOGAR */}
        <div className="glass-card">
           <div className="flex items-center gap-2 text-slate-400 mb-1"><Wallet size={14}/><span className="text-[10px] font-black uppercase">Saldo Disponible</span></div>
           <div className="text-3xl font-black text-indigo-400">{formatearNumero(saludFinanciera.ingresos - saludFinanciera.carga, monedaGlobal)}</div>
        </div>
      </div>

      {/* ALERTAS VENCIMIENTO */}
      <AnimatePresence>
        {proximosVencimientos.length > 0 && (
          <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card border-l-4 border-l-amber-500">
            <h3 className="text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-2 mb-4"><AlertTriangle size={16} className="text-amber-500" /> Próximos Pagos</h3>
            <div className="space-y-2">
              {proximosVencimientos.map(v => (
                <div key={v.id} className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5">
                  <div><div className="text-xs font-bold text-white">{v.titulo}</div><div className="text-[9px] text-slate-500">Vence en {Math.ceil((new Date(v.fecha_vencimiento)-new Date())/(1000*60*60*24))} días</div></div>
                  <div className="text-right"><div className="text-sm font-black text-white">{formatearNumero(v.monto_cuota, v.moneda)}</div></div>
                </div>
              ))}
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
         <button onClick={() => setMostrarMagico(true)} className="glass-card flex items-center justify-center gap-2 py-6 border-2 border-dashed border-indigo-500/30 hover:bg-indigo-500/5 transition-all">
            <Sparkles className="text-indigo-400" />
            <span className="text-sm font-black text-white uppercase">Gasto Inteligente</span>
         </button>
      </div>

      <AnimatePresence>{mostrarMagico && <IngresoMagico onClose={() => setMostrarMagico(false)} onConfirm={obtenerDatos} />}</AnimatePresence>
    </div>
  );
}
