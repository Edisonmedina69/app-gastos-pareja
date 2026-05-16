import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { toast } from 'react-hot-toast';
import { formatearNumero } from '../utils/formatters';
import { obtenerCotizacion } from '../utils/exchangeApi';
import { motion, AnimatePresence } from "framer-motion";
import { 
  CreditCard, 
  Plus, 
  CheckCircle, 
  X,
  Loader2
} from 'lucide-react';

export default function Cuentas({
  usuarioActual,
  deudas, // Ahora recibimos deudas maestras con sus cuotas
  monedaGlobal,
  obtenerDatos,
  datosHogar
}) {
  const [mostrarModal, setMostrarModal] = useState(false);
  const [tipoDeuda, setTipoDeuda] = useState("fija"); // 'fija', 'flexible', 'tarjeta_credito'
  const [titulo, setTitulo] = useState('');
  const [montoTotal, setMontoTotal] = useState('');
  const [cantidadCuotas, setCantidadCuotas] = useState(1);
  const [diaVencimiento, setDiaVencimiento] = useState("5");
  const [monedaDeuda, setMonedaDeuda] = useState(monedaGlobal);
  const [guardando, setGuardando] = useState(false);

  // Lógica para cargar cotización inicial al abrir modal
  useEffect(() => {
    if (mostrarModal) setMonedaDeuda(monedaGlobal);
  }, [mostrarModal, monedaGlobal]);

  async function guardarDeudaPro(e) {
    e.preventDefault();
    if (!usuarioActual || !datosHogar) return;
    setGuardando(true);
    const toastId = toast.loading("Generando compromiso financiero...");

    try {
      const eid = datosHogar.espacio_id;
      const numCuotas = parseInt(cantidadCuotas);
      const montoTotalNum = parseFloat(montoTotal);
      const montoPorCuota = montoTotalNum / numCuotas;

      // 1. Crear Deuda Maestra
      const { data: maestra, error: errM } = await supabase
        .from("deudas_maestras")
        .insert([{
          espacio_id: eid,
          creador_id: usuarioActual.id,
          titulo: titulo.trim(),
          tipo: tipoDeuda,
          permite_pago_parcial: tipoDeuda !== 'fija',
          moneda: monedaDeuda
        }])
        .select()
        .single();

      if (errM) throw errM;

      // 2. Generar Cuotas Detalle
      const cuotas = [];
      const fechaBase = new Date();
      
      for (let i = 1; i <= numCuotas; i++) {
        const fechaVenc = new Date(fechaBase.getFullYear(), fechaBase.getMonth() + (i - 1), parseInt(diaVencimiento));
        cuotas.push({
          deuda_maestra_id: maestra.id,
          espacio_id: eid,
          numero_cuota: i,
          monto_cuota: montoPorCuota,
          fecha_vencimiento: fechaVenc.toISOString().split('T')[0],
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

  async function pagarCuota(cuota, maestra) {
    const abonoStr = window.prompt(`Cuota ${cuota.numero_cuota}/${maestra.cuotas_detalle?.length || '?'}\nMonto: ${formatearNumero(cuota.monto_cuota - cuota.monto_abonado, maestra.moneda)}\n¿Cuánto vas a pagar hoy?`, cuota.monto_cuota - cuota.monto_abonado);
    
    if (abonoStr === null) return;
    const abono = parseFloat(abonoStr);
    if (isNaN(abono) || abono <= 0) return toast.error("Monto inválido");

    const toastId = toast.loading("Registrando pago...");
    try {
      const nuevoAbonoTotal = Number(cuota.monto_abonado) + abono;
      const estaPagado = nuevoAbonoTotal >= cuota.monto_cuota;

      // 1. Actualizar Cuota
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

      // 2. Registrar en Historial de Gastos
      await supabase.from("gastos").insert([{
        concepto: `Pago Cuota: ${maestra.titulo} (${cuota.numero_cuota})`,
        monto: abono,
        categoria: "Préstamo",
        usuario_id: usuarioActual.id,
        pagador_id: usuarioActual.id,
        para_quien: "Ambos",
        moneda: maestra.moneda,
        espacio_id: datosHogar.espacio_id
      }]);

      toast.success(estaPagado ? "¡Cuota liquidada! 🎉" : "Abono registrado 🔄", { id: toastId });
      obtenerDatos();
    } catch (err) {
      toast.error("Error al pagar: " + err.message, { id: toastId });
    }
  }

  const resetForm = () => {
    setTitulo('');
    setMontoTotal('');
    setCantidadCuotas(1);
    setTipoDeuda("fija");
  };

  // Filtrar cuotas pendientes de las deudas maestras
  const deudasActivas = deudas?.filter(d => d.cuotas_detalle?.some(c => c.estado === 'pendiente')) || [];

  return (
    <div className="space-y-6 pb-20">
      <header className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-indigo-400" /> Motor de Deudas Pro
        </h2>
        <motion.button 
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setMostrarModal(true)} 
          className="p-2 bg-indigo-600 rounded-xl text-white shadow-lg"
        >
          <Plus size={24} />
        </motion.button>
      </header>

      <div className="space-y-4">
        {deudasActivas.length === 0 ? (
          <div className="glass-card flex flex-col items-center justify-center py-12 text-center">
            <CheckCircle size={48} className="text-emerald-500 mb-4" />
            <h3 className="text-white font-bold text-lg">¡Felicidades!</h3>
            <p className="text-slate-500 text-sm">No tienen compromisos pendientes por ahora.</p>
          </div>
        ) : (
          deudasActivas.map((d) => {
            const cuotaActual = d.cuotas_detalle
              .filter(c => c.estado === 'pendiente')
              .sort((a, b) => new Date(a.fecha_vencimiento) - new Date(b.fecha_vencimiento))[0];

            if (!cuotaActual) return null;

            return (
              <motion.div key={d.id} layout className="glass-card border-l-4 border-l-indigo-500 group">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="font-bold text-white text-lg group-hover:text-indigo-400 transition-colors">{d.titulo}</h4>
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black mt-1">Tipo: {d.tipo.replace('_', ' ')}</p>
                  </div>
                  <div className="bg-red-500/10 text-red-400 text-[10px] font-black px-2 py-1 rounded-md border border-red-500/20">
                    VENCE DÍA {new Date(cuotaActual.fecha_vencimiento).getDate() + 1}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 items-end">
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-1">Cuota Actual</div>
                    <div className="text-2xl font-black text-white">
                      {formatearNumero(cuotaActual.monto_cuota - cuotaActual.monto_abonado, d.moneda)}
                    </div>
                    <div className="text-[10px] text-indigo-400 mt-1 font-bold">
                      CUOTA {cuotaActual.numero_cuota} de {d.cuotas_detalle.length}
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button 
                      onClick={() => pagarCuota(cuotaActual, d)}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black px-6 py-2.5 rounded-xl shadow-lg shadow-indigo-600/20 transition-all active:scale-95"
                    >
                      PAGAR / ABONAR
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* MODAL NUEVA DEUDA PRO */}
      <AnimatePresence>
        {mostrarModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-lg glass-panel p-6 rounded-3xl relative">
              <button onClick={() => setMostrarModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X size={24} /></button>
              <h2 className="text-xl font-bold text-white mb-6">Nuevo Compromiso Pro</h2>
              
              <form onSubmit={guardarDeudaPro} className="space-y-4">
                <div className="flex p-1 bg-white/5 rounded-xl border border-white/5">
                  {['fija', 'flexible', 'tarjeta_credito'].map(t => (
                    <button key={t} type="button" onClick={() => setTipoDeuda(t)} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${tipoDeuda === t ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>
                      {t.replace('_', ' ')}
                    </button>
                  ))}
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Descripción</label>
                  <input type="text" placeholder="Ej: Préstamo Banco Itaú" value={titulo} onChange={(e) => setTitulo(e.target.value)} className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500/50" required />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Monto Total</label>
                    <input type="number" value={montoTotal} onChange={(e) => setMontoTotal(e.target.value)} className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none" required />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Cuotas</label>
                    <input type="number" min="1" value={cantidadCuotas} onChange={(e) => setCantidadCuotas(e.target.value)} className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none" required />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Día Vencimiento</label>
                    <input type="number" min="1" max="31" value={diaVencimiento} onChange={(e) => setDiaVencimiento(e.target.value)} className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none" required />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Moneda</label>
                    <select value={monedaDeuda} onChange={(e) => setMonedaDeuda(e.target.value)} className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none">
                      <option value="PYG">PYG</option>
                      <option value="BRL">BRL</option>
                      <option value="USD">USD</option>
                    </select>
                  </div>
                </div>

                <button type="submit" disabled={guardando} className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl shadow-xl transition-all disabled:opacity-50">
                  {guardando ? <Loader2 className="animate-spin mx-auto" /> : "REGISTRAR COMPROMISO"}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
