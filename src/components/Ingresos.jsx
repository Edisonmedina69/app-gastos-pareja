import { useState } from "react";
import { supabase } from "../supabase";
import { toast } from "react-hot-toast";

export default function Ingresos({
  usuarioActual,
  ingresos,
  monedaGlobal,
  obtenerDatos,
  usuarios,
}) {
  const hoy = new Date();
  const [conceptoIngreso, setConceptoIngreso] = useState("Salario Mensual");
  const [montoIngreso, setMontoIngreso] = useState("");
  const [mesIngreso, setMesIngreso] = useState(hoy.getMonth() + 1);
  const [anioIngreso, setAnioIngreso] = useState(hoy.getFullYear());

  const [mostrarModal, setMostrarModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const nombresMeses = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ];

  // Función interna para que nunca de error
  function formatearNum(num, mon) {
    if (!num) return "0";
    const formato = Number(num).toLocaleString("es-PY");
    return mon === "BRL" ? `R$ ${formato}` : `${formato} Gs.`;
  }

  function getNombreUser(id) {
    if (!usuarios) return "Desconocido";
    const user = usuarios.find((u) => u.id == id);
    return user ? user.nombre : "Desconocido";
  }

  async function guardarIngreso(e) {
    e.preventDefault();
    if (!usuarioActual || isSubmitting) return;

    setIsSubmitting(true);
    const toastId = toast.loading("Guardando ingreso...");

    const { error } = await supabase.from("ingresos_mensuales").insert([
      {
        usuario_id: usuarioActual.id,
        concepto: conceptoIngreso,
        monto: parseFloat(montoIngreso),
        mes: parseInt(mesIngreso),
        anio: parseInt(anioIngreso),
        moneda: monedaGlobal,
      },
    ]);

    if (error) {
      toast.error("Error al guardar: " + error.message, { id: toastId });
    } else {
      setMontoIngreso("");
      setMostrarModal(false);
      toast.success("¡Ingreso registrado! 💰", { id: toastId });
      obtenerDatos();
    }
    setIsSubmitting(false);
  }

  return (
    <>
      <button
        onClick={() => setMostrarModal(true)}
        style={{
          width: "100%",
          padding: "15px",
          backgroundColor: "#28a745",
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
        ➕ Registrar Nuevo Ingreso
      </button>

      <div className="card" style={{ borderTop: "4px solid #28a745" }}>
        <h3 style={{ margin: "0 0 15px 0" }}>📥 Historial de Ingresos</h3>
        <div>
          {ingresos &&
            ingresos.map((i) => (
              <div
                key={i.id}
                className="movimiento-item"
                style={{
                  borderLeft: "4px solid #28a745",
                  paddingLeft: "10px",
                  marginBottom: "10px",
                  backgroundColor: "#2a2a2a",
                  padding: "10px",
                  borderRadius: "8px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <strong>{getNombreUser(i.usuario_id)}</strong>
                    <div style={{ fontSize: "12px", color: "#888" }}>
                      {i.concepto}{" "}
                      <strong style={{ color: "#aaa" }}>
                        ({nombresMeses[i.mes - 1]} {i.anio})
                      </strong>
                    </div>
                  </div>
                  <div
                    className="movimiento-monto"
                    style={{ color: "#28a745", fontWeight: "bold" }}
                  >
                    + {formatearNum(i.monto, i.moneda)}
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* MODAL */}
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
              position: "relative",
              margin: 0,
              borderTop: "4px solid #28a745",
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
            <h3 style={{ marginTop: 0 }}>📥 Registrar Ingreso</h3>
            <form onSubmit={guardarIngreso}>
              <div
                style={{ display: "flex", gap: "10px", marginBottom: "10px" }}
              >
                <select
                  value={mesIngreso}
                  onChange={(e) => setMesIngreso(e.target.value)}
                  style={{ flex: 2 }}
                >
                  {nombresMeses.map((m, idx) => (
                    <option key={m} value={idx + 1}>
                      Mes: {m}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  value={anioIngreso}
                  onChange={(e) => setAnioIngreso(e.target.value)}
                  style={{ flex: 1 }}
                />
              </div>
              <input
                type="text"
                placeholder="Ej: Salario Fijo..."
                value={conceptoIngreso}
                onChange={(e) => setConceptoIngreso(e.target.value)}
                required
              />
              <input
                type="number"
                placeholder={`Monto`}
                value={montoIngreso}
                onChange={(e) => setMontoIngreso(e.target.value)}
                required
              />

              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary"
                style={{
                  backgroundColor: isSubmitting ? "#555" : "#28a745",
                  width: "100%",
                  marginTop: "10px",
                }}
              >
                {isSubmitting ? "Guardando..." : "Guardar y Cerrar"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
