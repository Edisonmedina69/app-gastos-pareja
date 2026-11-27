import { test } from "node:test";
import assert from "node:assert";
import { calcularSaludFinanciera, montoCuotaRestante, SALUD_FINANCIERA_VACIA } from "./saludFinanciera.js";

const ahora = new Date(2026, 10, 26);
const yo = { id: "u1" };

test("sin usuario devuelve la estructura vacía", () => {
  assert.deepStrictEqual(calcularSaludFinanciera({ usuarioActual: null }, ahora), SALUD_FINANCIERA_VACIA);
});

test("montoCuotaRestante usa el pago mínimo en tarjetas", () => {
  assert.strictEqual(montoCuotaRestante({ tipo: "tarjeta_credito" }, { pago_minimo: 300, monto_cuota: 1000, monto_abonado: 100 }), 200);
  assert.strictEqual(montoCuotaRestante({ tipo: "fija" }, { pago_minimo: 300, monto_cuota: 1000, monto_abonado: 100 }), 900);
  assert.strictEqual(montoCuotaRestante({ tipo: "tarjeta_credito" }, { pago_minimo: 0, monto_cuota: 1000, monto_abonado: 0 }), 1000);
});

test("carga individual: propias al 100 %, familiares al 50 %, cerradas no cuentan", () => {
  const deudas = [
    { alcance: "individual", creador_id: "u1", estado: "activa", tipo: "fija", cuotas_detalle: [{ estado: "pendiente", monto_cuota: 1000, monto_abonado: 0 }] },
    { alcance: "familiar", creador_id: "u2", estado: "activa", tipo: "fija", cuotas_detalle: [{ estado: "pendiente", monto_cuota: 2000, monto_abonado: 0 }] },
    { alcance: "individual", creador_id: "u2", estado: "activa", tipo: "fija", cuotas_detalle: [{ estado: "pendiente", monto_cuota: 500, monto_abonado: 0 }] },
    { alcance: "familiar", estado: "cerrada", tipo: "fija", cuotas_detalle: [{ estado: "pendiente", monto_cuota: 9999, monto_abonado: 0 }] },
  ];
  const ingresos = [
    { usuario_id: "u1", monto: 10000, mes: 11, anio: 2026, fecha: "2026-11-05T12:00:00" },
    { usuario_id: "u2", monto: 5000, mes: 11, anio: 2026, fecha: "2026-11-05T12:00:00" },
  ];
  const r = calcularSaludFinanciera({ usuarioActual: yo, deudas, ingresos, gastos: [], gastosProgramados: [] }, ahora);
  assert.strictEqual(r.carga, 2000); // 1000 + 2000 * 0.5
  assert.strictEqual(r.ingresos, 10000);
  assert.strictEqual(r.indice, 20);
  assert.strictEqual(r.familiar.carga, 3500);
  assert.strictEqual(r.familiar.ingresos, 15000);
});

test("balance del hogar = ingresos − gastos del mes − carga, con tasa de cambio", () => {
  const r = calcularSaludFinanciera(
    {
      usuarioActual: yo,
      deudas: [],
      ingresos: [{ usuario_id: "u1", monto: 100, tasa_cambio: 7000, mes: 11, anio: 2026 }],
      gastos: [
        { monto: 200000, fecha: "2026-11-10T12:00:00" },
        { monto: 999999, fecha: "2026-10-10T12:00:00" }, // otro mes
      ],
      gastosProgramados: [],
    },
    ahora
  );
  assert.strictEqual(r.familiar.ingresos, 700000);
  assert.strictEqual(r.balanceHogar, 500000);
});

test("índice 100 cuando hay carga pero no ingresos", () => {
  const deudas = [{ alcance: "individual", creador_id: "u1", estado: "activa", tipo: "fija", cuotas_detalle: [{ estado: "pendiente", monto_cuota: 1, monto_abonado: 0 }] }];
  const r = calcularSaludFinanciera({ usuarioActual: yo, deudas, ingresos: [], gastos: [], gastosProgramados: [] }, ahora);
  assert.strictEqual(r.indice, 100);
  assert.strictEqual(r.familiar.indice, 100);
});
