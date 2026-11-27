import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import { formatarInput, desformatearInput, calcularFechaCobroReal } from "../../../shared/lib/formatters";
import { obtenerCotizacion } from "../../../services/cotizaciones.service";
import {
  actualizarIngresoProgramado,
  eliminarIngreso,
  eliminarIngresoProgramado,
  insertarHistorialSalario,
  insertarIngresoProgramado,
  insertarIngresos,
  listarHistorialSalarios,
  listarIngresosProgramadosActivos,
} from "../../../services/ingresos.service";
import { insertarGastos } from "../../../services/gastos.service";
import { actualizarCuota } from "../../../services/deudas.service";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Plus, Wallet, TrendingUp, Calendar, User, ArrowUpRight, X, 
  Settings, Clock, CheckCircle, RefreshCcw, Landmark, Trash2, Edit2, History, Loader2,
  CalendarDays, Tag, Percent, CreditCard, Link2, ArrowRight, ArrowLeft
} from "lucide-react";
import ModalIngreso from './ModalIngreso';
import PanelHistorialSalarial from './PanelHistorialSalarial';
import PanelIngresosFijos from './PanelIngresosFijos';
import PanelHistorialIngresos from './PanelHistorialIngresos';

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
  const [pasoIngreso, setPasoIngreso] = useState(1); // 1: Datos Básicos, 2: Programación/Descuentos
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
    // Recargar sólo cuando cambia el hogar, no en cada render del padre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datosHogar?.espacio_id]);

  async function cargarProgramados() {
    try {
      const { data, error } = await listarIngresosProgramadosActivos(datosHogar.espacio_id);
      
      if (error) throw error;
      setProgramados(data || []);
    } catch (e) {
      console.error("Error cargando programados:", e);
    }
  }

  async function cargarHistorialSalarios() {
    try {
      const { data, error } = await listarHistorialSalarios(datosHogar.espacio_id);
      
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
        const { error } = await insertarIngresos([{
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
        const { error } = await insertarIngresoProgramado({
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
        });
        if (error) throw error;
        toast.success("¡Ingreso programado! 📅", { id: toastId });
        cargarProgramados();
      } else if (tipoRegistro === 'edicion') {
        const nuevoMonto = montoLimpio;
        const { error: errUpd } = await actualizarIngresoProgramado(idEditando, {
            monto: nuevoMonto, 
            descripcion: concepto, 
            dia_recurrencia: parseInt(diaRecurrencia),
            categoria: categoria,
            solo_dias_habiles: soloDiasHabiles,
            ajuste_dia_habil: ajusteDiaHabil,
            monto_descuento: montoDescLimpio,
            concepto_descuento: conceptoDescFinal
          });
        if (errUpd) throw errUpd;

        if (nuevoMonto !== montoAnterior) {
          await insertarHistorialSalario({
            espacio_id: datosHogar.espacio_id,
            usuario_id: usuarioActual.id,
            ingreso_programado_id: idEditando,
            monto_anterior: montoAnterior,
            monto_nuevo: nuevoMonto,
            moneda: moneda,
            motivo: nuevoMonto > montoAnterior ? "Aumento Salarial" : "Ajuste Salarial"
          });
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
      const { error: errIngreso } = await insertarIngresos([{
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
        await insertarGastos([{
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
            await actualizarCuota(cuotaPend.id, {
              monto_abonado: nuevoAbonado,
              estado: estaPagada ? 'pagado' : 'pendiente',
              fecha_pago: new Date().toISOString(),
              pagador_id: prog.usuario_id || usuarioActual.id
            });
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
        const { error } = await eliminarIngresoProgramado(id);
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
        const { error } = await eliminarIngreso(id);
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
    setPasoIngreso(1);
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
    setPasoIngreso(1);
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
            <PanelHistorialIngresos datosHogar={datosHogar} eliminarIngresoMensual={eliminarIngresoMensual} getNombreUsuario={getNombreUsuario} ingresos={ingresos} usuarioActual={usuarioActual} />
          </motion.div>
        )}

        {activeTab === 'programados' && (
          <motion.div key="programados" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
            <PanelIngresosFijos abrirEdicion={abrirEdicion} confirmarRecepcion={confirmarRecepcion} datosHogar={datosHogar} eliminarProgramado={eliminarProgramado} getNombreUsuario={getNombreUsuario} programados={programados} usuarioActual={usuarioActual} verificarSiFueCobradoEsteMes={verificarSiFueCobradoEsteMes} />
          </motion.div>
        )}

        {activeTab === 'historial_salarios' && (
          <motion.div key="salarios" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
            <PanelHistorialSalarial historialSalarios={historialSalarios} />
          </motion.div>
        )}
      </AnimatePresence>

      <ModalIngreso CATEGORIAS_INGRESO={CATEGORIAS_INGRESO} ajusteDiaHabil={ajusteDiaHabil} categoria={categoria} concepto={concepto} conceptoDescuento={conceptoDescuento} deudaVinculadaId={deudaVinculadaId} deudas={deudas} diaRecurrencia={diaRecurrencia} fechaEfectiva={fechaEfectiva} guardando={guardando} modoDescuento={modoDescuento} moneda={moneda} montoAnterior={montoAnterior} montoDescuentoFormateado={montoDescuentoFormateado} montoFormateado={montoFormateado} mostrarModal={mostrarModal} pasoIngreso={pasoIngreso} registrarIngreso={registrarIngreso} resetForm={resetForm} setAjusteDiaHabil={setAjusteDiaHabil} setCategoria={setCategoria} setConcepto={setConcepto} setConceptoDescuento={setConceptoDescuento} setDeudaVinculadaId={setDeudaVinculadaId} setDiaRecurrencia={setDiaRecurrencia} setFechaEfectiva={setFechaEfectiva} setModoDescuento={setModoDescuento} setMoneda={setMoneda} setMontoDescuentoFormateado={setMontoDescuentoFormateado} setMontoFormateado={setMontoFormateado} setMostrarModal={setMostrarModal} setPasoIngreso={setPasoIngreso} setSoloDiasHabiles={setSoloDiasHabiles} soloDiasHabiles={soloDiasHabiles} tipoRegistro={tipoRegistro} />
    </div>
  );
}
