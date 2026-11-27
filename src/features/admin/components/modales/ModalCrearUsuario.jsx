import { FormPage } from '../../../../shared/ui/FormPage';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Loader2, X } from 'lucide-react';

export default function ModalCrearUsuario({ crearUsuarioDirecto, espacios, guardando, mostrarModalCrearUsuario, setMostrarModalCrearUsuario, setUsuarioApodo, setUsuarioEspacioId, setUsuarioNombre, setUsuarioPassword, setUsuarioRol, usuarioApodo, usuarioEspacioId, usuarioNombre, usuarioPassword, usuarioRol }) {
  return (
    <AnimatePresence>
      {mostrarModalCrearUsuario && (
        <FormPage ariaLabel="Crear usuario" onClose={() => setMostrarModalCrearUsuario(false)}>
            <h2 className="text-xl font-black text-white mb-6 uppercase flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-400" /> Crear y Vincular Usuario
            </h2>

            <form onSubmit={crearUsuarioDirecto} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Nombre de Usuario o Email</label>
                <input 
                  type="text" 
                  placeholder="Ej: carlos o tu@email.com" 
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500/50 text-base" 
                  value={usuarioNombre} 
                  onChange={(e) => setUsuarioNombre(e.target.value)} 
                  required 
                />
                <p className="text-[9px] text-slate-500 mt-1 ml-1">Se autocompletará con @nandefinanza.com si no ingresás un email.</p>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Apodo en la aplicación</label>
                <input 
                  type="text" 
                  placeholder="Ej: Carlos" 
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500/50 text-base" 
                  value={usuarioApodo} 
                  onChange={(e) => setUsuarioApodo(e.target.value)} 
                  required 
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Contraseña</label>
                <input 
                  type="password" 
                  placeholder="••••••••" 
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500/50 text-base" 
                  value={usuarioPassword} 
                  onChange={(e) => setUsuarioPassword(e.target.value)} 
                  required 
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Asociar a Hogar / Familia</label>
                <select 
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white outline-none text-base" 
                  value={usuarioEspacioId} 
                  onChange={(e) => setUsuarioEspacioId(e.target.value)}
                  required
                >
                  <option value="">-- Selecciona un Hogar --</option>
                  {espacios.map(e => (
                    <option key={e.id} value={e.id}>{e.nombre_familia} ({e.miembros_count}/{e.limite_usuarios} miembros)</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Rol del Usuario</label>
                <select 
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white outline-none text-base" 
                  value={usuarioRol} 
                  onChange={(e) => setUsuarioRol(e.target.value)}
                >
                  <option value="miembro">Miembro</option>
                  <option value="admin_hogar">Administrador de Hogar</option>
                </select>
              </div>

              <div className="flex gap-2 pt-4">
                <button type="button" onClick={() => setMostrarModalCrearUsuario(false)} className="flex-1 py-4 bg-white/5 text-slate-400 font-bold rounded-2xl hover:bg-white/10 transition-all text-xs">CANCELAR</button>
                <button type="submit" disabled={guardando} className="flex-[2] bg-emerald-600 text-white font-black py-4 rounded-xl shadow-lg shadow-emerald-600/30 hover:bg-emerald-500 transition-all text-xs">
                  {guardando ? <Loader2 className="animate-spin mx-auto"/> : "CREAR Y VINCULAR USUARIO"}
                </button>
              </div>
            </form>
        </FormPage>
      )}
    </AnimatePresence>
  );
}
