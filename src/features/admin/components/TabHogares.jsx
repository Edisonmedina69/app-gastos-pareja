import { motion } from 'framer-motion';
import { Home, Loader2, Search, Trash2, ChevronLeft, ChevronRight, X, Edit2 } from 'lucide-react';

export default function TabHogares({ busqueda, cargando, datosHogar, desvincularMiembro, eliminarEspacio, espaciosPaginados, paginaActual, setBusqueda, setPaginaActual, totalPaginas, abrirEditarEspacio, abrirCrearUsuario, abrirVincularExistente, abrirEditarPerfil }) {
  return (
    <>
      {/* BÚSQUEDA */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
        <input 
          type="text" 
          placeholder="Buscar hogar o código..." 
          className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 pl-11 pr-4 text-base text-white outline-none focus:border-indigo-500/50 transition-all" 
          value={busqueda} 
          onChange={(e) => { setBusqueda(e.target.value); setPaginaActual(1); }} 
        />
      </div>

      {/* LISTADO CON PAGINACIÓN */}
      <div className="space-y-4">
        {cargando ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-50">
            <Loader2 className="animate-spin w-8 h-8 text-indigo-400" />
            <p className="text-xs font-black uppercase tracking-widest">Consultando Base de Datos...</p>
          </div>
        ) : espaciosPaginados.length === 0 ? (
          <div className="glass-card py-12 text-center text-slate-400 italic border-dashed">No hay resultados registrados</div>
        ) : (
          espaciosPaginados.map((e) => (
            <motion.div 
              key={e.id} 
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }} 
              className={`glass-card border-l-4 ${e.id === datosHogar?.espacio_id ? 'border-l-emerald-500 bg-emerald-500/5' : 'border-l-indigo-500'} group relative`}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${e.id === datosHogar?.espacio_id ? 'bg-emerald-500/10 text-emerald-400' : 'bg-indigo-500/10 text-indigo-400'}`}>
                    <Home size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm flex items-center gap-2">
                      {e.nombre_familia} 
                      {e.id === datosHogar?.espacio_id && <span className="text-xs bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full font-black border border-emerald-500/20">MI HOGAR</span>}
                    </h3>
                    <p className="text-xs text-slate-400 uppercase font-black">Plan {e.limite_usuarios} Usuarios</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => abrirEditarEspacio(e)}
                    className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-indigo-400/10 rounded-lg transition-all"
                    title="Editar Hogar"
                  >
                    <Edit2 size={18}/>
                  </button>
                  {e.id !== datosHogar?.espacio_id && (
                    <button 
                      onClick={() => eliminarEspacio(e.id, e.nombre_familia)} 
                      className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                      title="Eliminar Hogar permanentemente"
                    >
                      <Trash2 size={18}/>
                    </button>
                  )}
                </div>
              </div>

              <div className="mb-4 bg-black/10 p-2.5 rounded-xl border border-white/5">
                <div className="flex justify-between items-center mb-2">
                  <div className="text-xs text-slate-400 font-bold uppercase tracking-widest">Miembros Activos ({e.miembros_count}/{e.limite_usuarios})</div>
                  {e.miembros_count < e.limite_usuarios && (
                    <div className="flex gap-2">
                      <button 
                        onClick={() => abrirCrearUsuario(e.id)}
                        className="text-xs font-black text-indigo-400 hover:text-indigo-300 transition-colors uppercase tracking-wider"
                      >
                        + CREAR NUEVO
                      </button>
                      <span className="text-slate-400 text-xs font-bold">|</span>
                      <button 
                        onClick={() => abrirVincularExistente(e.id)}
                        className="text-xs font-black text-emerald-400 hover:text-emerald-300 transition-colors uppercase tracking-wider"
                      >
                        + VINCULAR EXISTENTE
                      </button>
                    </div>
                  )}
                </div>
                {e.perfiles && e.perfiles.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {e.perfiles.map(p => (
                      <span key={p.id} className="text-xs font-bold bg-white/5 border border-white/10 text-slate-300 px-2 py-1 rounded-lg flex items-center gap-2">
                        <span className="text-white">{p.nombre}</span>
                        <span className="text-xs opacity-50 uppercase font-black">({p.rol})</span>
                        <div className="flex items-center gap-1 border-l border-white/10 pl-2">
                          <button 
                            onClick={() => abrirEditarPerfil(p)}
                            className="text-slate-400 hover:text-indigo-400 p-0.5 rounded transition-all"
                            title="Editar Perfil"
                          >
                            <Edit2 size={10} />
                          </button>
                          {p.id !== datosHogar?.id && (
                            <button 
                              onClick={() => desvincularMiembro(p.id, p.nombre, e.nombre_familia)}
                              className="text-slate-400 hover:text-red-400 p-0.5 rounded transition-all focus:outline-none"
                              title={`Desvincular a ${p.nombre}`}
                            >
                              <X size={10} />
                            </button>
                          )}
                        </div>
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 italic py-1 pl-1">Sin miembros registrados. Utiliza el botón + AGREGAR USUARIO de arriba.</div>
                )}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-white/5">
                <div>
                  <div className="text-xs text-slate-400 font-black uppercase mb-1">Actividad</div>
                  <div className={`text-xs font-black px-2 py-0.5 rounded-full ${e.miembros_count >= e.limite_usuarios ? 'bg-amber-500/20 text-amber-500' : 'bg-emerald-500/20 text-emerald-400'}`}>
                    {e.miembros_count}/{e.limite_usuarios} ACTIVOS
                  </div>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* CONTROLES DE PAGINACIÓN */}
      {totalPaginas > 1 && (
        <div className="flex items-center justify-between glass-card py-3 px-6">
          <button 
            disabled={paginaActual === 1} 
            onClick={() => setPaginaActual(p => p - 1)} 
            className="p-2 text-slate-400 hover:text-white disabled:opacity-20 transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Página {paginaActual} de {totalPaginas}</span>
          <button 
            disabled={paginaActual === totalPaginas} 
            onClick={() => setPaginaActual(p => p + 1)} 
            className="p-2 text-slate-400 hover:text-white disabled:opacity-20 transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      )}
    </>
  );
}
