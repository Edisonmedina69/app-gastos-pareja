import { test } from "node:test";
import assert from "node:assert";
import { construirAlertasVencimiento, tarjetasParaCierreAutomatico } from "./alertasVencimiento.js";

const ctx = { espacioId: "esp1", usuarioId: "u1" };
const hoy = new Date(2026, 10, 26, 10, 0, 0);

test("construirAlertasVencimiento avisa cuotas que vencen en 0 a 2 días", () => {
  const deudas = [
    {
      titulo: "Préstamo",
      cuotas_detalle: [
        { numero_cuota: 1, estado: "pendiente", fecha_vencimiento: "2026-11-27" },
        { numero_cuota: 2, estado: "pendiente", fecha_vencimiento: "2026-12-20" },
        { numero_cuota: 3, estado: "pagado", fecha_vencimiento: "2026-11-27" },
      ],
    },
  ];
  const alertas = construirAlertasVencimiento(deudas, [], ctx, hoy);
  assert.strictEqual(alertas.length, 1);
  assert.deepStrictEqual(alertas[0], {
    espacio_id: "esp1",
    usuario_id: "u1",
    titulo: "⚠️ Vencimiento",
    mensaje: 'Cuota 1 de "Préstamo" vence en 1 días.',
    tipo: "alerta",
  });
});

test("construirAlertasVencimiento no repite un mensaje ya notificado", () => {
  const deudas = [{ titulo: "TC", cuotas_detalle: [{ numero_cuota: 1, estado: "pendiente", fecha_vencimiento: "2026-11-27" }] }];
  const previas = [{ mensaje: 'Cuota 1 de "TC" vence en 1 días.' }];
  assert.strictEqual(construirAlertasVencimiento(deudas, previas, ctx, hoy).length, 0);
});

test("tarjetasParaCierreAutomatico sólo devuelve tarjetas activas con cierre alcanzado", () => {
  const tarjeta = (id, extra) => ({
    id,
    tipo: "tarjeta_credito",
    estado: "activa",
    fecha_cierre_tarjeta: 20,
    cuotas_detalle: [{ id: `c-${id}`, estado: "pendiente", fecha_vencimiento: "2026-12-05" }],
    ...extra,
  });
  const deudas = [
    tarjeta("vencida"), // cierre 20/11 < hoy
    tarjeta("cerrada", { estado: "cerrada" }),
    tarjeta("prestamo", { tipo: "fija" }),
    tarjeta("futura", { cuotas_detalle: [{ estado: "pendiente", fecha_vencimiento: "2027-01-05" }] }),
  ];
  const r = tarjetasParaCierreAutomatico(deudas, hoy);
  assert.deepStrictEqual(r.map((x) => x.deuda.id), ["vencida"]);
  assert.strictEqual(r[0].cuota.id, "c-vencida");
});
