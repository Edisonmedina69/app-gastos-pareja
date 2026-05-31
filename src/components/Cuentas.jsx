import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { toast } from 'react-hot-toast';
import { formatearNumero, formatarInput, desformatearInput, formatearFechaCorta, obtenerFechaCierreExacta, obtenerPlanAmortizacion } from '../utils/formatters';
import { motion, AnimatePresence } from "framer-motion";
import { 
  CreditCard, Plus, CheckCircle, X, Loader2, Sparkles, 
  Lock, Users, Send, Archive, AlertTriangle, ChevronDown, ChevronUp, Calendar, Trash2, Hash, Edit2, Percent, Clock
} from 'lucide-react';

export default function Cuentas({
  usuarioActual,
  otroUsuario,
  usuarios,
  deudas,
  gastos,
  ingresos,
  monedaGlobal,
  obtenerDatos,
  datosHogar,
  saludFinanciera,
  gastosProgramados
}) {
  // Modal & Form State
  const [mostrarModal, setMostrarModal] = useState(false);
  const [mostrarModalPago, setMostrarModalPago] = useState(false);
  const [pagoSeleccionado, setPagoSeleccionado] = useState(null);
  const [deudaEditandoId, setDeudaEditandoId] = useState(null);
  const [mostrarModalCompra, setMostrarModalCompra] = useState(false);
  const [compraSeleccionada, setCompraSeleccionada] = useState(null);
  const [compraConcepto, setCompraConcepto] = useState('');
  const [compraMontoFormateado, setCompraMontoFormateado] = useState('');
  const [compraCategoria, setCompraCategoria] = useState('Otros');
  
  // New Debt Fields
  const [tipoDeuda, setTipoDeuda] = useState("fija"); 
  const [alcanceDeuda, setAlcanceDeuda] = useState("familiar"); // individual | familiar
  const [titulo, setTitulo] = useState('');
  const [nroTarjeta, setNroTarjeta] = useState('');
  const [tasaInteres, setTasaInteres] = useState(''); // Tasa de interés anual (%)
  const [montoTotalFormateado, setMontoTotalFormateado] = useState('');
  const [lineaCreditoFormateada, setLineaCreditoFormateada] = useState('');
  const [pagoMinimoFormateado, setPagoMinimoFormateado] = useState('');
  const [cargosMensualesFormateado, setCargosMensualesFormateado] = useState('');
  const [cantidadCuotas, setCantidadCuotas] = useState(1);
  const [cuotasPagadas, setCuotasPagadas] = useState(0); 
  const [diaVencimiento, setDiaVencimiento] = useState("5");
  const [fechaCierreTarjeta, setFechaCierreTarjeta] = useState("25");
  const [monedaDeuda, setMonedaDeuda] = useState(monedaGlobal);
  
  // UI State
  const [guardando, setGuardando] = useState(false);
  const [deudaExpandida, setDeudaExpandida] = useState(null);
  const [pestana, setPestana] = useState('activas'); // activas | archivadas

  // IA State
  const [analizandoIA, setAnalizandoIA] = useState(false);
  const [sugerenciaIA, setSugerenciaIA] = useState(null);

  // Gastos Fijos State
  const [mostrarModalFijo, setMostrarModalFijo] = useState(false);
  const [idFijoEditando, setIdFijoEditando] = useState(null);
  
  // Form State Gasto Fijo
  const [fijoConcepto, setFijoConcepto] = useState('');
  const [fijoMontoFormateado, setFijoMontoFormateado] = useState('');
  const [fijoMoneda, setFijoMoneda] = useState(monedaGlobal);
  const [fijoDiaRecurrencia, setFijoDiaRecurrencia] = useState('5');
  const [fijoCategoria, setFijoCategoria] = useState('Casa');
  const [fijoParaQuien, setFijoParaQuien] = useState('Ambos');

  // Pago Gasto Fijo State
  const [mostrarModalPagarFijo, setMostrarModalPagarFijo] = useState(false);
  const [gastoFijoAPagar, setGastoFijoAPagar] = useState(null);
  const [pagarMontoFormateado, setPagarMontoFormateado] = useState('');
  const [pagarMoneda, setPagarMoneda] = useState('PYG');
  const [pagarPagadorId, setPagarPagadorId] = useState('');
  const [pagarParaQuien, setPagarParaQuien] = useState('Ambos');

  // Previsiones State
  const [mostrarModalPrevision, setMostrarModalPrevision] = useState(false);
  const [idPrevisionEditando, setIdPrevisionEditando] = useState(null);
  const [previsionConcepto, setPrevisionConcepto] = useState('');
  const [previsionMontoFormateado, setPrevisionMontoFormateado] = useState('');
  const [previsionMoneda, setPrevisionMoneda] = useState(monedaGlobal);
  const [previsionParaQuien, setPrevisionParaQuien] = useState('Ambos');

  useEffect(() => {
    if (mostrarModalFijo && !idFijoEditando) {
      setFijoMoneda(monedaGlobal);
    }
  }, [mostrarModalFijo, monedaGlobal, idFijoEditando]);

  useEffect(() => {
    if (mostrarModalPrevision && !idPrevisionEditando) {
      setPrevisionMoneda(monedaGlobal);
    }
  }, [mostrarModalPrevision, monedaGlobal, idPrevisionEditando]);

  const resetFormPrevision = () => {
    setIdPrevisionEditando(null);
    setPrevisionConcepto('');
    setPrevisionMontoFormateado('');
    setPrevisionMoneda(monedaGlobal);
    setPrevisionParaQuien('Ambos');
  };

  const abrirEdicionPrevision = (prev) => {
    const nombreLimpio = prev.concepto.replace("[PRESUPUESTO] ", "");
    setIdPrevisionEditando(prev.id);
    setPrevisionConcepto(nombreLimpio);
    setPrevisionMontoFormateado(formatarInput(prev.monto));
    setPrevisionMoneda(prev.moneda);
    setPrevisionParaQuien(prev.para_quien);
    setMostrarModalPrevision(true);
  };

  const guardarPrevision = async (e) => {
    e.preventDefault();
    const montoLimpio = previsionMontoFormateado ? desformatearInput(previsionMontoFormateado) : 0;
    if (guardando || !usuarioActual || !datosHogar) return;
    setGuardando(true);
    const toastId = toast.loading("Guardando previsión...");
    try {
      const conceptoFinal = `[PRESUPUESTO] ${previsionConcepto.trim()}`;
      if (idPrevisionEditando) {
        const { error } = await supabase
          .from("gastos_programados")
          .update({
            concepto: conceptoFinal,
            monto: montoLimpio,
            moneda: previsionMoneda,
            dia_recurrencia: 1,
            categoria: "Otros",
            para_quien: previsionParaQuien
          })
          .eq("id", idPrevisionEditando);
        if (error) throw error;
        toast.success("¡Previsión ajustada! 📊", { id: toastId });
      } else {
        const { error } = await supabase
          .from("gastos_programados")
          .insert([{
            espacio_id: datosHogar.espacio_id,
            usuario_id: usuarioActual.id,
            concepto: conceptoFinal,
            monto: montoLimpio,
            moneda: previsionMoneda,
            dia_recurrencia: 1,
            categoria: "Otros",
            para_quien: previsionParaQuien
          }]);
        if (error) throw error;
        toast.success("¡Previsión creada! 🎯", { id: toastId });
      }
      setMostrarModalPrevision(false);
      resetFormPrevision();
      obtenerDatos();
    } catch (err) {
      toast.error(err.message, { id: toastId });
    } finally {
      setGuardando(false);
    }
  };

  const eliminarPrevision = async (id, concepto) => {
    const nombreLimpio = concepto.replace("[PRESUPUESTO] ", "");
    if (window.confirm(`¿Seguro que querés eliminar la previsión de gasto "${nombreLimpio}"?`)) {
      try {
        const { error } = await supabase.from("gastos_programados").delete().eq("id", id);
        if (error) throw error;
        toast.success("Previsión eliminada 🗑️");
        obtenerDatos();
      } catch (e) {
        toast.error("Error al eliminar: " + e.message);
      }
    }
  };

  const calcularGastoPrevision = (nombrePrevision, monedaPrevision) => {
    const ahora = new Date();
    const mesActual = ahora.getMonth();
    const anioActual = ahora.getFullYear();

    return gastos?.filter(g => {
      const fG = new Date(g.fecha || g.created_at);
      const coincideMes = fG.getMonth() === mesActual && fG.getFullYear() === anioActual;
      if (!coincideMes) return false;

      const coincideConcepto = g.concepto && g.concepto.startsWith(`[B: ${nombrePrevision}]`);
      const coincideMoneda = g.moneda === monedaPrevision;

      return coincideConcepto && coincideMoneda;
    }).reduce((acc, g) => acc + Number(g.monto), 0) || 0;
  };

  const obtenerNombreDestinatario = (p) => {
    if (p.para_quien === 'Ambos') return 'Ambos';
    const creador = usuarios?.find(u => u.id === p.usuario_id);
    const otro = usuarios?.find(u => u.id !== p.usuario_id);
    if (p.para_quien === 'Yo') {
      return creador ? creador.nombre : 'Yo';
    }
    if (p.para_quien === 'Pareja') {
      return otro ? otro.nombre : 'Pareja';
    }
    return p.para_quien;
  };

  const preCargarPlantillas = async () => {
    if (!datosHogar?.espacio_id || !usuarioActual?.id) return;
    const toastId = toast.loading("Cargando plantilla de supervivencia...");
    const defaults = [
      { concepto: "💧 Agua (ESSAP)", monto: 0, moneda: "PYG", dia_recurrencia: 10, categoria: "Casa", para_quien: "Ambos", espacio_id: datosHogar.espacio_id, usuario_id: usuarioActual.id },
      { concepto: "⚡ Luz (ANDE)", monto: 0, moneda: "PYG", dia_recurrencia: 10, categoria: "Casa", para_quien: "Ambos", espacio_id: datosHogar.espacio_id, usuario_id: usuarioActual.id },
      { concepto: "🗑️ Tasa de Basura", monto: 30000, moneda: "PYG", dia_recurrencia: 5, categoria: "Casa", para_quien: "Ambos", espacio_id: datosHogar.espacio_id, usuario_id: usuarioActual.id },
      { concepto: "🌐 Internet", monto: 150000, moneda: "PYG", dia_recurrencia: 5, categoria: "Casa", para_quien: "Ambos", espacio_id: datosHogar.espacio_id, usuario_id: usuarioActual.id },
      { concepto: "🛒 Supermercado / Comida", monto: 0, moneda: "PYG", dia_recurrencia: 5, categoria: "Supermercado", para_quien: "Ambos", espacio_id: datosHogar.espacio_id, usuario_id: usuarioActual.id }
    ];
    const timeoutId = setTimeout(() => {
      toast.error("Tiempo de espera agotado al pre-cargar plantilla.", { id: toastId });
    }, 8000);
    try {
      const { error } = await supabase.from('gastos_programados').insert(defaults);
      clearTimeout(timeoutId);
      if (error) throw error;
      toast.success("¡Plantilla básica cargada! 🏠✨", { id: toastId });
      obtenerDatos();
    } catch (e) {
      clearTimeout(timeoutId);
      toast.error("Error al cargar: " + e.message, { id: toastId });
    }
  };

  const guardarGastoFijo = async (e) => {
    e.preventDefault();
    const montoLimpio = fijoMontoFormateado ? desformatearInput(fijoMontoFormateado) : 0;
    if (guardando || !usuarioActual || !datosHogar) return;
    setGuardando(true);
    const toastId = toast.loading("Procesando compromiso fijo...");
    const timeoutId = setTimeout(() => {
      setGuardando(false);
      toast.error("Tiempo de espera agotado. Intentá de nuevo.", { id: toastId });
    }, 8000);
    try {
      if (idFijoEditando) {
        const { error } = await supabase
          .from("gastos_programados")
          .update({
            concepto: fijoConcepto.trim(),
            monto: montoLimpio,
            dia_recurrencia: parseInt(fijoDiaRecurrencia),
            categoria: fijoCategoria,
            para_quien: fijoParaQuien
          })
          .eq("id", idFijoEditando);
        clearTimeout(timeoutId);
        if (error) throw error;
        toast.success("¡Gasto fijo ajustado! 📈", { id: toastId });
      } else {
        const { error } = await supabase
          .from("gastos_programados")
          .insert([{
            espacio_id: datosHogar.espacio_id,
            usuario_id: usuarioActual.id,
            concepto: fijoConcepto.trim(),
            monto: montoLimpio,
            moneda: fijoMoneda,
            dia_recurrencia: parseInt(fijoDiaRecurrencia),
            categoria: fijoCategoria,
            para_quien: fijoParaQuien
          }]);
        clearTimeout(timeoutId);
        if (error) throw error;
        toast.success("¡Gasto fijo programado! 📅", { id: toastId });
      }
      setMostrarModalFijo(false);
      resetFormFijo();
      obtenerDatos();
    } catch (err) {
      clearTimeout(timeoutId);
      toast.error(err.message, { id: toastId });
    } finally {
      setGuardando(false);
    }
  };

  const eliminarGastoFijo = async (id, concepto) => {
    if (window.confirm(`¿Eliminar la programación del gasto "${concepto}"?`)) {
      try {
        const { error } = await supabase.from("gastos_programados").delete().eq("id", id);
        if (error) throw error;
        toast.success("Programación eliminada");
        obtenerDatos();
      } catch (e) {
        toast.error("Error al eliminar");
      }
    }
  };

  const abrirEdicionFijo = (f) => {
    setIdFijoEditando(f.id);
    setFijoConcepto(f.concepto);
    setFijoMontoFormateado(formatarInput(f.monto));
    setFijoMoneda(f.moneda);
    setFijoDiaRecurrencia(f.dia_recurrencia.toString());
    setFijoCategoria(f.categoria);
    setFijoParaQuien(f.para_quien);
    setMostrarModalFijo(true);
  };

  const resetFormFijo = () => {
    setIdFijoEditando(null);
    setFijoConcepto('');
    setFijoMontoFormateado('');
    setFijoDiaRecurrencia('5');
    setFijoCategoria('Casa');
    setFijoParaQuien('Ambos');
  };

  const abrirPagoFijo = (f) => {
    setGastoFijoAPagar(f);
    setPagarMontoFormateado(f.monto > 0 ? formatarInput(f.monto) : '');
    setPagarMoneda(f.moneda);
    setPagarPagadorId(usuarioActual?.id || '');
    setPagarParaQuien(f.para_quien);
    setMostrarModalPagarFijo(true);
  };

  const registrarPagoGastoFijo = async (e) => {
    e.preventDefault();
    const montoLimpio = desformatearInput(pagarMontoFormateado);
    if (!montoLimpio || !gastoFijoAPagar || !usuarioActual || !datosHogar) return;
    const toastId = toast.loading("Registrando pago de servicio...");
    try {
      const { error } = await supabase.from("gastos").insert([{
        espacio_id: datosHogar.espacio_id,
        usuario_id: usuarioActual.id,
        pagador_id: pagarPagadorId,
        concepto: `[FIJO] ${gastoFijoAPagar.concepto}`,
        monto: montoLimpio,
        moneda: pagarMoneda,
        categoria: gastoFijoAPagar.categoria,
        para_quien: pagarParaQuien
      }]);
      if (error) throw error;
      toast.success("¡Pago registrado y guardado! 💸", { id: toastId });
      setMostrarModalPagarFijo(false);
      setGastoFijoAPagar(null);
      obtenerDatos();
    } catch (err) {
      toast.error(err.message, { id: toastId });
    }
  };

  const verificarSiFuePagadoEsteMes = (fijo) => {
    return gastos?.some(g => 
      g.concepto === `[FIJO] ${fijo.concepto}` && 
      new Date(g.fecha || g.created_at).getMonth() === new Date().getMonth() &&
      new Date(g.fecha || g.created_at).getFullYear() === new Date().getFullYear()
    );
  };

  useEffect(() => {
    if (mostrarModal) {
      setMonedaDeuda(monedaGlobal);
      if (tipoDeuda === 'tarjeta_credito') setCantidadCuotas(1);
    }
  }, [mostrarModal, monedaGlobal, tipoDeuda]);

  const projectedHealth = () => {
    const montoTotalNum = desformatearInput(montoTotalFormateado);
    if (!montoTotalNum || !saludFinanciera.ingresos) return saludFinanciera.indice;
    const cuotaNueva = montoTotalNum / (parseInt(cantidadCuotas) || 1);
    const impact = alcanceDeuda === 'individual' ? cuotaNueva : cuotaNueva * 0.5;
    const cargaNueva = saludFinanciera.carga + impact;
    return (cargaNueva / saludFinanciera.ingresos) * 100;
  };

  const proyectado = projectedHealth();
  const zonaPeligro = proyectado > 40;

  function ajustarDiaHabil(fecha) {
    const d = fecha.getDay();
    const nf = new Date(fecha);
    if (d === 0) nf.setDate(nf.getDate() + 1);
    else if (d === 6) nf.setDate(nf.getDate() + 2);
    return nf;
  }

  const resetForm = () => {
    setTitulo(''); setNroTarjeta(''); setTasaInteres(''); setMontoTotalFormateado(''); setLineaCreditoFormateada(''); setPagoMinimoFormateado(''); setCargosMensualesFormateado(''); setCantidadCuotas(1); setCuotasPagadas(0);
    setTipoDeuda("fija"); setAlcanceDeuda("familiar"); setDiaVencimiento("5"); setFechaCierreTarjeta("25");
    setDeudaEditandoId(null);
  };

  const iniciarEdicionDeuda = (d) => {
    setDeudaEditandoId(d.id);
    setTitulo(d.titulo);
    setTipoDeuda(d.tipo);
    setAlcanceDeuda(d.alcance);
    setNroTarjeta(d.nro_tarjeta || '');
    setTasaInteres(d.tasa_interes?.toString() || '');
    setMonedaDeuda(d.moneda);
    
    // Dia vencimiento
    const primerVencimiento = d.cuotas_detalle?.[0]?.fecha_vencimiento;
    if (primerVencimiento) {
      const parts = primerVencimiento.split("-");
      if (parts.length === 3) {
        setDiaVencimiento(parseInt(parts[2], 10).toString());
      }
    } else {
      setDiaVencimiento("5");
    }

    setFechaCierreTarjeta(d.fecha_cierre_tarjeta?.toString() || "25");

    const totalMontoVal = d.cuotas_detalle?.reduce((acc, c) => acc + Number(c.monto_cuota), 0) || 0;
    setMontoTotalFormateado(formatarInput(totalMontoVal));

    setLineaCreditoFormateada(formatarInput(d.linea_credito_total));
    setPagoMinimoFormateado(formatarInput(d.cuotas_detalle?.[0]?.pago_minimo || 0));
    setCargosMensualesFormateado(formatarInput(d.cuotas_detalle?.[0]?.cargos || 0));
    setCantidadCuotas(d.cuotas_detalle?.length || 1);
    
    const yaPagadasCount = d.cuotas_detalle?.filter(c => c.estado === 'pagado').length || 0;
    setCuotasPagadas(yaPagadasCount);

    setMostrarModal(true);
  };

  async function guardarDeudaPro(e) {
    e.preventDefault();
    if (!usuarioActual || !datosHogar) return;
    setGuardando(true);
    const toastId = toast.loading(deudaEditandoId ? "Actualizando compromiso..." : "Registrando compromiso financiero...");

    try {
      const eid = datosHogar.espacio_id;
      const numCuotas = parseInt(cantidadCuotas) || 1;
      const yaPagadas = parseInt(cuotasPagadas) || 0;
      const totalMonto = desformatearInput(montoTotalFormateado);
      const lineaTotal = desformatearInput(lineaCreditoFormateada);
      const montoCuota = totalMonto / numCuotas;

      let maestraId = deudaEditandoId;

      if (deudaEditandoId) {
        const { error: errM } = await supabase
          .from("deudas_maestras")
          .update({
            titulo: titulo.trim(), tipo: tipoDeuda,
            alcance: alcanceDeuda, permite_pago_parcial: tipoDeuda !== 'fija', moneda: monedaDeuda,
            linea_credito_total: lineaTotal || 0,
            linea_credito_disponible: (lineaTotal || 0) - (tipoDeuda === 'tarjeta_credito' ? totalMonto : 0),
            fecha_cierre_tarjeta: tipoDeuda === 'tarjeta_credito' ? parseInt(fechaCierreTarjeta) : null,
            nro_tarjeta: tipoDeuda === 'tarjeta_credito' ? nroTarjeta.trim() : null,
            estado: yaPagadas >= numCuotas ? 'cerrada' : 'activa',
            tasa_interes: (tipoDeuda === 'tarjeta_credito' || tipoDeuda === 'fija') ? parseFloat(tasaInteres) || 0 : 0
          })
          .eq("id", deudaEditandoId);

        if (errM) throw errM;

        const { error: errDel } = await supabase
          .from("cuotas_detalle")
          .delete()
          .eq("deuda_maestra_id", deudaEditandoId);

        if (errDel) throw errDel;
      } else {
        const { data: maestra, error: errM } = await supabase
          .from("deudas_maestras")
          .insert([{
            espacio_id: eid, creador_id: usuarioActual.id, titulo: titulo.trim(), tipo: tipoDeuda,
            alcance: alcanceDeuda, permite_pago_parcial: tipoDeuda !== 'fija', moneda: monedaDeuda,
            linea_credito_total: lineaTotal || 0,
            linea_credito_disponible: (lineaTotal || 0) - (tipoDeuda === 'tarjeta_credito' ? totalMonto : 0),
            fecha_cierre_tarjeta: tipoDeuda === 'tarjeta_credito' ? parseInt(fechaCierreTarjeta) : null,
            nro_tarjeta: tipoDeuda === 'tarjeta_credito' ? nroTarjeta.trim() : null,
            estado: yaPagadas >= numCuotas ? 'cerrada' : 'activa',
            tasa_interes: (tipoDeuda === 'tarjeta_credito' || tipoDeuda === 'fija') ? parseFloat(tasaInteres) || 0 : 0
          }])
          .select().single();

        if (errM) throw errM;
        maestraId = maestra.id;
      }

      const cuotas = [];
      const fechaBase = new Date();
      const hoyDia = fechaBase.getDate();
      const mesProximo = parseInt(diaVencimiento) < hoyDia ? 1 : 0;
      const mesInicio = fechaBase.getMonth() + mesProximo - yaPagadas;

      for (let i = 1; i <= numCuotas; i++) {
        let fv = new Date(fechaBase.getFullYear(), mesInicio + (i - 1), parseInt(diaVencimiento));
        fv = ajustarDiaHabil(fv);
        
        const esPagada = i <= yaPagadas;

        cuotas.push({
          deuda_maestra_id: maestraId, espacio_id: eid, numero_cuota: i, monto_cuota: montoCuota,
          monto_abonado: esPagada ? montoCuota : 0,
          cargos: tipoDeuda === 'fija' ? (desformatearInput(cargosMensualesFormateado) || 0) : 0,
          pago_minimo: i === 1 ? (desformatearInput(pagoMinimoFormateado) || 0) : 0,
          fecha_vencimiento: `${fv.getFullYear()}-${String(fv.getMonth() + 1).padStart(2, '0')}-${String(fv.getDate()).padStart(2, '0')}`,
          estado: esPagada ? 'pagado' : 'pendiente',
          fecha_pago: esPagada ? new Date().toISOString() : null,
          pagador_id: esPagada ? usuarioActual.id : null
        });
      }

      await supabase.from("cuotas_detalle").insert(cuotas);
      toast.success(deudaEditandoId ? "¡Deuda Pro actualizada con éxito! 📝" : "¡Deuda Pro registrada con éxito! 📝", { id: toastId });
      setMostrarModal(false); obtenerDatos(); resetForm();
    } catch (err) { toast.error("Error: " + err.message, { id: toastId }); }
    finally { setGuardando(false); }
  }

  async function procesarAbono(montoAbono, monedaAbono, tasaManual) {
    if (!pagoSeleccionado) return;
    const { cuota, maestra } = pagoSeleccionado;
    const toastId = toast.loading("Procesando pago...");
    try {
      let mMonedaDeuda = montoAbono;
      if (monedaAbono !== maestra.moneda) {
        if (!tasaManual) throw new Error("Debes ingresar la cotización manual");
        mMonedaDeuda = montoAbono * parseFloat(tasaManual);
      }
      const nAbonoTotal = Number(cuota.monto_abonado) + mMonedaDeuda;
      const estaPagado = nAbonoTotal >= cuota.monto_cuota;
      await supabase.from("cuotas_detalle").update({
        monto_abonado: nAbonoTotal, estado: estaPagado ? 'pagado' : 'pendiente',
        fecha_pago: new Date().toISOString(), pagador_id: usuarioActual.id
      }).eq("id", cuota.id);
      if (maestra.tipo === 'tarjeta_credito') {
        await supabase.from("deudas_maestras").update({ 
          linea_credito_disponible: Number(maestra.linea_credito_disponible) + mMonedaDeuda 
        }).eq("id", maestra.id);
      }
      await supabase.from("gastos").insert([{
        concepto: `Pago Deuda: ${maestra.titulo}`, monto: montoAbono, categoria: "Pago Tarjeta de Crédito",
        usuario_id: usuarioActual.id, pagador_id: usuarioActual.id, para_quien: "Ambos", moneda: monedaAbono, espacio_id: datosHogar.espacio_id
      }]);
      const { data: check } = await supabase.from('cuotas_detalle').select('estado').eq('deuda_maestra_id', maestra.id);
      if (maestra.tipo !== 'tarjeta_credito' && check.every(c => c.estado === 'pagado')) {
        await supabase.from('deudas_maestras').update({ estado: 'cerrada' }).eq('id', maestra.id);
      }
      toast.success("Pago registrado!", { id: toastId });
      setMostrarModalPago(false); setPagoSeleccionado(null); obtenerDatos();
    } catch (err) { toast.error(err.message, { id: toastId }); }
  }

  const resetFormCompra = () => {
    setCompraConcepto('');
    setCompraMontoFormateado('');
    setCompraCategoria('Otros');
    setCompraSeleccionada(null);
  };

  async function procesarCompraTarjeta(e) {
    e.preventDefault();
    if (!compraSeleccionada || !usuarioActual || !datosHogar) return;
    const montoCompra = desformatearInput(compraMontoFormateado);
    if (!montoCompra || montoCompra <= 0) return;
    
    const toastId = toast.loading("Registrando compra con tarjeta...");
    setGuardando(true);
    
    try {
      const eid = datosHogar.espacio_id;
      const { error: errG } = await supabase.from("gastos").insert([{
        concepto: `${compraConcepto.trim()} (Tarjeta: ${compraSeleccionada.titulo})`,
        monto: montoCompra,
        categoria: compraCategoria,
        usuario_id: usuarioActual.id,
        pagador_id: usuarioActual.id,
        para_quien: compraSeleccionada.alcance === 'familiar' ? 'Ambos' : 'Yo',
        moneda: compraSeleccionada.moneda,
        espacio_id: eid,
        tasa_cambio: 1
      }]);
      
      if (errG) throw errG;
      
      const nuevoDisponible = Number(compraSeleccionada.linea_credito_disponible) - montoCompra;
      const { error: errDM } = await supabase.from("deudas_maestras")
        .update({ linea_credito_disponible: nuevoDisponible })
        .eq("id", compraSeleccionada.id);
        
      if (errDM) throw errDM;
      
      const cuotaActual = compraSeleccionada.cuotas_detalle?.find(c => c.estado === 'pendiente');
      if (cuotaActual) {
        const nuevoMontoCuota = Number(cuotaActual.monto_cuota) + montoCompra;
        const { error: errC } = await supabase.from("cuotas_detalle")
          .update({ monto_cuota: nuevoMontoCuota })
          .eq("id", cuotaActual.id);
          
        if (errC) throw errC;
      }
      
      toast.success("¡Compra registrada y disponible actualizado! 💳", { id: toastId });
      setMostrarModalCompra(false);
      resetFormCompra();
      obtenerDatos();
    } catch (err) {
      toast.error("Error: " + err.message, { id: toastId });
    } finally {
      setGuardando(false);
    }
  }

  async function cerrarCicloTarjeta(deuda, cuota) {
    if (!deuda || !cuota) return;
    const saldoPendiente = Math.max(0, Number(cuota.monto_cuota) - Number(cuota.monto_abonado));
    const interesGenerado = saldoPendiente > 0 && deuda.tasa_interes > 0 
      ? Math.round(saldoPendiente * (deuda.tasa_interes / 100 / 12)) 
      : 0;
      
    const confirmar = window.confirm(
      `¿Confirmas cerrar este ciclo de facturación de "${deuda.titulo}"?\n\n` +
      `• Saldo no pagado: ${formatearNumero(saldoPendiente, deuda.moneda)}\n` +
      (interesGenerado > 0 ? `• Interés generado (${deuda.tasa_interes}%): ${formatearNumero(interesGenerado, deuda.moneda)}\n` : '') +
      `• Nuevo saldo inicial: ${formatearNumero(saldoPendiente + interesGenerado, deuda.moneda)}\n\n` +
      `Se generará la cuota del siguiente mes y se archivará este ciclo.`
    );
    
    if (!confirmar) return;
    
    const toastId = toast.loading("Cerrando ciclo de facturación...");
    try {
      // 1. Mark current cuota as pagado (archived)
      await supabase.from("cuotas_detalle").update({
        estado: 'pagado',
        fecha_pago: new Date().toISOString(),
        pagador_id: usuarioActual.id
      }).eq("id", cuota.id);
      
      // 2. Generate next month's due date safely
      const parts = cuota.fecha_vencimiento.split("-");
      let nextYear = parseInt(parts[0], 10);
      let nextMonth = parseInt(parts[1], 10); // this is 1-based, which represents the next month's 0-based index
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
        espacio_id: datosHogar.espacio_id,
        numero_cuota: cuota.numero_cuota + 1,
        monto_cuota: saldoPendiente + interesGenerado,
        monto_abonado: 0,
        pago_minimo: (saldoPendiente + interesGenerado) * 0.1, // 10% default
        fecha_vencimiento: `${nextVenc.getFullYear()}-${String(nextVenc.getMonth() + 1).padStart(2, '0')}-${String(nextVenc.getDate()).padStart(2, '0')}`,
        estado: 'pendiente'
      };
      
      const { error: errIns } = await supabase.from("cuotas_detalle").insert([nuevaCuota]);
      if (errIns) throw errIns;
      
      toast.success("¡Periodo cerrado y nuevo ciclo iniciado! 💳✨", { id: toastId });
      obtenerDatos();
    } catch (e) {
      toast.error("Error al cerrar ciclo: " + e.message, { id: toastId });
    }
  }

  function ModalCompra() {
    if (!compraSeleccionada) return null;
    return (
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm glass-panel p-6 rounded-3xl border border-white/10 shadow-2xl">
          <h3 className="text-white font-bold text-lg mb-1">Cargar Compra</h3>
          <p className="text-[10px] text-slate-400 font-bold mb-4 uppercase tracking-wider">
            Tarjeta: {compraSeleccionada.titulo}
          </p>
          <form onSubmit={procesarCompraTarjeta} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Concepto / Comercio</label>
              <input 
                type="text" 
                placeholder="Ej: Supermercado, Biggie, combustible..." 
                value={compraConcepto} 
                onChange={(e) => setCompraConcepto(e.target.value)} 
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500/50" 
                required 
              />
            </div>
            
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Monto de la Compra</label>
              <div className="relative">
                <input 
                  type="text" 
                  value={compraMontoFormateado} 
                  onChange={(e) => setCompraMontoFormateado(formatarInput(e.target.value))} 
                  className="w-full bg-slate-900 border border-white/10 rounded-2xl px-4 py-4 text-2xl font-black text-indigo-400 outline-none" 
                  placeholder="0"
                  required
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 font-black uppercase text-xs">{compraSeleccionada.moneda}</span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Categoría</label>
              <select 
                value={compraCategoria} 
                onChange={(e) => setCompraCategoria(e.target.value)} 
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white"
              >
                {["Supermercado", "Casa", "Salud", "Transporte", "Otros"].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="flex gap-2 pt-4">
              <button 
                type="button" 
                onClick={() => { setMostrarModalCompra(false); resetFormCompra(); }} 
                className="flex-1 py-4 bg-white/5 text-slate-400 font-bold rounded-2xl"
              >
                CANCELAR
              </button>
              <button 
                type="submit" 
                disabled={guardando || !compraConcepto || !compraMontoFormateado} 
                className="flex-[2] py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-lg shadow-indigo-600/30"
              >
                REGISTRAR
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    );
  }

  async function eliminarDeuda(maestra) {
    if (window.confirm(`¿Borrar "${maestra.titulo}"?`)) {
      await supabase.from('deudas_maestras').delete().eq('id', maestra.id);
      toast.success("Eliminada"); obtenerDatos();
    }
  }

  function ModalAbono() {
    const [mFormateado, setMFormateado] = useState(() => {
      if (!pagoSeleccionado) return '';
      const { cuota, maestra } = pagoSeleccionado;
      if (maestra.tipo === 'tarjeta_credito') {
        const minPago = cuota.pago_minimo || cuota.monto_cuota;
        return formatarInput(Math.max(0, minPago - Number(cuota.monto_abonado)));
      }
      return formatarInput(cuota.monto_cuota - cuota.monto_abonado);
    });
    const [mon, setMon] = useState(() => {
      if (!pagoSeleccionado) return monedaGlobal;
      return pagoSeleccionado.maestra.moneda;
    });
    const [t, setT] = useState('');

    if (!pagoSeleccionado) return null;
    const { maestra } = pagoSeleccionado;
    const esFija = maestra.tipo === 'fija';
    const reqT = mon !== maestra.moneda;

    return (
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm glass-panel p-6 rounded-3xl border border-white/10 shadow-2xl">
          <h3 className="text-white font-bold text-lg mb-1">Abonar a {maestra.titulo}</h3>
          <p className="text-[10px] text-slate-400 font-bold mb-3 uppercase tracking-wider">
            Cuota {pagoSeleccionado.cuota.numero_cuota} • Vence: {formatearFechaCorta(pagoSeleccionado.cuota.fecha_vencimiento)}
          </p>
          <div className="space-y-4">
            <div>
              <input 
                type="text" 
                value={mFormateado} 
                onChange={(e) => setMFormateado(formatarInput(e.target.value))} 
                disabled={esFija}
                className={`w-full bg-slate-900 border border-white/10 rounded-2xl px-4 py-4 text-2xl font-black outline-none transition-all ${esFija ? 'text-slate-400 bg-slate-950/60 cursor-not-allowed opacity-75' : 'text-white'}`} 
                placeholder="0" 
              />
              {esFija && (
                <p className="text-[9px] text-slate-500 italic mt-1.5 pl-1">
                  Las deudas con cuota fija requieren el pago del monto exacto de la cuota.
                </p>
              )}
              {maestra.tipo === 'tarjeta_credito' && (
                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      const minPago = pagoSeleccionado.cuota.pago_minimo || pagoSeleccionado.cuota.monto_cuota;
                      setMFormateado(formatarInput(Math.max(0, minPago - Number(pagoSeleccionado.cuota.monto_abonado))));
                    }}
                    className="flex-1 py-2 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 rounded-xl text-[9px] font-black uppercase border border-indigo-500/20 transition-all"
                  >
                    Mínimo: {formatearNumero(Math.max(0, (pagoSeleccionado.cuota.pago_minimo || pagoSeleccionado.cuota.monto_cuota) - Number(pagoSeleccionado.cuota.monto_abonado)), maestra.moneda)}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMFormateado(formatarInput(Math.max(0, pagoSeleccionado.cuota.monto_cuota - Number(pagoSeleccionado.cuota.monto_abonado))));
                    }}
                    className="flex-1 py-2 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 rounded-xl text-[9px] font-black uppercase border border-emerald-500/20 transition-all"
                  >
                    Total: {formatearNumero(Math.max(0, pagoSeleccionado.cuota.monto_cuota - Number(pagoSeleccionado.cuota.monto_abonado)), maestra.moneda)}
                  </button>
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-3 gap-2">
              {['PYG', 'BRL', 'USD'].map(m => (
                <button 
                  key={m} 
                  type="button"
                  disabled={esFija}
                  onClick={() => setMon(m)} 
                  className={`py-2 rounded-xl text-xs font-black border transition-all ${mon === m ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-white/5 border-white/10 text-slate-500'} ${esFija && mon !== m ? 'opacity-30 cursor-not-allowed' : ''}`}
                >
                  {m}
                </button>
              ))}
            </div>
            {reqT && <input type="number" step="0.0001" value={t} onChange={(e) => setT(e.target.value)} className="w-full bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 text-white font-bold" placeholder="Cotización aplicada" />}
            <div className="flex gap-2 pt-4">
              <button onClick={() => setMostrarModalPago(false)} className="flex-1 py-4 bg-white/5 text-slate-400 font-bold rounded-2xl">CANCELAR</button>
              <button onClick={() => procesarAbono(desformatearInput(mFormateado), mon, t)} disabled={!mFormateado || (reqT && !t)} className="flex-[2] py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-lg shadow-indigo-600/30">PAGAR</button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  const verificarSiFuePagadaEsteMes = (deuda) => {
    return deuda.cuotas_detalle?.some(c => 
      c.estado === 'pagado' &&
      c.fecha_vencimiento &&
      new Date(c.fecha_vencimiento).getMonth() === new Date().getMonth() &&
      new Date(c.fecha_vencimiento).getFullYear() === new Date().getFullYear()
    ) || false;
  };

  const deudasFiltradas = deudas?.filter(d => pestana === 'activas' ? d.estado === 'activa' : d.estado === 'cerrada') || [];
  const deudasFijas = gastosProgramados?.filter(g => !g.concepto.startsWith("[PRESUPUESTO] ")) || [];
  const previsiones = gastosProgramados?.filter(g => g.concepto.startsWith("[PRESUPUESTO] ")) || [];

  return (
    <div className="space-y-6 pb-20">
      <header className="flex items-center justify-between">
        <div className="flex bg-white/5 p-1 rounded-xl border border-white/5 backdrop-blur-md">
          {['activas', 'archivadas', 'fijos', 'presupuestos'].map(p => (
            <button 
              key={p} 
              onClick={() => setPestana(p)} 
              className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${pestana === p ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}
            >
              {p === 'fijos' ? 'Fijos' : p === 'presupuestos' ? 'Previsiones' : p}
            </button>
          ))}
        </div>
        <button 
          onClick={() => {
            if (pestana === 'fijos') {
              resetFormFijo();
              setMostrarModalFijo(true);
            } else if (pestana === 'presupuestos') {
              resetFormPrevision();
              setMostrarModalPrevision(true);
            } else {
              resetForm();
              setMostrarModal(true);
            }
          }} 
          className="p-2 bg-indigo-600 rounded-xl text-white shadow-lg"
        >
          <Plus size={24} />
        </button>
      </header>

      <div className="space-y-4">
        {(pestana === 'activas' || pestana === 'archivadas') && (
          deudasFiltradas.map((d) => {
          const cuotaActual = d.cuotas_detalle?.filter(c => c.estado === 'pendiente').sort((a, b) => new Date(a.fecha_vencimiento) - new Date(b.fecha_vencimiento))[0];
          const estaExpandida = deudaExpandida === d.id;
          const esMia = d.creador_id === usuarioActual?.id;
          const creador = usuarios?.find(u => u.id === d.creador_id);
          const nombreCreador = creador ? creador.nombre : 'Pareja';

          const totalPagado = d.cuotas_detalle?.reduce((acc, c) => acc + Number(c.monto_abonado), 0) || 0;
          const totalMontoDeuda = d.cuotas_detalle?.reduce((acc, c) => acc + Number(c.monto_cuota), 0) || 0;
          const porcProgreso = totalMontoDeuda > 0 ? (totalPagado / totalMontoDeuda) * 100 : 0;
          
          const cuotasPagadasCount = d.cuotas_detalle?.filter(c => c.estado === 'pagado').length || 0;
          const cuotasTotalesCount = d.cuotas_detalle?.length || 0;
          const pagadaEsteMes = verificarSiFuePagadaEsteMes(d);

          return (
            <motion.div key={d.id} layout className={`glass-card border-l-4 ${pestana === 'activas' ? 'border-l-indigo-500' : 'border-l-slate-600 opacity-80'}`}>
              <div className="flex justify-between items-start mb-4">
                <div onClick={() => setDeudaExpandida(estaExpandida ? null : d.id)} className="cursor-pointer">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-white text-lg">{d.titulo}</h4>
                    {d.alcance === 'individual' ? (
                      <div className="flex items-center gap-1 bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded-md text-[8px] font-black uppercase border border-amber-500/20"><Lock size={10}/> {esMia ? 'Mía' : `De ${nombreCreador}`}</div>
                    ) : (
                      <div className="flex items-center gap-1 bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-md text-[8px] font-black uppercase border border-indigo-500/20"><Users size={10}/> Familiar</div>
                    )}
                    {pagadaEsteMes && (
                      <div className="bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded-md text-[8px] font-black uppercase border border-emerald-500/25">
                        ✓ Este mes pagado
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 uppercase font-black tracking-tighter mt-1">
                    {d.tipo === 'tarjeta_credito' ? '💳 Tarjeta de Crédito' : (d.tipo === 'fija' ? '🏦 Préstamo Fijo' : '📈 Crédito Flexible')}
                    {d.nro_tarjeta && ` • Term. ${d.nro_tarjeta}`}
                    {d.tasa_interes > 0 && ` • Interés: ${d.tasa_interes}%`}
                    {` • ${d.alcance}`}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {cuotaActual && <div className="bg-red-500/10 text-red-400 text-[9px] font-black px-2 py-1 rounded-md border border-red-500/20">VENCE {formatearFechaCorta(cuotaActual.fecha_vencimiento)}</div>}
                  <div className="flex items-center gap-1">
                    {!d.cuotas_detalle?.some(c => c.estado === 'pagado' || Number(c.monto_abonado) > 0) && (esMia || datosHogar.rol === 'superadmin' || datosHogar.rol === 'admin_hogar') && (
                      <button 
                        onClick={() => iniciarEdicionDeuda(d)} 
                        className="p-1.5 text-slate-600 hover:text-indigo-400 rounded-lg transition-colors"
                        title="Editar compromiso"
                      >
                        <Edit2 size={14} />
                      </button>
                    )}
                    {(esMia || datosHogar.rol === 'superadmin' || datosHogar.rol === 'admin_hogar') && (
                      <button 
                        onClick={() => eliminarDeuda(d)} 
                        className="p-1.5 text-slate-600 hover:text-red-400 rounded-lg transition-colors"
                        title="Eliminar compromiso"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {d.tipo === 'tarjeta_credito' ? (
                <div className={`p-4 rounded-2xl mb-4 transition-all border ${d.linea_credito_disponible < 0 ? 'bg-red-500/5 border-red-500/20' : 'bg-white/5 border-white/5'}`}>
                  {/* Resumen Principal (Siempre visible) */}
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="text-[8px] text-slate-500 uppercase font-bold tracking-wider mb-0.5">Uso de Línea</div>
                      <div className="text-sm font-black text-white">
                        {formatearNumero(Math.max(0, d.linea_credito_total - d.linea_credito_disponible), d.moneda)}
                        <span className="text-slate-500 font-bold text-xs"> / {formatearNumero(d.linea_credito_total, d.moneda)}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDeudaExpandida(estaExpandida ? null : d.id)}
                      className="text-[9px] font-black uppercase text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 bg-indigo-500/5 hover:bg-indigo-500/10 px-3.5 py-2 rounded-xl border border-indigo-500/15 transition-all active:scale-95 shadow-sm"
                    >
                      <span>{estaExpandida ? 'Ocultar Detalles' : 'Ver Detalles'}</span>
                      {estaExpandida ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                  </div>

                  {/* Detalle Expandible */}
                  <AnimatePresence>
                    {estaExpandida && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-4 pt-4 border-t border-white/5 space-y-4 overflow-hidden"
                      >
                        {/* ALERTAS INTELIGENTES */}
                        {(() => {
                          const alertas = [];
                          const hoy = new Date();
                          hoy.setHours(0, 0, 0, 0);

                          // 1. Sobregiro
                          if (d.linea_credito_disponible < 0) {
                            alertas.push({
                              id: 'sobregiro',
                              icono: <AlertTriangle size={12} />,
                              texto: `Sobregirado por ${formatearNumero(Math.abs(d.linea_credito_disponible), d.moneda)}`,
                              clase: 'bg-red-500/10 border-red-500/20 text-red-400'
                            });
                          }

                          // 2. Uso elevado
                          if (d.linea_credito_disponible >= 0 && d.linea_credito_total > 0 && (d.linea_credito_total - d.linea_credito_disponible) / d.linea_credito_total > 0.8) {
                            alertas.push({
                              id: 'uso_elevado',
                              icono: <AlertTriangle size={12} />,
                              texto: `Uso elevado: ${(((d.linea_credito_total - d.linea_credito_disponible) / d.linea_credito_total) * 100).toFixed(0)}% de tu línea`,
                              clase: 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                            });
                          }

                          if (cuotaActual) {
                            // 3. Vencimiento
                            if (cuotaActual.estado === 'pendiente') {
                              const venc = new Date(cuotaActual.fecha_vencimiento);
                              venc.setHours(0, 0, 0, 0);
                              const diffVencDays = Math.ceil((venc - hoy) / (1000 * 60 * 60 * 24));

                              if (diffVencDays === 0) {
                                alertas.push({
                                  id: 'vence_hoy',
                                  icono: <AlertTriangle size={12} className="animate-pulse" />,
                                  texto: 'PAGO VENCE HOY 🚨',
                                  clase: 'bg-red-500/15 border-red-500/35 text-red-400 font-extrabold'
                                });
                              } else if (diffVencDays > 0 && diffVencDays <= 3) {
                                alertas.push({
                                  id: 'vence_pronto',
                                  icono: <Clock size={12} />,
                                  texto: `Vence en ${diffVencDays} ${diffVencDays === 1 ? 'día' : 'días'} ⏳`,
                                  clase: 'bg-amber-500/10 border-amber-500/25 text-amber-400'
                                });
                              } else if (diffVencDays < 0) {
                                alertas.push({
                                  id: 'vencido',
                                  icono: <AlertTriangle size={12} className="animate-bounce" />,
                                  texto: `PAGO VENCIDO hace ${Math.abs(diffVencDays)} días 🚨`,
                                  clase: 'bg-red-600/20 border-red-600/45 text-red-400 font-black'
                                });
                              }
                            }

                            // 4. Cierre
                            if (d.fecha_cierre_tarjeta) {
                              const cierreActualStr = obtenerFechaCierreExacta(cuotaActual.fecha_vencimiento, d.fecha_cierre_tarjeta);
                              if (cierreActualStr) {
                                const cierre = new Date(cierreActualStr);
                                cierre.setHours(0, 0, 0, 0);
                                const diffCierreDays = Math.ceil((cierre - hoy) / (1000 * 60 * 60 * 24));

                                if (diffCierreDays === 0) {
                                  alertas.push({
                                    id: 'cierra_hoy',
                                    icono: <Sparkles size={12} />,
                                    texto: 'Hoy cierra el periodo de facturación 🔔',
                                    clase: 'bg-indigo-500/15 border-indigo-500/35 text-indigo-300'
                                  });
                                } else if (diffCierreDays > 0 && diffCierreDays <= 3) {
                                  alertas.push({
                                    id: 'cierra_pronto',
                                    icono: <Calendar size={12} />,
                                    texto: `Cierre de periodo en ${diffCierreDays} ${diffCierreDays === 1 ? 'día' : 'días'} 📅`,
                                    clase: 'bg-indigo-500/10 border-indigo-500/25 text-indigo-300/80'
                                  });
                                } else if (diffCierreDays < 0 && diffCierreDays >= -3) {
                                  alertas.push({
                                    id: 'recien_cerrado',
                                    icono: <CheckCircle size={12} />,
                                    texto: `Periodo cerró hace ${Math.abs(diffCierreDays)} días 📄`,
                                    clase: 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                                  });
                                }
                              }
                            }
                          }

                          if (alertas.length === 0) return null;

                          return (
                            <div className="space-y-1.5">
                              {alertas.map(al => (
                                <div key={al.id} className={`p-2 border rounded-xl flex items-center gap-2 text-[8px] font-bold uppercase ${al.clase}`}>
                                  {al.icono}
                                  <span>{al.texto}</span>
                                </div>
                              ))}
                            </div>
                          );
                        })()}

                        {/* DETALLE DE LÍNEA DE CRÉDITO */}
                        <div className="grid grid-cols-3 gap-2">
                          <div className="bg-white/[0.02] border border-white/5 p-2 rounded-xl">
                            <div className="text-[7px] text-slate-500 uppercase font-bold">Disponible</div>
                            <div className={`text-xs font-black ${d.linea_credito_disponible < 0 ? 'text-red-400' : 'text-indigo-400'}`}>
                              {formatearNumero(d.linea_credito_disponible, d.moneda)}
                            </div>
                          </div>
                          <div className="bg-white/[0.02] border border-white/5 p-2 rounded-xl">
                            <div className="text-[7px] text-slate-500 uppercase font-bold">Consumido</div>
                            <div className="text-xs font-black text-slate-300">
                              {formatearNumero(Math.max(0, d.linea_credito_total - d.linea_credito_disponible), d.moneda)}
                            </div>
                          </div>
                          <div className="bg-white/[0.02] border border-white/5 p-2 rounded-xl text-right">
                            <div className="text-[7px] text-slate-500 uppercase font-bold">Línea Total</div>
                            <div className="text-xs font-black text-slate-400">
                              {formatearNumero(d.linea_credito_total, d.moneda)}
                            </div>
                          </div>
                        </div>

                        {/* LÍNEA DE FECHAS DE CIERRE */}
                        {(() => {
                          if (!cuotaActual || !d.fecha_cierre_tarjeta) return null;
                          const cierreActualStr = obtenerFechaCierreExacta(cuotaActual.fecha_vencimiento, d.fecha_cierre_tarjeta);
                          if (!cierreActualStr) return null;

                          const parts = cierreActualStr.split("-");
                          const cy = parseInt(parts[0], 10);
                          const cm = parseInt(parts[1], 10) - 1;
                          const cd = parseInt(parts[2], 10);

                          const prevCierre = new Date(cy, cm - 1, cd);
                          const nextCierre = new Date(cy, cm + 1, cd);

                          const formatLocalYMD = (date) => {
                            const y = date.getFullYear();
                            const m = String(date.getMonth() + 1).padStart(2, '0');
                            const d = String(date.getDate()).padStart(2, '0');
                            return `${y}-${m}-${d}`;
                          };

                          const prevCierreStr = formatLocalYMD(prevCierre);
                          const nextCierreStr = formatLocalYMD(nextCierre);

                          return (
                            <div className="border-t border-white/5 pt-3 space-y-1.5 text-[8px] text-slate-400 font-bold uppercase tracking-tight">
                              <div className="flex justify-between">
                                <span>📅 Cierre Anterior:</span>
                                <span className="text-slate-500">{formatearFechaCorta(prevCierreStr)}</span>
                              </div>
                              <div className="flex justify-between text-indigo-400 font-black">
                                <span>📅 Cierre Actual:</span>
                                <span>{formatearFechaCorta(cierreActualStr)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>📅 Próximo Cierre:</span>
                                <span className="text-slate-500">{formatearFechaCorta(nextCierreStr)}</span>
                              </div>
                              <div className="flex justify-between text-red-400 font-black border-t border-white/5 pt-1.5 mt-1">
                                <span>⏳ Vence el:</span>
                                <span>{formatearFechaCorta(cuotaActual.fecha_vencimiento)}</span>
                              </div>
                            </div>
                          );
                        })()}

                        {/* WIDGET PROYECCIÓN DE INTERESES (SUDAMERIS STYLE) */}
                        {d.tasa_interes > 0 && cuotaActual && (d.linea_credito_total - d.linea_credito_disponible) > 0 && (() => {
                          const saldoConsumido = d.linea_credito_total - d.linea_credito_disponible;
                          const minPagoVal = cuotaActual.pago_minimo || (saldoConsumido * 0.1);
                          const mesesProyeccion = 10;
                          const interesTotalEstimado = (saldoConsumido * (d.tasa_interes / 100)) * (mesesProyeccion / 12);
                          return (
                            <div className="p-2.5 bg-indigo-500/5 border border-indigo-500/10 rounded-xl text-[8px] text-indigo-300/80 leading-relaxed normal-case">
                              💡 <strong>Proyección:</strong> Si pagás solo el pago mínimo ({formatearNumero(minPagoVal, d.moneda)}), te llevará aprox. <strong>{mesesProyeccion} meses</strong> liquidar el saldo total y pagarás un aproximado de <strong>{formatearNumero(interesTotalEstimado, d.moneda)}</strong> en intereses.
                            </div>
                          );
                        })()}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <div className="mb-4">
                  <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase mb-1">
                    <span>Progreso ({cuotasPagadasCount}/{cuotasTotalesCount} cuotas)</span>
                    <span>{porcProgreso.toFixed(0)}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden"><div style={{ width: `${porcProgreso}%` }} className="h-full bg-indigo-500" /></div>
                </div>
              )}

              {(() => {
                let montoAPagar = 0;
                let etiquetaMonto = 'Cuota Actual';
                if (pestana === 'activas' && cuotaActual) {
                  if (d.tipo === 'tarjeta_credito') {
                    etiquetaMonto = 'Pago Mínimo';
                    const minPago = cuotaActual.pago_minimo || cuotaActual.monto_cuota;
                    montoAPagar = Math.max(0, minPago - Number(cuotaActual.monto_abonado));
                  } else {
                    montoAPagar = cuotaActual.monto_cuota - cuotaActual.monto_abonado;
                  }
                } else {
                  etiquetaMonto = 'Total Pagado';
                  montoAPagar = totalPagado;
                }
                return (
                  <div className="flex justify-between items-end">
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">{etiquetaMonto}</div>
                      <div className="text-2xl font-black text-white">{formatearNumero(montoAPagar, d.moneda)}</div>
                    </div>
                    {pestana === 'activas' && cuotaActual && (d.alcance === 'familiar' || esMia) && (() => {
                      let mostrarCerrarCiclo = false;
                      if (d.tipo === 'tarjeta_credito' && d.fecha_cierre_tarjeta) {
                        const cierreActualStr = obtenerFechaCierreExacta(cuotaActual.fecha_vencimiento, d.fecha_cierre_tarjeta);
                        if (cierreActualStr) {
                          const hoy = new Date();
                          hoy.setHours(0,0,0,0);
                          const cierre = new Date(cierreActualStr);
                          cierre.setHours(0,0,0,0);
                          mostrarCerrarCiclo = hoy >= cierre;
                        }
                      }
                      return (
                        <div className="flex flex-wrap gap-2 justify-end">
                          {d.tipo === 'tarjeta_credito' && (
                            <button 
                              type="button"
                              onClick={() => { setCompraSeleccionada(d); setMostrarModalCompra(true); }}
                              className="bg-white/5 border border-white/10 hover:bg-white/10 text-white text-xs font-black px-4 py-3 rounded-xl shadow-lg transition-all"
                            >
                              CARGAR COMPRA
                            </button>
                          )}
                          {mostrarCerrarCiclo && (
                            <button 
                              type="button"
                              onClick={() => cerrarCicloTarjeta(d, cuotaActual)}
                              className="bg-amber-600/10 border border-amber-500/20 hover:bg-amber-600/20 text-amber-400 text-xs font-black px-4 py-3 rounded-xl shadow-lg transition-all"
                            >
                              🔄 CERRAR CICLO
                            </button>
                          )}
                          <button 
                            onClick={() => { setPagoSeleccionado({ cuota: cuotaActual, maestra: d }); setMostrarModalPago(true); }} 
                            className="bg-indigo-600 text-white text-xs font-black px-6 py-3 rounded-xl shadow-lg"
                          >
                            ABONAR
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                );
              })()}

              {estaExpandida && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-6 pt-6 border-t border-white/5 space-y-4">
                  {d.tipo === 'fija' && d.tasa_interes > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-[9px] text-slate-400">
                        <thead>
                          <tr className="border-b border-white/5 uppercase text-[8px] text-slate-500 font-bold">
                            <th className="pb-2">Cuota</th>
                            <th className="pb-2">Vencimiento</th>
                            <th className="pb-2">Capital</th>
                            <th className="pb-2">Interés</th>
                            <th className="pb-2">Cargos/Seguros</th>
                            <th className="pb-2 text-right">Cuota Total</th>
                            <th className="pb-2 text-right">Estado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            const plan = obtenerPlanAmortizacion(
                              d.cuotas_detalle?.[0]?.monto_cuota || 0,
                              d.cuotas_detalle?.length || 1,
                              d.tasa_interes,
                              d.cuotas_detalle?.[0]?.cargos || 0
                            );
                            return d.cuotas_detalle?.sort((a,b)=>a.numero_cuota-b.numero_cuota).map((c, idx) => {
                              const amort = plan[idx] || { capital: c.monto_cuota, interes: 0, cargos: 0 };
                              return (
                                <tr key={c.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                                  <td className="py-2.5 font-bold text-slate-300">{c.numero_cuota}</td>
                                  <td className="py-2.5">{formatearFechaCorta(c.fecha_vencimiento)}</td>
                                  <td className="py-2.5 text-indigo-400 font-bold">{formatearNumero(amort.capital, d.moneda)}</td>
                                  <td className="py-2.5 text-amber-500/95 font-bold">{formatearNumero(amort.interes, d.moneda)}</td>
                                  <td className="py-2.5 text-slate-500 font-bold">{formatearNumero(c.cargos || 0, d.moneda)}</td>
                                  <td className="py-2.5 text-right text-white font-black">{formatearNumero(c.monto_cuota, d.moneda)}</td>
                                  <td className="py-2.5 text-right">
                                    <span className={`px-2 py-0.5 rounded-md font-black uppercase text-[7px] border ${c.estado === 'pagado' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                                      {c.estado}
                                    </span>
                                  </td>
                                </tr>
                              );
                            });
                          })()}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {d.cuotas_detalle?.sort((a,b)=>a.numero_cuota-b.numero_cuota).map(c => (
                        <div key={c.id} className="flex justify-between text-[10px] bg-white/5 p-2 rounded-xl">
                          <span className={c.estado==='pagado'?'text-emerald-400':'text-slate-400'}>
                            Cuota {c.numero_cuota} • {c.estado === 'pagado' ? 'Pagado' : `Vence: ${formatearFechaCorta(c.fecha_vencimiento)}`}
                          </span>
                          <span className="text-white font-bold">{formatearNumero(c.monto_cuota, d.moneda)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </motion.div>
          );
        })
        )}

        {pestana === 'fijos' && (
          deudasFijas.length === 0 ? (
            <div className="glass-card py-12 text-center">
              <Calendar size={40} className="mx-auto mb-3 text-slate-500 opacity-40" />
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Sin gastos fijos programados</p>
              <p className="text-[10px] text-slate-500 mt-2 max-w-xs mx-auto px-4">
                Registrá tus servicios indispensables (agua, luz, internet) para tenerlos siempre a mano y simplificar tu control mensual.
              </p>
              <div className="flex flex-col gap-2 mt-6 max-w-xs mx-auto px-4">
                <button 
                  onClick={preCargarPlantillas} 
                  className="py-3 px-4 bg-indigo-600 text-white text-[10px] font-black rounded-xl uppercase hover:bg-indigo-500 active:scale-95 transition-all shadow-lg"
                >
                  Pre-cargar Plantilla de Supervivencia 🏠
                </button>
                <button 
                  onClick={() => { resetFormFijo(); setMostrarModalFijo(true); }} 
                  className="py-3 px-4 bg-white/5 border border-white/10 text-white text-[10px] font-black rounded-xl uppercase hover:bg-white/10 active:scale-95 transition-all"
                >
                  Agregar Gasto Fijo Manual
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                  Servicios y Compras Recurrentes ({deudasFijas.length})
                </span>
                <button 
                  onClick={preCargarPlantillas} 
                  className="text-[9px] font-black text-indigo-400 uppercase tracking-tighter hover:underline"
                >
                  + Recargar Plantilla Básica
                </button>
              </div>

              {deudasFijas.map((f) => {
                const pagado = verificarSiFuePagadoEsteMes(f);
                return (
                  <div 
                    key={f.id} 
                    className={`glass-card border-l-4 transition-all duration-300 ${
                      pagado ? 'border-l-emerald-500 bg-emerald-500/[0.02] opacity-75' : 'border-l-indigo-500 bg-white/[0.01]'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-white text-sm uppercase">{f.concepto}</h4>
                          {pagado && (
                            <span className="bg-emerald-500/20 text-emerald-400 text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase border border-emerald-500/20">
                              PAGADO ESTE MES
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500 font-bold uppercase mt-1 tracking-tighter">
                          Categoría: {f.categoria} • Vence el: {f.dia_recurrencia} de cada mes • {f.para_quien === 'Ambos' ? 'Familia' : `Para: ${f.para_quien}`}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <button 
                          onClick={() => abrirEdicionFijo(f)} 
                          className="p-1.5 text-slate-500 hover:text-indigo-400 transition-colors"
                          disabled={pagado}
                        >
                          <Edit2 size={15}/>
                        </button>
                        <button 
                          onClick={() => eliminarGastoFijo(f.id, f.concepto)} 
                          className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={15}/>
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="text-xl font-black text-white">
                        {f.monto > 0 ? formatearNumero(f.monto, f.moneda) : 'Monto Variable 📊'}
                      </div>
                      
                      {!pagado ? (
                        <button 
                          onClick={() => abrirPagoFijo(f)} 
                          className="px-4 py-2 bg-indigo-600 text-white text-[10px] font-black rounded-xl flex items-center gap-2 active:scale-95 transition-all shadow-lg hover:bg-indigo-500"
                        >
                          <CheckCircle size={14}/> COBRAR / REGISTRAR
                        </button>
                      ) : (
                        <div className="text-[9px] font-black text-emerald-400 flex items-center gap-1">
                          <CheckCircle size={12}/> ABONADO EN EL MES
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        {pestana === 'presupuestos' && (
          previsiones.length === 0 ? (
            <div className="glass-card py-12 text-center">
              <Calendar size={40} className="mx-auto mb-3 text-slate-500 opacity-40" />
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Sin previsiones de gasto definidas</p>
              <p className="text-[10px] text-slate-500 mt-2 max-w-xs mx-auto px-4">
                Establecé límites mensuales para categorías específicas (ocio, belleza, salidas) para controlar tus gastos de manera inteligente y ver tu progreso en tiempo real.
              </p>
              <div className="flex flex-col gap-2 mt-6 max-w-xs mx-auto px-4">
                <button 
                  onClick={() => { resetFormPrevision(); setMostrarModalPrevision(true); }} 
                  className="py-3 px-4 bg-indigo-600 text-white text-[10px] font-black rounded-xl uppercase hover:bg-indigo-500 active:scale-95 transition-all shadow-lg"
                >
                  Definir Nueva Previsión 🎯
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                  Previsiones de Gasto Activas ({previsiones.length})
                </span>
                <button 
                  onClick={() => { resetFormPrevision(); setMostrarModalPrevision(true); }} 
                  className="text-[9px] font-black text-indigo-400 uppercase tracking-tighter hover:underline"
                >
                  + Nueva Previsión
                </button>
              </div>

              {previsiones.map((p) => {
                const nombreLimpio = p.concepto.replace("[PRESUPUESTO] ", "");
                const consumido = calcularGastoPrevision(nombreLimpio, p.moneda);
                const limite = p.monto;
                const porc = limite > 0 ? (consumido / limite) * 100 : 0;
                
                let colorClase = "text-emerald-400 bg-emerald-500/20 border-emerald-500/20";
                let barColor = "bg-emerald-500";
                if (porc >= 70 && porc <= 90) {
                  colorClase = "text-amber-400 bg-amber-500/20 border-amber-500/20";
                  barColor = "bg-amber-500";
                } else if (porc > 90) {
                  colorClase = "text-rose-400 bg-rose-500/20 border-rose-500/20";
                  barColor = "bg-rose-500";
                }

                return (
                  <div key={p.id} className="glass-card p-5 border-l-4 border-l-indigo-500 bg-white/[0.01] transition-all hover:bg-white/[0.03]">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-black text-white text-sm uppercase tracking-tight flex items-center gap-2">
                          {nombreLimpio}
                        </h4>
                        <span className="inline-block mt-1 text-[8px] font-black uppercase px-2 py-0.5 rounded-full bg-white/5 text-slate-400 border border-white/5">
                          {p.para_quien === 'Ambos' ? '👥 Compartido' : `👤 Para: ${obtenerNombreDestinatario(p)}`}
                        </span>
                      </div>
                      <div className="flex gap-1">
                        <button 
                          onClick={() => abrirEdicionPrevision(p)} 
                          className="p-1.5 text-slate-500 hover:text-indigo-400 transition-colors"
                        >
                          <Edit2 size={15}/>
                        </button>
                        <button 
                          onClick={() => eliminarPrevision(p.id, p.concepto)} 
                          className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={15}/>
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2 mt-4">
                      <div className="flex justify-between items-end">
                        <span className="text-[10px] text-slate-500 font-bold uppercase">Consumido este mes</span>
                        <span className="text-sm font-black text-white">
                          {formatearNumero(consumido, p.moneda)} / <span className="text-slate-400 text-xs">{limite > 0 ? formatearNumero(limite, p.moneda) : 'Variable'}</span>
                        </span>
                      </div>

                      {limite > 0 && (
                        <div>
                          <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-white/5">
                            <div 
                              className={`h-full ${barColor} transition-all duration-500 rounded-full`}
                              style={{ width: `${Math.min(100, porc)}%` }}
                            />
                          </div>
                          <div className="flex justify-between items-center mt-2 text-[9px] font-bold uppercase tracking-wider">
                            <span className={porc > 100 ? "text-rose-400" : "text-slate-500"}>
                              {porc > 100 ? `Excedido por ${formatearNumero(consumido - limite, p.moneda)}` : `Disponible: ${formatearNumero(limite - consumido, p.moneda)}`}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-black border ${colorClase}`}>
                              {porc.toFixed(0)}%
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>

      <AnimatePresence>
        {mostrarModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-lg glass-panel p-6 rounded-3xl relative max-h-[90vh] overflow-y-auto">
              <button onClick={() => setMostrarModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X size={24} /></button>
              <h2 className="text-xl font-black text-white mb-6 uppercase">{deudaEditandoId ? 'Editar Compromiso Pro' : 'Nuevo Compromiso Pro'}</h2>
              <form onSubmit={guardarDeudaPro} className="space-y-5">
                <div className="flex p-1 bg-white/5 rounded-2xl border border-white/5">
                  {['familiar', 'individual'].map(a => <button key={a} type="button" onClick={() => setAlcanceDeuda(a)} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${alcanceDeuda === a ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}>{a}</button>)}
                </div>
                <div className="flex p-1 bg-white/5 rounded-2xl border border-white/5">
                  {['fija', 'flexible', 'tarjeta_credito'].map(t => <button key={t} type="button" onClick={() => setTipoDeuda(t)} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${tipoDeuda === t ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}>{t.replace('_', ' ')}</button>)}
                </div>
                
                <div className="space-y-1">
                   <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Descripción / Entidad</label>
                   <input type="text" placeholder="Ej: Préstamo Banco Itaú" value={titulo} onChange={(e) => setTitulo(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-xl px-5 py-4 text-white outline-none focus:border-indigo-500/50" required />
                </div>

                {tipoDeuda === 'tarjeta_credito' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-indigo-400 uppercase ml-1 flex items-center gap-1"><Hash size={12}/> Últimos 4 dígitos</label>
                      <input type="text" maxLength="4" placeholder="Ej: 1234" value={nroTarjeta} onChange={(e) => setNroTarjeta(e.target.value.replace(/\D/g,''))} className="w-full bg-slate-900 border border-white/10 rounded-xl px-5 py-4 text-white font-black tracking-widest outline-none focus:border-indigo-500/50" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-indigo-400 uppercase ml-1 flex items-center gap-1"><Percent size={12}/> Interés Anual (%)</label>
                      <input type="number" step="0.01" min="0" placeholder="Ej: 15" value={tasaInteres} onChange={(e) => setTasaInteres(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-xl px-5 py-4 text-white outline-none focus:border-indigo-500/50" />
                    </div>
                  </div>
                )}

                {tipoDeuda === 'fija' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-indigo-400 uppercase ml-1 flex items-center gap-1"><Percent size={12}/> Interés Anual (%)</label>
                      <input type="number" step="0.01" min="0" placeholder="Ej: 24" value={tasaInteres} onChange={(e) => setTasaInteres(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-xl px-5 py-4 text-white outline-none focus:border-indigo-500/50" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-indigo-400 uppercase ml-1 flex items-center gap-1">🛡️ Cargos / Seguros por Cuota</label>
                      <input type="text" placeholder="Ej: 4.500" value={cargosMensualesFormateado} onChange={(e) => setCargosMensualesFormateado(formatarInput(e.target.value))} className="w-full bg-slate-900 border border-white/10 rounded-xl px-5 py-4 text-white outline-none focus:border-indigo-500/50" />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">{tipoDeuda === 'tarjeta_credito' ? 'Deuda Actual' : 'Monto Total'}</label>
                    <input type="text" value={montoTotalFormateado} onChange={(e) => setMontoTotalFormateado(formatarInput(e.target.value))} className="w-full bg-slate-900 border border-white/10 rounded-2xl px-5 py-4 text-white outline-none focus:border-indigo-500/50" placeholder="0" required />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Moneda</label>
                    <select value={monedaDeuda} onChange={(e) => setMonedaDeuda(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-2xl px-5 py-4 text-white outline-none"><option value="PYG">PYG</option><option value="BRL">BRL</option></select>
                  </div>
                </div>

                {tipoDeuda === 'tarjeta_credito' ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Pago Mínimo</label>
                      <input type="text" value={pagoMinimoFormateado} onChange={(e) => setPagoMinimoFormateado(formatarInput(e.target.value))} className="w-full bg-slate-900 border border-white/10 rounded-2xl px-5 py-4 text-white outline-none" placeholder="0" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Línea Crédito</label>
                      <input type="text" value={lineaCreditoFormateada} onChange={(e) => setLineaCreditoFormateada(formatarInput(e.target.value))} className="w-full bg-slate-900 border border-white/10 rounded-2xl px-5 py-4 text-white outline-none" placeholder="0" />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Cuotas Totales</label>
                      <input type="number" min="1" value={cantidadCuotas} onChange={(e) => setCantidadCuotas(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-xl px-5 py-4 text-white outline-none" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Cuotas ya Pagadas</label>
                      <input type="number" min="0" max={cantidadCuotas} value={cuotasPagadas} onChange={(e) => setCuotasPagadas(e.target.value)} className="w-full bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-5 py-4 text-white outline-none" />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Día Vencimiento</label>
                    <input type="number" min="1" max="31" value={diaVencimiento} onChange={(e) => setDiaVencimiento(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-xl px-5 py-4 text-white outline-none" />
                  </div>
                  {tipoDeuda === 'tarjeta_credito' && (
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Día Cierre</label>
                      <input type="number" min="1" max="31" value={fechaCierreTarjeta} onChange={(e) => setFechaCierreTarjeta(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-xl px-5 py-4 text-white outline-none" />
                    </div>
                  )}
                </div>

                {zonaPeligro && <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex gap-4"><AlertTriangle className="text-red-500 shrink-0" /><p className="text-[11px] text-red-200 font-bold">🚨 ¡Índice al {proyectado.toFixed(1)}%! Superás el límite saludable del BCP.</p></div>}
                <button type="submit" disabled={guardando} className={`w-full py-5 font-black uppercase rounded-2xl shadow-xl transition-all ${zonaPeligro ? 'bg-red-600' : 'bg-indigo-600'} text-white`}>{guardando ? <Loader2 className="animate-spin mx-auto" /> : (deudaEditandoId ? "GUARDAR CAMBIOS" : "REGISTRAR DEUDA")}</button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>{mostrarModalPago && <ModalAbono />}</AnimatePresence>
      <AnimatePresence>{mostrarModalCompra && <ModalCompra />}</AnimatePresence>
      <AnimatePresence>{sugerenciaIA && <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"><motion.div className="w-full max-w-sm glass-panel p-8 rounded-3xl text-center"><Sparkles className="text-indigo-400 mx-auto mb-4" size={48}/><p className="text-slate-300 italic mb-8">"{sugerenciaIA}"</p><button onClick={() => setSugerenciaIA(null)} className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl uppercase">ENTENDIDO</button></motion.div></div>}</AnimatePresence>

      {/* MODAL CREAR/EDITAR GASTO FIJO */}
      <AnimatePresence>
        {mostrarModalFijo && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-sm glass-panel p-6 rounded-3xl relative">
              <button onClick={() => { setMostrarModalFijo(false); resetFormFijo(); }} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X size={24} /></button>
              <h2 className="text-xl font-black text-white mb-6 uppercase flex items-center gap-2">
                {idFijoEditando ? 'Ajustar Gasto Fijo' : 'Programar Gasto Fijo'}
              </h2>
              <form onSubmit={guardarGastoFijo} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Concepto / Servicio</label>
                  <input type="text" placeholder="Ej: Luz (ANDE), Agua, Alquiler..." value={fijoConcepto} onChange={(e) => setFijoConcepto(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500/50" required />
                </div>
                
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Monto Estimado (Opcional)</label>
                  <div className="relative">
                    <input 
                      type="text" 
                      value={fijoMontoFormateado} 
                      onChange={(e) => setFijoMontoFormateado(formatarInput(e.target.value))} 
                      className="w-full bg-slate-900 border border-white/10 rounded-2xl px-4 py-4 text-2xl font-black text-indigo-400 outline-none" 
                      placeholder="Variable / Sin monto fijo"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 font-black uppercase text-xs">{fijoMoneda}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Moneda</label>
                    <select value={fijoMoneda} onChange={(e) => setFijoMoneda(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white" disabled={!!idFijoEditando}>
                      <option value="PYG">PYG</option>
                      <option value="BRL">BRL</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Día de Cobro/Venc.</label>
                    <input type="number" min="1" max="31" value={fijoDiaRecurrencia} onChange={(e) => setFijoDiaRecurrencia(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white font-black" required />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Categoría</label>
                    <select value={fijoCategoria} onChange={(e) => setFijoCategoria(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white">
                      {["Casa", "Supermercado", "Salud", "Transporte", "Otros"].map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Alcance</label>
                    <select value={fijoParaQuien} onChange={(e) => setFijoParaQuien(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white">
                      <option value="Ambos">Ambos (Familiar)</option>
                      <option value="Yo">Solo Yo</option>
                      <option value="Pareja">Pareja</option>
                    </select>
                  </div>
                </div>

                <button type="submit" disabled={guardando} className="w-full py-4 font-black rounded-2xl bg-indigo-600 text-white shadow-xl shadow-indigo-900/20 active:scale-95 transition-all mt-4">
                  {guardando ? <Loader2 className="animate-spin mx-auto" /> : "PROGRAMAR GASTO"}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL REGISTRAR PAGO DE GASTO FIJO */}
      <AnimatePresence>
        {mostrarModalPagarFijo && gastoFijoAPagar && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-sm glass-panel p-6 rounded-3xl relative">
              <button onClick={() => { setMostrarModalPagarFijo(false); setGastoFijoAPagar(null); }} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X size={24} /></button>
              <h2 className="text-xl font-black text-white mb-2 uppercase flex items-center gap-2">
                Pagar Servicio 💸
              </h2>
              <p className="text-[11px] text-slate-400 mb-4">{gastoFijoAPagar.concepto}</p>
              <form onSubmit={registrarPagoGastoFijo} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Monto Real a Pagar (Factura)</label>
                  <div className="relative">
                    <input 
                      type="text" 
                      value={pagarMontoFormateado} 
                      onChange={(e) => setPagarMontoFormateado(formatarInput(e.target.value))} 
                      className="w-full bg-slate-900 border border-white/10 rounded-2xl px-4 py-4 text-2xl font-black text-emerald-400 outline-none" 
                      placeholder="0"
                      required 
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 font-black uppercase text-xs">{pagarMoneda}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Moneda</label>
                    <select value={pagarMoneda} onChange={(e) => setPagarMoneda(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white">
                      <option value="PYG">PYG</option>
                      <option value="BRL">BRL</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Quién Pagó</label>
                    <select value={pagarPagadorId} onChange={(e) => setPagarPagadorId(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white">
                      <option value={usuarioActual?.id}>{usuarioActual?.nombre} (Yo)</option>
                      {otroUsuario && <option value={otroUsuario.id}>{otroUsuario.nombre}</option>}
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Alcance del Gasto</label>
                  <select value={pagarParaQuien} onChange={(e) => setPagarParaQuien(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white">
                    <option value="Ambos">Ambos (Compartido 50/50)</option>
                    <option value="Yo">Solo Yo</option>
                    <option value="Pareja">Pareja</option>
                  </select>
                </div>

                <button type="submit" className="w-full py-4 font-black rounded-2xl bg-emerald-600 text-white shadow-xl shadow-emerald-950/30 active:scale-95 transition-all mt-4">
                  CONFIRMAR PAGO
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL CREAR/EDITAR PREVISIÓN */}
      <AnimatePresence>
        {mostrarModalPrevision && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-sm glass-panel p-6 rounded-3xl relative">
              <button onClick={() => { setMostrarModalPrevision(false); resetFormPrevision(); }} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X size={24} /></button>
              <h2 className="text-xl font-black text-white mb-6 uppercase flex items-center gap-2">
                {idPrevisionEditando ? 'Ajustar Previsión' : 'Nueva Previsión'}
              </h2>
              <form onSubmit={guardarPrevision} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Nombre de la Previsión / Sobre</label>
                  <input type="text" placeholder="Ej: Belleza, Ocio, Cine, Ropa..." value={previsionConcepto} onChange={(e) => setPrevisionConcepto(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500/50" required />
                </div>
                
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Monto Límite Mensual</label>
                  <div className="relative">
                    <input 
                      type="text" 
                      value={previsionMontoFormateado} 
                      onChange={(e) => setPrevisionMontoFormateado(formatarInput(e.target.value))} 
                      className="w-full bg-slate-900 border border-white/10 rounded-2xl px-4 py-4 text-2xl font-black text-indigo-400 outline-none" 
                      placeholder="0"
                      required
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 font-black uppercase text-xs">{previsionMoneda}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Moneda</label>
                    <select value={previsionMoneda} onChange={(e) => setPrevisionMoneda(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white" disabled={!!idPrevisionEditando}>
                      <option value="PYG">PYG</option>
                      <option value="BRL">BRL</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Destinado A</label>
                    <select value={previsionParaQuien} onChange={(e) => setPrevisionParaQuien(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white">
                      <option value="Ambos">Ambos (Compartido)</option>
                      <option value="Yo">{usuarioActual?.nombre || 'Solo Yo'}</option>
                      {otroUsuario && (
                        <option value="Pareja">{otroUsuario.nombre} (Pareja)</option>
                      )}
                    </select>
                  </div>
                </div>

                <button type="submit" disabled={guardando} className="w-full py-4 font-black rounded-2xl bg-indigo-600 text-white shadow-xl shadow-indigo-900/20 active:scale-95 transition-all mt-4">
                  {guardando ? <Loader2 className="animate-spin mx-auto" /> : "GUARDAR PREVISIÓN"}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
