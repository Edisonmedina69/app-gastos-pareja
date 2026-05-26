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

  // --- VERIFICAR PERFIL ---
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

  // --- MOTOR DE SALUD FINANCIERA (HU-09) ---
  const saludFinanciera = useMemo(() => {
    if (!usuarioActual) return { carga: 0, ingresos: 0, indice: 0 };
    
    // 1. Ingresos totales del usuario (Mes actual)
    const hoy = new Date();
    const totalIngresos = ingresos
      ?.filter(i => i.usuario_id === usuarioActual.id)
      ?.reduce((acc, i) => acc + (Number(i.monto) * (i.tasa_cambio || 1)), 0) || 0;

    // 2. Carga de Deuda Mensual
    // Regla: 100% individual + 50% familiar
    let carga = 0;
    deudas.forEach(d => {
      if (d.estado === 'cerrada') return;
      
      const cuotaActual = d.cuotas_detalle?.find(c => c.estado === 'pendiente');
      if (!cuotaActual) return;

      const montoCuotaPYG = (cuotaActual.monto_cuota - cuotaActual.monto_abonado) * (d.tasa_cambio || 1);
      
      if (d.alcance === 'individual' && d.creador_id === usuarioActual.id) {
        carga += montoCuotaPYG;
      } else if (d.alcance === 'familiar') {
        carga += (montoCuotaPYG * 0.5);
      }
    });

    const indice = totalIngresos > 0 ? (carga / totalIngresos) * 100 : (carga > 0 ? 100 : 0);

    return { carga, ingresos: totalIngresos, indice };
  }, [usuarioActual, deudas, ingresos]);

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
        // 1. Registrar Pago en Deuda
        const { data: cuota } = await supabase.from('cuotas_detalle').select('*').eq('id', cuota_id).single();
        const nuevoAbono = Number(cuota.monto_abonado) + Number(monto);
        const pagada = nuevoAbono >= cuota.monto_cuota;

        await supabase.from('cuotas_detalle').update({ 
          monto_abonado: nuevoAbono, 
          estado: pagada ? 'pagado' : 'pendiente',
          pagador_id: usuarioActual.id,
          fecha_pago: new Date().toISOString()
        }).eq('id', cuota_id);

        // 2. DOBLE ASIENTO: Gasto para el ACEPTADOR (HU-07)
        await supabase.from('gastos').insert([{
          espacio_id: datosHogar.espacio_id,
          usuario_id: usuarioActual.id,
          pagador_id: usuarioActual.id,
          concepto: `Ayuda Pago Deuda: ${noti.mensaje.split('"')[1]}`,
          monto: monto,
          moneda: moneda,
          categoria: "Ayuda Familiar",
          para_quien: "Pareja"
        }]);

        toast.success("¡Ayuda registrada con éxito! ❤️", { id: toastId });
      } else {
        // Notificar rechazo
        await supabase.from('notificaciones').insert([{
          espacio_id: datosHogar.espacio_id,
          usuario_id: noti.metadata.solicitante_id,
          titulo: "Solicitud Rechazada",
          mensaje: `${usuarioActual.nombre} no puede ayudarte con este pago ahora.`,
          tipo: "info"
        }]);
        toast.error("Solicitud rechazada", { id: toastId });
      }

      // Eliminar o marcar leída la notificación original
      await supabase.from('notificaciones').delete().eq('id', noti.id);
      obtenerDatos();
    } catch (e) {
      toast.error("Error al procesar", { id: toastId });
    }
  };

  useEffect(() => { if (session && !verificandoHogar && datosHogar) obtenerDatos(); }, [session, verificandoHogar, datosHogar, obtenerDatos]);

  if (verificandoHogar) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">Iniciando ÑandeFinanza...</div>;
  if (!session || !datosHogar) return <Login onLogin={(s) => setSession(s)} />;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <Toaster position="top-center" reverseOrder={false} />
      
      <div className="max-w-5xl mx-auto flex flex-col lg:flex-row min-h-screen">
        <aside className="hidden lg:flex flex-col w-64 p-6 border-r border-white/5 space-y-8">
          <div className="flex items-center gap-3 px-2">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
              <span className="text-xl font-black text-white">Ñ</span>
            </div>
            <h1 className="text-lg font-black tracking-tight text-white">ÑandeFinanza</h1>
          </div>

          <nav className="flex-1 space-y-2">
            {[
              { id: "inicio", icon: Home, label: "Dashboard" },
              { id: "cuentas", icon: CreditCard, label: "Deudas Pro" },
              { id: "ingresos", icon: PlusCircle, label: "Mis Ingresos" },
              { id: "historial", icon: History, label: "Transacciones" },
              { id: "asistente", icon: Bot, label: "Asistente IA" }
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
          </div>
        </aside>

        <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
          <div className="max-w-3xl mx-auto">
            <AnimatePresence mode="wait">
              <motion.div key={`${activeTab}-${modoVista}`} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }}>
                {activeTab === "inicio" && <Inicio usuarioActual={usuarioActual} otroUsuario={otroUsuario} usuarios={usuarios} gastos={gastos} ingresos={ingresos} deudas={deudas} monedaGlobal={monedaGlobal} setMonedaGlobal={setMonedaGlobal} obtenerDatos={obtenerDatos} datosHogar={datosHogar} modoVista={modoVista} saludFinanciera={saludFinanciera} />}
                {activeTab === "cuentas" && <Cuentas usuarioActual={usuarioActual} deudas={deudas} gastos={gastos} ingresos={ingresos} monedaGlobal={monedaGlobal} obtenerDatos={obtenerDatos} datosHogar={datosHogar} saludFinanciera={saludFinanciera} />}
                {activeTab === "ingresos" && <Ingresos usuarioActual={usuarioActual} ingresos={ingresos} monedaGlobal={monedaGlobal} obtenerDatos={obtenerDatos} datosHogar={datosHogar} />}
                {activeTab === "historial" && <Historial gastos={gastos} ingresos={ingresos} usuarios={usuarios} obtenerDatos={obtenerDatos} datosHogar={datosHogar} />}
                {activeTab === "asistente" && <AsistenteGemini usuarioActual={usuarioActual} gastos={gastos} ingresos={ingresos} monedaGlobal={monedaGlobal} datosHogar={datosHogar} saludFinanciera={saludFinanciera} />}
                {activeTab === "admin" && datosHogar?.rol === 'superadmin' && <SuperadminPanel />}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>

        <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 lg:hidden">
          <Navegacion activeTab={activeTab} setActiveTab={setActiveTab} esSuperadmin={datosHogar?.rol === 'superadmin'} notificaciones={notificaciones} markAsRead={markNotisAsRead} responderSolicitud={responderSolicitud} />
        </nav>
      </div>
    </div>
  );
}

export default App;
