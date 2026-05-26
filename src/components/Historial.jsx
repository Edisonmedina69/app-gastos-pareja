// src/components/Historial.jsx
import { useState } from "react";
import { supabase } from "../supabase";
import { toast } from "react-hot-toast";
import * as XLSX from "xlsx";
import { formatearNumero, formatearFecha } from "../utils/formatters";
import { motion, AnimatePresence } from "framer-motion";
import { 
  History, 
  Download, 
  Filter, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  Trash2, 
  Edit3, 
  ChevronLeft, 
  ChevronRight,
  Search,
  Calendar,
  User as UserIcon,
  X
} from "lucide-react";

export default function Historial({
  gastos,
  ingresos,
  usuarios,
  obtenerDatos,
  getNombreUsuario,
}) {
  const [filtroUsuario, setFiltroUsuario] = useState("todos");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [paginaActual, setPaginaActual] = useState(1);
  const itemsPorPagina = 10;

  // 1. UNIFICAR Y ORDENAR DATOS
  const todosLosMovimientos = [
    ...gastos.map((g) => ({
      ...g,
      tipo: "gasto",
      fechaRef: g.fecha,
      usuarioRef: g.pagador_id,
    })),
    ...ingresos.map((i) => {
      let fechaValida = i.created_at || new Date().toISOString();
      if (i.anio && i.mes && !i.created_at) {
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
    const coincideUsuario = filtroUsuario === "todos" || m.usuarioRef === filtroUsuario;
    const fechaMovimiento = new Date(m.fechaRef);
    const coincideInicio = fechaInicio === "" || fechaMovimiento >= new Date(fechaInicio);
    let coincideFin = true;
    if (fechaFin !== "") {
      let fin = new Date(fechaFin);
      fin.setHours(23, 59, 59, 999);
      coincideFin = fechaMovimiento <= fin;
    }
    return coincideUsuario && coincideInicio && coincideFin;
  });

  // 3. APLICAR PAGINACIÓN
  const totalPaginas = Math.ceil(movimientosFiltrados.length / itemsPorPagina);
  const indexInicio = (paginaActual - 1) * itemsPorPagina;
  const movimientosPaginados = movimientosFiltrados.slice(indexInicio, indexInicio + itemsPorPagina);

  async function eliminarMovimiento(id, tipo) {
    if (window.confirm("¿Seguro que querés borrar este registro?")) {
      const tabla = tipo === "gasto" ? "gastos" : "ingresos_mensuales";
      const { error } = await supabase.from(tabla).delete().eq("id", id);
      if (error) toast.error("Error al eliminar: " + error.message);
      else {
        toast.success("Registro eliminado");
        obtenerDatos();
      }
    }
  }

  async function editarMontoMovimiento(movimiento) {
    const nuevoMontoStr = prompt(`Editar monto de "${movimiento.concepto}"`, movimiento.monto);
    if (nuevoMontoStr !== null && nuevoMontoStr.trim() !== "" && !isNaN(nuevoMontoStr)) {
      const nuevoMonto = parseFloat(nuevoMontoStr);
      const tabla = movimiento.tipo === "gasto" ? "gastos" : "ingresos_mensuales";
      const { error } = await supabase.from(tabla).update({ monto: nuevoMonto }).eq("id", movimiento.id);
      if (error) toast.error("Error al editar: " + error.message);
      else {
        toast.success("Monto actualizado");
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
    XLSX.writeFile(wb, "Historial_ÑandeFinanza.xlsx");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <History className="w-5 h-5 text-indigo-400" /> Libro Mayor
        </h2>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={exportarExcel}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-lg shadow-emerald-600/20 transition-all"
        >
          <Download size={14} /> EXPORTAR
        </motion.button>
      </div>

      {/* PANEL DE FILTROS */}
      <div className="glass-card grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-1">
            <UserIcon size={10} /> Usuario
          </label>
          <select
            value={filtroUsuario}
            onChange={(e) => { setFiltroUsuario(e.target.value); setPaginaActual(1); }}
            className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-3 py-2 text-white text-xs outline-none focus:border-indigo-500/50"
          >
            <option value="todos">Todos los usuarios</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>{u.nombre}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-1">
            <Calendar size={10} /> Desde
          </label>
          <input
            type="date"
            value={fechaInicio}
            onChange={(e) => { setFechaInicio(e.target.value); setPaginaActual(1); }}
            className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-3 py-2 text-white text-xs outline-none focus:border-indigo-500/50"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-1">
            <Calendar size={10} /> Hasta
          </label>
          <input
            type="date"
            value={fechaFin}
            onChange={(e) => { setFechaFin(e.target.value); setPaginaActual(1); }}
            className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-3 py-2 text-white text-xs outline-none focus:border-indigo-500/50"
          />
        </div>
      </div>

      {/* LISTA DE MOVIMIENTOS */}
      <div className="space-y-3">
        {movimientosPaginados.length === 0 ? (
          <div className="glass-card py-12 text-center">
            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center text-slate-600 mx-auto mb-4">
              <Search size={32} />
            </div>
            <p className="text-slate-500 text-sm">No se encontraron movimientos con los filtros seleccionados.</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {movimientosPaginados.map((m) => {
              const esIngreso = m.tipo === "ingreso";
              return (
                <motion.div
                  layout
                  key={`${m.tipo}-${m.id}`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={`glass-card p-4 border-l-4 transition-all hover:bg-white/10 ${esIngreso ? 'border-l-emerald-500' : 'border-l-red-500'}`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex gap-4">
                      <div className={`p-2 rounded-xl h-fit ${esIngreso ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                        {esIngreso ? <ArrowUpCircle size={20} /> : <ArrowDownCircle size={20} />}
                      </div>
                      <div>
                        <div className="font-bold text-white text-sm leading-none mb-1">{m.concepto}</div>
                        <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                          {getNombreUsuario(m.usuarioRef)} • {formatearFecha(m.fechaRef)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-black text-sm tracking-tight ${esIngreso ? 'text-emerald-400' : 'text-white'}`}>
                        {esIngreso ? '+' : '-'} {formatearNumero(m.monto, m.moneda)}
                      </div>
                      <div className="flex gap-2 mt-2 justify-end">
                        {(m.usuarioRef === datosHogar?.id || datosHogar?.rol === 'superadmin' || datosHogar?.rol === 'jefe' || datosHogar?.rol === 'admin_hogar') && (
                          <>
                            <button onClick={() => editarMontoMovimiento(m)} className="p-1.5 text-slate-500 hover:text-indigo-400 hover:bg-indigo-400/10 rounded-lg transition-colors">
                              <Edit3 size={14} />
                            </button>
                            <button onClick={() => eliminarMovimiento(m.id, m.tipo)} className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors">
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      {/* PAGINACIÓN */}
      {totalPaginas > 1 && (
        <div className="flex items-center justify-between glass-card py-3 px-6">
          <button
            disabled={paginaActual === 1}
            onClick={() => setPaginaActual(p => p - 1)}
            className="p-2 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          
          <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">
            Página <span className="text-white">{paginaActual}</span> de <span className="text-white">{totalPaginas}</span>
          </div>

          <button
            disabled={paginaActual === totalPaginas}
            onClick={() => setPaginaActual(p => p + 1)}
            className="p-2 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      )}
    </div>
  );
}
