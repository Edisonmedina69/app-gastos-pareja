import { Calendar, Trash2, Edit2 } from 'lucide-react';
import { formatearNumero } from '../../../shared/lib/formatters';

/** Pestaña "Previsiones": topes de gasto mensuales y su consumo. */
export default function ListaPrevisiones({ previsiones, calcularGastoPrevision, obtenerNombreDestinatario, abrirNuevaPrevision, abrirEdicionPrevision, eliminarPrevision }) {
  return (
    previsiones.length === 0 ? (
      <div className="glass-card py-12 text-center">
        <Calendar size={40} className="mx-auto mb-3 text-slate-400 opacity-40" />
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Sin previsiones de gasto definidas</p>
        <p className="text-xs text-slate-400 mt-2 max-w-xs mx-auto px-4">
          Establecé límites mensuales para categorías específicas (ocio, belleza, salidas) para controlar tus gastos de manera inteligente y ver tu progreso en tiempo real.
        </p>
        <div className="flex flex-col gap-2 mt-6 max-w-xs mx-auto px-4">
          <button 
            onClick={() => { abrirNuevaPrevision(); }} 
            className="py-3 px-4 bg-indigo-600 text-white text-xs font-black rounded-xl uppercase hover:bg-indigo-600 active:scale-95 transition-all shadow-lg"
          >
            Definir Nueva Previsión 🎯
          </button>
        </div>
      </div>
    ) : (
      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <span className="text-xs font-black text-slate-400 uppercase tracking-wider">
            Previsiones de Gasto Activas ({previsiones.length})
          </span>
          <button 
            onClick={() => { abrirNuevaPrevision(); }} 
            className="text-xs font-black text-indigo-400 uppercase tracking-tighter hover:underline"
          >
            + Nueva Previsión
          </button>
        </div>

        {previsiones.map((p) => {
          const nombreLimpio = p.concepto.replace("[PRESUPUESTO] ", "");
          const consumido = calcularGastoPrevision(nombreLimpio, p.moneda);
          const limite = p.monto;
          const porc = limite > 0 ? (consumido / limite) * 100 : 0;
      
          let colorClase = "text-emerald-400 bg-emerald-500/20 border-emerald-500/20";
          let barColor = "bg-emerald-500";
          if (porc >= 70 && porc <= 90) {
            colorClase = "text-amber-400 bg-amber-500/20 border-amber-500/20";
            barColor = "bg-amber-500";
          } else if (porc > 90) {
            colorClase = "text-rose-400 bg-rose-500/20 border-rose-500/20";
            barColor = "bg-rose-500";
          }

          return (
            <div key={p.id} className="glass-card p-5 border-l-4 border-l-indigo-500 bg-white/[0.01] transition-all hover:bg-white/[0.03]">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h4 className="font-black text-white text-sm uppercase tracking-tight flex items-center gap-2">
                    {nombreLimpio}
                  </h4>
                  <span className="inline-block mt-1 text-xs font-black uppercase px-2 py-0.5 rounded-full bg-white/5 text-slate-400 border border-white/5">
                    {p.para_quien === 'Ambos' ? '👥 Compartido' : `👤 Para: ${obtenerNombreDestinatario(p)}`}
                  </span>
                </div>
                <div className="flex gap-1">
                  <button 
                    aria-label={`Editar ${p.concepto}`} onClick={() => abrirEdicionPrevision(p)}
                    className="p-1.5 text-slate-400 hover:text-indigo-400 transition-colors"
                  >
                    <Edit2 size={15}/>
                  </button>
                  <button 
                    aria-label={`Eliminar ${p.concepto}`} onClick={() => eliminarPrevision(p.id, p.concepto)}
                    className="p-1.5 text-slate-400 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={15}/>
                  </button>
                </div>
              </div>

              <div className="space-y-2 mt-4">
                <div className="flex justify-between items-end">
                  <span className="text-xs text-slate-400 font-bold uppercase">Consumido este mes</span>
                  <span className="text-sm font-black text-white">
                    {formatearNumero(consumido, p.moneda)} / <span className="text-slate-400 text-xs">{limite > 0 ? formatearNumero(limite, p.moneda) : 'Variable'}</span>
                  </span>
                </div>

                {limite > 0 && (
                  <div>
                    <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-white/5">
                      <div 
                        className={`h-full ${barColor} transition-all duration-500 rounded-full`}
                        style={{ width: `${Math.min(100, porc)}%` }}
                      />
                    </div>
    <div className="flex justify-between items-center mt-2 text-xs font-bold uppercase tracking-wider">
                      <span className={porc > 100 ? "text-rose-400" : "text-slate-400"}>
                        {porc > 100 ? `Excedido por ${formatearNumero(consumido - limite, p.moneda)}` : `Disponible: ${formatearNumero(limite - consumido, p.moneda)}`}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-xs font-black border ${colorClase}`}>
                        {porc.toFixed(0)}%
                      </span>
                    </div>
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
