import { useState, useEffect } from "react";
import { supabase } from "./supabase";
import "./App.css"; // Fijate que acá borré el import de XLSX porque ahora está en Historial.jsx

// COMPONENTES EXTRAÍDOS
import Login from "./components/Login";
import Navegacion from "./components/Navegacion";
import Inicio from "./components/Inicio";
import Cuentas from "./components/Cuentas";
import Historial from "./components/Historial"; // NUEVO IMPORT

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

  // Estados residuales
  const [conceptoIngreso, setConceptoIngreso] = useState("Salario Mensual");
  const [montoIngreso, setMontoIngreso] = useState("");
  const [tituloMeta, setTituloMeta] = useState("");
  const [montoObjetivoMeta, setMontoObjetivoMeta] = useState("");

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

  function formatearNumero(num, mon = "PYG") {
    if (!num) return "0";
    const formato = Number(num).toLocaleString("es-PY");
    return mon === "BRL" ? `R$ ${formato}` : `${formato} Gs.`;
  }
  function formatearFecha(fechaStr) {
    if (!fechaStr) return "";
    const f = new Date(fechaStr);
    return (
      f.toLocaleDateString("es-PY") +
      " " +
      f.toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit" })
    );
  }
  function getNombreUsuario(id) {
    const user = usuarios.find((u) => u.id == id);
    return user ? user.nombre : "Desconocido";
  }

  async function crearMeta(e) {
    e.preventDefault();
    await supabase.from("metas_ahorro").insert([
      {
        titulo: tituloMeta,
        monto_objetivo: parseFloat(montoObjetivoMeta),
        moneda: monedaGlobal,
        creador_id: usuarioActual.id,
      },
    ]);
    setTituloMeta("");
    setMontoObjetivoMeta("");
    alert("¡Meta creada!");
    obtenerDatos();
  }

  async function aportarAMeta(meta) {
    const aporte = prompt(
      `¿Cuántos ${meta.moneda} querés aportar a "${meta.titulo}"?`,
    );
    if (aporte && !isNaN(aporte) && aporte > 0) {
      await supabase
        .from("metas_ahorro")
        .update({ monto_actual: Number(meta.monto_actual) + Number(aporte) })
        .eq("id", meta.id);
      await supabase.from("gastos").insert([
        {
          concepto: `Aporte a Meta: ${meta.titulo}`,
          monto: Number(aporte),
          categoria: "Ahorro",
          pagador_id: usuarioActual.id,
          para_quien: "Ambos",
          moneda: meta.moneda,
        },
      ]);
      obtenerDatos();
      alert("¡Aporte registrado!");
    }
  }

  async function guardarIngreso(e) {
    e.preventDefault();
    if (!usuarioActual) return;
    const fecha = new Date();
    await supabase.from("ingresos_mensuales").insert([
      {
        usuario_id: usuarioActual.id,
        concepto: conceptoIngreso,
        monto: parseFloat(montoIngreso),
        mes: fecha.getMonth() + 1,
        anio: fecha.getFullYear(),
        moneda: monedaGlobal,
      },
    ]);
    setMontoIngreso("");
    alert("¡Ingreso registrado!");
    obtenerDatos();
  }

  if (!session) return <Login />;

  return (
    <div className="app-container">
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
        {/* PEQUEÑO SELECTOR GLOBAL DE MONEDA */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginBottom: "15px",
            gap: "10px",
          }}
        >
          <button
            onClick={() => setMonedaGlobal("PYG")}
            style={{
              padding: "5px 15px",
              borderRadius: "20px",
              border:
                monedaGlobal === "PYG" ? "2px solid #646cff" : "1px solid #444",
              backgroundColor:
                monedaGlobal === "PYG" ? "#646cff" : "transparent",
              color: "white",
            }}
          >
            🇵🇾 Gs.
          </button>
          <button
            onClick={() => setMonedaGlobal("BRL")}
            style={{
              padding: "5px 15px",
              borderRadius: "20px",
              border:
                monedaGlobal === "BRL" ? "2px solid #28a745" : "1px solid #444",
              backgroundColor:
                monedaGlobal === "BRL" ? "#28a745" : "transparent",
              color: "white",
            }}
          >
            🇧🇷 R$
          </button>
        </div>

        {/* PESTAÑAS EXTRAÍDAS */}
        {activeTab === "inicio" && (
          <Inicio
            usuarioActual={usuarioActual}
            otroUsuario={otroUsuario}
            usuarios={usuarios}
            gastos={gastos}
            ingresos={ingresos}
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

        {/* =========================================
            PESTAÑA 3: INGRESOS
        ========================================= */}
        {activeTab === "ingresos" && (
          <div className="card" style={{ borderTop: "4px solid #28a745" }}>
            <h3>📥 Mis Ingresos</h3>
            <form onSubmit={guardarIngreso}>
              <input
                type="text"
                placeholder="Ej: Salario Fijo..."
                value={conceptoIngreso}
                onChange={(e) => setConceptoIngreso(e.target.value)}
                required
              />
              <input
                type="number"
                placeholder={`Monto en ${monedaGlobal}`}
                value={montoIngreso}
                onChange={(e) => setMontoIngreso(e.target.value)}
                required
              />
              <div
                style={{
                  fontSize: "12px",
                  color: "#aaa",
                  marginTop: "-10px",
                  marginBottom: "15px",
                  textAlign: "right",
                }}
              >
                Visualización: {formatearNumero(montoIngreso, monedaGlobal)}
              </div>
              <button
                type="submit"
                className="btn-primary"
                style={{ backgroundColor: "#28a745" }}
              >
                Guardar Ingreso
              </button>
            </form>
            <div
              style={{
                marginTop: "15px",
                borderTop: "1px solid #333",
                paddingTop: "10px",
              }}
            >
              {ingresos.map((i) => (
                <div
                  key={i.id}
                  style={{
                    fontSize: "0.9em",
                    color: "#ddd",
                    marginBottom: "5px",
                  }}
                >
                  ✅ <strong>{getNombreUsuario(i.usuario_id)}</strong> cobró{" "}
                  {formatearNumero(i.monto, i.moneda)}{" "}
                  <span style={{ color: "#888" }}>({i.concepto})</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* =========================================
            PESTAÑA 4: METAS (CHANCHITO)
        ========================================= */}
        {activeTab === "metas" && (
          <div className="card" style={{ borderTop: "4px solid #FFBB28" }}>
            <h3>🐷 Metas de Ahorro</h3>
            <form
              onSubmit={crearMeta}
              style={{ display: "flex", gap: "10px", marginBottom: "15px" }}
            >
              <input
                type="text"
                placeholder="Ej: Viaje..."
                value={tituloMeta}
                onChange={(e) => setTituloMeta(e.target.value)}
                required
                style={{ flex: 2, marginBottom: 0 }}
              />
              <input
                type="number"
                placeholder={`Meta`}
                value={montoObjetivoMeta}
                onChange={(e) => setMontoObjetivoMeta(e.target.value)}
                required
                style={{ flex: 1, marginBottom: 0 }}
              />
              <button
                type="submit"
                className="btn-primary"
                style={{
                  width: "auto",
                  padding: "0 15px",
                  backgroundColor: "#FFBB28",
                  color: "#000",
                }}
              >
                Crear
              </button>
            </form>
            {metas.map((m) => {
              const porcentaje = Math.min(
                (m.monto_actual / m.monto_objetivo) * 100,
                100,
              ).toFixed(1);
              return (
                <div
                  key={m.id}
                  style={{
                    backgroundColor: "#2a2a2a",
                    padding: "15px",
                    borderRadius: "10px",
                    marginBottom: "10px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: "5px",
                    }}
                  >
                    <strong>{m.titulo}</strong>
                    <span style={{ color: "#FFBB28", fontWeight: "bold" }}>
                      {porcentaje}%
                    </span>
                  </div>
                  <div
                    style={{
                      width: "100%",
                      backgroundColor: "#1e1e1e",
                      borderRadius: "5px",
                      height: "10px",
                      marginBottom: "10px",
                    }}
                  >
                    <div
                      style={{
                        width: `${porcentaje}%`,
                        backgroundColor: "#FFBB28",
                        height: "100%",
                        borderRadius: "5px",
                      }}
                    ></div>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <small style={{ color: "#aaa" }}>
                      {formatearNumero(m.monto_actual, m.moneda)} /{" "}
                      {formatearNumero(m.monto_objetivo, m.moneda)}
                    </small>
                    <button
                      onClick={() => aportarAMeta(m)}
                      style={{
                        backgroundColor: "#28a745",
                        color: "white",
                        border: "none",
                        padding: "5px 10px",
                        borderRadius: "5px",
                        cursor: "pointer",
                      }}
                    >
                      + Aportar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* =========================================
            PESTAÑA 5: HISTORIAL (AHORA ES UN COMPONENTE LIMPITO)
        ========================================= */}
        {activeTab === "historial" && (
          <Historial
            gastos={gastos}
            obtenerDatos={obtenerDatos}
            getNombreUsuario={getNombreUsuario}
            formatearFecha={formatearFecha}
            formatearNumero={formatearNumero}
          />
        )}
      </div>

      <Navegacion activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}

export default App;
