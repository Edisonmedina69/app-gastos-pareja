// src/components/Cuentas.jsx
import { useState, useEffect } from "react";
import { supabase } from "../supabase";

export default function Cuentas({
  usuarioActual,
  otroUsuario,
  usuarios,
  cuentas,
  monedaGlobal,
  obtenerDatos,
}) {
  // Estados para Cuentas/Facturas formales
  const [tipoCuenta, setTipoCuenta] = useState("unica"); // 'unica', 'cuotas', o 'informal'
  const [descCuenta, setDescCuenta] = useState("");
  const [montoCuenta, setMontoCuenta] = useState("");
  const [diaVencimiento, setDiaVencimiento] = useState("5");
  const [totalCuotas, setTotalCuotas] = useState("");
  const [responsableCuenta, setResponsableCuenta] = useState("Ambos");

  // Estados para Préstamos en Pareja (Efectivo)
  const [deudorId, setDeudorId] = useState("");
  const [prestamosInformales, setPrestamosInformales] = useState([]);

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
    const formato = Number(num).toLocaleString("es-PY");
    return mon === "BRL" ? `R$ ${formato}` : `${formato} Gs.`;
  }

  function fuePagadoEsteMes(fechaUltimoPago) {
    if (!fechaUltimoPago) return false;
    const fecha = new Date(fechaUltimoPago);
    const hoy = new Date();
    return (
      fecha.getMonth() === hoy.getMonth() &&
      fecha.getFullYear() === hoy.getFullYear()
    );
  }

  function getNombreUsuario(id) {
    const user = usuarios.find((u) => u.id == id);
    return user ? user.nombre : "Desconocido";
  }

  // --- GUARDAR CUALQUIER TIPO DE DEUDA ---
  async function guardarCuenta(e) {
    e.preventDefault();

    // Lógica para el préstamo de plata entre ustedes
    if (tipoCuenta === "informal") {
      if (!otroUsuario) return alert("Falta tu pareja en el sistema.");
      const acreedorId =
        deudorId === usuarioActual.id ? otroUsuario.id : usuarioActual.id;

      const { error } = await supabase.from("prestamos_personales").insert([
        {
          deudor_id: deudorId,
          acreedor_id: acreedorId,
          monto_total: parseFloat(montoCuenta),
          concepto: descCuenta,
          moneda: monedaGlobal,
        },
      ]);

      if (error) alert("Error: " + error.message);
      else {
        setDescCuenta("");
        setMontoCuenta("");
        alert("¡Préstamo en pareja registrado!");
        cargarPrestamosInformales();
      }
      return;
    }

    // Lógica para facturas y préstamos externos (Moto, ANDE, etc)
    const esCuota = tipoCuenta === "cuotas";
    const { error } = await supabase.from("cuentas_pendientes").insert([
      {
        descripcion: descCuenta,
        monto: parseFloat(montoCuenta),
        es_recurrente: esCuota,
        dia_vencimiento: parseInt(diaVencimiento),
        total_cuotas: esCuota ? parseInt(totalCuotas) : 1,
        cuotas_pagadas: 0,
        estado: "Pendiente",
        responsable: responsableCuenta,
        moneda: monedaGlobal,
      },
    ]);

    if (error) alert("Error: " + error.message);
    else {
      setDescCuenta("");
      setMontoCuenta("");
      setTotalCuotas("");
      alert("¡Deuda registrada!");
      obtenerDatos();
    }
  }

  // --- PAGAR CUOTAS EXTERNAS ---
  async function pagarCuenta(cuenta) {
    if (!usuarioActual) return;
    const esUltima = cuenta.cuotas_pagadas + 1 >= cuenta.total_cuotas;
    if (window.confirm("¿Confirmar pago de esta cuota?")) {
      await supabase
        .from("cuentas_pendientes")
        .update({
          cuotas_pagadas: cuenta.cuotas_pagadas + 1,
          estado: esUltima ? "Pagado" : "Pendiente",
          fecha_ultimo_pago: new Date().toISOString(),
          pagador_id: usuarioActual.id,
          pago_solicitado_a: null,
        })
        .eq("id", cuenta.id);

      await supabase.from("gastos").insert([
        {
          concepto: `Pago: ${cuenta.descripcion}`,
          monto: cuenta.monto,
          categoria: "Préstamo",
          pagador_id: usuarioActual.id,
          para_quien: cuenta.responsable,
          moneda: cuenta.moneda,
        },
      ]);
      alert("¡Pago registrado en el balance!");
      obtenerDatos();
    }
  }

  // --- ABONAR A UN PRÉSTAMO EN PAREJA (PAGOS PARCIALES) ---
  async function abonarPrestamo(prestamo) {
    const restante = prestamo.monto_total - prestamo.monto_pagado;
    const abonoStr = prompt(
      `¿Cuántos ${prestamo.moneda} querés abonar? (Te falta saldar: ${formatearNumero(restante, prestamo.moneda)})`,
    );

    if (!abonoStr || isNaN(abonoStr)) return;
    const abono = parseFloat(abonoStr);
    if (abono <= 0 || abono > restante) return alert("Monto inválido.");

    const nuevoPagado = Number(prestamo.monto_pagado) + abono;
    const estaSaldado = nuevoPagado >= prestamo.monto_total;

    await supabase
      .from("prestamos_personales")
      .update({
        monto_pagado: nuevoPagado,
        estado: estaSaldado ? "Pagado" : "Pendiente",
      })
      .eq("id", prestamo.id);

    // Registra el movimiento en el historial para impactar la billetera
    await supabase.from("gastos").insert([
      {
        concepto: `Devolución préstamo: ${prestamo.concepto}`,
        monto: abono,
        categoria: "Préstamo",
        pagador_id: prestamo.deudor_id,
        para_quien:
          prestamo.deudor_id === usuarioActual.id
            ? otroUsuario?.nombre
            : usuarioActual.nombre,
        moneda: prestamo.moneda,
      },
    ]);

    alert("¡Abono registrado con éxito!");
    cargarPrestamosInformales();
    obtenerDatos();
  }

  async function pedirAyuda(cuentaId) {
    if (!otroUsuario) return;
    if (
      window.confirm(`¿Pedir ayuda a ${otroUsuario.nombre} para pagar esto?`)
    ) {
      await supabase
        .from("cuentas_pendientes")
        .update({ pago_solicitado_a: otroUsuario.id })
        .eq("id", cuentaId);
      obtenerDatos();
    }
  }

  return (
    <>
      <div className="card">
        <h3>📝 Registrar Deuda o Préstamo</h3>
        <div
          style={{
            display: "flex",
            gap: "5px",
            marginBottom: "15px",
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={(e) => {
              e.preventDefault();
              setTipoCuenta("unica");
            }}
            style={{
              flex: 1,
              padding: "8px",
              borderRadius: "5px",
              border: "none",
              backgroundColor: tipoCuenta === "unica" ? "#dc3545" : "#2a2a2a",
              color: "white",
              fontSize: "12px",
            }}
          >
            🧾 Factura Única
          </button>
          <button
            onClick={(e) => {
              e.preventDefault();
              setTipoCuenta("cuotas");
            }}
            style={{
              flex: 1,
              padding: "8px",
              borderRadius: "5px",
              border: "none",
              backgroundColor: tipoCuenta === "cuotas" ? "#dc3545" : "#2a2a2a",
              color: "white",
              fontSize: "12px",
            }}
          >
            🗓️ Cuotas Ext.
          </button>
          <button
            onClick={(e) => {
              e.preventDefault();
              setTipoCuenta("informal");
            }}
            style={{
              flex: 1,
              padding: "8px",
              borderRadius: "5px",
              border: "none",
              backgroundColor:
                tipoCuenta === "informal" ? "#8884d8" : "#2a2a2a",
              color: "white",
              fontSize: "12px",
            }}
          >
            🤝 Préstamo Pareja
          </button>
        </div>

        <form onSubmit={guardarCuenta}>
          <input
            type="text"
            placeholder={
              tipoCuenta === "informal"
                ? "Ej: Plata para el súper..."
                : "Descripción"
            }
            value={descCuenta}
            onChange={(e) => setDescCuenta(e.target.value)}
            required
          />
          <input
            type="number"
            placeholder={
              tipoCuenta === "informal"
                ? "Monto total prestado"
                : "Monto de la cuota/factura"
            }
            value={montoCuenta}
            onChange={(e) => setMontoCuenta(e.target.value)}
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
            Visualización: {formatearNumero(montoCuenta, monedaGlobal)}
          </div>

          {/* Si es externo (Factura/Cuota) */}
          {tipoCuenta !== "informal" && (
            <>
              <div style={{ display: "flex", gap: "10px" }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: "12px", color: "#888" }}>
                    Vencimiento (Día):
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
                {tipoCuenta === "cuotas" && (
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: "12px", color: "#888" }}>
                      Total cuotas:
                    </label>
                    <input
                      type="number"
                      min="2"
                      value={totalCuotas}
                      onChange={(e) => setTotalCuotas(e.target.value)}
                      required
                    />
                  </div>
                )}
              </div>
              <select
                value={responsableCuenta}
                onChange={(e) => setResponsableCuenta(e.target.value)}
              >
                <option value="Ambos">Deuda de: Ambos</option>
                {usuarios.map((u) => (
                  <option key={u.id} value={u.nombre}>
                    Deuda de: {u.nombre}
                  </option>
                ))}
              </select>
            </>
          )}

          {/* Si es Préstamo en Pareja */}
          {tipoCuenta === "informal" && (
            <select
              value={deudorId}
              onChange={(e) => setDeudorId(e.target.value)}
            >
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>
                  Quien recibe la plata: {u.nombre}
                </option>
              ))}
            </select>
          )}

          <button
            type="submit"
            className="btn-primary"
            style={{
              backgroundColor:
                tipoCuenta === "informal" ? "#8884d8" : "#dc3545",
            }}
          >
            {tipoCuenta === "informal"
              ? "Registrar Préstamo Interno"
              : "Registrar Deuda"}
          </button>
        </form>
      </div>

      {/* EXTRACTO: PRÉSTAMOS ENTRE LA PAREJA */}
      {prestamosInformales.length > 0 && (
        <div
          className="card"
          style={{ borderTop: "4px solid #8884d8", marginBottom: "20px" }}
        >
          <h3 style={{ margin: "0 0 15px 0" }}>🤝 Préstamos entre Nosotros</h3>
          <div style={{ borderTop: "1px solid #333", paddingTop: "10px" }}>
            {prestamosInformales
              .filter((p) => p.estado !== "Pagado")
              .map((p) => {
                const porcentaje = (
                  (p.monto_pagado / p.monto_total) *
                  100
                ).toFixed(0);
                return (
                  <div key={p.id} className="movimiento-item">
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <strong>{p.concepto}</strong>
                        <div style={{ fontSize: "12px", color: "#aaa" }}>
                          De: {getNombreUsuario(p.acreedor_id)} | Para:{" "}
                          {getNombreUsuario(p.deudor_id)}
                        </div>
                        <div
                          className="movimiento-monto"
                          style={{ color: "#8884d8" }}
                        >
                          Falta:{" "}
                          {formatearNumero(
                            p.monto_total - p.monto_pagado,
                            p.moneda,
                          )}
                        </div>

                        {/* Barra de progreso de pago */}
                        <div
                          style={{
                            width: "90%",
                            backgroundColor: "#1e1e1e",
                            borderRadius: "5px",
                            height: "6px",
                            marginTop: "5px",
                          }}
                        >
                          <div
                            style={{
                              width: `${porcentaje}%`,
                              backgroundColor: "#8884d8",
                              height: "100%",
                              borderRadius: "5px",
                            }}
                          ></div>
                        </div>
                        <div
                          style={{
                            fontSize: "11px",
                            color: "#888",
                            marginTop: "3px",
                          }}
                        >
                          Pagado {formatearNumero(p.monto_pagado, p.moneda)} de{" "}
                          {formatearNumero(p.monto_total, p.moneda)}
                        </div>
                      </div>

                      <button
                        onClick={() => abonarPrestamo(p)}
                        style={{
                          padding: "8px 15px",
                          backgroundColor: "#8884d8",
                          border: "none",
                          borderRadius: "8px",
                          color: "white",
                          fontWeight: "bold",
                          cursor: "pointer",
                        }}
                      >
                        Abonar
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* EXTRACTO: CUENTAS Y FACTURAS EXTERNAS */}
      <div className="card" style={{ borderTop: "4px solid #dc3545" }}>
        <h3 style={{ margin: "0 0 15px 0" }}>⚠️ Cuentas Externas</h3>
        <div style={{ borderTop: "1px solid #333", paddingTop: "10px" }}>
          {cuentas
            .filter((c) => c.estado !== "Pagado")
            .map((c) => {
              const pagadoMes = fuePagadoEsteMes(c.fecha_ultimo_pago);
              const soySolicitado = c.pago_solicitado_a === usuarioActual?.id;
              return (
                <div
                  key={c.id}
                  className="movimiento-item"
                  style={{
                    borderLeft: soySolicitado ? "4px solid #ffc107" : "none",
                    paddingLeft: soySolicitado ? "10px" : "0",
                    opacity: pagadoMes ? 0.6 : 1,
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
                      <strong>{c.descripcion}</strong>{" "}
                      <small style={{ color: "#888" }}>({c.responsable})</small>
                      <div
                        className="movimiento-monto"
                        style={{ color: pagadoMes ? "#28a745" : "#dc3545" }}
                      >
                        {formatearNumero(c.monto, c.moneda)}
                      </div>
                      {c.es_recurrente && (
                        <div style={{ fontSize: "12px", color: "#aaa" }}>
                          📊 Pagaste {c.cuotas_pagadas} de {c.total_cuotas}
                        </div>
                      )}
                      <div
                        style={{
                          fontSize: "12px",
                          marginTop: "4px",
                          fontWeight: "bold",
                        }}
                      >
                        {pagadoMes ? (
                          <span style={{ color: "#28a745" }}>
                            ✅ Mes pagado
                          </span>
                        ) : (
                          <span style={{ color: "#ffc107" }}>
                            🗓️ Vence el día {c.dia_vencimiento}
                          </span>
                        )}
                      </div>
                      {soySolicitado && !pagadoMes && (
                        <div
                          style={{
                            color: "#ffc107",
                            fontSize: "12px",
                            marginTop: "5px",
                          }}
                        >
                          ⚠️ Te pidieron ayuda con esto
                        </div>
                      )}
                    </div>

                    {!pagadoMes && (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "5px",
                        }}
                      >
                        <button
                          onClick={() => pagarCuenta(c)}
                          style={{
                            padding: "8px 15px",
                            backgroundColor: soySolicitado
                              ? "#ffc107"
                              : "#28a745",
                            border: "none",
                            borderRadius: "8px",
                            color: soySolicitado ? "#000" : "white",
                            fontWeight: "bold",
                            cursor: "pointer",
                          }}
                        >
                          {soySolicitado ? "Aceptar y Pagar" : "Pagar"}
                        </button>
                        {!soySolicitado && !c.pago_solicitado_a && (
                          <button
                            onClick={() => pedirAyuda(c.id)}
                            style={{
                              padding: "5px",
                              backgroundColor: "transparent",
                              border: "1px solid #888",
                              borderRadius: "8px",
                              color: "#aaa",
                              fontSize: "10px",
                              cursor: "pointer",
                            }}
                          >
                            Pedir ayuda
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </>
  );
}
