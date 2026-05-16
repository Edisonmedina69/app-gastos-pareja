import { useState, useEffect } from "react";
import { supabase } from "./supabase";
import { Toaster } from "react-hot-toast";
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
    <div className="app-container">
      <Toaster position="top-center" />
      <div className="header" style={{ display: "flex", justifyContent: "space-between", padding: '15px', alignItems: 'center' }}>
        <span style={{ fontWeight: 'bold' }}>{datosHogar.espacios.nombre} 💸</span>
        <button onClick={() => supabase.auth.signOut()} style={{ color: "#ff6b6b", background: 'none', border: 'none', cursor: 'pointer' }}>Salir</button>
      </div>
      <div className="content">
        {activeTab === "inicio" && <Inicio usuarioActual={usuarioActual} otroUsuario={otroUsuario} usuarios={usuarios} gastos={gastos} ingresos={ingresos} cuentas={cuentas} monedaGlobal={monedaGlobal} setMonedaGlobal={setMonedaGlobal} obtenerDatos={obtenerDatos} datosHogar={datosHogar} />}
        {activeTab === "cuentas" && <Cuentas usuarioActual={usuarioActual} cuentas={cuentas} monedaGlobal={monedaGlobal} obtenerDatos={obtenerDatos} datosHogar={datosHogar} />}
        {activeTab === "ingresos" && <Ingresos usuarioActual={usuarioActual} ingresos={ingresos} monedaGlobal={monedaGlobal} obtenerDatos={obtenerDatos} datosHogar={datosHogar} getNombreUsuario={getNombreUsuario} />}
        {activeTab === "metas" && <Metas usuarioActual={usuarioActual} metas={metas} monedaGlobal={monedaGlobal} obtenerDatos={obtenerDatos} />}
        {activeTab === "historial" && <Historial gastos={gastos} ingresos={ingresos} usuarios={usuarios} obtenerDatos={obtenerDatos} getNombreUsuario={getNombreUsuario} />}
        {activeTab === "asistente" && <AsistenteGemini usuarioActual={usuarioActual} gastos={gastos} ingresos={ingresos} cuentas={cuentas} metas={metas} monedaGlobal={monedaGlobal} datosHogar={datosHogar} />}
      </div>
      <Navegacion activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}

export default App;