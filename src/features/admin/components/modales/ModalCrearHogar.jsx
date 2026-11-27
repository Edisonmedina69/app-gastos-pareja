import { FormPage } from '../../../../shared/ui/FormPage';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Plus, Loader2, X } from 'lucide-react';

export default function ModalCrearHogar({ crearEspacio, guardando, limiteUsuarios, mostrarModalCrear, nuevoHogarNombre, setLimiteUsuarios, setMostrarModalCrear, setNuevoNombre, setUsuario1Nombre, setUsuario1Password, setUsuario2Nombre, setUsuario2Password, usuario1Nombre, usuario1Password, usuario2Nombre, usuario2Password }) {
  return (
    <AnimatePresence>
      {mostrarModalCrear && (
        <FormPage ariaLabel="Crear hogar" onClose={() => setMostrarModalCrear(false)}>
            <h2 className="text-xl font-black text-white mb-6 uppercase flex items-center gap-2">
              <Plus className="w-5 h-5 text-indigo-400" /> Nuevo Espacio Compartido
            </h2>

            <form onSubmit={crearEspacio} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Nombre de la Familia / Cliente</label>
                <input 
                  type="text" 
                  placeholder="Ej: Familia Medina..." 
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500/50 text-base" 
                  value={nuevoHogarNombre} 
                  onChange={(e) => setNuevoNombre(e.target.value)} 
                  required 
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Plan / Límite de Usuarios</label>
                <select 
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white outline-none text-base" 
                  value={limiteUsuarios} 
                  onChange={(e) => setLimiteUsuarios(e.target.value)}
                >
                  <option value="1">Plan 1 Usuario</option>
                  <option value="2">Plan 2 Usuarios</option>
                  <option value="5">Plan 5 Usuarios</option>
                  <option value="10">Plan 10 Usuarios</option>
                </select>
              </div>

              <div className="border-t border-white/10 pt-4 space-y-3">
                <span className="text-xs font-black text-indigo-400 uppercase tracking-wider flex items-center gap-1.5"><Users size={14}/> Registrar Usuario 1 (Opcional)</span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] font-bold text-slate-500 uppercase ml-1">Nombre de Usuario</label>
                    <input 
                      type="text" 
                      placeholder="Ej: carlos" 
                      className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5 text-base text-white outline-none" 
                      value={usuario1Nombre} 
                      onChange={(e) => setUsuario1Nombre(e.target.value)} 
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-slate-500 uppercase ml-1">Contraseña</label>
                    <input 
                      type="password" 
                      placeholder="••••••••" 
                      className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5 text-base text-white outline-none" 
                      value={usuario1Password} 
                      onChange={(e) => setUsuario1Password(e.target.value)} 
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-white/10 pt-4 space-y-3">
                <span className="text-xs font-black text-indigo-400 uppercase tracking-wider flex items-center gap-1.5"><Users size={14}/> Registrar Usuario 2 (Opcional)</span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] font-bold text-slate-500 uppercase ml-1">Nombre de Usuario</label>
                    <input 
                      type="text" 
                      placeholder="Ej: maria" 
                      className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5 text-base text-white outline-none" 
                      value={usuario2Nombre} 
                      onChange={(e) => setUsuario2Nombre(e.target.value)} 
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-slate-500 uppercase ml-1">Contraseña</label>
                    <input 
                      type="password" 
                      placeholder="••••••••" 
                      className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5 text-base text-white outline-none" 
                      value={usuario2Password} 
                      onChange={(e) => setUsuario2Password(e.target.value)} 
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-4 border-t border-white/10">
                <button type="button" onClick={() => setMostrarModalCrear(false)} className="flex-1 py-4 bg-white/5 text-slate-400 font-bold rounded-2xl hover:bg-white/10 transition-all text-xs">CANCELAR</button>
                <button type="submit" disabled={guardando} className="flex-[2] bg-indigo-600 text-white font-black py-4 rounded-xl shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 transition-all text-xs">
                  {guardando ? <Loader2 className="animate-spin mx-auto"/> : "CREAR HOGAR Y CUENTAS"}
                </button>
              </div>
            </form>
        </FormPage>
      )}
    </AnimatePresence>
  );
}
