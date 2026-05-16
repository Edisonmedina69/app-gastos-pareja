import { useState, useEffect } from "react";
import { supabase } from "./supabase";
import { Toaster } from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import "./App.css";

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

function App() {
  const [session, setSession] = useState(null);
  const [activeTab, setActiveTab] = useState("inicio");
  const [usuarios, setUsuarios] = useState([]);
  const [gastos, setGastos] = useState([]);
  const [usuarioActual, setUsuarioActual] = useState(null);
  const [otroUsuario, setOtroUsuario] = useState(null);
  const [ingresos, setIngresos] = useState([]);
  const [cuentas, setCuentas] = useState([]);
  const [metas, setMetas] = useState([]);
  const [monedaGlobal, setMonedaGlobal] = useState("PYG");
  const [datosHogar, setDatosHogar] = useState(null);
  const [verificandoHogar, setVerificandoHogar] = useState(true);

  // --- FUNCIÓN ANTI-BLOQUEO PARA VERIFICAR HOGAR ---
  const verificarHogar = async (usuarioId) => {
    console.log("🔍 [Pasó 3] Verificando hogar para:", usuarioId);
    
    // Promesa de tiempo límite (2.5 segundos)
    const timeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("Timeout Supabase")), 2500)
    );

    try {
      // Intentamos la consulta pero con un cronómetro encima
      const consulta = supabase
        .from('usuarios_espacios')
        .select('rol, espacio_id')
        .eq('usuario_id', usuarioId);

      const result = await Promise.race([consulta, timeout]);
      const { data: relacion, error: errorRel } = result;

      if (errorRel) throw errorRel;

      if (!relacion || relacion.length === 0) {
        console.log("ℹ️ Usuario sin hogar vinculado.");
        return null;
      }

      // Buscamos datos del espacio (también con protección)
      const { data: espacio, error: errorEsp } = await Promise.race([
        supabase.from('espacios').select('*').eq('id', relacion[0].espacio_id).single(),
        timeout
      ]);

      if (errorEsp) throw errorEsp;

      console.log("🏠 Hogar encontrado:", espacio.nombre);
      return { rol: relacion[0].rol, espacio_id: relacion[0].espacio_id, espacios: espacio };
    } catch (error) {
      console.error("🚨 Falló verificación de hogar (posible timeout o RLS):", error.message);
      return null; // Si falla, devolvemos null para que el usuario pueda al menos ver la pantalla de crear hogar
    }
  };

  // --- ARRANQUE UNIFICADO ---
  useEffect(() => {
    let montado = true;

    const inicializar = async () => {
      console.log("🚀 [Pasó 1] Iniciando arranque...");
      try {
        const { data: { session: s } } = await supabase.auth.getSession();
        if (!montado) return;
        
        setSession(s);
        if (s) {
          console.log("✅ Sesión detectada:", s.user.email);
          const hogar = await verificarHogar(s.user.id);
          setDatosHogar(hogar);
        }
      } catch (err) {
        console.error("🚨 Error inicializando:", err);
      } finally {
        if (montado) setVerificandoHogar(false);
        console.log("🏁 [Pasó FINAL] App desbloqueada.");
      }
    };

    inicializar();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, s) => {
      console.log("🔄 Cambio Auth:", event);
      if (event === 'SIGNED_OUT') {
        setSession(null);
        setDatosHogar(null);
        setVerificandoHogar(false);
      } else if (s) {
        setSession(s);
        const hogar = await verificarHogar(s.user.id);
        setDatosHogar(hogar);
        setVerificandoHogar(false);
      }
    });

    return () => { montado = false; subscription.unsubscribe(); };
  }, []);

  // --- CARGA DE DATOS ---
  async function obtenerDatos() {
    if (!datosHogar || !session) return;
    const eid = datosHogar.espacios.id;
    console.log("📊 Cargando datos del espacio ID:", eid);

    try {
      const [resU, resG, resI, resC, resM] = await Promise.all([
        supabase.from("usuarios").select("*"),
        supabase.from("gastos").select("*").eq('espacio_id', eid).order("fecha", { ascending: false }),
        supabase.from("ingresos_mensuales").select("*").eq('espacio_id', eid),
        supabase.from("cuentas_pendientes").select("*").eq('espacio_id', eid),
        supabase.from("metas_ahorro").select("*").eq('espacio_id', eid)
      ]);

      if (resU.data) {
        setUsuarios(resU.data);
        const logueado = resU.data.find(u => u.email === session.user.email);
        if (logueado) {
          setUsuarioActual(logueado);
          const pareja = resU.data.find(u => u.id !== logueado.id);
          if (pareja) setOtroUsuario(pareja);
        }
      }
      if (resG.data) setGastos(resG.data);
      if (resI.data) setIngresos(resI.data);
      if (resC.data) setCuentas(resC.data);
      if (resM.data) setMetas(resM.data);
    } catch (e) {
      console.error("Error cargando tablas:", e);
    }
  }

  useEffect(() => {
    if (session && !verificandoHogar && datosHogar) obtenerDatos();
  }, [session, verificandoHogar, datosHogar]);

  const getNombreUsuario = (id) => {
    const u = usuarios.find((u) => u.id === id);
    return u ? u.nombre : "Desconocido";
  };

  // --- RENDER ---
  if (verificandoHogar) {
    return (
      <div style={{ backgroundColor: '#0f172a', height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white' }}>
        <div style={{ textAlign: 'center' }}>
          <p>Conectando con ÑandeFinanza... 🧉</p>
          <button onClick={() => setVerificandoHogar(false)} style={{ fontSize: '10px', opacity: 0.5, background: 'none', border: '1px solid', color: 'white', cursor: 'pointer' }}>Forzar entrada</button>
        </div>
      </div>
    );
  }

  if (!session) return <Login />;

  if (session && !datosHogar) {
    return <ConfiguracionHogar usuario={session.user} onHogarCreado={() => window.location.reload()} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-indigo-500/30">
      <Toaster position="top-center" toastOptions={{
        className: 'glass-card border-white/20 text-white',
        style: { background: 'rgba(30, 41, 59, 0.8)', backdropFilter: 'blur(12px)' }
      }} />
      
      {/* Header Moderno */}
      <header className="sticky top-0 z-40 w-full glass-panel px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <span className="text-white font-bold">Ñ</span>
          </div>
          <span className="font-bold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
            {datosHogar.espacios.nombre}
          </span>
        </div>
        <button 
          onClick={() => supabase.auth.signOut()} 
          className="text-xs font-medium text-slate-400 hover:text-red-400 transition-colors px-3 py-1.5 rounded-full border border-white/5 hover:border-red-500/20 hover:bg-red-500/10"
        >
          Cerrar Sesión
        </button>
      </header>

      {/* Contenedor Principal con Animación */}
      <main className="pb-28 pt-4 px-4 max-w-2xl mx-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {activeTab === "inicio" && <Inicio usuarioActual={usuarioActual} otroUsuario={otroUsuario} usuarios={usuarios} gastos={gastos} ingresos={ingresos} cuentas={cuentas} monedaGlobal={monedaGlobal} setMonedaGlobal={setMonedaGlobal} obtenerDatos={obtenerDatos} datosHogar={datosHogar} />}
            {activeTab === "cuentas" && <Cuentas usuarioActual={usuarioActual} cuentas={cuentas} monedaGlobal={monedaGlobal} obtenerDatos={obtenerDatos} datosHogar={datosHogar} />}
            {activeTab === "ingresos" && <Ingresos usuarioActual={usuarioActual} ingresos={ingresos} monedaGlobal={monedaGlobal} obtenerDatos={obtenerDatos} datosHogar={datosHogar} getNombreUsuario={getNombreUsuario} />}
            {activeTab === "metas" && <Metas usuarioActual={usuarioActual} metas={metas} monedaGlobal={monedaGlobal} obtenerDatos={obtenerDatos} datosHogar={datosHogar} />}
            {activeTab === "historial" && <Historial gastos={gastos} ingresos={ingresos} usuarios={usuarios} obtenerDatos={obtenerDatos} getNombreUsuario={getNombreUsuario} datosHogar={datosHogar} />}
            {activeTab === "asistente" && <AsistenteGemini usuarioActual={usuarioActual} gastos={gastos} ingresos={ingresos} cuentas={cuentas} metas={metas} monedaGlobal={monedaGlobal} datosHogar={datosHogar} />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Navegación Flotante */}
      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
        <Navegacion activeTab={activeTab} setActiveTab={setActiveTab} />
      </nav>
    </div>
  );
}

export default App;