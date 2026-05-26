import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { toast } from 'react-hot-toast';
import { formatearNumero, formatarInput, desformatearInput } from '../utils/formatters';
import { motion, AnimatePresence } from "framer-motion";
import { 
  CreditCard, Plus, CheckCircle, X, Loader2, Sparkles, 
  Lock, Users, Send, Archive, AlertTriangle, ChevronDown, ChevronUp, Calendar, Trash2
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
  const [montoTotalFormateado, setMontoTotalFormateado] = useState('');
  const [lineaCreditoFormateada, setLineaCreditoFormateada] = useState('');
  const [pagoMinimoFormateado, setPagoMinimoFormateado] = useState('');
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

  useEffect(() => {
    if (mostrarModal) {
      setMonedaDeuda(monedaGlobal);
      if (tipoDeuda === 'tarjeta_credito') setCantidadCuotas(1);
    }
  }, [mostrarModal, monedaGlobal, tipoDeuda]);

  // HU-10: Real-time Health Check (BCP 40% Rule)
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
    setTitulo(''); setMontoTotalFormateado(''); setLineaCreditoFormateada(''); setPagoMinimoFormateado(''); setCantidadCuotas(1); 
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
          fecha_cierre_tarjeta: tipoDeuda === 'tarjeta_credito' ? parseInt(fechaCierreTarjeta) : null
        }])
        .select().single();

      if (errM) throw errM;

      const cuotas = [];
      const fechaBase = new Date();
      for (let i = 1; i <= numCuotas; i++) {
        let fv = new Date(fechaBase.getFullYear(), fechaBase.getMonth() + (i - 1), parseInt(diaVencimiento));
        fv = ajustarDiaHabil(fv);
        cuotas.push({
          deuda_maestra_id: maestra.id, espacio_id: eid, numero_cuota: i, monto_cuota: montoCuota,
          pago_minimo: i === 1 ? (desformatearInput(pagoMinimoFormateado) || 0) : 0,
          fecha_vencimiento: fv.toISOString().split('T')[0], estado: 'pendiente'
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

  async function pedirConsejoIA(maestra, cuota) {
    setAnalizandoIA(true);
    try {
      const { data } = await supabase.functions.invoke('chat-ia', {
        body: { mensaje: `Contexto Deuda: "${maestra.titulo}". Mi endeudamiento es ${saludFinanciera.indice.toFixed(1)}%.`, contexto_financiero: { salud: saludFinanciera, deudas } }
      });
      setSugerenciaIA(data.respuesta);
    } catch (e) {} finally { setAnalizandoIA(false); }
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
        <div className="flex bg-white/5 p-1 rounded-xl border border-white/5">
          {['activas', 'archivadas'].map(p => <button key={p} onClick={() => setPestana(p)} className={`px-5 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${pestana === p ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}>{p}</button>)}
        </div>
        <button onClick={() => setMostrarModal(true)} className="p-2 bg-indigo-600 rounded-xl text-white shadow-lg"><Plus size={24} /></button>
      </header>

      <div className="space-y-4">
        {deudasFiltradas.map((d) => {
          const cuotaActual = d.cuotas_detalle?.filter(c => c.estado === 'pendiente').sort((a, b) => new Date(a.fecha_vencimiento) - new Date(b.fecha_vencimiento))[0];
          const estaExpandida = deudaExpandida === d.id;
          const esMia = d.creador_id === usuarioActual.id;
          const totalPagado = d.cuotas_detalle?.reduce((acc, c) => acc + Number(c.monto_abonado), 0) || 0;
          const totalMontoDeuda = d.cuotas_detalle?.reduce((acc, c) => acc + Number(c.monto_cuota), 0) || 0;
          const porcProgreso = totalMontoDeuda > 0 ? (totalPagado / totalMontoDeuda) * 100 : 0;
          const cuotasSaldadas = d.cuotas_detalle?.filter(c => c.estado === 'pagado').length || 0;

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
                  <p className="text-[10px] text-slate-500 uppercase font-black tracking-tighter">{d.tipo} • {d.alcance}</p>
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
        })}
      </div>

      <AnimatePresence>
        {mostrarModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-lg glass-panel p-6 rounded-3xl relative">
              <button onClick={() => setMostrarModal(false)} className="absolute top-4 right-4 text-slate-400"><X size={24} /></button>
              <h2 className="text-xl font-black text-white mb-6 uppercase">Nuevo Compromiso Pro</h2>
              <form onSubmit={guardarDeudaPro} className="space-y-5">
                <div className="flex p-1 bg-white/5 rounded-2xl border border-white/5">
                  {['familiar', 'individual'].map(a => <button key={a} type="button" onClick={() => setAlcanceDeuda(a)} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${alcanceDeuda === a ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}>{a}</button>)}
                </div>
                <div className="flex p-1 bg-white/5 rounded-2xl border border-white/5">
                  {['fija', 'flexible', 'tarjeta_credito'].map(t => <button key={t} type="button" onClick={() => setTipoDeuda(t)} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${tipoDeuda === t ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}>{t.replace('_', ' ')}</button>)}
                </div>
                <input type="text" placeholder="Descripción" value={titulo} onChange={(e) => setTitulo(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-xl px-5 py-4 text-white outline-none" required />
                <div className="grid grid-cols-2 gap-4">
                  <input type="text" placeholder="Monto" value={montoTotalFormateado} onChange={(e) => setMontoTotalFormateado(formatarInput(e.target.value))} className="w-full bg-slate-900 border border-white/10 rounded-2xl px-5 py-4 text-white outline-none" required />
                  <select value={monedaDeuda} onChange={(e) => setMonedaDeuda(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-2xl px-5 py-4 text-white"><option value="PYG">PYG</option><option value="BRL">BRL</option></select>
                </div>
                {tipoDeuda === 'tarjeta_credito' ? (
                  <div className="grid grid-cols-2 gap-4">
                    <input type="text" placeholder="Pago Mínimo" value={pagoMinimoFormateado} onChange={(e) => setPagoMinimoFormateado(formatarInput(e.target.value))} className="bg-slate-900 border border-white/10 rounded-2xl px-5 py-4 text-white" />
                    <input type="text" placeholder="Línea Crédito" value={lineaCreditoFormateada} onChange={(e) => setLineaCreditoFormateada(formatarInput(e.target.value))} className="bg-slate-900 border border-white/10 rounded-2xl px-5 py-4 text-white" />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <input type="number" placeholder="Cuotas" value={cantidadCuotas} onChange={(e) => setCantidadCuotas(e.target.value)} className="bg-slate-900 border border-white/10 rounded-xl px-5 py-4 text-white" />
                    <input type="number" placeholder="Día Vence" value={diaVencimiento} onChange={(e) => setDiaVencimiento(e.target.value)} className="bg-slate-900 border border-white/10 rounded-xl px-5 py-4 text-white" />
                  </div>
                )}
                {zonaPeligro && <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex gap-4"><AlertTriangle className="text-red-500" /><p className="text-[11px] text-red-200 font-bold">🚨 ¡Índice al {proyectado.toFixed(1)}%! Superás el límite del BCP.</p></div>}
                <button type="submit" disabled={guardando} className={`w-full py-5 font-black uppercase rounded-2xl shadow-xl transition-all ${zonaPeligro ? 'bg-red-600' : 'bg-indigo-600'} text-white`}>{guardando ? <Loader2 className="animate-spin mx-auto" /> : "REGISTRAR"}</button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>{mostrarModalPago && <ModalAbono />}</AnimatePresence>
      <AnimatePresence>{sugerenciaIA && <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"><motion.div className="w-full max-w-sm glass-panel p-8 rounded-3xl text-center"><Sparkles className="text-indigo-400 mx-auto mb-4" size={48}/><p className="text-slate-300 italic mb-8">"{sugerenciaIA}"</p><button onClick={() => setSugerenciaIA(null)} className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl uppercase">ENTENDIDO</button></motion.div></div>}</AnimatePresence>
    </div>
  );
}
