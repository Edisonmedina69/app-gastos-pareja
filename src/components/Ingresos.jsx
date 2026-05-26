import { useState, useEffect } from "react";
import { supabase } from "../supabase";
import { toast } from "react-hot-toast";
import { formatearNumero, formatarInput, desformatearInput } from "../utils/formatters";
import { obtenerCotizacion } from "../utils/exchangeApi";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Plus, Wallet, TrendingUp, Calendar, User, ArrowUpRight, X, 
  Settings, Clock, CheckCircle, RefreshCcw, Landmark, Trash2, Edit2, History
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
  const [activeTab, setActiveTab] = useState("historial"); // 'historial' | 'programados' | 'historial_salarios'
  const [mostrarModal, setMostrarModal] = useState(false);
  const [tipoRegistro, setTipoIngreso] = useState("variable"); // 'variable' | 'fijo' | 'edicion'
  const [guardando, setGuardando] = useState(false);

  // Form State
  const [concepto, setConcepto] = useState("");
  const [montoFormateado, setMontoFormateado] = useState("");
  const [moneda, setMoneda] = useState(monedaGlobal);
  const [diaRecurrencia, setDiaRecurrencia] = useState("5");
  const [tasaCambio, setTasaCambio] = useState(1);
  const [idEditando, setIdEditando] = useState(null);
  const [montoAnterior, setMontoAnterior] = useState(0);
  
  // Data State
  const [programados, setProgramados] = useState([]);
  const [historialSalarios, setHistorialSalarios] = useState([]);

  useEffect(() => {
    if (mostrarModal && tipoRegistro !== 'edicion') {
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
    if (datosHogar) {
      cargarProgramados();
      cargarHistorialSalarios();
    }
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

  async function cargarHistorialSalarios() {
    const { data } = await supabase
      .from("historial_salarios")
      .select("*")
      .eq("espacio_id", datosHogar.espacio_id)
      .order("created_at", { ascending: false });
    if (data) setHistorialSalarios(data);
  }

  async function registrarIngreso(e) {
    e.preventDefault();
    const montoLimpio = desformatearInput(montoFormateado);
    if (!montoLimpio || guardando) return;

    setGuardando(true);
    const toastId = toast.loading("Procesando...");

    try {
      if (tipoRegistro === 'variable') {
        const { error } = await supabase.from("ingresos_mensuales").insert([{
          usuario_id: usuarioActual.id,
          espacio_id: datosHogar.espacio_id,
          concepto: concepto || "Ingreso Extra",
          monto: montoLimpio,
          moneda: moneda,
          tasa_cambio: parseFloat(tasaCambio),
          mes: new Date().getMonth() + 1,
          anio: new Date().getFullYear()
        }]);
        if (error) throw error;
        toast.success("¡Ingreso registrado! 💰", { id: toastId });
      } else if (tipoRegistro === 'fijo') {
        const { error } = await supabase.from("ingresos_programados").insert([{
          usuario_id: usuarioActual.id,
          espacio_id: datosHogar.espacio_id,
          descripcion: concepto,
          monto: montoLimpio,
          moneda: moneda,
          dia_recurrencia: parseInt(diaRecurrencia),
          categoria: "Sueldo"
        }]);
        if (error) throw error;
        toast.success("¡Ingreso programado! 📅", { id: toastId });
        cargarProgramados();
      } else if (tipoRegistro === 'edicion') {
        const nuevoMonto = montoLimpio;
        const { error: errUpd } = await supabase
          .from("ingresos_programados")
          .update({ monto: nuevoMonto, descripcion: concepto, dia_recurrencia: parseInt(diaRecurrencia) })
          .eq("id", idEditando);
        if (errUpd) throw errUpd;

        if (nuevoMonto !== montoAnterior) {
          await supabase.from("historial_salarios").insert([{
            espacio_id: datosHogar.espacio_id,
            usuario_id: usuarioActual.id,
            ingreso_programado_id: idEditando,
            monto_anterior: montoAnterior,
            monto_nuevo: nuevoMonto,
            moneda: moneda,
            motivo: nuevoMonto > montoAnterior ? "Aumento Salarial" : "Ajuste Salarial"
          }]);
        }

        toast.success("¡Ajuste guardado! Recalculando... 📈", { id: toastId });
        cargarProgramados();
        cargarHistorialSalarios();
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
      toast.success("¡Cobro confirmado! 🏦", { id: toastId });
      obtenerDatos();
    } catch (e) { toast.error("Error al cobrar"); }
  }

  async function eliminarProgramado(id) {
    if (confirm("¿Eliminar este ingreso fijo?")) {
      await supabase.from("ingresos_programados").delete().eq("id", id);
      cargarProgramados();
      toast.success("Programación eliminada");
    }
  }

  const abrirEdicion = (p) => {
    setIdEditando(p.id); setMontoAnterior(p.monto); setConcepto(p.descripcion);
    setMontoFormateado(formatarInput(p.monto)); setMoneda(p.moneda);
    setDiaRecurrencia(p.dia_recurrencia.toString()); setTipoIngreso('edicion');
    setMostrarModal(true);
  };

  const resetForm = () => {
    setMontoFormateado(""); setConcepto(""); setDiaRecurrencia("5"); setIdEditando(null); setMontoAnterior(0);
  };

  return (
    <div className="space-y-6 pb-20">
      <header className="flex items-center justify-between">
        <h2 className="text-xl font-black text-white flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-emerald-400" /> Motor de Ingresos
        </h2>
        <div className="flex bg-white/5 p-1 rounded-xl border border-white/5 backdrop-blur-md">
          {['historial', 'programados', 'historial_salarios'].map(tab => (
            <button 
              key={tab} 
              onClick={() => setActiveTab(tab)} 
              className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${activeTab === tab ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}
            >
              {tab === 'historial' ? 'Efectivos' : (tab === 'programados' ? 'Fijos' : <History size={14}/>)}
            </button>
          ))}
        </div>
      </header>

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
        {activeTab === 'historial' && (
          <motion.div key="historial" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {ingresos.length === 0 ? (
              <div className="glass-card py-12 text-center opacity-40"><Wallet size={40} className="mx-auto mb-3" /><p className="text-xs font-bold uppercase tracking-widest">No hay ingresos registrados</p></div>
            ) : (
              ingresos.map((i) => (
                <div key={i.id} className="glass-card flex items-center justify-between border-l-4 border-l-emerald-500">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400"><Landmark size={20} /></div>
                    <div>
                      <div className="text-xs font-black text-white uppercase">{i.concepto}</div>
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
        )}

        {activeTab === 'programados' && (
          <motion.div key="programados" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {programados.length === 0 ? (
              <div className="glass-card py-12 text-center opacity-40"><Clock size={40} className="mx-auto mb-3" /><p className="text-xs font-bold uppercase tracking-widest">Sin sueldos programados</p></div>
            ) : (
              programados.map((p) => (
                <div key={p.id} className="glass-card border-l-4 border-l-indigo-500">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="font-black text-white text-sm uppercase">{p.descripcion}</h4>
                      <p className="text-[10px] text-slate-500 font-black">Día de cobro: {p.dia_recurrencia} • {getNombreUsuario(p.usuario_id)}</p>
                    </div>
                    <div className="flex gap-1">
                      {(p.usuario_id === usuarioActual?.id || datosHogar?.rol === 'superadmin' || datosHogar?.rol === 'admin_hogar') && (
                        <>
                          <button onClick={() => abrirEdicion(p)} className="p-2 text-slate-600 hover:text-indigo-400"><Edit2 size={16}/></button>
                          <button onClick={() => eliminarProgramado(p.id)} className="p-2 text-slate-600 hover:text-red-400"><Trash2 size={16}/></button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-xl font-black text-white">{formatearNumero(p.monto, p.moneda)}</div>
                    <button onClick={() => confirmarRecepcion(p)} className="px-4 py-2 bg-emerald-600 text-white text-[10px] font-black rounded-xl flex items-center gap-2 active:scale-95 transition-all shadow-lg shadow-emerald-900/20">
                      <CheckCircle size={14}/> COBRAR
                    </button>
                  </div>
                </div>
              ))
            )}
          </motion.div>
        )}

        {activeTab === 'historial_salarios' && (
          <motion.div key="salarios" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
             <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Línea del Tiempo Salarial</h3>
            {historialSalarios.length === 0 ? (
              <div className="glass-card py-12 text-center opacity-40"><TrendingUp size={40} className="mx-auto mb-3" /><p className="text-xs font-bold uppercase tracking-widest">Sin ajustes previos</p></div>
            ) : (
              historialSalarios.map((h) => (
                <div key={h.id} className="glass-card bg-white/5 border-white/5 flex items-center justify-between relative overflow-hidden">
                  <div className="relative z-10">
                    <div className="text-[10px] font-black text-indigo-400 uppercase">{h.motivo}</div>
                    <div className="text-xs font-bold text-white mt-1">{new Date(h.created_at).toLocaleDateString()}</div>
                  </div>
                  <div className="text-right relative z-10">
                    <div className="text-[10px] text-slate-500 line-through">{formatearNumero(h.monto_anterior, h.moneda)}</div>
                    <div className="text-sm font-black text-emerald-400">→ {formatearNumero(h.monto_nuevo, h.moneda)}</div>
                  </div>
                  <div className="absolute top-0 right-0 opacity-5 -mr-4 -mt-4"><TrendingUp size={64}/></div>
                </div>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {mostrarModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-sm glass-panel p-6 rounded-3xl relative">
              <button onClick={() => { setMostrarModal(false); resetForm(); }} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X size={24} /></button>
              <h2 className="text-xl font-black text-white mb-6 uppercase flex items-center gap-2 tracking-tighter">
                {tipoRegistro === 'variable' ? <Plus className="text-emerald-400"/> : <Clock className="text-indigo-400"/>}
                {tipoRegistro === 'variable' ? 'Registrar Ingreso' : (tipoRegistro === 'fijo' ? 'Programar Sueldo' : 'Ajustar Sueldo')}
              </h2>
              <form onSubmit={registrarIngreso} className="space-y-4">
                <input type="text" placeholder="Concepto (Ej: Sueldo, Venta...)" value={concepto} onChange={(e) => setConcepto(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-emerald-500/50" required />
                
                <div className="relative">
                  <input 
                    type="text" 
                    value={montoFormateado} 
                    onChange={(e) => setMontoFormateado(formatarInput(e.target.value))} 
                    className="w-full bg-slate-900 border border-white/10 rounded-2xl px-4 py-4 text-2xl font-black text-emerald-400 outline-none" 
                    placeholder="0"
                    required 
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 font-black uppercase text-xs">{moneda}</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Moneda</label>
                    <select value={moneda} onChange={(e) => setMoneda(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white" disabled={tipoRegistro === 'edicion'}>
                      <option value="PYG">PYG</option>
                      <option value="BRL">BRL</option>
                    </select>
                  </div>
                  {(tipoRegistro === 'fijo' || tipoRegistro === 'edicion') && (
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-indigo-400 uppercase ml-1">Día de Cobro</label>
                      <input type="number" min="1" max="31" value={diaRecurrencia} onChange={(e) => setDiaRecurrencia(e.target.value)} className="w-full bg-indigo-500/5 border border-indigo-500/20 rounded-xl px-4 py-3 text-white font-black" required />
                    </div>
                  )}
                </div>

                {tipoRegistro === 'edicion' && desformatearInput(montoFormateado) > montoAnterior && (
                   <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-3"><TrendingUp className="text-emerald-500" size={18} /><p className="text-[10px] text-emerald-200 font-bold uppercase tracking-tighter">¡Crecimiento salarial detectado! 🚀</p></div>
                )}
                
                <button type="submit" disabled={guardando} className={`w-full py-4 font-black rounded-2xl ${tipoRegistro === 'variable' ? 'bg-emerald-600' : 'bg-indigo-600'} text-white shadow-xl shadow-indigo-900/20 active:scale-95 transition-all`}>
                  {guardando ? <Loader2 className="animate-spin mx-auto" /> : "REGISTRAR"}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
