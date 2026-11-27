import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { toast } from "react-hot-toast";

import { vigenciaContexto } from "../../../services/espacios.service";
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
export function useHogar({ session, datosHogar }) {
  const montado = useRef(false);
  useEffect(() => { montado.current = true; return () => { montado.current = false; }; }, []);
  const [usuarios, setUsuarios] = useState([]);
  const [gastos, setGastos] = useState([]);
  const [gastosProgramados, setGastosProgramados] = useState([]);
  const [usuarioActual, setUsuarioActual] = useState(datosHogar);
  const [otroUsuario, setOtroUsuario] = useState(null);
  const [ingresos, setIngresos] = useState([]);
  const [deudas, setDeudas] = useState([]);
  const [notificaciones, setNotificaciones] = useState([]);
  const obtenerDatos = useCallback(async () => {
    if (!datosHogar || !session || !datosHogar.espacio_id) return;
    const eid = datosHogar.espacio_id;
    const usuarioId = session.user.id;
    const contextoVigente = vigenciaContexto();
    const vigente = () => montado.current && contextoVigente();
    if (!vigente()) return;

    try {
      const { data: miembros } = await listarMiembros(eid);
      if (!vigente()) return;
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

      if (!vigente()) return;
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
        if (!vigente()) return;
        let huboCambiosDeudas = false;
        let huboCambiosIngresos = false;
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);

        // Cierre automático de tarjetas
        for (const { deuda, cuota } of tarjetasParaCierreAutomatico(deudasFinal, hoy)) {
          try {
            if (!vigente()) return;
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
              if (!vigente()) return;
              const tasa = prog.moneda === "PYG" ? 1 : await obtenerCotizacion(prog.moneda, "PYG");
              if (!vigente()) return;
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
          if (!vigente()) return;
          if (updatedDeudas) setDeudas(updatedDeudas);
        }

        if (huboCambiosIngresos) {
          const { data: updatedIngresos } = await listarIngresos(eid);
          if (!vigente()) return;
          if (updatedIngresos) setIngresos(updatedIngresos);
        }

        // Alertas de vencimiento próximas
        const alertasNuevas = construirAlertasVencimiento(deudasFinal, resN.data || [], { espacioId: eid, usuarioId });
        if (!vigente()) return;
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
    if (!session || !datosHogar) return;
    const timer = setTimeout(obtenerDatos, 0);
    return () => clearTimeout(timer);
  }, [session, datosHogar, obtenerDatos]);

  return {
    session,
    cargando: false,
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
