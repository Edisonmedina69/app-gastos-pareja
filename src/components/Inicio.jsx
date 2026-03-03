// src/components/Inicio.jsx
import { useState } from "react";
import { supabase } from "../supabase";
import { toast } from "react-hot-toast";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

export default function Inicio({
  usuarioActual,
  otroUsuario,
  usuarios,
  gastos,
  ingresos,
  cuentas,
  monedaGlobal,
  setMonedaGlobal,
  obtenerDatos,
}) {
  const [concepto, setConcepto] = useState("");
  const [monto, setMonto] = useState("");
  const [categoria, setCategoria] = useState("Casa");
  const [paraQuien, setParaQuien] = useState("Ambos");
  const [porcentajePagador, setPorcentajePagador] = useState(50);

  // NUEVO ESTADO PARA CONTROLAR LA VENTANA EMERGENTE
  const [mostrarModal, setMostrarModal] = useState(false);

  function formatearNumero(num, mon) {
    if (!num) return "0";
    const formato = Number(num).toLocaleString("es-PY");
    return mon === "BRL" ? `R$ ${formato}` : `${formato} Gs.`;
  }

  async function guardarGasto(e) {
    e.preventDefault();
    if (!usuarioActual) return;

    const toastId = toast.loading("Guardando gasto...");

    const { error } = await supabase.from("gastos").insert([
      {
        concepto,
        monto: parseFloat(monto),
        categoria,
        pagador_id: usuarioActual.id,
        para_quien: paraQuien,
        moneda: monedaGlobal,
        porcentaje_pagador: paraQuien === "Ambos" ? porcentajePagador : 100,
      },
    ]);

    if (error) {
      toast.error("Error: " + error.message, { id: toastId });
    } else {
      setConcepto("");
      setMonto("");
      setPorcentajePagador(50);
      setMostrarModal(false); // CERRAMOS EL MODAL AL GUARDAR
      toast.success("¡Gasto guardado con éxito! 🛒", { id: toastId });
      obtenerDatos();
    }
  }

  // --- MATEMÁTICA Y PREPARACIÓN DE GRÁFICOS ---
  let saldoBilleteraYo = 0;
  let saldoBilleteraOtro = 0;
  let balanceDeudas = 0;
  let totalGastadoYo = 0;
  let totalGastadoOtro = 0;

  const gastosPorCategoria = {};
  const gastosPorPersonaCategoria = {};

  if (usuarioActual && otroUsuario) {
    ingresos.forEach((i) => {
      if (i.moneda === monedaGlobal) {
        if (i.usuario_id === usuarioActual.id)
          saldoBilleteraYo += Number(i.monto);
        else if (i.usuario_id === otroUsuario.id)
          saldoBilleteraOtro += Number(i.monto);
      }
    });

    gastos.forEach((g) => {
      const montoGasto = Number(g.monto);

      if (g.moneda === monedaGlobal) {
        if (g.pagador_id === usuarioActual.id) {
          saldoBilleteraYo -= montoGasto;
          totalGastadoYo += montoGasto;
        } else if (g.pagador_id === otroUsuario.id) {
          saldoBilleteraOtro -= montoGasto;
          totalGastadoOtro += montoGasto;
        }

        if (g.para_quien === "Ambos") {
          const porcPagador = Number(g.porcentaje_pagador || 50);
          const porcOtro = 100 - porcPagador;

          if (g.pagador_id === usuarioActual.id)
            balanceDeudas += montoGasto * (porcOtro / 100);
          else if (g.pagador_id === otroUsuario.id)
            balanceDeudas -= montoGasto * (porcOtro / 100);
        } else {
          if (
            g.pagador_id === usuarioActual.id &&
            g.para_quien === otroUsuario.nombre
          )
            balanceDeudas += montoGasto;
          else if (
            g.pagador_id === otroUsuario.id &&
            g.para_quien === usuarioActual.nombre
          )
            balanceDeudas -= montoGasto;
        }

        if (gastosPorCategoria[g.categoria])
          gastosPorCategoria[g.categoria] += montoGasto;
        else gastosPorCategoria[g.categoria] = montoGasto;

        if (!gastosPorPersonaCategoria[g.categoria]) {
          gastosPorPersonaCategoria[g.categoria] = {
            name: g.categoria,
            Yo: 0,
            Pareja: 0,
          };
        }
        if (g.pagador_id === usuarioActual.id)
          gastosPorPersonaCategoria[g.categoria].Yo += montoGasto;
        else if (g.pagador_id === otroUsuario.id)
          gastosPorPersonaCategoria[g.categoria].Pareja += montoGasto;
      }
    });
  }

  // --- MODO SUPERVIVENCIA (CÁLCULO DE FALTANTE) ---
  let totalCuentasPendientes = 0;
  if (cuentas) {
    cuentas.forEach((c) => {
      if (c.estado !== "Pagado" && c.moneda === monedaGlobal) {
        const hoy = new Date();
        const fPago = c.fecha_ultimo_pago
          ? new Date(c.fecha_ultimo_pago)
          : null;
        const pagadoMes =
          fPago &&
          fPago.getMonth() === hoy.getMonth() &&
          fPago.getFullYear() === hoy.getFullYear();

        if (!pagadoMes) {
          totalCuentasPendientes += Number(c.monto);
        }
      }
    });
  }

  const saldoTotalFamiliar = saldoBilleteraYo + saldoBilleteraOtro;
  const faltante = totalCuentasPendientes - saldoTotalFamiliar;
  const necesitaPlata = faltante > 0;

  const datosGraficoCategorias = Object.keys(gastosPorCategoria).map((key) => ({
    name: key,
    value: gastosPorCategoria[key],
  }));
  const datosGraficoBarras = Object.values(gastosPorPersonaCategoria);
  const datosQuienGastoMas = [
    { name: "Yo", value: totalGastadoYo },
    { name: otroUsuario?.nombre || "Pareja", value: totalGastadoOtro },
  ].filter((d) => d.value > 0);

  const COLORES = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"];

  return (
    <>
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
            backgroundColor: monedaGlobal === "PYG" ? "#646cff" : "transparent",
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
            backgroundColor: monedaGlobal === "BRL" ? "#28a745" : "transparent",
            color: "white",
          }}
        >
          🇧🇷 R$
        </button>
      </div>

      {/* BOTÓN GIGANTE PARA ABRIR EL CADASTRO */}
      <button
        onClick={() => setMostrarModal(true)}
        style={{
          width: "100%",
          padding: "15px",
          backgroundColor: "#646cff",
          color: "white",
          border: "none",
          borderRadius: "10px",
          fontSize: "16px",
          fontWeight: "bold",
          marginBottom: "20px",
          cursor: "pointer",
          boxShadow: "0 4px 6px rgba(0,0,0,0.3)",
        }}
      >
        ➕ Registrar Nuevo Gasto
      </button>

      <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
        <div
          className="card"
          style={{
            flex: 1,
            margin: 0,
            padding: "15px",
            borderTop: "4px solid #646cff",
          }}
        >
          <small style={{ color: "#aaa" }}>Mi Billetera</small>
          <h3
            style={{
              margin: "5px 0 0 0",
              color: saldoBilleteraYo < 0 ? "#dc3545" : "white",
            }}
          >
            {formatearNumero(saldoBilleteraYo, monedaGlobal)}
          </h3>
        </div>
        <div
          className="card"
          style={{
            flex: 1,
            margin: 0,
            padding: "15px",
            borderTop: "4px solid #888",
          }}
        >
          <small style={{ color: "#aaa" }}>
            Billetera {otroUsuario?.nombre}
          </small>
          <h3
            style={{
              margin: "5px 0 0 0",
              color: saldoBilleteraOtro < 0 ? "#dc3545" : "white",
            }}
          >
            {formatearNumero(saldoBilleteraOtro, monedaGlobal)}
          </h3>
        </div>
      </div>

      {/* TARJETA MODO SUPERVIVENCIA S.O.S */}
      <div
        className="card"
        style={{
          borderLeft: necesitaPlata ? "5px solid #dc3545" : "5px solid #28a745",
          backgroundColor: necesitaPlata
            ? "rgba(220, 53, 69, 0.1)"
            : "rgba(40, 167, 69, 0.1)",
        }}
      >
        <h3
          style={{
            margin: "0 0 10px 0",
            color: necesitaPlata ? "#ff6b6b" : "#4ade80",
          }}
        >
          {necesitaPlata
            ? "🚨 Alerta: Nos faltan fondos"
            : "✅ Cuentas del mes aseguradas"}
        </h3>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "14px",
            color: "#ccc",
            marginBottom: "5px",
          }}
        >
          <span>Deudas pendientes del mes:</span>
          <strong style={{ color: "white" }}>
            {formatearNumero(totalCuentasPendientes, monedaGlobal)}
          </strong>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "14px",
            color: "#ccc",
            marginBottom: "15px",
          }}
        >
          <span>Plata en las billeteras (Suma):</span>
          <strong style={{ color: "white" }}>
            {formatearNumero(saldoTotalFamiliar, monedaGlobal)}
          </strong>
        </div>
        {necesitaPlata ? (
          <div
            style={{
              backgroundColor: "#dc3545",
              padding: "10px",
              borderRadius: "5px",
              textAlign: "center",
              color: "white",
              fontWeight: "bold",
            }}
          >
            Falta conseguir: {formatearNumero(faltante, monedaGlobal)}
          </div>
        ) : (
          <div
            style={{
              backgroundColor: "#28a745",
              padding: "10px",
              borderRadius: "5px",
              textAlign: "center",
              color: "white",
              fontWeight: "bold",
            }}
          >
            Nos sobra: {formatearNumero(Math.abs(faltante), monedaGlobal)} 🎉
          </div>
        )}
      </div>

      <div
        className="card"
        style={{
          borderLeft: `5px solid ${balanceDeudas === 0 ? "#28a745" : balanceDeudas > 0 ? "#dc3545" : "#ffc107"}`,
        }}
      >
        <h3>Ajuste de Cuentas ⚖️</h3>
        <h3 style={{ margin: 0 }}>
          {balanceDeudas === 0
            ? "¡Están al día! 🍻"
            : balanceDeudas > 0
              ? `${otroUsuario?.nombre} te debe: ${formatearNumero(balanceDeudas, monedaGlobal)}`
              : `Le debés a ${otroUsuario?.nombre}: ${formatearNumero(Math.abs(balanceDeudas), monedaGlobal)}`}
        </h3>
      </div>

      {/* MODAL DE CADASTRO (Ventana Emergente Oculta) */}
      {mostrarModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.85)",
            zIndex: 999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: "400px",
              maxHeight: "90vh",
              overflowY: "auto",
              position: "relative",
              margin: 0,
              borderTop: "4px solid #646cff",
            }}
          >
            <button
              onClick={() => setMostrarModal(false)}
              style={{
                position: "absolute",
                top: "15px",
                right: "15px",
                background: "transparent",
                border: "none",
                fontSize: "20px",
                color: "#aaa",
                cursor: "pointer",
              }}
            >
              ✖
            </button>

            <h3 style={{ marginTop: 0 }}>🛒 Cargar Gasto</h3>

            <form onSubmit={guardarGasto}>
              <input
                type="text"
                placeholder="Ej: Supermercado..."
                value={concepto}
                onChange={(e) => setConcepto(e.target.value)}
                required
              />
              <input
                type="number"
                placeholder={`Monto`}
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
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
                Visualización: {formatearNumero(monto, monedaGlobal)}
              </div>

              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
              >
                <option value="Casa">🏡 Casa</option>
                <option value="Supermercado">🛒 Supermercado</option>
                <option value="Combustible">⛽ Combustible</option>
                <option value="Viajes">✈️ Viajes</option>
                <option value="Salidas">🍕 Salidas</option>
                <option value="Ahorro">🐷 Ahorro</option>
                <option value="Cuidado Personal">🧴 Cuidado Personal</option>
                <option value="Salud">💊 Salud</option>
              </select>

              <select
                value={paraQuien}
                onChange={(e) => setParaQuien(e.target.value)}
              >
                <option value="Ambos">Para: Ambos</option>
                {usuarios.map((u) => (
                  <option key={u.id} value={u.nombre}>
                    Para: {u.nombre}
                  </option>
                ))}
              </select>

              {paraQuien === "Ambos" && (
                <div
                  style={{
                    marginBottom: "15px",
                    backgroundColor: "#2a2a2a",
                    padding: "15px",
                    borderRadius: "8px",
                    border: "1px solid #444",
                  }}
                >
                  <label
                    style={{
                      fontSize: "13px",
                      color: "#ddd",
                      display: "block",
                      marginBottom: "10px",
                      fontWeight: "bold",
                    }}
                  >
                    ¿Cómo dividimos este gasto?
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={porcentajePagador}
                    onChange={(e) => setPorcentajePagador(e.target.value)}
                    style={{
                      width: "100%",
                      cursor: "pointer",
                      accentColor: "#646cff",
                    }}
                  />
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "13px",
                      color: "#aaa",
                      marginTop: "8px",
                    }}
                  >
                    <span>
                      Yo pago:{" "}
                      <strong style={{ color: "white" }}>
                        {porcentajePagador}%
                      </strong>
                    </span>
                    <span>
                      {otroUsuario?.nombre}:{" "}
                      <strong style={{ color: "white" }}>
                        {100 - porcentajePagador}%
                      </strong>
                    </span>
                  </div>
                </div>
              )}
              <button
                type="submit"
                className="btn-primary"
                style={{ width: "100%", marginTop: "10px", padding: "12px" }}
              >
                Registrar y Cerrar
              </button>
            </form>
          </div>
        </div>
      )}

      {/* =========================================
          📊 SECCIÓN DE ANALYTICS (NUEVOS GRÁFICOS)
      ========================================= */}
      {datosGraficoCategorias.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div
            className="card"
            style={{
              height: "300px",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <h3 style={{ marginBottom: 0 }}>📊 Total por Categoría</h3>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={datosGraficoCategorias}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {datosGraficoCategorias.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORES[index % COLORES.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => formatearNumero(value, monedaGlobal)}
                  contentStyle={{
                    backgroundColor: "#1e1e1e",
                    borderColor: "#444",
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div
            className="card"
            style={{
              height: "300px",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <h3 style={{ marginBottom: 0 }}>⚖️ ¿Quién puso más plata?</h3>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={datosQuienGastoMas}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="value"
                  label
                >
                  <Cell fill="#646cff" />
                  <Cell fill="#28a745" />
                </Pie>
                <Tooltip
                  formatter={(value) => formatearNumero(value, monedaGlobal)}
                  contentStyle={{
                    backgroundColor: "#1e1e1e",
                    borderColor: "#444",
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div
            className="card"
            style={{
              height: "350px",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <h3 style={{ marginBottom: 15 }}>🔎 Qué pagó cada uno</h3>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={datosGraficoBarras}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="name" stroke="#aaa" fontSize={12} />
                <YAxis
                  stroke="#aaa"
                  fontSize={12}
                  tickFormatter={(val) =>
                    val >= 1000000
                      ? `${(val / 1000000).toFixed(1)}M`
                      : val >= 1000
                        ? `${(val / 1000).toFixed(0)}k`
                        : val
                  }
                />
                <Tooltip
                  cursor={{ fill: "#333" }}
                  contentStyle={{
                    backgroundColor: "#1e1e1e",
                    borderColor: "#444",
                  }}
                  formatter={(value) => formatearNumero(value, monedaGlobal)}
                />
                <Legend />
                <Bar
                  dataKey="Yo"
                  fill="#646cff"
                  radius={[4, 4, 0, 0]}
                  name="Yo pagué"
                />
                <Bar
                  dataKey="Pareja"
                  fill="#28a745"
                  radius={[4, 4, 0, 0]}
                  name={`${otroUsuario?.nombre} pagó`}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </>
  );
}
