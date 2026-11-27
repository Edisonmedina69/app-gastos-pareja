import { supabase } from './supabaseClient';

export const listarSaldosCuentasOrg = espacioId =>
  supabase
    .from('org_saldos_cuentas')
    .select('*')
    .eq('espacio_id', espacioId)
    .order('created_at', { ascending: true });

export const obtenerCuentaOrg = (espacioId, cuentaId) =>
  supabase
    .from('org_saldos_cuentas')
    .select('*')
    .eq('espacio_id', espacioId)
    .eq('id', cuentaId)
    .maybeSingle();

export const listarApuntesCuentaOrg = (espacioId, cuentaId, limite = 50) =>
  supabase
    .from('org_apuntes')
    .select('id,operacion_id,cuenta_id,importe_firmado,tasa_base,importe_base_firmado,fuente_tasa,fecha_tasa,created_at')
    .eq('espacio_id', espacioId)
    .eq('cuenta_id', cuentaId)
    .order('created_at', { ascending: false })
    .limit(limite);

export const listarOperacionesOrg = (espacioId, limite = 50) =>
  supabase
    .from('org_operaciones')
    .select('id,tipo,fecha_efectiva,registrado_por,idempotencia,reversa_de,motivo,created_at')
    .eq('espacio_id', espacioId)
    .order('fecha_efectiva', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limite);

export const listarReporteSociosOrg = espacioId =>
  supabase
    .from('org_reporte_socios')
    .select('*')
    .eq('espacio_id', espacioId)
    .order('socio_nombre', { ascending: true })
    .order('moneda', { ascending: true });

export const listarMovimientosSociosOrg = (espacioId, limite = 50) =>
  supabase
    .from('org_movimientos_socios')
    .select('id,operacion_id,miembro_id,clase,moneda,importe_deuda_firmado,tasa_base,importe_base_firmado,created_at')
    .eq('espacio_id', espacioId)
    .order('created_at', { ascending: false })
    .limit(limite);

export const crearCuentaOrg = (
  espacioId,
  { nombre, tipo, moneda = 'PYG', titularMiembroId = null, referencia = null }
) =>
  supabase.rpc('crear_cuenta_org', {
    p_espacio_id_esperado: espacioId,
    p_nombre: nombre,
    p_tipo: tipo,
    p_moneda: moneda,
    p_titular_miembro_id: titularMiembroId || null,
    p_referencia: referencia || null,
  });

export const actualizarCuentaOrg = (
  espacioId,
  cuentaId,
  { nombre = null, referencia = null, activa = null }
) =>
  supabase.rpc('actualizar_cuenta_org', {
    p_espacio_id_esperado: espacioId,
    p_cuenta_id: cuentaId,
    p_nombre: nombre,
    p_referencia: referencia,
    p_activa: activa,
  });

export const transferirOrg = (
  espacioId,
  {
    idempotencia,
    cuentaOrigenId,
    cuentaDestinoId,
    importeOrigen,
    importeDestino = null,
    fechaEfectiva = null,
    tasaOrigenBase = null,
    tasaDestinoBase = null,
    fuenteTasa = 'manual_confirmada',
    motivo = null,
    confirmarSaldoInsuficiente = false,
  }
) =>
  supabase.rpc('transferir_org', {
    p_espacio_id_esperado: espacioId,
    p_idempotencia: idempotencia,
    p_cuenta_origen_id: cuentaOrigenId,
    p_cuenta_destino_id: cuentaDestinoId,
    p_importe_origen: importeOrigen,
    p_importe_destino: importeDestino,
    p_fecha_efectiva: fechaEfectiva,
    p_tasa_origen_base: tasaOrigenBase,
    p_tasa_destino_base: tasaDestinoBase,
    p_fuente_tasa: fuenteTasa,
    p_motivo: motivo,
    p_confirmar_saldo_insuficiente: confirmarSaldoInsuficiente,
  });

export const registrarPagoPersonalSocioOrg = (
  espacioId,
  {
    idempotencia,
    miembroId,
    cuentaSocioId,
    importe,
    tasaBase = null,
    fuenteTasa = 'manual_confirmada',
    fechaEfectiva = null,
    motivo,
  }
) =>
  supabase.rpc('registrar_pago_personal_socio_org', {
    p_espacio_id_esperado: espacioId,
    p_idempotencia: idempotencia,
    p_miembro_id: miembroId,
    p_cuenta_socio_id: cuentaSocioId,
    p_importe: importe,
    p_tasa_base: tasaBase,
    p_fuente_tasa: fuenteTasa,
    p_fecha_efectiva: fechaEfectiva,
    p_motivo: motivo,
  });

export const registrarMovimientoSocioOrg = (
  espacioId,
  {
    idempotencia,
    tipo,
    miembroId,
    cuentaId,
    importe,
    tasaBase = null,
    fuenteTasa = 'manual_confirmada',
    fechaEfectiva = null,
    motivo,
    confirmarSaldoInsuficiente = false,
  }
) =>
  supabase.rpc('registrar_movimiento_socio_org', {
    p_espacio_id_esperado: espacioId,
    p_idempotencia: idempotencia,
    p_tipo: tipo,
    p_miembro_id: miembroId,
    p_cuenta_id: cuentaId,
    p_importe: importe,
    p_tasa_base: tasaBase,
    p_fuente_tasa: fuenteTasa,
    p_fecha_efectiva: fechaEfectiva,
    p_motivo: motivo,
    p_confirmar_saldo_insuficiente: confirmarSaldoInsuficiente,
  });

export const revertirOperacionOrg = (
  espacioId,
  { idempotencia, operacionId, motivo, fechaEfectiva = null }
) =>
  supabase.rpc('revertir_org', {
    p_espacio_id_esperado: espacioId,
    p_idempotencia: idempotencia,
    p_operacion_id: operacionId,
    p_motivo: motivo,
    p_fecha_efectiva: fechaEfectiva,
  });
