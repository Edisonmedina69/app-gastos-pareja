import { useState, useEffect } from "react";
import { supabase } from "../supabase";
import { toast } from "react-hot-toast";
import { formatearNumero } from "../utils/formatters";
import { obtenerCotizacion } from "../utils/exchangeApi";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Plus, Wallet, TrendingUp, Calendar, User, ArrowUpRight, X, 
  Settings, Clock, CheckCircle, RefreshCcw, Landmark, Trash2
} from "lucide-react";

export default function Ingresos({
  usuarioActual,
  ingresos,
  monedaGlobal,
  obtenerDatos,
  getNombreUsuario,
  datosHogar,
}) {
  // UI State
  const [activeTab, setActiveTab] = useState("historial"); // 'historial' | 'programados'
  const [mostrarModal, setMostrarModal] = useState(false);
  const [tipoRegistro, setTipoIngreso] = useState("variable"); // 'variable' | 'fijo'
  const [guardando, setGuardando] = useState(false);

  // Form State
  const [concepto, setConcepto] = useState("");
  const [monto, setMonto] = useState("");
  const [moneda, setMoneda] = useState(monedaGlobal);
  const [diaRecurrencia, setDiaRecurrencia] = useState("5");
  const [tasaCambio, setTasaCambio] = useState(1);
  
  // Data State
  const [programados, setProgramados] = useState([]);

  useEffect(() => {
    if (mostrarModal) {
      setMoneda(monedaGlobal);
      setConcepto(tipoRegistro === 'fijo' ? "Salario Mensual" : "");
    }
  }, [mostrarModal, monedaGlobal, tipoRegistro]);

  useEffect(() => {
    if (moneda !== "PYG") {
      obtenerCotizacion(moneda, "PYG").then(setTasaCambio);
    } else {
      setTasaCambio(1);
    }
  }, [moneda]);

  useEffect(() => {
    if (datosHogar) cargarProgramados();
  }, [datosHogar]);

  async function cargarProgramados() {
    const { data } = await supabase
      .from("ingresos_programados")
      .select("*")
      .eq("espacio_id", datosHogar.espacio_id)
      .eq("activo", true)
      .order("dia_recurrencia", { ascending: true });
    if (data) setProgramados(data);
  }

  async function registrarIngreso(e) {
    e.preventDefault();
    setGuardando(true);
    const toastId = toast.loading("Procesando...");

    try {
      if (tipoRegistro === 'variable') {
        // HU-13: Registro Rápido
        const { error } = await supabase.from("ingresos_mensuales").insert([{
          usuario_id: usuarioActual.id,
          espacio_id: datosHogar.espacio_id,
          concepto: concepto || "Ingreso Extra",
          monto: parseFloat(monto),
          moneda: moneda,
          tasa_cambio: parseFloat(tasaCambio),
          mes: new Date().getMonth() + 1,
          anio: new Date().getFullYear()
        }]);
        if (error) throw error;
        toast.success("¡Ingreso registrado! 💰", { id: toastId });
      } else {
        // HU-11: Programar Ingreso Fijo
        const { error } = await supabase.from("ingresos_programados").insert([{
          usuario_id: usuarioActual.id,
          espacio_id: datosHogar.espacio_id,
          descripcion: concepto,
          monto: parseFloat(monto),
          moneda: moneda,
          dia_recurrencia: parseInt(diaRecurrencia),
          categoria: "Sueldo"
        }]);
        if (error) throw error;
        toast.success("¡Ingreso programado con éxito! 📅", { id: toastId });
        cargarProgramados();
      }
      
      setMostrarModal(false);
      resetForm();
      obtenerDatos();
    } catch (err) {
      toast.error(err.message, { id: toastId });
    } finally {
      setGuardando(false);
    }
  }

  async function confirmarRecepcion(prog) {
    // HU-12: Confirmación manual
    const toastId = toast.loading(`Acreditando ${prog.descripcion}...`);
    try {
      const { error } = await supabase.from("ingresos_mensuales").insert([{
        usuario_id: prog.usuario_id,
        espacio_id: prog.espacio_id,
        concepto: `[FIJO] ${prog.descripcion}`,
        monto: prog.monto,
        moneda: prog.moneda,
        tasa_cambio: await obtenerCotizacion(prog.moneda, "PYG"),
        mes: new Date().getMonth() + 1,
        anio: new Date().getFullYear()
      }]);
      if (error) throw error;
      toast.success("¡Ingreso acreditado al balance! 🏦", { id: toastId });
      obtenerDatos();
    } catch (e) {
      toast.error("Error al acreditar");
    }
  }

  async function eliminarProgramado(id) {
    if (confirm("¿Eliminar esta programación?")) {
      await supabase.from("ingresos_programados").delete().eq("id", id);
      cargarProgramados();
      toast.success("Programación eliminada");
    }
  }

  const resetForm = () => {
    setMonto(""); setConcepto(""); setDiaRecurrencia("5");
  };

  return (
    <div className="space-y-6 pb-20">
      <header className="flex items-center justify-between">
        <h2 className="text-xl font-black text-white flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-emerald-400" /> Motor de Ingresos
        </h2>
        <div className="flex bg-white/5 p-1 rounded-xl border border-white/5 backdrop-blur-md">
          <button onClick={() => setActiveTab('historial')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${activeTab === 'historial' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500'}`}>Efectivos</button>
          <button onClick={() => setActiveTab('programados')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${activeTab === 'programados' ? 'bg-slate-700 text-white' : 'text-slate-500'}`}>Programados</button>
        </div>
      </header>

      {/* BOTÓN REGISTRO RÁPIDO */}
      <div className="grid grid-cols-2 gap-3">
        <motion.button whileTap={{ scale: 0.95 }} onClick={() => { setTipoIngreso('variable'); setMostrarModal(true); }} className="p-4 bg-emerald-600/20 border border-emerald-500/30 rounded-2xl flex flex-col items-center gap-2 hover:bg-emerald-600/30 transition-all">
          <Plus className="text-emerald-400" />
          <span className="text-[10px] font-black text-white uppercase">Ingreso Rápido</span>
        </motion.button>
        <motion.button whileTap={{ scale: 0.95 }} onClick={() => { setTipoIngreso('fijo'); setMostrarModal(true); }} className="p-4 bg-white/5 border border-white/10 rounded-2xl flex flex-col items-center gap-2 hover:bg-white/10 transition-all">
          <RefreshCcw className="text-indigo-400" />
          <span className="text-[10px] font-black text-white uppercase">Programar Fijo</span>
        </motion.button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'historial' ? (
          <motion.div key="historial" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
            {ingresos.length === 0 ? (
              <div className="glass-card py-12 text-center opacity-40"><Wallet size={40} className="mx-auto mb-3" /><p className="text-xs font-bold uppercase tracking-widest">Sin ingresos este mes</p></div>
            ) : (
              ingresos.map((i) => (
                <div key={i.id} className="glass-card flex items-center justify-between border-l-4 border-l-emerald-500">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400"><Landmark size={20} /></div>
                    <div>
                      <div className="text-xs font-black text-white uppercase tracking-tighter">{i.concepto}</div>
                      <div className="text-[10px] text-slate-500 font-bold">{getNombreUsuario(i.usuario_id)} • {new Date(i.created_at).toLocaleDateString()}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-emerald-400 font-black tracking-tight">+ {formatearNumero(i.monto, i.moneda)}</div>
                  </div>
                </div>
              ))
            )}
          </motion.div>
        ) : (
          <motion.div key="programados" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
            {programados.length === 0 ? (
              <div className="glass-card py-12 text-center opacity-40"><Clock size={40} className="mx-auto mb-3" /><p className="text-xs font-bold uppercase tracking-widest">No tenés ingresos fijos</p></div>
            ) : (
              programados.map((p) => (
                <div key={p.id} className="glass-card border-l-4 border-l-indigo-500">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="font-black text-white text-sm uppercase">{p.descripcion}</h4>
                      <p className="text-[10px] text-slate-500 font-black">Cobra los días {p.dia_recurrencia} • {getNombreUsuario(p.usuario_id)}</p>
                    </div>
                    <button onClick={() => eliminarProgramado(p.id)} className="p-2 text-slate-600 hover:text-red-400"><Trash2 size={16}/></button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-xl font-black text-white">{formatearNumero(p.monto, p.moneda)}</div>
                    <button onClick={() => confirmarRecepcion(p)} className="px-4 py-2 bg-emerald-600 text-white text-[10px] font-black rounded-xl shadow-lg shadow-emerald-900/20 flex items-center gap-2 active:scale-95 transition-all">
                      <CheckCircle size={14}/> CONFIRMAR COBRO
                    </button>
                  </div>
                </div>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL REGISTRO DINÁMICO */}
      <AnimatePresence>
        {mostrarModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-lg glass-panel p-6 rounded-3xl relative">
              <button onClick={() => setMostrarModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X size={24} /></button>
              <h2 className="text-xl font-black text-white mb-6 uppercase tracking-tighter flex items-center gap-2">
                {tipoRegistro === 'variable' ? <Plus className="text-emerald-400"/> : <Clock className="text-indigo-400"/>}
                {tipoRegistro === 'variable' ? 'Registrar Ingreso' : 'Programar Ingreso Fijo'}
              </h2>

              <form onSubmit={registrarIngreso} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Descripción</label>
                  <input type="text" placeholder="Ej: Sueldo, Venta, Regalo..." value={concepto} onChange={(e) => setConcepto(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-emerald-500/50" required />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Monto</label>
                    <input type="number" value={monto} onChange={(e) => setMonto(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white text-lg font-black" required />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Moneda</label>
                    <select value={moneda} onChange={(e) => setMoneda(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white">
                      <option value="PYG">PYG</option>
                      <option value="BRL">BRL</option>
                      <option value="USD">USD</option>
                    </select>
                  </div>
                </div>

                {tipoRegistro === 'fijo' && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-indigo-400 uppercase ml-1">Día de Recurrencia (Mensual)</label>
                    <input type="number" min="1" max="31" value={diaRecurrencia} onChange={(e) => setDiaRecurrencia(e.target.value)} className="w-full bg-indigo-500/5 border border-indigo-500/20 rounded-xl px-4 py-3 text-white font-black" required />
                    <p className="text-[9px] text-slate-500 italic ml-1">El sistema te notificará este día para que confirmes el cobro.</p>
                  </div>
                )}

                <button type="submit" disabled={guardando} className={`w-full py-4 font-black rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2 ${tipoRegistro === 'variable' ? 'bg-emerald-600' : 'bg-indigo-600'} text-white active:scale-95`}>
                  {guardando ? <Loader2 className="animate-spin" /> : (tipoRegistro === 'variable' ? 'REGISTRAR AHORA' : 'PROGRAMAR MENSUAL')}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
