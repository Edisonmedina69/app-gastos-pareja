import { TrendingUp } from 'lucide-react';
import { formatearNumero } from '../../../shared/lib/formatters';

export default function PanelHistorialSalarial({ historialSalarios }) {
  return (
    <>
       <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest ml-2">Línea del Tiempo Salarial</h3>
      {historialSalarios.length === 0 ? (
        <div className="glass-card py-12 text-center opacity-40"><TrendingUp size={40} className="mx-auto mb-3" /><p className="text-xs font-bold uppercase tracking-widest">Sin ajustes previos</p></div>
      ) : (
        historialSalarios.map((h) => (
          <div key={h.id} className="glass-card bg-white/5 border-white/5 flex items-center justify-between relative overflow-hidden">
            <div className="relative z-10">
              <div className="text-xs font-black text-indigo-400 uppercase">{h.motivo}</div>
              <div className="text-xs font-bold text-white mt-1">{new Date(h.created_at).toLocaleDateString()}</div>
            </div>
            <div className="text-right relative z-10">
              <div className="text-xs text-slate-400 line-through">{formatearNumero(h.monto_anterior, h.moneda)}</div>
              <div className="text-sm font-black text-emerald-400">→ {formatearNumero(h.monto_nuevo, h.moneda)}</div>
            </div>
            <div className="absolute top-0 right-0 opacity-5 -mr-4 -mt-4"><TrendingUp size={64}/></div>
          </div>
        ))
      )}
    </>
  );
}
