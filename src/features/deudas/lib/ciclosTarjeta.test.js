import { test } from "node:test";
import assert from "node:assert";
import {
  ajustarDiaHabil,
  aFechaISOLocal,
  calcularSaldoEInteres,
  calcularSiguienteVencimiento,
  construirCuotaSiguienteCiclo,
} from "./ciclosTarjeta.js";

test("ajustarDiaHabil corre sábado y domingo al lunes", () => {
  assert.strictEqual(aFechaISOLocal(ajustarDiaHabil(new Date(2026, 10, 28))), "2026-11-30"); // sábado
  assert.strictEqual(aFechaISOLocal(ajustarDiaHabil(new Date(2026, 10, 29))), "2026-11-30"); // domingo
  assert.strictEqual(aFechaISOLocal(ajustarDiaHabil(new Date(2026, 10, 26))), "2026-11-26"); // jueves
});

test("ajustarDiaHabil no modifica la fecha original", () => {
  const original = new Date(2026, 10, 28);
  ajustarDiaHabil(original);
  assert.strictEqual(original.getDate(), 28);
});

test("calcularSaldoEInteres aplica la tasa anual dividida en 12", () => {
  const r = calcularSaldoEInteres({ tasa_interes: 24 }, { monto_cuota: 1000000, monto_abonado: 400000 });
  assert.deepStrictEqual(r, { saldoPendiente: 600000, interesGenerado: 12000 });
});

test("calcularSaldoEInteres no genera interés si se pagó todo o no hay tasa", () => {
  assert.deepStrictEqual(
    calcularSaldoEInteres({ tasa_interes: 24 }, { monto_cuota: 500, monto_abonado: 800 }),
    { saldoPendiente: 0, interesGenerado: 0 }
  );
  assert.strictEqual(calcularSaldoEInteres({ tasa_interes: 0 }, { monto_cuota: 500, monto_abonado: 0 }).interesGenerado, 0);
});

test("calcularSiguienteVencimiento avanza un mes y recorta fin de mes", () => {
  assert.strictEqual(calcularSiguienteVencimiento("2026-01-31"), "2026-03-02"); // 28/02 sábado → lunes 02/03
  assert.strictEqual(calcularSiguienteVencimiento("2026-03-10"), "2026-04-10");
});

test("calcularSiguienteVencimiento pasa de diciembre a enero del año siguiente", () => {
  assert.strictEqual(calcularSiguienteVencimiento("2026-12-05"), "2027-01-05");
});

test("construirCuotaSiguienteCiclo arrastra saldo + interés y 10 % de pago mínimo", () => {
  const cuota = construirCuotaSiguienteCiclo(
    { id: "d1", tasa_interes: 12 },
    { numero_cuota: 3, monto_cuota: 200000, monto_abonado: 0, fecha_vencimiento: "2026-03-10" },
    "esp1"
  );
  assert.deepStrictEqual(cuota, {
    deuda_maestra_id: "d1",
    espacio_id: "esp1",
    numero_cuota: 4,
    monto_cuota: 202000,
    monto_abonado: 0,
    pago_minimo: 20200,
    fecha_vencimiento: "2026-04-10",
    estado: "pendiente",
  });
});
