import { useState, useEffect } from "react";
import { supabase } from "../supabase";
import { toast } from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Users, 
  Home, 
  Plus, 
  Key, 
  Copy, 
  Check, 
  ArrowRight, 
  Loader2, 
  Database,
  Search,
  ShieldCheck
} from "lucide-react";

export default function SuperadminPanel() {
  const [espacios, setEspacios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [mostrarModalCrear, setMostrarModalCrear] = useState(false);
  const [nuevoHogarNombre, setNuevoNombre] = useState("");
  const [limiteUsuarios, setLimiteUsuarios] = useState(2);
  const [guardando, setGuardando] = useState(false);
  const [copiadoId, setCopiadoId] = useState(null);

  useEffect(() => {
    cargarEspacios();
  }, []);

  async function cargarEspacios() {
    setCargando(true);
    // Cargamos espacios y contamos perfiles asociados (HU-23)
    const { data } = await supabase
      .from("espacios")
      .select("*, perfiles(id)")
      .order("created_at", { ascending: false });
    
    if (data) {
      const formateados = data.map(e => ({
        ...e,
        miembros_count: e.perfiles?.length || 0
      }));
      setEspacios(formateados);
    }
    setCargando(false);
  }

  async function crearEspacio(e) {
    e.preventDefault();
    if (!nuevoHogarNombre.trim()) return;

    setGuardando(true);
    const toastId = toast.loading("Creando nuevo hogar...");

    try {
      const codigo = Math.random().toString(36).substring(2, 8).toUpperCase();

      const { error } = await supabase
        .from("espacios")
        .insert([{ 
          nombre_familia: nuevoHogarNombre.trim(),
          codigo_invitacion: codigo,
          limite_usuarios: parseInt(limiteUsuarios)
        }]);

      if (error) throw error;

      toast.success("¡Espacio creado! Comparte el código.", { id: toastId });
      setNuevoNombre("");
      setLimiteUsuarios(2);
      setMostrarModalCrear(false);
      cargarEspacios();
    } catch (err) {
      toast.error("Error: " + err.message, { id: toastId });
    } finally {
      setGuardando(false);
    }
  }

  const copiarCodigo = (id, codigo) => {
    navigator.clipboard.writeText(codigo);
    setCopiadoId(id);
    setTimeout(() => setCopiadoId(null), 2000);
  };

  const filtrados = espacios.filter(e => 
    e.nombre_familia.toLowerCase().includes(busqueda.toLowerCase()) ||
    e.codigo_invitacion?.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-400" /> Panel Superadmin
          </h2>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mt-1">Gestión Global de Clientes</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setMostrarModalCrear(true)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white p-2 rounded-xl shadow-lg shadow-indigo-600/20 transition-all"
        >
          <Plus size={24} />
        </motion.button>
      </header>

      {/* BÚSQUEDA */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
        <input 
          type="text" 
          placeholder="Buscar hogar o código..."
          className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-11 pr-4 text-sm text-white outline-none focus:border-indigo-500/50 transition-all"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      {/* LISTADO DE ESPACIOS */}
      <div className="space-y-4">
        {cargando ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500 gap-4">
            <Loader2 className="animate-spin w-8 h-8" />
            <p className="text-xs font-bold uppercase tracking-tighter">Consultando Base de Datos...</p>
          </div>
        ) : filtrados.length === 0 ? (
          <div className="glass-card py-12 text-center text-slate-500 italic">No se encontraron resultados.</div>
        ) : (
          filtrados.map((e) => (
            <motion.div 
              key={e.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card border-l-4 border-l-indigo-500/50 hover:bg-white/10 transition-all group"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-400">
                    <Home size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-white leading-none">{e.nombre_familia}</h3>
                    <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-widest font-bold">Hogar ID: {e.id.substring(0, 8)}...</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="bg-slate-900/50 px-2 py-1 rounded text-[10px] text-slate-400 font-bold border border-white/5">
                    {new Date(e.created_at).toLocaleDateString()}
                  </div>
                  <div className={`text-[10px] font-black px-2 py-0.5 rounded ${e.miembros_count >= e.limite_usuarios ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                    {e.miembros_count} / {e.limite_usuarios} USUARIOS
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 pt-4 border-t border-white/5">
                <div className="flex-1">
                  <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Código de Invitación</div>
                  <div className="flex items-center gap-2 bg-black/30 p-2 rounded-xl border border-white/5">
                    <span className="flex-1 text-sm font-black tracking-widest text-white pl-2">{e.codigo_invitacion}</span>
                    <button 
                      onClick={() => copiarCodigo(e.id, e.codigo_invitacion)}
                      className="p-2 text-indigo-400 hover:bg-indigo-400/10 rounded-lg transition-colors"
                    >
                      {copiadoId === e.id ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                    </button>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Tokens IA</div>
                  <div className="text-sm font-black text-indigo-300">{e.tokens_ia_disponibles.toLocaleString()}</div>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* MODAL CREAR HOGAR */}
      <AnimatePresence>
        {mostrarModalCrear && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md glass-panel p-6 rounded-3xl relative"
            >
              <button 
                onClick={() => setMostrarModalCrear(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white"
              >
                <Plus size={24} className="rotate-45" />
              </button>

              <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-400" /> Nuevo Espacio/Cliente
              </h2>

              <form onSubmit={crearEspacio} className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Nombre del Hogar / Familia</label>
                  <input
                    type="text"
                    placeholder="Ej: Familia Rodriguez..."
                    className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500/50 transition-all"
                    value={nuevoHogarNombre}
                    onChange={(e) => setNuevoNombre(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Plan / Límite de Usuarios</label>
                  <select
                    className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500/50 transition-all"
                    value={limiteUsuarios}
                    onChange={(e) => setLimiteUsuarios(e.target.value)}
                  >
                    <option value="1">Plan Soltero (1 Usuario)</option>
                    <option value="2">Plan Pareja (2 Usuarios)</option>
                    <option value="5">Plan Familia (5 Usuarios)</option>
                    <option value="10">Plan Premium (10 Usuarios)</option>
                  </select>
                </div>

                <div className="p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl">
                  <p className="text-[10px] text-indigo-300 font-medium leading-relaxed italic">
                    * Al crear el espacio se generará un código único. El cliente deberá usar este código al registrarse para quedar vinculado.
                  </p>
                </div>

                <button 
                  type="submit" 
                  disabled={guardando}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                >
                  {guardando ? <Loader2 className="animate-spin" /> : <>CREAR HOGAR <ArrowRight size={18} /></>}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
