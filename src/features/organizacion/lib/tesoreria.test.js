import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatearMonedaOrg,
  parsearImporteOrg,
  validarTasaBaseOrg,
  validarTransferenciaOrg,
} from './tesoreria.js';

test('formatearMonedaOrg redondea PYG a 0 decimales y USD/BRL a 2 decimales', () => {
  assert.equal(formatearMonedaOrg(1000000, 'PYG'), '1.000.000 Gs.');
  assert.equal(formatearMonedaOrg(0, 'PYG'), '0 Gs.');
  assert.equal(formatearMonedaOrg(80, 'USD'), 'USD 80,00');
  assert.equal(formatearMonedaOrg(125.5, 'BRL'), 'R$ 125,50');
});

test('parsearImporteOrg exige enteros en PYG y admite hasta 2 decimales en USD/BRL', () => {
  assert.equal(parsearImporteOrg('1.000.000', 'PYG'), 1000000);
  assert.equal(Number.isNaN(parsearImporteOrg('100,50', 'PYG')), true);
  assert.equal(parsearImporteOrg('120,50', 'USD'), 120.5);
  assert.equal(parsearImporteOrg('120.55', 'BRL'), 120.55);
  assert.equal(Number.isNaN(parsearImporteOrg('120.555', 'USD')), true);
});

test('validarTasaBaseOrg rechaza fallback 1 para USD y BRL', () => {
  assert.equal(validarTasaBaseOrg('PYG', 1).valida, true);
  assert.equal(validarTasaBaseOrg('USD', 1).valida, false);
  assert.equal(validarTasaBaseOrg('BRL', 1).valida, false);
  assert.equal(validarTasaBaseOrg('USD', 0).valida, false);
  assert.equal(validarTasaBaseOrg('USD', 7500).valida, true);
  assert.equal(validarTasaBaseOrg('BRL', 1500).valida, true);
});

test('validarTransferenciaOrg valida misma moneda, cambio con tasa manual y alerta de saldo insuficiente', () => {
  const cajaPyg = { id: 'c1', nombre: 'Caja PYG', moneda: 'PYG', saldo: 500000 };
  const anaPyg = { id: 'c2', nombre: 'Custodia Ana PYG', moneda: 'PYG', saldo: 0 };
  const bancoUsd = { id: 'c3', nombre: 'Banco USD', moneda: 'USD', saldo: 100 };

  // Misma moneda con saldo suficiente
  const okMisma = validarTransferenciaOrg({
    cuentaOrigen: cajaPyg,
    cuentaDestino: anaPyg,
    importeOrigen: '200.000',
  });
  assert.equal(okMisma.valida, true);
  assert.equal(okMisma.esCambio, false);
  assert.equal(okMisma.importeOrigen, 200000);
  assert.equal(okMisma.importeDestino, 200000);

  // Saldo insuficiente sin confirmación ni motivo se rechaza
  const sinSaldo = validarTransferenciaOrg({
    cuentaOrigen: anaPyg,
    cuentaDestino: cajaPyg,
    importeOrigen: '100.000',
  });
  assert.equal(sinSaldo.valida, false);
  assert.equal(sinSaldo.requiereConfirmarSaldo, true);

  // Saldo insuficiente con confirmación y motivo pasa
  const conExcepcion = validarTransferenciaOrg({
    cuentaOrigen: anaPyg,
    cuentaDestino: cajaPyg,
    importeOrigen: '100.000',
    confirmarSaldoInsuficiente: true,
    motivo: 'Adelanto autorizado',
  });
  assert.equal(conExcepcion.valida, true);

  // Cambio PYG -> USD sin tasa manual o con tasa 1 falla
  const cambioSinTasa = validarTransferenciaOrg({
    cuentaOrigen: cajaPyg,
    cuentaDestino: bancoUsd,
    importeOrigen: '150.000',
    importeDestino: '20',
    tasaDestinoBase: 1,
  });
  assert.equal(cambioSinTasa.valida, false);

  // Cambio PYG -> USD con tasa manual confirmada 7500 pasa y calcula valoración base
  const cambioOk = validarTransferenciaOrg({
    cuentaOrigen: cajaPyg,
    cuentaDestino: bancoUsd,
    importeOrigen: '150.000',
    importeDestino: '20',
    tasaDestinoBase: 7500,
  });
  assert.equal(cambioOk.valida, true);
  assert.equal(cambioOk.esCambio, true);
  assert.equal(cambioOk.baseOrigen, 150000);
  assert.equal(cambioOk.baseDestino, 150000);
  assert.equal(cambioOk.diferenciaValoracionBase, 0);
});
