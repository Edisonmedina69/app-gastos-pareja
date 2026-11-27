import test from 'node:test';
import assert from 'node:assert/strict';
import { rutaFormulario, resolverFormulario } from './rutasFormulario.js';

const cuota = { id: 'cuota-1' };
const deuda = { id: 'deuda-1', cuotas_detalle: [cuota] };
const fijo = { id: 'fijo-1' };
test('las URLs reconstruyen cada formulario sin depender del estado de navegación', () => {
  const formularios = [
    { tipo: 'deuda', deuda: null }, { tipo: 'deuda', deuda },
    { tipo: 'fijo', fijo: null }, { tipo: 'fijo', fijo },
    { tipo: 'prevision', prevision: null }, { tipo: 'prevision', prevision: fijo },
    { tipo: 'abono', pago: { cuota, maestra: deuda } },
    { tipo: 'compra', tarjeta: deuda }, { tipo: 'pagarFijo', fijo },
    { tipo: 'medioPago', item: deuda, tipoItem: 'deuda' },
    { tipo: 'medioPago', item: fijo, tipoItem: 'fijo' },
  ];
  for (const formulario of formularios) {
    assert.deepEqual(resolverFormulario(rutaFormulario(formulario), [deuda], [fijo]), formulario);
  }
});
test('no permite resolver un ID ajeno al hogar o una cuota inexistente', () => {
  assert.equal(resolverFormulario('/deudas/ajena/editar', [deuda]), null);
  assert.equal(resolverFormulario('/deudas/deuda-1/abonos/ajena', [deuda]), null);
  assert.equal(resolverFormulario('/deudas/deuda-1/desconocido', [deuda]), null);
});
