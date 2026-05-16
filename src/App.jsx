import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase";
import { Toaster } from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
// import "./App.css";

// COMPONENTES
import Login from "./components/Login";
import Navegacion from "./components/Navegacion";
import Inicio from "./components/Inicio";
import Cuentas from "./components/Cuentas";
import Ingresos from "./components/Ingresos";
import Metas from "./components/Metas";
import Historial from "./components/Historial";
import ConfiguracionHogar from "./components/ConfiguracionHogar";
import AsistenteGemini from "./components/AsistenteGemini";
import SuperadminPanel from "./components/SuperadminPanel";

function App() {
  const [session, setSession] = useState(null);
  const [activeTab, setActiveTab] = useState("inicio");
  const [modoVista, setModoVista] = useState("familiar"); // 'familiar' | 'personal'
  const [usuarios, setUsuarios] = useState([]);
  const [gastos, setGastos] = useState([]);
  const [usuarioActual, setUsuarioActual] = useState(null);
  const [otroUsuario, setOtroUsuario] = useState(null);
  const [ingresos, setIngresos] = useState([]);
  const [deudas, setDeudas] = useState([]); // Nueva estructura de deudas
  const [monedaGlobal, setMonedaGlobal] = useState("PYG");
  const [datosHogar, setDatosHogar] = useState(null);
  const [verificandoHogar, setVerificandoHogar] = useState(true);

  // --- VERIFICAR PERFIL Y HOGAR (Fase 7) ---
  const verificarPerfil = async (usuarioId) => {
    console.log("🔍 Verificando perfil para:", usuarioId);
    try {
      const { data: perfil, error } = await supabase
        .from('perfiles')
        .select('*, espacios(*)')
        .eq('id', usuarioId)
        .single();

      if (error || !perfil) {
        console.log("ℹ️ Usuario sin perfil o espacio vinculado.");
        return null;
      }

      console.log("🏠 Hogar encontrado:", perfil.espacios?.nombre_familia || "Sin nombre");
      return perfil;
    } catch (error) {
      console.error("🚨 Falló verificación de perfil:", error.message);
      return null;
    }
  };

  // --- ARRANQUE OPTIMIZADO ---
  useEffect(() => {
    let montado = true;

    // Seguro de vida: Si en 6 segundos no cargó, desbloqueamos la pantalla
    const timerCierre = setTimeout(() => {
      if (montado && verificandoHogar) {
        console.warn("⚠️ Tiempo de carga excedido. Forzando desbloqueo.");
        setVerificandoHogar(false);
      }
    }, 6000);

    const inicializar = async () => {
      console.log("🚀 [Arranque] Iniciando comprobación de sesión...");
      try {
        const { data: { session: s }, error: errS } = await supabase.auth.getSession();
        
        if (errS) throw errS;
        if (!montado) return;

        setSession(s);

        if (s) {
          console.log("✅ Sesión detectada:", s.user.email);
          const perfil = await verificarPerfil(s.user.id);
          if (montado) setDatosHogar(perfil);
        } else {
          console.log("ℹ️ No hay sesión activa.");
        }
      } catch (err) {
        console.error("🚨 Error crítico en arranque:", err.message);
      } finally {
        if (montado) {
          setVerificandoHogar(false);
          clearTimeout(timerCierre);
          console.log("🏁 [Arranque] Finalizado.");
        }
      }
    };

    inicializar();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, s) => {
      console.log("🔄 [Auth] Evento:", event);
      if (event === 'SIGNED_OUT') {
        setSession(null);
        setDatosHogar(null);
        setVerificandoHogar(false);
      } else if (s && event === 'SIGNED_IN') {
        setSession(s);
        const perfil = await verificarPerfil(s.user.id);
        if (montado) {
          setDatosHogar(perfil);
          setVerificandoHogar(false);
        }
      }
    });

    return () => { 
      montado = false; 
      subscription.unsubscribe();
      clearTimeout(timerCierre);
    };
  }, []);

  // --- CARGA DE DATOS (ESQUEMA PRO) ---
  const obtenerDatos = useCallback(async () => {
    if (!datosHogar || !session) return;
    const eid = datosHogar.espacio_id;

    try {
      // 1. Cargar Miembros del Hogar
      const { data: miembros } = await supabase
        .from("perfiles")
        .select("*")
        .eq("espacio_id", eid);

      if (miembros) {
        setUsuarios(miembros);
        const logueado = miembros.find(u => u.id === session.user.id);
        if (logueado) {
          setUsuarioActual(logueado);
          const pareja = miembros.find(u => u.id !== logueado.id);
          if (pareja) setOtroUsuario(pareja);
        }
      }

      // 2. Cargar Transacciones y Deudas
      const [resG, resI, resD] = await Promise.all([
        supabase.from("gastos").select("*").eq('espacio_id', eid).order("fecha", { ascending: false }),
        supabase.from("ingresos_mensuales").select("*").eq('espacio_id', eid),
        supabase.from("deudas_maestras").select("*, cuotas_detalle(*)").eq('espacio_id', eid)
      ]);

      if (resG.data) setGastos(resG.data);
      if (resI.data) setIngresos(resI.data);
      if (resD.data) setDeudas(resD.data);
    } catch (e) {
      console.error("Error cargando datos Fase 7:", e);
    }
  }, [datosHogar, session]);

  useEffect(() => {
    if (session && !verificandoHogar && datosHogar) obtenerDatos();
  }, [session, verificandoHogar, datosHogar, obtenerDatos]);

  const getNombreUsuario = (id) => {
    const u = usuarios.find((u) => u.id === id);
    return u ? u.nombre : "Desconocido";
  };

  // --- RENDER ---
  if (verificandoHogar) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.5 }}>
          Conectando con ÑandeFinanza 2.0... 🧉
        </motion.div>
      </div>
    );
  }

  if (!session) return <Login />;
  if (session && !datosHogar) return <ConfiguracionHogar usuario={session.user} onHogarCreado={() => window.location.reload()} />;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-indigo-500/30">
      <Toaster position="top-center" toastOptions={{
        className: 'glass-card border-white/20 text-white',
        style: { background: 'rgba(30, 41, 59, 0.8)', backdropFilter: 'blur(12px)' }
      }} />
      
      {/* Header Moderno con Switch de Contexto (HU-18) */}
      <header className="sticky top-0 z-40 w-full glass-panel px-6 py-4 flex flex-col gap-4">
        <div className="flex justify-between items-center w-full">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <span className="text-white font-bold">Ñ</span>
            </div>
            <span className="font-bold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
              {datosHogar?.espacios?.nombre_familia || "Mi Hogar"}
            </span>
          </div>
          <button onClick={() => supabase.auth.signOut()} className="text-[10px] font-bold text-slate-500 hover:text-red-400 uppercase tracking-widest transition-colors">Salir</button>
        </div>

        {/* TOGGLE FAMILIAR / PERSONAL */}
        <div className="flex justify-center">
          <div className="relative flex p-1 bg-black/20 rounded-xl border border-white/5 w-full max-w-[280px]">
            <motion.div
              className="absolute top-1 bottom-1 bg-indigo-600 rounded-lg shadow-lg"
              initial={false}
              animate={{ x: modoVista === 'familiar' ? 0 : '100%' }}
              style={{ width: 'calc(50% - 4px)' }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            />
            <button 
              onClick={() => setModoVista('familiar')}
              className={`relative z-10 flex-1 py-1.5 text-[10px] font-black uppercase tracking-widest transition-colors ${modoVista === 'familiar' ? 'text-white' : 'text-slate-500'}`}
            >
              Familiar 🏠
            </button>
            <button 
              onClick={() => setModoVista('personal')}
              className={`relative z-10 flex-1 py-1.5 text-[10px] font-black uppercase tracking-widest transition-colors ${modoVista === 'personal' ? 'text-white' : 'text-slate-500'}`}
            >
              Personal 👤
            </button>
          </div>
        </div>
      </header>

      {/* Contenedor Principal */}
      <main className="pb-28 pt-4 px-4 max-w-2xl mx-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${activeTab}-${modoVista}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === "inicio" && <Inicio usuarioActual={usuarioActual} otroUsuario={otroUsuario} usuarios={usuarios} gastos={gastos} ingresos={ingresos} deudas={deudas} monedaGlobal={monedaGlobal} setMonedaGlobal={setMonedaGlobal} obtenerDatos={obtenerDatos} datosHogar={datosHogar} modoVista={modoVista} />}
            {activeTab === "cuentas" && <Cuentas usuarioActual={usuarioActual} otroUsuario={otroUsuario} usuarios={usuarios} deudas={deudas} monedaGlobal={monedaGlobal} obtenerDatos={obtenerDatos} datosHogar={datosHogar} />}
            {/* Otros componentes se actualizarán en pasos siguientes */}
            {activeTab === "ingresos" && <Ingresos usuarioActual={usuarioActual} ingresos={ingresos} monedaGlobal={monedaGlobal} obtenerDatos={obtenerDatos} datosHogar={datosHogar} getNombreUsuario={getNombreUsuario} />}
            {activeTab === "historial" && <Historial gastos={gastos} ingresos={ingresos} usuarios={usuarios} obtenerDatos={obtenerDatos} getNombreUsuario={getNombreUsuario} datosHogar={datosHogar} />}
            {activeTab === "asistente" && <AsistenteGemini usuarioActual={usuarioActual} gastos={gastos} ingresos={ingresos} monedaGlobal={monedaGlobal} datosHogar={datosHogar} />}
            {activeTab === "admin" && datosHogar?.rol === 'superadmin' && <SuperadminPanel />}
          </motion.div>
        </AnimatePresence>
      </main>

      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
        <Navegacion activeTab={activeTab} setActiveTab={setActiveTab} esSuperadmin={datosHogar?.rol === 'superadmin'} />
      </nav>
    </div>
  );
}

export default App;