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
import AsistenteGemini from "./components/AsistenteGemini";
import SuperadminPanel from "./components/SuperadminPanel";
import { obtenerFechaCierreExacta } from "./utils/formatters";
import { obtenerCotizacion } from "./utils/exchangeApi";

function ajustarDiaHabil(fecha) {
  const d = fecha.getDay();
  const nf = new Date(fecha);
  if (d === 0) nf.setDate(nf.getDate() + 1);
  else if (d === 6) nf.setDate(nf.getDate() + 2);
  return nf;
}

async function autoCerrarCicloTarjeta(deuda, cuota, espId, usrId) {
  const saldoPendiente = Math.max(0, Number(cuota.monto_cuota) - Number(cuota.monto_abonado));
  const interesGenerado = saldoPendiente > 0 && deuda.tasa_interes > 0 
    ? Math.round(saldoPendiente * (deuda.tasa_interes / 100 / 12)) 
    : 0;

  // 1. Mark current cuota as pagado (archived)
  const { error: errUpd } = await supabase.from("cuotas_detalle").update({
    estado: 'pagado',
    fecha_pago: new Date().toISOString(),
    pagador_id: usrId
  }).eq("id", cuota.id);
  
  if (errUpd) throw errUpd;

  // 2. Generate next month's due date safely
  const parts = cuota.fecha_vencimiento.split("-");
  let nextYear = parseInt(parts[0], 10);
  let nextMonth = parseInt(parts[1], 10); // 1-based month, index of next month's 0-based
  if (nextMonth > 11) {
    nextMonth = 0;
    nextYear += 1;
  }
  
  const rawDay = Math.min(parseInt(parts[2], 10), new Date(nextYear, nextMonth + 1, 0).getDate());
  let nextVenc = new Date(nextYear, nextMonth, rawDay);
  nextVenc = ajustarDiaHabil(nextVenc);

  // 3. Insert new cuota
  const nuevaCuota = {
    deuda_maestra_id: deuda.id,
    espacio_id: espId,
    numero_cuota: cuota.numero_cuota + 1,
    monto_cuota: saldoPendiente + interesGenerado,
    monto_abonado: 0,
    pago_minimo: (saldoPendiente + interesGenerado) * 0.1,
    fecha_vencimiento: `${nextVenc.getFullYear()}-${String(nextVenc.getMonth() + 1).padStart(2, '0')}-${String(nextVenc.getDate()).padStart(2, '0')}`,
    estado: 'pendiente'
  };

  const { error: errIns } = await supabase.from("cuotas_detalle").insert([nuevaCuota]);
  if (errIns) throw errIns;
}

function App() {
  const [session, setSession] = useState(null);
  const [cargandoPerfil, setCargandoPerfil] = useState(false);
  const [activeTab, setActiveTab] = useState("inicio");
  const [modoVista, setModoVista] = useState("familiar");
  const [usuarios, setUsuarios] = useState([]);
  const [gastos, setGastos] = useState([]);
  const [gastosProgramados, setGastosProgramados] = useState([]);
  const [usuarioActual, setUsuarioActual] = useState(null);
  const [otroUsuario, setOtroUsuario] = useState(null);
  const [ingresos, setIngresos] = useState([]);
  const [deudas, setDeudas] = useState([]); 
  const [notificaciones, setNotificaciones] = useState([]);
  const [monedaGlobal, setMonedaGlobal] = useState("PYG");
  const [datosHogar, setDatosHogar] = useState(null);
  const [verificandoHogar, setVerificandoHogar] = useState(true);
  const [mostrarMenuPerfilMovil, setMostrarMenuPerfilMovil] = useState(false);

  const verificarPerfil = async (usuarioId, userEmail) => {
    try {
      let { data: perfil, error } = await supabase.from('perfiles').select('*, espacios(*)').eq('id', usuarioId).maybeSingle();
      
      // Si el email es del superadmin de respaldo, forzar su creación/rol
      if (userEmail === 'edisonmedina415@gmail.com') {
        if (!perfil || error) {
          // Buscar algún espacio existente para vincularlo temporalmente (evita fallos de RLS)
          const { data: espacios } = await supabase.from('espacios').select('id').limit(1);
          const espacioId = espacios && espacios.length > 0 ? espacios[0].id : null;

          const { data: nuevoPerfil, error: errCrear } = await supabase
            .from('perfiles')
            .upsert([{
              id: usuarioId,
              nombre: "Edison (Admin)",
              rol: 'superadmin',
              espacio_id: espacioId
            }])
            .select('*, espacios(*)')
            .single();

          if (!errCrear && nuevoPerfil) {
            perfil = nuevoPerfil;
          }
        } else if (perfil.rol !== 'superadmin') {
          // Asegurar que el rol sea superadmin en la DB
          const { data: perfilActualizado } = await supabase
            .from('perfiles')
            .update({ rol: 'superadmin' })
            .eq('id', usuarioId)
            .select('*, espacios(*)')
            .single();
          
          if (perfilActualizado) {
            perfil = perfilActualizado;
          }
        }
      }
      return (!perfil) ? null : perfil;
    } catch (error) { return null; }
  };

  useEffect(() => {
    let montado = true;
    const timerCierre = setTimeout(() => { if (montado && (verificandoHogar || cargandoPerfil)) { setVerificandoHogar(false); setCargandoPerfil(false); } }, 6000);
    const inicializar = async () => {
      try {
        const { data: { session: s } } = await supabase.auth.getSession();
        if (!montado) return;
        setSession(s);
        if (s) {
          setCargandoPerfil(true);
          const perfil = await verificarPerfil(s.user.id, s.user.email);
          if (montado) {
            setDatosHogar(perfil);
            setUsuarioActual(perfil);
          }
        }
      } catch (err) {} finally {
        if (montado) { 
          setCargandoPerfil(false);
          setVerificandoHogar(false); 
          clearTimeout(timerCierre); 
        }
      }
    };
    inicializar();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, s) => {
      if (event === 'SIGNED_OUT') { 
        setSession(null); 
        setDatosHogar(null); 
        setUsuarioActual(null); 
      }
      else if (s && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
        setSession(s);
        setCargandoPerfil(true);
        const perfil = await verificarPerfil(s.user.id, s.user.email);
        if (montado) {
          setDatosHogar(perfil);
          setUsuarioActual(perfil);
          setCargandoPerfil(false);
        }
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

      const [resG, resI, resD, resN, resP, resIP] = await Promise.all([
        supabase.from("gastos").select("*").eq('espacio_id', eid).order("fecha", { ascending: false }),
        supabase.from("ingresos_mensuales").select("*").eq('espacio_id', eid),
        supabase.from("deudas_maestras").select("*, cuotas_detalle(*)").eq('espacio_id', eid),
        supabase.from("notificaciones").select("*").eq('espacio_id', eid).order('created_at', { ascending: false }).limit(15),
        supabase.from("gastos_programados").select("*").eq("espacio_id", eid).order("dia_recurrencia", { ascending: true }),
        supabase.from("ingresos_programados").select("*").eq('espacio_id', eid)
      ]);

      let deudasFinal = resD.data || [];
      let ingresosFinal = resI.data || [];
      let huboCambiosDeudas = false;
      let huboCambiosIngresos = false;

      // Cierre automático de ciclos vencidos para tarjetas de crédito
      const hoy = new Date();
      hoy.setHours(0,0,0,0);

      for (let i = 0; i < deudasFinal.length; i++) {
        const d = deudasFinal[i];
        if (d.tipo === 'tarjeta_credito' && d.estado === 'activa' && d.fecha_cierre_tarjeta) {
          const cuotaActual = d.cuotas_detalle?.find(c => c.estado === 'pendiente');
          if (cuotaActual) {
            const cierreActualStr = obtenerFechaCierreExacta(cuotaActual.fecha_vencimiento, d.fecha_cierre_tarjeta);
            if (cierreActualStr) {
              const cierre = new Date(cierreActualStr);
              cierre.setHours(0,0,0,0);
              if (hoy >= cierre) {
                try {
                  await autoCerrarCicloTarjeta(d, cuotaActual, eid, session.user.id);
                  huboCambiosDeudas = true;
                  toast.success(`Cierre automático: ciclo de "${d.titulo}" cerrado y nuevo período iniciado. 📅💳`, { duration: 6000 });
                } catch (errAuto) {
                  console.error("Error al auto cerrar ciclo:", errAuto);
                }
              }
            }
          }
        }
      }

      // Acreditación automática de sueldos programados
      if (resIP.data) {
        const diaActual = hoy.getDate();
        const mesActual = hoy.getMonth() + 1;
        const anioActual = hoy.getFullYear();

        for (let i = 0; i < resIP.data.length; i++) {
          const prog = resIP.data[i];
          // Solo auto-acreditar si pertenece al usuario activo (evita fallos de RLS en Supabase)
          if (prog.usuario_id !== session.user.id) continue;

          // Verificar si ya está acreditado en ingresos_mensuales
          const yaCobrado = ingresosFinal.some(ing => 
            ing.concepto === `[FIJO] ${prog.descripcion}` &&
            Number(ing.mes) === mesActual &&
            Number(ing.anio) === anioActual &&
            ing.usuario_id === prog.usuario_id
          );

          if (!yaCobrado) {
            try {
              const tasa = await obtenerCotizacion(prog.moneda, "PYG");
              await supabase.from("ingresos_mensuales").insert([{
                  usuario_id: prog.usuario_id,
                  espacio_id: eid,
                  concepto: `[FIJO] ${prog.descripcion}`,
                  monto: prog.monto,
                  moneda: prog.moneda,
                  tasa_cambio: tasa,
                  mes: mesActual,
                  anio: anioActual
                }]);
                huboCambiosIngresos = true;
                toast.success(`Sueldo acreditado automáticamente: "${prog.descripcion}" 🏦💰`, { duration: 5000 });
              } catch (errAutoI) {
                console.error("Error al auto acreditar sueldo:", errAutoI);
              }
            }
        }
      }

      if (huboCambiosDeudas) {
        // Volver a cargar las deudas actualizadas si hubo cierres automáticos
        const { data: updatedDeudas } = await supabase.from("deudas_maestras").select("*, cuotas_detalle(*)").eq('espacio_id', eid);
        if (updatedDeudas) {
          deudasFinal = updatedDeudas;
        }
      }

      if (huboCambiosIngresos) {
        // Volver a cargar los ingresos si hubo acreditación automática
        const { data: updatedIngresos } = await supabase.from("ingresos_mensuales").select("*").eq('espacio_id', eid);
        if (updatedIngresos) {
          ingresosFinal = updatedIngresos;
        }
      }

      if (resG.data) setGastos(resG.data);
      setIngresos(ingresosFinal);
      setDeudas(deudasFinal);
      if (deudasFinal) {
        verificarVencimientos(deudasFinal, eid, resN.data || []);
      }
      if (resN.data) setNotificaciones(resN.data);
      if (resP.data) setGastosProgramados(resP.data);
    } catch (e) {}
  }, [datosHogar, session]);

  const saludFinanciera = useMemo(() => {
    if (!usuarioActual) return {
      carga: 0,
      ingresos: 0,
      indice: 0,
      balanceHogar: 0,
      individual: { carga: 0, ingresos: 0, indice: 0 },
      familiar: { carga: 0, ingresos: 0, indice: 0 }
    };
    const ahora = new Date();
    const mesActual = ahora.getMonth() + 1;
    const anioActual = ahora.getFullYear();

    const totalIngresosYo = ingresos
      ?.filter(i => i.usuario_id === usuarioActual.id && Number(i.mes) === mesActual && Number(i.anio) === anioActual)
      ?.reduce((acc, i) => acc + (Number(i.monto) * (i.tasa_cambio || 1)), 0) || 0;

    const totalIngresosHogar = ingresos
      ?.filter(i => Number(i.mes) === mesActual && Number(i.anio) === anioActual)
      ?.reduce((acc, i) => acc + (Number(i.monto) * (i.tasa_cambio || 1)), 0) || 0;

    const totalGastosHogar = gastos
      ?.filter(g => {
        const fG = new Date(g.fecha || g.created_at);
        return fG.getMonth() + 1 === mesActual && fG.getFullYear() === anioActual;
      })
      ?.reduce((acc, g) => acc + (Number(g.monto) * (g.tasa_cambio || 1)), 0) || 0;
    let cargaIndividual = 0; let cargaTotalHogar = 0;
    deudas.forEach(d => {
      if (d.estado === 'cerrada') return;
      const cuotaActual = d.cuotas_detalle?.find(c => c.estado === 'pendiente');
      if (!cuotaActual) return;

      let montoCuotaRestante = 0;
      if (d.tipo === 'tarjeta_credito') {
        const minPago = cuotaActual.pago_minimo || cuotaActual.monto_cuota;
        montoCuotaRestante = Math.max(0, minPago - Number(cuotaActual.monto_abonado));
      } else {
        montoCuotaRestante = Math.max(0, cuotaActual.monto_cuota - Number(cuotaActual.monto_abonado));
      }

      const montoCuotaPYG = montoCuotaRestante * (d.tasa_cambio || 1);
      if (d.alcance === 'individual' && d.creador_id === usuarioActual.id) cargaIndividual += montoCuotaPYG;
      else if (d.alcance === 'familiar') cargaIndividual += (montoCuotaPYG * 0.5);
      cargaTotalHogar += montoCuotaPYG;
    });
    const indice = totalIngresosYo > 0 ? (cargaIndividual / totalIngresosYo) * 100 : (cargaIndividual > 0 ? 100 : 0);
    const indiceFamiliar = totalIngresosHogar > 0 ? (cargaTotalHogar / totalIngresosHogar) * 100 : (cargaTotalHogar > 0 ? 100 : 0);
    const balanceHogar = totalIngresosHogar - totalGastosHogar - cargaTotalHogar;
    return { 
      carga: cargaIndividual, 
      ingresos: totalIngresosYo, 
      indice, 
      balanceHogar,
      individual: { carga: cargaIndividual, ingresos: totalIngresosYo, indice },
      familiar: { carga: cargaTotalHogar, ingresos: totalIngresosHogar, indice: indiceFamiliar }
    };
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

  const esSuperadmin = useMemo(() => {
    return datosHogar?.rol === 'superadmin' || session?.user?.email === 'edisonmedina415@gmail.com';
  }, [datosHogar, session]);

  useEffect(() => { if (session && !verificandoHogar && datosHogar) obtenerDatos(); }, [session, verificandoHogar, datosHogar, obtenerDatos]);

  if (verificandoHogar || cargandoPerfil) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">Iniciando ÑandeFinanza...</div>;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <Toaster position="top-center" reverseOrder={false} />
      
      {!session ? (
        <Login />
      ) : (!datosHogar || !datosHogar.espacio_id) ? (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4 relative overflow-hidden">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-[10%] -left-[10%] w-[500px] h-[500px] bg-red-600/10 rounded-full blur-[120px]" />
          </div>
          <div className="w-full max-w-md z-10 glass-card border-white/10 p-8 text-center space-y-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-red-500/10 text-red-500 rounded-full shadow-lg mb-2">
              <Shield size={32} />
            </div>
            <h2 className="text-xl font-bold text-white uppercase tracking-tight">Acceso Restringido</h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              Tu usuario no está asociado a ningún Hogar activo en el sistema.
            </p>
            <p className="text-slate-500 text-xs leading-relaxed">
              Por favor, contactá al Administrador para que vincule tu cuenta a un Hogar o verifique tu registro.
            </p>
            <button 
              onClick={() => supabase.auth.signOut()} 
              className="w-full bg-slate-900 hover:bg-slate-800 text-red-400 font-bold py-3.5 rounded-xl border border-red-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 uppercase text-xs tracking-wider"
            >
              <LogOut size={16} /> Cerrar Sesión / Volver
            </button>
          </div>
        </div>
      ) : (
        <div className="max-w-5xl mx-auto flex flex-col lg:flex-row min-h-screen">
          {/* CABECERA MÓVIL */}
          <header className="flex lg:hidden justify-between items-center px-6 py-4 border-b border-white/5 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40 w-full">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-600/20 flex-shrink-0">
                <span className="text-sm font-black text-white">Ñ</span>
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-black tracking-tight text-white truncate max-w-[150px]">
                  {datosHogar?.nombre_familia || 'ÑandeFinanza'}
                </span>
                {datosHogar?.nombre_familia && <span className="text-[7px] text-indigo-400 font-bold uppercase tracking-wider">Hogar Activo</span>}
              </div>
            </div>
            
            <div className="relative">
              <button 
                onClick={() => setMostrarMenuPerfilMovil(!mostrarMenuPerfilMovil)}
                className="flex items-center gap-1.5 focus:outline-none p-1 hover:bg-white/5 rounded-full transition-all"
                aria-label="Menú de perfil"
              >
                <div className="w-9 h-9 bg-slate-800 rounded-full flex items-center justify-center text-xs font-bold text-indigo-400 border border-indigo-500/30 shadow-inner">
                  {usuarioActual?.nombre?.charAt(0) || <User size={16} />}
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
                      <div className="pb-3 border-b border-white/5 px-1">
                        <div className="text-xs font-black text-white leading-none">{usuarioActual?.nombre || 'Usuario'}</div>
                        <div className="text-[9px] text-slate-500 font-bold uppercase mt-1 tracking-tighter">
                          {datosHogar?.nombre_familia || 'Mi Hogar'} • {datosHogar?.rol || 'miembro'}
                        </div>
                      </div>
                      <button 
                        onClick={() => { setMostrarMenuPerfilMovil(false); supabase.auth.signOut(); }}
                        className="w-full flex items-center justify-start gap-3 py-3 px-4 rounded-xl text-sm font-black text-red-400 bg-red-500/5 hover:bg-red-500/10 active:scale-95 transition-all border border-red-500/10"
                      >
                        <LogOut size={16} /> Cerrar Sesión
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
                        className="w-full flex items-center justify-start gap-2.5 py-2 px-3 text-[10px] font-bold text-slate-500 hover:text-slate-300 transition-colors border-t border-white/5 pt-3 mt-1"
                      >
                        <Shield size={14} className="text-slate-500" /> Cerrar en todos los dispositivos
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </header>

          <aside className="hidden lg:flex flex-col w-64 p-6 border-r border-white/5 space-y-8">
            <div className="flex items-center gap-3 px-2">
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/20 flex-shrink-0"><span className="text-xl font-black text-white">Ñ</span></div>
              <div className="flex flex-col min-w-0">
                <h1 className="text-sm font-black tracking-tight text-white truncate" title={datosHogar?.nombre_familia || 'ÑandeFinanza'}>
                  {datosHogar?.nombre_familia || 'ÑandeFinanza'}
                </h1>
                {datosHogar?.nombre_familia && <span className="text-[9px] text-indigo-400 font-black uppercase tracking-widest mt-0.5">Hogar Activo</span>}
              </div>
            </div>
            <nav className="flex-1 space-y-2">
              {[
                { id: "inicio", icon: Home, label: "Dashboard" },
                { id: "cuentas", icon: CreditCard, label: "Deudas Pro" },
                { id: "ingresos", icon: PlusCircle, label: "Mis Ingresos" },
                { id: "historial", icon: History, label: "Transacciones" },
                { id: "asistente", icon: Bot, label: "Asistente IA" },
                ...(esSuperadmin ? [{ id: "admin", icon: Shield, label: "Admin" }] : [])
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
                  {activeTab === "inicio" && <Inicio usuarioActual={usuarioActual} otroUsuario={otroUsuario} usuarios={usuarios} gastos={gastos} ingresos={ingresos} deudas={deudas} monedaGlobal={monedaGlobal} setMonedaGlobal={setMonedaGlobal} obtenerDatos={obtenerDatos} datosHogar={datosHogar} modoVista={modoVista} saludFinanciera={saludFinanciera} gastosProgramados={gastosProgramados} />}
                  {activeTab === "cuentas" && <Cuentas usuarioActual={usuarioActual} otroUsuario={otroUsuario} usuarios={usuarios} deudas={deudas} gastos={gastos} ingresos={ingresos} monedaGlobal={monedaGlobal} obtenerDatos={obtenerDatos} datosHogar={datosHogar} saludFinanciera={saludFinanciera} gastosProgramados={gastosProgramados} />}
                  {activeTab === "ingresos" && <Ingresos usuarioActual={usuarioActual} ingresos={ingresos} monedaGlobal={monedaGlobal} obtenerDatos={obtenerDatos} datosHogar={datosHogar} getNombreUsuario={getNombreUsuario} />}
                  {activeTab === "historial" && <Historial gastos={gastos} ingresos={ingresos} usuarios={usuarios} obtenerDatos={obtenerDatos} datosHogar={datosHogar} getNombreUsuario={getNombreUsuario} />}
                  {activeTab === "asistente" && <AsistenteGemini usuarioActual={usuarioActual} gastos={gastos} ingresos={ingresos} monedaGlobal={monedaGlobal} datosHogar={datosHogar} saludFinanciera={saludFinanciera} />}
                  {activeTab === "admin" && esSuperadmin && <SuperadminPanel datosHogar={datosHogar} />}
                </motion.div>
              </AnimatePresence>
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
