import { useState, lazy, Suspense } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { useHogar } from "../features/hogar/hooks/useHogar";
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

function HogarApp({ session: sesion, datosHogar: perfil }) {
  const location = useLocation();
  const navigate = useNavigate();
  const secciones = { inicio: '/', cuentas: '/deudas', ingresos: '/ingresos', historial: '/historial', asistente: '/asistente', admin: '/admin' };
  const raiz = location.pathname.split('/')[1];
  const activeTab = ({ deudas: 'cuentas', fijos: 'cuentas', previsiones: 'cuentas', ingresos: 'ingresos', historial: 'historial', asistente: 'asistente', admin: 'admin' })[raiz] || 'inicio';
  const setActiveTab = (tab) => navigate(secciones[tab]);
  const formularioAbierto = location.pathname.split('/').filter(Boolean).length > 1;
  const [monedaGlobal, setMonedaGlobal] = useState("PYG");
  const modoVista = "familiar";

  const {
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
  } = useHogar({ session: sesion, datosHogar: perfil });

  if (cargando) {
    return (
      <div role="status" aria-live="polite" className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 text-foreground">
        <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/30 animate-pulse">
          <span className="text-xl font-black text-primary-foreground">Ñ</span>
        </div>
        <p className="text-sm text-muted-foreground">Iniciando ÑandeFinanza...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">

        <div className="w-full flex flex-col lg:flex-row lg:pl-60 min-h-screen">
          <HeaderMovil datosHogar={datosHogar} usuarioActual={usuarioActual} />

          <Sidebar datosHogar={datosHogar} usuarioActual={usuarioActual} activeTab={activeTab} setActiveTab={setActiveTab} esSuperadmin={esSuperadmin} />

          <main className="flex-1 min-w-0 px-3 pt-3 sm:px-6 sm:pt-6 lg:p-6 overflow-y-auto pb-[calc(6.5rem+env(safe-area-inset-bottom))] lg:pb-8">
            <div className="w-full">
              <Suspense fallback={<div className="p-8 text-center text-slate-400 animate-pulse">Cargando vista... ⚡</div>}>

                  <div key={`${activeTab}-${modoVista}`}>
                    {activeTab === "inicio" && <Inicio usuarioActual={usuarioActual} otroUsuario={otroUsuario} usuarios={usuarios} gastos={gastos} ingresos={ingresos} deudas={deudas} monedaGlobal={monedaGlobal} setMonedaGlobal={setMonedaGlobal} obtenerDatos={obtenerDatos} datosHogar={datosHogar} modoVista={modoVista} saludFinanciera={saludFinanciera} gastosProgramados={gastosProgramados} />}
                    {activeTab === "cuentas" && <Cuentas esSuperadmin={esSuperadmin} usuarioActual={usuarioActual} otroUsuario={otroUsuario} usuarios={usuarios} deudas={deudas} gastos={gastos} ingresos={ingresos} monedaGlobal={monedaGlobal} obtenerDatos={obtenerDatos} datosHogar={datosHogar} saludFinanciera={saludFinanciera} gastosProgramados={gastosProgramados} />}
                    {activeTab === "ingresos" && <Ingresos usuarioActual={usuarioActual} ingresos={ingresos} deudas={deudas} monedaGlobal={monedaGlobal} obtenerDatos={obtenerDatos} datosHogar={datosHogar} getNombreUsuario={getNombreUsuario} />}
                    {activeTab === "historial" && <Historial gastos={gastos} ingresos={ingresos} usuarios={usuarios} obtenerDatos={obtenerDatos} datosHogar={datosHogar} getNombreUsuario={getNombreUsuario} />}
                    {activeTab === "asistente" && <AsistenteGemini usuarioActual={usuarioActual} gastos={gastos} ingresos={ingresos} monedaGlobal={monedaGlobal} datosHogar={datosHogar} saludFinanciera={saludFinanciera} />}
                    {activeTab === "admin" && esSuperadmin && <SuperadminPanel datosHogar={datosHogar} />}
                  </div>

              </Suspense>
            </div>
          </main>

          <nav hidden={formularioAbierto} aria-label="Navegación principal" className="fixed bottom-[calc(0.75rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 z-50 lg:hidden">
            <Navegacion activeTab={activeTab} setActiveTab={setActiveTab} esSuperadmin={esSuperadmin} notificaciones={notificaciones} markAsRead={markNotisAsRead} responderSolicitud={responderSolicitud} />
          </nav>
        </div>
    </div>
  );
}

export default HogarApp;
