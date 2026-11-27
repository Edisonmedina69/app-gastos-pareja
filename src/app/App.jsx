import { useState, lazy, Suspense } from "react";
import { Toaster } from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";

import { useHogar } from "../features/hogar/hooks/useHogar";
import AccesoRestringido from "../features/hogar/components/AccesoRestringido";
import Login from "../features/auth/components/Login";
import Inicio from "../features/dashboard/components/Inicio";
import Cuentas from "../features/deudas/components/Cuentas";
import Ingresos from "../features/ingresos/components/Ingresos";
import HeaderMovil from "./layout/HeaderMovil";
import Sidebar from "./layout/Sidebar";
import Navegacion from "./layout/Navegacion";

// Vistas secundarias con carga diferida (code-splitting)
const Historial = lazy(() => import("../features/historial/components/Historial"));
const AsistenteGemini = lazy(() => import("../features/asistente/components/AsistenteGemini"));
const SuperadminPanel = lazy(() => import("../features/admin/components/SuperadminPanel"));

function App() {
  const [activeTab, setActiveTab] = useState("inicio");
  const [monedaGlobal, setMonedaGlobal] = useState("PYG");
  const modoVista = "familiar";

  const {
    session,
    cargando,
    datosHogar,
    usuarioActual,
    otroUsuario,
    usuarios,
    gastos,
    gastosProgramados,
    ingresos,
    deudas,
    notificaciones,
    saludFinanciera,
    esSuperadmin,
    obtenerDatos,
    markNotisAsRead,
    responderSolicitud,
    getNombreUsuario,
  } = useHogar();

  if (cargando) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">Iniciando ÑandeFinanza...</div>;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <Toaster position="top-center" reverseOrder={false} />

      {!session ? (
        <Login />
      ) : !datosHogar || !datosHogar.espacio_id ? (
        <AccesoRestringido />
      ) : (
        <div className="max-w-5xl mx-auto flex flex-col lg:flex-row min-h-screen">
          <HeaderMovil datosHogar={datosHogar} usuarioActual={usuarioActual} />

          <Sidebar datosHogar={datosHogar} usuarioActual={usuarioActual} activeTab={activeTab} setActiveTab={setActiveTab} esSuperadmin={esSuperadmin} />

          <main className="flex-1 p-3 sm:p-6 lg:p-8 overflow-y-auto pb-24 lg:pb-8">
            <div className="max-w-5xl xl:max-w-6xl mx-auto w-full">
              <Suspense fallback={<div className="p-8 text-center text-slate-400 animate-pulse">Cargando vista... ⚡</div>}>
                <AnimatePresence mode="wait">
                  <motion.div key={`${activeTab}-${modoVista}`} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }}>
                    {activeTab === "inicio" && <Inicio usuarioActual={usuarioActual} otroUsuario={otroUsuario} usuarios={usuarios} gastos={gastos} ingresos={ingresos} deudas={deudas} monedaGlobal={monedaGlobal} setMonedaGlobal={setMonedaGlobal} obtenerDatos={obtenerDatos} datosHogar={datosHogar} modoVista={modoVista} saludFinanciera={saludFinanciera} gastosProgramados={gastosProgramados} />}
                    {activeTab === "cuentas" && <Cuentas usuarioActual={usuarioActual} otroUsuario={otroUsuario} usuarios={usuarios} deudas={deudas} gastos={gastos} ingresos={ingresos} monedaGlobal={monedaGlobal} obtenerDatos={obtenerDatos} datosHogar={datosHogar} saludFinanciera={saludFinanciera} gastosProgramados={gastosProgramados} />}
                    {activeTab === "ingresos" && <Ingresos usuarioActual={usuarioActual} ingresos={ingresos} deudas={deudas} monedaGlobal={monedaGlobal} obtenerDatos={obtenerDatos} datosHogar={datosHogar} getNombreUsuario={getNombreUsuario} />}
                    {activeTab === "historial" && <Historial gastos={gastos} ingresos={ingresos} usuarios={usuarios} obtenerDatos={obtenerDatos} datosHogar={datosHogar} getNombreUsuario={getNombreUsuario} />}
                    {activeTab === "asistente" && <AsistenteGemini usuarioActual={usuarioActual} gastos={gastos} ingresos={ingresos} monedaGlobal={monedaGlobal} datosHogar={datosHogar} saludFinanciera={saludFinanciera} />}
                    {activeTab === "admin" && esSuperadmin && <SuperadminPanel datosHogar={datosHogar} />}
                  </motion.div>
                </AnimatePresence>
              </Suspense>
            </div>
          </main>

          <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 lg:hidden">
            <Navegacion activeTab={activeTab} setActiveTab={setActiveTab} esSuperadmin={esSuperadmin} notificaciones={notificaciones} markAsRead={markNotisAsRead} responderSolicitud={responderSolicitud} />
          </nav>
        </div>
      )}
    </div>
  );
}

export default App;
