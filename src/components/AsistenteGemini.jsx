import { useState, useRef, useEffect } from "react";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { supabase } from "../supabase";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Send, Sparkles, Zap, AlertTriangle } from "lucide-react";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

export default function AsistenteGemini({ usuarioActual, monedaGlobal, datosHogar }) {
  const [mensajes, setMensajes] = useState([
    { role: "asistente", text: `¡Haku la polenta, ${usuarioActual?.nombre || "kapé"}! 🔥 Soy tu asistente financiero. ¿En qué te puedo ayudar hoy?` }
  ]);
  const [input, setInput] = useState("");
  const [cargando, setCargando] = useState(false);
  const [datosTokens, setDatosTokens] = useState({ disponibles: 10000 });
  const [contextoModo, setContextoModo] = useState("Mes Actual");
  const scrollRef = useRef(null);

  const sinTokens = datosTokens.disponibles <= 0;

  useEffect(() => {
    async function sincronizarTokens() {
      if (!datosHogar?.espacio_id) return;
      
      const { data } = await supabase
        .from("espacios")
        .select("tokens_ia_disponibles")
        .eq("id", datosHogar.espacio_id)
        .single();

      if (data) {
        setDatosTokens({ disponibles: data.tokens_ia_disponibles });
      }
    }
    sincronizarTokens();
  }, [datosHogar]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [mensajes]);

  async function enviarMensaje() {
    if (!input.trim() || cargando || sinTokens) return;
    if (!API_KEY) {
      setMensajes(prev => [...prev, 
        { role: "usuario", text: input },
        { role: "asistente", text: "⚠️ No se encontró la API Key de Gemini." }
      ]);
      setInput("");
      return;
    }

    const nuevoMensajeUsuario = { role: "usuario", text: input };
    setMensajes(prev => [...prev, nuevoMensajeUsuario]);
    setInput("");
    setCargando(true);

    try {
      const genAI = new GoogleGenerativeAI(API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-pro" });

      const promptSistema = `
        Eres el Asistente Financiero Oficial de 'ÑandeFinanza 2.0', una aplicación creada en Paraguay. 
        Tu rol es actuar como un 'kape' (amigo cercano) experto en finanzas que ayuda a las parejas y solteros a administrar su dinero.
        
        REGLAS DE TU PERSONALIDAD:
        1. Tu tono es empático, profesional pero muy amigable. Nunca juzgas.
        2. Usas 'Jopara' (mezcla natural de español paraguayo y guaraní). 
        3. Ejemplos de palabras que puedes usar: 'che kape', 'hendy', 'tranquilo', 'iporã', 'macanada', 'ñande plata heta'.
        4. No exageres, úsalo con naturalidad como lo haría un joven profesional paraguayo.
        5. Cuando des consejos para ahorrar o analices los gastos, prioriza la paz mental de la relación o del usuario.
        
        CONTEXTO:
        - Hogar: ${datosHogar?.espacios?.nombre_familia}
        - Usuario: ${usuarioActual?.nombre}
        - Moneda: ${monedaGlobal}
      `;

      const result = await model.generateContent([promptSistema, ...mensajes.map(m => `${m.role === "asistente" ? "Asistente" : "Usuario"}: ${m.text}`), `Usuario: ${input}`]);
      const response = await result.response;
      const text = response.text();

      setMensajes(prev => [...prev, { role: "asistente", text }]);
      
      const costo = 500;
      const nuevoDisponible = Math.max(0, datosTokens.disponibles - costo);
      await supabase.from("espacios").update({ tokens_ia_disponibles: nuevoDisponible }).eq("id", datosHogar.espacio_id);
      setDatosTokens({ disponibles: nuevoDisponible });
    } catch (err) {
      console.error("Error en enviarMensaje:", err);
      setMensajes(prev => [...prev, { role: "asistente", text: "Error de conexión con el cerebro IA. 🧠💥" }]);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-180px)] max-w-2xl mx-auto">
      {/* Header Asistente */}
      <div className="glass-card mb-4 p-4 border-l-4 border-l-indigo-500 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600/20 rounded-xl flex items-center justify-center text-indigo-400">
            <Bot size={24} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white leading-none">ÑandeAsistente</h2>
            <div className="flex items-center gap-1 mt-1">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">En línea</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select 
            className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-[10px] font-bold text-slate-400 outline-none focus:border-indigo-500/50"
            value={contextoModo}
            onChange={(e) => setContextoModo(e.target.value)}
          >
            <option value="Mes Actual">Mes Actual</option>
            <option value="Historial Completo">Historial</option>
          </select>
        </div>
      </div>

      {/* Barra de Tokens */}
      <div className="flex gap-2 mb-4">
        <div className="flex-1 bg-white/5 border border-white/10 rounded-xl p-2 px-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap size={14} className="text-amber-400" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Energía Mágica</span>
          </div>
          <span className="text-xs font-black text-white">{datosTokens.disponibles.toLocaleString("es-PY")}</span>
        </div>
        <div className="w-1/3 bg-white/5 border border-white/10 rounded-xl p-2 px-3 flex items-center justify-center gap-2">
          <Sparkles size={14} className="text-indigo-400" />
          <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest italic">PREMIUM</span>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar mb-4" ref={scrollRef}>
        <AnimatePresence>
          {mensajes.map((m, index) => (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              key={index}
              className={`flex ${m.role === "usuario" ? "justify-end" : "justify-start"}`}
            >
              <div className={`max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed shadow-lg ${
                m.role === "usuario" 
                  ? "bg-indigo-600 text-white rounded-br-none" 
                  : "glass-panel text-slate-200 rounded-bl-none border-l-2 border-l-indigo-500/50"
              }`}>
                {m.text}
              </div>
            </motion.div>
          ))}
          {cargando && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
              <div className="glass-panel p-4 rounded-2xl rounded-bl-none border-l-2 border-l-indigo-500/50">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></span>
                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Error/Warning Banner */}
      {sinTokens && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3"
        >
          <AlertTriangle className="text-red-400 shrink-0" size={18} />
          <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider">Has agotado tus consultas mágicas. Pásate a Premium para seguir. 💸</p>
        </motion.div>
      )}

      {/* Input Area */}
      <div className="glass-panel p-2 rounded-2xl flex items-center gap-2 border-white/20 focus-within:border-indigo-500/50 transition-all">
        <input
          type="text"
          placeholder={sinTokens ? "Límite de tokens alcanzado 🔒" : "Preguntame lo que quieras..."}
          className="flex-1 bg-transparent border-none outline-none px-4 py-2 text-white text-sm placeholder:text-slate-600 disabled:cursor-not-allowed"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && enviarMensaje()}
          disabled={sinTokens || cargando}
        />
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={enviarMensaje}
          disabled={sinTokens || cargando || !input.trim()}
          className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center disabled:opacity-30 disabled:grayscale transition-all shadow-lg shadow-indigo-600/20"
        >
          <Send size={18} />
        </motion.button>
      </div>
    </div>
  );
}
