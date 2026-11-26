import { existeAlgunIngreso, insertarIngresos } from "./ingresos.service";
import { existeAlgunGasto, insertarGastos } from "./gastos.service";
import { crearDeudaSoloId, existeAlgunaDeuda, insertarCuotas } from "./deudas.service";
import { existeAlgunGastoProgramado, insertarGastosProgramados } from "./gastosProgramados.service";

/**
 * Datos de la cuenta demo ("PROBAR DEMO INSTANTÁNEA").
 *
 * El botón de demo del Login se quitó (P0 de seguridad); quedan el perfil demo
 * existente (verificarPerfil) y el botón "Cargar Deudas Demo" de Deudas Pro.
 */
export const DEMO_EMAIL = "demo@nandefinanza.com";
export const NOMBRE_HOGAR_DEMO = "Hogar Demo 🧪";
export const NOMBRE_PERFIL_DEMO = "Invitado Demo 🧪";

const mes2 = (n) => String(n).padStart(2, "0");

/**
 * Crea las deudas de ejemplo. Con `incluirTarjeta: false` solo crea la deuda en
 * cuotas y el préstamo (lo que hace el botón "Cargar Deudas Demo").
 */
export async function sembrarDeudasDemo(espacioId, usuarioId, { incluirTarjeta = true } = {}) {
  const hoy = new Date();
  const anio = hoy.getFullYear();

  const { data: d1 } = await crearDeudaSoloId({
    espacio_id: espacioId, creador_id: usuarioId, titulo: 'Tarjeta Crédito Itaú - TV Smart 55"',
    tipo: "fija", alcance: "familiar", moneda: "PYG", estado: "activa",
  });
  if (d1) {
    await insertarCuotas([
      { deuda_maestra_id: d1.id, espacio_id: espacioId, numero_cuota: 1, monto_cuota: 400000, monto_abonado: 400000, estado: "pagado", fecha_vencimiento: `${anio}-${mes2(hoy.getMonth())}-25` },
      { deuda_maestra_id: d1.id, espacio_id: espacioId, numero_cuota: 2, monto_cuota: 400000, monto_abonado: 0, estado: "pendiente", fecha_vencimiento: `${anio}-${mes2(hoy.getMonth() + 1)}-25` },
    ]);
  }

  const { data: d2 } = await crearDeudaSoloId({
    espacio_id: espacioId, creador_id: usuarioId, titulo: "Préstamo Auto Banco Continental",
    tipo: "fija", alcance: "familiar", tasa_interes: 14.5, moneda: "PYG", estado: "activa",
  });
  if (d2) {
    await insertarCuotas([
      { deuda_maestra_id: d2.id, espacio_id: espacioId, numero_cuota: 1, monto_cuota: 1550000, monto_abonado: 0, estado: "pendiente", fecha_vencimiento: `${anio}-${mes2(hoy.getMonth() + 1)}-10` },
    ]);
  }

  if (!incluirTarjeta) return;

  const { data: d3 } = await crearDeudaSoloId({
    espacio_id: espacioId, creador_id: usuarioId, titulo: "Tarjeta Sudameris Visa Signature",
    tipo: "tarjeta_credito", nro_tarjeta: "8842", linea_credito_total: 15000000, linea_credito_disponible: 12600000,
    fecha_cierre_tarjeta: 20, alcance: "individual", moneda: "PYG", estado: "activa",
  });
  if (d3) {
    await insertarCuotas([
      { deuda_maestra_id: d3.id, espacio_id: espacioId, numero_cuota: 1, monto_cuota: 2400000, pago_minimo: 850000, monto_abonado: 0, estado: "pendiente", fecha_vencimiento: `${anio}-${mes2(hoy.getMonth() + 1)}-05` },
    ]);
  }
}

/**
 * Completa el hogar demo con ingresos, gastos, deudas y (opcionalmente) gastos
 * fijos. Cada bloque solo se carga si esa tabla todavía está vacía.
 */
export async function sembrarDatosDemo(espacioId, usuarioId, { incluirGastosProgramados = false } = {}) {
  const hoy = new Date();

  // 1. Ingresos mensuales
  const { data: exIngresos } = await existeAlgunIngreso(espacioId);
  if (!exIngresos || exIngresos.length === 0) {
    await insertarIngresos([
      { espacio_id: espacioId, usuario_id: usuarioId, monto: 8500000, moneda: "PYG", concepto: "Salario Titular", mes: hoy.getMonth() + 1, anio: hoy.getFullYear() },
      { espacio_id: espacioId, usuario_id: usuarioId, monto: 5200000, moneda: "PYG", concepto: "Ingreso Pareja", mes: hoy.getMonth() + 1, anio: hoy.getFullYear() },
    ]);
  }

  // 2. Gastos reales
  const { data: exGastos } = await existeAlgunGasto(espacioId);
  if (!exGastos || exGastos.length === 0) {
    await insertarGastos([
      { espacio_id: espacioId, usuario_id: usuarioId, pagador_id: usuarioId, concepto: "Supermercado Stock - Compras del Mes", monto: 2200000, moneda: "PYG", categoria: "Alimentación", para_quien: "Ambos" },
      { espacio_id: espacioId, usuario_id: usuarioId, pagador_id: usuarioId, concepto: "Alquiler Departamento", monto: 3500000, moneda: "PYG", categoria: "Vivienda", para_quien: "Ambos" },
      { espacio_id: espacioId, usuario_id: usuarioId, pagador_id: usuarioId, concepto: "Carga de Combustible Petrobras", monto: 650000, moneda: "PYG", categoria: "Transporte", para_quien: "Yo" },
      { espacio_id: espacioId, usuario_id: usuarioId, pagador_id: usuarioId, concepto: "Cena de Fin de Semana", monto: 450000, moneda: "PYG", categoria: "Entretenimiento", para_quien: "Ambos" },
      { espacio_id: espacioId, usuario_id: usuarioId, pagador_id: usuarioId, concepto: "Factura ANDE Luz", monto: 380000, moneda: "PYG", categoria: "Servicios", para_quien: "Ambos" },
    ]);
  }

  // 3. Deudas
  const { data: exDeudas } = await existeAlgunaDeuda(espacioId);
  if (!exDeudas || exDeudas.length === 0) {
    await sembrarDeudasDemo(espacioId, usuarioId);
  }

  // 4. Gastos programados
  if (!incluirGastosProgramados) return;
  const { data: exProg } = await existeAlgunGastoProgramado(espacioId);
  if (!exProg || exProg.length === 0) {
    await insertarGastosProgramados([
      { espacio_id: espacioId, concepto: "Internet Fibra Óptica Personal", monto: 180000, moneda: "PYG", dia_recurrencia: 10, categoria: "Servicios", para_quien: "Ambos" },
      { espacio_id: espacioId, concepto: "Expensas Edificio / Barrio", monto: 450000, moneda: "PYG", dia_recurrencia: 5, categoria: "Vivienda", para_quien: "Ambos" },
      { espacio_id: espacioId, concepto: "Seguro Médico Sanatorio Migone", monto: 550000, moneda: "PYG", dia_recurrencia: 15, categoria: "Salud", para_quien: "Ambos" },
      { espacio_id: espacioId, concepto: "Fondo de Emergencia Familiar", monto: 1000000, moneda: "PYG", dia_recurrencia: 1, categoria: "Ahorro", para_quien: "Ambos" },
    ]);
  }
}
