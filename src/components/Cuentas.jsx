// src/components/Cuentas.jsx
import { useState, useEffect } from "react";
import { supabase } from "../supabase";
import { toast } from "react-hot-toast";
import { Trash2, AlertCircle } from "lucide-react"; // Usamos Lucide

export default function Cuentas({
  usuarioActual,
  otroUsuario,
  usuarios,
  cuentas,
  monedaGlobal,
  obtenerDatos,
}) {
  const [tipoCuenta, setTipoCuenta] = useState("unica");
  const [descCuenta, setDescCuenta] = useState("");
  const [montoCuenta, setMontoCuenta] = useState("");
  const [diaVencimiento, setDiaVencimiento] = useState("5");
  const [totalCuotas, setTotalCuotas] = useState("");
  const [responsableCuenta, setResponsableCuenta] = useState("Ambos");
  const [porcentajeMora, setPorcentajeMora] = useState("5"); // 5% de interés por defecto

  const [bancoTarjeta, setBancoTarjeta] = useState("");
  const [numeroTarjeta, setNumeroTarjeta] = useState("");
  const [limiteCredito, setLimiteCredito] = useState("");
  const [montoTotalTarjeta, setMontoTotalTarjeta] = useState("");

  const [deudorId, setDeudorId] = useState("");
  const [prestamosInformales, setPrestamosInformales] = useState([]);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (usuarioActual && !deudorId) setDeudorId(usuarioActual.id);
    cargarPrestamosInformales();
  }, [usuarioActual]);

  async function cargarPrestamosInformales() {
    const { data } = await supabase
      .from("prestamos_personales")
      .select("*")
      .order("estado", { ascending: false });
    if (data) setPrestamosInformales(data);
  }

  function formatearNumero(num, mon) {
    if (!num) return "0";
    const formato = Math.round(Number(num)).toLocaleString("es-PY");
    return mon === "BRL" ? `R$ ${formato}` : `${formato} Gs.`;
  }

  function fuePagadoEsteMes(fechaUltimoPago) {
    if (!fechaUltimoPago) return false;
    const f = new Date(fechaUltimoPago);
    const hoy = new Date();
    return (
      f.getFullYear() * 12 + f.getMonth() >=
      hoy.getFullYear() * 12 + hoy.getMonth()
    );
  }

  // --- FUNCIÓN PARA ELIMINAR CUENTA ---
  async function eliminarCuenta(id) {
    if (
      window.confirm(
        "¿Seguro que querés eliminar esta cuenta? Esto no se puede deshacer.",
      )
    ) {
      const { error } = await supabase
        .from("cuentas_pendientes")
        .delete()
        .eq("id", id);
      if (error) toast.error("No se pudo eliminar");
      else {
        toast.success("Cuenta eliminada 🗑️");
        obtenerDatos();
      }
    }
  }

  async function guardarCuenta(e) {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    const toastId = toast.loading("Guardando en Ñandefinanza...");

    // Lógica Préstamo Pareja
    if (tipoCuenta === "informal") {
      const acreedorId =
        deudorId === usuarioActual.id ? otroUsuario.id : usuarioActual.id;
      const { error } = await supabase
        .from("prestamos_personales")
        .insert([
          {
            deudor_id: deudorId,
            acreedor_id: acreedorId,
            monto_total: parseFloat(montoCuenta),
            concepto: descCuenta,
            moneda: monedaGlobal,
          },
        ]);
      if (error) toast.error(error.message, { id: toastId });
      else {
        setMostrarModal(false);
        toast.success("Préstamo anotado!", { id: toastId });
        cargarPrestamosInformales();
      }
      setIsSubmitting(false);
      return;
    }

    let descFinal = descCuenta;
    if (tipoCuenta === "tarjeta") {
      descFinal = `💳 TC ${bancoTarjeta} (*${numeroTarjeta}) | Mora: ${porcentajeMora}%`;
    } else if (tipoCuenta === "servicio") {
      descFinal = `💧 Servicio: ${descCuenta} | Mora: ${porcentajeMora}%`;
    }

    const { error } = await supabase.from("cuentas_pendientes").insert([
      {
        descripcion: descFinal,
        monto: parseFloat(montoCuenta),
        es_recurrente: true,
        dia_vencimiento: parseInt(diaVencimiento),
        total_cuotas: tipoCuenta === "cuotas" ? parseInt(totalCuotas) : 120,
        cuotas_pagadas: 0,
        estado: "Pendiente",
        responsable: responsableCuenta,
        moneda: monedaGlobal,
      },
    ]);

    if (error) toast.error(error.message, { id: toastId });
    else {
      setMostrarModal(false);
      toast.success("Registrado correctamente 📝", { id: toastId });
      obtenerDatos();
    }
    setIsSubmitting(false);
  }

  async function pagarCuenta(cuenta, montoFinal) {
    const esUltima = cuenta.cuotas_pagadas + 1 >= cuenta.total_cuotas;
    if (
      window.confirm(
        `¿Confirmar pago de ${formatearNumero(montoFinal, cuenta.moneda)}?`,
      )
    ) {
      await supabase
        .from("cuentas_pendientes")
        .update({
          cuotas_pagadas: cuenta.cuotas_pagadas + 1,
          estado: esUltima ? "Pagado" : "Pendiente",
          fecha_ultimo_pago: new Date().toISOString(),
          pagador_id: usuarioActual.id,
        })
        .eq("id", cuenta.id);

      await supabase.from("gastos").insert([
        {
          concepto: `Pago: ${cuenta.descripcion.split("|")[0]}`,
          monto: montoFinal,
          categoria: "Cuentas",
          pagador_id: usuarioActual.id,
          para_quien: cuenta.responsable,
          moneda: cuenta.moneda,
        },
      ]);
      toast.success("Pago realizado! ✅");
      obtenerDatos();
    }
  }

  return (
    <>
      <button
        onClick={() => setMostrarModal(true)}
        className="btn-primary"
        style={{ backgroundColor: "#dc3545", marginBottom: "20px" }}
      >
        ➕ Nueva Deuda / Tarjeta / Servicio
      </button>

      {/* LISTADO DE CUENTAS */}
      <div className="card" style={{ borderTop: "4px solid #dc3545" }}>
        <h3 style={{ margin: "0 0 15px 0" }}>⚠️ Pendientes de Pago</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {cuentas
            .filter((c) => c.estado !== "Pagado")
            .map((c) => {
              const pagadoMes = fuePagadoEsteMes(c.fecha_ultimo_pago);
              const diaActual = new Date().getDate();
              const estaVencido = !pagadoMes && c.dia_vencimiento < diaActual;

              // LÓGICA DE MORA: Extraemos el % de la descripción o usamos 5%
              const moraMatch = c.descripcion.match(/Mora: (\d+)%/);
              const tasaMora = moraMatch ? parseInt(moraMatch[1]) / 100 : 0.05;
              const montoConMora = estaVencido
                ? c.monto * (1 + tasaMora)
                : c.monto;

              return (
                <div
                  key={c.id}
                  className="movimiento-item"
                  style={{
                    borderLeft: estaVencido
                      ? "5px solid #ff0000"
                      : "5px solid #333",
                    backgroundColor: estaVencido
                      ? "rgba(255,0,0,0.05)"
                      : "transparent",
                    opacity: pagadoMes ? 0.5 : 1,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <strong
                        style={{ color: estaVencido ? "#ff6b6b" : "white" }}
                      >
                        {c.descripcion.split("|")[0]}
                      </strong>
                      <div style={{ fontSize: "12px", color: "#888" }}>
                        Vence el día: {c.dia_vencimiento} | {c.responsable}
                      </div>

                      <div style={{ marginTop: "8px" }}>
                        {estaVencido ? (
                          <>
                            <div
                              style={{
                                fontSize: "11px",
                                textDecoration: "line-through",
                                color: "#888",
                              }}
                            >
                              Base: {formatearNumero(c.monto, c.moneda)}
                            </div>
                            <div
                              style={{
                                fontSize: "16px",
                                fontWeight: "bold",
                                color: "#ff0000",
                              }}
                            >
                              Total con Mora:{" "}
                              {formatearNumero(montoConMora, c.moneda)}
                            </div>
                          </>
                        ) : (
                          <div
                            style={{
                              fontSize: "16px",
                              fontWeight: "bold",
                              color: "#28a745",
                            }}
                          >
                            {formatearNumero(c.monto, c.moneda)}
                          </div>
                        )}
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "10px",
                        alignItems: "flex-end",
                      }}
                    >
                      <div style={{ display: "flex", gap: "10px" }}>
                        <button
                          onClick={() => eliminarCuenta(c.id)}
                          style={{
                            background: "none",
                            border: "none",
                            color: "#555",
                            cursor: "pointer",
                          }}
                        >
                          <Trash2 size={18} />
                        </button>
                        {!pagadoMes && (
                          <button
                            onClick={() => pagarCuenta(c, montoConMora)}
                            className="btn-primary"
                            style={{
                              padding: "8px 15px",
                              width: "auto",
                              fontSize: "13px",
                              backgroundColor: estaVencido
                                ? "#ff0000"
                                : "#28a745",
                            }}
                          >
                            Pagar
                          </button>
                        )}
                      </div>
                      {estaVencido && (
                        <span
                          style={{
                            color: "#ff0000",
                            fontSize: "10px",
                            fontWeight: "bold",
                          }}
                        >
                          ⚠️ ATRASADO
                        </span>
                      )}
                      {pagadoMes && (
                        <span style={{ color: "#28a745", fontSize: "11px" }}>
                          ✅ AL DÍA
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* MODAL DE CARGA */}
      {mostrarModal && (
        <div
          className="modal-overlay"
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
              maxWidth: "450px",
              maxHeight: "90vh",
              overflowY: "auto",
              borderTop: "4px solid #dc3545",
            }}
          >
            <h3 style={{ marginTop: 0 }}>Anote el compromiso 🇵🇾</h3>

            <div
              style={{
                display: "flex",
                gap: "5px",
                marginBottom: "15px",
                flexWrap: "wrap",
              }}
            >
              <button
                onClick={() => setTipoCuenta("unica")}
                style={{
                  flex: 1,
                  padding: "8px",
                  fontSize: "11px",
                  backgroundColor:
                    tipoCuenta === "unica" ? "#dc3545" : "#2a2a2a",
                }}
              >
                🧾 Única
              </button>
              <button
                onClick={() => setTipoCuenta("servicio")}
                style={{
                  flex: 1,
                  padding: "8px",
                  fontSize: "11px",
                  backgroundColor:
                    tipoCuenta === "servicio" ? "#0088FE" : "#2a2a2a",
                }}
              >
                💧 Fijo
              </button>
              <button
                onClick={() => setTipoCuenta("tarjeta")}
                style={{
                  flex: 1,
                  padding: "8px",
                  fontSize: "11px",
                  backgroundColor:
                    tipoCuenta === "tarjeta" ? "#FF8042" : "#2a2a2a",
                }}
              >
                💳 Tarjeta
              </button>
              <button
                onClick={() => setTipoCuenta("cuotas")}
                style={{
                  flex: 1,
                  padding: "8px",
                  fontSize: "11px",
                  backgroundColor:
                    tipoCuenta === "cuotas" ? "#dc3545" : "#2a2a2a",
                }}
              >
                🗓️ Cuotas
              </button>
            </div>

            <form onSubmit={guardarCuenta}>
              {tipoCuenta === "tarjeta" ? (
                <>
                  <input
                    type="text"
                    placeholder="Banco (Itaú, Continental...)"
                    onChange={(e) => setBancoTarjeta(e.target.value)}
                    required
                  />
                  <input
                    type="text"
                    maxLength="4"
                    placeholder="Últimos 4 N° de Tarjeta"
                    onChange={(e) => setNumeroTarjeta(e.target.value)}
                    required
                  />
                </>
              ) : (
                <input
                  type="text"
                  placeholder="¿De qué es la cuenta?"
                  value={descCuenta}
                  onChange={(e) => setDescCuenta(e.target.value)}
                  required
                />
              )}

              <input
                type="number"
                placeholder="Monto a pagar"
                value={montoCuenta}
                onChange={(e) => setMontoCuenta(e.target.value)}
                required
              />

              <div style={{ display: "flex", gap: "10px" }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: "11px", color: "#888" }}>
                    Día Vencimiento:
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={diaVencimiento}
                    onChange={(e) => setDiaVencimiento(e.target.value)}
                    required
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: "11px", color: "#888" }}>
                    % Mora x atraso:
                  </label>
                  <input
                    type="number"
                    value={porcentajeMora}
                    onChange={(e) => setPorcentajeMora(e.target.value)}
                    required
                  />
                </div>
              </div>

              <select
                value={responsableCuenta}
                onChange={(e) => setResponsableCuenta(e.target.value)}
              >
                <option value="Ambos">Responsable: Ambos</option>
                {usuarios.map((u) => (
                  <option key={u.id} value={u.nombre}>
                    Responsable: {u.nombre}
                  </option>
                ))}
              </select>

              <div style={{ display: "flex", gap: "10px", marginTop: "15px" }}>
                <button
                  type="button"
                  onClick={() => setMostrarModal(false)}
                  style={{ flex: 1, backgroundColor: "#444" }}
                >
                  Cerrar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-primary"
                  style={{ flex: 2 }}
                >
                  {isSubmitting ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
