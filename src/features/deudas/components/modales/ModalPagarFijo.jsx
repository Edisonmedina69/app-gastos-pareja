import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { Copy } from 'lucide-react';
import { formatarInput, desformatearInput } from '../../../../shared/lib/formatters';
import { insertarGastos } from '../../../../services/gastos.service';
import { valoresInicialesPagoFijo } from '../../lib/formularios';
import { FormPage } from '../../../../shared/ui/FormPage';

/** Registra el pago real del mes de un gasto fijo. */
export default function ModalPagarFijo({ gastoFijoAPagar, usuarioActual, otroUsuario, datosHogar, onClose, onGuardado, onEditarMedioPago }) {
  const [ini] = useState(() => valoresInicialesPagoFijo(gastoFijoAPagar, usuarioActual?.id));
  const [pagarMontoFormateado, setPagarMontoFormateado] = useState(ini.pagarMontoFormateado);
  const [pagarMoneda, setPagarMoneda] = useState(ini.pagarMoneda);
  const [pagarPagadorId, setPagarPagadorId] = useState(ini.pagarPagadorId);
  const [pagarParaQuien, setPagarParaQuien] = useState(ini.pagarParaQuien);
  const [pagarMedioPago, setPagarMedioPago] = useState(ini.pagarMedioPago);

  const registrarPagoGastoFijo = async (e) => {
    e.preventDefault();
    const montoLimpio = desformatearInput(pagarMontoFormateado);
    if (!montoLimpio || !gastoFijoAPagar || !usuarioActual || !datosHogar) return;
    const toastId = toast.loading("Registrando pago de servicio...");
    try {
      const { error } = await insertarGastos([{
        espacio_id: datosHogar.espacio_id,
        usuario_id: usuarioActual.id,
        pagador_id: pagarPagadorId,
        concepto: `[FIJO] ${gastoFijoAPagar.concepto}`,
        monto: montoLimpio,
        moneda: pagarMoneda,
        categoria: gastoFijoAPagar.categoria,
        para_quien: pagarParaQuien,
        medio_pago: pagarMedioPago,
        tipo_cuenta: gastoFijoAPagar?.tipo_cuenta || null,
        alias_cuenta: gastoFijoAPagar?.alias_cuenta || null,
        nro_cuenta: gastoFijoAPagar?.nro_cuenta || null,
        nombre_titular: gastoFijoAPagar?.nombre_titular || null,
        ci_titular: gastoFijoAPagar?.ci_titular || null,
      }]);
      if (error) throw error;
      toast.success("¡Pago registrado y guardado! 💸", { id: toastId });
      onGuardado();
    } catch (err) {
      toast.error(err.message, { id: toastId });
    }
  };

  return (
    <FormPage resumen={<><p className="font-bold">{gastoFijoAPagar.concepto}</p><p className="text-2xl tabular-nums mt-3">{pagarMontoFormateado || "0"} {pagarMoneda}</p><p className="text-sm text-muted-foreground mt-2">{pagarMedioPago}</p></>} onClose={onClose} ariaLabel="Pagar servicio">
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
            <select value={pagarMoneda} onChange={(e) => setPagarMoneda(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white text-base">
              <option value="PYG">PYG</option>
              <option value="BRL">BRL</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Quién Pagó</label>
            <select value={pagarPagadorId} onChange={(e) => setPagarPagadorId(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white text-base">
              <option value={usuarioActual?.id}>{usuarioActual?.nombre} (Yo)</option>
              {otroUsuario && <option value={otroUsuario.id}>{otroUsuario.nombre}</option>}
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Alcance del Gasto</label>
          <select value={pagarParaQuien} onChange={(e) => setPagarParaQuien(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white text-base">
            <option value="Ambos">Ambos (Compartido 50/50)</option>
            <option value="Yo">Solo Yo</option>
            <option value="Pareja">Pareja</option>
          </select>
        </div>

        {/* ── MEDIO DE PAGO ── */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Medio de Pago</label>
          <div className="flex p-1 bg-white/5 rounded-2xl border border-white/5">
            <button
              type="button"
              onClick={() => setPagarMedioPago('transferencia')}
              className={`flex-1 py-2.5 text-[9px] font-black uppercase rounded-xl transition-all ${
                pagarMedioPago === 'transferencia' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'
              }`}
            >
              Transferencia
            </button>
            <button
              type="button"
              onClick={() => setPagarMedioPago('efectivo')}
              className={`flex-1 py-2.5 text-[9px] font-black uppercase rounded-xl transition-all ${
                pagarMedioPago === 'efectivo' ? 'bg-amber-600 text-white shadow-lg' : 'text-slate-500'
              }`}
            >
              Efectivo
            </button>
          </div>
        </div>

        {/* ── DATOS DE CUENTA GUARDADOS (con opción de copiar) ── */}
        {pagarMedioPago === 'transferencia' && (
          <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl px-4 py-3 space-y-2">
            {gastoFijoAPagar?.tipo_cuenta === 'alias' && gastoFijoAPagar?.alias_cuenta && (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-bold text-indigo-400 uppercase tracking-wider">Alias / CBU para transferir</p>
                  <p className="text-sm font-black text-white">{gastoFijoAPagar.alias_cuenta}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(gastoFijoAPagar.alias_cuenta);
                    toast.success("¡Alias copiado al portapapeles! 📋", { icon: "✨" });
                  }}
                  className="flex items-center gap-1 text-[10px] font-bold bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 px-2.5 py-1.5 rounded-lg border border-indigo-500/30 transition-colors"
                >
                  <Copy size={12} /> Copiar Alias
                </button>
              </div>
            )}
            {gastoFijoAPagar?.tipo_cuenta === 'nro_cuenta' && gastoFijoAPagar?.nro_cuenta && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[9px] font-bold text-indigo-400 uppercase tracking-wider">Nro. de Cuenta</p>
                    <p className="text-sm font-black text-white">{gastoFijoAPagar.nro_cuenta}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(gastoFijoAPagar.nro_cuenta);
                      toast.success("¡Número de cuenta copiado! 📋", { icon: "✨" });
                    }}
                    className="flex items-center gap-1 text-[10px] font-bold bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 px-2.5 py-1.5 rounded-lg border border-indigo-500/30 transition-colors"
                  >
                    <Copy size={12} /> Copiar Cuenta
                  </button>
                </div>
                {gastoFijoAPagar.nombre_titular && (
                  <div>
                    <p className="text-[9px] font-bold text-indigo-400 uppercase tracking-wider">Titular</p>
                    <p className="text-sm font-black text-white">{gastoFijoAPagar.nombre_titular}</p>
                  </div>
                )}
                {gastoFijoAPagar.ci_titular && (
                  <div>
                    <p className="text-[9px] font-bold text-indigo-400 uppercase tracking-wider">CI / Documento</p>
                    <p className="text-sm font-black text-white">{gastoFijoAPagar.ci_titular}</p>
                  </div>
                )}
              </div>
            )}
            {!gastoFijoAPagar?.alias_cuenta && !gastoFijoAPagar?.nro_cuenta && (
              <div className="flex items-center justify-between text-slate-400 text-xs py-1">
                <span>Sin datos de cuenta configurados</span>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onEditarMedioPago(gastoFijoAPagar, 'gasto_fijo');
                  }}
                  className="text-[10px] text-indigo-400 font-bold underline cursor-pointer"
                >
                  + Agregar datos
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── AVISO EFECTIVO ── */}
        {pagarMedioPago === 'efectivo' && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 flex items-center gap-2">
            <span className="text-lg">💵</span>
            <p className="text-[10px] font-bold text-amber-400 uppercase">Pago en efectivo — no requiere datos de cuenta</p>
          </div>
        )}

        <button type="submit" className="w-full py-4 font-black rounded-2xl bg-emerald-600 text-white shadow-xl shadow-emerald-950/30 active:scale-95 transition-all mt-4">
          CONFIRMAR PAGO
        </button>
      </form>
    </FormPage>
  );
}
