import { Wallet, Landmark, Trash2 } from 'lucide-react';
import { formatearNumero } from '../../../shared/lib/formatters';

export default function PanelHistorialIngresos({ datosHogar, eliminarIngresoMensual, getNombreUsuario, ingresos, usuarioActual }) {
  return (
    <>
      <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl flex gap-3 items-center">
        <Landmark size={20} className="text-emerald-400 shrink-0" />
        <p className="text-[10px] text-slate-400 font-bold leading-normal">
          Aquí figuran los ingresos de caja **efectivos** recibidos en el mes en curso. Podés registrar ingresos variables directamente o confirmar el cobro de tus sueldos fijos desde la pestaña "Fijos".
        </p>
      </div>
      {ingresos.length === 0 ? (
        <div className="glass-card py-12 text-center opacity-40"><Wallet size={40} className="mx-auto mb-3" /><p className="text-xs font-bold uppercase tracking-widest">No hay ingresos registrados</p></div>
      ) : (
        ingresos.map((i) => (
          <div key={i.id} className="glass-card flex items-center justify-between border-l-4 border-l-emerald-500">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400"><Landmark size={20} /></div>
              <div>
                <div className="text-xs font-black text-white uppercase">{i.concepto}</div>
                <div className="text-[10px] text-slate-500 font-bold">
                  {getNombreUsuario(i.usuario_id)} • {i.fecha_efectiva ? new Date(i.fecha_efectiva + "T00:00:00").toLocaleDateString("es-PY") : new Date(i.fecha || i.created_at || new Date().toISOString()).toLocaleDateString("es-PY")}
                  {i.tipo_ingreso && <span className="ml-2 text-indigo-400 uppercase font-black text-[9px]">• {i.tipo_ingreso}</span>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-emerald-400 font-black tracking-tight">+ {formatearNumero(i.monto, i.moneda)}</div>
              </div>
              {(i.usuario_id === usuarioActual?.id || datosHogar?.rol === 'superadmin' || datosHogar?.rol === 'admin_hogar') && (
                <button 
                  onClick={() => eliminarIngresoMensual(i.id, i.concepto)} 
                  className="p-2 text-slate-500 hover:text-red-400 active:scale-90 transition-colors duration-150"
                  title="Eliminar ingreso"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          </div>
        ))
      )}
    </>
  );
}
