import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { CreditCard, Loader2, AlertTriangle, ChevronDown, ChevronUp, Hash, Percent, Settings2, ArrowRight, ArrowLeft } from 'lucide-react';
import { formatearNumero, formatarInput, desformatearInput } from '../../../../shared/lib/formatters';
import * as deudasService from '../../../../services/deudas.service';
import { ajustarDiaHabil } from '../../lib/ciclosTarjeta';
import { valoresInicialesDeuda } from '../../lib/formularios';
import { FormPage } from '../../../../shared/ui/FormPage';

/**
 * Asistente de 3 pasos para crear o editar una deuda (préstamo, cuotas fijas o
 * tarjeta de crédito). Con `deudaEditando` arranca precargado.
 */
export default function ModalDeuda({ deudaEditando, usuarioActual, datosHogar, monedaGlobal, saludFinanciera, onClose, onGuardado }) {
  const [ini] = useState(() => valoresInicialesDeuda(deudaEditando, monedaGlobal));
  const deudaEditandoId = ini.deudaEditandoId;
  const [pasoDeuda, setPasoDeuda] = useState(1); // 1: Tipo/Concepto, 2: Montos/Cuotas, 3: Vencimiento & Avanzado
  const [modoAvanzadoDeuda, setModoAvanzadoDeuda] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [titulo, setTitulo] = useState(ini.titulo);
  const [tipoDeuda, setTipoDeuda] = useState(ini.tipoDeuda);
  const [alcanceDeuda, setAlcanceDeuda] = useState(ini.alcanceDeuda);
  const [nroTarjeta, setNroTarjeta] = useState(ini.nroTarjeta);
  const [tasaInteres, setTasaInteres] = useState(ini.tasaInteres);
  const [montoTotalFormateado, setMontoTotalFormateado] = useState(ini.montoTotalFormateado);
  const [lineaCreditoFormateada, setLineaCreditoFormateada] = useState(ini.lineaCreditoFormateada);
  const [pagoMinimoFormateado, setPagoMinimoFormateado] = useState(ini.pagoMinimoFormateado);
  const [cargosMensualesFormateado, setCargosMensualesFormateado] = useState(ini.cargosMensualesFormateado);
  const [cantidadCuotas, setCantidadCuotas] = useState(ini.cantidadCuotas);
  const [cuotasPagadas, setCuotasPagadas] = useState(ini.cuotasPagadas);
  const [diaVencimiento, setDiaVencimiento] = useState(ini.diaVencimiento);
  const [fechaCierreTarjeta, setFechaCierreTarjeta] = useState(ini.fechaCierreTarjeta);
  const [deudaMedioPago, setDeudaMedioPago] = useState(ini.deudaMedioPago);
  const [deudaTipoCuenta, setDeudaTipoCuenta] = useState(ini.deudaTipoCuenta);
  const [deudaAliasCuenta, setDeudaAliasCuenta] = useState(ini.deudaAliasCuenta);
  const [deudaNroCuenta, setDeudaNroCuenta] = useState(ini.deudaNroCuenta);
  const [deudaNombreTitular, setDeudaNombreTitular] = useState(ini.deudaNombreTitular);
  const [deudaCiTitular, setDeudaCiTitular] = useState(ini.deudaCiTitular);
  const [monedaDeuda, setMonedaDeuda] = useState(ini.monedaDeuda);
  const [modoMonto, setModoMonto] = useState(ini.modoMonto);
  const [fechaInicioDeuda, setFechaInicioDeuda] = useState(ini.fechaInicioDeuda);

  // Al abrir y al cambiar de tipo: moneda global y defaults de tarjeta (mismo comportamiento que antes).
  useEffect(() => {
    setMonedaDeuda(monedaGlobal);
    if (tipoDeuda === 'tarjeta_credito') {
      setCantidadCuotas(1);
      setModoMonto('total');
    } else if (modoMonto === 'total' && cantidadCuotas === 1) {
      setModoMonto('cuota');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monedaGlobal, tipoDeuda]);

  const cambiarModoMonto = (nuevoModo) => {
    if (nuevoModo === modoMonto) return;
    const valorActual = desformatearInput(montoTotalFormateado) || 0;
    const numCuotas = parseInt(cantidadCuotas) || 1;
    let nuevoValor = 0;
    if (nuevoModo === 'total') {
      nuevoValor = valorActual * numCuotas;
    } else {
      nuevoValor = valorActual / numCuotas;
    }
    setModoMonto(nuevoModo);
    setMontoTotalFormateado(formatarInput(Math.round(nuevoValor)));
  };

  const projectedHealth = () => {
    const inputVal = desformatearInput(montoTotalFormateado) || 0;
    if (!inputVal || !saludFinanciera.ingresos) return saludFinanciera.indice;

    let cuotaNueva = 0;
    if (tipoDeuda === 'tarjeta_credito') {
      cuotaNueva = inputVal / (parseInt(cantidadCuotas) || 1);
    } else {
      if (modoMonto === 'cuota') {
        cuotaNueva = inputVal;
      } else {
        cuotaNueva = inputVal / (parseInt(cantidadCuotas) || 1);
      }
    }

    const impact = alcanceDeuda === 'individual' ? cuotaNueva : cuotaNueva * 0.5;
    const cargaNueva = saludFinanciera.carga + impact;
    return (cargaNueva / saludFinanciera.ingresos) * 100;
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
      const inputMonto = desformatearInput(montoTotalFormateado) || 0;
      const lineaTotal = desformatearInput(lineaCreditoFormateada);

      let montoCuota = 0;
      let totalMonto = 0;

      if (tipoDeuda === 'tarjeta_credito') {
        montoCuota = inputMonto / numCuotas;
        totalMonto = inputMonto;
      } else {
        if (modoMonto === 'cuota') {
          montoCuota = inputMonto;
          totalMonto = inputMonto * numCuotas;
        } else {
          totalMonto = inputMonto;
          montoCuota = inputMonto / numCuotas;
        }
      }

      let maestraId = deudaEditandoId;

      if (deudaEditandoId) {
        const { error: errM } = await deudasService.actualizarDeuda(deudaEditandoId, {
            titulo: titulo.trim(), tipo: tipoDeuda,
            alcance: alcanceDeuda, permite_pago_parcial: tipoDeuda !== 'fija', moneda: monedaDeuda,
            linea_credito_total: lineaTotal || 0,
            linea_credito_disponible: (lineaTotal || 0) - (tipoDeuda === 'tarjeta_credito' ? totalMonto : 0),
            fecha_cierre_tarjeta: tipoDeuda === 'tarjeta_credito' ? parseInt(fechaCierreTarjeta) : null,
            nro_tarjeta: tipoDeuda === 'tarjeta_credito' ? nroTarjeta.trim() : null,
            estado: yaPagadas >= numCuotas ? 'cerrada' : 'activa',
            tasa_interes: (tipoDeuda === 'tarjeta_credito' || tipoDeuda === 'fija') ? parseFloat(tasaInteres) || 0 : 0,
            medio_pago: deudaMedioPago,
            tipo_cuenta: deudaMedioPago === 'transferencia' ? deudaTipoCuenta : null,
            alias_cuenta: deudaMedioPago === 'transferencia' && deudaTipoCuenta === 'alias' ? deudaAliasCuenta.trim() : null,
            nro_cuenta: deudaMedioPago === 'transferencia' && deudaTipoCuenta === 'nro_cuenta' ? deudaNroCuenta.trim() : null,
            nombre_titular: deudaMedioPago === 'transferencia' && deudaTipoCuenta === 'nro_cuenta' ? deudaNombreTitular.trim() : null,
            ci_titular: deudaMedioPago === 'transferencia' && deudaTipoCuenta === 'nro_cuenta' ? deudaCiTitular.trim() : null,
          });

        if (errM) throw errM;

        const { error: errDel } = await deudasService.eliminarCuotasDeDeuda(deudaEditandoId);

        if (errDel) throw errDel;
      } else {
        const { data: maestra, error: errM } = await deudasService.crearDeuda({
            espacio_id: eid, creador_id: usuarioActual.id, titulo: titulo.trim(), tipo: tipoDeuda,
            alcance: alcanceDeuda, permite_pago_parcial: tipoDeuda !== 'fija', moneda: monedaDeuda,
            linea_credito_total: lineaTotal || 0,
            linea_credito_disponible: (lineaTotal || 0) - (tipoDeuda === 'tarjeta_credito' ? totalMonto : 0),
            fecha_cierre_tarjeta: tipoDeuda === 'tarjeta_credito' ? parseInt(fechaCierreTarjeta) : null,
            nro_tarjeta: tipoDeuda === 'tarjeta_credito' ? nroTarjeta.trim() : null,
            estado: yaPagadas >= numCuotas ? 'cerrada' : 'activa',
            tasa_interes: (tipoDeuda === 'tarjeta_credito' || tipoDeuda === 'fija') ? parseFloat(tasaInteres) || 0 : 0,
            medio_pago: deudaMedioPago,
            tipo_cuenta: deudaMedioPago === 'transferencia' ? deudaTipoCuenta : null,
            alias_cuenta: deudaMedioPago === 'transferencia' && deudaTipoCuenta === 'alias' ? deudaAliasCuenta.trim() : null,
            nro_cuenta: deudaMedioPago === 'transferencia' && deudaTipoCuenta === 'nro_cuenta' ? deudaNroCuenta.trim() : null,
            nombre_titular: deudaMedioPago === 'transferencia' && deudaTipoCuenta === 'nro_cuenta' ? deudaNombreTitular.trim() : null,
            ci_titular: deudaMedioPago === 'transferencia' && deudaTipoCuenta === 'nro_cuenta' ? deudaCiTitular.trim() : null,
          });

        if (errM) throw errM;
        maestraId = maestra.id;
      }

      const cuotas = [];
      let fechaBase = new Date();
      if (fechaInicioDeuda) {
        const parts = fechaInicioDeuda.split("-");
        if (parts.length === 3) {
          fechaBase = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        }
      }

      const hoyDia = fechaBase.getDate();
      const mesProximo = parseInt(diaVencimiento) < hoyDia ? 1 : 0;
      const mesInicio = fechaInicioDeuda 
        ? fechaBase.getMonth()
        : fechaBase.getMonth() + mesProximo - yaPagadas;

      const anioBase = fechaBase.getFullYear();

      for (let i = 1; i <= numCuotas; i++) {
        let fv = new Date(anioBase, mesInicio + (i - 1), parseInt(diaVencimiento));
        fv = ajustarDiaHabil(fv);

        const esPagada = i <= yaPagadas;

        cuotas.push({
          deuda_maestra_id: maestraId, espacio_id: eid, numero_cuota: i, monto_cuota: montoCuota,
          monto_abonado: esPagada ? montoCuota : 0,
          cargos: tipoDeuda === 'fija' ? (desformatearInput(cargosMensualesFormateado) || 0) : 0,
          pago_minimo: i === 1 ? (desformatearInput(pagoMinimoFormateado) || 0) : 0,
          fecha_vencimiento: `${fv.getFullYear()}-${String(fv.getMonth() + 1).padStart(2, '0')}-${String(fv.getDate()).padStart(2, '0')}`,
          estado: esPagada ? 'pagado' : 'pendiente',
          fecha_pago: esPagada ? (fechaInicioDeuda ? fv.toISOString() : new Date().toISOString()) : null,
          pagador_id: esPagada ? usuarioActual.id : null
        });
      }

      await deudasService.insertarCuotas(cuotas);
      toast.success(deudaEditandoId ? "¡Deuda Pro actualizada con éxito! 📝" : "¡Deuda Pro registrada con éxito! 📝", { id: toastId }); onGuardado();
    } catch (err) { toast.error("Error: " + err.message, { id: toastId }); }
    finally { setGuardando(false); }
  }

  const proyectado = projectedHealth();
  const zonaPeligro = proyectado > 40;

  return (
    <FormPage resumen={<><p className="font-bold">{titulo || "Nuevo compromiso"}</p><p className="text-2xl tabular-nums mt-3">{montoTotalFormateado || "0"} {monedaDeuda}</p><p className="text-sm text-muted-foreground mt-2">{`Paso ${pasoDeuda} de 3 · ${cantidadCuotas} cuotas`}</p></>} onClose={onClose} ariaLabel={deudaEditandoId ? 'Editar compromiso' : 'Nuevo compromiso'}>

      {/* Header con Indicador de Pasos / Wizard */}
      <div className="mb-6">
        <div className="flex items-center justify-between gap-2 mb-2 pr-12">
          <h2 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
            <CreditCard className="text-indigo-400" size={20} />
            {deudaEditandoId ? 'Editar Compromiso Pro' : 'Nuevo Compromiso Pro'}
          </h2>
          <span className="shrink-0 whitespace-nowrap text-xs font-black uppercase text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 rounded-full">
            Paso {pasoDeuda} de 3
          </span>
        </div>
        {/* Progress bar */}
        <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden flex gap-1 p-0.5">
          <div className={`h-full flex-1 rounded-full transition-colors duration-150 duration-300 ${pasoDeuda >= 1 ? 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]' : 'bg-slate-800'}`} />
          <div className={`h-full flex-1 rounded-full transition-colors duration-150 duration-300 ${pasoDeuda >= 2 ? 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]' : 'bg-slate-800'}`} />
          <div className={`h-full flex-1 rounded-full transition-colors duration-150 duration-300 ${pasoDeuda >= 3 ? 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]' : 'bg-slate-800'}`} />
        </div>
      </div>

      <form onSubmit={guardarDeudaPro} className="space-y-5">

        {/* ── PASO 1: Alcance, Tipo y Descripción ── */}
        {pasoDeuda === 1 && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1">1. Alcance de la Deuda</label>
              <div className="flex p-1 bg-white/5 rounded-2xl border border-white/5">
                {['familiar', 'individual'].map(a => (
                  <button 
                    key={a} 
                    type="button" 
                    onClick={() => setAlcanceDeuda(a)} 
                    className={`flex-1 py-3 text-xs font-black uppercase rounded-xl transition-colors duration-150 ${alcanceDeuda === a ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'text-slate-400 hover:text-white'}`}
                  >
                    {a === 'familiar' ? '🏠 Compartida (Familiar)' : '👤 Individual'}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1">2. Tipo de Compromiso</label>
              <div className="flex p-1 bg-white/5 rounded-2xl border border-white/5">
                {['fija', 'flexible', 'tarjeta_credito'].map(t => {
                  let label = t;
                  if (t === 'fija') label = 'Cuota Fija';
                  else if (t === 'flexible') label = 'Flexible';
                  else if (t === 'tarjeta_credito') label = 'Tarjeta Crédito';
                  return (
                    <button 
                      key={t} 
                      type="button" 
                      onClick={() => setTipoDeuda(t)} 
                      className={`flex-1 py-3 text-xs font-black uppercase rounded-xl transition-colors duration-150 ${tipoDeuda === t ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'text-slate-400 hover:text-white'}`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1">3. Nombre / Descripción del Préstamo o Tarjeta</label>
              <input 
                type="text" 
                placeholder="Ej: Préstamo Vehículo Itaú, Tarjeta Continental..." 
                value={titulo} 
                onChange={(e) => setTitulo(e.target.value)} 
                className="w-full bg-slate-900 border border-white/10 rounded-2xl px-5 py-4 text-white text-base font-bold outline-none focus:border-indigo-500 transition-colors duration-150 shadow-inner"
                required 
              />
              {tipoDeuda === 'fija' && (
                <div className="flex flex-wrap gap-1.5 mt-2 ml-1">
                  <span className="text-xs text-slate-400 font-bold uppercase mr-1 self-center">Sugeridos:</span>
                  {["Préstamo Consumo", "Préstamo Vehículo", "Hipotecario"].map((sug) => (
                    <button
                      key={sug}
                      type="button"
                      onClick={() => setTitulo(sug)}
                      className="text-xs bg-white/5 hover:bg-white/10 text-slate-300 font-bold px-2.5 py-1.5 rounded-lg border border-white/5 transition-colors duration-150"
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="form-actions pt-4 flex justify-end">
              <button 
                type="button" 
                disabled={!titulo.trim()} 
                onClick={() => setPasoDeuda(2)} 
                className="w-full py-4 bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-indigo-600 text-white font-black text-xs uppercase rounded-2xl shadow-xl shadow-indigo-600/20 flex items-center justify-center gap-2 transition-colors duration-150"
              >
                Siguiente: Montos y Cuotas <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ── PASO 2: Montos, Moneda y Cuotas ── */}
        {pasoDeuda === 2 && (
          <div className="space-y-4">
            {tipoDeuda !== 'tarjeta_credito' && (
              <div className="space-y-1">
                <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1">Forma de Ingreso del Monto</label>
                <div className="flex p-1 bg-white/5 rounded-2xl border border-white/5">
                  <button
                    type="button"
                    onClick={() => cambiarModoMonto('cuota')}
                    className={`flex-1 py-2.5 text-xs font-black uppercase rounded-xl transition-colors duration-150 ${modoMonto === 'cuota' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-400'}`}
                  >
                    Ingresar por Cuota
                  </button>
                  <button
                    type="button"
                    onClick={() => cambiarModoMonto('total')}
                    className={`flex-1 py-2.5 text-xs font-black uppercase rounded-xl transition-colors duration-150 ${modoMonto === 'total' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-400'}`}
                  >
                    Ingresar por Monto Total
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1">
                <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1">
                  {tipoDeuda === 'tarjeta_credito' 
                    ? 'Monto Deuda Actual' 
                    : (modoMonto === 'cuota' ? 'Monto Cuota Mensual' : 'Monto Total Deuda')
                  }
                </label>
                <input 
                  type="text" 
                  value={montoTotalFormateado} 
                  onChange={(e) => setMontoTotalFormateado(formatarInput(e.target.value))} 
                  className="w-full bg-slate-900 border border-white/10 rounded-2xl px-4 py-4 text-xl font-black text-indigo-400 outline-none focus:border-indigo-500" 
                  placeholder="0" 
                  required 
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1">Moneda</label>
                <select 
                  value={monedaDeuda} 
                  onChange={(e) => setMonedaDeuda(e.target.value)} 
                  className="w-full bg-slate-900 border border-white/10 rounded-2xl px-3 py-4 text-white font-bold outline-none text-base"
                >
                  <option value="PYG">PYG (Gs.)</option>
                  <option value="BRL">BRL (R$)</option>
                </select>
              </div>
            </div>

            {(() => {
              const inputVal = desformatearInput(montoTotalFormateado) || 0;
              const numCuotas = parseInt(cantidadCuotas) || 1;
              if (!inputVal) return null;

              if (tipoDeuda !== 'tarjeta_credito') {
                if (modoMonto === 'cuota') {
                  const totalCalculado = inputVal * numCuotas;
                  return (
                    <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl text-xs text-indigo-200 font-bold flex justify-between items-center">
                      <span>📊 Monto Total estimado:</span>
                      <span className="text-indigo-400 text-xs font-black">{formatearNumero(totalCalculado, monedaDeuda)}</span>
                    </div>
                  );
                } else {
                  const cuotaCalculada = Math.round(inputVal / numCuotas);
                  return (
                    <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl text-xs text-indigo-200 font-bold flex justify-between items-center">
                      <span>📊 Cuota estimada (lineal):</span>
                      <span className="text-indigo-400 text-xs font-black">{formatearNumero(cuotaCalculada, monedaDeuda)}</span>
                    </div>
                  );
                }
              }
              return null;
            })()}

            {tipoDeuda === 'tarjeta_credito' ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1">Pago Mínimo</label>
                  <input type="text" value={pagoMinimoFormateado} onChange={(e) => setPagoMinimoFormateado(formatarInput(e.target.value))} className="w-full bg-slate-900 border border-white/10 rounded-2xl px-4 py-3.5 text-white outline-none text-base" placeholder="0" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1">Línea de Crédito</label>
                  <input type="text" value={lineaCreditoFormateada} onChange={(e) => setLineaCreditoFormateada(formatarInput(e.target.value))} className="w-full bg-slate-900 border border-white/10 rounded-2xl px-4 py-3.5 text-white outline-none text-base" placeholder="0" />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1">Cuotas Totales</label>
                  <input type="number" min="1" value={cantidadCuotas} onChange={(e) => setCantidadCuotas(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-2xl px-4 py-3.5 text-white font-bold outline-none text-base" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1">Cuotas Ya Pagadas</label>
                  <input type="number" min="0" max={cantidadCuotas} value={cuotasPagadas} onChange={(e) => setCuotasPagadas(e.target.value)} className="w-full bg-emerald-500/10 border border-emerald-500/20 rounded-2xl px-4 py-3.5 text-emerald-400 font-bold outline-none text-base" />
                </div>
              </div>
            )}

            <div className="form-actions pt-4 flex gap-3">
              <button 
                type="button" 
                onClick={() => setPasoDeuda(1)} 
                className="py-4 px-5 bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-xs uppercase rounded-2xl flex items-center justify-center gap-1 transition-colors duration-150"
              >
                <ArrowLeft size={16} /> Atrás
              </button>
              <button 
                type="button" 
                disabled={!montoTotalFormateado} 
                onClick={() => setPasoDeuda(3)} 
                className="flex-1 py-4 bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-indigo-600 text-white font-black text-xs uppercase rounded-2xl shadow-xl shadow-indigo-600/20 flex items-center justify-center gap-2 transition-colors duration-150"
              >
                Siguiente: Vencimiento <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ── PASO 3: Vencimientos y Opciones Avanzadas ── */}
        {pasoDeuda === 3 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-black text-indigo-400 uppercase tracking-wider ml-1">Fecha 1º Vencimiento</label>
                <input type="date" value={fechaInicioDeuda} onChange={(e) => setFechaInicioDeuda(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-2xl px-4 py-3.5 text-white text-base font-bold outline-none" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1">Día de Cobro Mensual</label>
                <input type="number" min="1" max="31" value={diaVencimiento} onChange={(e) => setDiaVencimiento(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-2xl px-4 py-3.5 text-white font-bold outline-none text-base" />
              </div>
            </div>

            {tipoDeuda === 'tarjeta_credito' && (
              <div className="space-y-1">
                <label htmlFor="deuda-dia-cierre" className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1">Día de Cierre de la Tarjeta</label>
                <input id="deuda-dia-cierre" type="number" inputMode="numeric" min="1" max="31" value={fechaCierreTarjeta} onChange={(e) => setFechaCierreTarjeta(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-2xl px-4 py-3.5 text-white font-bold outline-none text-base focus:border-indigo-500/50" />
                <p className="text-xs text-slate-400 ml-1">Ese día se cierra el ciclo y se genera el saldo del mes siguiente.</p>
              </div>
            )}

            {/* BOTÓN COLAPSABLE AVANZADO */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setModoAvanzadoDeuda(!modoAvanzadoDeuda)}
                className="w-full py-3 px-4 bg-white/5 hover:bg-white/10 border border-white/10 text-indigo-300 text-xs font-bold rounded-2xl flex items-center justify-between transition-colors duration-150"
              >
                <span className="flex items-center gap-2">
                  <Settings2 size={16} />
                  {modoAvanzadoDeuda ? "Ocultar Intereses y CBU / Alias" : "Agregar Intereses o CBU / Alias (Opcional)"}
                </span>
                {modoAvanzadoDeuda ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
            </div>


              {modoAvanzadoDeuda && (
                <div
                  className="space-y-3 overflow-hidden pt-2 border-t border-white/10"
                >
                  {tipoDeuda === 'tarjeta_credito' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-indigo-400 uppercase ml-1 flex items-center gap-1"><Hash size={12}/> Últimos 4 dígitos</label>
                        <input type="text" maxLength="4" placeholder="Ej: 1234" value={nroTarjeta} onChange={(e) => setNroTarjeta(e.target.value.replace(/\D/g,''))} className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white font-black tracking-widest outline-none text-base" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-indigo-400 uppercase ml-1 flex items-center gap-1"><Percent size={12}/> Interés Anual (%)</label>
                        <input type="number" step="0.01" min="0" placeholder="Ej: 15" value={tasaInteres} onChange={(e) => setTasaInteres(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white outline-none text-base" />
                      </div>
                    </div>
                  )}

                  {tipoDeuda === 'fija' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-indigo-400 uppercase ml-1 flex items-center gap-1"><Percent size={12}/> Interés Anual (%)</label>
                        <input type="number" step="0.01" min="0" placeholder="Ej: 24" value={tasaInteres} onChange={(e) => setTasaInteres(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white outline-none text-base" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-indigo-400 uppercase ml-1 flex items-center gap-1">🛡️ Seguros / Cuota</label>
                        <input type="text" placeholder="Ej: 4.500" value={cargosMensualesFormateado} onChange={(e) => setCargosMensualesFormateado(formatarInput(e.target.value))} className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white outline-none text-base" />
                      </div>
                    </div>
                  )}

                  {/* Medio de pago & Cuenta */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase ml-1">Medio de Pago habitual</label>
                    <div className="flex p-1 bg-white/5 rounded-2xl border border-white/5">
                      <button type="button" onClick={() => setDeudaMedioPago('transferencia')} className={`flex-1 py-2 text-xs font-black uppercase rounded-xl transition-colors duration-150 ${deudaMedioPago === 'transferencia' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400'}`}>Transferencia</button>
                      <button type="button" onClick={() => setDeudaMedioPago('efectivo')} className={`flex-1 py-2 text-xs font-black uppercase rounded-xl transition-colors duration-150 ${deudaMedioPago === 'efectivo' ? 'bg-amber-700 text-white shadow-lg' : 'text-slate-400'}`}>Efectivo</button>
                    </div>
                  </div>

                  {deudaMedioPago === 'transferencia' && (
                    <div className="space-y-2">
                      <div className="flex p-1 bg-white/5 rounded-2xl border border-white/5">
                        <button type="button" onClick={() => setDeudaTipoCuenta('alias')} className={`flex-1 py-2 text-xs font-black uppercase rounded-xl transition-colors duration-150 ${deudaTipoCuenta === 'alias' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400'}`}>Alias / CBU</button>
                        <button type="button" onClick={() => setDeudaTipoCuenta('nro_cuenta')} className={`flex-1 py-2 text-xs font-black uppercase rounded-xl transition-colors duration-150 ${deudaTipoCuenta === 'nro_cuenta' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400'}`}>Nro. Cuenta</button>
                      </div>
                      {deudaTipoCuenta === 'alias' ? (
                        <input type="text" aria-label="Alias o CBU" placeholder="Ej: mi.alias.banco" value={deudaAliasCuenta} onChange={(e) => setDeudaAliasCuenta(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white text-base outline-none" />
                      ) : (
                        <>
                          <input type="text" aria-label="Número de cuenta" placeholder="Ej: 001-123456-00" value={deudaNroCuenta} onChange={(e) => setDeudaNroCuenta(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white text-base outline-none" />
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label htmlFor="deuda-titular" className="text-xs font-bold text-slate-400 uppercase ml-1">Nombre del Titular</label>
                              <input id="deuda-titular" type="text" autoComplete="name" placeholder="Titular de la cuenta" value={deudaNombreTitular} onChange={(e) => setDeudaNombreTitular(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white text-base outline-none focus:border-indigo-500/50" />
                            </div>
                            <div className="space-y-1">
                              <label htmlFor="deuda-ci" className="text-xs font-bold text-slate-400 uppercase ml-1">CI / Documento</label>
                              <input id="deuda-ci" type="text" inputMode="numeric" placeholder="Ej: 1234567" value={deudaCiTitular} onChange={(e) => setDeudaCiTitular(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white text-base outline-none focus:border-indigo-500/50" />
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}


            {zonaPeligro && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-2xl flex gap-3 items-center">
                <AlertTriangle className="text-red-500 shrink-0" size={20} />
                <p className="text-xs text-red-200 font-bold">🚨 ¡Índice al {proyectado.toFixed(1)}%! Superás el límite saludable del BCP (40%).</p>
              </div>
            )}

            <div className="form-actions pt-2 flex gap-3">
              <button 
                type="button" 
                onClick={() => setPasoDeuda(2)} 
                className="py-4 px-5 bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-xs uppercase rounded-2xl flex items-center justify-center gap-1 transition-colors duration-150"
              >
                <ArrowLeft size={16} /> Atrás
              </button>
              <button 
                type="submit" 
                disabled={guardando} 
                className={`flex-1 py-4 font-black uppercase text-xs rounded-2xl shadow-xl transition-colors duration-150 flex items-center justify-center gap-2 ${zonaPeligro ? 'bg-red-600' : 'bg-indigo-600 hover:bg-indigo-600'} text-white`}
              >
                {guardando ? <Loader2 className="animate-spin mx-auto" size={18} /> : (deudaEditandoId ? "GUARDAR CAMBIOS" : "FINALIZAR Y REGISTRAR")}
              </button>
            </div>
          </div>
        )}

      </form>
    </FormPage>
  );
}
