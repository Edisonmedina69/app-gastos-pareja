// src/components/Ingresos.jsx
import { useState } from "react";
import { supabase } from "../supabase";
import { toast } from "react-hot-toast";

export default function Ingresos({
  usuarioActual,
  ingresos,
  monedaGlobal,
  obtenerDatos,
  getNombreUsuario,
  formatearNumero,
}) {
  const [conceptoIngreso, setConceptoIngreso] = useState("Salario Mensual");
  const [montoIngreso, setMontoIngreso] = useState("");
  const [mostrarModal, setMostrarModal] = useState(false);

  async function guardarIngreso(e) {
    e.preventDefault();
    if (!usuarioActual) return;

    const toastId = toast.loading("Guardando ingreso...");
    const fecha = new Date();

    const { error } = await supabase.from("ingresos_mensuales").insert([
      {
        usuario_id: usuarioActual.id,
        concepto: conceptoIngreso,
        monto: parseFloat(montoIngreso),
        mes: fecha.getMonth() + 1,
        anio: fecha.getFullYear(),
        moneda: monedaGlobal,
      },
    ]);

    if (error) {
      toast.error("Error al guardar ingreso: " + error.message, {
        id: toastId,
      });
    } else {
      setMontoIngreso("");
      setMostrarModal(false); // Cierra la ventana
      toast.success("¡Ingreso registrado! 💰", { id: toastId });
      obtenerDatos();
    }
  }

  return (
    <>
      {/* BOTÓN GIGANTE PARA NUEVO INGRESO */}
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

      {/* EXTRACTO (INDEX) DE INGRESOS */}
      <div className="card" style={{ borderTop: "4px solid #28a745" }}>
        <h3 style={{ margin: "0 0 15px 0" }}>📥 Historial de Ingresos</h3>
        <div>
          {ingresos.map((i) => (
            <div
              key={i.id}
              className="movimiento-item"
              style={{ borderLeft: "4px solid #28a745", paddingLeft: "10px" }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <strong>{getNombreUsuario(i.usuario_id)}</strong>
                  <div style={{ fontSize: "12px", color: "#888" }}>
                    {i.concepto}
                  </div>
                </div>
                <div className="movimiento-monto" style={{ color: "#28a745" }}>
                  + {formatearNumero(i.monto, i.moneda)}
                </div>
              </div>
            </div>
          ))}
        </div>
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
              <input
                type="text"
                placeholder="Ej: Salario Fijo, Venta..."
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
                style={{
                  backgroundColor: "#28a745",
                  width: "100%",
                  marginTop: "10px",
                  padding: "12px",
                }}
              >
                Guardar y Cerrar
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
