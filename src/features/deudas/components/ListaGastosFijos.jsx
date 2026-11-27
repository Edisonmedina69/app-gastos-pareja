import { CheckCircle, Calendar, Trash2, Hash, Edit2 } from 'lucide-react';
import { formatearNumero } from '../../../shared/lib/formatters';

/** Pestaña "Fijos": servicios y compras recurrentes del mes. */
export default function ListaGastosFijos({ deudasFijas, verificarSiFuePagadoEsteMes, preCargarPlantillas, abrirNuevoFijo, abrirEdicionFijo, abrirEdicionMedioPago, abrirPagoFijo, eliminarGastoFijo }) {
  return (
    deudasFijas.length === 0 ? (
      <div className="glass-card py-12 text-center">
        <Calendar size={40} className="mx-auto mb-3 text-slate-400 opacity-40" />
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Sin gastos fijos programados</p>
        <p className="text-xs text-slate-400 mt-2 max-w-xs mx-auto px-4">
          Registrá tus servicios indispensables (agua, luz, internet) para tenerlos siempre a mano y simplificar tu control mensual.
        </p>
        <div className="flex flex-col gap-2 mt-6 max-w-xs mx-auto px-4">
          <button 
            onClick={preCargarPlantillas} 
            className="py-3 px-4 bg-indigo-600 text-white text-xs font-black rounded-xl uppercase hover:bg-indigo-600 active:scale-95 transition-all shadow-lg"
          >
            Pre-cargar Plantilla de Supervivencia 🏠
          </button>
          <button 
            onClick={() => { abrirNuevoFijo(); }} 
            className="py-3 px-4 bg-white/5 border border-white/10 text-white text-xs font-black rounded-xl uppercase hover:bg-white/10 active:scale-95 transition-all"
          >
            Agregar Gasto Fijo Manual
          </button>
        </div>
      </div>
    ) : (
      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <span className="text-xs font-black text-slate-400 uppercase tracking-wider">
            Servicios y Compras Recurrentes ({deudasFijas.length})
          </span>
          <button 
            onClick={preCargarPlantillas} 
            className="text-xs font-black text-indigo-400 uppercase tracking-tighter hover:underline"
          >
            + Recargar Plantilla Básica
          </button>
        </div>

        {deudasFijas.map((f) => {
          const pagado = verificarSiFuePagadoEsteMes(f);
          return (
            <div 
              key={f.id} 
              className={`glass-card border-l-4 transition-all duration-300 ${
                pagado ? 'border-l-emerald-500 bg-emerald-500/[0.02] opacity-75' : 'border-l-indigo-500 bg-white/[0.01]'
              }`}
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-white text-sm uppercase">{f.concepto}</h4>
                    {pagado && (
                      <span className="bg-emerald-500/20 text-emerald-400 text-xs font-black px-1.5 py-0.5 rounded-full uppercase border border-emerald-500/20">
                        PAGADO ESTE MES
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 font-bold uppercase mt-1 tracking-tighter">
                    Categoría: {f.categoria} • Vence el: {f.dia_recurrencia} de cada mes • {f.para_quien === 'Ambos' ? 'Familia' : `Para: ${f.para_quien}`}
                  </p>
                  {f.medio_pago === 'transferencia' ? (
                    <button
                      type="button"
                      onClick={() => abrirEdicionMedioPago(f, 'gasto_fijo')}
                      className="text-xs text-indigo-400/80 font-bold mt-0.5 flex items-center gap-1 hover:text-indigo-300 transition-colors cursor-pointer bg-transparent border-0 p-0"
                    >
                      {f.tipo_cuenta === 'alias' && f.alias_cuenta && (
                        <><Hash size={10} /> Alias: {f.alias_cuenta} <Edit2 size={9} className="ml-0.5 opacity-60" /></>
                      )}
                      {f.tipo_cuenta === 'nro_cuenta' && f.nro_cuenta && (
                        <><Hash size={10} /> Cta: {f.nro_cuenta} {f.nombre_titular ? `• ${f.nombre_titular}` : ''} <Edit2 size={9} className="ml-0.5 opacity-60" /></>
                      )}
                      {!f.alias_cuenta && !f.nro_cuenta && (
                        <>Transferencia <Edit2 size={9} className="ml-0.5 opacity-60" /></>
                      )}
                    </button>
                  ) : f.medio_pago === 'efectivo' ? (
                    <button
                      type="button"
                      onClick={() => abrirEdicionMedioPago(f, 'gasto_fijo')}
                      className="text-xs text-amber-400/80 font-bold mt-0.5 flex items-center gap-1 hover:text-amber-300 transition-colors cursor-pointer bg-transparent border-0 p-0"
                    >
                      💵 Pago en efectivo <Edit2 size={9} className="ml-0.5 opacity-60" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => abrirEdicionMedioPago(f, 'gasto_fijo')}
                      className="text-xs text-slate-400 font-bold mt-0.5 flex items-center gap-1 hover:text-slate-300 transition-colors cursor-pointer bg-transparent border-0 p-0 border border-dashed border-slate-600 rounded-full px-2 py-0.5"
                    >
                      ⚠️ Sin medio de pago <Edit2 size={9} />
                    </button>
                  )}
                </div>
                <div className="flex gap-1">
                  <button 
                    aria-label={`Editar ${f.concepto}`} onClick={() => abrirEdicionFijo(f)}
                    className="p-1.5 text-slate-400 hover:text-indigo-400 transition-colors"
                    disabled={pagado}
                  >
                    <Edit2 size={15}/>
                  </button>
                  <button 
                    aria-label={`Eliminar ${f.concepto}`} onClick={() => eliminarGastoFijo(f.id, f.concepto)}
                    className="p-1.5 text-slate-400 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={15}/>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="text-xl font-black text-white">
                  {f.monto > 0 ? formatearNumero(f.monto, f.moneda) : 'Monto Variable 📊'}
                </div>
            
                {!pagado ? (
                  <button 
                    onClick={() => abrirPagoFijo(f)} 
                    className="px-4 py-2 bg-indigo-600 text-white text-xs font-black rounded-xl flex items-center gap-2 active:scale-95 transition-all shadow-lg hover:bg-indigo-600"
                  >
                    <CheckCircle size={14}/> PAGAR / REGISTRAR
                  </button>
                ) : (
                  <div className="text-xs font-black text-emerald-400 flex items-center gap-1">
                    <CheckCircle size={12}/> ABONADO EN EL MES
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    )
  );
}
