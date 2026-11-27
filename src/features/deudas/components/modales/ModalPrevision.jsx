import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import { formatarInput, desformatearInput } from '../../../../shared/lib/formatters';
import * as gastosProgramadosService from '../../../../services/gastosProgramados.service';
import { valoresInicialesPrevision } from '../../lib/formularios';
import { FormPage } from '../../../../shared/ui/FormPage';

/** Alta o ajuste de una previsión (tope mensual de gasto por categoría). */
export default function ModalPrevision({ prevision, usuarioActual, otroUsuario, datosHogar, monedaGlobal, onClose, onGuardado }) {
  const [ini] = useState(() => valoresInicialesPrevision(prevision, monedaGlobal));
  const idPrevisionEditando = ini.idPrevisionEditando;
  const [guardando, setGuardando] = useState(false);
  const [previsionConcepto, setPrevisionConcepto] = useState(ini.previsionConcepto);
  const [previsionMontoFormateado, setPrevisionMontoFormateado] = useState(ini.previsionMontoFormateado);
  const [previsionMoneda, setPrevisionMoneda] = useState(ini.previsionMoneda);
  const [previsionParaQuien, setPrevisionParaQuien] = useState(ini.previsionParaQuien);

  const guardarPrevision = async (e) => {
    e.preventDefault();
    const montoLimpio = previsionMontoFormateado ? desformatearInput(previsionMontoFormateado) : 0;
    if (guardando || !usuarioActual || !datosHogar) return;
    setGuardando(true);
    const toastId = toast.loading("Guardando previsión...");
    try {
      const conceptoFinal = `[PRESUPUESTO] ${previsionConcepto.trim()}`;
      if (idPrevisionEditando) {
        const { error } = await gastosProgramadosService.actualizarGastoProgramado(idPrevisionEditando, {
            concepto: conceptoFinal,
            monto: montoLimpio,
            moneda: previsionMoneda,
            dia_recurrencia: 1,
            categoria: "Otros",
            para_quien: previsionParaQuien
          });
        if (error) throw error;
        toast.success("¡Previsión ajustada! 📊", { id: toastId });
      } else {
        const { error } = await gastosProgramadosService.insertarGastosProgramados([{
            espacio_id: datosHogar.espacio_id,
            usuario_id: usuarioActual.id,
            concepto: conceptoFinal,
            monto: montoLimpio,
            moneda: previsionMoneda,
            dia_recurrencia: 1,
            categoria: "Otros",
            para_quien: previsionParaQuien
          }]);
        if (error) throw error;
        toast.success("¡Previsión creada! 🎯", { id: toastId });
      }
      onGuardado();
    } catch (err) {
      toast.error(err.message, { id: toastId });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <FormPage resumen={<><p className="font-bold">{previsionConcepto || "Previsión"}</p><p className="text-2xl tabular-nums mt-3">{previsionMontoFormateado || "0"} {previsionMoneda}</p><p className="text-sm text-muted-foreground mt-2">{"Límite de gasto mensual"}</p></>} onClose={onClose} ariaLabel={idPrevisionEditando ? 'Ajustar previsión' : 'Nueva previsión'}>
      <h2 className="text-xl font-black text-white mb-6 uppercase flex items-center gap-2">
        {idPrevisionEditando ? 'Ajustar Previsión' : 'Nueva Previsión'}
      </h2>
      <form onSubmit={guardarPrevision} className="space-y-4">
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Nombre de la Previsión / Sobre</label>
          <input type="text" placeholder="Ej: Belleza, Ocio, Cine, Ropa..." value={previsionConcepto} onChange={(e) => setPrevisionConcepto(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500/50 text-base" required />
        </div>
  
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Monto Límite Mensual</label>
          <div className="relative">
            <input 
              type="text" 
              value={previsionMontoFormateado} 
              onChange={(e) => setPrevisionMontoFormateado(formatarInput(e.target.value))} 
              className="w-full bg-slate-900 border border-white/10 rounded-2xl px-4 py-4 text-2xl font-black text-indigo-400 outline-none" 
              placeholder="0"
              required
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 font-black uppercase text-xs">{previsionMoneda}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Moneda</label>
            <select value={previsionMoneda} onChange={(e) => setPrevisionMoneda(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white text-base" disabled={!!idPrevisionEditando}>
              <option value="PYG">PYG</option>
              <option value="BRL">BRL</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Destinado A</label>
            <select value={previsionParaQuien} onChange={(e) => setPrevisionParaQuien(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white text-base">
              <option value="Ambos">Ambos (Compartido)</option>
              <option value="Yo">{usuarioActual?.nombre || 'Solo Yo'}</option>
              {otroUsuario && (
                <option value="Pareja">{otroUsuario.nombre} (Pareja)</option>
              )}
            </select>
          </div>
        </div>

        <button type="submit" disabled={guardando} className="w-full py-4 font-black rounded-2xl bg-indigo-600 text-white shadow-xl shadow-indigo-900/20 active:scale-95 transition-all mt-4">
          {guardando ? <Loader2 className="animate-spin mx-auto" /> : "GUARDAR PREVISIÓN"}
        </button>
      </form>
    </FormPage>
  );
}
