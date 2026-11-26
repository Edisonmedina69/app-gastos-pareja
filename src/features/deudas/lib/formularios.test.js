import { test } from "node:test";
import assert from "node:assert";
import { valoresInicialesDeuda, valoresInicialesFijo, valoresInicialesPrevision, valoresInicialesPagoFijo, datosCuentaParaGuardar } from "./formularios.js";

test("valoresInicialesDeuda sin deuda devuelve el alta vacía con la moneda global", () => {
  const v = valoresInicialesDeuda(null, "BRL");
  assert.strictEqual(v.deudaEditandoId, null);
  assert.strictEqual(v.tipoDeuda, "fija");
  assert.strictEqual(v.monedaDeuda, "BRL");
  assert.strictEqual(v.diaVencimiento, "5");
});

test("valoresInicialesDeuda carga un préstamo: monto por cuota y cuotas pagadas", () => {
  const v = valoresInicialesDeuda({
    id: "d1", titulo: "Auto", tipo: "fija", alcance: "familiar", moneda: "PYG", tasa_interes: 14.5,
    linea_credito_total: 0, medio_pago: "efectivo",
    cuotas_detalle: [
      { monto_cuota: 500000, estado: "pagado", fecha_vencimiento: "2026-03-07", pago_minimo: 0, cargos: 15000 },
      { monto_cuota: 500000, estado: "pendiente", fecha_vencimiento: "2026-04-07" },
    ],
  });
  assert.strictEqual(v.deudaEditandoId, "d1");
  assert.strictEqual(v.modoMonto, "cuota");
  assert.strictEqual(v.montoTotalFormateado, "500.000");
  assert.strictEqual(v.cantidadCuotas, 2);
  assert.strictEqual(v.cuotasPagadas, 1);
  assert.strictEqual(v.diaVencimiento, "7");
  assert.strictEqual(v.fechaInicioDeuda, "2026-03-07");
  assert.strictEqual(v.cargosMensualesFormateado, "15.000");
  assert.strictEqual(v.tasaInteres, "14.5");
  assert.strictEqual(v.deudaMedioPago, "efectivo");
});

test("valoresInicialesDeuda carga una tarjeta con el monto total", () => {
  const v = valoresInicialesDeuda({
    id: "t1", titulo: "Visa", tipo: "tarjeta_credito", alcance: "individual", moneda: "PYG",
    fecha_cierre_tarjeta: 20, linea_credito_total: 15000000,
    cuotas_detalle: [{ monto_cuota: 1000000, estado: "pagado" }, { monto_cuota: 2400000, estado: "pendiente" }],
  });
  assert.strictEqual(v.modoMonto, "total");
  assert.strictEqual(v.montoTotalFormateado, "3.400.000");
  assert.strictEqual(v.fechaCierreTarjeta, "20");
  assert.strictEqual(v.lineaCreditoFormateada, "15.000.000");
});

test("valoresInicialesFijo y valoresInicialesPrevision cargan registros existentes", () => {
  const f = valoresInicialesFijo({ id: "f1", concepto: "Luz", monto: 380000, moneda: "PYG", dia_recurrencia: 10, categoria: "Casa", para_quien: "Ambos" });
  assert.strictEqual(f.fijoDiaRecurrencia, "10");
  assert.strictEqual(f.fijoMontoFormateado, "380.000");
  const p = valoresInicialesPrevision({ id: "p1", concepto: "[PRESUPUESTO] Ocio", monto: 200000, moneda: "PYG", para_quien: "Yo" });
  assert.strictEqual(p.previsionConcepto, "Ocio");
});

test("valoresInicialesPagoFijo deja el monto vacío si el fijo no tiene monto", () => {
  assert.strictEqual(valoresInicialesPagoFijo({ monto: 0, moneda: "PYG", para_quien: "Ambos" }, "u1").pagarMontoFormateado, "");
});

test("datosCuentaParaGuardar limpia los campos que no corresponden", () => {
  assert.deepStrictEqual(
    datosCuentaParaGuardar({ medioPago: "efectivo", tipoCuenta: "alias", alias: "x", nroCuenta: "1", nombreTitular: "a", ciTitular: "b" }),
    { medio_pago: "efectivo", tipo_cuenta: null, alias_cuenta: null, nro_cuenta: null, nombre_titular: null, ci_titular: null }
  );
  assert.deepStrictEqual(
    datosCuentaParaGuardar({ medioPago: "transferencia", tipoCuenta: "nro_cuenta", alias: "x", nroCuenta: " 123 ", nombreTitular: " Ana ", ciTitular: "9" }),
    { medio_pago: "transferencia", tipo_cuenta: "nro_cuenta", alias_cuenta: null, nro_cuenta: "123", nombre_titular: "Ana", ci_titular: "9" }
  );
});
