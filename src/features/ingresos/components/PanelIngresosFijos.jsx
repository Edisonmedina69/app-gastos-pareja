import { Clock, CheckCircle, Trash2, Edit2, CreditCard } from 'lucide-react';
import { formatearNumero, calcularFechaCobroReal } from '../../../shared/lib/formatters';

export default function PanelIngresosFijos({ abrirEdicion, confirmarRecepcion, datosHogar, eliminarProgramado, getNombreUsuario, programados, usuarioActual, verificarSiFueCobradoEsteMes }) {
  return (
    <>
      <div className="p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl flex gap-3 items-center">
        <Clock size={20} className="text-indigo-400 shrink-0" />
        <p className="text-[10px] text-slate-400 font-bold leading-normal">
          Aquí podés configurar tus **sueldos y rentas recurrentes** con ajuste de días hábiles y débito automático de cuentas.
        </p>
      </div>
      {programados.length === 0 ? (
        <div className="glass-card py-12 text-center opacity-40"><Clock size={40} className="mx-auto mb-3" /><p className="text-xs font-bold uppercase tracking-widest">Sin sueldos programados</p></div>
      ) : (
        programados.map((p) => {
          const cobrado = verificarSiFueCobradoEsteMes(p);
          const calculoFecha = calcularFechaCobroReal(
            p.dia_recurrencia,
            new Date().getMonth() + 1,
            new Date().getFullYear(),
            p.solo_dias_habiles ?? true,
            p.ajuste_dia_habil || 'anterior'
          );

          return (
            <div key={p.id} className="glass-card border-l-4 border-l-indigo-500">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-black text-white text-sm uppercase">{p.descripcion}</h4>
                    <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 text-[9px] font-black rounded-md uppercase">
                      {p.categoria || "Sueldo"}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-bold mt-1">
                    Día programado: {p.dia_recurrencia} 
                    {calculoFecha.esAjustado && (
                      <span className="text-amber-400 ml-1">
                        (Cobro hábil: {new Date(calculoFecha.fechaStr + "T00:00:00").toLocaleDateString("es-PY", { weekday: 'short', day: 'numeric', month: 'short' })})
                      </span>
                    )}
                    {!calculoFecha.esAjustado && ` • ${getNombreUsuario(p.usuario_id)}`}
                  </p>
                  {p.monto_descuento > 0 && (
                    <p className="text-[9px] text-red-400 font-bold mt-0.5 flex items-center gap-1">
                      <CreditCard size={11}/> Débito Automático: -{formatearNumero(p.monto_descuento, p.moneda)} ({p.concepto_descuento || 'Pago / Descuento'})
                    </p>
                  )}
                </div>
                <div className="flex gap-1">
                  {(p.usuario_id === usuarioActual?.id || datosHogar?.rol === 'superadmin' || datosHogar?.rol === 'admin_hogar') && (
                    <>
                      <button onClick={() => abrirEdicion(p)} className="p-2 text-slate-600 hover:text-indigo-400" disabled={cobrado}><Edit2 size={16}/></button>
                      <button onClick={() => eliminarProgramado(p.id)} className="p-2 text-slate-600 hover:text-red-400"><Trash2 size={16}/></button>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-white/5">
                <div>
                  <div className="text-xl font-black text-white">{formatearNumero(p.monto, p.moneda)}</div>
                  {p.monto_descuento > 0 && (
                    <div className="text-[10px] text-emerald-400 font-bold">
                      Monto libre estimado: {formatearNumero(p.monto - p.monto_descuento, p.moneda)}
                    </div>
                  )}
                </div>
                {cobrado ? (
                  <div className="px-4 py-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black rounded-xl flex items-center gap-1.5 cursor-default">
                    <CheckCircle size={14} /> COBRADO ✓
                  </div>
                ) : (
                  <button onClick={() => confirmarRecepcion(p)} className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black rounded-xl flex items-center gap-2 active:scale-95 transition-all shadow-lg shadow-emerald-900/20">
                    <CheckCircle size={14}/> COBRAR
                  </button>
                )}
              </div>
            </div>
          );
        })
      )}
    </>
  );
}
