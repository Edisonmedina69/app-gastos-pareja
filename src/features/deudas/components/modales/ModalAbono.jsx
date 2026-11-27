import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { Copy } from 'lucide-react';
import { formatearNumero, formatarInput, desformatearInput, formatearFechaCorta } from '../../../../shared/lib/formatters';
import { insertarGastos } from '../../../../services/gastos.service';
import * as deudasService from '../../../../services/deudas.service';
import { FormPage } from '../../../../shared/ui/FormPage';

/** Abono a la cuota pendiente de una deuda (con cotización si se paga en otra moneda). */
export default function ModalAbono({ pagoSeleccionado, usuarioActual, datosHogar, monedaGlobal, onClose, onGuardado, onEditarMedioPago }) {
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
      await deudasService.actualizarCuota(cuota.id, {
        monto_abonado: nAbonoTotal, estado: estaPagado ? 'pagado' : 'pendiente',
        fecha_pago: new Date().toISOString(), pagador_id: usuarioActual.id
      });
      if (maestra.tipo === 'tarjeta_credito') {
        await deudasService.actualizarDeuda(maestra.id, {
          linea_credito_disponible: Number(maestra.linea_credito_disponible) + mMonedaDeuda
        });
      }
      await insertarGastos([{
        concepto: `Pago Deuda: ${maestra.titulo}`, monto: montoAbono, categoria: "Pago Tarjeta de Crédito",
        usuario_id: usuarioActual.id, pagador_id: usuarioActual.id, para_quien: "Ambos", moneda: monedaAbono, espacio_id: datosHogar.espacio_id,
        medio_pago: maestra.medio_pago || 'transferencia',
        tipo_cuenta: maestra.tipo_cuenta || null,
        alias_cuenta: maestra.alias_cuenta || null,
        nro_cuenta: maestra.nro_cuenta || null,
        nombre_titular: maestra.nombre_titular || null,
        ci_titular: maestra.ci_titular || null,
      }]);
      const { data: check } = await deudasService.listarEstadosCuotas(maestra.id);
      if (maestra.tipo !== 'tarjeta_credito' && check.every(c => c.estado === 'pagado')) {
        await deudasService.actualizarDeuda(maestra.id, { estado: 'cerrada' });
      }
      toast.success("Pago registrado!", { id: toastId }); onGuardado();
    } catch (err) { toast.error(err.message, { id: toastId }); }
  }

  const [mFormateado, setMFormateado] = useState(() => {
    if (!pagoSeleccionado) return '';
    const { cuota, maestra } = pagoSeleccionado;
    if (maestra.tipo === 'tarjeta_credito') {
      const minPago = cuota.pago_minimo || cuota.monto_cuota;
      return formatarInput(Math.max(0, minPago - Number(cuota.monto_abonado)));
    }
    return formatarInput(cuota.monto_cuota - cuota.monto_abonado);
  });
  const [mon, setMon] = useState(() => {
    if (!pagoSeleccionado) return monedaGlobal;
    return pagoSeleccionado.maestra.moneda;
  });
  const [t, setT] = useState('');

  if (!pagoSeleccionado) return null;
  const { maestra } = pagoSeleccionado;
  const esFija = maestra.tipo === 'fija';
  const reqT = mon !== maestra.moneda;

  return (
    <FormPage resumen={<><p className="font-bold">{maestra.titulo}</p><p className="text-2xl tabular-nums mt-3">{mFormateado || "0"} {mon}</p><p className="text-sm text-muted-foreground mt-2">{`Cuota ${pagoSeleccionado.cuota.numero_cuota}`}</p></>} onClose={onClose} ariaLabel={`Abonar a ${maestra.titulo}`}>
      <h3 className="text-white font-bold text-lg mb-1">Abonar a {maestra.titulo}</h3>
      <p className="text-[10px] text-slate-400 font-bold mb-3 uppercase tracking-wider">
        Cuota {pagoSeleccionado.cuota.numero_cuota} • Vence: {formatearFechaCorta(pagoSeleccionado.cuota.fecha_vencimiento)}
      </p>
      <div className="space-y-4">
        <div>
          <input 
            type="text" 
            value={mFormateado} 
            onChange={(e) => setMFormateado(formatarInput(e.target.value))} 
            className={`w-full bg-slate-900 border border-white/10 rounded-2xl px-4 py-4 text-2xl font-black outline-none transition-all ${esFija ? 'text-slate-400 bg-slate-950/60' : 'text-white'}`} 
            placeholder="0" 
          />
          {esFija && (
            <p className="text-[9px] text-slate-500 italic mt-1.5 pl-1">
              Las deudas con cuota fija requieren el pago del monto exacto de la cuota.
            </p>
          )}
          {maestra.tipo === 'tarjeta_credito' && (
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={() => {
                  const minPago = pagoSeleccionado.cuota.pago_minimo || pagoSeleccionado.cuota.monto_cuota;
                  setMFormateado(formatarInput(Math.max(0, minPago - Number(pagoSeleccionado.cuota.monto_abonado))));
                }}
                className="flex-1 py-2 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 rounded-xl text-[9px] font-black uppercase border border-indigo-500/20 transition-all"
              >
                Mínimo: {formatearNumero(Math.max(0, (pagoSeleccionado.cuota.pago_minimo || pagoSeleccionado.cuota.monto_cuota) - Number(pagoSeleccionado.cuota.monto_abonado)), maestra.moneda)}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMFormateado(formatarInput(Math.max(0, pagoSeleccionado.cuota.monto_cuota - Number(pagoSeleccionado.cuota.monto_abonado))));
                }}
                className="flex-1 py-2 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 rounded-xl text-[9px] font-black uppercase border border-emerald-500/20 transition-all"
              >
                Total: {formatearNumero(Math.max(0, pagoSeleccionado.cuota.monto_cuota - Number(pagoSeleccionado.cuota.monto_abonado)), maestra.moneda)}
              </button>
            </div>
          )}
        </div>
        
        <div className="grid grid-cols-3 gap-2">
          {['PYG', 'BRL', 'USD'].map(m => (
            <button 
              key={m} 
              type="button"
              disabled={esFija}
              onClick={() => setMon(m)} 
              className={`py-2 rounded-xl text-xs font-black border transition-all ${mon === m ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-white/5 border-white/10 text-slate-500'} ${esFija && mon !== m ? 'opacity-30 cursor-not-allowed' : ''}`}
            >
              {m}
            </button>
          ))}
        </div>

        {/* ── DATOS DE CUENTA GUARDADOS (con opción de copiar) ── */}
        {maestra.medio_pago === 'transferencia' && (
          <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl px-4 py-3 space-y-2">
            {maestra.tipo_cuenta === 'alias' && maestra.alias_cuenta && (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-bold text-indigo-400 uppercase tracking-wider">Alias / CBU para transferir</p>
                  <p className="text-sm font-black text-white">{maestra.alias_cuenta}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(maestra.alias_cuenta);
                    toast.success("¡Alias copiado al portapapeles! 📋", { icon: "✨" });
                  }}
                  className="flex items-center gap-1 text-[10px] font-bold bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 px-2.5 py-1.5 rounded-lg border border-indigo-500/30 transition-colors"
                >
                  <Copy size={12} /> Copiar Alias
                </button>
              </div>
            )}
            {maestra.tipo_cuenta === 'nro_cuenta' && maestra.nro_cuenta && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[9px] font-bold text-indigo-400 uppercase tracking-wider">Nro. de Cuenta</p>
                    <p className="text-sm font-black text-white">{maestra.nro_cuenta}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(maestra.nro_cuenta);
                      toast.success("¡Número de cuenta copiado! 📋", { icon: "✨" });
                    }}
                    className="flex items-center gap-1 text-[10px] font-bold bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 px-2.5 py-1.5 rounded-lg border border-indigo-500/30 transition-colors"
                  >
                    <Copy size={12} /> Copiar Cuenta
                  </button>
                </div>
                {maestra.nombre_titular && (
                  <div>
                    <p className="text-[9px] font-bold text-indigo-400 uppercase tracking-wider">Titular</p>
                    <p className="text-sm font-black text-white">{maestra.nombre_titular}</p>
                  </div>
                )}
                {maestra.ci_titular && (
                  <div>
                    <p className="text-[9px] font-bold text-indigo-400 uppercase tracking-wider">CI / Documento</p>
                    <p className="text-sm font-black text-white">{maestra.ci_titular}</p>
                  </div>
                )}
              </div>
            )}
            {!maestra.alias_cuenta && !maestra.nro_cuenta && (
              <div className="flex items-center justify-between text-slate-400 text-xs py-1">
                <span>Sin datos de cuenta configurados</span>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onEditarMedioPago(maestra, 'deuda');
                  }}
                  className="text-[10px] text-indigo-400 font-bold underline cursor-pointer"
                >
                  + Agregar datos
                </button>
              </div>
            )}
          </div>
        )}
        {maestra.medio_pago === 'efectivo' && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 flex items-center gap-2">
            <span className="text-lg">💵</span>
            <p className="text-[10px] font-bold text-amber-400 uppercase">Pago en efectivo — no requiere datos de cuenta</p>
          </div>
        )}

        {reqT && <input type="number" step="0.0001" value={t} onChange={(e) => setT(e.target.value)} className="w-full bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 text-white font-bold text-base" placeholder="Cotización aplicada" />}
        <div className="form-actions flex gap-2 pt-4">
          <button onClick={() => onClose()} className="flex-1 py-4 bg-white/5 text-slate-400 font-bold rounded-2xl">CANCELAR</button>
          <button onClick={() => procesarAbono(desformatearInput(mFormateado), mon, t)} disabled={!mFormateado || (reqT && !t)} className="flex-[2] py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-lg shadow-indigo-600/30">PAGAR</button>
        </div>
      </div>
    </FormPage>
  );
}
