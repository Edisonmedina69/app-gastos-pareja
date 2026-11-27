const today = new Date().toISOString().slice(0, 10);
export const user = { id: 'qa-user', nombre: 'Ana', rol: 'admin_hogar', espacio_id: 'qa-hogar' };
const seed = {
  deudas: [{ id: 'qa-deuda', titulo: 'Préstamo familiar', tipo: 'fija', estado: 'activa', alcance: 'familiar', moneda: 'PYG', creador_id: user.id, monto_total: 1500000, cantidad_cuotas: 6, dia_vencimiento: 28, permite_pago_parcial: false, medio_pago: 'efectivo', cuotas_detalle: [{ id: 'qa-cuota', deuda_maestra_id: 'qa-deuda', numero_cuota: 1, monto_cuota: 250000, monto_abonado: 0, estado: 'pendiente', fecha_vencimiento: today }] }, { id: 'qa-tarjeta', titulo: 'Tarjeta del hogar', tipo: 'tarjeta_credito', estado: 'activa', alcance: 'familiar', moneda: 'PYG', creador_id: user.id, linea_credito_total: 5000000, linea_credito_disponible: 4200000, fecha_cierre_tarjeta: 25, dia_vencimiento: 28, permite_pago_parcial: true, medio_pago: 'efectivo', cuotas_detalle: [{ id: 'qa-cuota-tarjeta', deuda_maestra_id: 'qa-tarjeta', numero_cuota: 1, monto_cuota: 800000, pago_minimo: 80000, monto_abonado: 0, estado: 'pendiente', fecha_vencimiento: today }] }],
  gastos: [{ id: 'qa-gasto', concepto: 'Supermercado de la semana', monto: 180000, moneda: 'PYG', categoria: 'Supermercado', usuario_id: user.id, pagador_id: user.id, fecha: today }],
  ingresos: [{ id: 'qa-ingreso', concepto: 'Salario mensual', monto: 5000000, moneda: 'PYG', usuario_id: user.id, fecha_efectiva: today, fecha: today, mes: new Date().getMonth() + 1, anio: new Date().getFullYear() }],
  programados: [{ id: 'qa-fijo', concepto: 'Internet', monto: 150000, moneda: 'PYG', dia_recurrencia: 5, categoria: 'Casa', para_quien: 'Ambos', usuario_id: user.id }],
  salarios: [{ id: 'qa-sueldo', descripcion: 'Salario mensual', monto: 5000000, moneda: 'PYG', dia_recurrencia: 5, categoria: 'Salario Mensual', solo_dias_habiles: true, ajuste_dia_habil: 'anterior', usuario_id: user.id }],
  historial: [],
};
export const db = JSON.parse(sessionStorage.getItem('qa-data') || JSON.stringify(seed));
const save = () => sessionStorage.setItem('qa-data', JSON.stringify(db));
export async function call(name, args) {
  if (name === 'obtenerCotizacion') return 1;
  const [value, changes] = args;
  const cuotas = db.deudas.flatMap(d => d.cuotas_detalle || []);
  if (name === 'listarEstadosCuotas') return { data: cuotas.filter(c => c.deuda_maestra_id === value), error: null };
  if (name === 'obtenerCuota') return { data: cuotas.find(c => c.id === value), error: null };
  if (name === 'actualizarCuota') Object.assign(cuotas.find(c => c.id === value), changes);
  else if (name === 'insertarCuotas') for (const c of Array.isArray(value) ? value : [value]) db.deudas.find(d => d.id === c.deuda_maestra_id).cuotas_detalle.push({ id: crypto.randomUUID(), ...c });
  else if (name === 'eliminarCuotasDeDeuda') db.deudas.find(d => d.id === value).cuotas_detalle = [];
  else if (name === 'eliminarCuota') for (const d of db.deudas) d.cuotas_detalle = d.cuotas_detalle.filter(c => c.id !== value);
  else {
    const key = /IngresoProgramado|IngresosProgramados/.test(name) ? 'salarios' : /HistorialSalario/.test(name) ? 'historial' : /GastoProgramado|GastosProgramados/.test(name) ? 'programados' : /Deuda/.test(name) ? 'deudas' : /Ingreso/.test(name) ? 'ingresos' : /Gasto/.test(name) ? 'gastos' : null;
    if (!key) return { data: [], error: null };
    if (/^listar/.test(name)) return { data: db[key], error: null };
    if (/^actualizar/.test(name)) Object.assign(db[key].find(r => r.id === value), changes);
    if (/^eliminar/.test(name)) db[key] = db[key].filter(r => r.id !== value);
    if (/^(insertar|crear)/.test(name)) {
      const rows = (Array.isArray(value) ? value : [value]).map(r => ({ id: crypto.randomUUID(), created_at: today, cuotas_detalle: [], ...r }));
      db[key].push(...rows); save(); return { data: Array.isArray(value) ? rows : rows[0], error: null };
    }
  }
  save(); return { data: [], error: null };
}
