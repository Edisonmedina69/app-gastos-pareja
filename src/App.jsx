import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "./supabase";
import { Toaster, toast } from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Home, 
  CreditCard, 
  PlusCircle, 
  History, 
  Bot, 
  Shield, 
  User, 
  LogOut 
} from "lucide-react";

// COMPONENTES
import Login from "./components/Login";
import Navegacion from "./components/Navegacion";
import Inicio from "./components/Inicio";
import Cuentas from "./components/Cuentas";
import Ingresos from "./components/Ingresos";
import Metas from "./components/Metas";
import Historial from "./components/Historial";
import ConfiguracionHogar from "./components/ConfiguracionHogar";
import AsistenteGemini from "./components/AsistenteGemini";
import SuperadminPanel from "./components/SuperadminPanel";

function App() {
  const [session, setSession] = useState(null);
  const [activeTab, setActiveTab] = useState("inicio");
  const [modoVista, setModoVista] = useState("familiar");
  const [usuarios, setUsuarios] = useState([]);
  const [gastos, setGastos] = useState([]);
  const [usuarioActual, setUsuarioActual] = useState(null);
  const [otroUsuario, setOtroUsuario] = useState(null);
  const [ingresos, setIngresos] = useState([]);
  const [deudas, setDeudas] = useState([]); 
  const [notificaciones, setNotificaciones] = useState([]);
  const [monedaGlobal, setMonedaGlobal] = useState("PYG");
  const [datosHogar, setDatosHogar] = useState(null);
  const [verificandoHogar, setVerificandoHogar] = useState(true);
  const [mostrarMenuPerfilMovil, setMostrarMenuPerfilMovil] = useState(false);

  const verificarPerfil = async (usuarioId) => {
    try {
      const { data: perfil, error } = await supabase.from('perfiles').select('*, espacios(*)').eq('id', usuarioId).single();
      return (error || !perfil) ? null : perfil;
    } catch (error) { return null; }
  };

  useEffect(() => {
    let montado = true;
    const timerCierre = setTimeout(() => { if (montado && verificandoHogar) setVerificandoHogar(false); }, 6000);
    const inicializar = async () => {
      try {
        const { data: { session: s } } = await supabase.auth.getSession();
        if (!montado) return;
        setSession(s);
        if (s) {
          const perfil = await verificarPerfil(s.user.id);
          if (montado) setDatosHogar(perfil);
        }
      } catch (err) {} finally {
        if (montado) { setVerificandoHogar(false); clearTimeout(timerCierre); }
      }
    };
    inicializar();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, s) => {
      if (event === 'SIGNED_OUT') { setSession(null); setDatosHogar(null); }
      else if (s && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
        setSession(s);
        const perfil = await verificarPerfil(s.user.id);
        if (montado) setDatosHogar(perfil);
      }
    });
    return () => { montado = false; subscription.unsubscribe(); clearTimeout(timerCierre); };
  }, []);

  const obtenerDatos = useCallback(async () => {
    if (!datosHogar || !session || !datosHogar.espacio_id) return;
    const eid = datosHogar.espacio_id;

    try {
      const { data: miembros } = await supabase.from("perfiles").select("*").eq("espacio_id", eid);
      if (miembros) {
        setUsuarios(miembros);
        const logueado = miembros.find(u => u.id === session.user.id);
        if (logueado) {
          setUsuarioActual(logueado);
          setOtroUsuario(miembros.find(u => u.id !== logueado.id));
        }
      }

      const [resG, resI, resD, resN] = await Promise.all([
        supabase.from("gastos").select("*").eq('espacio_id', eid).order("fecha", { ascending: false }),
        supabase.from("ingresos_mensuales").select("*").eq('espacio_id', eid),
        supabase.from("deudas_maestras").select("*, cuotas_detalle(*)").eq('espacio_id', eid),
        supabase.from("notificaciones").select("*").eq('espacio_id', eid).order('created_at', { ascending: false }).limit(15)
      ]);

      if (resG.data) setGastos(resG.data);
      if (resI.data) setIngresos(resI.data);
      if (resD.data) {
        setDeudas(resD.data);
        verificarVencimientos(resD.data, eid, resN.data || []);
      }
      if (resN.data) setNotificaciones(resN.data);
    } catch (e) {}
  }, [datosHogar, session]);

  const saludFinanciera = useMemo(() => {
    if (!usuarioActual) return { carga: 0, ingresos: 0, indice: 0, balanceHogar: 0 };
    const totalIngresosYo = ingresos?.filter(i => i.usuario_id === usuarioActual.id)?.reduce((acc, i) => acc + (Number(i.monto) * (i.tasa_cambio || 1)), 0) || 0;
    const totalIngresosHogar = ingresos?.reduce((acc, i) => acc + (Number(i.monto) * (i.tasa_cambio || 1)), 0) || 0;
    const totalGastosHogar = gastos?.reduce((acc, g) => acc + (Number(g.monto) * (g.tasa_cambio || 1)), 0) || 0;
    let cargaIndividual = 0; let cargaTotalHogar = 0;
    deudas.forEach(d => {
      if (d.estado === 'cerrada') return;
      const cuotaActual = d.cuotas_detalle?.find(c => c.estado === 'pendiente');
      if (!cuotaActual) return;
      const montoCuotaPYG = (cuotaActual.monto_cuota - cuotaActual.monto_abonado) * (d.tasa_cambio || 1);
      if (d.alcance === 'individual' && d.creador_id === usuarioActual.id) cargaIndividual += montoCuotaPYG;
      else if (d.alcance === 'familiar') cargaIndividual += (montoCuotaPYG * 0.5);
      cargaTotalHogar += montoCuotaPYG;
    });
    const indice = totalIngresosYo > 0 ? (cargaIndividual / totalIngresosYo) * 100 : (cargaIndividual > 0 ? 100 : 0);
    const balanceHogar = totalIngresosHogar - totalGastosHogar - cargaTotalHogar;
    return { carga: cargaIndividual, ingresos: totalIngresosYo, indice, balanceHogar };
  }, [usuarioActual, deudas, ingresos, gastos]);

  async function verificarVencimientos(deudasData, eid, notisActuales) {
    const hoy = new Date();
    const alertasNuevas = [];
    deudasData.forEach(d => {
      d.cuotas_detalle?.forEach(c => {
        if (c.estado === 'pendiente') {
          const venc = new Date(c.fecha_vencimiento);
          const diffDays = Math.ceil((venc - hoy) / (1000 * 60 * 60 * 24));
          if (diffDays >= 0 && diffDays <= 2) {
            const msg = `Cuota ${c.numero_cuota} de "${d.titulo}" vence en ${diffDays === 0 ? 'hoy' : diffDays + ' días'}.`;
            if (!notisActuales.some(n => n.mensaje === msg)) {
              alertasNuevas.push({ espacio_id: eid, usuario_id: session.user.id, titulo: '⚠️ Vencimiento', mensaje: msg, tipo: 'alerta' });
            }
          }
        }
      });
    });
    if (alertasNuevas.length > 0) await supabase.from('notificaciones').insert(alertasNuevas);
  }

  const markNotisAsRead = async () => {
    if (!datosHogar) return;
    await supabase.from('notificaciones').update({ leida: true }).eq('espacio_id', datosHogar.espacio_id).eq('leida', false);
    obtenerDatos();
  };

  const responderSolicitud = async (noti, aceptada) => {
    const toastId = toast.loading(aceptada ? "Procesando ayuda..." : "Rechazando solicitud...");
    try {
      const { deuda_id, cuota_id, monto, moneda } = noti.metadata;
      if (aceptada) {
        const { data: cuota } = await supabase.from('cuotas_detalle').select('*').eq('id', cuota_id).single();
        const nuevoAbono = Number(cuota.monto_abonado) + Number(monto);
        const pagada = nuevoAbono >= cuota.monto_cuota;
        await supabase.from('cuotas_detalle').update({ monto_abonado: nuevoAbono, estado: pagada ? 'pagado' : 'pendiente', pagador_id: usuarioActual.id, fecha_pago: new Date().toISOString() }).eq('id', cuota_id);
        await supabase.from('gastos').insert([{ espacio_id: datosHogar.espacio_id, usuario_id: usuarioActual.id, pagador_id: usuarioActual.id, concepto: `Ayuda Pago Deuda: ${noti.mensaje.split('"')[1]}`, monto: monto, moneda: moneda, categoria: "Ayuda Familiar", para_quien: "Pareja" }]);
        toast.success("¡Ayuda registrada con éxito! ❤️", { id: toastId });
      } else {
        await supabase.from('notificaciones').insert([{ espacio_id: datosHogar.espacio_id, usuario_id: noti.metadata.solicitante_id, titulo: "Solicitud Rechazada", mensaje: `${usuarioActual.nombre} no puede ayudarte con este pago ahora.`, tipo: "info" }]);
        toast.error("Solicitud rechazada", { id: toastId });
      }
      await supabase.from('notificaciones').delete().eq('id', noti.id);
      obtenerDatos();
    } catch (e) { toast.error("Error al procesar", { id: toastId }); }
  };

  const getNombreUsuario = (id) => {
    const u = usuarios.find((u) => u.id === id);
    return u ? u.nombre : "Usuario";
  };

  useEffect(() => { if (session && !verificandoHogar && datosHogar) obtenerDatos(); }, [session, verificandoHogar, datosHogar, obtenerDatos]);

  if (verificandoHogar) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">Iniciando ÑandeFinanza...</div>;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <Toaster position="top-center" reverseOrder={false} />
      
      {!session ? (
        <Login />
      ) : !datosHogar ? (
        <ConfiguracionHogar 
          usuario={session.user} 
          onHogarCreado={async () => {
            const perfil = await verificarPerfil(session.user.id);
            setDatosHogar(perfil);
          }} 
        />
      ) : (
        <div className="max-w-5xl mx-auto flex flex-col lg:flex-row min-h-screen">
          {/* CABECERA MÓVIL */}
          <header className="flex lg:hidden justify-between items-center px-6 py-4 border-b border-white/5 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40 w-full">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-600/20">
                <span className="text-sm font-black text-white">Ñ</span>
              </div>
              <span className="text-sm font-black tracking-tight text-white">ÑandeFinanza</span>
            </div>
            
            <div className="relative">
              <button 
                onClick={() => setMostrarMenuPerfilMovil(!mostrarMenuPerfilMovil)}
                className="flex items-center gap-2 focus:outline-none"
              >
                <div className="w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center text-xs font-bold text-indigo-400 border border-indigo-500/30">
                  {usuarioActual?.nombre?.charAt(0)}
                </div>
              </button>

              <AnimatePresence>
                {mostrarMenuPerfilMovil && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setMostrarMenuPerfilMovil(false)} />
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-2 z-50 w-64 bg-slate-900/95 border border-white/10 rounded-2xl p-4 shadow-2xl backdrop-blur-md flex flex-col gap-3"
                    >
                      <div className="pb-3 border-b border-white/5">
                        <div className="text-xs font-bold text-white leading-none">{usuarioActual?.nombre}</div>
                        <div className="text-[9px] text-slate-500 font-bold uppercase mt-1 tracking-tighter">
                          {datosHogar?.nombre_familia} • {datosHogar?.rol}
                        </div>
                      </div>
                      <button 
                        onClick={() => { setMostrarMenuPerfilMovil(false); supabase.auth.signOut(); }}
                        className="w-full flex items-center justify-start gap-3 py-2 text-xs font-bold text-slate-300 hover:text-white transition-colors"
                      >
                        <LogOut size={16} className="text-slate-500" /> Cerrar Sesión
                      </button>
                      <button 
                        onClick={async () => {
                          setMostrarMenuPerfilMovil(false);
                          const confirmar = window.confirm("¿Seguro que querés cerrar la sesión en todos tus dispositivos?");
                          if (confirmar) {
                            const toastId = toast.loading("Cerrando todas las sesiones...");
                            try {
                              const { error } = await supabase.auth.signOut({ scope: 'global' });
                              if (error) throw error;
                              toast.success("Sesiones cerradas", { id: toastId });
                            } catch (err) {
                              toast.error(err.message, { id: toastId });
                            }
                          }
                        }}
                        className="w-full flex items-center justify-start gap-3 py-2 text-xs font-bold text-red-400 hover:text-red-300 transition-colors border-t border-white/5 pt-3"
                      >
                        <Shield size={16} className="text-red-500/80" /> Cerrar en todos los dispositivos
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </header>

          <aside className="hidden lg:flex flex-col w-64 p-6 border-r border-white/5 space-y-8">
            <div className="flex items-center gap-3 px-2">
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/20"><span className="text-xl font-black text-white">Ñ</span></div>
              <h1 className="text-lg font-black tracking-tight text-white">ÑandeFinanza</h1>
            </div>
            <nav className="flex-1 space-y-2">
              {[
                { id: "inicio", icon: Home, label: "Dashboard" },
                { id: "cuentas", icon: CreditCard, label: "Deudas Pro" },
                { id: "ingresos", icon: PlusCircle, label: "Mis Ingresos" },
                { id: "historial", icon: History, label: "Transacciones" },
                { id: "asistente", icon: Bot, label: "Asistente IA" },
                ...(datosHogar?.rol === 'superadmin' ? [{ id: "admin", icon: Shield, label: "Admin" }] : [])
              ].map(link => (
                <button key={link.id} onClick={() => setActiveTab(link.id)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${activeTab === link.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'}`}>
                  <link.icon size={20} /> {link.label}
                </button>
              ))}
            </nav>
            <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center text-[10px] font-bold">{usuarioActual?.nombre?.charAt(0)}</div>
                <div>
                  <div className="text-xs font-bold text-white leading-none">{usuarioActual?.nombre}</div>
                  <div className="text-[10px] text-slate-500 font-bold uppercase mt-1 tracking-tighter">{datosHogar.rol}</div>
                </div>
              </div>
              <button onClick={() => supabase.auth.signOut()} className="w-full flex items-center justify-center gap-2 py-2 text-[10px] font-black text-slate-500 hover:text-red-400 transition-colors uppercase tracking-widest"><LogOut size={14} /> Cerrar Sesión</button>
              <button 
                onClick={async () => {
                  const confirmar = window.confirm("¿Seguro que querés cerrar la sesión en todos tus dispositivos?");
                  if (confirmar) {
                    const toastId = toast.loading("Cerrando todas las sesiones...");
                    try {
                      const { error } = await supabase.auth.signOut({ scope: 'global' });
                      if (error) throw error;
                      toast.success("Sesiones cerradas en todos los dispositivos", { id: toastId });
                    } catch (err) {
                      toast.error(err.message, { id: toastId });
                    }
                  }
                }} 
                className="w-full flex items-center justify-center gap-2 py-1.5 text-[8px] font-bold text-slate-600 hover:text-red-400 transition-colors uppercase tracking-widest mt-1 border-t border-white/5 pt-1.5"
              >
                Cerrar en todos los dispositivos
              </button>
            </div>
          </aside>

          <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
            <div className="max-w-3xl mx-auto">
              <AnimatePresence mode="wait">
                <motion.div key={`${activeTab}-${modoVista}`} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }}>
                  {activeTab === "inicio" && <Inicio usuarioActual={usuarioActual} otroUsuario={otroUsuario} usuarios={usuarios} gastos={gastos} ingresos={ingresos} deudas={deudas} monedaGlobal={monedaGlobal} setMonedaGlobal={setMonedaGlobal} obtenerDatos={obtenerDatos} datosHogar={datosHogar} modoVista={modoVista} saludFinanciera={saludFinanciera} />}
                  {activeTab === "cuentas" && <Cuentas usuarioActual={usuarioActual} otroUsuario={otroUsuario} deudas={deudas} gastos={gastos} ingresos={ingresos} monedaGlobal={monedaGlobal} obtenerDatos={obtenerDatos} datosHogar={datosHogar} saludFinanciera={saludFinanciera} />}
                  {activeTab === "ingresos" && <Ingresos usuarioActual={usuarioActual} ingresos={ingresos} monedaGlobal={monedaGlobal} obtenerDatos={obtenerDatos} datosHogar={datosHogar} getNombreUsuario={getNombreUsuario} />}
                  {activeTab === "historial" && <Historial gastos={gastos} ingresos={ingresos} usuarios={usuarios} obtenerDatos={obtenerDatos} datosHogar={datosHogar} getNombreUsuario={getNombreUsuario} />}
                  {activeTab === "asistente" && <AsistenteGemini usuarioActual={usuarioActual} gastos={gastos} ingresos={ingresos} monedaGlobal={monedaGlobal} datosHogar={datosHogar} saludFinanciera={saludFinanciera} />}
                  {activeTab === "admin" && datosHogar?.rol === 'superadmin' && <SuperadminPanel datosHogar={datosHogar} />}
                </motion.div>
              </AnimatePresence>
            </div>
          </main>

          <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 lg:hidden">
            <Navegacion activeTab={activeTab} setActiveTab={setActiveTab} esSuperadmin={datosHogar?.rol === 'superadmin'} notificaciones={notificaciones} markAsRead={markNotisAsRead} responderSolicitud={responderSolicitud} />
          </nav>
        </div>
      )}
    </div>
  );
}

export default App;
