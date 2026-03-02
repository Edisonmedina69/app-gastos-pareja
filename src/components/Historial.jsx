// src/components/Historial.jsx
import { supabase } from "../supabase";
import * as XLSX from "xlsx";

export default function Historial({
  gastos,
  obtenerDatos,
  getNombreUsuario,
  formatearFecha,
  formatearNumero,
}) {
  // 1. FUNCIÓN PARA ELIMINAR
  async function eliminarGasto(id) {
    if (
      window.confirm(
        "¿Estás seguro de que querés borrar este gasto? Esto va a recalcular los saldos de las billeteras.",
      )
    ) {
      const { error } = await supabase.from("gastos").delete().eq("id", id);
      if (error) alert("Error al eliminar: " + error.message);
      else {
        alert("🗑️ Gasto eliminado correctamente");
        obtenerDatos();
      }
    }
  }

  // 2. FUNCIÓN PARA EDITAR RÁPIDO EL MONTO
  async function editarMontoGasto(gasto) {
    const nuevoMontoStr = prompt(
      `Editar monto de "${gasto.concepto}"\nMonto actual: ${gasto.monto}`,
      gasto.monto,
    );

    if (
      nuevoMontoStr !== null &&
      nuevoMontoStr.trim() !== "" &&
      !isNaN(nuevoMontoStr)
    ) {
      const nuevoMonto = parseFloat(nuevoMontoStr);
      const { error } = await supabase
        .from("gastos")
        .update({ monto: nuevoMonto })
        .eq("id", gasto.id);

      if (error) alert("Error al editar: " + error.message);
      else obtenerDatos();
    }
  }

  // 3. EXPORTAR A EXCEL
  function exportarExcel() {
    const datos = gastos.map((g) => ({
      Fecha: formatearFecha(g.fecha),
      Concepto: g.concepto,
      Categoria: g.categoria,
      Monto: g.monto,
      Moneda: g.moneda,
      Pagó: getNombreUsuario(g.pagador_id),
      Para: g.para_quien,
    }));
    const ws = XLSX.utils.json_to_sheet(datos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Movimientos");
    XLSX.writeFile(wb, "Historial_Canindevs_Finanzas.xlsx");
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
        <h3 style={{ margin: 0 }}>Historial 📋</h3>
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
          📄 Exportar Excel
        </button>
      </div>

      <div style={{ textAlign: "left" }}>
        {gastos.map((g) => (
          <div key={g.id} className="movimiento-item">
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <strong>{g.concepto}</strong>
              <small style={{ color: "#888" }}>{formatearFecha(g.fecha)}</small>
            </div>
            <div className="movimiento-monto">
              {formatearNumero(g.monto, g.moneda)}
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
                Salió de billetera de: {getNombreUsuario(g.pagador_id)}
              </div>

              {/* LOS NUEVOS BOTONES DEL SALVAVIDAS */}
              <div style={{ display: "flex", gap: "15px" }}>
                <button
                  onClick={() => editarMontoGasto(g)}
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
                  onClick={() => eliminarGasto(g.id)}
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
        ))}
      </div>
    </div>
  );
}
