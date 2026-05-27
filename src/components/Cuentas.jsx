import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { toast } from 'react-hot-toast';
import { formatearNumero, formatarInput, desformatearInput } from '../utils/formatters';
import { motion, AnimatePresence } from "framer-motion";
import { 
  CreditCard, Plus, CheckCircle, X, Loader2, Sparkles, 
  Lock, Users, Send, Archive, AlertTriangle, ChevronDown, ChevronUp, Calendar, Trash2, Hash, Edit2
} from 'lucide-react';

export default function Cuentas({
  usuarioActual,
  otroUsuario,
  deudas,
  gastos,
  ingresos,
  monedaGlobal,
  obtenerDatos,
  datosHogar,
  saludFinanciera
}) {
  // Modal & Form State
  const [mostrarModal, setMostrarModal] = useState(false);
  const [mostrarModalPago, setMostrarModalPago] = useState(false);
  const [pagoSeleccionado, setPagoSeleccionado] = useState(null);
  
  // New Debt Fields
  const [tipoDeuda, setTipoDeuda] = useState("fija"); 
  const [alcanceDeuda, setAlcanceDeuda] = useState("familiar"); // individual | familiar
  const [titulo, setTitulo] = useState('');
  const [nroTarjeta, setNroTarjeta] = useState('');
  const [montoTotalFormateado, setMontoTotalFormateado] = useState('');
  const [lineaCreditoFormateada, setLineaCreditoFormateada] = useState('');
  const [pagoMinimoFormateado, setPagoMinimoFormateado] = useState('');
  const [cantidadCuotas, setCantidadCuotas] = useState(1);
  const [cuotasPagadas, setCuotasPagadas] = useState(0); 
  const [diaVencimiento, setDiaVencimiento] = useState("5");
  const [fechaCierreTarjeta, setFechaCierreTarjeta] = useState("25");
  const [monedaDeuda, setMonedaDeuda] = useState(monedaGlobal);
  
  // UI State
  const [guardando, setGuardando] = useState(false);
  const [deudaExpandida, setDeudaExpandida] = useState(null);
  const [pestana, setPestana] = useState('activas'); // activas | archivadas

  // IA State
  const [analizandoIA, setAnalizandoIA] = useState(false);
  const [sugerenciaIA, setSugerenciaIA] = useState(null);

  // Gastos Fijos State
  const [gastosProgramados, setGastosProgramados] = useState([]);
  const [cargandoFijos, setCargandoFijos] = useState(false);
  const [mostrarModalFijo, setMostrarModalFijo] = useState(false);
  const [idFijoEditando, setIdFijoEditando] = useState(null);
  
  // Form State Gasto Fijo
  const [fijoConcepto, setFijoConcepto] = useState('');
  const [fijoMontoFormateado, setFijoMontoFormateado] = useState('');
  const [fijoMoneda, setFijoMoneda] = useState(monedaGlobal);
  const [fijoDiaRecurrencia, setFijoDiaRecurrencia] = useState('5');
  const [fijoCategoria, setFijoCategoria] = useState('Casa');
  const [fijoParaQuien, setFijoParaQuien] = useState('Ambos');

  // Pago Gasto Fijo State
  const [mostrarModalPagarFijo, setMostrarModalPagarFijo] = useState(false);
  const [gastoFijoAPagar, setGastoFijoAPagar] = useState(null);
  const [pagarMontoFormateado, setPagarMontoFormateado] = useState('');
  const [pagarMoneda, setPagarMoneda] = useState('PYG');
  const [pagarPagadorId, setPagarPagadorId] = useState('');
  const [pagarParaQuien, setPagarParaQuien] = useState('Ambos');

  useEffect(() => {
    if (mostrarModalFijo && !idFijoEditando) {
      setFijoMoneda(monedaGlobal);
    }
  }, [mostrarModalFijo, monedaGlobal, idFijoEditando]);

  const cargarGastosProgramados = async () => {
    if (!datosHogar?.espacio_id) return;
    const timeoutId = setTimeout(() => {
      setCargandoFijos(false);
      console.warn("cargarGastosProgramados timed out after 5s.");
    }, 5000);
    try {
      setCargandoFijos(true);
      const { data, error } = await supabase
        .from("gastos_programados")
        .select("*")
        .eq("espacio_id", datosHogar.espacio_id)
        .order("dia_recurrencia", { ascending: true });
      
      clearTimeout(timeoutId);
      if (error) throw error;
      setGastosProgramados(data || []);
    } catch (e) {
      clearTimeout(timeoutId);
      console.error("Error cargando gastos fijos:", e);
    } finally {
      setCargandoFijos(false);
    }
  };

  useEffect(() => {
    if (pestana === 'fijos' && datosHogar?.espacio_id) {
      cargarGastosProgramados();
    }
  }, [pestana, datosHogar?.espacio_id]);

  const preCargarPlantillas = async () => {
    if (!datosHogar?.espacio_id || !usuarioActual?.id) return;
    const toastId = toast.loading("Cargando plantilla de supervivencia...");
    const defaults = [
      { concepto: "💧 Agua (ESSAP)", monto: 0, moneda: "PYG", dia_recurrencia: 10, categoria: "Casa", para_quien: "Ambos", espacio_id: datosHogar.espacio_id, usuario_id: usuarioActual.id },
      { concepto: "⚡ Luz (ANDE)", monto: 0, moneda: "PYG", dia_recurrencia: 10, categoria: "Casa", para_quien: "Ambos", espacio_id: datosHogar.espacio_id, usuario_id: usuarioActual.id },
      { concepto: "🗑️ Tasa de Basura", monto: 30000, moneda: "PYG", dia_recurrencia: 5, categoria: "Casa", para_quien: "Ambos", espacio_id: datosHogar.espacio_id, usuario_id: usuarioActual.id },
      { concepto: "🌐 Internet", monto: 150000, moneda: "PYG", dia_recurrencia: 5, categoria: "Casa", para_quien: "Ambos", espacio_id: datosHogar.espacio_id, usuario_id: usuarioActual.id },
      { concepto: "🛒 Supermercado / Comida", monto: 0, moneda: "PYG", dia_recurrencia: 5, categoria: "Supermercado", para_quien: "Ambos", espacio_id: datosHogar.espacio_id, usuario_id: usuarioActual.id }
    ];
    const timeoutId = setTimeout(() => {
      toast.error("Tiempo de espera agotado al pre-cargar plantilla.", { id: toastId });
    }, 8000);
    try {
      const { error } = await supabase.from('gastos_programados').insert(defaults);
      clearTimeout(timeoutId);
      if (error) throw error;
      toast.success("¡Plantilla básica cargada! 🏠✨", { id: toastId });
      cargarGastosProgramados();
    } catch (e) {
      clearTimeout(timeoutId);
      toast.error("Error al cargar: " + e.message, { id: toastId });
    }
  };

  const guardarGastoFijo = async (e) => {
    e.preventDefault();
    const montoLimpio = fijoMontoFormateado ? desformatearInput(fijoMontoFormateado) : 0;
    if (guardando || !usuarioActual || !datosHogar) return;
    setGuardando(true);
    const toastId = toast.loading("Procesando compromiso fijo...");
    const timeoutId = setTimeout(() => {
      setGuardando(false);
      toast.error("Tiempo de espera agotado. Intentá de nuevo.", { id: toastId });
    }, 8000);
    try {
      if (idFijoEditando) {
        const { error } = await supabase
          .from("gastos_programados")
          .update({
            concepto: fijoConcepto.trim(),
            monto: montoLimpio,
            dia_recurrencia: parseInt(fijoDiaRecurrencia),
            categoria: fijoCategoria,
            para_quien: fijoParaQuien
          })
          .eq("id", idFijoEditando);
        clearTimeout(timeoutId);
        if (error) throw error;
        toast.success("¡Gasto fijo ajustado! 📈", { id: toastId });
      } else {
        const { error } = await supabase
          .from("gastos_programados")
          .insert([{
            espacio_id: datosHogar.espacio_id,
            usuario_id: usuarioActual.id,
            concepto: fijoConcepto.trim(),
            monto: montoLimpio,
            moneda: fijoMoneda,
            dia_recurrencia: parseInt(fijoDiaRecurrencia),
            categoria: fijoCategoria,
            para_quien: fijoParaQuien
          }]);
        clearTimeout(timeoutId);
        if (error) throw error;
        toast.success("¡Gasto fijo programado! 📅", { id: toastId });
      }
      setMostrarModalFijo(false);
      resetFormFijo();
      cargarGastosProgramados();
    } catch (err) {
      clearTimeout(timeoutId);
      toast.error(err.message, { id: toastId });
    } finally {
      setGuardando(false);
    }
  };

  const eliminarGastoFijo = async (id, concepto) => {
    if (window.confirm(`¿Eliminar la programación del gasto "${concepto}"?`)) {
      try {
        const { error } = await supabase.from("gastos_programados").delete().eq("id", id);
        if (error) throw error;
        toast.success("Programación eliminada");
        cargarGastosProgramados();
      } catch (e) {
        toast.error("Error al eliminar");
      }
    }
  };

  const abrirEdicionFijo = (f) => {
    setIdFijoEditando(f.id);
    setFijoConcepto(f.concepto);
    setFijoMontoFormateado(formatarInput(f.monto));
    setFijoMoneda(f.moneda);
    setFijoDiaRecurrencia(f.dia_recurrencia.toString());
    setFijoCategoria(f.categoria);
    setFijoParaQuien(f.para_quien);
    setMostrarModalFijo(true);
  };

  const resetFormFijo = () => {
    setIdFijoEditando(null);
    setFijoConcepto('');
    setFijoMontoFormateado('');
    setFijoDiaRecurrencia('5');
    setFijoCategoria('Casa');
    setFijoParaQuien('Ambos');
  };

  const abrirPagoFijo = (f) => {
    setGastoFijoAPagar(f);
    setPagarMontoFormateado(f.monto > 0 ? formatarInput(f.monto) : '');
    setPagarMoneda(f.moneda);
    setPagarPagadorId(usuarioActual?.id || '');
    setPagarParaQuien(f.para_quien);
    setMostrarModalPagarFijo(true);
  };

  const registrarPagoGastoFijo = async (e) => {
    e.preventDefault();
    const montoLimpio = desformatearInput(pagarMontoFormateado);
    if (!montoLimpio || !gastoFijoAPagar || !usuarioActual || !datosHogar) return;
    const toastId = toast.loading("Registrando pago de servicio...");
    try {
      const { error } = await supabase.from("gastos").insert([{
        espacio_id: datosHogar.espacio_id,
        usuario_id: usuarioActual.id,
        pagador_id: pagarPagadorId,
        concepto: `[FIJO] ${gastoFijoAPagar.concepto}`,
        monto: montoLimpio,
        moneda: pagarMoneda,
        categoria: gastoFijoAPagar.categoria,
        para_quien: pagarParaQuien
      }]);
      if (error) throw error;
      toast.success("¡Pago registrado y guardado! 💸", { id: toastId });
      setMostrarModalPagarFijo(false);
      setGastoFijoAPagar(null);
      obtenerDatos();
    } catch (err) {
      toast.error(err.message, { id: toastId });
    }
  };

  const verificarSiFuePagadoEsteMes = (fijo) => {
    return gastos?.some(g => 
      g.concepto === `[FIJO] ${fijo.concepto}` && 
      new Date(g.fecha || g.created_at).getMonth() === new Date().getMonth() &&
      new Date(g.fecha || g.created_at).getFullYear() === new Date().getFullYear()
    );
  };

  useEffect(() => {
    if (mostrarModal) {
      setMonedaDeuda(monedaGlobal);
      if (tipoDeuda === 'tarjeta_credito') setCantidadCuotas(1);
    }
  }, [mostrarModal, monedaGlobal, tipoDeuda]);

  const projectedHealth = () => {
    const montoTotalNum = desformatearInput(montoTotalFormateado);
    if (!montoTotalNum || !saludFinanciera.ingresos) return saludFinanciera.indice;
    const cuotaNueva = montoTotalNum / (parseInt(cantidadCuotas) || 1);
    const impact = alcanceDeuda === 'individual' ? cuotaNueva : cuotaNueva * 0.5;
    const cargaNueva = saludFinanciera.carga + impact;
    return (cargaNueva / saludFinanciera.ingresos) * 100;
  };

  const proyectado = projectedHealth();
  const zonaPeligro = proyectado > 40;

  function ajustarDiaHabil(fecha) {
    const d = fecha.getDay();
    const nf = new Date(fecha);
    if (d === 0) nf.setDate(nf.getDate() + 1);
    else if (d === 6) nf.setDate(nf.getDate() + 2);
    return nf;
  }

  const resetForm = () => {
    setTitulo(''); setNroTarjeta(''); setMontoTotalFormateado(''); setLineaCreditoFormateada(''); setPagoMinimoFormateado(''); setCantidadCuotas(1); setCuotasPagadas(0);
    setTipoDeuda("fija"); setAlcanceDeuda("familiar"); setDiaVencimiento("5"); setFechaCierreTarjeta("25");
  };

  async function guardarDeudaPro(e) {
    e.preventDefault();
    if (!usuarioActual || !datosHogar) return;
    setGuardando(true);
    const toastId = toast.loading("Registrando compromiso financiero...");

    try {
      const eid = datosHogar.espacio_id;
      const numCuotas = parseInt(cantidadCuotas) || 1;
      const yaPagadas = parseInt(cuotasPagadas) || 0;
      const totalMonto = desformatearInput(montoTotalFormateado);
      const lineaTotal = desformatearInput(lineaCreditoFormateada);
      const montoCuota = totalMonto / numCuotas;

      const { data: maestra, error: errM } = await supabase
        .from("deudas_maestras")
        .insert([{
          espacio_id: eid, creador_id: usuarioActual.id, titulo: titulo.trim(), tipo: tipoDeuda,
          alcance: alcanceDeuda, permite_pago_parcial: tipoDeuda !== 'fija', moneda: monedaDeuda,
          linea_credito_total: lineaTotal || 0,
          linea_credito_disponible: (lineaTotal || 0) - (tipoDeuda === 'tarjeta_credito' ? totalMonto : 0),
          fecha_cierre_tarjeta: tipoDeuda === 'tarjeta_credito' ? parseInt(fechaCierreTarjeta) : null,
          nro_tarjeta: tipoDeuda === 'tarjeta_credito' ? nroTarjeta.trim() : null,
          estado: yaPagadas >= numCuotas ? 'cerrada' : 'activa'
        }])
        .select().single();

      if (errM) throw errM;

      const cuotas = [];
      const fechaBase = new Date();
      for (let i = 1; i <= numCuotas; i++) {
        let fv = new Date(fechaBase.getFullYear(), fechaBase.getMonth() + (i - 1), parseInt(diaVencimiento));
        fv = ajustarDiaHabil(fv);
        
        const esPagada = i <= yaPagadas;

        cuotas.push({
          deuda_maestra_id: maestra.id, espacio_id: eid, numero_cuota: i, monto_cuota: montoCuota,
          monto_abonado: esPagada ? montoCuota : 0,
          pago_minimo: i === 1 ? (desformatearInput(pagoMinimoFormateado) || 0) : 0,
          fecha_vencimiento: fv.toISOString().split('T')[0], 
          estado: esPagada ? 'pagado' : 'pendiente',
          fecha_pago: esPagada ? new Date().toISOString() : null,
          pagador_id: esPagada ? usuarioActual.id : null
        });
      }

      await supabase.from("cuotas_detalle").insert(cuotas);
      toast.success("¡Deuda Pro registrada con éxito! 📝", { id: toastId });
      setMostrarModal(false); obtenerDatos(); resetForm();
    } catch (err) { toast.error("Error: " + err.message, { id: toastId }); }
    finally { setGuardando(false); }
  }

  async function procesarAbono(montoAbono, monedaAbono, tasaManual) {
    if (!pagoSeleccionado) return;
    const { cuota, maestra } = pagoSeleccionado;
    const toastId = toast.loading("Procesando pago...");
    try {
      let mMonedaDeuda = montoAbono;
      if (monedaAbono !== maestra.moneda) {
        if (!tasaManual) throw new Error("Debes ingresar la cotización manual");
        mMonedaDeuda = montoAbono * parseFloat(tasaManual);
      }
      const nAbonoTotal = Number(cuota.monto_abonado) + mMonedaDeuda;
      const estaPagado = nAbonoTotal >= cuota.monto_cuota;
      await supabase.from("cuotas_detalle").update({
        monto_abonado: nAbonoTotal, estado: estaPagado ? 'pagado' : 'pendiente',
        fecha_pago: new Date().toISOString(), pagador_id: usuarioActual.id
      }).eq("id", cuota.id);
      if (maestra.tipo === 'tarjeta_credito') {
        await supabase.from("deudas_maestras").update({ 
          linea_credito_disponible: Number(maestra.linea_credito_disponible) + mMonedaDeuda 
        }).eq("id", maestra.id);
      }
      await supabase.from("gastos").insert([{
        concepto: `Pago Deuda: ${maestra.titulo}`, monto: montoAbono, categoria: "Pago Tarjeta de Crédito",
        usuario_id: usuarioActual.id, pagador_id: usuarioActual.id, para_quien: "Ambos", moneda: monedaAbono, espacio_id: datosHogar.espacio_id
      }]);
      const { data: check } = await supabase.from('cuotas_detalle').select('estado').eq('deuda_maestra_id', maestra.id);
      if (check.every(c => c.estado === 'pagado')) {
        await supabase.from('deudas_maestras').update({ estado: 'cerrada' }).eq('id', maestra.id);
      }
      toast.success("Pago registrado!", { id: toastId });
      setMostrarModalPago(false); setPagoSeleccionado(null); obtenerDatos();
    } catch (err) { toast.error(err.message, { id: toastId }); }
  }

  async function eliminarDeuda(maestra) {
    if (window.confirm(`¿Borrar "${maestra.titulo}"?`)) {
      await supabase.from('deudas_maestras').delete().eq('id', maestra.id);
      toast.success("Eliminada"); obtenerDatos();
    }
  }

  function ModalAbono() {
    const [mFormateado, setMFormateado] = useState('');
    const [mon, setMon] = useState(monedaGlobal);
    const [t, setT] = useState('');
    if (!pagoSeleccionado) return null;
    const { cuota, maestra } = pagoSeleccionado;
    const reqT = mon !== maestra.moneda;
    return (
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm glass-panel p-6 rounded-3xl border border-white/10 shadow-2xl">
          <h3 className="text-white font-bold text-lg mb-2">Abonar a {maestra.titulo}</h3>
          <div className="space-y-4">
            <input type="text" value={mFormateado} onChange={(e) => setMFormateado(formatarInput(e.target.value))} className="w-full bg-slate-900 border border-white/10 rounded-2xl px-4 py-4 text-2xl font-black text-white outline-none" placeholder="0" />
            <div className="grid grid-cols-3 gap-2">
              {['PYG', 'BRL', 'USD'].map(m => <button key={m} onClick={() => setMon(m)} className={`py-2 rounded-xl text-xs font-black border ${mon === m ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-white/5 border-white/10 text-slate-500'}`}>{m}</button>)}
            </div>
            {reqT && <input type="number" step="0.0001" value={t} onChange={(e) => setT(e.target.value)} className="w-full bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 text-white font-bold" placeholder="Cotización aplicada" />}
            <div className="flex gap-2 pt-4">
              <button onClick={() => setMostrarModalPago(false)} className="flex-1 py-4 bg-white/5 text-slate-400 font-bold rounded-2xl">CANCELAR</button>
              <button onClick={() => procesarAbono(desformatearInput(mFormateado), mon, t)} disabled={!mFormateado || (reqT && !t)} className="flex-[2] py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-lg shadow-indigo-600/30">PAGAR</button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  const deudasFiltradas = deudas?.filter(d => pestana === 'activas' ? d.estado === 'activa' : d.estado === 'cerrada') || [];

  return (
    <div className="space-y-6 pb-20">
      <header className="flex items-center justify-between">
        <div className="flex bg-white/5 p-1 rounded-xl border border-white/5 backdrop-blur-md">
          {['activas', 'archivadas', 'fijos'].map(p => (
            <button 
              key={p} 
              onClick={() => setPestana(p)} 
              className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${pestana === p ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}
            >
              {p === 'fijos' ? 'Fijos' : p}
            </button>
          ))}
        </div>
        <button 
          onClick={() => {
            if (pestana === 'fijos') {
              resetFormFijo();
              setMostrarModalFijo(true);
            } else {
              setMostrarModal(true);
            }
          }} 
          className="p-2 bg-indigo-600 rounded-xl text-white shadow-lg"
        >
          <Plus size={24} />
        </button>
      </header>

      <div className="space-y-4">
        {pestana !== 'fijos' ? (
          deudasFiltradas.map((d) => {
          const cuotaActual = d.cuotas_detalle?.filter(c => c.estado === 'pendiente').sort((a, b) => new Date(a.fecha_vencimiento) - new Date(b.fecha_vencimiento))[0];
          const estaExpandida = deudaExpandida === d.id;
          const esMia = d.creador_id === usuarioActual?.id;
          const totalPagado = d.cuotas_detalle?.reduce((acc, c) => acc + Number(c.monto_abonado), 0) || 0;
          const totalMontoDeuda = d.cuotas_detalle?.reduce((acc, c) => acc + Number(c.monto_cuota), 0) || 0;
          const porcProgreso = totalMontoDeuda > 0 ? (totalPagado / totalMontoDeuda) * 100 : 0;

          return (
            <motion.div key={d.id} layout className={`glass-card border-l-4 ${pestana === 'activas' ? 'border-l-indigo-500' : 'border-l-slate-600 opacity-80'}`}>
              <div className="flex justify-between items-start mb-4">
                <div onClick={() => setDeudaExpandida(estaExpandida ? null : d.id)} className="cursor-pointer">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-white text-lg">{d.titulo}</h4>
                    {d.alcance === 'individual' ? (
                      <div className="flex items-center gap-1 bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded-md text-[8px] font-black uppercase border border-amber-500/20"><Lock size={10}/> {esMia ? 'Mía' : `De ${otroUsuario?.nombre || 'Pareja'}`}</div>
                    ) : (
                      <div className="flex items-center gap-1 bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-md text-[8px] font-black uppercase border border-indigo-500/20"><Users size={10}/> Familiar</div>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 uppercase font-black tracking-tighter">{d.tipo} {d.nro_tarjeta && `• Term. ${d.nro_tarjeta}`} • {d.alcance}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {cuotaActual && <div className="bg-red-500/10 text-red-400 text-[9px] font-black px-2 py-1 rounded-md border border-red-500/20">VENCE {new Date(cuotaActual.fecha_vencimiento).toLocaleDateString()}</div>}
                  {(esMia || datosHogar.rol === 'superadmin' || datosHogar.rol === 'admin_hogar') && <button onClick={() => eliminarDeuda(d)} className="p-1.5 text-slate-600 hover:text-red-400 rounded-lg"><Trash2 size={14} /></button>}
                </div>
              </div>

              {d.tipo === 'tarjeta_credito' ? (
                <div className="p-3 bg-white/5 rounded-2xl mb-4 grid grid-cols-2 gap-4">
                  <div><div className="text-[9px] text-slate-500 uppercase font-bold">Disponible</div><div className="text-lg font-black text-indigo-400">{formatearNumero(d.linea_credito_disponible, d.moneda)}</div></div>
                  <div className="text-right"><div className="text-[9px] text-slate-500 uppercase font-bold">Línea Total</div><div className="text-sm font-bold text-slate-300">{formatearNumero(d.linea_credito_total, d.moneda)}</div></div>
                </div>
              ) : (
                <div className="mb-4">
                  <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase mb-1"><span>Progreso</span><span>{porcProgreso.toFixed(0)}%</span></div>
                  <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden"><div style={{ width: `${porcProgreso}%` }} className="h-full bg-indigo-500" /></div>
                </div>
              )}

              <div className="flex justify-between items-end">
                <div><div className="text-[10px] text-slate-500 uppercase font-bold mb-1">{pestana === 'activas' ? 'Cuota Actual' : 'Total'}</div><div className="text-2xl font-black text-white">{formatearNumero(cuotaActual ? (cuotaActual.monto_cuota - cuotaActual.monto_abonado) : totalPagado, d.moneda)}</div></div>
                {pestana === 'activas' && cuotaActual && (d.alcance === 'familiar' || esMia) && <button onClick={() => { setPagoSeleccionado({ cuota: cuotaActual, maestra: d }); setMostrarModalPago(true); }} className="bg-indigo-600 text-white text-xs font-black px-6 py-3 rounded-xl shadow-lg">ABONAR</button>}
              </div>

              {estaExpandida && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-6 pt-6 border-t border-white/5 space-y-4">
                  <div className="space-y-1">
                    {d.cuotas_detalle?.sort((a,b)=>a.numero_cuota-b.numero_cuota).map(c => (
                      <div key={c.id} className="flex justify-between text-[10px] bg-white/5 p-2 rounded-xl">
                        <span className={c.estado==='pagado'?'text-emerald-400':'text-slate-400'}>Cuota {c.numero_cuota}</span>
                        <span className="text-white font-bold">{formatearNumero(c.monto_cuota, d.moneda)}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </motion.div>
          );
        })
        ) : (
          /* GASTOS FIJOS */
          cargandoFijos ? (
            <div className="text-center py-12 text-slate-500 text-xs font-black uppercase flex items-center justify-center gap-2">
              <Loader2 className="animate-spin" size={16}/> Cargando compromisos fijos...
            </div>
          ) : gastosProgramados.length === 0 ? (
            <div className="glass-card py-12 text-center">
              <Calendar size={40} className="mx-auto mb-3 text-slate-500 opacity-40" />
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Sin gastos fijos programados</p>
              <p className="text-[10px] text-slate-500 mt-2 max-w-xs mx-auto px-4">
                Registrá tus servicios indispensables (agua, luz, internet) para tenerlos siempre a mano y simplificar tu control mensual.
              </p>
              <div className="flex flex-col gap-2 mt-6 max-w-xs mx-auto px-4">
                <button 
                  onClick={preCargarPlantillas} 
                  className="py-3 px-4 bg-indigo-600 text-white text-[10px] font-black rounded-xl uppercase hover:bg-indigo-500 active:scale-95 transition-all shadow-lg"
                >
                  Pre-cargar Plantilla de Supervivencia 🏠
                </button>
                <button 
                  onClick={() => { resetFormFijo(); setMostrarModalFijo(true); }} 
                  className="py-3 px-4 bg-white/5 border border-white/10 text-white text-[10px] font-black rounded-xl uppercase hover:bg-white/10 active:scale-95 transition-all"
                >
                  Agregar Gasto Fijo Manual
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                  Servicios y Compras Recurrentes ({gastosProgramados.length})
                </span>
                <button 
                  onClick={preCargarPlantillas} 
                  className="text-[9px] font-black text-indigo-400 uppercase tracking-tighter hover:underline"
                >
                  + Recargar Plantilla Básica
                </button>
              </div>

              {gastosProgramados.map((f) => {
                const pagado = verificarSiFuePagadoEsteMes(f);
                return (
                  <div 
                    key={f.id} 
                    className={`glass-card border-l-4 transition-all duration-300 ${
                      pagado ? 'border-l-emerald-500 bg-emerald-500/[0.02] opacity-75' : 'border-l-indigo-500 bg-white/[0.01]'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-white text-sm uppercase">{f.concepto}</h4>
                          {pagado && (
                            <span className="bg-emerald-500/20 text-emerald-400 text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase border border-emerald-500/20">
                              PAGADO ESTE MES
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500 font-bold uppercase mt-1 tracking-tighter">
                          Categoría: {f.categoria} • Vence el: {f.dia_recurrencia} de cada mes • {f.para_quien === 'Ambos' ? 'Familia' : `Para: ${f.para_quien}`}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <button 
                          onClick={() => abrirEdicionFijo(f)} 
                          className="p-1.5 text-slate-500 hover:text-indigo-400 transition-colors"
                          disabled={pagado}
                        >
                          <Edit2 size={15}/>
                        </button>
                        <button 
                          onClick={() => eliminarGastoFijo(f.id, f.concepto)} 
                          className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={15}/>
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="text-xl font-black text-white">
                        {f.monto > 0 ? formatearNumero(f.monto, f.moneda) : 'Monto Variable 📊'}
                      </div>
                      
                      {!pagado ? (
                        <button 
                          onClick={() => abrirPagoFijo(f)} 
                          className="px-4 py-2 bg-indigo-600 text-white text-[10px] font-black rounded-xl flex items-center gap-2 active:scale-95 transition-all shadow-lg hover:bg-indigo-500"
                        >
                          <CheckCircle size={14}/> COBRAR / REGISTRAR
                        </button>
                      ) : (
                        <div className="text-[9px] font-black text-emerald-400 flex items-center gap-1">
                          <CheckCircle size={12}/> ABONADO EN EL MES
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>

      <AnimatePresence>
        {mostrarModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-lg glass-panel p-6 rounded-3xl relative max-h-[90vh] overflow-y-auto">
              <button onClick={() => setMostrarModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X size={24} /></button>
              <h2 className="text-xl font-black text-white mb-6 uppercase">Nuevo Compromiso Pro</h2>
              <form onSubmit={guardarDeudaPro} className="space-y-5">
                <div className="flex p-1 bg-white/5 rounded-2xl border border-white/5">
                  {['familiar', 'individual'].map(a => <button key={a} type="button" onClick={() => setAlcanceDeuda(a)} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${alcanceDeuda === a ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}>{a}</button>)}
                </div>
                <div className="flex p-1 bg-white/5 rounded-2xl border border-white/5">
                  {['fija', 'flexible', 'tarjeta_credito'].map(t => <button key={t} type="button" onClick={() => setTipoDeuda(t)} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${tipoDeuda === t ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}>{t.replace('_', ' ')}</button>)}
                </div>
                
                <div className="space-y-1">
                   <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Descripción / Entidad</label>
                   <input type="text" placeholder="Ej: Préstamo Banco Itaú" value={titulo} onChange={(e) => setTitulo(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-xl px-5 py-4 text-white outline-none focus:border-indigo-500/50" required />
                </div>

                {tipoDeuda === 'tarjeta_credito' && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-indigo-400 uppercase ml-1 flex items-center gap-1"><Hash size={12}/> Últimos 4 dígitos de la Tarjeta</label>
                    <input type="text" maxLength="4" placeholder="Ej: 1234" value={nroTarjeta} onChange={(e) => setNroTarjeta(e.target.value.replace(/\D/g,''))} className="w-full bg-slate-900 border border-white/10 rounded-xl px-5 py-4 text-white font-black tracking-widest outline-none focus:border-indigo-500/50" />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">{tipoDeuda === 'tarjeta_credito' ? 'Deuda Actual' : 'Monto Total'}</label>
                    <input type="text" value={montoTotalFormateado} onChange={(e) => setMontoTotalFormateado(formatarInput(e.target.value))} className="w-full bg-slate-900 border border-white/10 rounded-2xl px-5 py-4 text-white outline-none focus:border-indigo-500/50" placeholder="0" required />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Moneda</label>
                    <select value={monedaDeuda} onChange={(e) => setMonedaDeuda(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-2xl px-5 py-4 text-white outline-none"><option value="PYG">PYG</option><option value="BRL">BRL</option></select>
                  </div>
                </div>

                {tipoDeuda === 'tarjeta_credito' ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Pago Mínimo</label>
                      <input type="text" value={pagoMinimoFormateado} onChange={(e) => setPagoMinimoFormateado(formatarInput(e.target.value))} className="w-full bg-slate-900 border border-white/10 rounded-2xl px-5 py-4 text-white outline-none" placeholder="0" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Línea Crédito</label>
                      <input type="text" value={lineaCreditoFormateada} onChange={(e) => setLineaCreditoFormateada(formatarInput(e.target.value))} className="w-full bg-slate-900 border border-white/10 rounded-2xl px-5 py-4 text-white outline-none" placeholder="0" />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Cuotas Totales</label>
                      <input type="number" min="1" value={cantidadCuotas} onChange={(e) => setCantidadCuotas(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-xl px-5 py-4 text-white outline-none" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Cuotas ya Pagadas</label>
                      <input type="number" min="0" max={cantidadCuotas} value={cuotasPagadas} onChange={(e) => setCuotasPagadas(e.target.value)} className="w-full bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-5 py-4 text-white outline-none" />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Día Vencimiento</label>
                    <input type="number" min="1" max="31" value={diaVencimiento} onChange={(e) => setDiaVencimiento(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-xl px-5 py-4 text-white outline-none" />
                  </div>
                  {tipoDeuda === 'tarjeta_credito' && (
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Día Cierre</label>
                      <input type="number" min="1" max="31" value={fechaCierreTarjeta} onChange={(e) => setFechaCierreTarjeta(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-xl px-5 py-4 text-white outline-none" />
                    </div>
                  )}
                </div>

                {zonaPeligro && <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex gap-4"><AlertTriangle className="text-red-500 shrink-0" /><p className="text-[11px] text-red-200 font-bold">🚨 ¡Índice al {proyectado.toFixed(1)}%! Superás el límite saludable del BCP.</p></div>}
                <button type="submit" disabled={guardando} className={`w-full py-5 font-black uppercase rounded-2xl shadow-xl transition-all ${zonaPeligro ? 'bg-red-600' : 'bg-indigo-600'} text-white`}>{guardando ? <Loader2 className="animate-spin mx-auto" /> : "REGISTRAR DEUDA"}</button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>{mostrarModalPago && <ModalAbono />}</AnimatePresence>
      <AnimatePresence>{sugerenciaIA && <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"><motion.div className="w-full max-w-sm glass-panel p-8 rounded-3xl text-center"><Sparkles className="text-indigo-400 mx-auto mb-4" size={48}/><p className="text-slate-300 italic mb-8">"{sugerenciaIA}"</p><button onClick={() => setSugerenciaIA(null)} className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl uppercase">ENTENDIDO</button></motion.div></div>}</AnimatePresence>

      {/* MODAL CREAR/EDITAR GASTO FIJO */}
      <AnimatePresence>
        {mostrarModalFijo && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-sm glass-panel p-6 rounded-3xl relative">
              <button onClick={() => { setMostrarModalFijo(false); resetFormFijo(); }} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X size={24} /></button>
              <h2 className="text-xl font-black text-white mb-6 uppercase flex items-center gap-2">
                {idFijoEditando ? 'Ajustar Gasto Fijo' : 'Programar Gasto Fijo'}
              </h2>
              <form onSubmit={guardarGastoFijo} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Concepto / Servicio</label>
                  <input type="text" placeholder="Ej: Luz (ANDE), Agua, Alquiler..." value={fijoConcepto} onChange={(e) => setFijoConcepto(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500/50" required />
                </div>
                
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Monto Estimado (Opcional)</label>
                  <div className="relative">
                    <input 
                      type="text" 
                      value={fijoMontoFormateado} 
                      onChange={(e) => setFijoMontoFormateado(formatarInput(e.target.value))} 
                      className="w-full bg-slate-900 border border-white/10 rounded-2xl px-4 py-4 text-2xl font-black text-indigo-400 outline-none" 
                      placeholder="Variable / Sin monto fijo"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 font-black uppercase text-xs">{fijoMoneda}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Moneda</label>
                    <select value={fijoMoneda} onChange={(e) => setFijoMoneda(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white" disabled={!!idFijoEditando}>
                      <option value="PYG">PYG</option>
                      <option value="BRL">BRL</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Día de Cobro/Venc.</label>
                    <input type="number" min="1" max="31" value={fijoDiaRecurrencia} onChange={(e) => setFijoDiaRecurrencia(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white font-black" required />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Categoría</label>
                    <select value={fijoCategoria} onChange={(e) => setFijoCategoria(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white">
                      {["Casa", "Supermercado", "Salud", "Transporte", "Otros"].map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Alcance</label>
                    <select value={fijoParaQuien} onChange={(e) => setFijoParaQuien(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white">
                      <option value="Ambos">Ambos (Familiar)</option>
                      <option value="Yo">Solo Yo</option>
                      <option value="Pareja">Pareja</option>
                    </select>
                  </div>
                </div>

                <button type="submit" disabled={guardando} className="w-full py-4 font-black rounded-2xl bg-indigo-600 text-white shadow-xl shadow-indigo-900/20 active:scale-95 transition-all mt-4">
                  {guardando ? <Loader2 className="animate-spin mx-auto" /> : "PROGRAMAR GASTO"}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL REGISTRAR PAGO DE GASTO FIJO */}
      <AnimatePresence>
        {mostrarModalPagarFijo && gastoFijoAPagar && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-sm glass-panel p-6 rounded-3xl relative">
              <button onClick={() => { setMostrarModalPagarFijo(false); setGastoFijoAPagar(null); }} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X size={24} /></button>
              <h2 className="text-xl font-black text-white mb-2 uppercase flex items-center gap-2">
                Pagar Servicio 💸
              </h2>
              <p className="text-[11px] text-slate-400 mb-4">{gastoFijoAPagar.concepto}</p>
              <form onSubmit={registrarPagoGastoFijo} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Monto Real a Pagar (Factura)</label>
                  <div className="relative">
                    <input 
                      type="text" 
                      value={pagarMontoFormateado} 
                      onChange={(e) => setPagarMontoFormateado(formatarInput(e.target.value))} 
                      className="w-full bg-slate-900 border border-white/10 rounded-2xl px-4 py-4 text-2xl font-black text-emerald-400 outline-none" 
                      placeholder="0"
                      required 
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 font-black uppercase text-xs">{pagarMoneda}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Moneda</label>
                    <select value={pagarMoneda} onChange={(e) => setPagarMoneda(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white">
                      <option value="PYG">PYG</option>
                      <option value="BRL">BRL</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Quién Pagó</label>
                    <select value={pagarPagadorId} onChange={(e) => setPagarPagadorId(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white">
                      <option value={usuarioActual?.id}>{usuarioActual?.nombre} (Yo)</option>
                      {otroUsuario && <option value={otroUsuario.id}>{otroUsuario.nombre}</option>}
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Alcance del Gasto</label>
                  <select value={pagarParaQuien} onChange={(e) => setPagarParaQuien(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white">
                    <option value="Ambos">Ambos (Compartido 50/50)</option>
                    <option value="Yo">Solo Yo</option>
                    <option value="Pareja">Pareja</option>
                  </select>
                </div>

                <button type="submit" className="w-full py-4 font-black rounded-2xl bg-emerald-600 text-white shadow-xl shadow-emerald-950/30 active:scale-95 transition-all mt-4">
                  CONFIRMAR PAGO
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
