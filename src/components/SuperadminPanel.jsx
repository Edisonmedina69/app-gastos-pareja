import { useState, useEffect } from "react";
import { supabase } from "../supabase";
import { toast } from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@supabase/supabase-js";
import { 
  Users, Home, Plus, Key, Copy, Check, ArrowRight, Loader2, 
  Search, ShieldCheck, Trash2, ChevronLeft, ChevronRight, X,
  Edit2, Trash, Settings
} from "lucide-react";

// Cliente temporal para crear cuentas de usuario sin interferir ni desloguear al admin
const tempSupabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  }
);

export default function SuperadminPanel({ datosHogar }) {
  const [espacios, setEspacios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [mostrarModalCrear, setMostrarModalCrear] = useState(false);
  const [nuevoHogarNombre, setNuevoNombre] = useState("");
  const [limiteUsuarios, setLimiteUsuarios] = useState(2);
  const [guardando, setGuardando] = useState(false);
  const [copiadoId, setCopiadoId] = useState(null);
  const [mostrarModalEditar, setMostrarModalEditar] = useState(false);
  const [espacioAEditar, setEspacioAEditar] = useState(null);
  const [editNombreFamilia, setEditNombreFamilia] = useState("");
  const [editLimiteUsuarios, setEditLimiteUsuarios] = useState(2);

  // --- EDICIÓN DE PERFIL ---
  const [mostrarModalEditarPerfil, setMostrarModalEditarPerfil] = useState(false);
  const [perfilAEditar, setPerfilAEditar] = useState(null);
  const [editPerfilNombre, setEditPerfilNombre] = useState("");
  const [editPerfilRol, setEditPerfilRol] = useState("miembro");

  // --- VINCULACIÓN DE PERFILES EXISTENTES ---
  const [mostrarModalVincularExistente, setMostrarModalVincularExistente] = useState(false);
  const [vincularPerfilId, setVincularPerfilId] = useState("");
  const [vincularEspacioId, setVincularEspacioId] = useState("");
  const [selectedOrphanSpaces, setSelectedOrphanSpaces] = useState({});

  // --- NUEVOS CAMPOS DE REGISTRO DIRECTO ---
  const [usuario1Nombre, setUsuario1Nombre] = useState("");
  const [usuario1Password, setUsuario1Password] = useState("");
  const [usuario2Nombre, setUsuario2Nombre] = useState("");
  const [usuario2Password, setUsuario2Password] = useState("");

  // --- MODAL DE CREACIÓN DE USUARIO INDEPENDIENTE ---
  const [mostrarModalCrearUsuario, setMostrarModalCrearUsuario] = useState(false);
  const [usuarioNombre, setUsuarioNombre] = useState("");
  const [usuarioPassword, setUsuarioPassword] = useState("");
  const [usuarioApodo, setUsuarioApodo] = useState("");
  const [usuarioEspacioId, setUsuarioEspacioId] = useState("");
  const [usuarioRol, setUsuarioRol] = useState("miembro"); // 'admin_hogar' | 'miembro'

  // --- SECCIONES Y MANTENIMIENTO ---
  const [tabAdmin, setTabAdmin] = useState("hogares"); // "hogares" | "mantenimiento"
  const [perfilesHuerfanos, setPerfilesHuerfanos] = useState([]);
  const [limpiezaEspacioId, setLimpiezaEspacioId] = useState("");
  const [limpiandoTransacciones, setLimpiandoTransacciones] = useState(false);

  // --- PAGINACIÓN ---
  const [paginaActual, setPaginaActual] = useState(1);
  const itemsPorPagina = 10;

  useEffect(() => {
    cargarEspacios();
  }, []);

  function normalizarUsuario(input) {
    const trimValue = input.trim();
    if (trimValue.includes("@")) {
      return trimValue.toLowerCase();
    }
    return `${trimValue.toLowerCase()}@nandefinanza.com`;
  }

  async function cargarEspacios() {
    setCargando(true);
    try {
      // 1. Cargar todos los espacios
      const { data: espData, error: espError } = await supabase
        .from("espacios")
        .select("*, perfiles(id, nombre)")
        .order("created_at", { ascending: false });
      
      if (espError) throw espError;

      if (espData) {
        const formateados = espData.map(e => ({
          ...e,
          miembros_count: e.perfiles?.length || 0,
          perfiles: e.perfiles || []
        }));
        setEspacios(formateados);
      }

      // 2. Cargar perfiles huérfanos (sin espacio_id asignado)
      const { data: perfData, error: perfError } = await supabase
        .from("perfiles")
        .select("*")
        .is("espacio_id", null);
      
      if (perfError) throw perfError;
      setPerfilesHuerfanos(perfData || []);

    } catch (err) {
      console.error("Panel error:", err);
      toast.error("Error al cargar la información de administración");
    } finally {
      setCargando(false);
    }
  }

  async function crearEspacio(e) {
    e.preventDefault();
    if (!nuevoHogarNombre.trim()) return;
    setGuardando(true);
    const toastId = toast.loading("Creando hogar y cuentas...");
    try {
      const codigo = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      // 1. Crear el espacio en la DB
      const { data: espacio, error: errorEspacio } = await supabase
        .from("espacios")
        .insert([{ 
          nombre_familia: nuevoHogarNombre.trim(),
          codigo_invitacion: codigo,
          limite_usuarios: parseInt(limiteUsuarios)
        }])
        .select()
        .single();
        
      if (errorEspacio) throw errorEspacio;

      // 2. Si se ingresó credenciales de Usuario 1, crearlo
      if (usuario1Nombre.trim() && usuario1Password.trim()) {
        const { data: authData1, error: errU1 } = await tempSupabase.auth.signUp({
          email: normalizarUsuario(usuario1Nombre),
          password: usuario1Password
        });

        if (errU1) throw new Error(`Usuario 1: ${errU1.message}`);
        
        if (authData1 && authData1.user) {
          const { error: errP1 } = await supabase.from("perfiles").insert([{
            id: authData1.user.id,
            nombre: usuario1Nombre.trim(),
            rol: 'admin_hogar',
            espacio_id: espacio.id
          }]);
          if (errP1) throw new Error(`Perfil 1: ${errP1.message}`);
        }
      }

      // 3. Si se ingresó credenciales de Usuario 2, crearlo
      if (usuario2Nombre.trim() && usuario2Password.trim()) {
        const { data: authData2, error: errU2 } = await tempSupabase.auth.signUp({
          email: normalizarUsuario(usuario2Nombre),
          password: usuario2Password
        });

        if (errU2) throw new Error(`Usuario 2: ${errU2.message}`);
        
        if (authData2 && authData2.user) {
          const { error: errP2 } = await supabase.from("perfiles").insert([{
            id: authData2.user.id,
            nombre: usuario2Nombre.trim(),
            rol: 'miembro',
            espacio_id: espacio.id
          }]);
          if (errP2) throw new Error(`Perfil 2: ${errP2.message}`);
        }
      }

      toast.success("¡Hogar y cuentas creados exitosamente! 🏠✨", { id: toastId });
      
      // Limpiar estados
      setNuevoNombre("");
      setLimiteUsuarios(2);
      setUsuario1Nombre("");
      setUsuario1Password("");
      setUsuario2Nombre("");
      setUsuario2Password("");
      setMostrarModalCrear(false);
      
      await cargarEspacios(); // Recarga la lista
    } catch (err) { 
      toast.error("Ocurrió un problema: " + err.message, { id: toastId, duration: 5000 }); 
    } finally { 
      setGuardando(false); 
    }
  }

  async function crearUsuarioDirecto(e) {
    e.preventDefault();
    if (!usuarioNombre.trim() || !usuarioPassword.trim() || !usuarioApodo.trim() || !usuarioEspacioId) {
      toast.error("Por favor, completa todos los campos.");
      return;
    }
    setGuardando(true);
    const toastId = toast.loading("Creando cuenta de usuario...");
    try {
      const emailNormalizado = normalizarUsuario(usuarioNombre);
      
      // 1. Registrar usuario en Supabase Auth sin cerrar sesión del admin
      const { data: authData, error: errAuth } = await tempSupabase.auth.signUp({
        email: emailNormalizado,
        password: usuarioPassword
      });

      if (errAuth) throw errAuth;
      if (!authData.user) throw new Error("No se pudo registrar la cuenta en la autenticación.");

      // 2. Insertar perfil vinculado al espacio seleccionado
      const { error: errPerfil } = await supabase
        .from("perfiles")
        .insert([{
          id: authData.user.id,
          nombre: usuarioApodo.trim(),
          rol: usuarioRol,
          espacio_id: usuarioEspacioId
        }]);

      if (errPerfil) throw errPerfil;

      toast.success("¡Usuario creado y vinculado exitosamente! 🚀", { id: toastId });
      
      // Limpiar estados y cerrar modal
      setUsuarioNombre("");
      setUsuarioPassword("");
      setUsuarioApodo("");
      setUsuarioEspacioId("");
      setUsuarioRol("miembro");
      setMostrarModalCrearUsuario(false);
      
      await cargarEspacios(); // Recargar datos
    } catch (err) {
      toast.error("Error al crear usuario: " + err.message, { id: toastId, duration: 5000 });
    } finally {
      setGuardando(false);
    }
  }

  async function guardarEdicionEspacio(e) {
    e.preventDefault();
    if (!espacioAEditar || !editNombreFamilia.trim()) return;
    setGuardando(true);
    const toastId = toast.loading("Guardando cambios del espacio...");
    try {
      const { error } = await supabase
        .from("espacios")
        .update({
          nombre_familia: editNombreFamilia.trim(),
          limite_usuarios: parseInt(editLimiteUsuarios)
        })
        .eq("id", espacioAEditar.id);
      if (error) throw error;
      toast.success("¡Hogar actualizado con éxito! 🏠✨", { id: toastId });
      setMostrarModalEditar(false);
      setEspacioAEditar(null);
      await cargarEspacios();
    } catch (err) {
      toast.error("No se pudo actualizar: " + err.message, { id: toastId });
    } finally {
      setGuardando(false);
    }
  }

  async function guardarEdicionPerfil(e) {
    e.preventDefault();
    if (!perfilAEditar || !editPerfilNombre.trim()) return;
    setGuardando(true);
    const toastId = toast.loading("Guardando cambios del perfil...");
    try {
      const { error } = await supabase
        .from("perfiles")
        .update({
          nombre: editPerfilNombre.trim(),
          rol: editPerfilRol
        })
        .eq("id", perfilAEditar.id);
      
      if (error) throw error;
      toast.success("¡Perfil actualizado con éxito! ✨", { id: toastId });
      setMostrarModalEditarPerfil(false);
      setPerfilAEditar(null);
      await cargarEspacios();
    } catch (err) {
      toast.error("No se pudo actualizar el perfil: " + err.message, { id: toastId });
    } finally {
      setGuardando(false);
    }
  }

  async function ejecutarVinculacionUsuarioExistente(e, overridePerfilId, overrideEspacioId) {
    if (e && e.preventDefault) e.preventDefault();
    const pid = overridePerfilId || vincularPerfilId;
    const eid = overrideEspacioId || vincularEspacioId;

    if (!pid || !eid) {
      toast.error("Por favor, selecciona el usuario y el hogar.");
      return;
    }
    const perfilObj = perfilesHuerfanos.find(p => p.id === pid) || espacios.flatMap(esp => esp.perfiles || []).find(p => p.id === pid);
    const espacioObj = espacios.find(es => es.id === eid);
    
    const perfilNombre = perfilObj ? perfilObj.nombre : "Usuario";
    const espacioNombre = espacioObj ? espacioObj.nombre_familia : "Hogar";

    setGuardando(true);
    const toastId = toast.loading(`Vinculando a ${perfilNombre} a ${espacioNombre}...`);
    try {
      // Verificar si el espacio ya tiene el límite de usuarios
      if (espacioObj && espacioObj.miembros_count >= espacioObj.limite_usuarios) {
        throw new Error(`El hogar "${espacioNombre}" ya alcanzó el límite de ${espacioObj.limite_usuarios} usuarios.`);
      }

      const { error } = await supabase
        .from("perfiles")
        .update({ espacio_id: eid })
        .eq("id", pid);

      if (error) throw error;

      toast.success(`¡Se vinculó a ${perfilNombre} con éxito! 🏠`, { id: toastId });
      setMostrarModalVincularExistente(false);
      setVincularPerfilId("");
      setVincularEspacioId("");
      
      // Limpiar el estado local de dropdowns de mantenimiento
      setSelectedOrphanSpaces(prev => {
        const copy = { ...prev };
        delete copy[pid];
        return copy;
      });

      await cargarEspacios();
    } catch (err) {
      toast.error("Error al vincular: " + err.message, { id: toastId });
    } finally {
      setGuardando(false);
    }
  }

  async function desvincularMiembro(perfilId, nombreMiembro, nombreFamilia) {
    const confirmar = window.confirm(`¿Seguro que querés desvincular a "${nombreMiembro}" del espacio "${nombreFamilia}"?\n\nEl usuario perderá acceso a los datos de este hogar y volverá a la pantalla de configuración.`);
    if (!confirmar) return;

    const toastId = toast.loading(`Desvinculando a ${nombreMiembro}...`);
    try {
      const { error } = await supabase
        .from("perfiles")
        .update({ espacio_id: null })
        .eq("id", perfilId);

      if (error) throw error;

      toast.success(`Se desvinculó a ${nombreMiembro} con éxito.`, { id: toastId });
      await cargarEspacios();
    } catch (err) {
      toast.error(`Error al desvincular: ${err.message}`, { id: toastId });
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
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(codigo)
        .then(() => {
          setCopiadoId(id);
          toast.success("Código copiado al portapapeles 📋");
          setTimeout(() => setCopiadoId(null), 2000);
        })
        .catch(err => {
          console.error("Clipboard error:", err);
          fallbackCopiar(id, codigo);
        });
    } else {
      fallbackCopiar(id, codigo);
    }
  };

  const fallbackCopiar = (id, codigo) => {
    try {
      const textArea = document.createElement("textarea");
      textArea.value = codigo;
      textArea.style.top = "0";
      textArea.style.left = "0";
      textArea.style.position = "fixed";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const exito = document.execCommand('copy');
      document.body.removeChild(textArea);
      if (exito) {
        setCopiadoId(id);
        toast.success("Código copiado al portapapeles 📋");
        setTimeout(() => setCopiadoId(null), 2000);
      } else {
        throw new Error("No se pudo copiar");
      }
    } catch (err) {
      toast.error(`Código: ${codigo} (copialo manualmente)`);
    }
  };

  async function eliminarPerfil(id, nombre) {
    const confirmar = window.confirm(`¿Seguro que querés eliminar el perfil de "${nombre}"?\n\nEsto removerá su perfil en la DB.`);
    if (!confirmar) return;

    const toastId = toast.loading("Eliminando perfil...");
    try {
      const { error } = await supabase
        .from("perfiles")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Perfil de usuario eliminado exitosamente", { id: toastId });
      await cargarEspacios();
    } catch (err) {
      toast.error(`Error al eliminar: ${err.message}`, { id: toastId });
    }
  }

  async function purgarEspaciosVacios() {
    const vacios = espacios.filter(e => e.miembros_count === 0);
    if (vacios.length === 0) {
      toast.success("No hay espacios vacíos para limpiar.");
      return;
    }

    const confirmar = window.confirm(`¿Seguro que querés eliminar los ${vacios.length} espacios vacíos de una sola vez?\n\nEsta acción borrará de forma permanente todos los hogares vacíos registrados.`);
    if (!confirmar) return;

    const toastId = toast.loading("Purgando espacios vacíos...");
    try {
      const ids = vacios.map(e => e.id);
      const { error } = await supabase
        .from("espacios")
        .delete()
        .in("id", ids);

      if (error) throw error;

      toast.success("¡Espacios vacíos eliminados con éxito!", { id: toastId });
      await cargarEspacios();
    } catch (err) {
      toast.error(`Error en la purga: ${err.message}`, { id: toastId });
    }
  }

  async function vaciarTransaccionesHogar() {
    if (!limpiezaEspacioId) {
      toast.error("Por favor, selecciona un hogar.");
      return;
    }
    const hogarSeleccionado = espacios.find(e => e.id === limpiezaEspacioId);
    const nombreHogar = hogarSeleccionado ? hogarSeleccionado.nombre_familia : "este hogar";

    const confirmar = window.confirm(`⚠️ ADVERTENCIA: ¿Seguro que querés vaciar a CERO todos los movimientos de "${nombreHogar}"?\n\nSe eliminarán todos los gastos, ingresos, deudas, cuotas y notificaciones de forma permanente.`);
    if (!confirmar) return;

    setLimpiandoTransacciones(true);
    const toastId = toast.loading("Vaciando movimientos del hogar...");
    try {
      // 1. Eliminar gastos
      const { error: errG } = await supabase.from('gastos').delete().eq('espacio_id', limpiezaEspacioId);
      if (errG) throw errG;

      // 2. Eliminar ingresos
      const { error: errI } = await supabase.from('ingresos_mensuales').delete().eq('espacio_id', limpiezaEspacioId);
      if (errI) throw errI;

      // 3. Eliminar deudas
      const { error: errD } = await supabase.from('deudas_maestras').delete().eq('espacio_id', limpiezaEspacioId);
      if (errD) throw errD;

      // 4. Eliminar notificaciones
      const { error: errN } = await supabase.from('notificaciones').delete().eq('espacio_id', limpiezaEspacioId);
      if (errN) throw errN;

      // 5. Eliminar gastos programados
      const { error: errGP } = await supabase.from('gastos_programados').delete().eq('espacio_id', limpiezaEspacioId);
      if (errGP) throw errGP;

      toast.success(`¡Movimientos de "${nombreHogar}" vaciados a cero con éxito! ✨`, { id: toastId });
      setLimpiezaEspacioId("");
    } catch (err) {
      toast.error("Error al vaciar movimientos: " + err.message, { id: toastId });
    } finally {
      setLimpiandoTransacciones(false);
    }
  }

  const filtrados = espacios.filter(e => 
    e.nombre_familia.toLowerCase().includes(busqueda.toLowerCase())
  );

  const totalPaginas = Math.ceil(filtrados.length / itemsPorPagina) || 1;
  const indexInicio = (paginaActual - 1) * itemsPorPagina;
  const espaciosPaginados = filtrados.slice(indexInicio, indexInicio + itemsPorPagina);

  return (
    <div className="space-y-6 pb-20">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-indigo-400" /> Panel de Control
          </h2>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black mt-1">Gestión de Clientes (SaaS)</p>
        </div>
        <div className="flex gap-2">
          <motion.button 
            whileHover={{ scale: 1.02 }} 
            whileTap={{ scale: 0.98 }} 
            onClick={() => setMostrarModalCrear(true)} 
            className="bg-indigo-600 hover:bg-indigo-500 px-4 py-2.5 rounded-xl text-[10px] font-black text-white shadow-lg shadow-indigo-600/20 flex items-center gap-2 transition-all"
          >
            <Home size={14} /> + CREAR HOGAR
          </motion.button>
          <motion.button 
            whileHover={{ scale: 1.02 }} 
            whileTap={{ scale: 0.98 }} 
            onClick={() => setMostrarModalCrearUsuario(true)} 
            className="bg-emerald-600 hover:bg-emerald-500 px-4 py-2.5 rounded-xl text-[10px] font-black text-white shadow-lg shadow-emerald-600/20 flex items-center gap-2 transition-all"
          >
            <Users size={14} /> + CREAR USUARIO
          </motion.button>
        </div>
      </header>

      {/* TABS DE ADMINISTRACION */}
      <div className="flex border-b border-white/10 mb-6">
        <button 
          type="button"
          onClick={() => setTabAdmin("hogares")}
          className={`flex items-center gap-2 pb-3 px-4 font-bold text-xs uppercase tracking-wider border-b-2 transition-all ${tabAdmin === "hogares" ? "border-indigo-500 text-white" : "border-transparent text-slate-500 hover:text-slate-300"}`}
        >
          <Home size={14} /> Hogares
        </button>
        <button 
          type="button"
          onClick={() => setTabAdmin("mantenimiento")}
          className={`flex items-center gap-2 pb-3 px-4 font-bold text-xs uppercase tracking-wider border-b-2 transition-all ${tabAdmin === "mantenimiento" ? "border-indigo-500 text-white" : "border-transparent text-slate-500 hover:text-slate-300"}`}
        >
          <Settings size={14} /> Limpieza de Base de Datos
        </button>
      </div>

      {tabAdmin === "hogares" ? (
        <>
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
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => {
                          setEspacioAEditar(e);
                          setEditNombreFamilia(e.nombre_familia);
                          setEditLimiteUsuarios(e.limite_usuarios);
                          setMostrarModalEditar(true);
                        }}
                        className="p-2 text-slate-600 hover:text-indigo-400 hover:bg-indigo-400/10 rounded-lg transition-all"
                        title="Editar Hogar"
                      >
                        <Edit2 size={18}/>
                      </button>
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
                  </div>

                  <div className="mb-4 bg-black/10 p-2.5 rounded-xl border border-white/5">
                    <div className="flex justify-between items-center mb-2">
                      <div className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">Miembros Activos ({e.miembros_count}/{e.limite_usuarios})</div>
                      {e.miembros_count < e.limite_usuarios && (
                        <div className="flex gap-2">
                          <button 
                            onClick={() => {
                              setUsuarioEspacioId(e.id);
                              setMostrarModalCrearUsuario(true);
                            }}
                            className="text-[9px] font-black text-indigo-400 hover:text-indigo-300 transition-colors uppercase tracking-wider"
                          >
                            + CREAR NUEVO
                          </button>
                          <span className="text-slate-600 text-[9px] font-bold">|</span>
                          <button 
                            onClick={() => {
                              setVincularEspacioId(e.id);
                              setMostrarModalVincularExistente(true);
                            }}
                            className="text-[9px] font-black text-emerald-400 hover:text-emerald-300 transition-colors uppercase tracking-wider"
                          >
                            + VINCULAR EXISTENTE
                          </button>
                        </div>
                      )}
                    </div>
                    {e.perfiles && e.perfiles.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {e.perfiles.map(p => (
                          <span key={p.id} className="text-[9px] font-bold bg-white/5 border border-white/10 text-slate-300 px-2 py-1 rounded-lg flex items-center gap-2">
                            <span className="text-white">{p.nombre}</span>
                            <span className="text-[8px] opacity-50 uppercase font-black">({p.rol})</span>
                            <div className="flex items-center gap-1 border-l border-white/10 pl-2">
                              <button 
                                onClick={() => {
                                  setPerfilAEditar(p);
                                  setEditPerfilNombre(p.nombre);
                                  setEditPerfilRol(p.rol || "miembro");
                                  setMostrarModalEditarPerfil(true);
                                }}
                                className="text-slate-500 hover:text-indigo-400 p-0.5 rounded transition-all"
                                title="Editar Perfil"
                              >
                                <Edit2 size={10} />
                              </button>
                              {p.id !== datosHogar?.id && (
                                <button 
                                  onClick={() => desvincularMiembro(p.id, p.nombre, e.nombre_familia)}
                                  className="text-slate-500 hover:text-red-400 p-0.5 rounded transition-all focus:outline-none"
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
                      <div className="text-[9px] text-slate-500 italic py-1 pl-1">Sin miembros registrados. Utiliza el botón + AGREGAR USUARIO de arriba.</div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-white/5">
                    <div>
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
        </>
      ) : (
        /* MODO MANTENIMIENTO / LIMPIEZA */
        <div className="space-y-6">
          {/* PURGAR ESPACIOS VACÍOS */}
          <div className="glass-card p-6 border-dashed border-white/10 relative overflow-hidden">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h3 className="font-bold text-white text-base">Purgar Hogares Vacíos (Basura)</h3>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mt-1">
                  Espacios creados que no tienen miembros activos ({espacios.filter(e => e.miembros_count === 0).length} hogares)
                </p>
              </div>
              <button 
                onClick={purgarEspaciosVacios}
                disabled={espacios.filter(e => e.miembros_count === 0).length === 0}
                className="bg-red-600 hover:bg-red-500 disabled:opacity-30 disabled:hover:bg-red-600 text-white font-black text-xs px-4 py-3 rounded-xl shadow-lg shadow-red-600/20 transition-all flex items-center gap-2 active:scale-95"
              >
                <Trash size={14}/> PURGAR ESPACIOS VACÍOS
              </button>
            </div>

            {espacios.filter(e => e.miembros_count === 0).length > 0 && (
              <div className="mt-6 bg-black/25 rounded-xl border border-white/5 p-3 max-h-48 overflow-y-auto space-y-2">
                {espacios.filter(e => e.miembros_count === 0).map(e => (
                  <div key={e.id} className="flex justify-between items-center text-xs py-1 border-b border-white/5 last:border-0">
                    <span className="text-slate-300 font-bold">{e.nombre_familia}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* VACIAR MOVIMIENTOS DE UN HOGAR */}
          <div className="glass-card p-6 border-dashed border-white/10 relative overflow-hidden">
            <h3 className="font-bold text-white text-base mb-2">Vaciar Movimientos de un Hogar</h3>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-4">
              Elimina todos los gastos, ingresos, deudas y alertas de un hogar específico (respetando RLS)
            </p>
            
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              <div className="flex-1">
                <select 
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-indigo-500/50" 
                  value={limpiezaEspacioId} 
                  onChange={(e) => setLimpiezaEspacioId(e.target.value)}
                >
                  <option value="">-- Selecciona un Hogar / Familia --</option>
                  {espacios.map(e => (
                    <option key={e.id} value={e.id}>{e.nombre_familia} ({e.miembros_count} miembros)</option>
                  ))}
                </select>
              </div>
              <button 
                onClick={vaciarTransaccionesHogar}
                disabled={limpiandoTransacciones || !limpiezaEspacioId}
                className="bg-amber-600 hover:bg-amber-500 disabled:opacity-30 disabled:hover:bg-amber-600 text-white font-black text-xs px-6 py-3 rounded-xl shadow-lg shadow-amber-600/20 transition-all flex items-center justify-center gap-2 active:scale-95 whitespace-nowrap"
              >
                {limpiandoTransacciones ? <Loader2 className="animate-spin w-4 h-4"/> : <Trash2 size={14}/>} VACIAR MOVIMIENTOS A CERO
              </button>
            </div>
          </div>

          {/* PERFILES HUÉRFANOS */}
          <div className="glass-card p-6 border-dashed border-white/10">
            <h3 className="font-bold text-white text-base mb-2">Perfiles de Usuarios Huérfanos</h3>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-4">
              Perfiles creados que no se han vinculado a ningún hogar ({perfilesHuerfanos.length} perfiles)
            </p>

            {perfilesHuerfanos.length === 0 ? (
              <div className="text-center py-6 text-slate-600 text-xs italic">No hay perfiles huérfanos registrados</div>
            ) : (
              <div className="bg-black/25 rounded-xl border border-white/5 p-3 space-y-2 max-h-60 overflow-y-auto">
                {perfilesHuerfanos.map(p => (
                  <div key={p.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs py-3 border-b border-white/5 last:border-0 pr-1">
                    <div>
                      <span className="text-slate-200 font-bold">{p.nombre}</span>
                      <span className="text-[9px] text-slate-500 block">ID: {p.id.substring(0, 8)}...</span>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <select 
                        className="bg-slate-900 border border-white/10 rounded-lg px-2 py-1.5 text-[10px] text-white outline-none w-full sm:w-44"
                        value={selectedOrphanSpaces[p.id] || ""}
                        onChange={(e) => {
                          setSelectedOrphanSpaces(prev => ({ ...prev, [p.id]: e.target.value }));
                        }}
                      >
                        <option value="">-- Vincular a Hogar --</option>
                        {espacios.map(es => (
                          <option key={es.id} value={es.id} disabled={es.miembros_count >= es.limite_usuarios}>
                            {es.nombre_familia} ({es.miembros_count}/{es.limite_usuarios})
                          </option>
                        ))}
                      </select>
                      <button 
                        onClick={() => ejecutarVinculacionUsuarioExistente(null, p.id, selectedOrphanSpaces[p.id])}
                        disabled={!selectedOrphanSpaces[p.id] || guardando}
                        className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 disabled:hover:bg-emerald-600 text-white font-bold text-[9px] px-3 py-2 rounded-lg transition-all"
                      >
                        VINCULAR
                      </button>
                      <button 
                        onClick={() => eliminarPerfil(p.id, p.nombre)}
                        className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                        title="Eliminar Perfil"
                      >
                        <Trash2 size={14}/>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
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
              className="w-full max-w-md glass-panel p-6 rounded-3xl relative"
            >
              <button onClick={() => setMostrarModalCrear(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"><X size={24} /></button>
              <h2 className="text-xl font-black text-white mb-6 uppercase flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-400" /> Nuevo Espacio Compartido
              </h2>
              
              <form onSubmit={crearEspacio} className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
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

                <div className="border-t border-white/10 pt-4 space-y-3">
                  <span className="text-xs font-black text-indigo-400 uppercase tracking-wider flex items-center gap-1.5"><Users size={14}/> Registrar Usuario 1 (Opcional)</span>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[9px] font-bold text-slate-500 uppercase ml-1">Nombre de Usuario</label>
                      <input 
                        type="text" 
                        placeholder="Ej: carlos" 
                        className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white outline-none" 
                        value={usuario1Nombre} 
                        onChange={(e) => setUsuario1Nombre(e.target.value)} 
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-slate-500 uppercase ml-1">Contraseña</label>
                      <input 
                        type="password" 
                        placeholder="••••••••" 
                        className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white outline-none" 
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
                        className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white outline-none" 
                        value={usuario2Nombre} 
                        onChange={(e) => setUsuario2Nombre(e.target.value)} 
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-slate-500 uppercase ml-1">Contraseña</label>
                      <input 
                        type="password" 
                        placeholder="••••••••" 
                        className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white outline-none" 
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
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL CREAR USUARIO INDEPENDIENTE */}
      <AnimatePresence>
        {mostrarModalCrearUsuario && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }} 
              className="w-full max-w-md glass-panel p-6 rounded-3xl relative"
            >
              <button onClick={() => setMostrarModalCrearUsuario(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"><X size={24} /></button>
              <h2 className="text-xl font-black text-white mb-6 uppercase flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-400" /> Crear y Vincular Usuario
              </h2>
              
              <form onSubmit={crearUsuarioDirecto} className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Nombre de Usuario o Email</label>
                  <input 
                    type="text" 
                    placeholder="Ej: carlos o tu@email.com" 
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500/50" 
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
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500/50" 
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
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500/50" 
                    value={usuarioPassword} 
                    onChange={(e) => setUsuarioPassword(e.target.value)} 
                    required 
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Asociar a Hogar / Familia</label>
                  <select 
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white outline-none" 
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
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white outline-none" 
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
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL EDITAR HOGAR */}
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
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500/50" 
                    value={editNombreFamilia} 
                    onChange={(e) => setEditNombreFamilia(e.target.value)} 
                    required 
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Plan / Límite de Usuarios</label>
                  <select 
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white outline-none" 
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

      {/* MODAL EDITAR PERFIL DE MIEMBRO */}
      <AnimatePresence>
        {mostrarModalEditarPerfil && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }} 
              className="w-full max-w-sm glass-panel p-6 rounded-3xl relative"
            >
              <button 
                onClick={() => { setMostrarModalEditarPerfil(false); setPerfilAEditar(null); }} 
                className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
              <h2 className="text-xl font-black text-white mb-6 uppercase flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-indigo-400" /> Editar Perfil
              </h2>
              <form onSubmit={guardarEdicionPerfil} className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Apodo en la Aplicación</label>
                  <input 
                    type="text" 
                    placeholder="Ej: Bianca..." 
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500/50" 
                    value={editPerfilNombre} 
                    onChange={(e) => setEditPerfilNombre(e.target.value)} 
                    required 
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Rol del Miembro</label>
                  <select 
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white outline-none" 
                    value={editPerfilRol} 
                    onChange={(e) => setEditPerfilRol(e.target.value)}
                  >
                    <option value="miembro">Miembro</option>
                    <option value="admin_hogar">Administrador de Hogar</option>
                    <option value="superadmin">Superadministrador (SaaS)</option>
                  </select>
                </div>
                <div className="flex gap-2 pt-4">
                  <button 
                    type="button" 
                    onClick={() => { setMostrarModalEditarPerfil(false); setPerfilAEditar(null); }} 
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

      {/* MODAL VINCULAR USUARIO EXISTENTE */}
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
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Seleccionar Usuario Huérfano</label>
                  {perfilesHuerfanos.length === 0 ? (
                    <div className="bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-xs text-slate-500 italic mt-1">
                      No hay usuarios huérfanos registrados actualmente.
                    </div>
                  ) : (
                    <select 
                      className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none" 
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
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Hogar Destino</label>
                  <select 
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none" 
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
                    className="flex-[2] bg-emerald-600 text-white font-black py-4 rounded-xl shadow-lg shadow-emerald-600/30 hover:bg-emerald-500 transition-all text-xs disabled:opacity-50"
                  >
                    {guardando ? <Loader2 className="animate-spin mx-auto"/> : "VINCULAR USUARIO"}
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
