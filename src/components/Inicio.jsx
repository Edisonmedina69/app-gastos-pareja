import { useState, useEffect } from "react";
import { supabase } from "../supabase";
import { toast } from "react-hot-toast";
import { formatearNumero } from "../utils/formatters";
import { obtenerCotizacion } from "../utils/exchangeApi";
import { motion } from "framer-motion";
import { 
  Plus, 
  Wallet, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle2, 
  Scale, 
  PieChart as PieIcon, 
  Users,
  ArrowUpRight,
  Sparkles
} from "lucide-react";
import IngresoMagico from "./IngresoMagico";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export default function Inicio({
  usuarioActual,
  otroUsuario,
  usuarios,
  gastos,
  ingresos,
  deudas,
  monedaGlobal,
  setMonedaGlobal,
  obtenerDatos,
  datosHogar,
  modoVista
}) {
  const [concepto, setConcepto] = useState("");
  const [monto, setMonto] = useState("");
  const [categoria, setCategoria] = useState("Casa");
  const [paraQuien, setParaQuien] = useState("Ambos");
  const [porcentajePagador, setPorcentajePagador] = useState(50);
  const [tasaCambio, setTasaCambio] = useState(1);
  const [monedaGasto, setMonedaGasto] = useState(monedaGlobal);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [mostrarMagico, setMostrarMagico] = useState(false);

  // --- EFECTO TASAS DINÁMICAS ---
  useEffect(() => {
    if (mostrarModal && monedaGasto !== monedaGlobal) {
      setMonedaGasto(monedaGlobal);
    }
  }, [mostrarModal, monedaGlobal, monedaGasto]);

  useEffect(() => {
    if (mostrarModal && monedaGasto !== "PYG") {
      async function cargarTasa() {
        const rate = await obtenerCotizacion(monedaGasto, "PYG");
        setTasaCambio(rate);
      }
      cargarTasa();
    } else if (tasaCambio !== 1) {
      setTasaCambio(1);
    }
  }, [mostrarModal, monedaGasto, tasaCambio]);

  // --- FILTRADO POR CONTEXTO (HU-18) ---
  const gastosFiltrados = modoVista === "familiar" 
    ? (gastos || [])
    : (gastos || []).filter(g => g.usuario_id === usuarioActual?.id || g.pagador_id === usuarioActual?.id);
    
  const ingresosFiltrados = modoVista === "familiar"
    ? (ingresos || [])
    : (ingresos || []).filter(i => i.usuario_id === usuarioActual?.id);

  // --- LÓGICA DE GUARDADO ---
  async function guardarGasto(e) {
    e.preventDefault();
    if (!usuarioActual || !datosHogar) return;

    const toastId = toast.loading("Guardando gasto...");

    const { error } = await supabase.from("gastos").insert([
      {
        concepto,
        monto: parseFloat(monto),
        categoria,
        usuario_id: usuarioActual.id,
        pagador_id: usuarioActual.id,
        para_quien: paraQuien,
        moneda: monedaGasto,
        tasa_cambio: parseFloat(tasaCambio),
        porcentaje_pagador: paraQuien === "Ambos" ? porcentajePagador : 100,
        espacio_id: datosHogar.espacio_id
      },
    ]);

    if (error) {
      toast.error("Error: " + error.message, { id: toastId });
    } else {
      setConcepto("");
      setMonto("");
      setPorcentajePagador(50);
      setMostrarModal(false);
      toast.success("¡Gasto guardado con éxito! 🛒", { id: toastId });
      obtenerDatos();
    }
  }

  async function confirmarGastoMagico(datos) {
    if (!usuarioActual || !datosHogar) return;
    const toastId = toast.loading("Confirmando gasto inteligente...");

    const { error } = await supabase.from("gastos").insert([
      {
        ...datos,
        usuario_id: usuarioActual.id,
        pagador_id: usuarioActual.id,
        para_quien: "Ambos",
        porcentaje_pagador: 50,
        espacio_id: datosHogar.espacio_id,
        tasa_cambio: 1 
      },
    ]);

    if (error) {
      toast.error("Error al guardar: " + error.message, { id: toastId });
    } else {
      toast.success("¡Gasto mágico guardado! ✨", { id: toastId });
      obtenerDatos();
    }
  }

  // --- MATEMÁTICA ---
  let saldoTotalPYG = 0;
  let totalGastadoYoGlobal = 0;
  let totalGastadoOtroGlobal = 0;
  const gastosPorCategoriaGlobal = {};

  const tasaVisualParaGlobal = monedaGlobal === "PYG" ? 1 : (monedaGlobal === "BRL" ? 1/1450 : 1);

  // Procesar Ingresos Filtrados
  ingresosFiltrados.forEach((i) => {
    const montoPYG = i.monto * (i.tasa_cambio || 1);
    saldoTotalPYG += montoPYG;
  });

  // Procesar Gastos Filtrados
  gastosFiltrados.forEach((g) => {
    const montoGasto = Number(g.monto);
    const montoPYG = montoGasto * (g.tasa_cambio || 1);
    const montoGlobal = g.moneda === monedaGlobal ? montoGasto : (montoPYG * tasaVisualParaGlobal);
    
    saldoTotalPYG -= montoPYG;

    if (g.pagador_id === usuarioActual?.id) {
      totalGastadoYoGlobal += montoGlobal;
    } else {
      totalGastadoOtroGlobal += montoGlobal;
    }

    if (gastosPorCategoriaGlobal[g.categoria]) {
      gastosPorCategoriaGlobal[g.categoria] += montoGlobal;
    } else {
      gastosPorCategoriaGlobal[g.categoria] = montoGlobal;
    }
  });

  // Ajuste de Cuentas (Solo en modo familiar y con datos completos)
  let balanceDeudasPYG = 0;
  if (modoVista === "familiar" && usuarioActual && otroUsuario) {
    (gastos || []).forEach(g => {
      const montoPYG = Number(g.monto) * (g.tasa_cambio || 1);
      if (g.para_quien === "Ambos") {
        const porcPagador = Number(g.porcentaje_pagador || 50);
        const porcOtro = 100 - porcPagador;
        if (g.pagador_id === usuarioActual.id) balanceDeudasPYG += montoPYG * (porcOtro / 100);
        else if (g.pagador_id === otroUsuario.id) balanceDeudasPYG -= montoPYG * (porcOtro / 100);
      }
    });
  }

  // MODO SUPERVIVENCIA
  let totalCuentasPendientesPYG = 0;
  if (deudas) {
    deudas.forEach((d) => {
      if (d.cuotas_detalle) {
        d.cuotas_detalle.forEach(c => {
          if (c.estado === 'pendiente') {
            totalCuentasPendientesPYG += Number(c.monto_cuota - c.monto_abonado); // Simplificado
          }
        });
      }
    });
  }

  const saldoFinalGlobal = saldoTotalPYG * tasaVisualParaGlobal;
  const balanceDeudasGlobal = balanceDeudasPYG * tasaVisualParaGlobal;
  const totalCuentasPendientesGlobal = totalCuentasPendientesPYG * tasaVisualParaGlobal;
  const faltanteGlobal = totalCuentasPendientesGlobal - saldoFinalGlobal;
  const necesitaPlata = faltanteGlobal > 0;

  const datosGraficoCategorias = Object.keys(gastosPorCategoriaGlobal).map((key) => ({
    name: key,
    value: gastosPorCategoriaGlobal[key],
  }));

  const COLORES = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

  return (
    <div className="space-y-6">
      {/* Selector de Moneda */}
      <div className="flex justify-center">
        <div className="inline-flex p-1 bg-white/5 backdrop-blur-md border border-white/10 rounded-full">
          {[{ id: "PYG", flag: "🇵🇾" }, { id: "BRL", flag: "🇧🇷" }].map((m) => (
            <button
              key={m.id}
              onClick={() => setMonedaGlobal(m.id)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-2 ${monedaGlobal === m.id ? "bg-indigo-600 text-white" : "text-slate-400"}`}
            >
              <span>{m.flag}</span> {m.id === "PYG" ? "Gs." : "R$"}
            </button>
          ))}
        </div>
      </div>

      {/* DASHBOARD PRINCIPAL */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2 glass-card overflow-hidden relative group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Wallet className="w-24 h-24 text-indigo-400" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 text-slate-400 mb-1">
              <Users className="w-4 h-4" />
              <span className="text-xs font-medium uppercase tracking-wider">
                {modoVista === 'familiar' ? 'Saldo del Hogar 🏠' : 'Mi Saldo Disponible 👤'}
              </span>
            </div>
            <div className={`text-4xl font-bold tracking-tight mb-2 ${saldoFinalGlobal < 0 ? "text-red-400" : "text-emerald-400"}`}>
              {formatearNumero(saldoFinalGlobal, monedaGlobal)}
            </div>
            <p className="text-xs text-slate-500">
              {modoVista === 'familiar' ? 'Balance total del espacio compartido' : 'Balance individual de mis registros'}
            </p>
          </div>
        </div>

        {modoVista === 'familiar' && (
          <>
            <div className="glass-card border-l-4 border-l-indigo-500">
              <div className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">Yo ({usuarioActual?.nombre})</div>
              <div className="text-xl font-bold text-white">{formatearNumero(totalGastadoYoGlobal, monedaGlobal)} gastado</div>
            </div>
            <div className="glass-card border-l-4 border-l-emerald-500">
              <div className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">Pareja ({otroUsuario?.nombre || '?'})</div>
              <div className="text-xl font-bold text-white">{formatearNumero(totalGastadoOtroGlobal, monedaGlobal)} gastado</div>
            </div>
          </>
        )}
      </div>

      <div className="flex gap-3">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setMostrarModal(true)}
          className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl shadow-xl flex items-center justify-center gap-3 transition-colors"
        >
          <Plus className="w-5 h-5" /> Gasto Manual
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setMostrarMagico(true)}
          className="px-6 py-4 bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 font-bold rounded-2xl shadow-xl flex items-center justify-center gap-3 transition-colors hover:bg-indigo-500/20"
        >
          <Sparkles className="w-5 h-5" /> IA
        </motion.button>
      </div>

      {/* COMPONENTE MAGICO */}
      <IngresoMagico 
        isOpen={mostrarMagico} 
        onClose={() => setMostrarMagico(false)}
        onConfirm={confirmarGastoMagico}
        monedaGlobal={monedaGlobal}
      />

      {/* SECCIÓN ALERTAS (Solo Familiar) */}
      {modoVista === 'familiar' && (
        <div className={`glass-card border-l-4 ${necesitaPlata ? "border-l-red-500 bg-red-500/5" : "border-l-emerald-500 bg-emerald-500/5"}`}>
          <div className="flex items-start gap-4">
            <div className={`p-2 rounded-xl ${necesitaPlata ? "bg-red-500/20 text-red-400" : "bg-emerald-500/20 text-emerald-400"}`}>
              {necesitaPlata ? <AlertCircle className="w-6 h-6" /> : <CheckCircle2 className="w-6 h-6" />}
            </div>
            <div className="flex-1">
            <h3 className={`text-lg font-bold ${necesitaPlata ? "text-red-400" : "text-emerald-400"}`}>
              {necesitaPlata ? "🚨 Hendy kavaju resa! (Faltan fondos)" : "✅ Cuentas aseguradas"}
            </h3>
            <div className={`mt-4 p-3 rounded-xl text-center font-bold text-sm ${necesitaPlata ? "bg-red-500 text-white" : "bg-emerald-500 text-white"}`}>
              {necesitaPlata 
                ? `Falta conseguir: ${formatearNumero(faltanteGlobal, monedaGlobal)}` 
                : `🤑 Ñande plata heta! Nos sobra: ${formatearNumero(Math.abs(faltanteGlobal), monedaGlobal)} 🧉`}
            </div>
            </div>
          </div>
        </div>
      )}

      {/* AJUSTE DE CUENTAS (Solo Familiar) */}
      {modoVista === 'familiar' && (
        <div className="glass-card overflow-hidden relative">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Scale className="w-4 h-4 text-indigo-400" /> Ajuste de Cuentas
          </h3>
          <div className="flex items-center justify-between">
            <div className="text-lg font-medium text-white">
              {balanceDeudasPYG === 0 
                ? "¡Están al día, che kape! 🧉" 
                : balanceDeudasPYG > 0 
                  ? `${otroUsuario?.nombre} te debe` 
                  : `Le debés a ${otroUsuario?.nombre}`}
            </div>
            {balanceDeudasPYG !== 0 && (
              <div className={`text-2xl font-black ${balanceDeudasPYG > 0 ? "text-indigo-400" : "text-amber-400"}`}>
                {formatearNumero(Math.abs(balanceDeudasGlobal), monedaGlobal)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* GRÁFICOS */}
      {datosGraficoCategorias.length > 0 && (
        <div className="glass-card">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
            <PieIcon className="w-4 h-4 text-indigo-400" /> Distribución de Gastos ({modoVista})
          </h3>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={datosGraficoCategorias} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {datosGraficoCategorias.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORES[index % COLORES.length]} stroke="none" />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatearNumero(value, monedaGlobal)} contentStyle={{ backgroundColor: "#1e293b", borderRadius: "12px", border: "none", color: "#fff" }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: "10px" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* MODAL REGISTRO GASTO */}
      {mostrarModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-lg glass-panel p-6 rounded-3xl relative">
            <button onClick={() => setMostrarModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors">
              <Plus className="w-6 h-6 rotate-45" />
            </button>
            <h2 className="text-xl font-bold text-white mb-6">Registrar Gasto</h2>
            <form onSubmit={guardarGasto} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Concepto</label>
                <input type="text" placeholder="Ej: Supermercado..." value={concepto} onChange={(e) => setConcepto(e.target.value)} className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500/50" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Moneda</label>
                  <select value={monedaGasto} onChange={(e) => setMonedaGasto(e.target.value)} className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500/50">
                    <option value="PYG">PYG (Gs)</option>
                    <option value="BRL">BRL (R$)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Monto</label>
                  <input type="number" placeholder="0.00" value={monto} onChange={(e) => setMonto(e.target.value)} className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500/50" required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Categoría</label>
                  <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500/50">
                    <option value="Casa">🏡 Casa</option>
                    <option value="Supermercado">🛒 Supermercado</option>
                    <option value="Combustible">⛽ Combustible</option>
                    <option value="Salidas">🍕 Salidas</option>
                    <option value="Salud">💊 Salud</option>
                    <option value="Ahorro">🐷 Ahorro</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Para quién</label>
                  <select value={paraQuien} onChange={(e) => setParaQuien(e.target.value)} className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500/50">
                    <option value="Ambos">Para: Ambos</option>
                    {usuarios.map(u => <option key={u.id} value={u.nombre}>Para: {u.nombre}</option>)}
                  </select>
                </div>
              </div>

              {paraQuien === "Ambos" && (
                <div className="p-4 bg-slate-900/50 border border-white/5 rounded-2xl">
                  <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">
                    <span>Yo: {porcentajePagador}%</span>
                    <span>Pareja: {100 - porcentajePagador}%</span>
                  </div>
                  <input type="range" min="0" max="100" step="5" value={porcentajePagador} onChange={(e) => setPorcentajePagador(parseInt(e.target.value))} className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
                </div>
              )}
              <button type="submit" className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl shadow-xl transition-all">REGISTRAR GASTO</button>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
