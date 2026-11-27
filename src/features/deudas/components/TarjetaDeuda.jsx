import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Sparkles, Lock, Users, AlertTriangle, ChevronDown, ChevronUp, Calendar, Trash2, Hash, Edit2, Clock } from 'lucide-react';
import { formatearNumero, formatearFechaCorta, obtenerFechaCierreExacta, obtenerPlanAmortizacion } from '../../../shared/lib/formatters';

/** Tarjeta expandible de una deuda (préstamo, cuotas o tarjeta de crédito). */
export default function TarjetaDeuda({ d, pestana, datosHogar, deudaExpandida, setDeudaExpandida, usuarioActual, usuarios, abrirEdicionMedioPago, iniciarEdicionDeuda, eliminarDeuda, cerrarCicloTarjeta, deshacerCierreTarjeta, verificarSiFuePagadaEsteMes, onCargarCompra, onAbonar }) {
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
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-4">
        <div onClick={() => setDeudaExpandida(estaExpandida ? null : d.id)} className="cursor-pointer min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h4 className="font-bold text-white text-lg leading-tight break-words">{d.titulo}</h4>
            {d.alcance === 'individual' ? (
              <div className="flex items-center gap-1 bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded-md text-xs font-black uppercase border border-amber-500/20"><Lock size={10}/> {esMia ? 'Mía' : `De ${nombreCreador}`}</div>
            ) : (
              <div className="flex items-center gap-1 bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-md text-xs font-black uppercase border border-indigo-500/20"><Users size={10}/> Familiar</div>
            )}
            {pagadaEsteMes && (
              <div className="bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded-md text-xs font-black uppercase border border-emerald-500/25">
                ✓ Este mes pagado
              </div>
            )}
          </div>
          <p className="text-xs text-slate-400 uppercase font-black tracking-tighter mt-1">
            {d.tipo === 'tarjeta_credito' ? '💳 Tarjeta de Crédito' : (d.tipo === 'fija' ? '🏦 Préstamo Fijo' : '📈 Crédito Flexible')}
            {d.nro_tarjeta && ` • Term. ${d.nro_tarjeta}`}
            {d.tasa_interes > 0 && ` • Interés: ${d.tasa_interes}%`}
            {` • ${d.alcance}`}
          </p>
          {d.medio_pago === 'transferencia' ? (
            <button
              type="button"
              onClick={() => abrirEdicionMedioPago(d, 'deuda')}
              className="text-xs text-indigo-400/80 font-bold mt-0.5 flex items-center gap-1 hover:text-indigo-300 transition-colors cursor-pointer bg-transparent border-0 p-0"
            >
              {d.tipo_cuenta === 'alias' && d.alias_cuenta && (
                <><Hash size={10} /> Alias: {d.alias_cuenta} <Edit2 size={9} className="ml-0.5 opacity-60" /></>
              )}
              {d.tipo_cuenta === 'nro_cuenta' && d.nro_cuenta && (
                <><Hash size={10} /> Cta: {d.nro_cuenta} {d.nombre_titular ? `• ${d.nombre_titular}` : ''} <Edit2 size={9} className="ml-0.5 opacity-60" /></>
              )}
              {!d.alias_cuenta && !d.nro_cuenta && (
                <>Transferencia <Edit2 size={9} className="ml-0.5 opacity-60" /></>
              )}
            </button>
          ) : d.medio_pago === 'efectivo' ? (
            <button
              type="button"
              onClick={() => abrirEdicionMedioPago(d, 'deuda')}
              className="text-xs text-amber-400/80 font-bold mt-0.5 flex items-center gap-1 hover:text-amber-300 transition-colors cursor-pointer bg-transparent border-0 p-0"
            >
              💵 Pago en efectivo <Edit2 size={9} className="ml-0.5 opacity-60" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => abrirEdicionMedioPago(d, 'deuda')}
              className="text-xs text-slate-400 font-bold mt-0.5 flex items-center gap-1 hover:text-slate-300 transition-colors cursor-pointer bg-transparent border-0 p-0 border border-dashed border-slate-600 rounded-full px-2 py-0.5"
            >
              ⚠️ Sin medio de pago <Edit2 size={9} />
            </button>
          )}
        </div>
        <div className="flex flex-row-reverse sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0">
          {(() => {
            const hoy = new Date();
            hoy.setHours(0, 0, 0, 0);
            const cuotasVencidas = d.cuotas_detalle?.filter(c => {
              if (c.estado !== 'pendiente') return false;
              const fv = new Date(c.fecha_vencimiento);
              fv.setHours(0, 0, 0, 0);
              return fv < hoy;
            }) || [];

            if (cuotasVencidas.length > 0) {
              const totalAtrasado = cuotasVencidas.reduce((acc, c) => acc + (Number(c.monto_cuota) - Number(c.monto_abonado)), 0);
              return (
                <div className="bg-red-600/20 text-red-400 text-xs font-black px-2.5 py-1 rounded-md border border-red-500/40 animate-pulse flex items-center gap-1">
                  <AlertTriangle size={11} /> {cuotasVencidas.length} {cuotasVencidas.length === 1 ? 'CUOTA ATRASADA' : 'CUOTAS ATRASADAS'} ({formatearNumero(totalAtrasado, d.moneda)})
                </div>
              );
            }
            if (cuotaActual) {
              return <div className="bg-red-500/10 text-red-400 text-xs font-black px-2 py-1 rounded-md border border-red-500/20">VENCE {formatearFechaCorta(cuotaActual.fecha_vencimiento)}</div>;
            }
            return null;
          })()}
          <div className="flex items-center gap-1">
            {(esMia || datosHogar.rol === 'superadmin' || datosHogar.rol === 'admin_hogar') && (
              <button 
                type="button"
                onClick={() => iniciarEdicionDeuda(d)} 
                className="p-1.5 inline-flex items-center justify-center text-slate-400 hover:text-indigo-400 hover:bg-white/5 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                title="Editar compromiso"
                aria-label={`Editar ${d.titulo}`}
              >
                <Edit2 size={14} />
              </button>
            )}
            {(esMia || datosHogar.rol === 'superadmin' || datosHogar.rol === 'admin_hogar') && (
              <button 
                type="button"
                onClick={() => eliminarDeuda(d)} 
                className="p-1.5 inline-flex items-center justify-center text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                title="Eliminar compromiso"
                aria-label={`Eliminar ${d.titulo}`}
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
              <div className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-0.5">Uso de Línea</div>
              <div className="text-sm font-black text-white">
                {formatearNumero(Math.max(0, d.linea_credito_total - d.linea_credito_disponible), d.moneda)}
                <span className="text-slate-400 font-bold text-xs"> / {formatearNumero(d.linea_credito_total, d.moneda)}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDeudaExpandida(estaExpandida ? null : d.id)}
              className="text-xs font-black uppercase text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 bg-indigo-500/5 hover:bg-indigo-600/10 px-3.5 py-2 rounded-xl border border-indigo-500/15 transition-all active:scale-95 shadow-sm"
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

                  // 3. Evaluar TODAS las cuotas atrasadas acumuladas
                  const cuotasVencidas = d.cuotas_detalle?.filter(c => {
                    if (c.estado !== 'pendiente') return false;
                    const fv = new Date(c.fecha_vencimiento);
                    fv.setHours(0, 0, 0, 0);
                    return fv < hoy;
                  }) || [];

                  if (cuotasVencidas.length > 0) {
                    const fechasStr = cuotasVencidas.map(c => formatearFechaCorta(c.fecha_vencimiento)).join(", ");
                    alertas.push({
                      id: 'cuotas_vencidas_multiples',
                      icono: <AlertTriangle size={14} className="animate-bounce text-red-400 shrink-0" />,
                      texto: `⚠️ ¡ATENCIÓN! Tenés ${cuotasVencidas.length} ${cuotasVencidas.length === 1 ? 'cuota atrasada' : 'cuotas atrasadas'} (Vencidas el: ${fechasStr})`,
                      clase: 'bg-red-600/20 border-red-500/40 text-red-300 font-black'
                    });
                  } else if (cuotaActual && cuotaActual.estado === 'pendiente') {
                    const venc = new Date(cuotaActual.fecha_vencimiento);
                    venc.setHours(0, 0, 0, 0);
                    const diffVencDays = Math.ceil((venc - hoy) / (1000 * 60 * 60 * 24));

                    if (diffVencDays === 0) {
                      alertas.push({
                        id: 'vence_hoy',
                        icono: <AlertTriangle size={12} className="animate-pulse text-red-400 shrink-0" />,
                        texto: 'PAGO VENCE HOY 🚨',
                        clase: 'bg-red-500/15 border-red-500/35 text-red-400 font-extrabold'
                      });
                    } else if (diffVencDays > 0 && diffVencDays <= 3) {
                      alertas.push({
                        id: 'vence_pronto',
                        icono: <Clock size={12} className="text-amber-400 shrink-0" />,
                        texto: `Vence en ${diffVencDays} ${diffVencDays === 1 ? 'día' : 'días'} ⏳`,
                        clase: 'bg-amber-500/10 border-amber-500/25 text-amber-400'
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

                  if (alertas.length === 0) return null;

                  return (
                    <div className="space-y-1.5">
                      {alertas.map(al => (
                        <div key={al.id} className={`p-2 border rounded-xl flex items-center gap-2 text-xs font-bold uppercase ${al.clase}`}>
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
                    <div className="text-xs text-slate-400 uppercase font-bold">Disponible</div>
                    <div className={`text-xs font-black ${d.linea_credito_disponible < 0 ? 'text-red-400' : 'text-indigo-400'}`}>
                      {formatearNumero(d.linea_credito_disponible, d.moneda)}
                    </div>
                  </div>
                  <div className="bg-white/[0.02] border border-white/5 p-2 rounded-xl">
                    <div className="text-xs text-slate-400 uppercase font-bold">Consumido</div>
                    <div className="text-xs font-black text-slate-300">
                      {formatearNumero(Math.max(0, d.linea_credito_total - d.linea_credito_disponible), d.moneda)}
                    </div>
                  </div>
                  <div className="bg-white/[0.02] border border-white/5 p-2 rounded-xl text-right">
                    <div className="text-xs text-slate-400 uppercase font-bold">Línea Total</div>
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
                    <div className="border-t border-white/5 pt-3 space-y-1.5 text-xs text-slate-400 font-bold uppercase tracking-tight">
                      <div className="flex justify-between">
                        <span>📅 Cierre Anterior:</span>
                        <span className="text-slate-400">{formatearFechaCorta(prevCierreStr)}</span>
                      </div>
                      <div className="flex justify-between text-indigo-400 font-black">
                        <span>📅 Cierre Actual:</span>
                        <span>{formatearFechaCorta(cierreActualStr)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>📅 Próximo Cierre:</span>
                        <span className="text-slate-400">{formatearFechaCorta(nextCierreStr)}</span>
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
                    <div className="p-2.5 bg-indigo-500/5 border border-indigo-500/10 rounded-xl text-xs text-indigo-300/80 leading-relaxed normal-case">
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
          <div className="flex justify-between text-xs font-bold text-slate-400 uppercase mb-1">
            <span>Progreso ({cuotasPagadasCount}/{cuotasTotalesCount} cuotas)</span>
            <span>{porcProgreso.toFixed(0)}%</span>
          </div>
          <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden"><div style={{ width: `${porcProgreso}%` }} className="h-full bg-indigo-500" /></div>
        </div>
      )}

      {(() => {
        let montoAPagar = 0;
        let etiquetaMonto = 'Cuota Actual';
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);

        const cuotasAtrasadas = d.cuotas_detalle?.filter(c => {
          if (c.estado !== 'pendiente') return false;
          const fv = new Date(c.fecha_vencimiento);
          fv.setHours(0, 0, 0, 0);
          return fv < hoy;
        }) || [];

        if (pestana === 'activas') {
          if (cuotasAtrasadas.length > 0) {
            etiquetaMonto = `${cuotasAtrasadas.length} ${cuotasAtrasadas.length === 1 ? 'Cuota Atrasada' : 'Cuotas Atrasadas'}`;
            montoAPagar = cuotasAtrasadas.reduce((acc, c) => acc + (Number(c.monto_cuota) - Number(c.monto_abonado)), 0);
          } else if (cuotaActual) {
            if (d.tipo === 'tarjeta_credito') {
              etiquetaMonto = 'Pago Mínimo';
              const minPago = cuotaActual.pago_minimo || cuotaActual.monto_cuota;
              montoAPagar = Math.max(0, minPago - Number(cuotaActual.monto_abonado));
            } else {
              montoAPagar = cuotaActual.monto_cuota - cuotaActual.monto_abonado;
            }
          }
        } else {
          etiquetaMonto = 'Total Pagado';
          montoAPagar = totalPagado;
        }
        return (
          <div className="flex justify-between items-end">
            <div>
              <div className="text-xs text-slate-400 uppercase font-bold mb-1">{etiquetaMonto}</div>
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
                      onClick={() => { onCargarCompra(d); }}
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
                    onClick={() => { onAbonar(cuotaActual, d); }} 
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
              <table className="w-full text-left text-xs text-slate-400">
                <thead>
                  <tr className="border-b border-white/5 uppercase text-xs text-slate-400 font-bold">
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
                          <td className="py-2.5 text-slate-400 font-bold">{formatearNumero(c.cargos || 0, d.moneda)}</td>
                          <td className="py-2.5 text-right text-white font-black">{formatearNumero(c.monto_cuota, d.moneda)}</td>
                          <td className="py-2.5 text-right">
                            <span className={`px-2 py-0.5 rounded-md font-black uppercase text-xs border ${c.estado === 'pagado' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
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
              {d.cuotas_detalle?.sort((a,b)=>a.numero_cuota-b.numero_cuota).map(c => {
                const closedCuotas = d.cuotas_detalle?.filter(x => x.estado === 'pagado') || [];
                const maxClosedNum = closedCuotas.length > 0 ? Math.max(...closedCuotas.map(x => x.numero_cuota)) : -1;
                const nextPendiente = d.cuotas_detalle?.find(x => x.numero_cuota === c.numero_cuota + 1 && x.estado === 'pendiente');
              
                return (
                  <div key={c.id} className="flex justify-between items-center text-xs bg-white/5 p-2 rounded-xl">
                    <div className="flex items-center">
                      <span className={c.estado==='pagado'?'text-emerald-400':'text-slate-400'}>
                        Cuota {c.numero_cuota} • {c.estado === 'pagado' ? 'Pagado' : `Vence: ${formatearFechaCorta(c.fecha_vencimiento)}`}
                      </span>
                      {d.tipo === 'tarjeta_credito' && c.estado === 'pagado' && c.numero_cuota === maxClosedNum && nextPendiente && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            deshacerCierreTarjeta(d, c);
                          }}
                          className="ml-2 text-xs bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-black px-2 py-0.5 rounded border border-rose-500/20 transition-all uppercase tracking-wider"
                        >
                          Deshacer Cierre
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-bold">{formatearNumero(c.monto_cuota, d.moneda)}</span>
                      {c.estado === 'pendiente' && (d.alcance === 'familiar' || esMia) && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onAbonar(c, d);
                          }}
                          className="bg-indigo-600 hover:bg-indigo-600 text-white text-xs font-black px-2.5 py-1 rounded-lg uppercase shadow-sm transition-all active:scale-95"
                        >
                          ABONAR
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}
