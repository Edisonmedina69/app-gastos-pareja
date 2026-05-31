import { useState } from 'react';
import { supabase } from '../supabase'; 
import { Key, ArrowRight, Loader2, Sparkles, Home } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';

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
    const toastId = toast.loading("Buscando y vinculando hogar...");
    try {
      const inputLimpio = codigo.trim();
      let espacio = null;

      // 1. Primero intentar buscar como código de invitación (alfanumérico de 6 caracteres)
      if (inputLimpio.length === 6 && /^[A-Z0-9]+$/i.test(inputLimpio)) {
        const { data: esp, error: errorEspacio } = await supabase
          .from('espacios')
          .select('id, nombre_familia, limite_usuarios, perfiles(id)')
          .eq('codigo_invitacion', inputLimpio.toUpperCase())
          .maybeSingle();
        
        if (esp) {
          espacio = esp;
        }
      }

      // 2. Si no es un código o no se encontró espacio por código, buscar por nombre/apodo de la pareja
      if (!espacio) {
        const { data: perfilesPareja, error: errorPerfiles } = await supabase
          .from('perfiles')
          .select('espacio_id, nombre, roles:rol, espacios(id, nombre_familia, limite_usuarios, perfiles(id))')
          .ilike('nombre', inputLimpio)
          .limit(5);

        if (errorPerfiles) throw errorPerfiles;

        if (perfilesPareja && perfilesPareja.length > 0) {
          // Filtrar los perfiles que tengan un espacio válido
          const perfilesValidos = perfilesPareja.filter(p => p.espacios);
          if (perfilesValidos.length > 0) {
            // Tomamos la primera coincidencia
            espacio = perfilesValidos[0].espacios;
          }
        }
      }

      if (!espacio) {
        throw new Error('No encontramos ningún hogar activo con ese código o con ese nombre de pareja. Verificalo e intentá de nuevo.');
      }

      // 3. Verificar límite de miembros (Pareja = máx 2)
      const miembrosActuales = espacio.perfiles?.length || 0;
      if (miembrosActuales >= espacio.limite_usuarios) {
        throw new Error(`El hogar "${espacio.nombre_familia}" ya tiene el límite de usuarios alcanzado (${espacio.limite_usuarios}).`);
      }

      // 4. Vincular el perfil (Usamos UPSERT para evitar error de duplicado)
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

      toast.success(`¡Vinculado con éxito al hogar de ${espacio.nombre_familia}! 🏠`, { id: toastId });
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
            <button type="button" onClick={() => setModo('unirse')} className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${modo === 'unirse' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}>Unirme a mi Pareja 🏠</button>
            <button type="button" onClick={() => setModo('crear')} className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${modo === 'crear' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}>Crear Hogar Nuevo ✨</button>
          </div>

          <form onSubmit={modo === 'unirse' ? manejarVinculacion : manejarCreacion} className="space-y-5">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Tu Nombre o Apodo</label>
              <input
                type="text"
                placeholder="Ej: Edison, Bianca..."
                className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500/50 transition-all"
                value={nombreUsuario}
                onChange={(e) => setNombreUsuario(e.target.value)}
                required
              />
              <p className="text-[9px] text-slate-500 mt-1 ml-1">Como quieres que tu pareja te vea en la aplicación.</p>
            </div>

            {modo === 'unirse' ? (
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Nombre o Apodo de tu Pareja</label>
                <div className="relative">
                  <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Ej: Bianca"
                    className="w-full bg-slate-900/50 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white outline-none focus:border-indigo-500/50 transition-all"
                    value={codigo}
                    onChange={(e) => setCodigo(e.target.value)}
                    required
                  />
                </div>
                <p className="text-[9px] text-slate-500 mt-1.5 ml-1">
                  Ingresá el **Apodo/Nombre** exacto de tu pareja para vincularte a su hogar.
                </p>
              </div>
            ) : (
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Nombre de la Familia / Hogar</label>
                <div className="relative font-semibold">
                  <input
                    type="text"
                    placeholder="Ej: Familia Medina-Ubutun..."
                    className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500/50 transition-all"
                    value={nuevoHogarNombre}
                    onChange={(e) => setNuevoHogarNombre(e.target.value)}
                    required
                  />
                </div>
                <p className="text-[9px] text-slate-500 mt-1 ml-1">Un nombre identificativo para su espacio compartido.</p>
              </div>
            )}

            <button 
              type="submit" 
              disabled={guardando}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 mt-6"
            >
              {guardando ? <Loader2 className="animate-spin" /> : <>{modo === 'unirse' ? 'VINCULAR A MI PAREJA' : 'INICIAR MI HOGAR'} <ArrowRight size={18} /></>}
            </button>
          </form>
          
          <div className="mt-8 pt-4 border-t border-white/5 text-center">
            <button 
              onClick={() => supabase.auth.signOut()} 
              className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-red-400 transition-colors"
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
