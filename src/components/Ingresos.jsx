// src/components/Ingresos.jsx
import { useState, useEffect } from "react";
import { supabase } from "../supabase";
import { toast } from "react-hot-toast";
import { formatearNumero } from "../utils/formatters";
import { obtenerCotizacion } from "../utils/exchangeApi";
import { motion } from "framer-motion";
import { Plus, Wallet, TrendingUp, Calendar, User, ArrowUpRight, X } from "lucide-react";

export default function Ingresos({
  usuarioActual,
  ingresos,
  monedaGlobal,
  obtenerDatos,
  getNombreUsuario,
  datosHogar,
}) {
  const [conceptoIngreso, setConceptoIngreso] = useState("Salario Mensual");
  const [montoIngreso, setMontoIngreso] = useState("");
  const [tasaCambio, setTasaCambio] = useState(1);
  const [mostrarModal, setMostrarModal] = useState(false);

  useEffect(() => {
    if (mostrarModal && monedaGlobal !== "PYG") {
      async function cargarTasa() {
        const rate = await obtenerCotizacion(monedaGlobal, "PYG");
        setTasaCambio(rate);
      }
      cargarTasa();
    } else {
      setTasaCambio(prev => prev === 1 ? 1 : 1); // Solo actualiza si cambia, aunque prev === 1 es el default
    }
  }, [mostrarModal, monedaGlobal]);

  async function guardarIngreso(e) {
    e.preventDefault();
    if (!usuarioActual) return;

    const toastId = toast.loading("Guardando ingreso...");
    const fecha = new Date();

    const { error } = await supabase.from("ingresos_mensuales").insert([
      {
        usuario_id: usuarioActual.id,
        concepto: conceptoIngreso,
        monto: parseFloat(montoIngreso),
        mes: fecha.getMonth() + 1,
        anio: fecha.getFullYear(),
        moneda: monedaGlobal,
        tasa_cambio: parseFloat(tasaCambio),
        espacio_id: datosHogar.espacio_id
      },
    ]);

    if (error) {
      toast.error("Error al guardar ingreso: " + error.message, {
        id: toastId,
      });
    } else {
      setMontoIngreso("");
      setMostrarModal(false);
      toast.success("¡Ingreso registrado! 💰", { id: toastId });
      obtenerDatos();
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Seccion */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-emerald-400" /> Gestión de Ingresos
        </h2>
      </div>

      {/* BOTÓN NUEVO INGRESO */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setMostrarModal(true)}
        className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-3 transition-colors"
      >
        <div className="p-1 bg-white/20 rounded-lg">
          <Plus className="w-5 h-5" />
        </div>
        Registrar Nuevo Ingreso
      </motion.button>

      {/* LISTADO DE INGRESOS */}
      <div className="glass-card border-l-4 border-l-emerald-500">
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
          <Wallet className="w-4 h-4 text-emerald-400" /> Historial de Ingresos
        </h3>
        
        <div className="space-y-4">
          {ingresos.length === 0 ? (
            <p className="text-center py-8 text-slate-500 italic text-sm">No hay ingresos registrados este mes.</p>
          ) : (
            ingresos.map((i) => (
              <div
                key={i.id}
                className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-white text-sm">{getNombreUsuario(i.usuario_id)}</div>
                    <div className="text-xs text-slate-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> {i.concepto}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-emerald-400 font-black tracking-tight">
                    + {formatearNumero(i.monto, i.moneda)}
                  </div>
                  {i.moneda !== "PYG" && (
                    <div className="text-[10px] text-slate-500">
                      ≈ {formatearNumero(i.monto * (i.tasa_cambio || 1), "PYG")}
                    </div>
                  )}
                </div>
              </div>
            ))
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
              <Plus className="w-5 h-5 text-emerald-400" /> Registrar Ingreso
            </h2>

            <form onSubmit={guardarIngreso} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Concepto</label>
                <input
                  type="text"
                  placeholder="Ej: Salario Fijo, Venta..."
                  value={conceptoIngreso}
                  onChange={(e) => setConceptoIngreso(e.target.value)}
                  className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-emerald-500/50 transition-colors"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Monto en {monedaGlobal}</label>
                <div className="relative">
                  <input
                    type="number"
                    placeholder="0.00"
                    value={montoIngreso}
                    onChange={(e) => setMontoIngreso(e.target.value)}
                    className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-emerald-500/50 transition-colors text-xl font-bold"
                    required
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">{monedaGlobal}</div>
                </div>
              </div>

              <div className="text-right text-xs text-slate-500 font-medium">
                Vista previa: {formatearNumero(montoIngreso || 0, monedaGlobal)}
              </div>

              {monedaGlobal !== "PYG" && (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
                  <label className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest block mb-2">
                    Cotización sugerida (1 {monedaGlobal} = ? PYG)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={tasaCambio}
                    onChange={(e) => setTasaCambio(e.target.value)}
                    className="w-full bg-slate-950/50 border border-emerald-500/30 rounded-xl px-4 py-2 text-white outline-none focus:border-emerald-400 transition-colors mb-2"
                    required
                  />
                  <div className="text-right text-xs font-bold text-emerald-400">
                    Equivale a: {formatearNumero((montoIngreso || 0) * tasaCambio, "PYG")}
                  </div>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl shadow-xl shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 mt-4"
              >
                Guardar Ingreso <ArrowUpRight className="w-5 h-5" />
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
