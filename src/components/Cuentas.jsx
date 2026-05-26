import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { toast } from 'react-hot-toast';
import { formatearNumero } from '../utils/formatters';
import { motion, AnimatePresence } from "framer-motion";
import { 
  CreditCard, Plus, CheckCircle, X, Loader2, Sparkles, 
  Lock, Users, Send, Archive, AlertTriangle, ChevronDown, ChevronUp, Calendar
} from 'lucide-react';

export default function Cuentas({
  usuarioActual,
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
  const [montoTotal, setMontoTotal] = useState('');
  const [lineaCredito, setLineaCredito] = useState('');
  const [pagoMinimo, setPagoMinimo] = useState('');
  const [cantidadCuotas, setCantidadCuotas] = useState(1);
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

  // Sync initial currency
  useEffect(() => {
    if (mostrarModal) {
      setMonedaDeuda(monedaGlobal);
      if (tipoDeuda === 'tarjeta_credito') setCantidadCuotas(1);
    }
  }, [mostrarModal, monedaGlobal, tipoDeuda]);

  // HU-10: Real-time Health Check (BCP 40% Rule)
  const projectedHealth = () => {
    if (!montoTotal || !saludFinanciera.ingresos) return saludFinanciera.indice;
    const cuotaNueva = parseFloat(montoTotal) / (parseInt(cantidadCuotas) || 1);
    const impact = alcanceDeuda === 'individual' ? cuotaNueva : cuotaNueva * 0.5;
    const cargaNueva = saludFinanciera.carga + impact;
    return (cargaNueva / saludFinanciera.ingresos) * 100;
  };

  const proyectado = projectedHealth();
  const zonaPeligro = proyectado > 40;

  // HU-03: Business Day Adjustment (No Sat/Sun)
  function ajustarDiaHabil(fecha) {
    const d = fecha.getDay(); // 0: Sun, 6: Sat
    const nf = new Date(fecha);
    if (d === 0) nf.setDate(nf.getDate() + 1); // Sun -> Mon
    else if (d === 6) nf.setDate(nf.getDate() + 2); // Sat -> Mon
    return nf;
  }

  const resetForm = () => {
    setTitulo(''); setMontoTotal(''); setLineaCredito(''); setPagoMinimo(''); setCantidadCuotas(1); 
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
      const totalMonto = parseFloat(montoTotal);
      const montoCuota = totalMonto / numCuotas;

      // 1. Create Master Debt
      const { data: maestra, error: errM } = await supabase
        .from("deudas_maestras")
        .insert([{
          espacio_id: eid,
          creador_id: usuarioActual.id,
          titulo: titulo.trim(),
          tipo: tipoDeuda,
          alcance: alcanceDeuda,
          permite_pago_parcial: tipoDeuda !== 'fija',
          moneda: monedaDeuda,
          linea_credito_total: parseFloat(lineaCredito) || 0,
          linea_credito_disponible: (parseFloat(lineaCredito) || 0) - (tipoDeuda === 'tarjeta_credito' ? totalMonto : 0),
          fecha_cierre_tarjeta: tipoDeuda === 'tarjeta_credito' ? parseInt(fechaCierreTarjeta) : null
        }])
        .select()
        .single();

      if (errM) throw errM;

      // 2. Generate Installments (HU-03 skipping weekends)
      const cuotas = [];
      const fechaBase = new Date();
      
      for (let i = 1; i <= numCuotas; i++) {
        let fv = new Date(fechaBase.getFullYear(), fechaBase.getMonth() + (i - 1), parseInt(diaVencimiento));
        fv = ajustarDiaHabil(fv);
        
        cuotas.push({
          deuda_maestra_id: maestra.id,
          espacio_id: eid,
          numero_cuota: i,
          monto_cuota: montoCuota,
          pago_minimo: i === 1 ? (parseFloat(pagoMinimo) || 0) : 0,
          fecha_vencimiento: fv.toISOString().split('T')[0],
          estado: 'pendiente'
        });
      }

      const { error: errC } = await supabase.from("cuotas_detalle").insert(cuotas);
      if (errC) throw errC;

      toast.success("¡Deuda Pro registrada con éxito! 📝", { id: toastId });
      setMostrarModal(false);
      obtenerDatos();
      resetForm();
    } catch (err) {
      toast.error("Error: " + err.message, { id: toastId });
    } finally {
      setGuardando(false);
    }
  }

  async function procesarAbono(montoAbono, monedaAbono, tasaManual) {
    if (!pagoSeleccionado) return;
    const { cuota, maestra } = pagoSeleccionado;
    const toastId = toast.loading("Procesando pago...");

    try {
      // 1. Manual Currency Conversion (HU-02)
      let montoEnMonedaDeuda = montoAbono;
      if (monedaAbono !== maestra.moneda) {
        if (!tasaManual || isNaN(parseFloat(tasaManual))) throw new Error("Debes ingresar la cotización manual");
        montoEnMonedaDeuda = montoAbono * parseFloat(tasaManual);
      }

      const nuevoAbonoTotal = Number(cuota.monto_abonado) + montoEnMonedaDeuda;
      const estaPagado = nuevoAbonoTotal >= cuota.monto_cuota;

      // 2. Update Installment
      const { error: errC } = await supabase
        .from("cuotas_detalle")
        .update({
          monto_abonado: nuevoAbonoTotal,
          estado: estaPagado ? 'pagado' : 'pendiente',
          fecha_pago: new Date().toISOString(),
          pagador_id: usuarioActual.id
        })
        .eq("id", cuota.id);

      if (errC) throw errC;

      // 3. Update Credit Card Line (HU-01)
      if (maestra.tipo === 'tarjeta_credito') {
        await supabase
          .from("deudas_maestras")
          .update({ linea_credito_disponible: Number(maestra.linea_credito_disponible) + montoEnMonedaDeuda })
          .eq("id", maestra.id);
      }

      // 4. Double Entry: Auto Expense (HU-01)
      await supabase.from("gastos").insert([{
        concepto: `Pago Deuda: ${maestra.titulo} ${maestra.tipo === 'tarjeta_credito' ? '(TC)' : ''}`,
        monto: montoAbono,
        categoria: "Pago Tarjeta de Crédito",
        usuario_id: usuarioActual.id,
        pagador_id: usuarioActual.id,
        para_quien: "Ambos",
        moneda: monedaAbono,
        espacio_id: datosHogar.espacio_id
      }]);

      // 5. Intelligent Closing (HU-06)
      const { data: check } = await supabase.from('cuotas_detalle').select('estado').eq('deuda_maestra_id', maestra.id);
      if (check.every(c => c.estado === 'pagado')) {
        await supabase.from('deudas_maestras').update({ estado: 'cerrada' }).eq('id', maestra.id);
        toast.success("¡Felicidades! Deuda saldada y archivada. 🏆");
      }

      toast.success("Pago registrado con éxito! 💸", { id: toastId });
      setMostrarModalPago(false);
      setPagoSeleccionado(null);
      obtenerDatos();
    } catch (err) {
      toast.error(err.message, { id: toastId });
    }
  }

  async function cerrarManualmente(maestra) {
    if (window.confirm("¿Seguro que querés cerrar esta deuda? Si aún hay saldo, se considerará perdonado/liquidado.")) {
      const toastId = toast.loading("Archivando...");
      try {
        await supabase.from('deudas_maestras').update({ estado: 'cerrada' }).eq('id', maestra.id);
        await supabase.from('cuotas_detalle').update({ estado: 'pagado' }).eq('deuda_maestra_id', maestra.id);
        toast.success("Deuda movida al historial de archivadas.", { id: toastId });
        obtenerDatos();
      } catch (e) { toast.error("Error al archivar"); }
    }
  }

  async function solicitarAyuda(maestra, cuota) {
    const monto = cuota.monto_cuota - cuota.monto_abonado;
    const toastId = toast.loading("Enviando SOS a tu pareja...");
    try {
      const { data: pareja } = await supabase.from('perfiles').select('id').eq('espacio_id', datosHogar.espacio_id).neq('id', usuarioActual.id).single();
      if (!pareja) throw new Error("No se encontró a tu pareja");

      await supabase.from('notificaciones').insert([{
        espacio_id: datosHogar.espacio_id,
        usuario_id: pareja.id,
        titulo: "🆘 Pedido de Ayuda",
        mensaje: `${usuarioActual.nombre} te pide una mano para pagar ${formatearNumero(monto, maestra.moneda)} de su deuda "${maestra.titulo}".`,
        tipo: "alerta",
        metadata: {
          tipo: "solicitud_ayuda",
          deuda_id: maestra.id,
          cuota_id: cuota.id,
          monto: monto,
          moneda: maestra.moneda,
          solicitante_id: usuarioActual.id
        }
      }]);
      toast.success("¡SOS enviado! Esperemos que tenga saldo... 😂", { id: toastId });
    } catch (e) { toast.error(e.message); }
  }

  async function pedirConsejoIA(maestra, cuota) {
    if (analizandoIA) return;
    setAnalizandoIA(true);
    const toastId = toast.loading("Consultando con el asesor kape...");
    try {
      const { data, error } = await supabase.functions.invoke('chat-ia', {
        body: { 
          mensaje: `Che kape, analizame esta deuda: "${maestra.titulo}". Debo ${formatearNumero(cuota.monto_cuota - cuota.monto_abonado, maestra.moneda)}. Mi índice de endeudamiento es ${saludFinanciera.indice.toFixed(1)}%. ¿Qué me sugerís?`,
          contexto_financiero: { salud: saludFinanciera, deudas }
        }
      });
      if (error) throw error;
      setSugerenciaIA(data.respuesta);
      toast.success("¡Consejo listo! 💡", { id: toastId });
    } catch (e) { toast.error("Hendy la conexión con la IA"); }
    finally { setAnalizandoIA(false); }
  }

  // --- INTERNAL COMPONENTS ---

  function ModalAbono() {
    const [monto, setMonto] = useState('');
    const [moneda, setMoneda] = useState(monedaGlobal);
    const [tasa, setTasa] = useState('');
    if (!pagoSeleccionado) return null;
    const { cuota, maestra } = pagoSeleccionado;
    const pendiente = cuota.monto_cuota - cuota.monto_abonado;
    const requiereTasa = moneda !== maestra.moneda;

    return (
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm glass-panel p-6 rounded-3xl border border-white/10 shadow-2xl">
          <h3 className="text-white font-bold text-lg mb-2">Abonar a {maestra.titulo}</h3>
          <p className="text-slate-400 text-xs mb-6">Monto pendiente: <span className="text-indigo-400 font-black">{formatearNumero(pendiente, maestra.moneda)}</span></p>
          
          <div className="space-y-4">
            <input type="number" value={monto} onChange={(e) => setMonto(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-2xl px-4 py-4 text-2xl font-black text-white outline-none focus:border-indigo-500" placeholder="0" />
            
            <div className="grid grid-cols-3 gap-2">
              {['PYG', 'BRL', 'USD'].map(m => (
                <button key={m} onClick={() => setMoneda(m)} className={`py-2 rounded-xl text-xs font-black border transition-all ${moneda === m ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-white/5 border-white/10 text-slate-500'}`}>{m}</button>
              ))}
            </div>

            {requiereTasa && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-1">
                <label className="text-[10px] font-bold text-amber-400 uppercase ml-1">Cotización aplicada (Manual)</label>
                <input type="number" step="0.0001" value={tasa} onChange={(e) => setTasa(e.target.value)} className="w-full bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 text-white font-bold" placeholder={`1 ${moneda} = ? ${maestra.moneda}`} />
              </motion.div>
            )}

            <div className="flex gap-2 pt-4">
              <button onClick={() => setMostrarModalPago(false)} className="flex-1 py-4 bg-white/5 text-slate-400 font-bold rounded-2xl hover:bg-white/10">CANCELAR</button>
              <button onClick={() => procesarAbono(parseFloat(monto), moneda, tasa)} disabled={!monto || (requiereTasa && !tasa)} className="flex-[2] py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-lg shadow-indigo-600/30">CONFIRMAR PAGO</button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // --- FILTERS ---
  const deudasFiltradas = deudas?.filter(d => pestana === 'activas' ? d.estado === 'activa' : d.estado === 'cerrada') || [];

  return (
    <div className="space-y-6 pb-20">
      <header className="flex items-center justify-between">
        <div className="flex bg-white/5 p-1 rounded-xl border border-white/5 backdrop-blur-md">
          {['activas', 'archivadas'].map(p => (
            <button key={p} onClick={() => setPestana(p)} className={`px-5 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${pestana === p ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}>
              {p}
            </button>
          ))}
        </div>
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setMostrarModal(true)} className="p-2 bg-indigo-600 rounded-xl text-white shadow-lg"><Plus size={24} /></motion.button>
      </header>

      <div className="space-y-4">
        {deudasFiltradas.length === 0 ? (
          <div className="glass-card py-16 text-center opacity-40">
             <Archive size={48} className="mx-auto mb-4 text-slate-600" />
             <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">No hay deudas {pestana}</p>
          </div>
        ) : (
          deudasFiltradas.map((d) => {
            const cuotaActual = d.cuotas_detalle?.filter(c => c.estado === 'pendiente').sort((a, b) => new Date(a.fecha_vencimiento) - new Date(b.fecha_vencimiento))[0];
            const estaExpandida = deudaExpandida === d.id;
            const esMia = d.creador_id === usuarioActual.id;
            
            // MATH FOR PROGRESS BARS
            const totalPagado = d.cuotas_detalle?.reduce((acc, c) => acc + Number(c.monto_abonado), 0) || 0;
            const totalMontoDeuda = d.cuotas_detalle?.reduce((acc, c) => acc + Number(c.monto_cuota), 0) || 0;
            const porcProgreso = totalMontoDeuda > 0 ? (totalPagado / totalMontoDeuda) * 100 : 0;
            const cuotasSaldadas = d.cuotas_detalle?.filter(c => c.estado === 'pagado').length || 0;

            return (
              <motion.div key={d.id} layout className={`glass-card border-l-4 ${pestana === 'activas' ? 'border-l-indigo-500' : 'border-l-slate-600 opacity-80'} relative overflow-hidden group`}>
                {/* Header Card */}
                <div className="flex justify-between items-start mb-4">
                  <div onClick={() => setDeudaExpandida(estaExpandida ? null : d.id)} className="cursor-pointer">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-white text-lg group-hover:text-indigo-400 transition-colors">{d.titulo}</h4>
                      {d.alcance === 'individual' ? <Lock size={12} className="text-amber-400" /> : <Users size={12} className="text-indigo-400" />}
                    </div>
                    <p className="text-[10px] text-slate-500 uppercase font-black tracking-tighter">
                      {d.tipo.replace('_', ' ')} • {d.alcance}
                    </p>
                  </div>
                  {pestana === 'activas' && cuotaActual && (
                    <div className="flex flex-col items-end">
                       <div className="bg-red-500/10 text-red-400 text-[9px] font-black px-2 py-1 rounded-md border border-red-500/20 flex items-center gap-1">
                         <Calendar size={10}/> VENCE {new Date(cuotaActual.fecha_vencimiento).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                       </div>
                    </div>
                  )}
                </div>

                {/* Progress Visuals based on Type */}
                <div className="mb-6">
                  {d.tipo === 'tarjeta_credito' ? (
                    <div className="p-3 bg-white/5 rounded-2xl border border-white/5 grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-[9px] text-slate-500 uppercase font-bold">Línea Disponible</div>
                        <div className="text-lg font-black text-indigo-400">{formatearNumero(d.linea_credito_disponible, d.moneda)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[9px] text-slate-500 uppercase font-bold text-right">Línea Total</div>
                        <div className="text-sm font-bold text-slate-300">{formatearNumero(d.linea_credito_total, d.moneda)}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                       <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase">
                          <span>Progreso de Pago</span>
                          <span>{porcProgreso.toFixed(0)}%</span>
                       </div>
                       <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${porcProgreso}%` }} className={`h-full ${porcProgreso >= 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`} />
                       </div>
                       <div className="flex justify-between text-[9px] font-black text-slate-400">
                          {d.tipo === 'fija' ? <span>Cuotas: {cuotasSaldadas}/{d.cuotas_detalle?.length}</span> : <span>Abonado: {formatearNumero(totalPagado, d.moneda)}</span>}
                          <span>Faltan: {formatearNumero(totalMontoDeuda - totalPagado, d.moneda)}</span>
                       </div>
                    </div>
                  )}
                </div>

                {/* Balance & Actions */}
                <div className="grid grid-cols-2 gap-4 items-end">
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">
                      {pestana === 'activas' ? (d.tipo === 'tarjeta_credito' ? 'Deuda del Mes' : 'Cuota Actual') : 'Total Saldado'}
                    </div>
                    <div className="text-2xl font-black text-white leading-none">
                      {formatearNumero(cuotaActual ? (cuotaActual.monto_cuota - cuotaActual.monto_abonado) : totalPagado, d.moneda)}
                    </div>
                    {cuotaActual?.pago_minimo > 0 && <div className="text-[10px] text-amber-500 font-bold mt-1">MÍNIMO: {formatearNumero(cuotaActual.pago_minimo, d.moneda)}</div>}
                  </div>
                  <div className="flex flex-col gap-2 items-end">
                    {pestana === 'activas' && cuotaActual && (
                      <div className="flex gap-2">
                        {d.alcance === 'individual' && esMia && (
                          <button onClick={() => solicitarAyuda(d, cuotaActual)} title="Pedir ayuda a pareja" className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30 hover:bg-amber-500 hover:text-white transition-all active:scale-90"><Send size={18}/></button>
                        )}
                        {(d.alcance === 'familiar' || esMia) && (
                          <button onClick={() => { setPagoSeleccionado({ cuota: cuotaActual, maestra: d }); setMostrarModalPago(true); }} className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black px-6 py-3 rounded-xl shadow-lg shadow-indigo-600/20 transition-all active:scale-95">ABONAR</button>
                        )}
                      </div>
                    )}
                    {pestana === 'activas' && !cuotaActual && (
                       <button onClick={() => cerrarManualmente(d)} className="text-[10px] font-black text-slate-500 hover:text-white flex items-center gap-2 border border-white/5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-slate-700 transition-all"><Archive size={12}/> archivar deuda</button>
                    )}
                  </div>
                </div>

                {/* Expandable Details: Calendar & IA */}
                <AnimatePresence>
                  {estaExpandida && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-6 pt-6 border-t border-white/5 space-y-4">
                      {d.tipo === 'tarjeta_credito' && (
                        <button onClick={() => pedirConsejoIA(d, cuotaActual)} className="w-full py-3 bg-indigo-600/10 text-indigo-300 text-[10px] font-black rounded-xl border border-indigo-500/20 hover:bg-indigo-600 hover:text-white transition-all flex items-center justify-center gap-2">
                          <Sparkles size={14}/> ESTRATEGIA DE PAGO IA
                        </button>
                      )}
                      
                      <div className="space-y-2">
                        <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Calendario de Pagos</h5>
                        <div className="max-h-48 overflow-y-auto custom-scrollbar pr-2 space-y-1">
                          {d.cuotas_detalle?.sort((a,b) => a.numero_cuota - b.numero_cuota).map(c => (
                            <div key={c.id} className="flex justify-between items-center p-2.5 bg-white/5 rounded-xl border border-white/5">
                              <div className="flex items-center gap-3">
                                <div className={`w-2 h-2 rounded-full ${c.estado === 'pagado' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                <span className="text-[11px] font-bold text-slate-300">Cuota {c.numero_cuota}</span>
                              </div>
                              <div className="text-right">
                                <div className="text-[11px] text-white font-black">{formatearNumero(c.monto_cuota, d.moneda)}</div>
                                <div className="text-[9px] text-slate-500 font-bold uppercase">{new Date(c.fecha_vencimiento).toLocaleDateString()}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })
        )}
      </div>

      {/* --- MODAL: NUEVA DEUDA PRO --- */}
      <AnimatePresence>
        {mostrarModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-lg glass-panel p-6 rounded-3xl relative max-h-[90vh] overflow-y-auto">
              <button onClick={() => setMostrarModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"><X size={24} /></button>
              <h2 className="text-2xl font-black text-white mb-6">Nuevo Compromiso Pro</h2>
              
              <form onSubmit={guardarDeudaPro} className="space-y-5">
                {/* Selector de Alcance */}
                <div className="flex p-1 bg-white/5 rounded-2xl border border-white/5">
                  {['familiar', 'individual'].map(a => (
                    <button key={a} type="button" onClick={() => setAlcanceDeuda(a)} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all flex items-center justify-center gap-2 ${alcanceDeuda === a ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-white/5'}`}>
                      {a === 'familiar' ? <Users size={14}/> : <Lock size={14}/>} {a}
                    </button>
                  ))}
                </div>

                {/* Selector de Tipo */}
                <div className="flex p-1 bg-white/5 rounded-2xl border border-white/5">
                  {['fija', 'flexible', 'tarjeta_credito'].map(t => (
                    <button key={t} type="button" onClick={() => setTipoDeuda(t)} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${tipoDeuda === t ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-white/5'}`}>
                      {t.replace('_', ' ')}
                    </button>
                  ))}
                </div>

                {/* Campos Base */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Descripción / Acreedor</label>
                  <input type="text" placeholder="Ej: Préstamo Banco Itaú, Tigo, etc." value={titulo} onChange={(e) => setTitulo(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-2xl px-5 py-4 text-white outline-none focus:border-indigo-500/50 transition-all" required />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">{tipoDeuda === 'tarjeta_credito' ? 'Deuda Actual' : 'Monto Total'}</label>
                    <input type="number" value={montoTotal} onChange={(e) => setMontoTotal(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-2xl px-5 py-4 text-white outline-none focus:border-indigo-500/50" required />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Moneda</label>
                    <select value={monedaDeuda} onChange={(e) => setMonedaDeuda(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-2xl px-5 py-4 text-white outline-none focus:border-indigo-500/50">
                      <option value="PYG">PYG (Gs.)</option>
                      <option value="BRL">BRL (R$)</option>
                      <option value="USD">USD ($)</option>
                    </select>
                  </div>
                </div>

                {/* Campos Condicionales */}
                <div className="grid grid-cols-2 gap-4">
                  {tipoDeuda === 'tarjeta_credito' ? (
                    <>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Pago Mínimo Mes</label>
                        <input type="number" value={pagoMinimo} onChange={(e) => setPagoMinimo(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-2xl px-5 py-4 text-white outline-none focus:border-indigo-500/50" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Línea de Crédito</label>
                        <input type="number" value={lineaCredito} onChange={(e) => setLineaCredito(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-2xl px-5 py-4 text-white outline-none focus:border-indigo-500/50" />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Cuotas Totales</label>
                        <input type="number" min="1" value={cantidadCuotas} onChange={(e) => setCantidadCuotas(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-2xl px-5 py-4 text-white outline-none focus:border-indigo-500/50" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Día Vencimiento</label>
                        <input type="number" min="1" max="31" value={diaVencimiento} onChange={(e) => setDiaVencimiento(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-2xl px-5 py-4 text-white outline-none focus:border-indigo-500/50" />
                      </div>
                    </>
                  )}
                </div>

                {tipoDeuda === 'tarjeta_credito' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Día Vencimiento</label>
                      <input type="number" min="1" max="31" value={diaVencimiento} onChange={(e) => setDiaVencimiento(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-2xl px-5 py-4 text-white outline-none focus:border-indigo-500/50" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Día Cierre Extracto</label>
                      <input type="number" min="1" max="31" value={fechaCierreTarjeta} onChange={(e) => setFechaCierreTarjeta(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-2xl px-5 py-4 text-white outline-none focus:border-indigo-500/50" />
                    </div>
                  </div>
                )}

                {/* HU-10: Warning Message */}
                {zonaPeligro && (
                  <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-4">
                    <AlertTriangle className="text-red-500 shrink-0" size={24} />
                    <p className="text-[11px] text-red-200 font-bold leading-tight">
                      🚨 ¡ALERTA DE ENDEUDAMIENTO! <br />
                      Esta cuota elevará tu índice al <span className="underline">{proyectado.toFixed(1)}%</span>. Superar el 40% es peligroso según el BCP. Pensalo bien, kape.
                    </p>
                  </motion.div>
                )}

                <div className="flex gap-3 pt-2">
                   <button type="button" onClick={() => setMostrarModal(false)} className="flex-1 py-5 bg-white/5 text-slate-400 font-black uppercase text-[10px] tracking-widest rounded-2xl hover:bg-white/10 transition-all">Cancelar</button>
                   <button type="submit" disabled={guardando} className={`flex-[2] py-5 font-black uppercase text-[10px] tracking-widest rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2 ${zonaPeligro ? 'bg-red-600 text-white shadow-red-900/20' : 'bg-indigo-600 text-white shadow-indigo-900/20'} active:scale-95`}>
                    {guardando ? <Loader2 className="animate-spin" /> : "REGISTRAR DEUDA"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- MODAL: PROCESAR ABONO --- */}
      <AnimatePresence>{mostrarModalPago && <ModalAbono />}</AnimatePresence>

      {/* --- MODAL: IA ADVICE --- */}
      <AnimatePresence>
        {sugerenciaIA && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-sm glass-panel p-8 rounded-3xl text-center border border-indigo-500/30 shadow-2xl">
              <Sparkles className="text-indigo-400 mx-auto mb-4" size={48}/>
              <h3 className="text-white font-black text-xl mb-4 uppercase tracking-tighter">Consejo de ÑandeAsistente</h3>
              <p className="text-slate-300 text-sm italic leading-relaxed">"{sugerenciaIA}"</p>
              <button onClick={() => setSugerenciaIA(null)} className="w-full mt-8 py-4 bg-indigo-600 text-white font-black rounded-2xl uppercase text-xs tracking-widest shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 active:scale-95 transition-all">ENTENDIDO, KAPÉ</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
