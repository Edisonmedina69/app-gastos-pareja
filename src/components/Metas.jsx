// src/components/Metas.jsx
import { useState } from "react";
import { supabase } from "../supabase";
import { toast } from "react-hot-toast";
import { formatearNumero } from "../utils/formatters";
import { motion } from "framer-motion";
import { Plus, Target, TrendingUp, PiggyBank, ArrowUpRight, X } from "lucide-react";

export default function Metas({
  usuarioActual,
  metas,
  monedaGlobal,
  obtenerDatos,
  datosHogar
}) {
  const [tituloMeta, setTituloMeta] = useState("");
  const [montoObjetivoMeta, setMontoObjetivoMeta] = useState("");
  const [mostrarModal, setMostrarModal] = useState(false);

  async function crearMeta(e) {
    e.preventDefault();
    const toastId = toast.loading("Creando meta...");

    const { error } = await supabase.from("metas_ahorro").insert([
      {
        titulo: tituloMeta,
        monto_objetivo: parseFloat(montoObjetivoMeta),
        moneda: monedaGlobal,
        creador_id: usuarioActual.id,
        espacio_id: datosHogar.espacio_id
      },
    ]);

    if (error) {
      toast.error("Error al crear la meta: " + error.message, { id: toastId });
    } else {
      setTituloMeta("");
      setMontoObjetivoMeta("");
      setMostrarModal(false);
      toast.success("¡Meta creada con éxito! 🐷", { id: toastId });
      obtenerDatos();
    }
  }

  async function aportarAMeta(meta) {
    const aporte = prompt(`¿Cuánto querés aportar a "${meta.titulo}"? (${meta.moneda})`);
    if (aporte && !isNaN(aporte) && aporte > 0) {
      const toastId = toast.loading("Registrando aporte...");

      const { error } = await supabase
        .from("metas_ahorro")
        .update({ monto_actual: Number(meta.monto_actual) + Number(aporte) })
        .eq("id", meta.id);

      if (error) {
        toast.error("Error al aportar", { id: toastId });
      } else {
        await supabase.from("gastos").insert([
          {
            concepto: `Aporte a Meta: ${meta.titulo}`,
            monto: Number(aporte),
            categoria: "Ahorro",
            pagador_id: usuarioActual.id,
            para_quien: "Ambos",
            moneda: meta.moneda,
            espacio_id: datosHogar?.espacios?.id || datosHogar?.id
          },
        ]);
        obtenerDatos();
        toast.success("¡Aporte registrado! 💸", { id: toastId });
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Target className="w-5 h-5 text-amber-400" /> Metas de Ahorro
        </h2>
      </div>

      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setMostrarModal(true)}
        className="w-full py-4 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold rounded-2xl shadow-xl shadow-amber-500/20 flex items-center justify-center gap-3 transition-colors"
      >
        <div className="p-1 bg-slate-900/10 rounded-lg">
          <Plus className="w-5 h-5" />
        </div>
        Crear Nueva Meta
      </motion.button>

      <div className="glass-card border-l-4 border-l-amber-500">
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
          <PiggyBank className="w-4 h-4 text-amber-400" /> Nuestras Metas
        </h3>

        <div className="space-y-6">
          {metas.length === 0 ? (
            <p className="text-center py-8 text-slate-500 italic text-sm">Aún no tienen metas. ¡Empiecen a ahorrar hoy!</p>
          ) : (
            metas.map((m) => {
              const porcentaje = Math.min(
                (m.monto_actual / m.monto_objetivo) * 100,
                100,
              );
              return (
                <div key={m.id} className="bg-white/5 rounded-2xl p-5 border border-white/5 hover:bg-white/10 transition-all group">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="font-bold text-white text-lg">{m.titulo}</div>
                      <div className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">Objetivo: {formatearNumero(m.monto_objetivo, m.moneda)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-amber-400 font-black text-xl leading-none">{porcentaje.toFixed(1)}%</div>
                      <div className="text-[10px] text-slate-500 italic mt-1 font-bold">completado</div>
                    </div>
                  </div>

                  {/* Barra de Progreso */}
                  <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden border border-white/5 mb-4 shadow-inner">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${porcentaje}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full shadow-[0_0_12px_rgba(245,158,11,0.4)]"
                    />
                  </div>

                  <div className="flex justify-between items-center">
                    <div className="text-xs text-slate-400 font-medium">
                      Ahorrado: <span className="text-white font-bold">{formatearNumero(m.monto_actual || 0, m.moneda)}</span>
                    </div>
                    <button
                      onClick={() => aportarAMeta(m)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-bold rounded-xl border border-emerald-500/20 transition-all active:scale-95"
                    >
                      <Plus className="w-3 h-3" /> APORTAR
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* MODAL DE REGISTRO */}
      {mostrarModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="w-full max-w-lg glass-panel p-6 rounded-3xl relative"
          >
            <button
              onClick={() => setMostrarModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>

            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <PiggyBank className="w-5 h-5 text-amber-400" /> Crear Nueva Meta
            </h2>

            <form onSubmit={crearMeta} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Título de la Meta</label>
                <input
                  type="text"
                  placeholder="Ej: Viaje a Camboriú, Auto nuevo..."
                  value={tituloMeta}
                  onChange={(e) => setTituloMeta(e.target.value)}
                  className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-amber-500/50 transition-colors"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Monto Objetivo ({monedaGlobal})</label>
                <div className="relative">
                  <input
                    type="number"
                    placeholder="0.00"
                    value={montoObjetivoMeta}
                    onChange={(e) => setMontoObjetivoMeta(e.target.value)}
                    className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-amber-500/50 transition-colors text-xl font-bold"
                    required
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">{monedaGlobal}</div>
                </div>
              </div>

              <div className="text-right text-xs text-slate-500 font-medium">
                Vista previa: {formatearNumero(montoObjetivoMeta || 0, monedaGlobal)}
              </div>

              <button
                type="submit"
                className="w-full py-4 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold rounded-2xl shadow-xl shadow-amber-500/20 transition-all flex items-center justify-center gap-2 mt-4"
              >
                Crear Meta <ArrowUpRight className="w-5 h-5" />
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
