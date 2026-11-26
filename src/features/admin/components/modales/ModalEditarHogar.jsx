import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, X, Edit2 } from 'lucide-react';

export default function ModalEditarHogar({ editLimiteUsuarios, editNombreFamilia, guardando, guardarEdicionEspacio, mostrarModalEditar, setEditLimiteUsuarios, setEditNombreFamilia, setEspacioAEditar, setMostrarModalEditar }) {
  return (
    <AnimatePresence>
      {mostrarModalEditar && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} 
            animate={{ opacity: 1, scale: 1 }} 
            exit={{ opacity: 0, scale: 0.95 }} 
            className="w-full max-w-sm glass-panel p-6 rounded-3xl relative"
          >
            <button 
              onClick={() => { setMostrarModalEditar(false); setEspacioAEditar(null); }} 
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
            >
              <X size={24} />
            </button>
            <h2 className="text-xl font-black text-white mb-6 uppercase flex items-center gap-2">
              <Edit2 className="w-5 h-5 text-indigo-400" /> Editar Espacio
            </h2>
            <form onSubmit={guardarEdicionEspacio} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Nombre de la Familia / Cliente</label>
                <input 
                  type="text" 
                  placeholder="Ej: Familia Medina..." 
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500/50 text-base" 
                  value={editNombreFamilia} 
                  onChange={(e) => setEditNombreFamilia(e.target.value)} 
                  required 
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Plan / Límite de Usuarios</label>
                <select 
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white outline-none text-base" 
                  value={editLimiteUsuarios} 
                  onChange={(e) => setEditLimiteUsuarios(e.target.value)}
                >
                  <option value="1">Plan 1 Usuario</option>
                  <option value="2">Plan 2 Usuarios</option>
                  <option value="5">Plan 5 Usuarios</option>
                  <option value="10">Plan 10 Usuarios</option>
                </select>
              </div>
              <div className="flex gap-2 pt-4">
                <button 
                  type="button" 
                  onClick={() => { setMostrarModalEditar(false); setEspacioAEditar(null); }} 
                  className="flex-1 py-4 bg-white/5 text-slate-400 font-bold rounded-2xl hover:bg-white/10 transition-all"
                >
                  CANCELAR
                </button>
                <button 
                  type="submit" 
                  disabled={guardando} 
                  className="flex-[2] bg-indigo-600 text-white font-black py-4 rounded-xl shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 transition-all"
                >
                  {guardando ? <Loader2 className="animate-spin mx-auto"/> : "GUARDAR CAMBIOS"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
