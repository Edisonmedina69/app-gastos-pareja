import { useState } from 'react';
import { cerrarSesion } from '../../../services/auth.service';
import { crearEspacioPropio, unirseAEspacio } from '../../../services/hogar.service';
import { Key, ArrowRight, Loader2, Sparkles, Home } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';

const ConfiguracionHogar = ({ onHogarCreado }) => {
  const [codigo, setCodigo] = useState('');
  const [nombreUsuario, setNombreUsuario] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [modo, setModo] = useState('unirse'); // 'unirse' | 'crear'
  const [nuevoHogarNombre, setNuevoHogarNombre] = useState('');

  const manejarVinculacion = async (e) => {
    e.preventDefault();
    if (!codigo.trim() || !nombreUsuario.trim()) return;

    setGuardando(true);
    const toastId = toast.loading("Buscando y vinculando hogar...");
    try {
      // La unión se valida en el servidor (código, límite de miembros) mediante RPC.
      const { error } = await unirseAEspacio(codigo.trim(), nombreUsuario.trim());
      if (error) throw new Error(error.message);

      toast.success('¡Vinculado con éxito al hogar! 🏠', { id: toastId });
      if (onHogarCreado) onHogarCreado();
    } catch (error) {
      toast.error(error.message, { id: toastId });
    } finally {
      setGuardando(false);
    }
  };

  const manejarCreacion = async (e) => {
    e.preventDefault();
    if (!nuevoHogarNombre.trim() || !nombreUsuario.trim()) return;

    setGuardando(true);
    const toastId = toast.loading("Creando tu nuevo hogar...");
    try {
      // El espacio, su código de invitación y el rol admin_hogar se crean en el servidor.
      const { error } = await crearEspacioPropio(nuevoHogarNombre.trim(), nombreUsuario.trim());
      if (error) throw new Error(error.message);

      toast.success("¡Hogar creado con éxito! ✨", { id: toastId });
      if (onHogarCreado) onHogarCreado();
    } catch (error) {
      toast.error(error.message, { id: toastId });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decoración de fondo */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-600/5 rounded-full blur-[120px]" />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-2xl shadow-xl shadow-indigo-500/20 mb-4">
            <Sparkles className="text-white w-8 h-8 animate-pulse" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight italic">ÑandeFinanza</h1>
          <p className="text-slate-400 mt-2">Personalizá tu perfil y configurá tu hogar</p>
        </div>

        <div className="glass-card p-8 shadow-2xl">
          <div className="flex p-1 bg-white/5 rounded-xl border border-white/5 mb-8">
            <button type="button" onClick={() => setModo('unirse')} className={`flex-1 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${modo === 'unirse' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400'}`}>Unirme a mi Pareja 🏠</button>
            <button type="button" onClick={() => setModo('crear')} className={`flex-1 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${modo === 'crear' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400'}`}>Crear Hogar Nuevo ✨</button>
          </div>

          <form onSubmit={modo === 'unirse' ? manejarVinculacion : manejarCreacion} className="space-y-5">
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Tu Nombre o Apodo</label>
              <input
                type="text"
                placeholder="Ej: Edison, Bianca..."
                className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500/50 transition-all text-base"
                value={nombreUsuario}
                onChange={(e) => setNombreUsuario(e.target.value)}
                required
              />
              <p className="text-xs text-slate-400 mt-1 ml-1">Como quieres que tu pareja te vea en la aplicación.</p>
            </div>

            {modo === 'unirse' ? (
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Código de invitación</label>
                <div className="relative">
                  <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Ej: K7M2QX9P"
                    className="w-full bg-slate-900/50 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white outline-none focus:border-indigo-500/50 transition-all text-base"
                    value={codigo}
                    onChange={(e) => setCodigo(e.target.value)}
                    required
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1.5 ml-1">
                  Ingresá el código de invitación que te compartió tu pareja.
                </p>
              </div>
            ) : (
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Nombre de la Familia / Hogar</label>
                <div className="relative font-semibold">
                  <input
                    type="text"
                    placeholder="Ej: Familia Medina-Ubutun..."
                    className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500/50 transition-all text-base"
                    value={nuevoHogarNombre}
                    onChange={(e) => setNuevoHogarNombre(e.target.value)}
                    required
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1 ml-1">Un nombre identificativo para su espacio compartido.</p>
              </div>
            )}

            <button 
              type="submit" 
              disabled={guardando}
              className="w-full bg-indigo-600 hover:bg-indigo-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 mt-6"
            >
              {guardando ? <Loader2 className="animate-spin" /> : <>{modo === 'unirse' ? 'VINCULAR A MI PAREJA' : 'INICIAR MI HOGAR'} <ArrowRight size={18} /></>}
            </button>
          </form>
          
          <div className="mt-8 pt-4 border-t border-white/5 text-center">
            <button 
              onClick={() => cerrarSesion()} 
              className="text-xs font-black uppercase tracking-widest text-slate-400 hover:text-red-400 transition-colors"
            >
              Cerrar Sesión / Volver
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default ConfiguracionHogar;
