import { useState, useEffect } from "react";
import { supabase } from "./supabase";
import { Toaster } from "react-hot-toast";
import { formatearNumero, formatearFecha } from "./utils/formatters";
import "./App.css";

// IMPORTACIÓN DE COMPONENTES
import Login from "./components/Login";
import Sidebar from "./components/Sidebar";
import BottomNav from "./components/BottomNav";
import Inicio from "./components/Inicio";
import Cuentas from "./components/Cuentas";
import Ingresos from "./components/Ingresos";
import Metas from "./components/Metas";
import Historial from "./components/Historial";

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

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => setSession(session));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) =>
      setSession(session),
    );
    return () => subscription.unsubscribe();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    setUsuarioActual(null);
    setOtroUsuario(null);
  }

  async function obtenerDatos() {
    if (!session) return;

    // 1. Obtener Usuarios
    const resUsuarios = await supabase.from("usuarios").select("*");
    if (resUsuarios.data) {
      setUsuarios(resUsuarios.data);
      if (session?.user?.email) {
        const logueado = resUsuarios.data.find(
          (u) => u.email === session.user.email,
        );
        if (logueado) {
          setUsuarioActual(logueado);
          const pareja = resUsuarios.data.find((u) => u.id !== logueado.id);
          if (pareja) setOtroUsuario(pareja);
        }
      }
    }

    // 2. Obtener Gastos
    const resGastos = await supabase
      .from("gastos")
      .select("*")
      .order("fecha", { ascending: false });
    if (resGastos.data) setGastos(resGastos.data);

    // 3. Obtener Ingresos
    const resIngresos = await supabase
      .from("ingresos_mensuales")
      .select("*")
      .order("id", { ascending: false });
    if (resIngresos.data) setIngresos(resIngresos.data);

    // 4. Obtener Cuentas
    const resCuentas = await supabase
      .from("cuentas_pendientes")
      .select("*")
      .order("estado", { ascending: false })
      .order("dia_vencimiento", { ascending: true });
    if (resCuentas.data) setCuentas(resCuentas.data);

    // 5. Obtener Metas
    const resMetas = await supabase
      .from("metas_ahorro")
      .select("*")
      .order("id", { ascending: true });
    if (resMetas.data) setMetas(resMetas.data);
  }

  useEffect(() => {
    if (session) obtenerDatos();
  }, [session]);

  if (!session) return <Login />;

  // Propiedades compartidas para todos los componentes
  const sharedProps = {
    usuarioActual,
    otroUsuario,
    usuarios,
    gastos,
    ingresos,
    cuentas,
    metas,
    monedaGlobal,
    setMonedaGlobal,
    obtenerDatos,
    formatearNumero,
    formatearFecha,
    getNombreUsuario: (id) =>
      usuarios.find((u) => u.id == id)?.nombre || "Desconocido",
  };

  return (
    <div className="app-container">
      <Toaster position="top-right" />

      {/* HEADER: Solo visible en móviles (controlado por CSS) */}
      <header className="header">Mis Finanzas 💸</header>

      {/* SIDEBAR: Solo visible en Escritorio (controlado por CSS) */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        handleLogout={handleLogout}
      />

      {/* CONTENIDO PRINCIPAL */}
      <main className="content">
        <div className="content-inner">
          {activeTab === "inicio" && <Inicio {...sharedProps} />}
          {activeTab === "cuentas" && <Cuentas {...sharedProps} />}
          {activeTab === "ingresos" && <Ingresos {...sharedProps} />}
          {activeTab === "metas" && <Metas {...sharedProps} />}
          {activeTab === "historial" && <Historial {...sharedProps} />}
        </div>
      </main>

      {/* BOTTOM NAV: Solo visible en celulares (controlado por CSS) */}
      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}

export default App;
