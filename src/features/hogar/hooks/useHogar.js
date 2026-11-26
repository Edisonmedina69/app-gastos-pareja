import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "react-hot-toast";

import { escucharCambiosSesion, obtenerSesion } from "../../../services/auth.service";
import { listarMiembros, suscribirCambiosEspacio } from "../../../services/hogar.service";
import { insertarGastos, listarGastos } from "../../../services/gastos.service";
import { listarGastosProgramados } from "../../../services/gastosProgramados.service";
import { insertarIngresos, listarIngresos, listarIngresosProgramados } from "../../../services/ingresos.service";
import { actualizarCuota, listarDeudasConCuotas, obtenerCuota } from "../../../services/deudas.service";
import {
  eliminarNotificacion,
  insertarNotificaciones,
  listarNotificaciones,
  marcarNotificacionesLeidas,
} from "../../../services/notificaciones.service";
import { obtenerCotizacion } from "../../../services/cotizaciones.service";

import { verificarPerfil } from "../lib/verificarPerfil";
import { esSuperadmin as calcularEsSuperadmin } from "../lib/roles";
import { calcularSaludFinanciera } from "../../dashboard/lib/saludFinanciera";
import { construirAlertasVencimiento, tarjetasParaCierreAutomatico } from "../../deudas/lib/alertasVencimiento";
import { cerrarCicloTarjeta } from "../../deudas/lib/cerrarCicloTarjeta";
import { sueldosPendientesDeAcreditar } from "../../ingresos/lib/sueldosProgramados";

/**
 * Estado global del hogar: sesión, perfil, datos (gastos, ingresos, deudas,
 * notificaciones, gastos fijos), sincronización en tiempo real y tareas
 * automáticas (cierre de tarjetas, sueldos fijos y alertas de vencimiento).
 */
export function useHogar() {
  const [session, setSession] = useState(null);
  const [cargandoPerfil, setCargandoPerfil] = useState(false);
  const [usuarios, setUsuarios] = useState([]);
  const [gastos, setGastos] = useState([]);
  const [gastosProgramados, setGastosProgramados] = useState([]);
  const [usuarioActual, setUsuarioActual] = useState(null);
  const [otroUsuario, setOtroUsuario] = useState(null);
  const [ingresos, setIngresos] = useState([]);
  const [deudas, setDeudas] = useState([]);
  const [notificaciones, setNotificaciones] = useState([]);
  const [datosHogar, setDatosHogar] = useState(null);
  const [verificandoHogar, setVerificandoHogar] = useState(true);

  // Sesión inicial + escucha de cambios de autenticación
  useEffect(() => {
    let montado = true;
    // Red de seguridad: nunca dejar la pantalla de carga más de 4 s.
    // (Las banderas sólo pasan de true a false, así que basta con forzarlas.)
    const timerCierre = setTimeout(() => {
      if (montado) {
        setVerificandoHogar(false);
        setCargandoPerfil(false);
      }
    }, 4000);

    const inicializar = async () => {
      try {
        const {
          data: { session: s },
        } = await obtenerSesion();
        if (!montado) return;
        setSession(s);
        if (s) {
          setCargandoPerfil(true);
          const perfil = await verificarPerfil(s.user.id, s.user.email);
          if (montado) {
            setDatosHogar(perfil);
            setUsuarioActual(perfil);
            setCargandoPerfil(false);
            // Cargar inmediatamente los datos (gastos, deudas, ingresos)
            if (perfil?.espacio_id) {
              const eid = perfil.espacio_id;
              const [resG, resI, resD, resN, resP] = await Promise.all([
                listarGastos(eid),
                listarIngresos(eid),
                listarDeudasConCuotas(eid),
                listarNotificaciones(eid),
                listarGastosProgramados(eid),
              ]);
              if (resG.data) setGastos(resG.data);
              if (resI.data) setIngresos(resI.data);
              if (resD.data) setDeudas(resD.data);
              if (resN.data) setNotificaciones(resN.data);
              if (resP.data) setGastosProgramados(resP.data);
            }
          }
        }
      } catch {
        if (montado) setDatosHogar(null);
      } finally {
        if (montado) {
          setVerificandoHogar(false);
          clearTimeout(timerCierre);
        }
      }
    };
    inicializar();

    const {
      data: { subscription },
    } = escucharCambiosSesion(async (event, s) => {
      if (event === "SIGNED_OUT") {
        setSession(null);
        setDatosHogar(null);
        setUsuarioActual(null);
      } else if (event === "TOKEN_REFRESHED" && s) {
        setSession(s);
      } else if (s && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
        setSession(s);
        if (montado) {
          setCargandoPerfil(true);
          verificarPerfil(s.user.id, s.user.email).then((perfil) => {
            if (montado) {
              setDatosHogar(perfil);
              setUsuarioActual(perfil);
              setCargandoPerfil(false);
            }
          });
        }
      }
    });

    return () => {
      montado = false;
      subscription.unsubscribe();
      clearTimeout(timerCierre);
    };
  }, []);

  const obtenerDatos = useCallback(async () => {
    if (!datosHogar || !session || !datosHogar.espacio_id) return;
    const eid = datosHogar.espacio_id;
    const usuarioId = session.user.id;

    try {
      const { data: miembros } = await listarMiembros(eid);
      if (miembros) {
        setUsuarios(miembros);
        const logueado = miembros.find((u) => u.id === usuarioId);
        if (logueado) {
          setUsuarioActual(logueado);
          setOtroUsuario(miembros.find((u) => u.id !== logueado.id));
        }
      }

      const [resG, resI, resD, resN, resP, resIP] = await Promise.all([
        listarGastos(eid),
        listarIngresos(eid),
        listarDeudasConCuotas(eid),
        listarNotificaciones(eid),
        listarGastosProgramados(eid),
        listarIngresosProgramados(eid),
      ]);

      const deudasFinal = resD.data || [];
      const ingresosFinal = resI.data || [];

      // Renderizar la UI antes de procesar las tareas automáticas
      if (resG.data) setGastos(resG.data);
      setIngresos(ingresosFinal);
      setDeudas(deudasFinal);
      if (resN.data) setNotificaciones(resN.data);
      if (resP.data) setGastosProgramados(resP.data);

      // Tareas automáticas en segundo plano
      setTimeout(async () => {
        let huboCambiosDeudas = false;
        let huboCambiosIngresos = false;
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);

        // Cierre automático de tarjetas
        for (const { deuda, cuota } of tarjetasParaCierreAutomatico(deudasFinal, hoy)) {
          try {
            await cerrarCicloTarjeta(deuda, cuota, eid, usuarioId, { verificarArchivo: true });
            huboCambiosDeudas = true;
          } catch (errAuto) {
            console.error("Error al auto cerrar ciclo:", errAuto);
          }
        }

        // Acreditación de sueldos programados
        if (resIP.data) {
          for (const prog of sueldosPendientesDeAcreditar(resIP.data, ingresosFinal, usuarioId, hoy)) {
            try {
              const tasa = prog.moneda === "PYG" ? 1 : await obtenerCotizacion(prog.moneda, "PYG");
              await insertarIngresos([
                {
                  usuario_id: prog.usuario_id,
                  espacio_id: eid,
                  concepto: `[FIJO] ${prog.descripcion}`,
                  monto: prog.monto,
                  moneda: prog.moneda,
                  tasa_cambio: tasa,
                  mes: hoy.getMonth() + 1,
                  anio: hoy.getFullYear(),
                },
              ]);
              huboCambiosIngresos = true;
            } catch (errAutoI) {
              console.error("Error al auto acreditar sueldo:", errAutoI);
            }
          }
        }

        if (huboCambiosDeudas) {
          const { data: updatedDeudas } = await listarDeudasConCuotas(eid);
          if (updatedDeudas) setDeudas(updatedDeudas);
        }

        if (huboCambiosIngresos) {
          const { data: updatedIngresos } = await listarIngresos(eid);
          if (updatedIngresos) setIngresos(updatedIngresos);
        }

        // Alertas de vencimiento próximas
        const alertasNuevas = construirAlertasVencimiento(deudasFinal, resN.data || [], { espacioId: eid, usuarioId });
        if (alertasNuevas.length > 0) await insertarNotificaciones(alertasNuevas);
      }, 50);
    } catch {
      // Error de red: se mantiene el último estado conocido
    }
  }, [datosHogar, session]);

  // Tiempo real: la pareja ve los cambios del otro al instante
  useEffect(() => {
    if (!datosHogar?.espacio_id) return;
    return suscribirCambiosEspacio(datosHogar.espacio_id, () => obtenerDatos());
  }, [datosHogar?.espacio_id, obtenerDatos]);

  const saludFinanciera = useMemo(
    () => calcularSaludFinanciera({ usuarioActual, deudas, ingresos, gastos, gastosProgramados }),
    [usuarioActual, deudas, ingresos, gastos, gastosProgramados]
  );

  const markNotisAsRead = async () => {
    if (!datosHogar) return;
    await marcarNotificacionesLeidas(datosHogar.espacio_id);
    obtenerDatos();
  };

  const responderSolicitud = async (noti, aceptada) => {
    const toastId = toast.loading(aceptada ? "Procesando ayuda..." : "Rechazando solicitud...");
    try {
      const { cuota_id, monto, moneda } = noti.metadata;
      if (aceptada) {
        const { data: cuota } = await obtenerCuota(cuota_id);
        const nuevoAbono = Number(cuota.monto_abonado) + Number(monto);
        const pagada = nuevoAbono >= cuota.monto_cuota;
        await actualizarCuota(cuota_id, {
          monto_abonado: nuevoAbono,
          estado: pagada ? "pagado" : "pendiente",
          pagador_id: usuarioActual.id,
          fecha_pago: new Date().toISOString(),
        });
        await insertarGastos([
          {
            espacio_id: datosHogar.espacio_id,
            usuario_id: usuarioActual.id,
            pagador_id: usuarioActual.id,
            concepto: `Ayuda Pago Deuda: ${noti.mensaje.split('"')[1]}`,
            monto: monto,
            moneda: moneda,
            categoria: "Ayuda Familiar",
            para_quien: "Pareja",
          },
        ]);
        toast.success("¡Ayuda registrada con éxito! ❤️", { id: toastId });
      } else {
        await insertarNotificaciones([
          {
            espacio_id: datosHogar.espacio_id,
            usuario_id: noti.metadata.solicitante_id,
            titulo: "Solicitud Rechazada",
            mensaje: `${usuarioActual.nombre} no puede ayudarte con este pago ahora.`,
            tipo: "info",
          },
        ]);
        toast.error("Solicitud rechazada", { id: toastId });
      }
      await eliminarNotificacion(noti.id);
      obtenerDatos();
    } catch {
      toast.error("Error al procesar", { id: toastId });
    }
  };

  const getNombreUsuario = (id) => {
    const u = usuarios.find((u) => u.id === id);
    return u ? u.nombre : "Usuario";
  };

  const esSuperadmin = useMemo(() => calcularEsSuperadmin(datosHogar, session), [datosHogar, session]);

  useEffect(() => {
    if (session && !verificandoHogar && datosHogar) obtenerDatos();
  }, [session, verificandoHogar, datosHogar, obtenerDatos]);

  return {
    session,
    cargando: verificandoHogar || cargandoPerfil,
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
  };
}
