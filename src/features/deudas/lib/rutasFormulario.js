export function rutaFormulario(formulario) {
  const id = (item) => encodeURIComponent(item.id);
  switch (formulario.tipo) {
    case 'deuda': return formulario.deuda ? `/deudas/${id(formulario.deuda)}/editar` : '/deudas/nueva';
    case 'fijo': return formulario.fijo ? `/fijos/${id(formulario.fijo)}/editar` : '/fijos/nuevo';
    case 'prevision': return formulario.prevision ? `/previsiones/${id(formulario.prevision)}/editar` : '/previsiones/nueva';
    case 'abono': return `/deudas/${id(formulario.pago.maestra)}/abonos/${id(formulario.pago.cuota)}`;
    case 'compra': return `/deudas/${id(formulario.tarjeta)}/compras/nueva`;
    case 'pagarFijo': return `/fijos/${id(formulario.fijo)}/pagar`;
    case 'medioPago': return `/${formulario.tipoItem === 'deuda' ? 'deudas' : 'fijos'}/${id(formulario.item)}/medio-pago`;
    default: return '/deudas';
  }
}

export function resolverFormulario(pathname, deudas = [], programados = []) {
  const [area, id, accion, cuotaId] = pathname.split('/').filter(Boolean).map(decodeURIComponent);
  if (area === 'deudas' && id === 'nueva') return { tipo: 'deuda', deuda: null };
  if (area === 'fijos' && id === 'nuevo') return { tipo: 'fijo', fijo: null };
  if (area === 'previsiones' && id === 'nueva') return { tipo: 'prevision', prevision: null };
  const item = (area === 'deudas' ? deudas : programados).find(d => String(d.id) === id);
  if (!item) return null;
  if (accion === 'medio-pago') return { tipo: 'medioPago', item, tipoItem: area === 'deudas' ? 'deuda' : 'fijo' };
  if (area === 'deudas') {
    if (accion === 'editar') return { tipo: 'deuda', deuda: item };
    if (accion === 'compras') return { tipo: 'compra', tarjeta: item };
    const cuota = item.cuotas_detalle?.find(c => String(c.id) === cuotaId);
    if (accion === 'abonos' && cuota) return { tipo: 'abono', pago: { maestra: item, cuota } };
  }
  if (area === 'fijos' && accion === 'editar') return { tipo: 'fijo', fijo: item };
  if (area === 'fijos' && accion === 'pagar') return { tipo: 'pagarFijo', fijo: item };
  if (area === 'previsiones' && accion === 'editar') return { tipo: 'prevision', prevision: item };
  return null;
}
