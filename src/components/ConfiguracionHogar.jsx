import { useState } from 'react';
import { supabase } from '../supabase'; 
import { Key, ArrowRight, Loader2, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

const ConfiguracionHogar = ({ usuario, onHogarCreado }) => {
  const [codigo, setCodigo] = useState('');
  const [nombreUsuario, setNombreUsuario] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [modo, setModo] = useState('unirse'); // 'unirse' | 'crear'
  const [nuevoHogarNombre, setNuevoHogarNombre] = useState('');

  const manejarVinculacion = async (e) => {
    e.preventDefault();
    if (!codigo.trim() || !nombreUsuario.trim()) return;

    setGuardando(true);
    try {
      // 1. Buscar el espacio por código y traer su límite y miembros actuales
      const { data: espacio, error: errorEspacio } = await supabase
        .from('espacios')
        .select('id, nombre_familia, limite_usuarios, perfiles(id)')
        .eq('codigo_invitacion', codigo.trim().toUpperCase())
        .single();

      if (errorEspacio || !espacio) throw new Error('Código de invitación inválido o vencido.');

      // 2. Verificar límite en frontend (HU-23)
      const miembrosActuales = espacio.perfiles?.length || 0;
      if (miembrosActuales >= espacio.limite_usuarios) {
        throw new Error(`Límite de usuarios alcanzado (${espacio.limite_usuarios}) para este hogar. Contactá al administrador.`);
      }

      // 3. Vincular el perfil (Usamos UPSERT para evitar error de duplicado)
      const { error: errorPerfil } = await supabase
        .from('perfiles')
        .upsert([{ 
          id: usuario.id, 
          espacio_id: espacio.id,
          nombre: nombreUsuario.trim(),
          rol: 'miembro'
        }]);

      if (errorPerfil) {
        if (errorPerfil.message.includes('Límite de usuarios')) {
          throw new Error(errorPerfil.message);
        }
        throw errorPerfil;
      }

      if (onHogarCreado) onHogarCreado();
    } catch (error) {
      alert(error.message);
    } finally {
      setGuardando(false);
    }
  };

  const manejarCreacion = async (e) => {
    e.preventDefault();
    if (!nuevoHogarNombre.trim() || !nombreUsuario.trim()) return;

    setGuardando(true);
    try {
      // 1. Crear el espacio
      const { data: nuevoEspacio, error: errorEspacio } = await supabase
        .from('espacios')
        .insert([{ 
          nombre_familia: nuevoHogarNombre.trim(),
          codigo_invitacion: Math.random().toString(36).substring(2, 8).toUpperCase()
        }])
        .select()
        .single();

      if (errorEspacio) throw errorEspacio;

      // 2. Vincular como admin_hogar (Usamos UPSERT para evitar error de duplicado)
      const { error: errorPerfil } = await supabase
        .from('perfiles')
        .upsert([{ 
          id: usuario.id, 
          espacio_id: nuevoEspacio.id,
          nombre: nombreUsuario.trim(),
          rol: 'admin_hogar'
        }]);

      if (errorPerfil) throw errorPerfil;

      if (onHogarCreado) onHogarCreado();
    } catch (error) {
      alert(error.message);
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
            <Sparkles className="text-white w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight italic">ÑandeFinanza 2.0</h1>
          <p className="text-slate-400 mt-2">Personalizá tu perfil y configurá tu hogar</p>
        </div>

        <div className="glass-card p-8">
          <div className="flex p-1 bg-white/5 rounded-xl border border-white/5 mb-8">
            <button onClick={() => setModo('unirse')} className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${modo === 'unirse' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>Unirme 🏠</button>
            <button onClick={() => setModo('crear')} className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${modo === 'crear' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>Crear Nuevo ✨</button>
          </div>

          <form onSubmit={modo === 'unirse' ? manejarVinculacion : manejarCreacion} className="space-y-4">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Tu Nombre o Apodo</label>
              <input
                type="text"
                placeholder="Ej: Edison, Ale..."
                className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500/50"
                value={nombreUsuario}
                onChange={(e) => setNombreUsuario(e.target.value)}
                required
              />
            </div>

            {modo === 'unirse' ? (
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Código de Invitación</label>
                <div className="relative">
                  <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="ABCDEF"
                    className="w-full bg-slate-900/50 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white font-black tracking-widest outline-none focus:border-indigo-500/50 uppercase"
                    value={codigo}
                    onChange={(e) => setCodigo(e.target.value)}
                    required
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Nombre de la Familia / Hogar</label>
                <input
                  type="text"
                  placeholder="Ej: Familia Medina..."
                  className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500/50"
                  value={nuevoHogarNombre}
                  onChange={(e) => setNuevoHogarNombre(e.target.value)}
                  required
                />
              </div>
            )}

            <button 
              type="submit" 
              disabled={guardando}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 mt-6"
            >
              {guardando ? <Loader2 className="animate-spin" /> : <>{modo === 'unirse' ? 'VINCULAR MI CUENTA' : 'EMPEZAR ÑANDEFINANZA'} <ArrowRight size={18} /></>}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
};

export default ConfiguracionHogar;
