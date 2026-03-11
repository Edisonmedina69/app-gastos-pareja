// src/components/Cuentas.jsx
import { useState, useEffect, useMemo } from "react";
import { supabase } from "../supabase";
import { toast } from "react-hot-toast";

export default function Cuentas({
  usuarioActual,
  otroUsuario,
  usuarios,
  cuentas,
  monedaGlobal,
  obtenerDatos,
}) {
  // Estados generales
  const [tipoCuenta, setTipoCuenta] = useState("unica"); // 'unica', 'cuotas', 'tarjeta', 'informal'
  const [descCuenta, setDescCuenta] = useState("");
  const [montoCuenta, setMontoCuenta] = useState("");
  const [diaVencimiento, setDiaVencimiento] = useState("5");
  const [totalCuotas, setTotalCuotas] = useState("");
  const [responsableCuenta, setResponsableCuenta] = useState("Ambos");

  // Estados ESPECÍFICOS para Tarjetas de Crédito
  const [bancoTarjeta, setBancoTarjeta] = useState("");
  const [numeroTarjeta, setNumeroTarjeta] = useState(""); // Solo últimos 4 dígitos
  const [limiteCredito, setLimiteCredito] = useState("");
  const [montoTotalTarjeta, setMontoTotalTarjeta] = useState("");

  // Estados para Préstamos
  const [deudorId, setDeudorId] = useState("");
  const [prestamosInformales, setPrestamosInformales] = useState([]);
  const [mostrarModal, setMostrarModal] = useState(false);

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

  const usuariosMap = useMemo(() => {
    return usuarios.reduce((acc, user) => {
      acc[user.id] = user.nombre;
      return acc;
    }, {});
  }, [usuarios]);

  function getNombreUsuario(id) {
    return usuariosMap[id] ?? "Desconocido";
  }

  async function guardarCuenta(e) {
    e.preventDefault();
    const toastId = toast.loading("Registrando cuenta...");

    // 1. Lógica Préstamo en Pareja
    if (tipoCuenta === "informal") {
      if (!otroUsuario)
        return toast.error("Falta tu pareja en el sistema.", { id: toastId });
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

      if (error) toast.error("Error: " + error.message, { id: toastId });
      else {
        setDescCuenta("");
        setMontoCuenta("");
        setMostrarModal(false);
        toast.success("¡Préstamo registrado! 🤝", { id: toastId });
        cargarPrestamosInformales();
      }
      return;
    }

    // 2. Lógica para Facturas, Cuotas y Tarjetas
    let descFinal = descCuenta;
    let esCuota = tipoCuenta === "cuotas" || tipoCuenta === "tarjeta";
    let cuotasFinal = tipoCuenta === "cuotas" ? parseInt(totalCuotas) : 1;

    // MAGIA DE TARJETAS: Concatenamos todos los datos en la descripción
    if (tipoCuenta === "tarjeta") {
      descFinal = `💳 TC ${bancoTarjeta} (*${numeroTarjeta}) | LC: ${formatearNumero(limiteCredito, monedaGlobal)} | Deuda: ${formatearNumero(montoTotalTarjeta, monedaGlobal)}`;
      cuotasFinal = 120; // 120 meses (10 años) simulando que es permanente
    }

    const { error } = await supabase.from("cuentas_pendientes").insert([
      {
        descripcion: descFinal,
        monto: parseFloat(montoCuenta),
        es_recurrente: esCuota,
        dia_vencimiento: parseInt(diaVencimiento),
        total_cuotas: cuotasFinal,
        cuotas_pagadas: 0,
        estado: "Pendiente",
        responsable: responsableCuenta,
        moneda: monedaGlobal,
      },
    ]);

    if (error) toast.error("Error: " + error.message, { id: toastId });
    else {
      // Limpiamos todo
      setDescCuenta("");
      setMontoCuenta("");
      setTotalCuotas("");
      setBancoTarjeta("");
      setNumeroTarjeta("");
      setLimiteCredito("");
      setMontoTotalTarjeta("");
      setMostrarModal(false);
      toast.success("¡Deuda registrada con éxito! 📝", { id: toastId });
      obtenerDatos();
    }
  }

  async function pagarCuenta(cuenta) {
    if (!usuarioActual) return;
    const esUltima = cuenta.cuotas_pagadas + 1 >= cuenta.total_cuotas;
    let mensaje = cuenta.descripcion.includes("💳")
      ? "¿Confirmar el pago del resumen de esta Tarjeta?"
      : "¿Confirmar pago de esta cuota?";

    if (window.confirm(mensaje)) {
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

      await supabase
        .from("gastos")
        .insert([
          {
            concepto: `Pago: ${cuenta.descripcion.split("|")[0]}`,
            monto: cuenta.monto,
            categoria: "Préstamo",
            pagador_id: usuarioActual.id,
            para_quien: cuenta.responsable,
            moneda: cuenta.moneda,
          },
        ]);
      toast.success("¡Pago registrado! ✅");
      obtenerDatos();
    }
  }

  async function abonarPrestamo(prestamo) {
    const restante = prestamo.monto_total - prestamo.monto_pagado;
    const abonoStr = prompt(
      `¿Cuántos ${prestamo.moneda} querés abonar? (Te falta saldar: ${formatearNumero(restante, prestamo.moneda)})`,
    );
    if (!abonoStr || isNaN(abonoStr)) return;
    const abono = parseFloat(abonoStr);
    if (abono <= 0 || abono > restante) return toast.error("Monto inválido.");

    const nuevoPagado = Number(prestamo.monto_pagado) + abono;
    const estaSaldado = nuevoPagado >= prestamo.monto_total;
    await supabase
      .from("prestamos_personales")
      .update({
        monto_pagado: nuevoPagado,
        estado: estaSaldado ? "Pagado" : "Pendiente",
      })
      .eq("id", prestamo.id);
    await supabase
      .from("gastos")
      .insert([
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
    toast.success("¡Abono registrado! 💸");
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
      toast.success(`Ayuda solicitada 🤝`);
      obtenerDatos();
    }
  }

  return (
    <>
      <button
        onClick={() => setMostrarModal(true)}
        style={{
          width: "100%",
          padding: "15px",
          backgroundColor: "#dc3545",
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
        ➕ Registrar Nueva Deuda o Tarjeta
      </button>

      {/* EXTRACTO PRESTAMOS (Sin cambios) */}
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

      {/* EXTRACTO CUENTAS/TARJETAS */}
      <div className="card" style={{ borderTop: "4px solid #dc3545" }}>
        <h3 style={{ margin: "0 0 15px 0" }}>⚠️ Cuentas Externas y Tarjetas</h3>
        <div style={{ borderTop: "1px solid #333", paddingTop: "10px" }}>
          {cuentas
            .filter((c) => c.estado !== "Pagado")
            .map((c) => {
              const pagadoMes = fuePagadoEsteMes(c.fecha_ultimo_pago);
              const soySolicitado = c.pago_solicitado_a === usuarioActual?.id;
              const esTarjeta = c.descripcion.includes("💳");

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
                      <strong style={{ display: "block" }}>
                        {c.descripcion}
                      </strong>
                      <small style={{ color: "#888" }}>
                        Responsable: {c.responsable}
                      </small>
                      <div
                        className="movimiento-monto"
                        style={{
                          color: pagadoMes ? "#28a745" : "#dc3545",
                          marginTop: "5px",
                        }}
                      >
                        {esTarjeta ? "Pago Mínimo: " : ""}
                        {formatearNumero(c.monto, c.moneda)}
                      </div>
                      {c.es_recurrente && !esTarjeta && (
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
                          {soySolicitado ? "Aceptar Ayuda" : "Pagar"}
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

      {/* MODAL CADASTRO */}
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
              maxWidth: "450px",
              maxHeight: "90vh",
              overflowY: "auto",
              position: "relative",
              margin: 0,
              borderTop: "4px solid #dc3545",
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
            <h3 style={{ marginTop: 0 }}>📝 Registrar Deuda</h3>

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
                  backgroundColor:
                    tipoCuenta === "unica" ? "#dc3545" : "#2a2a2a",
                  color: "white",
                  fontSize: "11px",
                }}
              >
                🧾 Única
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
                  backgroundColor:
                    tipoCuenta === "cuotas" ? "#dc3545" : "#2a2a2a",
                  color: "white",
                  fontSize: "11px",
                }}
              >
                🗓️ Cuotas
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  setTipoCuenta("tarjeta");
                }}
                style={{
                  flex: 1,
                  padding: "8px",
                  borderRadius: "5px",
                  border: "none",
                  backgroundColor:
                    tipoCuenta === "tarjeta" ? "#FF8042" : "#2a2a2a",
                  color: "white",
                  fontSize: "11px",
                }}
              >
                💳 Tarjeta
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
                  fontSize: "11px",
                }}
              >
                🤝 Pareja
              </button>
            </div>

            <form onSubmit={guardarCuenta}>
              {/* CAMPOS DEPENDIENDO DEL TIPO */}
              {tipoCuenta === "tarjeta" ? (
                <>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <input
                      style={{ flex: 2 }}
                      type="text"
                      placeholder="Banco (Ej: Itaú)"
                      value={bancoTarjeta}
                      onChange={(e) => setBancoTarjeta(e.target.value)}
                      required
                    />
                    <input
                      style={{ flex: 1 }}
                      type="text"
                      maxLength="4"
                      placeholder="Últimos 4 N°"
                      value={numeroTarjeta}
                      onChange={(e) => setNumeroTarjeta(e.target.value)}
                      required
                    />
                  </div>
                  <input
                    type="number"
                    placeholder="Límite de Crédito (LC)"
                    value={limiteCredito}
                    onChange={(e) => setLimiteCredito(e.target.value)}
                    required
                  />
                  <input
                    type="number"
                    placeholder="Deuda Total Actual"
                    value={montoTotalTarjeta}
                    onChange={(e) => setMontoTotalTarjeta(e.target.value)}
                    required
                  />
                </>
              ) : (
                <input
                  type="text"
                  placeholder={
                    tipoCuenta === "informal"
                      ? "Ej: Plata para el súper..."
                      : "Descripción de la deuda"
                  }
                  value={descCuenta}
                  onChange={(e) => setDescCuenta(e.target.value)}
                  required
                />
              )}

              {/* MONTO PRINCIPAL A PAGAR */}
              <input
                type="number"
                placeholder={
                  tipoCuenta === "tarjeta"
                    ? "Pago Mínimo o Pago del Mes"
                    : "Monto a pagar"
                }
                value={montoCuenta}
                onChange={(e) => setMontoCuenta(e.target.value)}
                required
              />

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
                    <option value="Ambos">Responsable: Ambos</option>
                    {usuarios.map((u) => (
                      <option key={u.id} value={u.nombre}>
                        Responsable: {u.nombre}
                      </option>
                    ))}
                  </select>
                </>
              )}

              {tipoCuenta === "informal" && (
                <select
                  value={deudorId}
                  onChange={(e) => setDeudorId(e.target.value)}
                >
                  {usuarios.map((u) => (
                    <option key={u.id} value={u.id}>
                      Recibe la plata: {u.nombre}
                    </option>
                  ))}
                </select>
              )}

              <button
                type="submit"
                className="btn-primary"
                style={{
                  backgroundColor:
                    tipoCuenta === "informal"
                      ? "#8884d8"
                      : tipoCuenta === "tarjeta"
                        ? "#FF8042"
                        : "#dc3545",
                  width: "100%",
                  marginTop: "10px",
                  padding: "12px",
                }}
              >
                Guardar
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
