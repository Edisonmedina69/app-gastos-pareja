import { motion, AnimatePresence } from 'framer-motion';
import { Users, Loader2, X } from 'lucide-react';

export default function ModalVincularUsuario({ ejecutarVinculacionUsuarioExistente, espacios, guardando, mostrarModalVincularExistente, perfilesHuerfanos, setMostrarModalVincularExistente, setVincularEspacioId, setVincularPerfilId, vincularEspacioId, vincularPerfilId }) {
  return (
    <AnimatePresence>
      {mostrarModalVincularExistente && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} 
            animate={{ opacity: 1, scale: 1 }} 
            exit={{ opacity: 0, scale: 0.95 }} 
            className="w-full max-w-sm glass-panel p-6 rounded-3xl relative"
          >
            <button 
              onClick={() => { setMostrarModalVincularExistente(false); setVincularPerfilId(""); setVincularEspacioId(""); }} 
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
            >
              <X size={24} />
            </button>
            <h2 className="text-xl font-black text-white mb-6 uppercase flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-400" /> Vincular Existente
            </h2>
            <form onSubmit={ejecutarVinculacionUsuarioExistente} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Seleccionar Usuario Huérfano</label>
                {perfilesHuerfanos.length === 0 ? (
                  <div className="bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-xs text-slate-400 italic mt-1">
                    No hay usuarios huérfanos registrados actualmente.
                  </div>
                ) : (
                  <select 
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-base text-white outline-none" 
                    value={vincularPerfilId} 
                    onChange={(e) => setVincularPerfilId(e.target.value)}
                    required
                  >
                    <option value="">-- Selecciona un Usuario --</option>
                    {perfilesHuerfanos.map(p => (
                      <option key={p.id} value={p.id}>{p.nombre} (ID: {p.id.substring(0,8)}...)</option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Hogar Destino</label>
                <select 
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-base text-white outline-none" 
                  value={vincularEspacioId} 
                  onChange={(e) => setVincularEspacioId(e.target.value)}
                  required
                  disabled={true}
                >
                  {espacios.map(es => (
                    <option key={es.id} value={es.id}>{es.nombre_familia}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 pt-4">
                <button 
                  type="button" 
                  onClick={() => { setMostrarModalVincularExistente(false); setVincularPerfilId(""); setVincularEspacioId(""); }} 
                  className="flex-1 py-4 bg-white/5 text-slate-400 font-bold rounded-2xl hover:bg-white/10 transition-all text-xs"
                >
                  CANCELAR
                </button>
                <button 
                  type="submit" 
                  disabled={guardando || perfilesHuerfanos.length === 0} 
                  className="flex-[2] bg-emerald-700 text-white font-black py-4 rounded-xl shadow-lg shadow-emerald-600/30 hover:bg-emerald-700 transition-all text-xs disabled:opacity-50"
                >
                  {guardando ? <Loader2 className="animate-spin mx-auto"/> : "VINCULAR USUARIO"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
