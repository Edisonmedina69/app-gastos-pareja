import { useState, useRef, useEffect } from "react";
import { supabase } from "../supabase";
import { toast } from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Send, Sparkles, Zap, AlertTriangle, HeartPulse } from "lucide-react";

export default function AsistenteGemini({ usuarioActual, gastos, ingresos, monedaGlobal, datosHogar, saludFinanciera }) {
  const [mensajes, setMensajes] = useState([
    { role: "asistente", text: `¡Haku la polenta, ${usuarioActual?.nombre || "kapé"}! 🔥 Soy tu asistente. ¿Cómo viene la mano hoy?` }
  ]);
  const [input, setInput] = useState("");
  const [cargando, setCargando] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [mensajes]);

  async function enviarMensaje() {
    if (!input.trim() || cargando) return;
    const msg = input; setInput("");
    setMensajes(prev => [...prev, { role: "usuario", text: msg }]);
    setCargando(true);

    try {
      // HU-09: Inyectar métricas de Salud Financiera en el contexto
      const contexto = {
        ingresos: ingresos || [],
        gastos: gastos || [],
        moneda: monedaGlobal || 'PYG',
        salud: {
          indice_endeudamiento: saludFinanciera.indice,
          carga_mensual: saludFinanciera.carga,
          ingresos_mensuales: saludFinanciera.ingresos,
          estado: saludFinanciera.indice > 40 ? 'Crítico' : (saludFinanciera.indice > 30 ? 'Precaución' : 'Saludable')
        }
      };

      const { data, error } = await supabase.functions.invoke('chat-ia', {
        body: { mensaje: msg, contexto_financiero: contexto }
      });

      if (error) throw error;
      setMensajes(prev => [...prev, { role: "asistente", text: data.respuesta }]);
    } catch (err) {
      toast.error("Hendy la conexión...");
      setMensajes(prev => [...prev, { role: "asistente", text: "Haupei, me dio un calambre en el procesador. Intentá de nuevo." }]);
    } finally { setCargando(false); }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-180px)] max-w-2xl mx-auto">
      <div className="glass-card mb-4 p-4 border-l-4 border-l-indigo-500 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600/20 rounded-xl flex items-center justify-center text-indigo-400"><Bot size={24} /></div>
          <div>
            <h2 className="text-sm font-bold text-white leading-none">ÑandeAsistente</h2>
            <div className="flex items-center gap-1 mt-1"><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span><span className="text-[10px] text-slate-500 font-bold uppercase">En línea</span></div>
          </div>
        </div>
        {/* Widget Salud en Chat */}
        <div className="text-right">
          <div className={`text-xs font-black ${saludFinanciera.indice > 40 ? 'text-red-400' : 'text-emerald-400'}`}>{saludFinanciera.indice.toFixed(0)}% Endeudado</div>
          <div className="text-[8px] text-slate-500 uppercase font-bold">Salud Financiera</div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2 custom-scrollbar">
        {mensajes.map((m, i) => (
          <motion.div key={i} initial={{ opacity: 0, x: m.role === 'usuario' ? 10 : -10 }} animate={{ opacity: 1, x: 0 }} className={`flex ${m.role === 'usuario' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed ${m.role === 'usuario' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white/5 text-slate-200 border border-white/10 rounded-tl-none'}`}>
              {m.text}
            </div>
          </motion.div>
        ))}
        {cargando && <div className="flex justify-start"><div className="bg-white/5 p-4 rounded-2xl animate-pulse text-indigo-400"><Zap size={18} className="animate-bounce" /></div></div>}
      </div>

      <div className="relative">
        <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && enviarMensaje()} placeholder="Preguntame lo que quieras, kape..." className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-5 pr-14 text-white outline-none focus:border-indigo-500 transition-all placeholder:text-slate-600" />
        <button onClick={enviarMensaje} className="absolute right-2 top-2 w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center hover:bg-indigo-500 transition-all"><Send size={18} /></button>
      </div>
    </div>
  );
}
