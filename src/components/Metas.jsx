// src/components/Metas.jsx
import { useState } from "react";
import { supabase } from "../supabase";
import { toast } from "react-hot-toast";

export default function Metas({
  usuarioActual,
  metas,
  monedaGlobal,
  obtenerDatos,
  formatearNumero,
}) {
  const [tituloMeta, setTituloMeta] = useState("");
  const [montoObjetivoMeta, setMontoObjetivoMeta] = useState("");
  const [mostrarModal, setMostrarModal] = useState(false);

  async function crearMeta(e) {
    e.preventDefault();
    const toastId = toast.loading("Creando meta...");

    const { error } = await supabase.from("metas_ahorro").insert([
      {
        titulo: tituloMeta,
        monto_objetivo: parseFloat(montoObjetivoMeta),
        moneda: monedaGlobal,
        creador_id: usuarioActual.id,
      },
    ]);

    if (error) {
      toast.error("Error al crear la meta: " + error.message, { id: toastId });
    } else {
      setTituloMeta("");
      setMontoObjetivoMeta("");
      setMostrarModal(false); // Cierra la ventana
      toast.success("¡Meta creada con éxito! 🐷", { id: toastId });
      obtenerDatos();
    }
  }

  async function aportarAMeta(meta) {
    const aporte = prompt(
      `¿Cuántos ${meta.moneda} querés aportar a "${meta.titulo}"?`,
    );
    if (aporte && !isNaN(aporte) && aporte > 0) {
      const toastId = toast.loading("Registrando aporte...");

      const { error } = await supabase
        .from("metas_ahorro")
        .update({ monto_actual: Number(meta.monto_actual) + Number(aporte) })
        .eq("id", meta.id);

      if (error) {
        toast.error("Error al aportar", { id: toastId });
      } else {
        await supabase
          .from("gastos")
          .insert([
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
        toast.success("¡Aporte registrado! 💸", { id: toastId });
      }
    }
  }

  return (
    <>
      {/* BOTÓN GIGANTE PARA NUEVA META */}
      <button
        onClick={() => setMostrarModal(true)}
        style={{
          width: "100%",
          padding: "15px",
          backgroundColor: "#FFBB28",
          color: "black",
          border: "none",
          borderRadius: "10px",
          fontSize: "16px",
          fontWeight: "bold",
          marginBottom: "20px",
          cursor: "pointer",
          boxShadow: "0 4px 6px rgba(0,0,0,0.3)",
        }}
      >
        ➕ Crear Nueva Meta de Ahorro
      </button>

      {/* EXTRACTO (INDEX) DE METAS */}
      <div className="card" style={{ borderTop: "4px solid #FFBB28" }}>
        <h3 style={{ margin: "0 0 15px 0" }}>🐷 Nuestras Metas</h3>

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
                marginBottom: "15px",
                border: "1px solid #444",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "5px",
                }}
              >
                <strong style={{ fontSize: "16px" }}>{m.titulo}</strong>
                <span
                  style={{
                    color: "#FFBB28",
                    fontWeight: "bold",
                    fontSize: "16px",
                  }}
                >
                  {porcentaje}%
                </span>
              </div>
              <div
                style={{
                  width: "100%",
                  backgroundColor: "#1e1e1e",
                  borderRadius: "5px",
                  height: "12px",
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
                    padding: "8px 12px",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontWeight: "bold",
                  }}
                >
                  + Aportar
                </button>
              </div>
            </div>
          );
        })}
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
              borderTop: "4px solid #FFBB28",
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

            <h3 style={{ marginTop: 0 }}>🐷 Crear Meta</h3>

            <form onSubmit={crearMeta}>
              <input
                type="text"
                placeholder="Ej: Viaje a Camboriú, Auto nuevo..."
                value={tituloMeta}
                onChange={(e) => setTituloMeta(e.target.value)}
                required
              />
              <input
                type="number"
                placeholder={`Monto a alcanzar en ${monedaGlobal}`}
                value={montoObjetivoMeta}
                onChange={(e) => setMontoObjetivoMeta(e.target.value)}
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
                Visualización:{" "}
                {formatearNumero(montoObjetivoMeta, monedaGlobal)}
              </div>

              <button
                type="submit"
                className="btn-primary"
                style={{
                  backgroundColor: "#FFBB28",
                  color: "black",
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
