import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import * as hogarService from "../../../services/hogar.service";
import { registrarCuentaSinSesion } from "../../../services/auth.service";
import { eliminarGastosDeEspacio } from "../../../services/gastos.service";
import { eliminarIngresosDeEspacio } from "../../../services/ingresos.service";
import { eliminarDeudasDeEspacio } from "../../../services/deudas.service";
import { eliminarNotificacionesDeEspacio } from "../../../services/notificaciones.service";
import { eliminarGastosProgramadosDeEspacio } from "../../../services/gastosProgramados.service";
import { toast } from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Users, Home, Plus, Key, Copy, Check, ArrowRight, Loader2, 
  Search, ShieldCheck, Trash2, ChevronLeft, ChevronRight, X,
  Edit2, Trash, Settings
} from "lucide-react";
import TabMantenimiento from './TabMantenimiento';
import TabHogares from './TabHogares';
import ModalVincularUsuario from './modales/ModalVincularUsuario';
import ModalEditarPerfil from './modales/ModalEditarPerfil';
import ModalEditarHogar from './modales/ModalEditarHogar';
import ModalCrearUsuario from './modales/ModalCrearUsuario';
import ModalCrearHogar from './modales/ModalCrearHogar';

export default function SuperadminPanel({ datosHogar }) {
  const [espacios, setEspacios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const location = useLocation();
  const navigate = useNavigate();
  const cerrarFormulario = () => location.state?.desdeFormulario ? navigate(-1) : navigate('/admin');
  const mostrarModalCrear = location.pathname === '/admin/hogares/nuevo';
  const setMostrarModalCrear = (abrir) => abrir ? navigate('/admin/hogares/nuevo', { state: { desdeFormulario: true } }) : cerrarFormulario();
  const [nuevoHogarNombre, setNuevoNombre] = useState("");
  const [limiteUsuarios, setLimiteUsuarios] = useState(2);
  const [guardando, setGuardando] = useState(false);
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
  const mostrarModalCrearUsuario = location.pathname === '/admin/usuarios/nuevo';
  const setMostrarModalCrearUsuario = (abrir) => abrir ? navigate('/admin/usuarios/nuevo', { state: { desdeFormulario: true } }) : cerrarFormulario();
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
      const { data: espData, error: espError } = await hogarService.listarEspaciosConMiembros();
      
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
      const { data: perfData, error: perfError } = await hogarService.listarPerfilesSinEspacio();
      
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
      const { data: espacio, error: errorEspacio } = await hogarService.crearEspacio({
        nombre_familia: nuevoHogarNombre.trim(),
        codigo_invitacion: codigo,
        limite_usuarios: parseInt(limiteUsuarios)
      });
        
      if (errorEspacio) throw errorEspacio;

      // 2. Si se ingresó credenciales de Usuario 1, crearlo
      if (usuario1Nombre.trim() && usuario1Password.trim()) {
        const { data: authData1, error: errU1 } = await registrarCuentaSinSesion(normalizarUsuario(usuario1Nombre), usuario1Password);

        if (errU1) throw new Error(`Usuario 1: ${errU1.message}`);
        
        if (authData1 && authData1.user) {
          const { error: errP1 } = await hogarService.insertarPerfil({
            id: authData1.user.id,
            nombre: usuario1Nombre.trim(),
            rol: 'admin_hogar',
            espacio_id: espacio.id
          });
          if (errP1) throw new Error(`Perfil 1: ${errP1.message}`);
        }
      }

      // 3. Si se ingresó credenciales de Usuario 2, crearlo
      if (usuario2Nombre.trim() && usuario2Password.trim()) {
        const { data: authData2, error: errU2 } = await registrarCuentaSinSesion(normalizarUsuario(usuario2Nombre), usuario2Password);

        if (errU2) throw new Error(`Usuario 2: ${errU2.message}`);
        
        if (authData2 && authData2.user) {
          const { error: errP2 } = await hogarService.insertarPerfil({
            id: authData2.user.id,
            nombre: usuario2Nombre.trim(),
            rol: 'miembro',
            espacio_id: espacio.id
          });
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
      const { data: authData, error: errAuth } = await registrarCuentaSinSesion(emailNormalizado, usuarioPassword);

      if (errAuth) throw errAuth;
      if (!authData.user) throw new Error("No se pudo registrar la cuenta en la autenticación.");

      // 2. Insertar perfil vinculado al espacio seleccionado
      const { error: errPerfil } = await hogarService.insertarPerfil({
        id: authData.user.id,
        nombre: usuarioApodo.trim(),
        rol: usuarioRol,
        espacio_id: usuarioEspacioId
      });

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
      const { error } = await hogarService.actualizarEspacio(espacioAEditar.id, {
        nombre_familia: editNombreFamilia.trim(),
        limite_usuarios: parseInt(editLimiteUsuarios)
      });
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
      const { error } = await hogarService.actualizarPerfil(perfilAEditar.id, {
        nombre: editPerfilNombre.trim(),
        rol: editPerfilRol
      });
      
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

      const { error } = await hogarService.actualizarPerfil(pid, { espacio_id: eid });

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
      const { error } = await hogarService.actualizarPerfil(perfilId, { espacio_id: null });

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
        const { error } = await hogarService.eliminarEspacio(id);
        
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

  async function eliminarPerfil(id, nombre) {
    const confirmar = window.confirm(`¿Seguro que querés eliminar el perfil de "${nombre}"?\n\nEsto removerá su perfil en la DB.`);
    if (!confirmar) return;

    const toastId = toast.loading("Eliminando perfil...");
    try {
      const { error } = await hogarService.eliminarPerfil(id);

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
      const { error } = await hogarService.eliminarEspacios(ids);

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
      const { error: errG } = await eliminarGastosDeEspacio(limpiezaEspacioId);
      if (errG) throw errG;

      // 2. Eliminar ingresos
      const { error: errI } = await eliminarIngresosDeEspacio(limpiezaEspacioId);
      if (errI) throw errI;

      // 3. Eliminar deudas
      const { error: errD } = await eliminarDeudasDeEspacio(limpiezaEspacioId);
      if (errD) throw errD;

      // 4. Eliminar notificaciones
      const { error: errN } = await eliminarNotificacionesDeEspacio(limpiezaEspacioId);
      if (errN) throw errN;

      // 5. Eliminar gastos programados
      const { error: errGP } = await eliminarGastosProgramadosDeEspacio(limpiezaEspacioId);
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


  // Apertura de modales desde la lista de hogares
  const abrirEditarEspacio = (e) => {
    setEspacioAEditar(e);
    setEditNombreFamilia(e.nombre_familia);
    setEditLimiteUsuarios(e.limite_usuarios);
    setMostrarModalEditar(true);
  };
  const abrirCrearUsuario = (espacioId) => {
    setUsuarioEspacioId(espacioId);
    setMostrarModalCrearUsuario(true);
  };
  const abrirVincularExistente = (espacioId) => {
    setVincularEspacioId(espacioId);
    setMostrarModalVincularExistente(true);
  };
  const abrirEditarPerfil = (p) => {
    setPerfilAEditar(p);
    setEditPerfilNombre(p.nombre);
    setEditPerfilRol(p.rol || "miembro");
    setMostrarModalEditarPerfil(true);
  };

  return (
    <div className="space-y-6 pb-20">
      {!mostrarModalCrear && !mostrarModalCrearUsuario && <>
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
          <TabHogares busqueda={busqueda} cargando={cargando} datosHogar={datosHogar} desvincularMiembro={desvincularMiembro} eliminarEspacio={eliminarEspacio} espaciosPaginados={espaciosPaginados} paginaActual={paginaActual} setBusqueda={setBusqueda} setPaginaActual={setPaginaActual} totalPaginas={totalPaginas} abrirEditarEspacio={abrirEditarEspacio} abrirCrearUsuario={abrirCrearUsuario} abrirVincularExistente={abrirVincularExistente} abrirEditarPerfil={abrirEditarPerfil} />
        </>
      ) : (
        /* MODO MANTENIMIENTO / LIMPIEZA */
        <TabMantenimiento ejecutarVinculacionUsuarioExistente={ejecutarVinculacionUsuarioExistente} eliminarPerfil={eliminarPerfil} espacios={espacios} guardando={guardando} limpiandoTransacciones={limpiandoTransacciones} limpiezaEspacioId={limpiezaEspacioId} perfilesHuerfanos={perfilesHuerfanos} purgarEspaciosVacios={purgarEspaciosVacios} selectedOrphanSpaces={selectedOrphanSpaces} setLimpiezaEspacioId={setLimpiezaEspacioId} setSelectedOrphanSpaces={setSelectedOrphanSpaces} vaciarTransaccionesHogar={vaciarTransaccionesHogar} />
      )}

      {/* MODAL CREAR HOGAR */}
      </>}
      <ModalCrearHogar crearEspacio={crearEspacio} guardando={guardando} limiteUsuarios={limiteUsuarios} mostrarModalCrear={mostrarModalCrear} nuevoHogarNombre={nuevoHogarNombre} setLimiteUsuarios={setLimiteUsuarios} setMostrarModalCrear={setMostrarModalCrear} setNuevoNombre={setNuevoNombre} setUsuario1Nombre={setUsuario1Nombre} setUsuario1Password={setUsuario1Password} setUsuario2Nombre={setUsuario2Nombre} setUsuario2Password={setUsuario2Password} usuario1Nombre={usuario1Nombre} usuario1Password={usuario1Password} usuario2Nombre={usuario2Nombre} usuario2Password={usuario2Password} />

      {/* MODAL CREAR USUARIO INDEPENDIENTE */}
      <ModalCrearUsuario crearUsuarioDirecto={crearUsuarioDirecto} espacios={espacios} guardando={guardando} mostrarModalCrearUsuario={mostrarModalCrearUsuario} setMostrarModalCrearUsuario={setMostrarModalCrearUsuario} setUsuarioApodo={setUsuarioApodo} setUsuarioEspacioId={setUsuarioEspacioId} setUsuarioNombre={setUsuarioNombre} setUsuarioPassword={setUsuarioPassword} setUsuarioRol={setUsuarioRol} usuarioApodo={usuarioApodo} usuarioEspacioId={usuarioEspacioId} usuarioNombre={usuarioNombre} usuarioPassword={usuarioPassword} usuarioRol={usuarioRol} />

      {/* MODAL EDITAR HOGAR */}
      <ModalEditarHogar editLimiteUsuarios={editLimiteUsuarios} editNombreFamilia={editNombreFamilia} guardando={guardando} guardarEdicionEspacio={guardarEdicionEspacio} mostrarModalEditar={mostrarModalEditar} setEditLimiteUsuarios={setEditLimiteUsuarios} setEditNombreFamilia={setEditNombreFamilia} setEspacioAEditar={setEspacioAEditar} setMostrarModalEditar={setMostrarModalEditar} />

      {/* MODAL EDITAR PERFIL DE MIEMBRO */}
      <ModalEditarPerfil editPerfilNombre={editPerfilNombre} editPerfilRol={editPerfilRol} guardando={guardando} guardarEdicionPerfil={guardarEdicionPerfil} mostrarModalEditarPerfil={mostrarModalEditarPerfil} setEditPerfilNombre={setEditPerfilNombre} setEditPerfilRol={setEditPerfilRol} setMostrarModalEditarPerfil={setMostrarModalEditarPerfil} setPerfilAEditar={setPerfilAEditar} />

      {/* MODAL VINCULAR USUARIO EXISTENTE */}
      <ModalVincularUsuario ejecutarVinculacionUsuarioExistente={ejecutarVinculacionUsuarioExistente} espacios={espacios} guardando={guardando} mostrarModalVincularExistente={mostrarModalVincularExistente} perfilesHuerfanos={perfilesHuerfanos} setMostrarModalVincularExistente={setMostrarModalVincularExistente} setVincularEspacioId={setVincularEspacioId} setVincularPerfilId={setVincularPerfilId} vincularEspacioId={vincularEspacioId} vincularPerfilId={vincularPerfilId} />
    </div>
  );
}
