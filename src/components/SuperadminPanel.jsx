import { useState, useEffect } from "react";
import { supabase } from "../supabase";
import { toast } from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Users, Home, Plus, Key, Copy, Check, ArrowRight, Loader2, 
  Search, ShieldCheck, Trash2, ChevronLeft, ChevronRight 
} from "lucide-react";

export default function SuperadminPanel({ datosHogar }) {
  const [espacios, setEspacios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [mostrarModalCrear, setMostrarModalCrear] = useState(false);
  const [nuevoHogarNombre, setNuevoNombre] = useState("");
  const [limiteUsuarios, setLimiteUsuarios] = useState(2);
  const [guardando, setGuardando] = useState(false);
  const [copiadoId, setCopiadoId] = useState(null);

  // --- PAGINACIÓN ---
  const [paginaActual, setPaginaActual] = useState(1);
  const itemsPorPagina = 10;

  useEffect(() => {
    cargarEspacios();
  }, []);

  async function cargarEspacios() {
    setCargando(true);
    try {
      // Cargamos espacios con conteo de perfiles para ver actividad real
      const { data, error } = await supabase
        .from("espacios")
        .select("*, perfiles(id)")
        .order("created_at", { ascending: false });
      
      if (error) throw error;

      if (data) {
        const formateados = data.map(e => ({
          ...e,
          miembros_count: e.perfiles?.length || 0
        }));
        setEspacios(formateados);
      }
    } catch (err) {
      console.error("Panel error:", err);
      toast.error("Error al cargar la lista de hogares");
    } finally {
      setCargando(false);
    }
  }

  async function crearEspacio(e) {
    e.preventDefault();
    if (!nuevoHogarNombre.trim()) return;
    setGuardando(true);
    const toastId = toast.loading("Creando nuevo espacio seguro...");
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
      toast.success("¡Hogar creado con éxito! 🏠✨", { id: toastId });
      setNuevoNombre(""); setLimiteUsuarios(2); setMostrarModalCrear(false);
      await cargarEspacios(); // Recarga real de la lista
    } catch (err) { 
      toast.error("No se pudo crear: " + err.message, { id: toastId }); 
    } finally { 
      setGuardando(false); 
    }
  }

  async function eliminarEspacio(id, nombre) {
    // 🛡️ Salvaguarda Crítica
    if (id === datosHogar?.espacio_id) {
      toast.error("⚠️ Operación bloqueada: No podés borrar tu propio hogar administrativo. ¡Cuidado, kape!", { duration: 4000 });
      return;
    }

    const confirmar = window.confirm(`🔥 ATENCIÓN: ¿Seguro que querés eliminar "${nombre}"?\n\nEsta acción borrará todos los gastos, deudas, perfiles y datos de ese hogar para siempre. No hay vuelta atrás.`);
    
    if (confirmar) {
      const toastId = toast.loading("Borrando todo el espacio...");
      try {
        // Ejecutamos el delete. Gracias a ON DELETE CASCADE en PostgreSQL (Fase 7), se borra todo lo vinculado.
        const { error } = await supabase
          .from("espacios")
          .delete()
          .eq("id", id);
        
        if (error) throw error;
        
        toast.success("Hogar eliminado permanentemente.", { id: toastId });
        
        // 🔥 FIX: Actualización de estado local inmediata para que desaparezca de pantalla
        setEspacios(prev => prev.filter(e => e.id !== id));
        
        // Si estábamos en una página que quedó vacía, retroceder
        if (espaciosPaginados.length === 1 && paginaActual > 1) {
          setPaginaActual(paginaActual - 1);
        }
      } catch (err) {
        toast.error("Hendy la eliminación: " + err.message, { id: toastId });
        console.error("Delete error:", err);
      }
    }
  }

  const copiarCodigo = (id, codigo) => {
    navigator.clipboard.writeText(codigo);
    setCopiadoId(id);
    toast.success("Código copiado al portapapeles 📋");
    setTimeout(() => setCopiadoId(null), 2000);
  };

  const filtrados = espacios.filter(e => 
    e.nombre_familia.toLowerCase().includes(busqueda.toLowerCase()) ||
    e.codigo_invitacion?.toLowerCase().includes(busqueda.toLowerCase())
  );

  const totalPaginas = Math.ceil(filtrados.length / itemsPorPagina) || 1;
  const indexInicio = (paginaActual - 1) * itemsPorPagina;
  const espaciosPaginados = filtrados.slice(indexInicio, indexInicio + itemsPorPagina);

  return (
    <div className="space-y-6 pb-20">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-indigo-400" /> Panel de Control
          </h2>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black mt-1">Gestión de Clientes (SaaS)</p>
        </div>
        <motion.button 
          whileHover={{ scale: 1.05 }} 
          whileTap={{ scale: 0.95 }} 
          onClick={() => setMostrarModalCrear(true)} 
          className="bg-indigo-600 p-2.5 rounded-xl text-white shadow-lg shadow-indigo-600/20"
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
          className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 pl-11 pr-4 text-sm text-white outline-none focus:border-indigo-500/50 transition-all" 
          value={busqueda} 
          onChange={(e) => { setBusqueda(e.target.value); setPaginaActual(1); }} 
        />
      </div>

      {/* LISTADO CON PAGINACIÓN */}
      <div className="space-y-4">
        {cargando ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-50">
            <Loader2 className="animate-spin w-8 h-8 text-indigo-400" />
            <p className="text-[10px] font-black uppercase tracking-widest">Consultando Base de Datos...</p>
          </div>
        ) : espaciosPaginados.length === 0 ? (
          <div className="glass-card py-12 text-center text-slate-500 italic border-dashed">No hay resultados registrados</div>
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
                      {e.id === datosHogar?.espacio_id && <span className="text-[8px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full font-black border border-emerald-500/20">MI HOGAR</span>}
                    </h3>
                    <p className="text-[9px] text-slate-500 uppercase font-black">Plan {e.limite_usuarios} Usuarios</p>
                  </div>
                </div>
                {e.id !== datosHogar?.espacio_id && (
                  <button 
                    onClick={() => eliminarEspacio(e.id, e.nombre_familia)} 
                    className="p-2 text-slate-600 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                    title="Eliminar Hogar permanentemente"
                  >
                    <Trash2 size={18}/>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-4 pt-4 border-t border-white/5">
                <div className="flex-1">
                  <div className="text-[8px] text-slate-500 font-bold uppercase tracking-widest mb-1">Código Único de Invitación</div>
                  <div className="flex items-center gap-2 bg-black/30 p-2 rounded-xl border border-white/5">
                    <span className="flex-1 text-xs font-black tracking-widest text-indigo-400 pl-2 uppercase">{e.codigo_invitacion}</span>
                    <button onClick={() => copiarCodigo(e.id, e.codigo_invitacion)} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                      {copiadoId === e.id ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} className="text-slate-400" />}
                    </button>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[8px] text-slate-500 font-black uppercase mb-1">Actividad</div>
                  <div className={`text-[10px] font-black px-2 py-0.5 rounded-full ${e.miembros_count >= e.limite_usuarios ? 'bg-amber-500/20 text-amber-500' : 'bg-emerald-500/20 text-emerald-400'}`}>
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
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Página {paginaActual} de {totalPaginas}</span>
          <button 
            disabled={paginaActual === totalPaginas} 
            onClick={() => setPaginaActual(p => p + 1)} 
            className="p-2 text-slate-400 hover:text-white disabled:opacity-20 transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      )}

      {/* MODAL CREAR HOGAR */}
      <AnimatePresence>
        {mostrarModalCrear && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }} 
              className="w-full max-w-sm glass-panel p-6 rounded-3xl relative"
            >
              <button onClick={() => setMostrarModalCrear(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"><X size={24} /></button>
              <h2 className="text-xl font-black text-white mb-6 uppercase flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-400" /> Nuevo Espacio
              </h2>
              <form onSubmit={crearEspacio} className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Nombre de la Familia / Cliente</label>
                  <input 
                    type="text" 
                    placeholder="Ej: Familia Medina..." 
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500/50" 
                    value={nuevoHogarNombre} 
                    onChange={(e) => setNuevoNombre(e.target.value)} 
                    required 
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Plan / Límite de Usuarios</label>
                  <select 
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white outline-none" 
                    value={limiteUsuarios} 
                    onChange={(e) => setLimiteUsuarios(e.target.value)}
                  >
                    <option value="1">Plan 1 Usuario</option>
                    <option value="2">Plan 2 Usuarios</option>
                    <option value="5">Plan 5 Usuarios</option>
                    <option value="10">Plan 10 Usuarios</option>
                  </select>
                </div>
                <div className="flex gap-2 pt-4">
                  <button type="button" onClick={() => setMostrarModalCrear(false)} className="flex-1 py-4 bg-white/5 text-slate-400 font-bold rounded-2xl hover:bg-white/10 transition-all">CANCELAR</button>
                  <button type="submit" disabled={guardando} className="flex-[2] bg-indigo-600 text-white font-black py-4 rounded-xl shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 transition-all">
                    {guardando ? <Loader2 className="animate-spin mx-auto"/> : "CREAR HOGAR"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
