import { useState } from "react";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { toast } from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, Camera, Loader2, Wand2 } from "lucide-react";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

export default function IngresoMagico({ isOpen, onClose, onConfirm, monedaGlobal }) {
  const [input, setInput] = useState("");
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState(null);

  async function procesarEntrada() {
    if (!input.trim() || cargando) return;
    if (!API_KEY) return toast.error("Configurá la API Key de Gemini");

    setCargando(true);
    const toastId = toast.loading("La IA está analizando tu gasto...");

    try {
      const genAI = new GoogleGenerativeAI(API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const prompt = `
        Sos un asistente experto en finanzas paraguayas. Analizá el siguiente texto o descripción de un gasto y extraé los datos en formato JSON.
        
        REGLAS:
        1. Si el monto dice "150mil" o "150k", convertilo a número: 150000.
        2. La categoría debe ser una de estas: Casa, Supermercado, Combustible, Salidas, Salud, Ahorro, Otros.
        3. Si no se especifica moneda, asumí que es "${monedaGlobal}".
        4. Retorná ÚNICAMENTE un objeto JSON con esta estructura: 
           {"concepto": string, "monto": number, "categoria": string, "moneda": string}
        
        TEXTO DEL USUARIO: "${input}"
      `;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      // Limpiar el texto por si Gemini agrega markdown ```json
      const jsonMatch = text.match(/\{.*\}/s);
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0]);
        setResultado(data);
        toast.success("¡Gasto interpretado con éxito! ✨", { id: toastId });
      } else {
        throw new Error("No pude interpretar el gasto. Intentá ser más específico.");
      }
    } catch (err) {
      toast.error(err.message, { id: toastId });
    } finally {
      setCargando(false);
    }
  }

  async function manejarFoto(e) {
    const file = e.target.files[0];
    if (!file) return;

    setCargando(true);
    const toastId = toast.loading("Leyendo el ticket con IA...");

    try {
      const genAI = new GoogleGenerativeAI(API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      // Convertir archivo a base64 para Gemini
      const reader = new FileReader();
      const base64Promise = new Promise((resolve) => {
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(file);
      });
      const base64Data = await base64Promise;

      const prompt = `
        Analizá esta foto de un ticket o recibo. Extraé el total pagado y el concepto principal.
        Retorná ÚNICAMENTE un objeto JSON: 
        {"concepto": string, "monto": number, "categoria": string, "moneda": string}
        
        Categorías válidas: Casa, Supermercado, Combustible, Salidas, Salud, Ahorro, Otros.
        Si la moneda es Gs o Guaraníes, usá "PYG". Si es R$ o Reales, usá "BRL".
      `;

      const result = await model.generateContent([
        prompt,
        { inlineData: { data: base64Data, mimeType: file.type } }
      ]);
      
      const response = await result.response;
      const text = response.text();
      const jsonMatch = text.match(/\{.*\}/s);
      
      if (jsonMatch) {
        setResultado(JSON.parse(jsonMatch[0]));
        toast.success("¡Ticket procesado! Revisa los datos.", { id: toastId });
      } else {
        throw new Error("No pude leer el ticket claramente.");
      }
    } catch (err) {
      toast.error(err.message, { id: toastId });
    } finally {
      setCargando(false);
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="w-full max-w-lg glass-panel p-6 rounded-3xl relative overflow-hidden"
          >
            {/* Fondo decorativo IA */}
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-600/20 rounded-full blur-3xl animate-pulse" />
            
            <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors">
              <X size={24} />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <Sparkles className="text-white w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h2 className="text-xl font-black text-white leading-none">Ingreso Mágico</h2>
                <p className="text-[10px] text-indigo-400 uppercase tracking-widest font-black mt-1">Carga Inteligente con IA</p>
              </div>
            </div>

            {!resultado ? (
              <div className="space-y-6">
                <div className="relative">
                  <textarea
                    placeholder='Ej: "Cena en Pizza Hut 180mil" o "Carga de nafta 250k"...'
                    className="w-full h-32 bg-slate-900/50 border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-indigo-500/50 transition-all placeholder:text-slate-600 italic"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                  />
                  <div className="absolute bottom-3 right-3 flex gap-2">
                    <label className="p-3 bg-white/5 hover:bg-white/10 text-slate-400 rounded-xl cursor-pointer transition-colors border border-white/5">
                      <Camera size={20} />
                      <input type="file" accept="image/*" capture="environment" className="hidden" onChange={manejarFoto} />
                    </label>
                    <button 
                      onClick={procesarEntrada}
                      disabled={cargando || !input.trim()}
                      className="p-3 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-600/20 disabled:opacity-30 transition-all active:scale-95"
                    >
                      {cargando ? <Loader2 className="animate-spin" /> : <Wand2 size={20} />}
                    </button>
                  </div>
                </div>
                <p className="text-center text-[10px] text-slate-500 font-bold uppercase tracking-tighter">
                  Podés escribir o subir una foto del ticket
                </p>
              </div>
            ) : (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                <div className="p-6 bg-indigo-600/10 border border-indigo-500/20 rounded-2xl space-y-4">
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Resumen Interpretado</span>
                    <button onClick={() => setResultado(null)} className="text-[10px] font-bold text-slate-500 hover:text-white underline">Corregir</button>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] text-slate-500 font-bold uppercase">Concepto</label>
                      <div className="text-lg font-bold text-white truncate">{resultado.concepto}</div>
                    </div>
                    <div className="text-right">
                      <label className="text-[10px] text-slate-500 font-bold uppercase">Monto</label>
                      <div className="text-2xl font-black text-indigo-400">{resultado.monto.toLocaleString()} <span className="text-xs">{resultado.moneda}</span></div>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 font-bold uppercase">Categoría</label>
                      <div className="text-sm font-bold text-white px-3 py-1 bg-white/5 rounded-lg w-fit">{resultado.categoria}</div>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => {
                    onConfirm(resultado);
                    setResultado(null);
                    onClose();
                  }}
                  className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl shadow-xl shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
                >
                  CONFIRMAR Y GUARDAR <Check size={20} />
                </button>
              </motion.div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function Check({ size }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>;
}
