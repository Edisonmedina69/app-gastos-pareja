import { Loader2, Trash2, Trash } from 'lucide-react';

export default function TabMantenimiento({ ejecutarVinculacionUsuarioExistente, eliminarPerfil, espacios, guardando, limpiandoTransacciones, limpiezaEspacioId, perfilesHuerfanos, purgarEspaciosVacios, selectedOrphanSpaces, setLimpiezaEspacioId, setSelectedOrphanSpaces, vaciarTransaccionesHogar }) {
  return (
    <div className="space-y-6">
      {/* PURGAR ESPACIOS VACÍOS */}
      <div className="glass-card p-6 border-dashed border-white/10 relative overflow-hidden">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h3 className="font-bold text-white text-base">Purgar Hogares Vacíos (Basura)</h3>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mt-1">
              Espacios creados que no tienen miembros activos ({espacios.filter(e => e.miembros_count === 0).length} hogares)
            </p>
          </div>
          <button 
            onClick={purgarEspaciosVacios}
            disabled={espacios.filter(e => e.miembros_count === 0).length === 0}
            className="bg-red-600 hover:bg-red-500 disabled:opacity-30 disabled:hover:bg-red-600 text-white font-black text-xs px-4 py-3 rounded-xl shadow-lg shadow-red-600/20 transition-all flex items-center gap-2 active:scale-95"
          >
            <Trash size={14}/> PURGAR ESPACIOS VACÍOS
          </button>
        </div>

        {espacios.filter(e => e.miembros_count === 0).length > 0 && (
          <div className="mt-6 bg-black/25 rounded-xl border border-white/5 p-3 max-h-48 overflow-y-auto space-y-2">
            {espacios.filter(e => e.miembros_count === 0).map(e => (
              <div key={e.id} className="flex justify-between items-center text-xs py-1 border-b border-white/5 last:border-0">
                <span className="text-slate-300 font-bold">{e.nombre_familia}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* VACIAR MOVIMIENTOS DE UN HOGAR */}
      <div className="glass-card p-6 border-dashed border-white/10 relative overflow-hidden">
        <h3 className="font-bold text-white text-base mb-2">Vaciar Movimientos de un Hogar</h3>
        <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-4">
          Elimina todos los gastos, ingresos, deudas y alertas de un hogar específico (respetando RLS)
        </p>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
          <div className="flex-1">
            <select 
              className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-base text-white outline-none focus:border-indigo-500/50" 
              value={limpiezaEspacioId} 
              onChange={(e) => setLimpiezaEspacioId(e.target.value)}
            >
              <option value="">-- Selecciona un Hogar / Familia --</option>
              {espacios.map(e => (
                <option key={e.id} value={e.id}>{e.nombre_familia} ({e.miembros_count} miembros)</option>
              ))}
            </select>
          </div>
          <button 
            onClick={vaciarTransaccionesHogar}
            disabled={limpiandoTransacciones || !limpiezaEspacioId}
            className="bg-amber-600 hover:bg-amber-500 disabled:opacity-30 disabled:hover:bg-amber-600 text-white font-black text-xs px-6 py-3 rounded-xl shadow-lg shadow-amber-600/20 transition-all flex items-center justify-center gap-2 active:scale-95 whitespace-nowrap"
          >
            {limpiandoTransacciones ? <Loader2 className="animate-spin w-4 h-4"/> : <Trash2 size={14}/>} VACIAR MOVIMIENTOS A CERO
          </button>
        </div>
      </div>

      {/* PERFILES HUÉRFANOS */}
      <div className="glass-card p-6 border-dashed border-white/10">
        <h3 className="font-bold text-white text-base mb-2">Perfiles de Usuarios Huérfanos</h3>
        <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-4">
          Perfiles creados que no se han vinculado a ningún hogar ({perfilesHuerfanos.length} perfiles)
        </p>

        {perfilesHuerfanos.length === 0 ? (
          <div className="text-center py-6 text-slate-600 text-xs italic">No hay perfiles huérfanos registrados</div>
        ) : (
          <div className="bg-black/25 rounded-xl border border-white/5 p-3 space-y-2 max-h-60 overflow-y-auto">
            {perfilesHuerfanos.map(p => (
              <div key={p.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs py-3 border-b border-white/5 last:border-0 pr-1">
                <div>
                  <span className="text-slate-200 font-bold">{p.nombre}</span>
                  <span className="text-[9px] text-slate-500 block">ID: {p.id.substring(0, 8)}...</span>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <select 
                    className="bg-slate-900 border border-white/10 rounded-lg px-2 py-1.5 text-base text-white outline-none w-full sm:w-44"
                    value={selectedOrphanSpaces[p.id] || ""}
                    onChange={(e) => {
                      setSelectedOrphanSpaces(prev => ({ ...prev, [p.id]: e.target.value }));
                    }}
                  >
                    <option value="">-- Vincular a Hogar --</option>
                    {espacios.map(es => (
                      <option key={es.id} value={es.id} disabled={es.miembros_count >= es.limite_usuarios}>
                        {es.nombre_familia} ({es.miembros_count}/{es.limite_usuarios})
                      </option>
                    ))}
                  </select>
                  <button 
                    onClick={() => ejecutarVinculacionUsuarioExistente(null, p.id, selectedOrphanSpaces[p.id])}
                    disabled={!selectedOrphanSpaces[p.id] || guardando}
                    className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 disabled:hover:bg-emerald-600 text-white font-bold text-[9px] px-3 py-2 rounded-lg transition-all"
                  >
                    VINCULAR
                  </button>
                  <button 
                    onClick={() => eliminarPerfil(p.id, p.nombre)}
                    className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                    title="Eliminar Perfil"
                  >
                    <Trash2 size={14}/>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
