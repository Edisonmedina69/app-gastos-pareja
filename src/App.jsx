import { useState, useEffect } from "react";
import { supabase } from "./supabase";
import { Toaster } from "react-hot-toast";
import { formatearNumero, formatearFecha } from "./utils/formatters";
import "./App.css";

// COMPONENTES EXTRAÍDOS (¡Todos listos!)
import Login from "./components/Login";
import Navegacion from "./components/Navegacion";
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
    const resGastos = await supabase
      .from("gastos")
      .select("*")
      .order("fecha", { ascending: false });
    if (resGastos.data) setGastos(resGastos.data);
    const resIngresos = await supabase
      .from("ingresos_mensuales")
      .select("*")
      .order("id", { ascending: false });
    if (resIngresos.data) setIngresos(resIngresos.data);
    const resCuentas = await supabase
      .from("cuentas_pendientes")
      .select("*")
      .order("estado", { ascending: false })
      .order("dia_vencimiento", { ascending: true });
    if (resCuentas.data) setCuentas(resCuentas.data);
    const resMetas = await supabase
      .from("metas_ahorro")
      .select("*")
      .order("id", { ascending: true });
    if (resMetas.data) setMetas(resMetas.data);
  }

  useEffect(() => {
    if (session) obtenerDatos();
  }, [session]);

  function getNombreUsuario(id) {
    const user = usuarios.find((u) => u.id == id);
    return user ? user.nombre : "Desconocido";
  }

  if (!session) return <Login />;

  return (
    <div className="app-container">
      <Toaster position="top-center" reverseOrder={false} />

      <div
        className="header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span>Mis Finanzas 💸</span>
        <button
          onClick={handleLogout}
          style={{
            background: "transparent",
            border: "none",
            color: "#ff6b6b",
            cursor: "pointer",
            fontSize: "14px",
          }}
        >
          Salir
        </button>
      </div>

      <div className="content">
        {/* ENRUTAMIENTO DE COMPONENTES */}
        {activeTab === "inicio" && (
          <Inicio
            usuarioActual={usuarioActual}
            otroUsuario={otroUsuario}
            usuarios={usuarios}
            gastos={gastos}
            ingresos={ingresos}
            cuentas={cuentas}
            monedaGlobal={monedaGlobal}
            setMonedaGlobal={setMonedaGlobal}
            obtenerDatos={obtenerDatos}
          />
        )}

        {activeTab === "cuentas" && (
          <Cuentas
            usuarioActual={usuarioActual}
            otroUsuario={otroUsuario}
            usuarios={usuarios}
            cuentas={cuentas}
            monedaGlobal={monedaGlobal}
            obtenerDatos={obtenerDatos}
          />
        )}

        {activeTab === "ingresos" && (
          <Ingresos
            usuarioActual={usuarioActual}
            ingresos={ingresos}
            monedaGlobal={monedaGlobal}
            obtenerDatos={obtenerDatos}
            getNombreUsuario={getNombreUsuario}
          />
        )}

        {activeTab === "metas" && (
          <Metas
            usuarioActual={usuarioActual}
            metas={metas}
            monedaGlobal={monedaGlobal}
            obtenerDatos={obtenerDatos}
          />
        )}

        {activeTab === "historial" && (
          <Historial
            gastos={gastos}
            ingresos={ingresos}
            usuarios={usuarios}
            obtenerDatos={obtenerDatos}
            getNombreUsuario={getNombreUsuario}
          />
        )}
      </div>

      <Navegacion activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}

export default App;
