import { useState, useEffect } from "react";
import { supabase } from "../supabase";
import { toast } from "react-hot-toast";
import { formatearNumero, formatarInput, desformatearInput, calcularFechaCobroReal } from "../utils/formatters";
import { obtenerCotizacion } from "../utils/exchangeApi";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Plus, Wallet, TrendingUp, Calendar, User, ArrowUpRight, X, 
  Settings, Clock, CheckCircle, RefreshCcw, Landmark, Trash2, Edit2, History, Loader2,
  CalendarDays, Tag, Percent, CreditCard, Link2
} from "lucide-react";

export default function Ingresos({
  usuarioActual,
  ingresos,
  deudas = [],
  monedaGlobal,
  obtenerDatos,
  getNombreUsuario,
  datosHogar,
}) {
  // UI State
  const [activeTab, setActiveTab] = useState("historial"); 
  const [mostrarModal, setMostrarModal] = useState(false);
  const [tipoRegistro, setTipoIngreso] = useState("variable"); 
  const [guardando, setGuardando] = useState(false);

  // Form State
  const [concepto, setConcepto] = useState("");
  const [montoFormateado, setMontoFormateado] = useState("");
  const [moneda, setMoneda] = useState(monedaGlobal);
  const [diaRecurrencia, setDiaRecurrencia] = useState("5");
  const [categoria, setCategoria] = useState("Salario Mensual");
  const [soloDiasHabiles, setSoloDiasHabiles] = useState(true);
  const [ajusteDiaHabil, setAjusteDiaHabil] = useState("anterior");
  
  // Modo de descuento: 'ninguno' | 'manual' | 'vinculado'
  const [modoDescuento, setModoDescuento] = useState("ninguno");
  const [montoDescuentoFormateado, setMontoDescuentoFormateado] = useState("");
  const [conceptoDescuento, setConceptoDescuento] = useState("");
  const [deudaVinculadaId, setDeudaVinculadaId] = useState("");
  
  const [fechaEfectiva, setFechaEfectiva] = useState(new Date().toISOString().split("T")[0]);

  const [tasaCambio, setTasaCambio] = useState(1);
  const [idEditando, setIdEditando] = useState(null);
  const [montoAnterior, setMontoAnterior] = useState(0);
  
  // Data State
  const [programados, setProgramados] = useState([]);
  const [historialSalarios, setHistorialSalarios] = useState([]);

  const CATEGORIAS_INGRESO = [
    "Salario Mensual",
    "Honorarios",
    "Rentas / Alquiler",
    "Ventas",
    "Freelance / Servicios",
    "Aguinaldo / Bono",
    "Otros"
  ];

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
  }, [datosHogar?.espacio_id]);

  async function cargarProgramados() {
    try {
      const { data, error } = await supabase
        .from("ingresos_programados")
        .select("*")
        .eq("espacio_id", datosHogar.espacio_id)
        .eq("activo", true)
        .order("dia_recurrencia", { ascending: true });
      
      if (error) throw error;
      setProgramados(data || []);
    } catch (e) {
      console.error("Error cargando programados:", e);
    }
  }

  async function cargarHistorialSalarios() {
    try {
      const { data, error } = await supabase
        .from("historial_salarios")
        .select("*")
        .eq("espacio_id", datosHogar.espacio_id)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      setHistorialSalarios(data || []);
    } catch (e) {
      console.error("Error cargando historial:", e);
    }
  }

  async function registrarIngreso(e) {
    e.preventDefault();
    const montoLimpio = desformatearInput(montoFormateado);

    let montoDescLimpio = 0;
    let conceptoDescFinal = "";

    if (modoDescuento === "manual") {
      montoDescLimpio = desformatearInput(montoDescuentoFormateado);
      conceptoDescFinal = conceptoDescuento || "Descuento Automático";
    } else if (modoDescuento === "vinculado" && deudaVinculadaId) {
      const dSel = deudas.find(d => d.id === deudaVinculadaId);
      if (dSel) {
        const cuotaPend = dSel.cuotas_detalle?.find(c => c.estado === 'pendiente');
        montoDescLimpio = cuotaPend ? Number(cuotaPend.monto_cuota) - Number(cuotaPend.monto_abonado) : 0;
        conceptoDescFinal = `Pago Automático: ${dSel.titulo}`;
      }
    }

    if (!montoLimpio || guardando) return;

    setGuardando(true);
    const toastId = toast.loading("Procesando...");

    try {
      if (tipoRegistro === 'variable') {
        const fechaObj = new Date(fechaEfectiva);
        const { error } = await supabase.from("ingresos_mensuales").insert([{
          usuario_id: usuarioActual.id,
          espacio_id: datosHogar.espacio_id,
          concepto: concepto || "Ingreso Extra",
          monto: montoLimpio,
          moneda: moneda,
          tasa_cambio: parseFloat(tasaCambio),
          tipo_ingreso: categoria,
          fecha_efectiva: fechaEfectiva,
          mes: fechaObj.getMonth() + 1,
          anio: fechaObj.getFullYear()
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
          categoria: categoria,
          solo_dias_habiles: soloDiasHabiles,
          ajuste_dia_habil: ajusteDiaHabil,
          monto_descuento: montoDescLimpio,
          concepto_descuento: conceptoDescFinal
        }]);
        if (error) throw error;
        toast.success("¡Ingreso programado! 📅", { id: toastId });
        cargarProgramados();
      } else if (tipoRegistro === 'edicion') {
        const nuevoMonto = montoLimpio;
        const { error: errUpd } = await supabase
          .from("ingresos_programados")
          .update({ 
            monto: nuevoMonto, 
            descripcion: concepto, 
            dia_recurrencia: parseInt(diaRecurrencia),
            categoria: categoria,
            solo_dias_habiles: soloDiasHabiles,
            ajuste_dia_habil: ajusteDiaHabil,
            monto_descuento: montoDescLimpio,
            concepto_descuento: conceptoDescFinal
          })
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
      const calculoFecha = calcularFechaCobroReal(
        prog.dia_recurrencia,
        new Date().getMonth() + 1,
        new Date().getFullYear(),
        prog.solo_dias_habiles ?? true,
        prog.ajuste_dia_habil || 'anterior'
      );

      const cotizacion = await obtenerCotizacion(prog.moneda, "PYG");

      // 1. Insertar el ingreso bruto
      const { error: errIngreso } = await supabase.from("ingresos_mensuales").insert([{
        usuario_id: prog.usuario_id || usuarioActual.id,
        espacio_id: prog.espacio_id,
        concepto: `[FIJO] ${prog.descripcion}`,
        monto: prog.monto,
        moneda: prog.moneda,
        tasa_cambio: cotizacion,
        tipo_ingreso: prog.categoria || "Salario Mensual",
        fecha_efectiva: calculoFecha.fechaStr,
        mes: new Date().getMonth() + 1,
        anio: new Date().getFullYear()
      }]);
      if (errIngreso) throw errIngreso;

      // 2. Si tiene descuento/pago automático de cuenta, registrar el gasto
      if (prog.monto_descuento > 0) {
        await supabase.from("gastos").insert([{
          espacio_id: prog.espacio_id,
          usuario_id: prog.usuario_id || usuarioActual.id,
          pagador_id: prog.usuario_id || usuarioActual.id,
          concepto: `[Pago Automático] ${prog.concepto_descuento || 'Retención / Descuento'}`,
          monto: prog.monto_descuento,
          moneda: prog.moneda,
          tasa_cambio: cotizacion,
          categoria: "Retenciones / Descuentos",
          para_quien: "Individual",
          fecha: calculoFecha.fechaStr
        }]);

        // Si el concepto está vinculado a una deuda maestra existente, intentar abonar la cuota pendiente
        const deudam = deudas.find(d => prog.concepto_descuento && prog.concepto_descuento.includes(d.titulo));
        if (deudam) {
          const cuotaPend = deudam.cuotas_detalle?.find(c => c.estado === 'pendiente');
          if (cuotaPend) {
            const nuevoAbonado = Number(cuotaPend.monto_abonado) + Number(prog.monto_descuento);
            const estaPagada = nuevoAbonado >= Number(cuotaPend.monto_cuota);
            await supabase.from("cuotas_detalle").update({
              monto_abonado: nuevoAbonado,
              estado: estaPagada ? 'pagado' : 'pendiente',
              fecha_pago: new Date().toISOString(),
              pagador_id: prog.usuario_id || usuarioActual.id
            }).eq("id", cuotaPend.id);
          }
        }
      }

      toast.success("¡Cobro y pago automático consolidado! 🏦✨", { id: toastId });
      obtenerDatos();
    } catch (e) {
      console.error("Error al cobrar:", e);
      toast.error(`Error al cobrar: ${e.message || e}`, { id: toastId });
    }
  }

  async function eliminarProgramado(id) {
    if (confirm("¿Eliminar este ingreso fijo?")) {
      const toastId = toast.loading("Eliminando...");
      try {
        const { error } = await supabase.from("ingresos_programados").delete().eq("id", id);
        if (error) throw error;
        cargarProgramados();
        obtenerDatos();
        toast.success("Programación eliminada", { id: toastId });
      } catch (err) {
        toast.error("Error al eliminar: " + err.message, { id: toastId });
      }
    }
  }

  async function eliminarIngresoMensual(id, concepto) {
    if (window.confirm(`¿Seguro que querés eliminar el ingreso "${concepto}"?`)) {
      const toastId = toast.loading("Eliminando ingreso...");
      try {
        const { error } = await supabase.from("ingresos_mensuales").delete().eq("id", id);
        if (error) throw error;
        toast.success("¡Ingreso eliminado! 🗑️", { id: toastId });
        obtenerDatos();
      } catch (err) {
        toast.error("Error al eliminar: " + err.message, { id: toastId });
      }
    }
  }

  const abrirEdicion = (p) => {
    setIdEditando(p.id); 
    setMontoAnterior(p.monto); 
    setConcepto(p.descripcion);
    setMontoFormateado(formatarInput(p.monto)); 
    setMoneda(p.moneda);
    setDiaRecurrencia(p.dia_recurrencia.toString()); 
    setCategoria(p.categoria || "Salario Mensual");
    setSoloDiasHabiles(p.solo_dias_habiles ?? true);
    setAjusteDiaHabil(p.ajuste_dia_habil || "anterior");

    if (p.monto_descuento > 0) {
      setModoDescuento("manual");
      setMontoDescuentoFormateado(formatarInput(p.monto_descuento));
      setConceptoDescuento(p.concepto_descuento || "");
    } else {
      setModoDescuento("ninguno");
      setMontoDescuentoFormateado("");
      setConceptoDescuento("");
    }
    
    setTipoIngreso('edicion');
    setMostrarModal(true);
  };

  const resetForm = () => {
    setMontoFormateado(""); 
    setConcepto(""); 
    setDiaRecurrencia("5"); 
    setCategoria("Salario Mensual");
    setSoloDiasHabiles(true);
    setAjusteDiaHabil("anterior");
    setModoDescuento("ninguno");
    setMontoDescuentoFormateado("");
    setConceptoDescuento("");
    setDeudaVinculadaId("");
    setFechaEfectiva(new Date().toISOString().split("T")[0]);
    setIdEditando(null); 
    setMontoAnterior(0);
  };

  const verificarSiFueCobradoEsteMes = (prog) => {
    return ingresos?.some(i => 
      i.concepto === `[FIJO] ${prog.descripcion}` && 
      Number(i.mes) === (new Date().getMonth() + 1) &&
      Number(i.anio) === new Date().getFullYear() &&
      i.usuario_id === prog.usuario_id
    ) || false;
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
          <motion.div key="historial" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
            <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl flex gap-3 items-center">
              <Landmark size={20} className="text-emerald-400 shrink-0" />
              <p className="text-[10px] text-slate-400 font-bold leading-normal">
                Aquí figuran los ingresos de caja **efectivos** recibidos en el mes en curso. Podés registrar ingresos variables directamente o confirmar el cobro de tus sueldos fijos desde la pestaña "Fijos".
              </p>
            </div>
            {ingresos.length === 0 ? (
              <div className="glass-card py-12 text-center opacity-40"><Wallet size={40} className="mx-auto mb-3" /><p className="text-xs font-bold uppercase tracking-widest">No hay ingresos registrados</p></div>
            ) : (
              ingresos.map((i) => (
                <div key={i.id} className="glass-card flex items-center justify-between border-l-4 border-l-emerald-500">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400"><Landmark size={20} /></div>
                    <div>
                      <div className="text-xs font-black text-white uppercase">{i.concepto}</div>
                      <div className="text-[10px] text-slate-500 font-bold">
                        {getNombreUsuario(i.usuario_id)} • {i.fecha_efectiva ? new Date(i.fecha_efectiva + "T00:00:00").toLocaleDateString("es-PY") : new Date(i.fecha || i.created_at || new Date().toISOString()).toLocaleDateString("es-PY")}
                        {i.tipo_ingreso && <span className="ml-2 text-indigo-400 uppercase font-black text-[9px]">• {i.tipo_ingreso}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-emerald-400 font-black tracking-tight">+ {formatearNumero(i.monto, i.moneda)}</div>
                    </div>
                    {(i.usuario_id === usuarioActual?.id || datosHogar?.rol === 'superadmin' || datosHogar?.rol === 'admin_hogar') && (
                      <button 
                        onClick={() => eliminarIngresoMensual(i.id, i.concepto)} 
                        className="p-2 text-slate-500 hover:text-red-400 active:scale-90 transition-colors duration-150"
                        title="Eliminar ingreso"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </motion.div>
        )}

        {activeTab === 'programados' && (
          <motion.div key="programados" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
            <div className="p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl flex gap-3 items-center">
              <Clock size={20} className="text-indigo-400 shrink-0" />
              <p className="text-[10px] text-slate-400 font-bold leading-normal">
                Aquí podés configurar tus **sueldos y rentas recurrentes** con ajuste de días hábiles y débito automático de cuentas.
              </p>
            </div>
            {programados.length === 0 ? (
              <div className="glass-card py-12 text-center opacity-40"><Clock size={40} className="mx-auto mb-3" /><p className="text-xs font-bold uppercase tracking-widest">Sin sueldos programados</p></div>
            ) : (
              programados.map((p) => {
                const cobrado = verificarSiFueCobradoEsteMes(p);
                const calculoFecha = calcularFechaCobroReal(
                  p.dia_recurrencia,
                  new Date().getMonth() + 1,
                  new Date().getFullYear(),
                  p.solo_dias_habiles ?? true,
                  p.ajuste_dia_habil || 'anterior'
                );

                return (
                  <div key={p.id} className="glass-card border-l-4 border-l-indigo-500">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-black text-white text-sm uppercase">{p.descripcion}</h4>
                          <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 text-[9px] font-black rounded-md uppercase">
                            {p.categoria || "Sueldo"}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 font-bold mt-1">
                          Día programado: {p.dia_recurrencia} 
                          {calculoFecha.esAjustado && (
                            <span className="text-amber-400 ml-1">
                              (Cobro hábil: {new Date(calculoFecha.fechaStr + "T00:00:00").toLocaleDateString("es-PY", { weekday: 'short', day: 'numeric', month: 'short' })})
                            </span>
                          )}
                          {!calculoFecha.esAjustado && ` • ${getNombreUsuario(p.usuario_id)}`}
                        </p>
                        {p.monto_descuento > 0 && (
                          <p className="text-[9px] text-red-400 font-bold mt-0.5 flex items-center gap-1">
                            <CreditCard size={11}/> Débito Automático: -{formatearNumero(p.monto_descuento, p.moneda)} ({p.concepto_descuento || 'Pago / Descuento'})
                          </p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        {(p.usuario_id === usuarioActual?.id || datosHogar?.rol === 'superadmin' || datosHogar?.rol === 'admin_hogar') && (
                          <>
                            <button onClick={() => abrirEdicion(p)} className="p-2 text-slate-600 hover:text-indigo-400" disabled={cobrado}><Edit2 size={16}/></button>
                            <button onClick={() => eliminarProgramado(p.id)} className="p-2 text-slate-600 hover:text-red-400"><Trash2 size={16}/></button>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-white/5">
                      <div>
                        <div className="text-xl font-black text-white">{formatearNumero(p.monto, p.moneda)}</div>
                        {p.monto_descuento > 0 && (
                          <div className="text-[10px] text-emerald-400 font-bold">
                            Monto libre estimado: {formatearNumero(p.monto - p.monto_descuento, p.moneda)}
                          </div>
                        )}
                      </div>
                      {cobrado ? (
                        <div className="px-4 py-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black rounded-xl flex items-center gap-1.5 cursor-default">
                          <CheckCircle size={14} /> COBRADO ✓
                        </div>
                      ) : (
                        <button onClick={() => confirmarRecepcion(p)} className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black rounded-xl flex items-center gap-2 active:scale-95 transition-all shadow-lg shadow-emerald-900/20">
                          <CheckCircle size={14}/> COBRAR
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </motion.div>
        )}

        {activeTab === 'historial_salarios' && (
          <motion.div key="salarios" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
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
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm overflow-y-auto">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md glass-panel p-6 rounded-3xl relative my-8">
              <button onClick={() => { setMostrarModal(false); resetForm(); }} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X size={24} /></button>
              <h2 className="text-xl font-black text-white mb-6 uppercase flex items-center gap-2 tracking-tighter">
                {tipoRegistro === 'variable' ? <Plus className="text-emerald-400"/> : <Clock className="text-indigo-400"/>}
                {tipoRegistro === 'variable' ? 'Registrar Ingreso' : (tipoRegistro === 'fijo' ? 'Programar Sueldo' : 'Ajustar Sueldo')}
              </h2>
              <form onSubmit={registrarIngreso} className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 mb-1 block">Categoría de Ingreso</label>
                  <select 
                    value={categoria} 
                    onChange={(e) => setCategoria(e.target.value)} 
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white font-bold"
                  >
                    {CATEGORIAS_INGRESO.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <input type="text" placeholder="Concepto (Ej: Sueldo Itaú, Honorarios Proyecto...)" value={concepto} onChange={(e) => setConcepto(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-emerald-500/50" required />
                
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
                      <option value="USD">USD</option>
                    </select>
                  </div>
                  
                  {tipoRegistro === 'variable' && (
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-emerald-400 uppercase ml-1">Fecha de Ingreso</label>
                      <input type="date" value={fechaEfectiva} onChange={(e) => setFechaEfectiva(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-3 text-white font-bold" required />
                    </div>
                  )}

                  {(tipoRegistro === 'fijo' || tipoRegistro === 'edicion') && (
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-indigo-400 uppercase ml-1">Día de Cobro (1-31)</label>
                      <input type="number" min="1" max="31" value={diaRecurrencia} onChange={(e) => setDiaRecurrencia(e.target.value)} className="w-full bg-indigo-500/5 border border-indigo-500/20 rounded-xl px-4 py-3 text-white font-black" required />
                    </div>
                  )}
                </div>

                {(tipoRegistro === 'fijo' || tipoRegistro === 'edicion') && (
                  <div className="p-4 bg-white/5 border border-white/5 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-300">¿Cobrar solo en Días Hábiles?</span>
                      <input 
                        type="checkbox" 
                        checked={soloDiasHabiles} 
                        onChange={(e) => setSoloDiasHabiles(e.target.checked)} 
                        className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
                      />
                    </div>
                    {soloDiasHabiles && (
                      <div className="space-y-1 pt-2 border-t border-white/5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase block">Si cae Fin de Semana:</label>
                        <select 
                          value={ajusteDiaHabil} 
                          onChange={(e) => setAjusteDiaHabil(e.target.value)}
                          className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                        >
                          <option value="anterior">Anticipar al Viernes anterior</option>
                          <option value="siguiente">Postergar al Lunes siguiente</option>
                        </select>
                      </div>
                    )}
                  </div>
                )}

                {(tipoRegistro === 'fijo' || tipoRegistro === 'edicion') && (
                  <div className="p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl space-y-3">
                    <span className="text-xs font-black text-indigo-300 uppercase tracking-tight block flex items-center gap-1.5">
                      <Link2 size={14}/> Vincular Cuenta o Pago Automático
                    </span>
                    
                    <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-900 rounded-xl">
                      {[
                        { id: 'ninguno', label: 'Sin pago' },
                        { id: 'vinculado', label: 'Cuenta reg.' },
                        { id: 'manual', label: 'Monto fijo' },
                      ].map(modo => (
                        <button
                          key={modo.id}
                          type="button"
                          onClick={() => setModoDescuento(modo.id)}
                          className={`py-1.5 text-[9px] font-black uppercase rounded-lg transition-all ${modoDescuento === modo.id ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 hover:text-white'}`}
                        >
                          {modo.label}
                        </button>
                      ))}
                    </div>

                    {modoDescuento === 'vinculado' && (
                      <div className="space-y-2 pt-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase block">Seleccionar Cuenta o Deuda Registrada</label>
                        <select
                          value={deudaVinculadaId}
                          onChange={(e) => setDeudaVinculadaId(e.target.value)}
                          className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white font-bold"
                        >
                          <option value="">-- Seleccionar cuenta a pagar --</option>
                          {deudas.filter(d => d.estado !== 'cerrada').map(d => {
                            const cuotaPend = d.cuotas_detalle?.find(c => c.estado === 'pendiente');
                            const montoPend = cuotaPend ? Math.max(0, Number(cuotaPend.monto_cuota) - Number(cuotaPend.monto_abonado)) : 0;
                            return (
                              <option key={d.id} value={d.id}>
                                {d.titulo} ({formatearNumero(montoPend, d.moneda)})
                              </option>
                            );
                          })}
                        </select>
                        {deudaVinculadaId && (
                          <p className="text-[9px] text-emerald-400 font-bold">
                            Al cobrar el sueldo, se debitará y pagará automáticamente la cuota pendiente de esta cuenta.
                          </p>
                        )}
                      </div>
                    )}

                    {modoDescuento === 'manual' && (
                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <input 
                          type="text" 
                          placeholder="Ej: IPS, Gym, Alquiler" 
                          value={conceptoDescuento} 
                          onChange={(e) => setConceptoDescuento(e.target.value)} 
                          className="bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                        />
                        <input 
                          type="text" 
                          placeholder="Monto descuento" 
                          value={montoDescuentoFormateado} 
                          onChange={(e) => setMontoDescuentoFormateado(formatarInput(e.target.value))} 
                          className="bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-red-400"
                        />
                      </div>
                    )}
                  </div>
                )}

                {tipoRegistro === 'edicion' && desformatearInput(montoFormateado) > montoAnterior && (
                   <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-3"><TrendingUp className="text-emerald-500" size={18} /><p className="text-[10px] text-emerald-200 font-bold uppercase tracking-tighter">¡Crecimiento salarial detectado! 🚀</p></div>
                )}
                
                <button type="submit" disabled={guardando} className={`w-full py-4 font-black rounded-2xl ${tipoRegistro === 'variable' ? 'bg-emerald-600' : 'bg-indigo-600'} text-white shadow-xl shadow-indigo-900/20 active:scale-95 transition-all`}>
                  {guardando ? <Loader2 className="animate-spin mx-auto" /> : "GUARDAR Y CONSOLIDAR"}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
