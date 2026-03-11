// src/components/Historial.jsx
import { useState } from "react";
import { supabase } from "../supabase";
import { toast } from "react-hot-toast";
import * as XLSX from "xlsx";
import { formatearNumero, formatearFecha } from "../utils/formatters";

export default function Historial({
  gastos,
  ingresos,
  usuarios,
  obtenerDatos,
  getNombreUsuario,
}) {
  // ESTADOS PARA FILTROS Y PAGINACIÓN
  const [filtroUsuario, setFiltroUsuario] = useState("todos");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [paginaActual, setPaginaActual] = useState(1);
  const itemsPorPagina = 10;

  // 1. UNIFICAR Y ORDENAR DATOS (Gastos + Ingresos)
  const todosLosMovimientos = [
    ...gastos.map((g) => ({
      ...g,
      tipo: "gasto",
      fechaRef: g.fecha,
      usuarioRef: g.pagador_id,
    })),
    // Nota: Asumimos que ingresos tiene created_at (por defecto en Supabase). Si no, usamos mes/año.
    ...ingresos.map((i) => {
      // Forzamos la creación de una fecha válida para los ingresos si no la traen de BD
      let fechaValida = new Date().toISOString();
      if (i.created_at) {
        fechaValida = i.created_at;
      } else if (i.anio && i.mes) {
        fechaValida = new Date(i.anio, i.mes - 1, 5).toISOString();
      }
      return {
        ...i,
        tipo: "ingreso",
        fechaRef: fechaValida,
        usuarioRef: i.usuario_id,
      };
    }),
  ].sort((a, b) => new Date(b.fechaRef) - new Date(a.fechaRef));
  // 2. APLICAR FILTROS
  const movimientosFiltrados = todosLosMovimientos.filter((m) => {
    // Filtro por usuario
    const coincideUsuario =
      filtroUsuario === "todos" || m.usuarioRef === filtroUsuario;

    // Filtro por fechas
    const fechaMovimiento = new Date(m.fechaRef);
    const coincideInicio =
      fechaInicio === "" || fechaMovimiento >= new Date(fechaInicio);

    let coincideFin = true;
    if (fechaFin !== "") {
      let fin = new Date(fechaFin);
      fin.setHours(23, 59, 59, 999); // Incluir todo el día hasta las 23:59
      coincideFin = fechaMovimiento <= fin;
    }

    return coincideUsuario && coincideInicio && coincideFin;
  });

  // 3. APLICAR PAGINACIÓN
  const totalPaginas = Math.ceil(movimientosFiltrados.length / itemsPorPagina);
  const indexInicio = (paginaActual - 1) * itemsPorPagina;
  const movimientosPaginados = movimientosFiltrados.slice(
    indexInicio,
    indexInicio + itemsPorPagina,
  );

  // Funciones de Base de Datos Dinámicas (Gastos o Ingresos)
  async function eliminarMovimiento(id, tipo) {
    if (
      window.confirm(
        "¿Seguro que querés borrar este registro? Afectará a las billeteras.",
      )
    ) {
      const tabla = tipo === "gasto" ? "gastos" : "ingresos_mensuales";
      const { error } = await supabase.from(tabla).delete().eq("id", id);

      if (error) toast.error("Error al eliminar: " + error.message);
      else {
        toast.success("🗑️ Registro eliminado");
        obtenerDatos();
      }
    }
  }

  async function editarMontoMovimiento(movimiento) {
    const nuevoMontoStr = prompt(
      `Editar monto de "${movimiento.concepto}"\nMonto actual: ${movimiento.monto}`,
      movimiento.monto,
    );

    if (
      nuevoMontoStr !== null &&
      nuevoMontoStr.trim() !== "" &&
      !isNaN(nuevoMontoStr)
    ) {
      const nuevoMonto = parseFloat(nuevoMontoStr);
      const tabla =
        movimiento.tipo === "gasto" ? "gastos" : "ingresos_mensuales";

      const { error } = await supabase
        .from(tabla)
        .update({ monto: nuevoMonto })
        .eq("id", movimiento.id);

      if (error) toast.error("Error al editar: " + error.message);
      else {
        toast.success("✏️ Monto actualizado");
        obtenerDatos();
      }
    }
  }

  function exportarExcel() {
    const datos = movimientosFiltrados.map((m) => ({
      Tipo: m.tipo === "ingreso" ? "INGRESO" : "GASTO",
      Fecha: formatearFecha(m.fechaRef),
      Concepto: m.concepto,
      Monto: m.monto,
      Moneda: m.moneda,
      Usuario: getNombreUsuario(m.usuarioRef),
      Categoria: m.categoria || "N/A",
    }));
    const ws = XLSX.utils.json_to_sheet(datos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Libro Mayor");
    XLSX.writeFile(wb, "Historial_Filtrado_Canindevs.xlsx");
  }

  return (
    <div className="card">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "15px",
        }}
      >
        <h3 style={{ margin: 0 }}>Historial Completo 📋</h3>
        <button
          onClick={exportarExcel}
          style={{
            backgroundColor: "#28a745",
            color: "white",
            border: "none",
            padding: "8px 15px",
            borderRadius: "8px",
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          📄 Excel
        </button>
      </div>

      {/* PANEL DE FILTROS */}
      <div
        style={{
          backgroundColor: "#2a2a2a",
          padding: "15px",
          borderRadius: "8px",
          marginBottom: "20px",
          display: "flex",
          flexWrap: "wrap",
          gap: "10px",
        }}
      >
        <div style={{ flex: 1, minWidth: "120px" }}>
          <label style={{ fontSize: "12px", color: "#aaa" }}>Usuario</label>
          <select
            value={filtroUsuario}
            onChange={(e) => {
              setFiltroUsuario(e.target.value);
              setPaginaActual(1);
            }}
            style={{ margin: 0, padding: "8px" }}
          >
            <option value="todos">Todos</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre}
              </option>
            ))}
          </select>
        </div>
        <div style={{ flex: 1, minWidth: "120px" }}>
          <label style={{ fontSize: "12px", color: "#aaa" }}>Desde</label>
          <input
            type="date"
            value={fechaInicio}
            onChange={(e) => {
              setFechaInicio(e.target.value);
              setPaginaActual(1);
            }}
            style={{ margin: 0, padding: "8px" }}
          />
        </div>
        <div style={{ flex: 1, minWidth: "120px" }}>
          <label style={{ fontSize: "12px", color: "#aaa" }}>Hasta</label>
          <input
            type="date"
            value={fechaFin}
            onChange={(e) => {
              setFechaFin(e.target.value);
              setPaginaActual(1);
            }}
            style={{ margin: 0, padding: "8px" }}
          />
        </div>
      </div>

      {/* LISTA DE MOVIMIENTOS */}
      <div style={{ textAlign: "left" }}>
        {movimientosPaginados.length === 0 ? (
          <p style={{ textAlign: "center", color: "#888" }}>
            No hay movimientos para estos filtros.
          </p>
        ) : (
          movimientosPaginados.map((m) => {
            const esIngreso = m.tipo === "ingreso";
            return (
              <div
                key={`${m.tipo}-${m.id}`}
                className="movimiento-item"
                style={{
                  borderLeft: esIngreso
                    ? "4px solid #28a745"
                    : "4px solid #dc3545",
                  paddingLeft: "10px",
                }}
              >
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <strong>
                    <span style={{ marginRight: "5px" }}>
                      {esIngreso ? "⬆️" : "⬇️"}
                    </span>
                    {m.concepto}
                  </strong>
                  <small style={{ color: "#888" }}>
                    {formatearFecha(m.fechaRef)}
                  </small>
                </div>

                <div
                  className="movimiento-monto"
                  style={{ color: esIngreso ? "#4ade80" : "white" }}
                >
                  {esIngreso ? "+" : "-"} {formatearNumero(m.monto, m.moneda)}
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: "5px",
                  }}
                >
                  <div className="movimiento-detalle">
                    {esIngreso ? "Ingresó a: " : "Pagó: "}{" "}
                    <strong style={{ color: "#aaa" }}>
                      {getNombreUsuario(m.usuarioRef)}
                    </strong>
                  </div>

                  <div style={{ display: "flex", gap: "15px" }}>
                    <button
                      onClick={() => editarMontoMovimiento(m)}
                      style={{
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        fontSize: "16px",
                        padding: 0,
                      }}
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => eliminarMovimiento(m.id, m.tipo)}
                      style={{
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        fontSize: "16px",
                        padding: 0,
                      }}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* CONTROLES DE PAGINACIÓN */}
      {totalPaginas > 1 && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: "20px",
            backgroundColor: "#1e1e1e",
            padding: "10px",
            borderRadius: "8px",
          }}
        >
          <button
            disabled={paginaActual === 1}
            onClick={() => setPaginaActual((p) => p - 1)}
            style={{
              padding: "8px 15px",
              borderRadius: "5px",
              border: "none",
              backgroundColor: paginaActual === 1 ? "#333" : "#646cff",
              color: paginaActual === 1 ? "#666" : "white",
              cursor: paginaActual === 1 ? "not-allowed" : "pointer",
            }}
          >
            ⬅️ Anterior
          </button>

          <span style={{ fontSize: "14px", color: "#aaa" }}>
            Página {paginaActual} de {totalPaginas}
          </span>

          <button
            disabled={paginaActual === totalPaginas}
            onClick={() => setPaginaActual((p) => p + 1)}
            style={{
              padding: "8px 15px",
              borderRadius: "5px",
              border: "none",
              backgroundColor:
                paginaActual === totalPaginas ? "#333" : "#646cff",
              color: paginaActual === totalPaginas ? "#666" : "white",
              cursor: paginaActual === totalPaginas ? "not-allowed" : "pointer",
            }}
          >
            Siguiente ➡️
          </button>
        </div>
      )}
    </div>
  );
}
