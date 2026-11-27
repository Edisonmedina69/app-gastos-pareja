import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { motion } from 'framer-motion';
import { Loader2, Hash, Clock, ArrowRight, ArrowLeft } from 'lucide-react';
import { formatarInput, desformatearInput } from '../../../../shared/lib/formatters';
import * as gastosProgramadosService from '../../../../services/gastosProgramados.service';
import { valoresInicialesFijo } from '../../lib/formularios';
import { FormPage } from '../../../../shared/ui/FormPage';

/** Alta o ajuste de un gasto fijo mensual (servicios, alquiler, etc.). */
export default function ModalGastoFijo({ fijo, usuarioActual, datosHogar, monedaGlobal, onClose, onGuardado }) {
  const [ini] = useState(() => valoresInicialesFijo(fijo, monedaGlobal));
  const idFijoEditando = ini.idFijoEditando;
  const [pasoFijo, setPasoFijo] = useState(1); // 1: Datos principales, 2: Datos bancarios opcionales
  const [guardando, setGuardando] = useState(false);
  const [fijoConcepto, setFijoConcepto] = useState(ini.fijoConcepto);
  const [fijoMontoFormateado, setFijoMontoFormateado] = useState(ini.fijoMontoFormateado);
  const [fijoMoneda, setFijoMoneda] = useState(ini.fijoMoneda);
  const [fijoDiaRecurrencia, setFijoDiaRecurrencia] = useState(ini.fijoDiaRecurrencia);
  const [fijoCategoria, setFijoCategoria] = useState(ini.fijoCategoria);
  const [fijoParaQuien, setFijoParaQuien] = useState(ini.fijoParaQuien);
  const [fijoMedioPago, setFijoMedioPago] = useState(ini.fijoMedioPago);
  const [fijoTipoCuenta, setFijoTipoCuenta] = useState(ini.fijoTipoCuenta);
  const [fijoAliasCuenta, setFijoAliasCuenta] = useState(ini.fijoAliasCuenta);
  const [fijoNroCuenta, setFijoNroCuenta] = useState(ini.fijoNroCuenta);
  const [fijoNombreTitular, setFijoNombreTitular] = useState(ini.fijoNombreTitular);
  const [fijoCiTitular, setFijoCiTitular] = useState(ini.fijoCiTitular);

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
        const { error } = await gastosProgramadosService.actualizarGastoProgramado(idFijoEditando, {
            concepto: fijoConcepto.trim(),
            monto: montoLimpio,
            dia_recurrencia: parseInt(fijoDiaRecurrencia),
            categoria: fijoCategoria,
            para_quien: fijoParaQuien,
            medio_pago: fijoMedioPago,
            tipo_cuenta: fijoMedioPago === 'transferencia' ? fijoTipoCuenta : null,
            alias_cuenta: fijoMedioPago === 'transferencia' && fijoTipoCuenta === 'alias' ? fijoAliasCuenta.trim() : null,
            nro_cuenta: fijoMedioPago === 'transferencia' && fijoTipoCuenta === 'nro_cuenta' ? fijoNroCuenta.trim() : null,
            nombre_titular: fijoMedioPago === 'transferencia' && fijoTipoCuenta === 'nro_cuenta' ? fijoNombreTitular.trim() : null,
            ci_titular: fijoMedioPago === 'transferencia' && fijoTipoCuenta === 'nro_cuenta' ? fijoCiTitular.trim() : null,
          });
        clearTimeout(timeoutId);
        if (error) throw error;
        toast.success("¡Gasto fijo ajustado! 📈", { id: toastId });
      } else {
        const { error } = await gastosProgramadosService.insertarGastosProgramados([{
            espacio_id: datosHogar.espacio_id,
            usuario_id: usuarioActual.id,
            concepto: fijoConcepto.trim(),
            monto: montoLimpio,
            moneda: fijoMoneda,
            dia_recurrencia: parseInt(fijoDiaRecurrencia),
            categoria: fijoCategoria,
            para_quien: fijoParaQuien,
            medio_pago: fijoMedioPago,
            tipo_cuenta: fijoMedioPago === 'transferencia' ? fijoTipoCuenta : null,
            alias_cuenta: fijoMedioPago === 'transferencia' && fijoTipoCuenta === 'alias' ? fijoAliasCuenta.trim() : null,
            nro_cuenta: fijoMedioPago === 'transferencia' && fijoTipoCuenta === 'nro_cuenta' ? fijoNroCuenta.trim() : null,
            nombre_titular: fijoMedioPago === 'transferencia' && fijoTipoCuenta === 'nro_cuenta' ? fijoNombreTitular.trim() : null,
            ci_titular: fijoMedioPago === 'transferencia' && fijoTipoCuenta === 'nro_cuenta' ? fijoCiTitular.trim() : null,
          }]);
        clearTimeout(timeoutId);
        if (error) throw error;
        toast.success("¡Gasto fijo programado! 📅", { id: toastId });
      }
      onGuardado();
    } catch (err) {
      clearTimeout(timeoutId);
      toast.error(err.message, { id: toastId });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <FormPage resumen={<><p className="font-bold">{fijoConcepto || "Gasto fijo"}</p><p className="text-2xl tabular-nums mt-3">{fijoMontoFormateado || "0"} {fijoMoneda}</p><p className="text-sm text-muted-foreground mt-2">{`Día ${fijoDiaRecurrencia} de cada mes`}</p></>} onClose={onClose} ariaLabel={idFijoEditando ? 'Ajustar gasto fijo' : 'Programar gasto fijo'}>

      {/* Header Wizard Gasto Fijo */}
      <div className="mb-6">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="shrink-0 whitespace-nowrap text-xs font-black uppercase text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 rounded-full">
            Paso {pasoFijo} de 2
          </span>
        </div>
        <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden flex gap-1 p-0.5">
          <div className={`h-full flex-1 rounded-full transition-colors duration-150 ${pasoFijo >= 1 ? 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]' : 'bg-slate-800'}`} />
          <div className={`h-full flex-1 rounded-full transition-colors duration-150 ${pasoFijo >= 2 ? 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]' : 'bg-slate-800'}`} />
        </div>
      </div>

      <form onSubmit={guardarGastoFijo} className="space-y-4">
        {pasoFijo === 1 && (
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1">Concepto / Servicio</label>
              <input type="text" placeholder="Ej: Luz (ANDE), Agua, Alquiler..." value={fijoConcepto} onChange={(e) => setFijoConcepto(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-2xl px-4 py-3.5 text-white font-bold outline-none focus:border-indigo-500 text-base" required />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1">
                <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1">Monto Estimado</label>
                <input 
                  type="text" 
                  value={fijoMontoFormateado} 
                  onChange={(e) => setFijoMontoFormateado(formatarInput(e.target.value))} 
                  className="w-full bg-slate-900 border border-white/10 rounded-2xl px-4 py-3.5 text-xl font-black text-indigo-400 outline-none" 
                  placeholder="Variable / Sin monto fijo"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1">Moneda</label>
                <select value={fijoMoneda} onChange={(e) => setFijoMoneda(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-2xl px-3 py-3.5 text-white font-bold outline-none text-base" disabled={!!idFijoEditando}>
                  <option value="PYG">PYG</option>
                  <option value="BRL">BRL</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1">Día de Cobro/Venc.</label>
                <input type="number" min="1" max="31" value={fijoDiaRecurrencia} onChange={(e) => setFijoDiaRecurrencia(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-2xl px-4 py-3 text-white font-black outline-none text-base" required />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1">Categoría</label>
                <select value={fijoCategoria} onChange={(e) => setFijoCategoria(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-2xl px-4 py-3 text-white font-bold outline-none text-base">
                  {["Casa", "Supermercado", "Salud", "Transporte", "Otros"].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1">Alcance del Gasto</label>
              <select value={fijoParaQuien} onChange={(e) => setFijoParaQuien(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-2xl px-4 py-3 text-white font-bold outline-none text-base">
                <option value="Ambos">Ambos (Familiar / Compartido)</option>
                <option value="Yo">Solo Yo</option>
                <option value="Pareja">Pareja</option>
              </select>
            </div>

            <div className="form-actions pt-2">
              <button 
                type="button" 
                disabled={!fijoConcepto.trim()} 
                onClick={() => setPasoFijo(2)} 
                className="w-full py-4 bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-indigo-600 text-white font-black text-xs uppercase rounded-2xl shadow-xl shadow-indigo-600/20 flex items-center justify-center gap-2 transition-colors duration-150"
              >
                Siguiente: Datos de Pago (Opcional) <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {pasoFijo === 2 && (
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1">Medio de Pago habitual</label>
              <div className="flex p-1 bg-white/5 rounded-2xl border border-white/5">
                <button
                  type="button"
                  onClick={() => setFijoMedioPago('transferencia')}
                  className={`flex-1 py-2.5 text-xs font-black uppercase rounded-xl transition-colors duration-150 ${
                    fijoMedioPago === 'transferencia' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400'
                  }`}
                >
                  Transferencia
                </button>
                <button
                  type="button"
                  onClick={() => setFijoMedioPago('efectivo')}
                  className={`flex-1 py-2.5 text-xs font-black uppercase rounded-xl transition-colors duration-150 ${
                    fijoMedioPago === 'efectivo' ? 'bg-amber-700 text-white shadow-lg' : 'text-slate-400'
                  }`}
                >
                  Efectivo
                </button>
              </div>
            </div>

            {fijoMedioPago === 'transferencia' && (
              <div className="space-y-3 pt-1">
                <div className="flex p-1 bg-white/5 rounded-2xl border border-white/5">
                  <button
                    type="button"
                    onClick={() => setFijoTipoCuenta('alias')}
                    className={`flex-1 py-2 text-xs font-black uppercase rounded-xl transition-colors duration-150 ${
                      fijoTipoCuenta === 'alias' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400'
                    }`}
                  >
                    Alias / CBU
                  </button>
                  <button
                    type="button"
                    onClick={() => setFijoTipoCuenta('nro_cuenta')}
                    className={`flex-1 py-2 text-xs font-black uppercase rounded-xl transition-colors duration-150 ${
                      fijoTipoCuenta === 'nro_cuenta' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400'
                    }`}
                  >
                    Nro. de Cuenta
                  </button>
                </div>

                {fijoTipoCuenta === 'alias' ? (
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-indigo-400 uppercase ml-1 flex items-center gap-1">
                      <Hash size={12} /> Alias / CBU
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: mi.alias.banco"
                      value={fijoAliasCuenta}
                      onChange={(e) => setFijoAliasCuenta(e.target.value)}
                      className="w-full bg-slate-900 border border-white/10 rounded-2xl px-4 py-3 text-white text-base outline-none"
                    />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <input
                      type="text"
                      placeholder="Nro. Cuenta (Ej: 001-123456-00)"
                      value={fijoNroCuenta}
                      onChange={(e) => setFijoNroCuenta(e.target.value)}
                      className="w-full bg-slate-900 border border-white/10 rounded-2xl px-4 py-3 text-white text-base outline-none"
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="text"
                        placeholder="Titular"
                        value={fijoNombreTitular}
                        onChange={(e) => setFijoNombreTitular(e.target.value)}
                        className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white text-base outline-none"
                      />
                      <input
                        type="text"
                        placeholder="CI / Doc"
                        value={fijoCiTitular}
                        onChange={(e) => setFijoCiTitular(e.target.value)}
                        className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white text-base outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="form-actions pt-2 flex gap-3">
              <button 
                type="button" 
                onClick={() => setPasoFijo(1)} 
                className="py-4 px-5 bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-xs uppercase rounded-2xl flex items-center justify-center gap-1 transition-colors duration-150"
              >
                <ArrowLeft size={16} /> Atrás
              </button>
              <button 
                type="submit" 
                disabled={guardando} 
                className="flex-1 py-4 font-black text-xs uppercase rounded-2xl bg-indigo-600 hover:bg-indigo-600 text-white shadow-xl shadow-indigo-600/20 transition-colors duration-150 flex items-center justify-center gap-2"
              >
                {guardando ? <Loader2 className="animate-spin mx-auto" size={18} /> : "FINALIZAR Y GUARDAR"}
              </button>
            </div>
          </div>
        )}
      </form>
    </FormPage>
  );
}
