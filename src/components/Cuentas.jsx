import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { toast } from 'react-hot-toast';
import { formatearNumero } from '../utils/formatters';
import { motion, AnimatePresence } from "framer-motion";
import { 
  CreditCard, Plus, CheckCircle, X, Loader2, Sparkles, 
  Lock, Users, Send, Archive, AlertTriangle
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
  const [mostrarModal, setMostrarModal] = useState(false);
  const [mostrarModalPago, setMostrarModalPago] = useState(false);
  const [pagoSeleccionado, setPagoSeleccionado] = useState(null);
  const [tipoDeuda, setTipoDeuda] = useState("fija"); 
  const [alcanceDeuda, setAlcanceDeuda] = useState("familiar"); // individual | familiar
  const [titulo, setTitulo] = useState('');
  const [montoTotal, setMontoTotal] = useState('');
  const [lineaCredito, setLineaCredito] = useState('');
  const [pagoMinimo, setPagoMinimo] = useState('');
  const [cantidadCuotas, setCantidadCuotas] = useState(1);
  const [diaVencimiento, setDiaVencimiento] = useState("5");
  const [monedaDeuda, setMonedaDeuda] = useState(monedaGlobal);
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

  // Regla Semáforo (HU-10)
  const proyectado = (() => {
    if (!montoTotal || !saludFinanciera.ingresos) return saludFinanciera.indice;
    const cuotaNueva = parseFloat(montoTotal) / (parseInt(cantidadCuotas) || 1);
    const cargaNueva = saludFinanciera.carga + (alcanceDeuda === 'individual' ? cuotaNueva : cuotaNueva * 0.5);
    return (cargaNueva / saludFinanciera.ingresos) * 100;
  })();
  const zonaPeligro = proyectado > 40;

  function ajustarDiaHabil(fecha) {
    const d = fecha.getDay();
    const nf = new Date(fecha);
    if (d === 0) nf.setDate(nf.getDate() + 1);
    else if (d === 6) nf.setDate(nf.getDate() + 2);
    return nf;
  }

  async function guardarDeudaPro(e) {
    e.preventDefault();
    if (!usuarioActual || !datosHogar) return;
    setGuardando(true);
    const toastId = toast.loading("Registrando...");
    try {
      const eid = datosHogar.espacio_id;
      const { data: maestra, error: errM } = await supabase.from("deudas_maestras").insert([{
        espacio_id: eid, creador_id: usuarioActual.id, titulo: titulo.trim(), tipo: tipoDeuda,
        alcance: alcanceDeuda, permite_pago_parcial: tipoDeuda !== 'fija', moneda: monedaDeuda,
        linea_credito_total: parseFloat(lineaCredito) || 0,
        linea_credito_disponible: (parseFloat(lineaCredito) || 0) - (tipoDeuda === 'tarjeta_credito' ? parseFloat(montoTotal) : 0)
      }]).select().single();
      if (errM) throw errM;

      const numCuotas = parseInt(cantidadCuotas);
      const montoCuota = parseFloat(montoTotal) / numCuotas;
      const cuotas = [];
      const fBase = new Date();
      for (let i = 1; i <= numCuotas; i++) {
        let fv = new Date(fBase.getFullYear(), fBase.getMonth() + (i - 1), parseInt(diaVencimiento));
        fv = ajustarDiaHabil(fv);
        cuotas.push({
          deuda_maestra_id: maestra.id, espacio_id: eid, numero_cuota: i, monto_cuota: montoCuota,
          pago_minimo: i === 1 ? (parseFloat(pagoMinimo) || 0) : 0,
          fecha_vencimiento: fv.toISOString().split('T')[0]
        });
      }
      await supabase.from("cuotas_detalle").insert(cuotas);
      toast.success("¡Deuda registrada!", { id: toastId });
      setMostrarModal(false); obtenerDatos(); resetForm();
    } catch (err) { toast.error(err.message, { id: toastId }); }
    finally { setGuardando(false); }
  }

  async function procesarAbono(montoAbono, monedaAbono, tasaManual) {
    if (!pagoSeleccionado) return;
    const { cuota, maestra } = pagoSeleccionado;
    const toastId = toast.loading("Pagando...");
    try {
      let mMonedaDeuda = montoAbono;
      if (monedaAbono !== maestra.moneda) {
        if (!tasaManual) throw new Error("Cotización manual requerida");
        mMonedaDeuda = montoAbono * parseFloat(tasaManual);
      }
      const nAbonoTotal = Number(cuota.monto_abonado) + mMonedaDeuda;
      const pagada = nAbonoTotal >= cuota.monto_cuota;

      await supabase.from("cuotas_detalle").update({
        monto_abonado: nAbonoTotal, estado: pagada ? 'pagado' : 'pendiente',
        fecha_pago: new Date().toISOString(), pagador_id: usuarioActual.id
      }).eq("id", cuota.id);

      if (maestra.tipo === 'tarjeta_credito') {
        await supabase.from("deudas_maestras").update({ 
          linea_credito_disponible: Number(maestra.linea_credito_disponible) + mMonedaDeuda 
        }).eq("id", maestra.id);
      }

      // HU-06: Cierre automático
      const { data: q } = await supabase.from('cuotas_detalle').select('estado').eq('deuda_maestra_id', maestra.id);
      if (q.every(c => c.estado === 'pagado')) {
        await supabase.from('deudas_maestras').update({ estado: 'cerrada' }).eq('id', maestra.id);
      }

      await supabase.from("gastos").insert([{
        concepto: `Pago Deuda: ${maestra.titulo}`, monto: montoAbono, categoria: "Pago Tarjeta de Crédito",
        usuario_id: usuarioActual.id, pagador_id: usuarioActual.id, moneda: monedaAbono, espacio_id: datosHogar.espacio_id
      }]);

      toast.success("Pago registrado", { id: toastId });
      setMostrarModalPago(false); obtenerDatos();
    } catch (err) { toast.error(err.message, { id: toastId }); }
  }

  async function solicitarAyuda(maestra, cuota) {
    const monto = cuota.monto_cuota - cuota.monto_abonado;
    const toastId = toast.loading("Enviando...");
    try {
      const { data: p } = await supabase.from('perfiles').select('id').eq('espacio_id', datosHogar.espacio_id).neq('id', usuarioActual.id).single();
      await supabase.from('notificaciones').insert([{
        espacio_id: datosHogar.espacio_id, usuario_id: p.id,
        titulo: "🆘 Ayuda con Deuda",
        mensaje: `${usuarioActual.nombre} solicita ayuda para pagar ${formatearNumero(monto, maestra.moneda)} de "${maestra.titulo}".`,
        tipo: "alerta",
        metadata: { tipo: "solicitud_ayuda", deuda_id: maestra.id, cuota_id: cuota.id, monto, moneda: maestra.moneda, solicitante_id: usuarioActual.id }
      }]);
      toast.success("¡Solicitud enviada!", { id: toastId });
    } catch (e) { toast.error("Error"); }
  }

  async function sugerirIA(maestra, cuota) {
    setAnalizandoIA(true);
    try {
      const { data } = await supabase.functions.invoke('chat-ia', {
        body: { mensaje: `Contexto: Deuda "${maestra.titulo}" de ${cuota.monto_cuota} ${maestra.moneda}. Mi endeudamiento es ${saludFinanciera.indice.toFixed(1)}%. ¿Qué hago?`, contexto_financiero: { salud: saludFinanciera } }
      });
      setSugerenciaIA(data.respuesta);
    } catch (e) {} finally { setAnalizandoIA(false); }
  }

  const resetForm = () => { setTitulo(''); setMontoTotal(''); setLineaCredito(''); setPagoMinimo(''); setCantidadCuotas(1); setTipoDeuda("fija"); setAlcanceDeuda("familiar"); };

  function ModalPagoInterno() {
    const [m, setM] = useState('');
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
            <input type="number" value={m} onChange={(e) => setM(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-2xl px-4 py-4 text-2xl font-black text-white" placeholder="0" />
            <div className="grid grid-cols-3 gap-2">
              {['PYG', 'BRL', 'USD'].map(curr => <button key={curr} onClick={() => setMon(curr)} className={`py-2 rounded-xl text-[10px] font-black border ${mon === curr ? 'bg-indigo-600 border-indigo-500' : 'bg-white/5 border-white/10'}`}>{curr}</button>)}
            </div>
            {reqT && <input type="number" step="0.0001" value={t} onChange={(e) => setT(e.target.value)} className="w-full bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 text-white text-xs" placeholder="Cotización aplicada" />}
            <div className="flex gap-2 pt-4">
              <button onClick={() => setMostrarModalPago(false)} className="flex-1 py-4 bg-white/5 rounded-2xl text-xs font-bold">CANCELAR</button>
              <button onClick={() => procesarAbono(parseFloat(m), mon, t)} disabled={!m || (reqT && !t)} className="flex-[2] py-4 bg-indigo-600 text-white font-black rounded-2xl">PAGAR</button>
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
          <button onClick={() => setPestana('activas')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${pestana === 'activas' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>Activas</button>
          <button onClick={() => setPestana('archivadas')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${pestana === 'archivadas' ? 'bg-slate-700 text-white' : 'text-slate-500'}`}>Archivadas</button>
        </div>
        <button onClick={() => setMostrarModal(true)} className="p-2 bg-indigo-600 rounded-xl text-white shadow-lg"><Plus size={24} /></button>
      </header>

      <div className="space-y-4">
        {deudasFiltradas.map((d) => {
          const cuotaActual = d.cuotas_detalle?.filter(c => c.estado === 'pendiente').sort((a, b) => new Date(a.fecha_vencimiento) - new Date(b.fecha_vencimiento))[0];
          const estaExpandida = deudaExpandida === d.id;
          return (
            <motion.div key={d.id} layout className={`glass-card border-l-4 ${pestana === 'activas' ? 'border-l-indigo-500' : 'border-l-slate-600'}`}>
              <div className="flex justify-between mb-4">
                <div onClick={() => setDeudaExpandida(estaExpandida ? null : d.id)} className="cursor-pointer">
                  <h4 className="font-bold text-white flex items-center gap-2">{d.titulo} {d.alcance === 'individual' && <Lock size={12} className="text-amber-400" />}</h4>
                  <p className="text-[9px] text-slate-500 uppercase font-black">{d.tipo} • {d.alcance}</p>
                </div>
                {cuotaActual && <div className="text-[9px] text-red-400 font-bold">VENCE {new Date(cuotaActual.fecha_vencimiento).toLocaleDateString()}</div>}
              </div>
              <div className="flex justify-between items-end">
                <div>
                  <div className="text-2xl font-black text-white">{formatearNumero(cuotaActual ? (cuotaActual.monto_cuota - cuotaActual.monto_abonado) : 0, d.moneda)}</div>
                </div>
                {pestana === 'activas' && cuotaActual && (
                  <div className="flex gap-2">
                    {d.alcance === 'individual' && d.creador_id === usuarioActual.id && <button onClick={() => solicitarAyuda(d, cuotaActual)} className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30"><Send size={16}/></button>}
                    {(d.alcance === 'familiar' || d.creador_id === usuarioActual.id) && <button onClick={() => { setPagoSeleccionado({ cuota: cuotaActual, maestra: d }); setMostrarModalPago(true); }} className="bg-indigo-600 text-white text-[10px] font-black px-4 py-2.5 rounded-xl">ABONAR</button>}
                  </div>
                )}
              </div>
              {estaExpandida && (
                 <div className="mt-4 pt-4 border-t border-white/5 space-y-1">
                   {d.cuotas_detalle?.sort((a,b)=>a.numero_cuota-b.numero_cuota).map(c => (
                     <div key={c.id} className="flex justify-between text-[10px] bg-white/5 p-2 rounded-lg"><span className={c.estado==='pagado'?'text-emerald-400':'text-slate-400'}>Cuota {c.numero_cuota}</span><span className="text-white font-bold">{formatearNumero(c.monto_cuota, d.moneda)}</span></div>
                   ))}
                   {d.tipo === 'tarjeta_credito' && <button onClick={() => sugerirIA(d, cuotaActual)} className="w-full mt-2 py-2 bg-indigo-600/20 text-indigo-300 text-[10px] font-black rounded-lg border border-indigo-500/30 flex items-center justify-center gap-2"><Sparkles size={12}/> AYUDA FINANCIERA</button>}
                 </div>
              )}
            </motion.div>
          );
        })}
      </div>

      <AnimatePresence>
        {mostrarModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-lg glass-panel p-6 rounded-3xl">
              <h2 className="text-xl font-bold text-white mb-6">Nuevo Compromiso</h2>
              <form onSubmit={guardarDeudaPro} className="space-y-4">
                <div className="flex p-1 bg-white/5 rounded-xl border border-white/5">
                  {['familiar', 'individual'].map(a => <button key={a} type="button" onClick={() => setAlcanceDeuda(a)} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${alcanceDeuda === a ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>{a}</button>)}
                </div>
                <div className="flex p-1 bg-white/5 rounded-xl border border-white/5">
                  {['fija', 'flexible', 'tarjeta_credito'].map(t => <button key={t} type="button" onClick={() => setTipoDeuda(t)} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${tipoDeuda === t ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>{t.replace('_',' ')}</button>)}
                </div>
                <input type="text" placeholder="Concepto" value={titulo} onChange={(e) => setTitulo(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white" required />
                <div className="grid grid-cols-2 gap-4">
                   <input type="number" placeholder="Monto" value={montoTotal} onChange={(e) => setMontoTotal(e.target.value)} className="bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white" required />
                   {tipoDeuda !== 'tarjeta_credito' && <input type="number" placeholder="Cuotas" value={cantidadCuotas} onChange={(e) => setCantidadCuotas(e.target.value)} className="bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white" />}
                </div>
                {zonaPeligro && <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex gap-2"><AlertTriangle className="text-red-500" size={16}/><p className="text-[9px] text-red-200 font-bold">🚨 ¡Peligro! Endeudamiento proyectado: {proyectado.toFixed(1)}%.</p></div>}
                <div className="flex gap-2">
                  <button type="button" onClick={() => setMostrarModal(false)} className="flex-1 py-4 bg-white/5 rounded-2xl text-xs font-bold">CANCELAR</button>
                  <button type="submit" disabled={guardando} className={`flex-1 py-4 font-black rounded-2xl ${zonaPeligro ? 'bg-red-600' : 'bg-indigo-600'}`}>{guardando ? <Loader2 className="animate-spin mx-auto"/> : "REGISTRAR"}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>{mostrarModalPago && <ModalPagoInterno />}</AnimatePresence>
      <AnimatePresence>
        {sugerenciaIA && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-sm glass-panel p-6 rounded-3xl text-center">
              <Sparkles className="text-indigo-400 mx-auto mb-4" size={32}/>
              <h3 className="text-white font-bold mb-2">Consejo IA</h3>
              <p className="text-slate-300 text-sm italic">"{sugerenciaIA}"</p>
              <button onClick={() => setSugerenciaIA(null)} className="w-full mt-6 py-3 bg-indigo-600 text-white font-black rounded-xl">ENTENDIDO</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
