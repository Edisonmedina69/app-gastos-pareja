import { FormPage } from '../../../shared/ui/FormPage';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, TrendingUp, X, Clock, Loader2, Link2, ArrowRight, ArrowLeft } from 'lucide-react';
import { formatearNumero, formatarInput, desformatearInput } from '../../../shared/lib/formatters';

export default function ModalIngreso({ CATEGORIAS_INGRESO, ajusteDiaHabil, categoria, concepto, conceptoDescuento, deudaVinculadaId, deudas, diaRecurrencia, fechaEfectiva, guardando, modoDescuento, moneda, montoAnterior, montoDescuentoFormateado, montoFormateado, mostrarModal, pasoIngreso, registrarIngreso, resetForm, setAjusteDiaHabil, setCategoria, setConcepto, setConceptoDescuento, setDeudaVinculadaId, setDiaRecurrencia, setFechaEfectiva, setModoDescuento, setMoneda, setMontoDescuentoFormateado, setMontoFormateado, setMostrarModal, setPasoIngreso, setSoloDiasHabiles, soloDiasHabiles, tipoRegistro }) {
  return (
    <AnimatePresence>
      {mostrarModal && (
        <FormPage ariaLabel={tipoRegistro === 'variable' ? 'Registrar ingreso' : tipoRegistro === 'fijo' ? 'Programar sueldo' : 'Ajustar sueldo'} onClose={() => { setMostrarModal(false); resetForm(); }} resumen={<><p className="font-bold">{concepto || 'Ingreso'}</p><p className="text-2xl tabular-nums mt-3">{formatearNumero(desformatearInput(montoFormateado) || 0, moneda)}</p><p className="text-muted-foreground mt-2">{categoria}</p></>}>

            {/* Header Wizard Ingresos */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
                  {tipoRegistro === 'variable' ? <Plus className="text-emerald-400" size={20}/> : <Clock className="text-indigo-400" size={20}/>}
                  {tipoRegistro === 'variable' ? 'Registrar Ingreso' : (tipoRegistro === 'fijo' ? 'Programar Sueldo' : 'Ajustar Sueldo')}
                </h2>
                {(tipoRegistro === 'fijo' || tipoRegistro === 'edicion') && (
                  <span className="text-xs font-black uppercase text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 rounded-full">
                    Paso {pasoIngreso} de 2
                  </span>
                )}
              </div>
              {(tipoRegistro === 'fijo' || tipoRegistro === 'edicion') && (
                <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden flex gap-1 p-0.5">
                  <div className={`h-full flex-1 rounded-full transition-all duration-300 ${pasoIngreso >= 1 ? 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]' : 'bg-slate-800'}`} />
                  <div className={`h-full flex-1 rounded-full transition-all duration-300 ${pasoIngreso >= 2 ? 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]' : 'bg-slate-800'}`} />
                </div>
              )}
            </div>

            <form onSubmit={registrarIngreso} className="space-y-4">
              {/* Paso 1 o Formulario Directo (Si es Ingreso Variable) */}
              {(pasoIngreso === 1 || tipoRegistro === 'variable') && (
                <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                  <div>
                    <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1 mb-1 block">Categoría de Ingreso</label>
                    <select 
                      value={categoria} 
                      onChange={(e) => setCategoria(e.target.value)} 
                      className="w-full bg-slate-900 border border-white/10 rounded-2xl px-4 py-3.5 text-white font-bold outline-none text-base"
                    >
                      {CATEGORIAS_INGRESO.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1">Concepto / Fuente</label>
                    <input type="text" placeholder="Ej: Sueldo Itaú, Honorarios Proyecto..." value={concepto} onChange={(e) => setConcepto(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-2xl px-4 py-3.5 text-white font-bold outline-none focus:border-emerald-500 text-base" required />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2 space-y-1">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1">Monto del Ingreso</label>
                      <input 
                        type="text" 
                        value={montoFormateado} 
                        onChange={(e) => setMontoFormateado(formatarInput(e.target.value))} 
                        className="w-full bg-slate-900 border border-white/10 rounded-2xl px-4 py-3.5 text-xl font-black text-emerald-400 outline-none" 
                        placeholder="0"
                        required 
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1">Moneda</label>
                      <select value={moneda} onChange={(e) => setMoneda(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-2xl px-3 py-3.5 text-white font-bold outline-none text-base" disabled={tipoRegistro === 'edicion'}>
                        <option value="PYG">PYG</option>
                        <option value="BRL">BRL</option>
                        <option value="USD">USD</option>
                      </select>
                    </div>
                  </div>

                  {tipoRegistro === 'variable' && (
                    <div className="space-y-1">
                      <label className="text-xs font-black text-emerald-400 uppercase tracking-wider ml-1">Fecha de Ingreso</label>
                      <input type="date" value={fechaEfectiva} onChange={(e) => setFechaEfectiva(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-2xl px-4 py-3.5 text-white font-bold outline-none text-base" required />
                    </div>
                  )}

                  {(tipoRegistro === 'fijo' || tipoRegistro === 'edicion') && (
                    <div className="space-y-1">
                      <label className="text-xs font-black text-indigo-400 uppercase tracking-wider ml-1">Día de Cobro Mensual (1-31)</label>
                      <input type="number" min="1" max="31" value={diaRecurrencia} onChange={(e) => setDiaRecurrencia(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-2xl px-4 py-3.5 text-white font-black outline-none text-base" required />
                    </div>
                  )}

                  {tipoRegistro === 'variable' ? (
                    <button type="submit" disabled={guardando} className="form-actions w-full py-4 font-black rounded-2xl bg-emerald-700 hover:bg-emerald-700 text-white shadow-xl shadow-emerald-900/20 active:scale-95 transition-all mt-2">
                      {guardando ? <Loader2 className="animate-spin mx-auto" size={18} /> : "REGISTRAR INGRESO"}
                    </button>
                  ) : (
                    <div className="form-actions pt-2">
                      <button 
                        type="button" 
                        disabled={!concepto.trim() || !montoFormateado} 
                        onClick={() => setPasoIngreso(2)} 
                        className="w-full py-4 bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-indigo-600 text-white font-black text-xs uppercase rounded-2xl shadow-xl shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all"
                      >
                        Siguiente: Reglas y Descuentos <ArrowRight size={16} />
                      </button>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Paso 2: Reglas de Días Hábiles & Descuentos Automáticos */}
              {pasoIngreso === 2 && (tipoRegistro === 'fijo' || tipoRegistro === 'edicion') && (
                <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                  <div className="p-4 bg-white/5 border border-white/5 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-300">¿Cobrar solo en Días Hábiles?</span>
                      <input 
                        type="checkbox" 
                        checked={soloDiasHabiles} 
                        onChange={(e) => setSoloDiasHabiles(e.target.checked)} 
                        className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
                      />
                    </div>
                    {soloDiasHabiles && (
                      <div className="space-y-1 pt-2 border-t border-white/5">
                        <label className="text-xs font-bold text-slate-400 uppercase block">Si cae Fin de Semana:</label>
                        <select 
                          value={ajusteDiaHabil} 
                          onChange={(e) => setAjusteDiaHabil(e.target.value)}
                          className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-base text-white font-bold"
                        >
                          <option value="anterior">Anticipar al Viernes anterior</option>
                          <option value="siguiente">Postergar al Lunes siguiente</option>
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl space-y-3">
                    <span className="text-xs font-black text-indigo-300 uppercase tracking-tight block flex items-center gap-1.5">
                      <Link2 size={14}/> Vincular Cuenta o Pago Automático
                    </span>

                    <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-900 rounded-xl">
                      {[
                        { id: 'ninguno', label: 'Sin pago' },
                        { id: 'vinculado', label: 'Cuenta reg.' },
                        { id: 'manual', label: 'Monto fijo' },
                      ].map(modo => (
                        <button
                          key={modo.id}
                          type="button"
                          onClick={() => setModoDescuento(modo.id)}
                          className={`py-1.5 text-xs font-black uppercase rounded-lg transition-all ${modoDescuento === modo.id ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                        >
                          {modo.label}
                        </button>
                      ))}
                    </div>

                    {modoDescuento === 'vinculado' && (
                      <div className="space-y-2 pt-1">
                        <label className="text-xs font-bold text-slate-400 uppercase block">Seleccionar Cuenta o Deuda Registrada</label>
                        <select
                          value={deudaVinculadaId}
                          onChange={(e) => setDeudaVinculadaId(e.target.value)}
                          className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5 text-base text-white font-bold"
                        >
                          <option value="">-- Seleccionar cuenta a pagar --</option>
                          {deudas.filter(d => d.estado !== 'cerrada').map(d => {
                            const cuotaPend = d.cuotas_detalle?.find(c => c.estado === 'pendiente');
                            const montoPend = cuotaPend ? Math.max(0, Number(cuotaPend.monto_cuota) - Number(cuotaPend.monto_abonado)) : 0;
                            return (
                              <option key={d.id} value={d.id}>
                                {d.titulo} ({formatearNumero(montoPend, d.moneda)})
                              </option>
                            );
                          })}
                        </select>
                        {deudaVinculadaId && (
                          <p className="text-xs text-emerald-400 font-bold">
                            Al cobrar el sueldo, se debitará y pagará automáticamente la cuota pendiente de esta cuenta.
                          </p>
                        )}
                      </div>
                    )}

                    {modoDescuento === 'manual' && (
                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <input 
                          type="text" 
                          placeholder="Ej: IPS, Gym, Alquiler" 
                          value={conceptoDescuento} 
                          onChange={(e) => setConceptoDescuento(e.target.value)} 
                          className="bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-base text-white"
                        />
                        <input 
                          type="text" 
                          placeholder="Monto descuento" 
                          value={montoDescuentoFormateado} 
                          onChange={(e) => setMontoDescuentoFormateado(formatarInput(e.target.value))} 
                          className="bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-base font-bold text-red-400"
                        />
                      </div>
                    )}
                  </div>

                  {tipoRegistro === 'edicion' && desformatearInput(montoFormateado) > montoAnterior && (
                     <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-3"><TrendingUp className="text-emerald-500" size={18} /><p className="text-xs text-emerald-200 font-bold uppercase tracking-tighter">¡Crecimiento salarial detectado! 🚀</p></div>
                  )}

                  <div className="form-actions pt-2 flex gap-3">
                    <button 
                      type="button" 
                      onClick={() => setPasoIngreso(1)} 
                      className="py-4 px-5 bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-xs uppercase rounded-2xl flex items-center justify-center gap-1 transition-all"
                    >
                      <ArrowLeft size={16} /> Atrás
                    </button>
                    <button 
                      type="submit" 
                      disabled={guardando} 
                      className="flex-1 py-4 font-black text-xs uppercase rounded-2xl bg-indigo-600 hover:bg-indigo-600 text-white shadow-xl shadow-indigo-600/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                      {guardando ? <Loader2 className="animate-spin mx-auto" size={18} /> : "FINALIZAR Y CONSOLIDAR"}
                    </button>
                  </div>
                </motion.div>
              )}
            </form>
        </FormPage>
      )}
    </AnimatePresence>
  );
}
