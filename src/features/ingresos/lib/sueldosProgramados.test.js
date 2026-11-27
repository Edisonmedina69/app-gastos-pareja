import { test } from "node:test";
import assert from "node:assert";
import { sueldosPendientesDeAcreditar } from "./sueldosProgramados.js";

const hoy = new Date(2026, 10, 15);
const prog = (extra) => ({ usuario_id: "u1", descripcion: "Sueldo", dia_recurrencia: 10, ...extra });

test("acredita el sueldo cuando llegó el día y no hay registro del mes", () => {
  assert.strictEqual(sueldosPendientesDeAcreditar([prog()], [], "u1", hoy).length, 1);
});

test("no acredita antes del día de cobro ni sueldos de otro usuario", () => {
  assert.strictEqual(sueldosPendientesDeAcreditar([prog({ dia_recurrencia: 20 })], [], "u1", hoy).length, 0);
  assert.strictEqual(sueldosPendientesDeAcreditar([prog({ usuario_id: "u2" })], [], "u1", hoy).length, 0);
});

test("no duplica si ya existe el ingreso [FIJO] de este mes", () => {
  const ingresos = [{ concepto: "[FIJO] Sueldo", mes: "11", anio: 2026, usuario_id: "u1" }];
  assert.strictEqual(sueldosPendientesDeAcreditar([prog()], ingresos, "u1", hoy).length, 0);
});

test("sí acredita si el registro existente es de otro mes", () => {
  const ingresos = [{ concepto: "[FIJO] Sueldo", mes: 10, anio: 2026, usuario_id: "u1" }];
  assert.strictEqual(sueldosPendientesDeAcreditar([prog()], ingresos, "u1", hoy).length, 1);
});
